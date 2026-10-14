import { test, expect } from "claude-code/testing";
import { parseBrief, PROMPT_VERSION } from "./brief.js";
import { pictureFixture, wire } from "./fixtures.js";
import { parsePicture } from "./picture.js";
import { command, world } from "./test-kit.js";

const written = [
  { text: "A support-hours draft needs your review.", itemIds: ["draft:draft-a:1"] },
  { text: "Sam's accepted refund decision shapes your support work.", itemIds: ["source:source-a:2"] }
];
test("a model-written brief keeps its own words and listed references", () => {
  const p = parsePicture(wire(pictureFixture()))!;
  expect(parseBrief(JSON.stringify({ sentences: written }), p)).toEqual(written);
  for (const text of ["not json", JSON.stringify({ sentences: written, extra: true }), JSON.stringify({ sentences: [written[0]] })]) expect(parseBrief(text, p)).toEqual([]);
});
for (const [reason, invalid] of [
  ["unknown id", { text: "A note needs you.", itemIds: ["hidden"] }],
  ["one unknown id among known ids", { ...written[0], itemIds: ["draft:draft-a:1", "hidden"] }],
  ["URL", { ...written[0], text: "See https://example.org for the draft." }],
  ["bare URL", { ...written[0], text: "See example.org for the draft." }],
  ["markdown link", { ...written[0], text: "Read [the draft](draft)." }],
  ["invented number", { ...written[0], text: "There are 500 drafts to review." }],
  ["over-long sentence", { ...written[0], text: "a".repeat(281) }]
] as const) test(`the brief drops a sentence with ${reason}`, () => {
  const p = parsePicture(wire(pictureFixture()))!;
  expect(parseBrief(JSON.stringify({ sentences: [...written, invalid] }), p)).toEqual(written);
  expect(parseBrief(JSON.stringify({ sentences: [written[0], invalid] }), p)).toEqual([]);
});
test("brief numbers must occur in the referenced titles or details", () => {
  const p = parsePicture(wire(pictureFixture()))!;
  const withNumber = { text: "Your private draft is at revision 1.", itemIds: ["draft:draft-a:1"] };
  expect(parseBrief(JSON.stringify({ sentences: [withNumber, written[1]] }), p)).toEqual([withNumber, written[1]]);
  const unrelatedNumber = { text: "Your draft has revision 2026.", itemIds: ["person:person-a"] };
  expect(parseBrief(JSON.stringify({ sentences: [withNumber, unrelatedNumber] }), p)).toEqual([]);
  const combined = { text: "The draft at revision 1 and accepted refund decision both affect support.", itemIds: ["draft:draft-a:1", "source:source-a:2"] };
  expect(parseBrief(JSON.stringify({ sentences: [combined, written[1]] }), p)).toEqual([combined, written[1]]);
});

test("brief uses the selected main model, facts only, bounded request and cache", async ($, on) => {
  const w = world(on); let calls = 0;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", ($, e) => {
    calls++; expect(e.model).toBe("selected-main-model"); expect(e.maxTokens).toBe(384); expect(e.timeoutMs).toBe(15000); expect(e.effort).toBe("low");
    expect(JSON.stringify(e)).not.toContain("HIDDEN DESCRIPTION");
    expect(e.prompt).toContain("Support lead"); expect(e.prompt).toContain("Refund reviews"); expect(e.prompt).not.toContain("options");
    return { value: { isAnswered: true, text: JSON.stringify({ sentences: written }), usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
  });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.brief).toEqual(written); expect(w.data?.briefFacts).toMatch(new RegExp(`^${PROMPT_VERSION}:`));
  await w.clock.advance(30000); await $.command.run(command);
  expect(calls).toBe(1);
  w.body.decisionsThatShapeYourWork.page.items[0]!.title = "Updated refunds";
  await w.clock.advance(30000); await $.command.run(command);
  expect(calls).toBe(2);
});

test("a restored briefing lock blocks another call until its expiry, then allows a new brief", async ($, on) => {
  const w = world(on); let calls = 0, enabled = false;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => {
    if (!enabled) return { value: { isAnswered: false, reason: "empty-reply", usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
    calls++; expect(w.data?.briefing?.expires).toBe(w.clock.now() + 60000); expect(w.data?.briefing?.token).not.toBe("old-brief");
    return { value: { isAnswered: true, text: JSON.stringify({ sentences: written }), usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
  });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate(); enabled = true;
  w.restore = data => ({ ...data, briefs: [], briefFacts: null, briefing: { token: "old-brief", expires: w.clock.now() + 60000 } });
  await $.turn.start({ text: "", turnId: "restored" });
  await w.clock.advance(59999); await $.command.run(command); expect(calls).toBe(0); expect(w.data?.briefing?.token).toBe("old-brief");
  await w.clock.advance(1); await $.command.run(command);
  expect(calls).toBe(1); expect(w.data?.brief).toEqual(written); expect(w.data?.briefing).toBe(null);
});

for (const reason of ["api-error", "empty-reply", "aborted", "refusal"] as const) test(`brief falls back to facts on ${reason}`, async ($, on) => {
  const w = world(on); let calls = 0;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => {
    calls++;
    if (reason === "refusal") throw new Error("blocked");
    const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    return { value: reason === "api-error" ? { isAnswered: false, reason, status: 500, error: "server_error", usage } : { isAnswered: false, reason, usage } };
  });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  expect(w.data?.picture?.company.name).toBe("Acorn"); expect(w.data?.brief).toEqual([]);
  await $.command.run(command); expect(calls).toBe(1);
});

test("brief accepts explicit focus facts and rejects invented progress numbers", () => {
  const raw={...pictureFixture(),yourFocus:{count:1,truncated:false,items:[{objectiveId:"objective-a",revision:1,scope:"company",title:"Talk to five customers",
    horizon:"week",dueOn:"2026-10-21",owner:null}]}};
  const p=parsePicture(wire(raw))!,id="objective:objective-a:1";
  const good={text:"Your focus is to talk to five customers.",itemIds:[id]};
  expect(parseBrief(JSON.stringify({sentences:[good,written[1]]}),p)).toEqual([good,written[1]]);
  expect(parseBrief(JSON.stringify({sentences:[{text:"You already won 25 customers.",itemIds:[id]},written[1]]}),p)).toEqual([]);
});
