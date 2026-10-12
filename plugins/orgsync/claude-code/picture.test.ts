import { test, expect } from "claude-code/testing";
import { AS_OF, changed, jsonWire, PERSON, pictureFixture, SOURCE, sourceFixture, wire } from "./fixtures.js";
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
