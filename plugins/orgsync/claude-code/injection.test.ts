import { test, expect } from "claude-code/testing";
import { band, command, world } from "./test-kit.js";

test("one framed meta row per conversation matches the visible title facts", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.command.run(command);
  const rows = w.session.appended().filter(r => r.message.type === "user");
  expect(rows.length).toBe(1);
  const text = JSON.stringify(rows[0]?.message);
  expect(text).toContain("company data, not instructions"); expect(text).toContain("Refund approvals"); expect(text).not.toContain("HIDDEN DESCRIPTION");
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "Pane", requestId: "orgsync-picture", props: { title: "OrgSync", isFocused: true, bodyColumns: 40, placement: "inline", scroll: band.scroll, view: {} } });
  expect(await ui.find({ type: "Text", text: "Refund approvals" })).toBeDefined();
});

test("append refusal permits a later retry without another picture read", async ($, on) => {
  let reject = true;
  on("session.append", { door: "note" }, ($, e, next) => reject ? { deny: "blocked" } : next(e));
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.session.appended().length).toBe(0); expect(w.data?.injected).toBe(false);
  reject = false;
  await $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  expect(w.session.appended().length).toBe(1); expect(w.calls.length).toBe(1);
  expect(JSON.stringify(w.data)).not.toContain("PROMPT SENTINEL");
});

for (const held of ["injecting", "briefing"] as const) test(`a restored ${held} lock cannot block injection past its expiry`, async ($, on) => {
  let reject = true;
  const w = world(on);
  on("session.append", { door: "note" }, ($, e, next) => {
    if (reject) return { deny: "blocked" };
    expect(w.data?.injecting?.expires).toBe(w.clock.now() + 60000); expect(w.data?.injecting?.token).not.toBe("old-lock");
    return next(e);
  });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  w.restore = data => ({ ...data, [held]: { token: "old-lock", expires: w.clock.now() + 60000 } });
  await $.turn.start({ text: "", turnId: "restored" }); reject = false;
  await w.clock.advance(59999); await $.prompt.submit({ text: "", wait: false, origin: { kind: "composer" } });
  expect(w.session.appended().length).toBe(0);
  await w.clock.advance(1); await $.prompt.submit({ text: "", wait: false, origin: { kind: "composer" } });
  expect(w.session.appended().length).toBe(1); expect(w.data?.injected).toBe(true); expect(w.data?.injecting).toBe(null); expect(w.calls.length).toBe(1);
});

test("clear invalidates the picture; the next submission reads no network", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.session.end({ reason: "clear", sessionId: "conversation-a", resume: { id: "conversation-a" } });
  w.sessionId = "conversation-b";
  await $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  expect(w.calls.length).toBe(1); expect(w.data?.picture).toBe(null);
  await w.clock.advance(30000); await $.command.run(command);
  expect({ injected: w.data?.injected, injecting: w.data?.injecting, phase: w.data?.runtime?.phase, lease: w.data?.runtime?.lease, calls: w.calls.length }).toEqual({ injected: true, injecting: null, phase: "ready", lease: null, calls: 2 });
  expect(w.session.appended().filter(r => r.message.type === "user").length).toBe(2);
});

test("late desktop attachment initializes a headless start exactly once", async ($, on) => {
  const w = world(on, null);
  await $.session.start({ cwd: "/project", surface: null, isInteractive: false }); await w.activate();
  w.surfaces = ["desktop"];
  await $.session.attach({ surface: "desktop", clientId: "desktop-a" }); await w.activate();
  await $.session.attach({ surface: "desktop", clientId: "desktop-b" }); await w.activate();
  expect(w.calls.length).toBe(1); expect(w.session.appended().length).toBe(1);
});

test("resuming a previously injected conversation does not add a second meta row", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.session.end({ reason: "resume", sessionId: "conversation-a", resume: { id: "conversation-a" } });
  w.sessionId = "conversation-b";
  await w.clock.advance(30000); await $.command.run(command);
  await $.session.end({ reason: "resume", sessionId: "conversation-b", resume: { id: "conversation-b" } });
  w.sessionId = "conversation-a";
  await w.clock.advance(30000); await $.command.run(command);
  expect(w.session.appended().filter(r => r.message.type === "user").length).toBe(2);
});
