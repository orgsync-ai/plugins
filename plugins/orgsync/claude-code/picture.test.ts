import { test, expect } from "claude-code/testing";
import { AS_OF, changed, jsonWire, PERSON, pictureFixture, practiceFixture, supportContextFixture, SOURCE, sourceFixture, wire } from "./fixtures.js";
import { decisionLine, lookKey, mapTools, parsePicture, parseSources, readable, refusalStopsReads } from "./picture.js";

test("date display replaces ISO times without changing other plain facts", () => {
  const text = readable("Published 2026-10-11T12:00:00.000Z; effective 2026-10-12T13:05:00+00:00; accepted decision.");
  expect(text).toContain("Published Oct 11"); expect(text).toContain("effective Oct 12"); expect(text).not.toContain("2026-"); expect(text).toContain("accepted decision.");
});

test("picture parses both wire shapes and stores only displayed facts", () => {
  const a = parsePicture(wire(pictureFixture())), b = parsePicture(jsonWire(pictureFixture()));
  expect(a).toEqual(b);
  expect(a?.items.map(i => i.section)).toEqual(["needs", "needs", "decisions", "role"]);
  expect(JSON.stringify(a)).not.toContain("HIDDEN DESCRIPTION");
  expect(lookKey(a!)).toBe("look:v1:company-a:person-a");
});

test("an approver's newly shared reported information needs them, and an older server's picture without it still parses", () => {
  const p = pictureFixture(), eva = { personId: "person-eva", label: "Eva" }, shared = { sourceId: "source-b", revision: 1, title: "Repair refunds over $700" };
  const parsed = parsePicture(wire({ ...p, needsYou: { ...p.needsYou, approver: { ...p.needsYou.approver,
    recentSharedSources: { count: 1, items: [{ source: shared, knowledgeStatus: "reported_information", sharedBy: eva, sharedAt: AS_OF }], truncated: false } } } }));
  expect(parsed?.items.filter(i => i.section === "needs").map(i => i.id)).toEqual(["draft:draft-a:1", "proposal:proposal-a:1", "shared:source-b:1"]);
  expect(parsed?.items.find(i => i.id === "shared:source-b:1")).toMatchObject({ title: "Repair refunds over $700",
    details: ["Shared by Eva as reported information", "Not yet accepted as a company decision", `Shared ${AS_OF}`] });
  expect(parsed?.counts).toContainEqual({ label: "Newly shared reported information", count: 1, truncated: false });
  expect(parsePicture(wire(p))?.counts.map(c => c.label)).not.toContain("Newly shared reported information");
});

test("limitation codes become plain sentences, with unknown and engineering codes omitted", () => {
  const p = pictureFixture();
  p.limitations = ["drafts_require_submit_scope", "work_profile_missing", "role_relevance_not_ranked", "lookback_clamped",
    "deletion_titles_withheld", "deletion_actor_unavailable", "timestamp_feed_not_lossless", "future_code", "toString"];
  expect(parsePicture(wire(p))?.limitations).toEqual(["This connection cannot show your private drafts.", "Your work profile has not been set.",
    "Changes cover only the past 30 days.", "Deleted source titles are hidden.", "Who deleted a source is unavailable."]);
});

for (const field of ["title", "description", "roleObjectives", "managerPersonId"] as const) test(`a nullable work-profile ${field} keeps the picture available`, () => {
  const p = pictureFixture(), work = { ...p.yourRole.workProfile, [field]: null };
  const parsed = parsePicture(wire({ ...p, yourRole: { ...p.yourRole, workProfile: work } }));
  expect(parsed?.items.find(i => i.section === "role")?.details).toContain("Refund reviews");
});
test("nullable work profile, draft section, and member approver section keep the picture available", () => {
  const p = pictureFixture();
  for (const body of [
    { ...p, yourRole: { ...p.yourRole, workProfile: null } },
    { ...p, needsYou: { ...p.needsYou, pendingDrafts: null } },
    { ...p, yourRole: { ...p.yourRole, permissionProfile: "member" }, needsYou: { ...p.needsYou, approver: null } }
  ]) expect(parsePicture(wire(body))).not.toBe(null);
});
test("a correction without a proposer names only its accepter; a deletion without an actor remains visible", () => {
  const p = pictureFixture();
  p.changedForYou.items = [
    { kind: "correction_accepted", eventId: "correction", at: AS_OF, by: PERSON, source: SOURCE, previousRevision: 1,
      previousRevisionStatus: "superseded", knowledgeStatus: "accepted_decision", effectiveAt: null, proposedBy: null },
    { kind: "source_deleted", eventId: "deletion", at: AS_OF, by: null, source: null }
  ]; p.changedForYou.count = 2;
  const parsed = parsePicture(wire(p));
  expect(parsed?.changes[0]?.line).toContain("Correction accepted by Sam"); expect(parsed?.changes[0]?.line).not.toContain("proposed by");
  expect(parsed?.changes[1]?.line).toContain("A source was deleted");
});
test("unknown changes and section entries are skipped while known facts remain", () => {
  const p = pictureFixture(), unknown = { kind: "future_fact", future: "UNKNOWN SENTINEL" };
  const withUnknown = <T>(section: { count: number; items: T[]; truncated: boolean }) => ({ ...section, count: section.count + 1, items: [...section.items, unknown] });
  const parsed = parsePicture(wire({ ...p,
    needsYou: { pendingDrafts: withUnknown(p.needsYou.pendingDrafts),
      approver: { awaitingProposals: withUnknown(p.needsYou.approver.awaitingProposals), recentProblemReports: withUnknown(p.needsYou.approver.recentProblemReports) },
      ownDecidedProposals: withUnknown(p.needsYou.ownDecidedProposals), futureSection: unknown },
    changedForYou: { count: 2, items: [unknown, changed()], truncated: false },
    decisionsThatShapeYourWork: { ...p.decisionsThatShapeYourWork, page: withUnknown(p.decisionsThatShapeYourWork.page) }, futureSection: unknown }));
  expect(parsed?.items.map(i => i.section)).toEqual(["needs", "needs", "changed", "decisions", "role"]);
  expect(parsed?.changes.map(c => c.eventId)).toEqual(["event-a"]); expect(JSON.stringify(parsed)).not.toContain("UNKNOWN SENTINEL");
});

test("picture refusals and malformed facts are unavailable without leaked values", () => {
  for (const status of ["error", "denied", "unavailable", "unknown"]) expect(parsePicture(wire({ status, code: "SECRET" }))).toBe(null);
  expect(parsePicture({ ...jsonWire(pictureFixture()), structuredContent: { status: "denied" } })).toBe(null);
  const p = pictureFixture(); p.decisionsThatShapeYourWork.page.items[0]!.knowledgeStatus = "SECRET";
  expect(parsePicture(wire(p))).toBe(null);
  expect(refusalStopsReads(wire({ status: "error", code: "connection_revoked" }))).toBe(true);
  expect(refusalStopsReads({ ...wire({ status: "error", code: "connection_revoked" }), isError: true })).toBe(true);
  expect(refusalStopsReads(wire({ status: "unavailable", code: "temporary_failure" }))).toBe(false);
});

test("a text-only picture can exceed eight kilobytes without dropping legitimate facts", () => {
  const p = pictureFixture(); p.limitations = ["x".repeat(8000), "y".repeat(8000)];
  expect(parsePicture(jsonWire(p))?.company.name).toBe("Acorn");
});

test("change intervals validate bounds, ties, completeness and title-free deletion", () => {
  const p = pictureFixture(); p.changedForYou.items = [changed(), { kind: "source_deleted", eventId: "event-b", at: p.asOf, by: null, source: null }]; p.changedForYou.count = 2;
  const parsed = parsePicture(wire(p));
  expect(parsed?.changes.map(c => c.eventId)).toEqual(["event-a", "event-b"]);
  expect(parsed?.changes[1]?.line).toContain("A source was deleted");
  p.changedForYou.truncated = true; expect(parsePicture(wire(p))?.changesComplete).toBe(false);
  p.changedForYou.truncated = false; p.window.sinceClamped = true; expect(parsePicture(wire(p))?.changesComplete).toBe(false);
  p.changedForYou.items = [changed("event-a", "2030-01-01T00:00:00Z")]; p.changedForYou.count = 1;
  expect(parsePicture(wire(p))).toBe(null);
});

test("standing facts ignore snapshot clocks and event ordering, but bind identity", () => {
  const p = pictureFixture(), original = parsePicture(wire(p))!;
  p.asOf = "2026-10-11T13:00:00Z"; p.window.until = p.asOf;
  p.changedForYou.items = [changed()]; p.changedForYou.count = 1;
  expect(parsePicture(wire(p))?.standingHash).toBe(original.standingHash);
  expect(parsePicture(wire(p))?.factsHash).not.toBe(original.factsHash);
  p.yourRole.person.personId = "person-b";
  expect(lookKey(parsePicture(wire(p))!)).not.toBe(lookKey(original));
});

test("tool spelling requires one listed MCP name for the connected server", () => {
  const listed = (name: string) => ({ name, mcp: true });
  expect(mapTools("other", [listed("mcp__orgsync__readSource")])).toEqual({});
  expect(mapTools("plugin:orgsync:orgsync", [listed("mcp__plugin_orgsync_orgsync__readSource")])).toEqual({ mcp__plugin_orgsync_orgsync__readSource: "readSource" });
  expect(mapTools("plugin:orgsync:orgsync", [listed("mcp__plugin_orgsync_orgsync__readSource"), listed("mcp__plugin:orgsync:orgsync__readSource")])).toEqual({});
});

test("source metadata ignores content and never invents historical acceptance", () => {
  const s = sourceFixture();
  expect(parseSources(wire(s), "readSource")).toEqual(parseSources(jsonWire({ status: "success", sources: [s] }), "readPermittedContext"));
  expect(decisionLine(parseSources(wire(s), "readSource"))).toContain("accepted by Sam");
  s.knowledgeStatus = "disputed";
  expect(decisionLine(parseSources(wire(s), "readSource"))).not.toContain("accepted by");
  expect(parseSources(wire({ status: "denied", sources: [s] }), "readPermittedContext")).toEqual([]);
});

test("new focus and business facts change standing hashes; absent focus stays unavailable", () => {
  const old=pictureFixture(), focus={count:1,truncated:false,items:[{objectiveId:"objective-a",revision:1,scope:"person",title:"Customer conversations",
    horizon:"week",dueOn:"2026-10-21",owner:{...PERSON,active:false}}]};
  const p={...old,yourFocus:focus,businessProfile:{country:"CA",subdivision:"CA-NS",stage:"starting",helpAreas:["sales_marketing"]}};
  const parsed=parsePicture(wire(p))!;expect(parsed.focusAvailable).toBe(true);expect(parsePicture(wire(old))?.focusAvailable).toBe(false);
  expect(parsed.items.find(i=>i.section==="focus")?.details).toContain("Responsible: Sam (inactive membership)");
  expect(parsed.items.find(i=>i.section==="business")?.details).toContain("Stage: starting");
  expect(parsed.standingHash).not.toBe(parsePicture(wire({...p,yourFocus:{...focus,items:[{...focus.items[0]!,revision:2,title:"New focus"}]}}))?.standingHash);
  for(const yourFocus of [{...focus,count:0},{...focus,truncated:true},{...focus,items:Array(6).fill(focus.items[0])},
    {...focus,items:[{...focus.items[0]!,dueOn:"2026-02-30"}]}]) expect(parsePicture(wire({...p,yourFocus}))).toBe(null);
});


test("practices distinguish old-server absence, empty and truncated, and bind all standing facts", () => {
  const old = pictureFixture(), practice = practiceFixture(), page = { count: 2, truncated: true, items: [practice] };
  const parsed = parsePicture(wire({ ...old, howWeWork: page }))!;
  expect(parsePicture(wire(old))?.howWeWorkAvailable).toBe(false);
  const empty = parsePicture(wire({ ...old, howWeWork: { count: 0, items: [], truncated: false } }))!;
  expect(empty.howWeWorkAvailable).toBe(true);
  expect(empty.counts).toContainEqual({ label: "How we work", count: 0, truncated: false });
  expect(parsed.items.find(i => i.section === "practices")).toMatchObject({ id: "practice:source-practice:2", title: practice.title,
    details: expect.arrayContaining(["Area: sales marketing", "Way of working", "2 accepted practices in this area", "Compare directions before resolving any conflict."]) });
  expect(parsed.counts).toContainEqual({ label: "How we work", count: 2, truncated: true });
  for (const change of [{ title: "New wording" }, { acceptedInAreaCount: 1 }, { currentRevision: 3 }, { area: "operations" }]) {
    expect(parsePicture(wire({ ...old, howWeWork: { ...page, items: [{ ...practice, ...change }] } }))?.standingHash).not.toBe(parsed.standingHash);
  }
  expect(empty.standingHash).not.toBe(parsePicture(wire(old))?.standingHash);
});

test("supplied practice sections fail closed for malformed or ineligible entries", () => {
  const old = pictureFixture(), practice = practiceFixture(), page = { count: 1, truncated: false, items: [practice] };
  for (const howWeWork of [null, {}, { ...page, count: 0 }, { ...page, truncated: true }, { ...page, count: 6, items: Array(6).fill(practice) },
    ...[{ area: null }, { classification: null }, { area: "unknown" }, { classification: "practice" }, { knowledgeStatus: "disputed" },
      { processing: "processing" }, { usableAsCurrentGuidance: false }, { acceptedInAreaCount: 0 }, { sourceId: undefined }].map(change => ({ ...page, items: [{ ...practice, ...change }] }))]) {
    expect(parsePicture(wire({ ...old, howWeWork }))).toBe(null);
  }
});

test("focus surfaces target revisions and closure without changing the personal goal", () => {
  const old = pictureFixture(), target = supportContextFixture(), goal = { objectiveId: "person-goal", revision: 1, scope: "person",
    title: "Speak with customers", horizon: "week", dueOn: "2026-10-21", owner: { ...PERSON, active: true }, supportsContext: target };
  const parse = (supportsContext: unknown) => parsePicture(wire({ ...old, yourFocus: { count: 1, truncated: false, items: [{ ...goal, supportsContext }] } }));
  const parsed = parse(target)!;
  expect(parsed.items.find(i => i.section === "focus")?.details).toEqual(expect.arrayContaining(["Supports company goal: Win five customers",
    "Target revision 3; linked at revision 2", "Target status: active", "Company goal changed. Review the link with the person."]));
  for (const status of ["completed", "dropped"]) {
    const closed = parse({ ...target, status })!;
    expect(closed.items.find(i => i.section === "focus")?.details).toContain("Company goal closed. The person goal remains unchanged.");
    expect(closed.standingHash).not.toBe(parsed.standingHash);
  }
  for (const change of [{ objectiveId: "other-company-goal" }, { title: "New company goal" }, { revision: 4 }, { linkedRevision: 3 }]) expect(parse({ ...target, ...change })?.standingHash).not.toBe(parsed.standingHash);
  expect(parse(null)?.items.find(i => i.section === "focus")?.details.join(" ")).not.toContain("Supports");
  expect(parse(undefined)).not.toBe(null);
  for (const value of [{}, { ...target, objectiveId: null }, { ...target, title: null }, { ...target, revision: 0 },
    { ...target, linkedRevision: undefined }, { ...target, status: "unknown" }]) expect(parse(value)).toBe(null);
});


test("a classified disputed decision can have no adopted practices in its area", () => {
  const p = pictureFixture(), decision = { ...practiceFixture(), knowledgeStatus: "disputed", usableAsCurrentGuidance: false, acceptedInAreaCount: 0 };
  const parsed = parsePicture(wire({ ...p, decisionsThatShapeYourWork: { ordering: "first_published_desc", page: { count: 1, truncated: false, items: [decision] } } }));
  expect(parsed?.items.find(i => i.section === "decisions")?.details).toContain("0 accepted practices in this area");
  expect(parsed?.items.filter(i => i.section === "practices")).toEqual([]);
});
