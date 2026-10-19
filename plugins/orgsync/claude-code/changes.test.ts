import { test, expect } from "claude-code/testing";
import { AS_OF, BEFORE, changed, collaborationFixture, frameworkConfigFixture, wire } from "./fixtures.js";
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


test("canonical collaboration revisions deduplicate in free polling and session end cancels delivery", async ($, on) => {
  const w = world(on); let models = 0;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => { models++; return { deny: "blocked" }; });
  Object.assign(w.body, { collaboration: { requests: [collaborationFixture()], counts: { needsYou: 1, waiting: 0, blocked: 0 }, nextCursor: null }, frameworkConfig: frameworkConfigFixture() });
  await $.session.start({ cwd: "/project", surface: "terminal", isInteractive: true }); await w.activate();
  const at = "2026-10-11T12:05:00.000Z"; w.body.asOf = at; w.body.window.until = at;
  const request = { ...collaborationFixture(), revision: 2, updatedAt: at };
  Object.assign(w.body, { collaboration: { requests: [request], counts: { needsYou: 1, waiting: 0, blocked: 0 }, nextCursor: null } });
  await w.clock.advance(300000); await w.readDone();
  expect(w.data?.pending.map(c => c.eventId)).toEqual(["collaboration:contribution-a:2"]);
  expect(w.data?.pending[0]?.line).toContain("not your consent");
  expect(models).toBe(1); expect(w.calls.map(call => call.tool)).toEqual(["readPicture", "readPicture"]);
  await w.clock.advance(300000); await w.readDone();
  expect(w.data?.pending.length).toBe(1); expect(models).toBe(1);
  expect(request.acknowledgment).toBe(null); expect(request.agreement).toBe(null);
  const calls = w.calls.length;
  await $.session.end({ sessionId: w.sessionId });
  await w.clock.advance(900000);
  expect(w.calls.length).toBe(calls); expect(w.data?.pending.length).toBe(0);
});


test("one free poll advances bounded pages and delivers every older tail state once with maximum identifiers and labels", async ($, on) => {
  let w: ReturnType<typeof world>, models = 0;
  on("session.model", () => ({ value: "selected-main-model" }));
  on("model.complete", () => { models++; return { deny: "blocked" }; });
  const recipient = "recipient-" + "r".repeat(190), reviewer = "reviewer-" + "v".repeat(191);
  const requests = Array.from({length:20},(_,i)=>({...collaborationFixture(), collaborationId:String(i).padStart(3,"0")+"x".repeat(197),
    terms:{...collaborationFixture().terms,title:"Request "+String(i).padStart(2,"0")+" "+"t".repeat(109),recipientPersonId:recipient,reviewerPersonId:reviewer},
    updatedAt:BEFORE,createdAt:BEFORE}));
  const delivered: string[] = [];
  on("prompt.submit", {origin:{kind:"composer"}}, ($,e,next)=>{for(const note of e.context??[])for(const request of requests)if(note.includes(`collaboration:${request.collaborationId}:`))delivered.push(request.collaborationId);return next(e);});
  on("mcp.call", {tool:"readPicture"}, ($,e)=>{
    w.calls.push({server:e.server,tool:e.tool,args:e.args});
    const cursor=e.args?.collaborationCursor, start=typeof cursor==="string"?requests.findIndex(r=>r.collaborationId===cursor)+1:0;
    const page=requests.slice(start,start+5), nextCursor=start+5<requests.length?page[page.length-1]!.collaborationId:null;
    const asOf=new Date(Date.parse(AS_OF)+(w.calls.length-1)*300000).toISOString();
    return {value:wire({...w.body,asOf,window:{since:e.args?.since??BEFORE,until:asOf,sinceClamped:false},yourRole:{...w.body.yourRole,person:{personId:recipient,label:"R".repeat(200)}},
      collaboration:{requests:page,counts:{needsYou:20,waiting:0,blocked:0},nextCursor,truncated:nextCursor!==null,people:[{personId:recipient,label:"R".repeat(200),active:true},{personId:reviewer,label:"V".repeat(200),active:true}]}})};
  });
  w = world(on);
  await $.session.start({cwd:"/project",surface:"terminal",isInteractive:true});await w.activate();
  expect(w.data?.runtime?.collaborationCursor).toBe(requests[4]!.collaborationId);expect(w.data?.runtime?.pollSince).toBe(BEFORE);
  expect(w.data?.pending.length).toBe(0);
  for(let page=1;page<4;page++){
    await w.clock.advance(300000);await w.readDone();
    expect(w.calls.length).toBe(page+1);expect((w.calls[page]!.args as Record<string,unknown>).collaborationCursor).toBe(requests[page*5-1]!.collaborationId);
    if(page<3)expect(w.data?.runtime?.pollSince).toBe(BEFORE);
  }
  expect(w.data?.runtime?.collaborationCursor).toBe(null);expect(w.data?.pending.length).toBe(15);expect(models).toBe(1);
  await $.prompt.submit({text:"Show current work",wait:false,origin:{kind:"composer"}});
  expect(delivered).toEqual(requests.slice(5).map(r=>r.collaborationId));expect(w.data?.pending.length).toBe(0);
  await w.clock.advance(300000);await w.readDone();expect((w.calls[4]!.args as Record<string,unknown>).collaborationCursor).toBe(undefined);
  expect(w.data?.pending.length).toBe(0);
  requests[19]={...requests[19]!,revision:2};
  for(let page=0;page<3;page++){await w.clock.advance(300000);await w.readDone();}
  expect(w.data?.pending.map(c=>c.eventId)).toEqual([`collaboration:${requests[19]!.collaborationId}:2`]);
  expect(models).toBe(1);expect(w.calls.every(call=>call.tool==="readPicture")).toBe(true);
});

test("failed reads clear a closed-page cursor and explicit check-in or session end restarts pagination", async ($, on) => {
  const w=world(on),first=collaborationFixture();
  Object.assign(w.body,{collaboration:{requests:[first],counts:{needsYou:2,waiting:0,blocked:0},nextCursor:first.collaborationId}});
  await $.session.start({cwd:"/project",surface:"terminal",isInteractive:true});await w.activate();
  expect(w.data?.runtime?.collaborationCursor).toBe(first.collaborationId);
  w.failure="invalid_cursor";await w.clock.advance(300000);await w.readDone();
  expect((w.calls[1]!.args as Record<string,unknown>).collaborationCursor).toBe(first.collaborationId);expect(w.data?.runtime?.collaborationCursor).toBe(null);
  w.failure=null;const replacement={...first,collaborationId:"fresh-after-closed-cursor"};
  Object.assign(w.body,{collaboration:{requests:[replacement],counts:{needsYou:2,waiting:0,blocked:0},nextCursor:replacement.collaborationId}});
  await w.clock.advance(120000);await w.readDone();
  expect((w.calls[2]!.args as Record<string,unknown>).collaborationCursor).toBe(undefined);expect(w.data?.runtime?.collaborationCursor).toBe(replacement.collaborationId);
  // A server restart can return a continuation already used in this cycle. Restart instead of following it forever.
  await w.clock.advance(300000);await w.readDone();expect((w.calls[3]!.args as Record<string,unknown>).collaborationCursor).toBe(replacement.collaborationId);
  expect(w.data?.runtime?.collaborationCursor).toBe(null);
  await w.clock.advance(30000);await $.command.run(command);
  expect((w.calls[4]!.args as Record<string,unknown>).collaborationCursor).toBe(undefined);
  expect(w.data?.runtime?.collaborationCursor).toBe(replacement.collaborationId);
  const calls=w.calls.length;await $.session.end({sessionId:w.sessionId});expect(w.data?.runtime?.collaborationCursor).toBe(null);
  await w.clock.advance(900000);expect(w.calls.length).toBe(calls);
});
