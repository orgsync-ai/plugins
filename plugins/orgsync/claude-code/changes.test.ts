import { test, expect } from "claude-code/testing";
import { changed } from "./fixtures.js";
import { command, world } from "./test-kit.js";

test("five-minute polling queues tied events once and sends no brief request", async ($, on) => {
  const w = world(on); let models = 0;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => { models++; return { deny: "blocked" }; });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const at = "2026-10-11T12:05:00.000Z"; w.body.asOf = at; w.body.window.until = at;
  w.body.changedForYou.items = [changed("event-a", at), changed("event-b", at)]; w.body.changedForYou.count = 2;
  await w.clock.advance(299999); expect(w.calls.length).toBe(1);
  await w.clock.advance(1); await w.readDone(); expect(w.calls.length).toBe(2); expect(w.data?.pending.length).toBe(2); expect(models).toBe(1);
  await $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  expect(w.data?.pending).toEqual([]); expect(w.calls.length).toBe(2);
  expect(w.session.appended().filter(r => r.message.type === "system").length).toBe(1);
  await w.clock.advance(300000); await w.readDone(); expect(w.data?.pending).toEqual([]);
});

test("dropped submission keeps changes for the next accepted prompt", async ($, on) => {
  let drop = true;
  on("prompt.submit", { origin: { kind: "composer" } }, ($, e, next) => drop ? { drop: "try again" } : next(e));
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  w.body.changedForYou.items = [changed()]; w.body.changedForYou.count = 1;
  await w.clock.advance(300000); await w.readDone();
  await $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  expect(w.data?.pending.length).toBe(1); expect(w.session.appended().filter(r => r.message.type === "system").length).toBe(0);
  drop = false;
  await $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  expect(w.data?.pending.length).toBe(0);
  expect(JSON.stringify(w.data)).not.toContain("PROMPT SENTINEL");
});

test("a restored delivering lock expires so the next accepted prompt receives pending changes", async ($, on) => {
  let w: ReturnType<typeof world>, notes = 0;
  on("prompt.submit", { origin: { kind: "composer" } }, ($, e, next) => {
    if (e.context?.length) { notes++; expect(w.data?.delivering?.expires).toBe(w.clock.now() + 60000); expect(w.data?.delivering?.token).not.toBe("old-delivery"); }
    return next(e);
  });
  w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  w.body.changedForYou.items = [changed()]; w.body.changedForYou.count = 1;
  await w.clock.advance(300000); await w.readDone(); await w.clock.settle();
  w.restore = data => ({ ...data, delivering: { token: "old-delivery", expires: w.clock.now() + 60000, ids: ["event-a"] } });
  await $.turn.start({ text: "", turnId: "restored" });
  await w.clock.advance(59999); await $.prompt.submit({ text: "", wait: false, origin: { kind: "composer" } });
  expect(notes).toBe(0); expect(w.data?.pending.length).toBe(1);
  await w.clock.advance(1); await $.prompt.submit({ text: "", wait: false, origin: { kind: "composer" } });
  expect(notes).toBe(1); expect(w.data?.pending.length).toBe(0); expect(w.data?.delivering).toBe(null);
  expect(w.session.appended().filter(row => row.message.type === "system").length).toBe(1);
});

test("events arriving during submission remain queued and parallel submissions do not duplicate a note", async ($, on) => {
  let release: () => void = () => {}, wait = true;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const notes: readonly string[][] = [];
  on("prompt.submit", { origin: { kind: "composer" } }, async ($, e, next) => {
    if (e.context) (notes as string[][]).push([...e.context]);
    if (wait && e.context) await pending;
    return next(e);
  });
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  w.body.changedForYou.items = [changed()]; w.body.changedForYou.count = 1;
  await w.clock.advance(300000); await $.command.run(command);
  const first = $.prompt.submit({ text: "PROMPT SENTINEL", wait: false, origin: { kind: "composer" } });
  await w.clock.settle();
  await $.prompt.submit({ text: "SECOND SENTINEL", wait: false, origin: { kind: "composer" } });
  w.body.changedForYou.items = [changed(), changed("event-b")]; w.body.changedForYou.count = 2;
  await w.clock.advance(300000); await $.command.run(command);
  wait = false; release(); await first;
  expect(w.data?.pending.map(c => c.eventId)).toEqual(["event-b"]);
  expect(notes.length).toBe(1);
});

test("an incomplete interval keeps its watermark and duplicate events stay queued once", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const baseline = w.data?.runtime?.pollSince;
  w.body.asOf = "2026-10-11T12:05:00.000Z"; w.body.window.until = w.body.asOf;
  w.body.changedForYou.items = [changed()]; w.body.changedForYou.count = 2; w.body.changedForYou.truncated = true;
  await w.clock.advance(300000); await $.command.run(command);
  expect(w.data?.runtime?.pollSince).toBe(baseline);
  await w.clock.advance(300000); await $.command.run(command);
  expect(w.data?.pending.map(c => c.eventId)).toEqual(["event-a"]);
  expect(w.calls[w.calls.length - 1]?.args).toEqual({ since: baseline });
});

test("temporary failures retry after 2, 4, 8 minutes; refusal stops until explicit retry", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  w.failure = "temporarily_unavailable";
  await w.clock.advance(300000); expect(w.calls.length).toBe(2);
  await w.clock.advance(119999); expect(w.calls.length).toBe(2);
  await w.clock.advance(1); expect(w.calls.length).toBe(3);
  await w.clock.advance(240000); expect(w.calls.length).toBe(4);
  await w.clock.advance(480000); expect(w.calls.length).toBe(5);
  w.failure = "connection_revoked";
  await w.clock.advance(480000); expect(w.data?.runtime?.stopped).toBe(true);
  const count = w.calls.length; await w.clock.advance(900000); expect(w.calls.length).toBe(count);
  w.failure = null; await $.command.run(command); expect(w.calls.length).toBe(count + 1);
});

test("all commands share the thirty-second floor and detached surfaces read nothing", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  await $.command.run(command); await w.clock.advance(29999); await $.command.run(command); expect(w.calls.length).toBe(1);
  await w.clock.advance(1); await $.command.run(command); expect(w.calls.length).toBe(2);
  w.surfaces = []; await w.clock.advance(300000); expect(w.calls.length).toBe(2);
});
