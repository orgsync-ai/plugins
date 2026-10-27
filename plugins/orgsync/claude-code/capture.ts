import { update } from "claude-code";
import type { EngineInterface, Timer } from "claude-code";
import type { OrgSyncCapture, OrgSyncData, OrgSyncPicture } from "../types/index.js";
import { refusalStopsReads, toolBody } from "./picture.js";
import { indexTitles, markOffRecord } from "./steering.js";
import { redactMessages } from "../local/redact.js";
import { EXTRACTORS, extractPrompt } from "../local/extract-prompt.js";
import { dedupeItems, gateItems } from "../local/gate.js";
import { captureLine, offTheRecordIn, submissionsFromAnswer, toSubmission } from "../local/capture.js";
import { captureSession } from "../local/capture-session.js";
import { sha256Hex } from "../local/sha256.js";

/**
 * B2 capture in Claude Code (D-195; D-196 F5 and spike S1 put it in the mod). Before compaction, after 30 idle minutes and, through
 * a detached worker, at the end of a session, the person's own model reads this session's redacted text (their words and Claude's,
 * never tool output) and proposes company decisions; the local gate drops the never-capture list and duplicates; what is left goes
 * to their private OrgSync queue through `submitDraft`, and only while OrgSync's `status` says capture is on for them. Never on
 * every turn. Off the record is the steering ledger's sticky `captureOff`: once set, nothing more leaves the session and what it
 * already sent is forgotten.
 *
 * Conversation text reaches only the local modules, the model call and the worker's job, never state, storage, a log or another
 * call (client-plugin.test.ts checks this file). What persists: the session's digest, a count, the off-the-record mark, and how
 * far the redacted text has been read, as a length and a SHA-256. The worker's files (worker/capture-worker.mjs documents them)
 * sit in private folders under the plugin's data folder and live at most 24 hours.
 */

const DATA = { plugin: "orgsync", key: "data" } as const;
const SESSIONS = "capture:v1:sessions";
const DAY = 86_400_000, SESSION_CAP = 10, LOCK_MS = 5 * 60_000, IDLE_MS = 30 * 60_000, MIN_CHARS = 200, KEEP_MS = 30 * DAY, KEEP_SESSIONS = 100;
/** Refusals after which nothing more of a run is sent; a duplicate, an oversized item or a credential shape skips that item only. */
const STOP = new Set(["capture_off", "capture_paused", "capture_notice_required", "capture_limit_reached", "capture_extractor_retired"]);
/** Refusals that end an outbox entry: it can never be accepted (the worker's FINAL_REFUSALS). */
const FINAL = new Set(["capture_duplicate", "capture_session_forgotten", "capture_sensitive_pattern", "capture_too_large", "capture_extractor_retired"]);
const OUTBOX = /^(cs1_[a-f0-9]{64})\.(?:[a-f0-9]{16}|forget)\.json$/, ANSWERED = /^(cs1_[a-f0-9]{64})\.[A-Za-z0-9._-]{1,80}\.answered\.json$/;
const MODELS = new Set(["default", "haiku", "sonnet", "opus"]);
type Trigger = "pre_compact" | "idle";
type Mark = { length: number; hash: string };
type Go = { picture: OrgSyncPicture; server: string; session: string; sent: number };
/** One session's capture on this computer, by its digest: never text. `forget` waits for a forget OrgSync has not confirmed. */
type Memory = { off?: boolean; forget?: boolean; sent: number; at: number };

/** /config → OrgSync: `capture_suggestions` (on unless the person turns it off) and `capture_model` (Q8: Sonnet by default). */
let enabled = true, choice = "sonnet", idleTimer: Timer | null = null;
export function configure(options: Record<string, unknown>): void {
  enabled = options.capture_suggestions !== false;
  choice = typeof options.capture_model === "string" && MODELS.has(options.capture_model) ? options.capture_model : "sonnet";
}

const blank = (): OrgSyncCapture => ({ session: null, off: false, mark: null, running: null, idleTurns: null, you: null });
const current = (data: OrgSyncData | null | undefined): OrgSyncCapture => data?.capture ?? blank();
async function read($: EngineInterface): Promise<OrgSyncData | null> { return (await $.state.get(DATA)).value ?? null; }
function save($: EngineInterface, fn: (c: OrgSyncCapture) => OrgSyncCapture): Promise<OrgSyncData> {
  return update($, DATA, held => held ? { ...held, capture: fn(current(held)) } : held);
}
/** Whether this session is off the record: the person's own words (the steering ledger's sticky mark) or /orgsync:capture. */
const offRecord = (data: OrgSyncData | null | undefined): boolean => !!data && (current(data).off || data.steering?.ledger.captureOff === true);
/** The person's own private drafts the picture lists, which a new suggestion must not repeat (research B8 fix 1). */
const draftTitles = (picture: OrgSyncPicture): string[] => picture.items.filter(i => i.section === "needs" && i.id.startsWith("draft:")).map(i => i.title);

async function sessions($: EngineInterface): Promise<Record<string, Memory>> {
  return ((await $.store.get(SESSIONS)) as Record<string, Memory> | null | undefined) ?? {};
}
async function recall($: EngineInterface, session: string): Promise<Memory> {
  const memory = (await sessions($))[session];
  return memory && typeof memory.sent === "number" ? memory : { sent: 0, at: 0 };
}
async function remember($: EngineInterface, session: string, change: Partial<Memory>): Promise<Memory> {
  const now = await $.clock.now(), all = await sessions($);
  const next = { ...(all[session] ?? { sent: 0 }), ...change, at: now };
  const kept = Object.entries({ ...all, [session]: next }).filter(([, m]) => now - m.at < KEEP_MS).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP_SESSIONS);
  await $.store.set(SESSIONS, Object.fromEntries(kept));
  return next;
}
async function sessionOf($: EngineInterface): Promise<string> {
  const held = current(await read($)).session;
  if (held) return held;
  const session = captureSession(await $.session.id());
  await save($, c => ({ ...c, session }));
  return session;
}

/** What a run needs when capture may run now: this mod on, the picture saying capture is on for the person, the session not off
 * the record and under its cap. Otherwise null, and nothing is read. */
async function ready($: EngineInterface): Promise<Go | null> {
  const data = await read($), picture = data?.picture, server = data?.runtime?.server;
  if (!enabled || !data || !picture || !server || picture.capture?.you !== "on" || offRecord(data)) return null;
  const session = await sessionOf($), memory = await recall($, session);
  if (memory.off) { await save($, c => ({ ...c, off: true })); return null; }
  return memory.sent < SESSION_CAP ? { picture, server, session, sent: memory.sent } : null;
}
async function lock($: EngineInterface): Promise<string | null> {
  const now = await $.clock.now(), token = crypto.randomUUID();
  const held = await save($, c => c.running && c.running.expires > now ? c : { ...c, running: { token, expires: now + LOCK_MS } });
  return held?.capture?.running?.token === token ? token : null;
}
function unlock($: EngineInterface, token: string): Promise<OrgSyncData> { return save($, c => c.running?.token === token ? { ...c, running: null } : c); }

/** OrgSync's own word, just before sending: the picture can be minutes old, and the person may have paused or switched off. */
async function captureOn($: EngineInterface, server: string): Promise<boolean> {
  const body = toolBody(await $.mcp.call(server, "status", { target: "connection" }));
  const state = body?.capture !== null && typeof body?.capture === "object" ? (body.capture as Record<string, unknown>).you : null;
  const you = state === "on" || state === "off" || state === "paused" || state === "needs_notice" || state === "unavailable" ? state : null;
  await save($, c => ({ ...c, you }));
  return you === "on";
}

/** The worker's folder, <plugin data>/orgsync/capture. A mod is not handed ${CLAUDE_PLUGIN_DATA}, so it takes the folder Claude
 * Code gives the published plugin, orgsync@orgsync, under the person's Claude folder. */
async function captureRoot($: EngineInterface): Promise<string | null> {
  const data = await $.env.get("CLAUDE_PLUGIN_DATA");
  if (data?.startsWith("/")) return `${data}/orgsync/capture`;
  const config = await $.env.get("CLAUDE_CONFIG_DIR"), home = await $.env.get("HOME");
  const base = config?.startsWith("/") ? config : home?.startsWith("/") ? `${home}/.claude` : null;
  return base ? `${base}/plugins/data/orgsync-orgsync/orgsync/capture` : null;
}
/** Runs a fixed shell line with the paths as arguments, never inside it; folders it makes are this person's only. */
async function shell($: EngineInterface, line: string, ...paths: string[]): Promise<boolean> {
  return (await $.process.run(["/bin/sh", "-c", `umask 077 && ${line}`, "sh", ...paths], { timeoutMs: 2000 }).catch(() => null))?.exitCode === 0;
}

/**
 * Reads the session's text not yet read and, unless it is too short to hold a decision, extracts from it: now, or for compaction
 * just after the hook returns, so compaction never waits for the model. The read itself happens before compaction rewrites the
 * transcript. After compaction the old text no longer leads the transcript, so everything since is new.
 */
async function capture($: EngineInterface, trigger: Trigger, refresh: () => Promise<unknown>): Promise<void> {
  const go = await ready($);
  if (!go) return;
  const token = await lock($);
  if (!token) return;
  try {
    // The person's own words anywhere in the session count, so a resumed or forked session that went off the record stays off.
    const messages = await $.session.messages();
    if (offTheRecordIn(messages)) { await unlock($, token); await goOff($, false); return; }
    const redacted = redactMessages(messages), mark = current(await read($)).mark;
    const continues = mark !== null && mark.length <= redacted.text.length && sha256Hex(redacted.text.slice(0, mark.length)) === mark.hash;
    const source = continues && mark ? redacted.text.slice(mark.length) : redacted.text;
    const next: Mark = { length: redacted.text.length, hash: sha256Hex(redacted.text) };
    if (source.trim().length < MIN_CHARS) { await unlock($, token); return; }
    if (trigger === "pre_compact") $.clock.after(0, () => extract($, go, trigger, source, next, token, refresh).catch(() => unlock($, token)));
    else await extract($, go, trigger, source, next, token, refresh);
  } catch { await unlock($, token); }
}

async function extract($: EngineInterface, go: Go, trigger: Trigger, source: string, next: Mark, token: string, refresh: () => Promise<unknown>): Promise<void> {
  try {
    const decisionTitles = await indexTitles($, go.picture), queuedTitles = draftTitles(go.picture);
    const reply: unknown = await $.model.complete({ model: choice === "default" ? await $.session.model() : choice, maxTokens: 4096, timeoutMs: 120_000,
      prompt: extractPrompt({ transcript: source, decisionTitles, queuedTitles }) });
    // This engine answers `{ isAnswered, text }`; a newer one answers the text alone. An unanswered call leaves the mark, so the
    // next trigger reads the same text again.
    const answered = typeof reply === "string" || (reply !== null && typeof reply === "object" && (reply as { isAnswered?: unknown }).isAnswered === true);
    if (!answered) return;
    await save($, c => ({ ...c, mark: next }));
    const run = submissionsFromAnswer({ answer: typeof reply === "string" ? reply : (reply as { text?: string }).text ?? "", source, surface: "claude_code",
      extractor: EXTRACTORS.claude_code, trigger, session: go.session, date: await $.clock.now(), decisionTitles, queuedTitles });
    if (run.submissions.length === 0 || !await captureOn($, go.server)) return;
    let sent = go.sent;
    for (const submission of run.submissions) {
      if (sent >= SESSION_CAP || offRecord(await read($))) break;
      const response = await $.mcp.call(go.server, "submitDraft", submission), body = toolBody(response, true);
      if (body?.status === "draft_submitted") { sent = (await remember($, go.session, { sent: sent + 1 })).sent; continue; }
      const code = typeof body?.code === "string" ? body.code : null;
      if (code === "capture_session_forgotten") { await save($, c => ({ ...c, off: true })); await remember($, go.session, { off: true }); break; }
      if (!code || STOP.has(code) || refusalStopsReads(response)) break;
    }
    if (sent > go.sent) await refresh();
  } finally { await unlock($, token); }
}

/** Before compaction: read the whole session now, and extract once compaction has its turn (never blocking it). */
export async function beforeCompact($: EngineInterface, refresh: () => Promise<unknown>): Promise<void> { await capture($, "pre_compact", refresh).catch(() => {}); }

/** Claude finished and the person has not typed for about a minute: wait 30 minutes, and capture if no prompt came in between. */
export async function whenIdle($: EngineInterface, refresh: () => Promise<unknown>): Promise<void> {
  if (!await ready($)) return;
  const turns = await $.session.turns();
  idleTimer?.cancel();
  await save($, c => ({ ...c, idleTurns: turns }));
  idleTimer = $.clock.after(IDLE_MS, async () => {
    idleTimer = null;
    if (await $.session.turns() === turns && current(await read($)).idleTurns === turns) await capture($, "idle", refresh).catch(() => {});
  });
}

/** Forgets every item this session sent, through OrgSync's forget form; a forget OrgSync did not confirm is retried later. */
async function forget($: EngineInterface, session: string): Promise<{ discarded: number; stillShared: number } | null> {
  const server = (await read($))?.runtime?.server;
  const body = server ? toolBody(await $.mcp.call(server, "discard", { captureSession: session }).catch(() => null)) : null;
  if (body?.status !== "capture_session_forgotten") { await remember($, session, { forget: true }); return null; }
  await remember($, session, { forget: false });
  return { discarded: typeof body.discarded === "number" ? body.discarded : 0, stillShared: Array.isArray(body.stillShared) ? body.stillShared.length : 0 };
}

/** After the person's prompt: when their own words just put the session off the record, stop and forget what it sent; when
 * they asked to forget it ("forget this session"), forget whatever OrgSync holds from it, each time they ask. */
export async function notePrompt($: EngineInterface): Promise<void> {
  // Not the worker's ledger below: this is the steering marker, a name kept apart for the flow check.
  const data = await read($), marker = data?.steering?.ledger;
  if (!data || !marker) return;
  const forgets = marker.forgets ?? 0;
  if (forgets > (current(data).forgotten ?? 0)) { await save($, c => ({ ...c, forgotten: forgets })); await goOff($, true); return; }
  if (marker.captureOff !== true || current(data).off) return;
  await goOff($, false);
}
async function goOff($: EngineInterface, always: boolean): Promise<{ discarded: number; stillShared: number } | null> {
  idleTimer?.cancel(); idleTimer = null;
  const session = await sessionOf($);
  await save($, c => ({ ...c, off: true, idleTurns: null }));
  const memory = await remember($, session, { off: true }), root = await captureRoot($);
  // The worker's own sticky marker, so a job of this session still running drops what it found, and its unsent items go.
  if (root) await shell($, 'mkdir -p "$1/off" && : > "$1/off/$2" && for f in "$1/outbox/$2".*.json; do case "$f" in *.forget.json) ;; *) rm -f "$f" ;; esac; done',
    root, session);
  return always || memory.sent > 0 || memory.forget ? forget($, session) : { discarded: 0, stillShared: 0 };
}

/**
 * At the end of a session no model call fits in its 1.5 seconds, half of which another mod already uses (spike S1): the text not
 * yet read and a job go to the worker's folder, and the detached worker extracts with the person's own CLI. The next session
 * sends what it kept ({@link drain}).
 */
export async function atSessionEnd($: EngineInterface): Promise<void> {
  idleTimer?.cancel(); idleTimer = null;
  const go = await ready($), root = go ? await captureRoot($) : null;
  if (!go || !root) return;
  const messages = await $.session.messages();
  if (offTheRecordIn(messages)) { await goOff($, false); return; }
  const redacted = redactMessages(messages), mark = current(await read($)).mark;
  const continues = mark !== null && mark.length <= redacted.text.length && sha256Hex(redacted.text.slice(0, mark.length)) === mark.hash;
  const source = continues && mark ? redacted.text.slice(mark.length) : redacted.text;
  if (source.trim().length < MIN_CHARS) return;
  const now = await $.clock.now(), id = `${go.session}.${now}-end`, decisionTitles = await indexTitles($, go.picture), queuedTitles = draftTitles(go.picture);
  if (!await shell($, 'mkdir -p "$1/jobs" "$1/work/$2"', root, id)) return;
  await $.fs.write(`${root}/work/${id}/source.txt`, source);
  await $.fs.write(`${root}/work/${id}/prompt.txt`, extractPrompt({ transcript: source, decisionTitles, queuedTitles }));
  // The job last: the worker takes only a job whose files are all there.
  await $.fs.write(`${root}/jobs/${id}.json`, JSON.stringify({ version: 1, surface: "claude_code", session: go.session, trigger: "session_end", createdAt: new Date(now).toISOString(),
    model: choice === "default" ? await $.session.model() : choice, decisionTitles, queuedTitles }));
  await shell($, 'nohup /bin/sh "$1" "$2" >/dev/null 2>&1 </dev/null &', `${$.plugin.root}/worker/worker.sh`, root);
}

/**
 * At the start of a session: sends what the worker kept from earlier sessions, through this person's own connection and only
 * while OrgSync's `status` says capture is on, and the forgets this computer still owes. A sent or finally refused entry is
 * deleted; one OrgSync could not take now waits, at most 24 hours. Each item passes the gate again and is checked against the
 * company's decisions and the person's queue as they stand now.
 */
export async function drain($: EngineInterface, refresh: () => Promise<unknown>): Promise<void> {
  const data = await read($), picture = data?.picture, server = data?.runtime?.server;
  if (!data || !picture?.capture || !server) return;
  for (const [session, memory] of Object.entries(await sessions($))) if (memory.forget) await forget($, session);
  const root = await captureRoot($);
  if (!root) return;
  const names = async (folder: string) => (await $.fs.list(`${root}/${folder}`).catch(() => [])).map(listed => listed.name).sort();
  const outbox = (await names("outbox")).filter(name => OUTBOX.test(name)), answered = (await names("jobs")).filter(name => ANSWERED.test(name));
  if (outbox.length === 0 && answered.length === 0) return;
  const now = await $.clock.now(), cutoff = new Date(now - DAY).toISOString(), done: string[] = [];
  const decisionTitles = await indexTitles($, picture), queuedTitles = draftTitles(picture);
  let on: boolean | null = null, stop = false, sent = 0;
  const allowed = async () => (on ??= enabled && picture.capture?.you === "on" && await captureOn($, server));
  /** Drafts sent from outbox entries, by the entry name's 16 hex (the idempotency key's), for the worker's ledger. */
  const filled: { session: string; hex: string; draftId: string | null }[] = [];
  /** One submission: the draft's id once sent, true when refused for good, false when it should wait. */
  const submit = async (session: string, submission: Record<string, unknown>): Promise<string | boolean> => {
    const response = await $.mcp.call(server, "submitDraft", submission), body = toolBody(response, true);
    if (body?.status === "draft_submitted") { sent++; await remember($, session, { sent: (await recall($, session)).sent + 1 }); return typeof body.draftId === "string" ? body.draftId : true; }
    const code = typeof body?.code === "string" ? body.code : null;
    if (code === "capture_session_forgotten") await remember($, session, { off: true });
    if (!code || STOP.has(code) || refusalStopsReads(response)) stop = true;
    return code !== null && FINAL.has(code);
  };
  for (const name of outbox) {
    if (stop) break;
    const session = OUTBOX.exec(name)![1]!, path = `${root}/outbox/${name}`, memory = await recall($, session);
    if (name.endsWith(".forget.json")) { if (await forget($, session)) done.push(path); continue; }
    if (memory.off || memory.sent >= SESSION_CAP) { done.push(path); continue; }
    try {
      const entry = JSON.parse(await $.fs.read(path)) as { createdAt?: string; arguments?: { title: string; summary: string; excerpts: { text: string }[]; area?: string;
        classification?: string; capture: { extractor: string; trigger: string } } };
      if (typeof entry.createdAt !== "string" || entry.createdAt < cutoff || !entry.arguments) { done.push(path); continue; }
      if (!await allowed()) break;
      const proposed = entry.arguments, texts = proposed.excerpts.map(excerpt => excerpt.text);
      const gated = gateItems([{ title: proposed.title, summary: proposed.summary, excerpts: texts, kind: proposed.classification === "way_of_working" ? "way_of_working" : "decision",
        area: proposed.area ?? null, confidence: 1, sensitive: "none", decided: "confirmed", scope: "company" }], { source: [proposed.title, proposed.summary, ...texts].join("\n"), threshold: 0 });
      const fresh = dedupeItems(gated.kept, { decisionTitles, queuedTitles });
      let finished = fresh.kept.length === 0;
      for (const item of fresh.kept) {
        const outcome = await submit(session, toSubmission(item, { surface: "claude_code", extractor: proposed.capture.extractor, trigger: proposed.capture.trigger,
          session, date: entry.createdAt }));
        finished = outcome !== false;
        if (typeof outcome === "string") filled.push({ session, hex: name.slice(session.length + 1, -".json".length), draftId: outcome });
      }
      if (finished) done.push(path);
    } catch { done.push(path); }
  }
  // What a worker without Node left: the extractor's answer beside the text it read, gated here.
  for (const name of answered) {
    if (stop) break;
    const session = ANSWERED.exec(name)![1]!, id = name.slice(0, -".answered.json".length), job = `${root}/jobs/${name}`, work = `${root}/work/${id}`;
    if ((await recall($, session)).off) { done.push(job, work); continue; }
    if (!await allowed()) break;
    try {
      const meta = JSON.parse(await $.fs.read(job)) as { createdAt?: string };
      if (typeof meta.createdAt !== "string" || meta.createdAt < cutoff) { done.push(job, work); continue; }
      const run = submissionsFromAnswer({ answer: await $.fs.read(`${work}/answer.txt`), source: await $.fs.read(`${work}/source.txt`), surface: "claude_code",
        extractor: EXTRACTORS.claude_code, trigger: "session_end", session, date: meta.createdAt, decisionTitles, queuedTitles });
      for (const submission of run.submissions) if (!stop) await submit(session, submission);
      if (!stop) done.push(job, work);
    } catch { done.push(job, work); }
  }
  // The worker's ledger records that the session sent something, and each draft's id, so a later off the record there asks
  // OrgSync to forget it (worker/capture-worker.mjs).
  for (const session of new Set(filled.map(f => f.session))) {
    const path = `${root}/ledger/${session}.json`;
    try {
      const ledger = JSON.parse(await $.fs.read(path)) as { drafts?: { key?: unknown; draftId?: unknown }[] };
      const drafts = (ledger.drafts ?? []).map(draft => {
        for (const f of filled) if (f.session === session && typeof draft.key === "string" && draft.key.slice(5, 21) === f.hex) return { ...draft, draftId: f.draftId };
        return draft;
      });
      await $.fs.write(path, JSON.stringify({ ...ledger, drafts, sent: true, updatedAt: new Date(now).toISOString() }));
    } catch { /* No ledger: a worker without Node keeps none. */ }
  }
  if (done.length) await $.process.run(["/bin/rm", "-rf", ...done], { timeoutMs: 2000 }).catch(() => null);
  if (sent) await refresh();
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * `/orgsync:capture` in Claude Code. `off` and `forget` act at once, without an AI turn, and so does `status`; anything else
 * (pause, resume) answers null, so the capture skill gives the person their capture page, where only they change the setting.
 */
export async function command($: EngineInterface, input: string, refresh: () => Promise<unknown>): Promise<string | null> {
  const word = input.trim().toLowerCase().split(/\s+/)[0] || "status";
  if (word === "off" || word === "forget") {
    await markOffRecord($);
    const result = await goOff($, word === "forget");
    const lead = word === "off" ? "Off the record: nothing from this session goes to OrgSync" : "Forgotten: nothing more from this session goes to OrgSync";
    if (!result) return `${lead}. What it already saved will be forgotten once OrgSync answers; Captured for you on OrgSync's Home also forgets it.`;
    const shared = result.stillShared ? ` ${plural(result.stillShared, "item you already shared stays", "items you already shared stay")} published; ask Claude to delete ${result.stillShared === 1 ? "it" : "them"}.` : "";
    return `${lead}${result.discarded ? `, and ${plural(result.discarded, "saved item is", "saved items are")} gone` : ""}.${shared}`;
  }
  if (word !== "status") return null;
  await refresh();
  const data = await read($), picture = data?.picture;
  if (!picture) return null;
  if (!picture.capture) return "OrgSync has no capture on this connection.";
  if (!enabled) return "Capture suggestions are off for this app in /config.";
  const line = bandLine(data, await $.clock.now()) || (picture.capture.company === "off" ? "Capture is off at your company." : "Capture is off for you.");
  const { queued, expiringSoon } = picture.capture;
  return queued ? `${line}. ${plural(queued, "captured item waits", "captured items wait")} for you${expiringSoon ? `, ${expiringSoon} deleted soon` : ""}: /orgsync:today.` : line;
}

/** The band's one capture line: on, off the record, paused, waiting for the person's OK, or nothing. */
export function bandLine(data: OrgSyncData | null | undefined, now: number): string {
  if (!data || !enabled) return "";
  return captureLine({ capture: data.picture?.capture ?? null, off: offRecord(data), now });
}
