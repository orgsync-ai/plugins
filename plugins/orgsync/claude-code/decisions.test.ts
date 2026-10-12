import { test, expect } from "claude-code/testing";
import { jsonWire, sourceFixture, wire } from "./fixtures.js";
import { world } from "./test-kit.js";

const complete = { answer: "ANSWER SENTINEL", durationMs: 1, isAborted: false, turnId: "turn-a", reason: "answer" } as const;
for (const format of ["structured", "text"] as const) test(`decision line projects ${format} OrgSync results and deduplicates sources`, async ($, on) => {
  const w = world(on);
  const source = { ...sourceFixture(), content: { summary: "CONTENT SENTINEL" } };
  on("tool.call", { tool: /^mcp__orgsync-owner__/ }, ($, e) => ({ result: (format === "structured" ? wire : jsonWire)(String(e.tool).endsWith("readSource") ? source : { status: "success", sources: [source], answer: "RETRIEVAL SENTINEL" }), ref: 57 }));
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.turn.start({ text: "PROMPT SENTINEL", turnId: "turn-a" });
  await Promise.all([$.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "source-a" }), $.tool.call({ tool: "mcp__orgsync-owner__readPermittedContext", tool_use_id: "retrieval-a" })]);
  await Promise.all([$.turn.complete(complete), $.turn.complete(complete)]);
  const notices = w.session.appended().filter(r => r.message.type === "system");
  expect(notices.length).toBe(1);
  expect(JSON.stringify(notices)).toContain("OrgSync context: Refund approvals: accepted decision, accepted by Sam.");
  expect(JSON.stringify(w.data)).not.toContain("SENTINEL");
});

test("another server's same suffix passes unread; errors, denials and subagents are excluded", async ($, on) => {
  const w = world(on); let mode: "success" | "error" | "deny" = "success";
  on("tool.call", { tool: /^mcp__/ }, ($, e) => {
    if (String(e.tool).includes("other")) return { result: { content: [{ type: "text", text: "UNRELATED SENTINEL" }], isError: false }, ref: 61 };
    if (mode === "deny") return { deny: "blocked" };
    if (mode === "error") return { isError: true, result: wire(sourceFixture()) };
    return { result: wire(sourceFixture()), ref: 62 };
  });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.turn.start({ text: "PROMPT SENTINEL", turnId: "turn-a" });
  const other = await $.tool.call({ tool: "mcp__other__readSource", tool_use_id: "other-a" }); expect(other.ref).toBe(61);
  await $.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "agent-a", turnId: "turn-a", agentId: "agent-a" });
  mode = "error"; await $.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "error-a" });
  mode = "deny"; await $.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "deny-a" });
  await $.turn.complete(complete);
  expect(w.session.appended().filter(r => r.message.type === "system").length).toBe(0);
  expect(JSON.stringify(w.data)).not.toContain("SENTINEL");
});

test("aborted and subagent completions add no decision notice", async ($, on) => {
  const w = world(on);
  on("tool.call", { tool: "mcp__orgsync-owner__readSource" }, () => ({ result: wire(sourceFixture()) }));
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.turn.start({ text: "PROMPT SENTINEL", turnId: "turn-a" });
  await $.tool.call({ tool: "mcp__orgsync-owner__readSource", tool_use_id: "source-a" });
  await $.turn.complete({ ...complete, agentId: "agent-a" });
  await $.turn.complete({ ...complete, reason: "aborted", isAborted: true });
  expect(w.session.appended().filter(r => r.message.type === "system").length).toBe(0);
});
