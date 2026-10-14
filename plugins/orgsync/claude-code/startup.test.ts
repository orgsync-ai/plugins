import { test, expect } from "claude-code/testing";
import { band, pane, world } from "./test-kit.js";
import { AS_OF, BEFORE, changed, wire } from "./fixtures.js";

for (const surface of ["terminal", "desktop"] as const) {
  test(`startup band on ${surface} acknowledges the displayed server watermark`, async ($, on) => {
    const w = world(on, surface);
    await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
    const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: band });
    expect(await ui.find({ key: "open-picture" })).toBeDefined();
    await ui.press({ key: "dismiss-picture" });
    expect(w.stored["look:v1:company-a:person-a"]).toEqual({ asOf: AS_OF, factsHash: expect.any(String), boundaryEventIds: [] });
    expect(w.data?.bandVisible).toBe(false);
    expect(w.opens).toBe(0);
    await ui.unmount();
  });
  test(`opening startup picture on ${surface} also acknowledges it`, async ($, on) => {
    const w = world(on, surface);
    await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
    const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: band });
    await ui.press({ key: "open-picture" });
    expect(w.opens).toBe(1);
    expect(w.stored["look:v1:company-a:person-a"]).toBeDefined();
    await ui.unmount();
  });
  test(`startup band on ${surface} stays within six text lines and uses the pane's numbering`, async ($, on) => {
    const w = world(on, surface), page = w.body.decisionsThatShapeYourWork.page;
    page.items = Array.from({ length: 5 }, (_, i) => ({ ...page.items[0]!, sourceId: `decision-${i}`, title: `Decision ${i}` })); page.count = page.items.length;
    const sentences = page.items.slice(-3).map(d => ({ text: `${d.title} shapes your work. ${"The decision is listed in your picture. ".repeat(5)}`.trim(), itemIds: [`source:${d.sourceId}:${d.currentRevision}`] }));
    on("session.model", () => ({ value: "selected-main-model" }));
    on("model.complete", () => ({ value: { isAnswered: true, text: JSON.stringify({ sentences }), usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }));
    await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
    const startup = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: { ...band, bodyColumns: 80 } });
    const lines = await startup.findAll({ type: "Text" });
    expect(lines.length).toBeLessThanOrEqual(6);
    for (const line of lines) expect(line.props.wrap === "truncate-end" || line.props.wrap === "truncate-middle").toBe(true);
    expect(await startup.find({ type: "Text", text: /^1\. Support hours$/ })).toBeDefined();
    for (let i = 2; i < 5; i++) {
      const sentence = await startup.find({ type: "Text", text: new RegExp(`Decision ${i} shapes your work`) });
      expect(sentence?.text).toContain(`[${i + 3}]`); expect(sentence?.props.wrap).toBe("truncate-middle");
    }
    expect(await startup.find({ type: "Text", text: /^\d+\. Decision/ })).toBe(undefined);
    expect(JSON.stringify(await startup.drawn())).not.toContain("source:decision-");
    expect(JSON.stringify(await startup.drawn())).not.toContain("more in Open picture");
    const full = await $.ui.mount({ plugin: "orgsync", surface, component: "Pane", requestId: "orgsync-picture", props: pane });
    expect(await full.find({ type: "Text", text: /^5\. Decision 2:/ })).toBeDefined();
    expect((await full.find({ type: "Text", text: /Decision 3 shapes your work/ }))?.text).toContain("[6]");
    expect((await full.find({ type: "Text", text: /Decision 4 shapes your work/ }))?.text).toContain("[7]");
    await startup.unmount(); await full.unmount();
  });
  test(`startup band on ${surface} has one count line without a brief and keeps full details in the pane`, async ($, on) => {
    const w = world(on, surface);
    w.body.needsYou.approver.awaitingProposals = { count: 0, items: [], truncated: false };
    w.body.changedForYou = { count: 11, items: [changed()], truncated: true };
    w.body.decisionsThatShapeYourWork.page.count = 3; w.body.decisionsThatShapeYourWork.page.truncated = true;
    w.body.needsYou.pendingDrafts.items[0]!.title = "Support hours ".repeat(20).trim();
    w.body.company.name = "Acorn ".repeat(20).trim(); w.body.limitations = ["lookback_clamped", "deletion_titles_withheld"];
    await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
    const startup = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: { ...band, bodyColumns: 80 } });
    const lines = await startup.findAll({ type: "Text" });
    expect(lines).toHaveLength(3); expect(lines.length).toBeLessThanOrEqual(6);
    for (const line of lines) expect(line.props.wrap).toBe("truncate-end");
    expect(await startup.find({ type: "Text", text: "1 needs you · 11 changed · 3 decisions" })).toBeDefined();
    const drawn = JSON.stringify(await startup.drawn());
    for (const text of ["Needs you", "Changed for you", "Published", "Expires", "Some earlier changes", "Changes cover only", "more in Open picture", "Pending drafts"]) expect(drawn).not.toContain(text);
    expect(await startup.findAll({ type: "Button" })).toHaveLength(2);
    const full = await $.ui.mount({ plugin: "orgsync", surface, component: "Pane", requestId: "orgsync-picture", props: pane });
    expect(await full.find({ type: "Text", text: "Changes cover only the past 30 days." })).toBeDefined();
    expect(await full.find({ type: "Text", text: "Some earlier changes are not shown." })).toBeDefined();
    expect(await full.find({ type: "Text", text: /Expires/ })).toBeDefined();
    await startup.unmount(); await full.unmount();
  });
  test(`the compact band on ${surface} keeps memory offers and pending changes after dismissal`, async ($, on) => {
    const w = world(on, surface);
    w.restore = data => ({ ...data, memory: { path: "/project/CLAUDE.md", toolUseId: "write-a" }, pending: [{ eventId: "event-new", at: AS_OF, line: "Refund approvals changed." }] });
    await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
    const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: band });
    expect(await ui.find({ key: "share-memory" })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /OrgSync changes waiting for your next prompt: Refund approvals changed/ })).toBeDefined();
    await ui.press({ key: "dismiss-picture" });
    expect(await ui.find({ key: "open-picture" })).toBe(undefined); expect(await ui.find({ key: "share-memory" })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /OrgSync changes waiting for your next prompt/ })).toBeDefined();
    expect(w.data?.pending).toHaveLength(1); expect(w.data?.memory?.path).toBe("/project/CLAUDE.md");
    await ui.unmount();
  });
}

test("survey wins without acknowledging; dismiss still acknowledges a truncated interval", async ($, on) => {
  const w = world(on); w.body.changedForYou = { count: 2, items: [changed()], truncated: true };
  on("ui.render", { component: "AbovePrompt" }, () => ({ type: "Text", props: {}, children: ["survey"] }));
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const survey = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: { ...band, hasSurvey: true } });
  expect(await survey.find({ key: "dismiss-picture" })).toBe(undefined);
  expect(w.stored["look:v1:company-a:person-a"]).toBe(undefined);
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  await ui.press({ key: "dismiss-picture" });
  expect(w.stored["look:v1:company-a:person-a"]).toEqual({ asOf: AS_OF, factsHash: expect.any(String), boundaryEventIds: ["event-a"] });
});

for (const surface of ["terminal", "desktop"] as const) for (const interval of ["clamped", "truncated"] as const) for (const action of ["open-picture", "dismiss-picture"] as const) test(`${action} on ${surface} acknowledges a ${interval} interval and keeps it quiet next time`, async ($, on) => {
  let w: ReturnType<typeof world>;
  on("mcp.call", { tool: "readPicture" }, ($, e) => ({ value: wire({ ...w.body, window: { ...w.body.window, since: e.args?.since ?? BEFORE, sinceClamped: !e.args?.since && interval === "clamped" } }) }));
  w = world(on, surface); w.body.changedForYou = { count: interval === "truncated" ? 2 : 1, items: [changed()], truncated: interval === "truncated" };
  await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
  expect(w.data?.picture?.changesComplete).toBe(false);
  const ui = await $.ui.mount({ plugin: "orgsync", surface, component: "AbovePrompt", props: band });
  await ui.press({ key: action });
  expect(w.stored["look:v1:company-a:person-a"]).toEqual({ asOf: AS_OF, factsHash: expect.any(String), boundaryEventIds: ["event-a"] });
  w.sessionId = "conversation-b"; await w.clock.advance(30000);
  await $.session.start({ cwd: "/project", surface, isInteractive: true }); await w.activate();
  expect(w.data?.bandVisible).toBe(false);
  await ui.unmount();
});

test("polling a later picture never acknowledges it for the person", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  await ui.press({ key: "dismiss-picture" });
  const at = "2026-10-11T12:05:00.000Z"; w.body.asOf = at; w.body.window.until = at; w.body.changedForYou = { count: 1, items: [changed("event-a", at)], truncated: false };
  await w.clock.advance(300000); await w.readDone();
  expect(w.data?.picture?.asOf).toBe(at); expect(w.stored["look:v1:company-a:person-a"]).toEqual({ asOf: AS_OF, factsHash: expect.any(String), boundaryEventIds: [] });
  await ui.unmount();
});

test("startup stays silent for known timestamp ties but shows a new event at that same boundary", async ($, on) => {
  const w = world(on); w.body.changedForYou.items = [changed()]; w.body.changedForYou.count = 1;
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const ui = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  await ui.press({ key: "dismiss-picture" });
  w.sessionId = "conversation-b"; await w.clock.advance(30000);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.bandVisible).toBe(false);
  w.sessionId = "conversation-c"; w.body.changedForYou.items.push(changed("event-b")); w.body.changedForYou.count = 2;
  await w.clock.advance(30000); await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.bandVisible).toBe(true);
});

test("unchanged facts are silent; acknowledgements never cross people or companies", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const first = await $.ui.mount({ plugin: "orgsync", surface: "terminal", component: "AbovePrompt", props: band });
  await first.press({ key: "dismiss-picture" });
  await w.clock.advance(30000);
  w.sessionId = "conversation-b";
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.bandVisible).toBe(false);
  await w.clock.advance(30000);
  w.sessionId = "conversation-c"; w.body.yourRole.person.personId = "person-b"; w.body.company.companyId = "company-b";
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.picture).toBe(null);
  await w.clock.advance(30000);
  await $.command.run({ command: "orgsync:today", args: "", origin: { kind: "composer" }, presentation: { columns: 80, isFullscreen: false } });
  expect(w.calls[w.calls.length - 1]?.args).toEqual({});
  expect(w.stored["look:v1:company-b:person-b"]).toBeDefined();
});

test("focus renders in the picture and never increases Needs you", async ($,on) => {
  const w=world(on);w.body={...w.body,yourFocus:{count:1,truncated:false,items:[{objectiveId:"goal-a",revision:1,scope:"company",title:"First customers",
    horizon:"week",dueOn:"2026-10-21",owner:null}]}} as typeof w.body;
  await $.session.start({cwd:"/project",surface:"terminal",isInteractive:true});await w.activate();
  const startup=await $.ui.mount({plugin:"orgsync",surface:"terminal",component:"AbovePrompt",props:band});
  expect(await startup.find({type:"Text",text:/^2 need you/})).toBeDefined();
  const full=await $.ui.mount({plugin:"orgsync",surface:"terminal",component:"Pane",requestId:"orgsync-picture",props:pane});
  expect(await full.find({type:"Text",text:"Your focus"})).toBeDefined();expect(await full.find({type:"Text",text:/First customers/})).toBeDefined();
  await startup.unmount();await full.unmount();
});
