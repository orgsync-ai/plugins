import { test, expect } from "claude-code/testing";
import { AS_OF, changed, collaborationFixture, frameworkConfigFixture, frameworkSummaryFixture, legacyFrameworkConfigFixture, jsonWire, PERSON, pictureFixture, pillarInstructionsFixture, practiceFixture, supportContextFixture, SOURCE, sourceFixture, wire } from "./fixtures.js";
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

test("this week's own priorities join focus; null or an older server adds none, and malformed ones are unavailable", () => {
  const old=pictureFixture(), weekly={reviewId:"review-a",recordedAt:AS_OF,priorities:["Call five customers","Fix the import"]};
  const parsed=parsePicture(wire({...old,yourPriorities:weekly}))!;
  expect(parsed.items.filter(i=>i.section==="focus").map(i=>[i.id,i.title,i.details[0]])).toEqual([
    ["priority:review-a:0","Call five customers","Your priority this week"],["priority:review-a:1","Fix the import","Your priority this week"]]);
  for(const yourPriorities of [null,undefined])expect(parsePicture(wire({...old,yourPriorities}))?.items.some(i=>i.id.startsWith("priority:"))).toBe(false);
  for(const yourPriorities of [{...weekly,priorities:[]},{...weekly,priorities:["a","b","c","d"]},{...weekly,recordedAt:"yesterday"},{...weekly,priorities:[7]}])
    expect(parsePicture(wire({...old,yourPriorities}))).toBe(null);
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


test("collaboration title facts preserve assignment, acknowledgment, pending and agreed terms without loading request text", () => {
  const request = collaborationFixture();
  const body = { ...pictureFixture(), collaboration: { requests: [request], counts: { needsYou: 1, waiting: 2, blocked: 0 }, nextCursor: null }, frameworkConfig: frameworkConfigFixture() };
  const parsed = parsePicture(wire(body));
  expect(parsed?.collaborationAvailable).toBe(true); expect(parsed?.frameworksAvailable).toBe(true);
  expect(parsed?.items.find(i => i.id === "collaboration:contribution-a:1")?.details).toContain("No recipient agreement for these terms");
  expect(JSON.stringify(parsed?.items.filter(i => i.section === "frameworks"))).not.toContain("Kanban");
  expect(parsed?.counts).toContainEqual({ label: "Collaboration needs you", count: 1, truncated: false });
  expect(JSON.stringify(parsed)).not.toContain("HIDDEN");
  const agreement = { personId: "person-a", termsRevision: 1, dueOn: "2026-10-23", recordedAt: AS_OF };
  const pendingTerms = { proposedByPersonId: "person-a", proposalRevision: 2, dueOn: "2026-10-24", reason: "HIDDEN PROPOSAL", recordedAt: AS_OF };
  const next = parsePicture(wire({ ...body, collaboration: { ...body.collaboration, requests: [{ ...request, revision: 2, agreement, pendingTerms }] } }));
  const item = next?.items.find(i => i.section === "collaboration");
  expect(item?.details).toContain("Recipient agreed date: 2026-10-23");
  expect(item?.details).toContain("Pending date proposal: 2026-10-24. Current agreement stays separate.");
  expect(next?.standingHash).not.toBe(parsed?.standingHash);
});

test("missing collaboration/config remains unavailable while malformed supplied protocols fail closed", () => {
  const older = parsePicture(wire(pictureFixture()));
  expect(older?.collaborationAvailable).toBe(false); expect(older?.frameworksAvailable).toBe(false);
  const request = collaborationFixture(), base = { ...pictureFixture(), collaboration: { requests: [request], counts: { needsYou: 1, waiting: 0, blocked: 0 }, nextCursor: null } };
  for (const update of [{ protocolVersion: "unknown" }, { companyId: "other-company" }, { status: "committed" }, { visibility: "private" }])
    expect(parsePicture(wire({ ...base, collaboration: { ...base.collaboration, requests: [{ ...request, ...update }] } }))).toBe(null);
  const config = frameworkConfigFixture();
  expect(parsePicture(wire({ ...base, frameworkConfig: { ...config, protocolVersion: "unknown" } }))).toBe(null);
  expect(parsePicture(wire({ ...base, frameworkConfig: { ...config, frameworks: [config.frameworks[0], config.frameworks[0]] } }))).toBe(null);
});

test("historical two- and seven-reference configurations keep their original categories", () => {
  const original = legacyFrameworkConfigFixture();
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: original }))?.items.filter(item => item.section === "frameworks").length).toBe(1);
  const extra = ["scrum", "safe", "shape_up", "rice", "eos"].map(id => ({ id, category: id === "rice" ? "prioritization" : id === "eos" ? "operating_rhythm" : "work_delivery_operations",
    title: id.toUpperCase(), protocolVersion: "framework-guidance-v1", purpose: "HIDDEN REFERENCE CONTENT", enabled: false }));
  const parsed = parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...original, frameworks: [...original.frameworks, ...extra] } }));
  expect(parsed?.items.filter(item => item.section === "frameworks").length).toBe(1);
  expect(parsed?.items.filter(item => item.section === "practices").length).toBe(0);
  expect(JSON.stringify(parsed)).not.toContain("HIDDEN REFERENCE CONTENT");
  expect(JSON.stringify(parsed?.items.filter(item => item.section === "frameworks"))).not.toContain("EOS");
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...original, frameworks: [...original.frameworks, { ...extra[0], category: "prioritization" }] } }))).toBe(null);
});

test("all thirteen references across six pillars supply metadata without guidance or adoption", () => {
  const config = frameworkConfigFixture();
  const parsed = parsePicture(wire({ ...pictureFixture(), frameworkConfig: config }));
  expect(parsed?.frameworksAvailable).toBe(true);
  expect(parsed?.items.filter(item => item.section === "frameworks").length).toBe(1);
  expect(parsed?.items.filter(item => item.section === "practices").length).toBe(0);
  for (const entry of config.frameworks) {
    if (entry.enabled) expect(parsed?.items.find(item => item.id === "frameworks:0")?.details.join(" ")).toContain(entry.title);
    expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config,
      frameworks: config.frameworks.map(item => item.id === entry.id ? { ...item, category: item.category === "finance" ? "sales" : "finance" } : item)
    } }))).toBe(null);
  }
  expect(JSON.stringify(parsed)).not.toContain("HIDDEN");
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, frameworks: [...config.frameworks, config.frameworks[0]] } }))).toBe(null);
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, frameworks: [{ ...config.frameworks[0], id: "constructor" }] } }))).toBe(null);
});

test("reading normalized legacy project conflicts preserves every saved enabled flag", () => {
  const config = frameworkConfigFixture();
  const frameworks = config.frameworks.map(entry => ({ ...entry, enabled: entry.category === "project_management" || entry.id === "okr" }));
  const parsed = parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, frameworks } }));
  expect(parsed?.frameworksAvailable).toBe(true);
  for (const title of ["Kanban", "Scrum", "SAFe"]) expect(parsed?.items.find(item => item.id === "frameworks:0")?.details.join(" ")).toContain(title);
  expect(parsed?.items.filter(item => item.section === "frameworks").length).toBe(1);
});

test("six maximum-length custom pillar instructions expose only their availability beside thirteen references", () => {
  const config = frameworkConfigFixture(), pillarInstructions = pillarInstructionsFixture();
  const parsed = parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, pillarInstructions } }));
  expect(parsed?.frameworksAvailable).toBe(true);
  expect(parsed?.items.filter(item => item.section === "frameworks").length).toBe(1);
  expect(parsed?.items.find(item => item.id === "frameworks:0")?.details).toContain("Custom instructions: Business management, Product management, Project management, Finance, Marketing, Sales");
  expect(parsed?.items.find(item => item.id === "frameworks:0")?.details).toContain("Configuration revision 0. Read readFrameworks with view guidance for the relevant pillars before planning work.");
  expect(JSON.stringify(parsed)).not.toContain("HIDDEN");
  expect(parsed?.items.filter(item => item.section === "practices").length).toBe(0);
  const legacy = legacyFrameworkConfigFixture();
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: legacy }))?.standingHash)
    .toBe(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...legacy, pillarInstructions: {} } }))?.standingHash);
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, pillarInstructions: { sales: "  Use our discovery questions.  " } } }))?.frameworksAvailable).toBe(true);
  expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, pillarInstructions: { sales: "First question.\nSecond question.\r\n\tKeep evidence." } } }))?.frameworksAvailable).toBe(true);
});

test("malformed custom pillar maps fail closed without retaining their text", () => {
  const config = frameworkConfigFixture();
  for (const pillarInstructions of [null, [], "hidden", { sales: "" }, { sales: "  \n " }, { sales: "x".repeat(2001) }, { sales: false },
    { sales: "Hidden\u202etext" }, { sales: "Hidden\u0000text" }, { sales: "\ufeffHidden" }, { sales: "Hidden\u2028text" },
    { other: "Hidden instructions" }, { operating_rhythm: "Hidden legacy category" }, { ...pillarInstructionsFixture(), other: "Seventh key" }]) {
    expect(parsePicture(wire({ ...pictureFixture(), frameworkConfig: { ...config, pillarInstructions } }))).toBe(null);
  }
});

test("compact collaboration summary names permitted people and flags explicit manager recovery", () => {
  const full = collaborationFixture();
  const { purpose, expectedResponse, criteria, objective, sourceReferences, ...terms } = full.terms;
  const summary = { ...full, terms, detailRequired: true };
  const parsed = parsePicture(wire({ ...pictureFixture(), collaboration: { requests: [summary], counts: { needsYou: 1, waiting: 0, blocked: 0 }, nextCursor: null,
    people: [{ personId: "person-a", label: "Sam", active: true }, { personId: "person-b", label: "Riley", active: true }], followUps: [{ collaborationId: full.collaborationId, reasons: ["manager_changed"] }] } }));
  const item = parsed?.items.find(item => item.section === "collaboration");
  expect(item?.details).toContain("Recipient: Sam"); expect(item?.details).toContain("Reviewer: Riley");
  expect(item?.details.some(line => line.includes("Reporting manager changed"))).toBe(true);
  expect(item?.details.some(line => line.includes("Read the current record"))).toBe(true);
  expect(summary.agreement).toBe(null); expect(summary.acknowledgment).toBe(null);
});


test("compact guidance availability is one bounded fact without disabled references or custom text", () => {
  const summary = frameworkSummaryFixture();
  const full = frameworkConfigFixture();
  const parsed = parsePicture(wire({ ...pictureFixture(), frameworkSummary: { ...summary, customPillars: ["finance", "sales"] } }))!;
  expect(parsed.frameworksAvailable).toBe(true);
  const facts = parsed.items.filter(item => item.section === "frameworks");
  expect(facts.length).toBe(1); expect(JSON.stringify(facts).length).toBeLessThan(800);
  expect(facts[0].details).toContain("Custom instructions: Finance, Sales");
  expect(JSON.stringify(facts)).not.toContain("HIDDEN");
  for (const disabled of full.frameworks.filter(entry => !entry.enabled)) expect(JSON.stringify(facts)).not.toContain(disabled.title);
  expect(parsePicture(wire({ ...pictureFixture(), frameworkSummary: { ...summary, enabledFrameworks: [], customPillars: ["sales"] } }))?.items.find(item => item.id === "frameworks:0")?.details).toContain("No preset references enabled");
  for (const update of [{ customPillars: ["sales", "sales"] }, { customPillars: ["unknown"] }, { protocolVersion: "unknown" }, { enabledFrameworks: [{ ...summary.enabledFrameworks[0], category: "finance" }] }])
    expect(parsePicture(wire({ ...pictureFixture(), frameworkSummary: { ...summary, ...update } }))).toBe(null);
  expect(parsePicture(wire({ ...pictureFixture(), frameworkSummary: summary, frameworkConfig: full }))).toBe(null);
  const changed = parsePicture(wire({ ...pictureFixture(), frameworkSummary: { ...summary, revision: 1 } }))!;
  expect(changed.standingHash).not.toBe(parsePicture(wire({ ...pictureFixture(), frameworkSummary: summary }))?.standingHash);
});
