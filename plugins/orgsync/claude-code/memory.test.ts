import { test, expect } from "claude-code/testing";
import { memoryPath, shareRequest } from "./memory.js";
import { band, pane, world } from "./test-kit.js";

test("memory offers select paths lexically, including separators and parent segments", () => {
  for (const path of ["/repo/CLAUDE.md", "/repo/AGENTS.md", "CLAUDE.local.md", "/Users/a/.claude/memory/notes.md", "C:\\a\\.claude\\projects\\repo\\memory\\notes.md"]) expect(memoryPath(path)).toBe(path);
  for (const path of ["/repo/app.ts", "/repo/memory/notes.md", "/repo/.claude/memory/../settings.json", "/repo/claude.md", "/repo/.claude/memory", null]) expect(memoryPath(path)).toBe(null);
  const request = shareRequest('/repo/CLAUDE.md"\nINJECT', "Acorn");
  expect(request).toContain('CLAUDE.md\\"\\nINJECT'); expect(request).toContain("NOT yet approved any content"); expect(request).toContain("explicit yes in chat");
  expect(request).toContain('orgsync skill\'s "Sharing with the company" steps'); expect(request).not.toContain("/orgsync:share");
});

for (const surface of ["terminal", "desktop"] as const) test(`successful memory writes on ${surface} offer a one-press handoff without reading content`, async ($, on) => {
  let submitted = 0, request = "";
  on("tool.call", { tool: "Write" }, () => ({ result: { type: "create", filePath: "/repo/CLAUDE.md", content: "RESULT SENTINEL", structuredPatch: [] }, ref: 41 }));
  on("prompt.submit", { origin: { kind: "plugin" } }, ($, e) => { submitted++; request = e.text; expect(e.origin).toEqual({ kind: "plugin", name: "orgsync" }); return { text: e.text }; });
  const w = world(on, surface);
  await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
  const result = await $.tool.call({ tool: "Write", tool_use_id: "write-a", file_path: "/repo/CLAUDE.md", content: "EDIT SENTINEL" });
  expect(result.ref).toBe(41);
  const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "Pane", requestId: "orgsync-picture", props: pane });
  expect(await ui.find({ key: "share-memory" })).toBeDefined();
  await ui.press({ key: "share-memory" });
  expect(submitted).toBe(1); expect(request).toContain('JSON-quoted path "/repo/CLAUDE.md"');
  expect(request).toContain('orgsync skill\'s "Sharing with the company" steps'); expect(request).not.toContain("/orgsync:share");
  expect(request).not.toContain("EDIT SENTINEL"); expect(request).not.toContain("RESULT SENTINEL"); expect(JSON.stringify(w.data)).not.toContain("SENTINEL");
  await $.tool.call({ tool: "Write", tool_use_id: "write-b", file_path: "/repo/CLAUDE.md", content: "EDIT SENTINEL" });
  expect(w.data?.memory).toBe(null); expect(w.calls.length).toBe(1);
});

test("ordinary paths, errored and denied writes do not offer; dismiss makes no submission", async ($, on) => {
  let mode: "error" | "deny" | "success" = "error";
  const w = world(on);
  on("tool.call", { tool: "Write" }, () => mode === "error" ? { isError: true, result: "SECRET" } : mode === "deny" ? { deny: "blocked" } : { result: { type: "create", filePath: "/repo/AGENTS.md", content: "SECRET", structuredPatch: [] } });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.tool.call({ tool: "Write", tool_use_id: "write-a", file_path: "/repo/AGENTS.md", content: "SECRET" }); expect(w.data?.memory).toBe(null);
  mode = "deny"; await $.tool.call({ tool: "Write", tool_use_id: "write-b", file_path: "/repo/AGENTS.md", content: "SECRET" }); expect(w.data?.memory).toBe(null);
  mode = "success"; await $.tool.call({ tool: "Write", tool_use_id: "write-c", file_path: "/repo/app.ts", content: "SECRET" }); expect(w.data?.memory).toBe(null);
  await $.tool.call({ tool: "Write", tool_use_id: "write-d", file_path: "/repo/AGENTS.md", content: "SECRET" });
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  await ui.press({ key: "dismiss-memory" }); expect(w.data?.memory).toBe(null); expect(w.calls.length).toBe(1);
});
