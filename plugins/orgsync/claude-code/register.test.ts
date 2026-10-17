import { test, expect } from "claude-code/testing";
import { band, command, pane, world } from "./test-kit.js";
import { AS_OF, pictureFixture, practiceFixture, supportContextFixture, wire } from "./fixtures.js";
import { shortDate } from "./picture.js";

for (const surface of ["terminal", "desktop"] as const) test(`limitation codes never appear on ${surface}`, async ($, on) => {
  const w = world(on, surface), codes = ["drafts_require_submit_scope", "work_profile_missing", "role_relevance_not_ranked", "lookback_clamped",
    "deletion_titles_withheld", "deletion_actor_unavailable", "timestamp_feed_not_lossless", "future_code"];
  w.body.limitations = codes;
  await $.session.start({ cwd: "/project", surface, isInteractive: surface === "terminal" }); await w.activate();
  for (const component of ["AbovePrompt", "Pane"] as const) {
    const ui = await $.ui.mount({ plugin: "orgsync", surface, component, ...(component === "Pane" ? { requestId: "orgsync-picture", props: pane } : { props: band }) });
    const text = JSON.stringify(await ui.drawn());
    if (component === "Pane") { expect(text).toContain("Your work profile has not been set."); expect(text).toContain("Changes cover only the past 30 days."); }
    else { expect(text).not.toContain("Your work profile has not been set."); expect(text).not.toContain("Changes cover only the past 30 days."); }
    for (const code of codes) expect(text).not.toContain(code);
    await ui.unmount();
  }
});

for (const event of ["start", "attach"] as const) test(`session.${event} and the first prompt resolve while background reads and the brief are pending`, async ($, on) => {
  let releaseRead: () => void = () => {}, releaseModel: () => void = () => {}, reads = 0, models = 0;
  const reading = new Promise<void>(resolve => { releaseRead = resolve; }), writing = new Promise<void>(resolve => { releaseModel = resolve; });
  on("mcp.call", { tool: "readPicture" }, async () => { reads++; await reading; return { value: wire(pictureFixture()) }; });
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", async () => { models++; await writing; return { value: { isAnswered: false, reason: "empty-reply", usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }; });
  const w = world(on, event === "start" ? "terminal" : null);
  await $.session.start({ cwd: "/project", surface: event === "start" ? "terminal" : null, isInteractive: event === "start" });
  if (event === "attach") { await w.clock.settle(); w.surfaces = ["desktop"]; await $.session.attach({ surface: "desktop", clientId: "desktop-a" }); }
  expect(reads).toBe(0); expect(models).toBe(0);
  await w.clock.settle(); expect(reads).toBe(1); expect(models).toBe(0);
  expect((await $.prompt.submit({ text: "first prompt", wait: false, origin: { kind: "composer" } })).drop).not.toBe(true);
  expect(w.data?.picture).toBe(null);
  releaseRead(); await w.readDone(); await w.clock.settle(); expect(models).toBe(1);
  expect((await $.prompt.submit({ text: "prompt during brief", wait: false, origin: { kind: "composer" } })).drop).not.toBe(true);
  expect(w.data?.briefing).not.toBe(null);
  releaseModel(); await w.clock.settle(); expect(w.data?.injected).toBe(true);
});

test("orgsync:today opens the picture without a model turn", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(await $.command.run(command)).toEqual({ text: "OrgSync picture opened." });
  expect(w.calls).toEqual([{ server: "orgsync-owner", tool: "readPicture", args: {} }]);
  expect(w.registrations).toBe(0); expect(w.skillRuns).toBe(0);
});

for (const surface of ["terminal", "desktop"] as const) test(`facts-only picture on ${surface} fits a narrow direct command`, async ($, on) => {
  const w = world(on, surface);
  await $.session.start({ cwd: "/project", surface, isInteractive: surface === "terminal" }); await w.activate();
  await $.command.run(command);
  const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "Pane", requestId: "orgsync-picture", props: pane });
  expect((await ui.find({ type: "Text", text: /Refund approvals.*Accepted by Sam/ }))?.text).toContain("Accepted by Sam");
  expect(await ui.find({ type: "Text", text: "HIDDEN DESCRIPTION" })).toBe(undefined);
  expect(w.opens).toBe(1);
  await ui.unmount();
});

for (const surface of ["terminal", "desktop"] as const) test(`the picture on ${surface} shows numbered references and readable dates while retaining ISO facts`, async ($, on) => {
  const w = world(on, surface);
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => ({ value: { isAnswered: true, text: JSON.stringify({ sentences: [
    { text: "The support draft and accepted refund decision need your attention.", itemIds: ["draft:draft-a:1", "source:source-a:2"] },
    { text: "Sam's refund decision shapes your support work.", itemIds: ["source:source-a:2"] }
  ] }), usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }));
  await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
  const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "Pane", requestId: "orgsync-picture", props: pane });
  expect((await ui.find({ type: "Text", text: /need your attention/ }))?.text).toContain("[1, 3]");
  expect((await ui.find({ type: "Text", text: /shapes your support work/ }))?.text).toContain("[3]");
  expect(await ui.find({ type: "Text", text: /^1\. Support hours:/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^2\. Refund approvals:/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^3\. Refund approvals: accepted decision; Accepted by Sam/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^4\. Sam:/ })).toBeDefined();
  const drawn = JSON.stringify(await ui.drawn());
  expect(drawn).toContain(shortDate(AS_OF)); expect(drawn).toContain("Oct 11"); expect(drawn).not.toContain("2026-10-11T"); expect(drawn).not.toContain("accepted_decision");
  for (const item of w.data!.picture!.items) expect(drawn).not.toContain(item.id);
  expect(w.data?.picture?.asOf).toBe(AS_OF); expect(w.data?.picture?.items[0]?.details.join(" ")).toContain("2026-10-11T");
  expect(JSON.stringify(w.session.appended().filter(row => row.message.type === "user"))).toContain(AS_OF);
  await ui.unmount();
});

test("session.start never registers a command owned by a skill", async ($, on) => {
  const w = world(on);
  on("command.register", { name: "orgsync" }, () => { w.registrations++; throw new Error("skill owns /orgsync"); });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.registrations).toBe(0); expect(w.calls).toHaveLength(1); expect(w.data?.injected).toBe(true);
});

for (const reason of ["arguments", "no surface", "no picture", "read throws", "pane throws"] as const) test(`orgsync:today falls through to its skill with ${reason}`, async ($, on) => {
  if (reason === "read throws") on("mcp.call", { tool: "readPicture" }, () => ({ deny: "read failed" }));
  if (reason === "pane throws") on("ui.open", { id: "orgsync-picture" }, () => ({ deny: "pane failed" }));
  const w = world(on, reason === "no surface" ? null : "terminal");
  if (reason === "no picture") w.failure = "connection_revoked";
  const result = await $.command.run({ ...command, args: reason === "arguments" ? "  focus on support  " : "" });
  expect(result).toEqual({ text: "Today skill writes the picture as text." }); expect(w.skillRuns).toBe(1);
  expect(w.opens).toBe(0);
  if (reason === "arguments" || reason === "no surface") { expect(w.calls).toHaveLength(0); expect(w.data?.picture ?? null).toBe(null); }
});

test("concurrent commands reuse one in-flight read and do not begin a main turn", async ($, on) => {
  let reads = 0, turns = 0, release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  on("mcp.call", { tool: "readPicture" }, async () => { reads++; await pending; return { value: wire(pictureFixture()) }; });
  on("turn.start", { turnId: /./ }, () => { turns++; return { turnId: "unexpected" }; });
  const w = world(on);
  const first = $.command.run(command), second = $.command.run(command);
  await w.clock.settle(); expect(reads).toBe(1);
  release(); await Promise.all([first, second]);
  expect(reads).toBe(1); expect(turns).toBe(0);
});

test("a late read after clear cannot restore the old conversation's facts", async ($, on) => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  on("mcp.call", { tool: "readPicture" }, async () => { await pending; return { value: wire(pictureFixture()) }; });
  const w = world(on);
  const startup = $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true });
  await w.clock.settle();
  await $.session.end({ reason: "clear", sessionId: "conversation-a", resume: { id: "conversation-a" } });
  w.sessionId = "conversation-b";
  release(); await startup;
  expect(w.data?.picture).toBe(null); expect(w.session.appended().length).toBe(0);
});

test("server-selected and clamped windows remain available and opening acknowledges the displayed snapshot", async ($, on) => {
  let clamped = false;
  on("mcp.call", { tool: "readPicture" }, () => {
    const p = pictureFixture(); p.window.since = clamped ? "2026-10-11T12:30:00.000Z" : "2026-10-11T11:00:00.000Z";
    if (clamped) { p.asOf = "2026-10-11T13:00:00.000Z"; p.window.until = p.asOf; }
    p.window.sinceClamped = clamped;
    return { value: wire(p) };
  });
  const w = world(on);
  const first = await $.command.run(command); expect(first.text).toBe("OrgSync picture opened.");
  clamped = true;
  await w.clock.advance(30000);
  const second = await $.command.run(command);
  expect(second.text).toBe("OrgSync picture opened.");
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "Pane", requestId: "orgsync-picture", props: pane });
  expect(await ui.find({ type: "Text", text: "Some earlier changes are not shown." })).toBeDefined();
  await ui.unmount();
  expect(w.data?.picture?.since).toBe("2026-10-11T12:30:00.000Z");
  expect(w.stored["look:v1:company-a:person-a"]).toEqual({ asOf: "2026-10-11T13:00:00.000Z", factsHash: expect.any(String), boundaryEventIds: [] });
});


for (const state of ["unavailable", "empty", "truncated"] as const) test(`How we work shows ${state} without increasing Needs you or making another read`, async ($, on) => {
  const w = world(on);
  if (state !== "unavailable") Object.assign(w.body, { howWeWork: { count: state === "empty" ? 0 : 3, truncated: state === "truncated", items: state === "empty" ? [] : [practiceFixture()] } });
  Object.assign(w.body, { yourFocus: { count: 1, truncated: false, items: [{ objectiveId: "person-goal", revision: 1, scope: "person", title: "Talk with customers",
    horizon: "week", dueOn: "2026-10-21", owner: { personId: "person-a", label: "Sam", active: true }, supportsContext: { ...supportContextFixture(), status: "completed" } }] } });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "Pane", requestId: "orgsync-picture", props: pane });
  const text = JSON.stringify(await ui.drawn());
  expect(text).toContain(state === "unavailable" ? "How we work is unavailable on this server." : state === "empty" ? "No adopted ways of working yet." : "More ways of working are available through the free list.");
  expect(text).toContain("Supports company goal: Win five customers"); expect(text).toContain("Company goal closed.");
  if (state === "truncated") { expect((await ui.find({ type: "Text", text: /^How we work: 3/ }))?.text).toContain("(list truncated)"); expect(text).toContain("Compare directions before resolving any conflict."); }
  const bandUi = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  expect(JSON.stringify(await bandUi.drawn())).toContain("2 need you");
  expect(w.calls).toEqual([{ server: "orgsync-owner", tool: "readPicture", args: {} }]);
  const framed = JSON.stringify(w.session.appended());
  expect(framed).toContain("Goal links grant no authority"); expect(framed).toContain("howWeWorkAvailable");
  await bandUi.unmount(); await ui.unmount();
});
