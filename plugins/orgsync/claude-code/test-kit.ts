import { mock } from "claude-code/testing";
import type { On, RenderSurface } from "claude-code";
import { pictureFixture, wire } from "./fixtures.js";
import type { OrgSyncData } from "../types/index.js";

export const command = { command: "orgsync:today", args: "", origin: { kind: "composer" }, presentation: { columns: 40, isFullscreen: false } } as const;
export const pane = { title: "OrgSync", isFocused: true, bodyColumns: 40, placement: "inline", scroll: { offset: 0, bodyRows: 20, totalRows: 20 }, view: {} } as const;
export const band = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 40, scroll: { offset: 0, bodyRows: 12, totalRows: 12 }, view: {} } as const;
export function world(on: On, surface: RenderSurface | null = "terminal") {
  const clock = mock.clock(on), session = mock.session(on);
  const readers: (() => void)[] = [];
  const w = { clock, session, body: pictureFixture(), calls: [] as { server: string; tool: string; args: unknown }[], sessionId: "conversation-a", surfaces: surface ? [surface] : [], opens: 0, registrations: 0, skillRuns: 0, failure: null as string | null, data: null as OrgSyncData | null, restore: null as ((data: OrgSyncData) => OrgSyncData) | null, stored: {} as Record<string, unknown>, readDone: async () => { if (w.data?.runtime?.phase === "loading") await new Promise<void>(resolve => readers.push(resolve)); }, activate: async () => { await clock.settle(); await w.readDone(); await clock.settle(); } };
  on("state.set", { plugin: "orgsync", key: "data" }, async ($, e, next) => { const value = w.restore ? w.restore(e.value) : e.value; w.restore = null; const result = await next({ ...e, value }); w.data = value; if (w.data.runtime?.phase !== "loading") for (const resolve of readers.splice(0)) resolve(); return result; });
  on("store.set", { key: /^(look|subject):/ }, async ($, e, next) => { const result = await next(e); w.stored[e.key] = e.value; return result; });
  mock.store(on);
  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("session.attach", ($, e) => ({ clientId: e.clientId }));
  on("session.end", ($, e) => ({ sessionId: e.sessionId }));
  on("session.id", () => ({ value: w.sessionId }));
  on("session.surfaces", () => ({ value: w.surfaces }));
  on("command.register", ($, e) => { expectImmediate(e.immediate); w.registrations++; return { value: { command: e.name } }; });
  on("command.run", { command: "orgsync:today" }, () => { w.skillRuns++; return { text: "Today skill writes the picture as text." }; });
  on("ui.open", () => { w.opens++; return { value: { isPlaced: true } }; });
  on("mcp.connect", () => ({ value: { isConnected: true, server: "orgsync-owner" } }));
  on("tool.list", () => ({ value: ["readSource", "readPermittedContext"].map(tool => ({ name: `mcp__orgsync-owner__${tool}`, description: "", mcp: true })) }));
  on("mcp.call", ($, e) => { w.calls.push({ server: e.server, tool: e.tool, args: e.args }); return { value: { ...wire(w.failure ? { status: "error", code: w.failure } : { ...w.body, window: { ...w.body.window, since: typeof e.args?.since === "string" ? e.args.since : null } }), isError: w.failure !== null } }; });
  on("turn.start", ($, e) => ({ turnId: e.turnId }));
  on("turn.complete", () => ({ text: "" }));
  on("prompt.submit", ($, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }));
  return w;
}
function expectImmediate(immediate: boolean | undefined) { if (!immediate) throw new Error("command must be immediate"); }
