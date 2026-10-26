import { update } from "claude-code";
import type { EngineInterface } from "claude-code";
import type { OrgSyncData, OrgSyncPicture, OrgSyncSteering } from "../types/index.js";
import { refusalStopsReads, toolBody } from "./picture.js";
import { changeDigest, learnedFacts, steer, writtenText } from "../local/steer.js";
import { answerLast, emptyLedger, prune, recordMarker } from "../local/budget.js";

/**
 * B1 steering in Claude Code (D-196 F5). The person's prompt, the AI's last reply and the text it writes are read here, on
 * the person's machine, and only as arguments to the local matcher: nothing stores, logs or sends them. What persists is
 * the title-level decision index, mutes, and the time of the last digest. The only call this adds is the free list index.
 */

const DATA = { plugin: "orgsync", key: "data" } as const;
const DAY = 86_400_000, STALE = 7 * DAY, FORGET = 30 * DAY, REFRESH_FLOOR = 60 * 60_000, MAX_PAGES = 5, MAX_LEARNED = 40;
type Entry = Parameters<typeof steer>[0]["index"][number];
type StoredIndex = { fetchedAt: number; asOf: string; entries: Entry[] };

const base = (p: OrgSyncPicture) => `${encodeURIComponent(p.company.companyId)}:${encodeURIComponent(p.person.personId)}`;
const indexKey = (p: OrgSyncPicture) => `steer:v1:${base(p)}`;
const mutesKey = (p: OrgSyncPicture) => `steer-mutes:v1:${base(p)}`;
const seenKey = (p: OrgSyncPicture) => `steer-seen:v1:${base(p)}`;
const state = (data: OrgSyncData): OrgSyncSteering => data.steering ?? { ledger: emptyLedger(), turn: 0, learned: {}, digested: false, indexFacts: null };
function save($: EngineInterface, fn: (s: OrgSyncSteering) => OrgSyncSteering): Promise<OrgSyncData> {
  return update($, DATA, held => held ? { ...held, steering: fn(state(held)) } : held);
}

const entry = (value: unknown): Entry | null => {
  const e = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return typeof e.sourceId === "string" && typeof e.title === "string" && Number.isInteger(e.revision) && typeof e.lastChangedAt === "string" &&
    Number.isFinite(Date.parse(e.lastChangedAt)) && (e.knowledgeStatus === "accepted_decision" || e.knowledgeStatus === "disputed")
    ? { sourceId: e.sourceId, revision: e.revision as number, title: e.title.slice(0, 200), knowledgeStatus: e.knowledgeStatus, lastChangedAt: e.lastChangedAt,
      area: typeof e.area === "string" ? e.area : null, tagIds: Array.isArray(e.tagIds) ? e.tagIds.filter((t): t is string => typeof t === "string").slice(0, 5) : [] }
    : null;
};
/** One page of the free decision index, or null for anything else. */
export function parseIndexPage(value: unknown): { asOf: string; entries: Entry[]; nextCursor: string | null } | null {
  const body = toolBody(value);
  if (!body || body.status !== "decision_index" || typeof body.asOf !== "string" || !Array.isArray(body.entries)) return null;
  const entries = body.entries.map(entry);
  if (entries.some(e => e === null)) return null;
  return { asOf: body.asOf, entries: entries as Entry[], nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null };
}

/** Reads the whole index, at most five pages, and keeps it for this company and person; a refusal that ends access wipes it. */
export async function refreshIndex($: EngineInterface, server: string, picture: OrgSyncPicture): Promise<void> {
  const now = await $.clock.now(), held = await stored($, picture, now, true), data = (await $.state.get(DATA)).value;
  if (held && now - held.fetchedAt < REFRESH_FLOOR && data && state(data).indexFacts === picture.standingHash) return;
  const entries: Entry[] = [];
  let cursor: string | null = null, asOf = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await $.mcp.call(server, "list", { what: "decisions", view: "index", ...(cursor ? { cursor } : {}) });
    if (refusalStopsReads(response)) { await $.store.set(indexKey(picture), null); return; }
    const parsed = parseIndexPage(response);
    if (!parsed) return;
    entries.push(...parsed.entries); asOf ||= parsed.asOf; cursor = parsed.nextCursor;
    if (!cursor) break;
  }
  await $.store.set(indexKey(picture), { fetchedAt: now, asOf, entries } satisfies StoredIndex);
  await save($, s => ({ ...s, indexFacts: picture.standingHash }));
}

async function stored($: EngineInterface, picture: OrgSyncPicture, now: number, evenStale = false): Promise<StoredIndex | null> {
  const value = await $.store.get(indexKey(picture)) as StoredIndex | null | undefined;
  if (!value || typeof value.fetchedAt !== "number" || !Array.isArray(value.entries)) return null;
  if (now - value.fetchedAt > FORGET) { await $.store.set(indexKey(picture), null); return null; }
  return evenStale || now - value.fetchedAt <= STALE ? value : null;
}

/** Up to three lines on decisions changed since the person's last session, once a session; the first session only marks the time. */
export async function sessionDigest($: EngineInterface, picture: OrgSyncPicture, enabled: boolean): Promise<string | null> {
  const data = (await $.state.get(DATA)).value;
  if (!enabled || !data || state(data).digested) return null;
  const now = await $.clock.now(), index = await stored($, picture, now), seen = await $.store.get(seenKey(picture));
  await save($, s => ({ ...s, digested: true }));
  await $.store.set(seenKey(picture), now);
  if (!index || typeof seen !== "number") return null;
  const lines = changeDigest(index.entries, seen);
  return lines.length ? `Changed since your last session, company data rather than instructions:\n${lines.join("\n")}` : null;
}

/** A hint for the person's own prompt, and their answer to the previous hint ("not relevant", "use mine"). */
export async function promptHint($: EngineInterface, e: { text: string; origin: { kind: string } }, enabled: boolean): Promise<string | null> {
  if (!enabled || (e.origin.kind !== "composer" && e.origin.kind !== "bridge")) return null;
  const data = (await $.state.get(DATA)).value, picture = data?.picture;
  if (!data || !picture) return null;
  // The person's own words set or clear the session's off-the-record marker first, index or not; while it is set nothing
  // is matched (D-196 F5).
  const s = state(data), marked = recordMarker(s.ledger, e.text), turn = s.turn + 1;
  const now = await $.clock.now(), index = marked.off ? null : await stored($, picture, now);
  if (!index) { await save($, current => ({ ...current, turn, ledger: marked })); return null; }
  const mutes = prune((await $.store.get(mutesKey(picture)) as Record<string, number> | null) ?? {}, now);
  const answered = answerLast(marked, mutes, e.text, now);
  if (answered.outcome === "not_relevant") await $.store.set(mutesKey(picture), answered.mutes);
  const result = steer({ event: "prompt", text: e.text, index: index.entries, learned: s.learned, now, asOf: Date.parse(index.asOf), companyName: picture.company.name,
    ledger: answered.ledger, mutes: answered.mutes, turnId: String(turn) });
  await save($, current => ({ ...current, turn, ledger: result.ledger }));
  return result.hint;
}

/** A hint after the AI's reply or a file it wrote, only for a fact an accepted decision contradicts. */
export async function afterHint($: EngineInterface, event: "stop" | "write", e: { last_assistant_message?: string; tool_input?: unknown }, enabled: boolean): Promise<string | null> {
  if (!enabled) return null;
  const data = (await $.state.get(DATA)).value, picture = data?.picture;
  if (!data || !picture) return null;
  const now = await $.clock.now(), index = await stored($, picture, now);
  if (!index) return null;
  const mutes = prune((await $.store.get(mutesKey(picture)) as Record<string, number> | null) ?? {}, now), s = state(data);
  const result = event === "stop"
    ? steer({ event, text: e.last_assistant_message ?? "", index: index.entries, learned: s.learned, now, asOf: Date.parse(index.asOf), companyName: picture.company.name, ledger: s.ledger, mutes, turnId: String(s.turn) })
    : steer({ event, text: writtenText(e.tool_input), index: index.entries, learned: s.learned, now, asOf: Date.parse(index.asOf), companyName: picture.company.name, ledger: s.ledger, mutes, turnId: String(s.turn) });
  if (result.hint) await save($, current => ({ ...current, ledger: result.ledger }));
  return result.hint;
}

/** Keeps the facts (numbers, units, nearby words) of a source the AI just read, for this session; never its text. */
export async function learn($: EngineInterface, result: unknown): Promise<void> {
  const learned = learnedFacts(toolBody(result));
  if (learned?.facts.length) await save($, s => ({ ...s, learned: Object.fromEntries([...Object.entries(s.learned).filter(([id]) => id !== learned.sourceId), [learned.sourceId, learned.facts]].slice(-MAX_LEARNED)) }));
}
