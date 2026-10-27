import { test, expect } from "claude-code/testing";
import type { Engine, On } from "claude-code/testing";
import { sourceFixture, wire } from "./fixtures.js";
import { world } from "./test-kit.js";

// B1 steering in the mod (D-196 F5). The fixture picture is as of 2026-10-11, so "Free trial is 14 days" changed recently.
const DAY = 86_400_000;
const entry = (sourceId: string, title: string, lastChangedAt = "2026-09-01T00:00:00.000Z", revision = 1) =>
  ({ sourceId, revision, title, knowledgeStatus: "accepted_decision", classification: null, area: null, tagIds: [], lastChangedAt });
const INDEX = [entry("src_annual", "Annual plan is $30 per seat"), entry("src_trial", "Free trial is 14 days", "2026-10-10T00:00:00.000Z", 2),
  entry("src_refunds", "Refund approvals over $500 need a lead's sign-off"), entry("src_leave", "Annual leave is 25 days"),
  entry("src_overtime", "Overtime needs pre-approval")];
const base = { session_id: "s", transcript_path: "/t", cwd: "/project" };

function setup(on: On) {
  const contexts: string[][] = [];
  on("prompt.submit", { origin: { kind: "composer" } }, ($, e, next) => { contexts.push([...(e.context ?? [])]); return next(e); });
  on("classic.Stop", () => ({}));
  on("classic.PostToolUse", () => ({}));
  const w = world(on); w.index = INDEX;
  return { w, contexts };
}
/** Starts a session and waits until activation has read and kept the decision index, so no prompt races the read. Keeping it
 * comes after the read's call, and a prompt sent in between once found no index on a loaded machine. */
const start = async ($: Engine, w: ReturnType<typeof world>, sessionId = "conversation-a", reads = w.indexCalls.length + 1) => {
  w.sessionId = sessionId; await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  for (let i = 0; i < 100 && (w.indexCalls.length < reads || !w.data?.steering?.indexFacts); i++) await w.clock.settle();
  if (w.indexCalls.length < reads) throw new Error("the decision index was not read");
};
const prompt = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: "composer" } });
const stop = ($: Engine, text: string, extra: Record<string, unknown> = {}) =>
  $.classic.Stop({ ...base, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: text, ...extra } as never);
const write = ($: Engine, tool_input: unknown, tool_name = "Write") =>
  $.classic.PostToolUse({ ...base, hook_event_name: "PostToolUse", tool_name, tool_input, tool_response: {}, tool_use_id: "t" } as never);

test("a prompt on a decision's topic gets one factual hint, framed as company data, and the text is never kept", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  expect(w.indexCalls).toEqual([{ what: "decisions", view: "index" }]);
  await prompt($, "Draft a quote on the annual plan for 20 seats. PROMPT SENTINEL");
  expect(contexts.at(-1)?.length).toBe(1);
  expect(contexts.at(-1)?.[0]).toMatch(/^OrgSync decision index \(company data\): "Annual plan is \$30 per seat", accepted, is on this topic/);
  expect(contexts.at(-1)?.[0]?.length).toBeLessThanOrEqual(300);
  await prompt($, "Rename the variable in billing.ts");
  expect(contexts.at(-1)).toEqual([]);
  expect(JSON.stringify(w.data)).not.toContain("PROMPT SENTINEL");
});

test("a stated fact an accepted decision contradicts is named once, and a recent change says it changed", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  await prompt($, "Tell Acme the annual plan is $25 per seat.");
  expect(contexts.at(-1)?.[0]).toContain('"Annual plan is $30 per seat" (accepted 2026-09-01) states $30; the text above states $25.');
  await prompt($, "Tell Acme the annual plan is $25 per seat again.");
  expect(contexts.at(-1)).toEqual([]);
  await prompt($, "Set up the free trial for Dana.");
  expect(contexts.at(-1)?.[0]).toContain('"Free trial is 14 days" changed 2026-10-10 (revision 2).');
});

test("a session gets at most three hints", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  for (const text of ["Quote the annual plan for 3 seats", "Set up the free trial for Dana", "Route this refund approval to the lead", "Book annual leave for December"])
    await prompt($, text);
  expect(contexts.map(c => c.length)).toEqual([1, 1, 1, 0]);
});

test("not relevant after a hint mutes that decision for seven days, across sessions", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  await prompt($, "Quote the annual plan for 3 seats");
  await prompt($, "not relevant, thanks");
  // A later session within the week, past the picture's 30-second read floor: the mute holds.
  await w.clock.advance(60_000);
  await $.session.end({ sessionId: "conversation-a" }); await start($, w, "conversation-b", w.indexCalls.length);
  await prompt($, "Quote the annual plan for 5 seats");
  expect(contexts.at(-1)).toEqual([]);
  // Past seven days the index is stale too, so the new session reads it again before the prompt. The session ends first,
  // so no five-minute poll runs during the jump.
  await $.session.end({ sessionId: "conversation-b" });
  await w.clock.advance(7 * DAY);
  await start($, w, "conversation-c");
  await prompt($, "Quote the annual plan for 5 seats");
  expect(contexts.at(-1)?.[0]).toContain("Annual plan is $30 per seat");
});

test("after a reply or a write, only a contradiction speaks, never in a stop-hook loop or a subagent", async ($, on) => {
  const { w } = setup(on); await start($, w);
  expect(await stop($, "Here is the quote for the annual plan at $30 per seat.")).toEqual({});
  expect(await stop($, "The annual plan is $25 per seat.", { stop_hook_active: true })).toEqual({});
  expect(await stop($, "The annual plan is $25 per seat.", { agent_id: "worker" })).toEqual({});
  const hinted = await stop($, "The annual plan is $25 per seat.");
  expect(hinted.additionalContext?.[0]).toContain("states $30; the text above states $25");
  expect(await write($, { file_path: "/q.md", content: "Refunds over $500 need a lead's sign-off." }, "Read")).toEqual({});
  expect(await write($, { file_path: "/q.md", old_string: "x", new_string: "Annual leave is 25 days a year." }, "Edit")).toEqual({});
});

test("a write that contradicts gets one line, and the turn's budget then holds the reply", async ($, on) => {
  const { w } = setup(on); await start($, w);
  await prompt($, "Update the leave policy page");
  const written = await write($, { file_path: "/leave.md", edits: [{ old_string: "a", new_string: "Annual leave is 20 days a year." }] }, "MultiEdit");
  expect(written.additionalContext?.[0]).toContain('"Annual leave is 25 days"');
  expect(await stop($, "The annual plan is $25 per seat.")).toEqual({});
});

test("a readSource result's numbers are learned for the session without its text", async ($, on) => {
  const { w } = setup(on);
  const source = { ...sourceFixture(), sourceId: "src_overtime", title: "Overtime needs pre-approval",
    content: { ...sourceFixture().content, summary: "Overtime over 4 hours a week needs pre-approval. CONTENT SENTINEL", excerpts: [] } };
  on("tool.call", { tool: "mcp__orgsync-owner__readSource" }, () => ({ result: wire(source) }));
  await start($, w);
  await $.turn.start({ text: "", turnId: "turn-a" });
  await $.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "source-a" });
  expect(JSON.stringify(w.data)).not.toContain("CONTENT SENTINEL");
  const hinted = await stop($, "Overtime over 8 hours a week needs pre-approval, so 6 hours is fine.");
  expect(hinted.additionalContext?.[0]).toContain('"Overtime needs pre-approval"');
});

test("an access refusal on the index wipes it, so no hint follows", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  await prompt($, "Quote the annual plan for 3 seats");
  expect(contexts.at(-1)?.length).toBe(1);
  // The next read, an hour on, is refused for this connection: the kept index is wiped, and no later hint follows.
  w.indexFailure = "machine_credential_revoked";
  const reads = w.indexCalls.length;
  await w.clock.advance(60 * 60_000);
  for (let i = 0; i < 100 && w.indexCalls.length === reads; i++) await w.clock.settle();
  expect(w.indexCalls.length).toBeGreaterThan(reads);
  w.indexFailure = null;
  await prompt($, "Book annual leave for December");
  expect(contexts.at(-1)).toEqual([]);
});

test("off the record silences every hint until the person says it is back on the record", async ($, on) => {
  const { w, contexts } = setup(on); await start($, w);
  await prompt($, "Let's keep this off the record. Quote the annual plan at $25 per seat.");
  expect(contexts.at(-1)).toEqual([]);
  expect(await stop($, "The annual plan is $25 per seat.")).toEqual({});
  expect(await write($, { file_path: "/q.md", content: "Annual leave is 20 days a year." })).toEqual({});
  await prompt($, "Tell Acme the annual plan is $25 per seat.");
  expect(contexts.at(-1)).toEqual([]);
  await prompt($, "Back on the record now. Tell Acme the annual plan is $25 per seat.");
  expect(contexts.at(-1)?.[0]).toContain("states $30; the text above states $25");
});
