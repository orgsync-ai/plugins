// @ts-check
// D-195 capture worker (plan B2 §4.5 steps 4-8), run detached by worker.sh: node capture-worker.mjs <capture root>. Per job it
// waits for the transcript to settle, redacts what is new since the last run, rechecks off the record, runs the person's own
// extractor, gates and deduplicates, writes the gated items to the outbox, deletes the transcript copy and records the ledger.
// It holds no OrgSync credential and calls no OrgSync tool: the Claude Code mod drains the outbox through the person's own
// connection at the next session, and Codex's courier (courier.mjs, opt-in until headless sign-in is proved) does for Codex.
// Every failure leaves one content-free line in notes.log and exits 0.
//
// The capture root is <plugin data>/orgsync/capture (Codex: $PLUGIN_DATA; Claude Code: ${CLAUDE_PLUGIN_DATA}). Directories are
// 0700 and files 0600. <session> is always the `cs1_…` digest (local/capture-session.js), never the client's own session id.
//
//   jobs/<id>.json            one capture job; <id> = <session>.<stamp>, stamp [A-Za-z0-9._-]{1,80}, unique per job
//   spool/<id>.jsonl          Codex: hard link of the transcript (or the worker's copy when the link failed)
//   work/<id>/                the extractor's working folder: prompt.txt, source.txt (redacted text), answer.txt
//   outbox/<session>.<16 hex>.json, outbox/<session>.forget.json   gated items and forgets waiting for OrgSync
//   ledger/<session>.json     what was captured from a session
//   off/<session>             the session is off the record (sticky); its content is irrelevant
//   paused                    a local pause: its end, in seconds since 1970
//   locks/<session>/          one worker per session at a time (a directory, so taking it is atomic)
//   notes.log                 one content-free line per skip or run, the newest 200 kept
//
// Job file (JSON, version 1), written by codex/capture.sh or the Claude Code mod:
//   { "version": 1, "surface": "codex" | "claude_code", "session": "cs1_…", "trigger": "pre_compact" | "session_end" | "idle",
//     "createdAt": ISO time (the session's day, for sourceOrigin),
//     Codex:        "offset": UTF-8 bytes of the transcript already captured, "linked": true | false,
//                   "source": the transcript's own path when "linked" is false (the worker copies it), else "",
//                   "steering": the steering ledger's file name in orgsync/sessions/ ("<id>.json"), for the off-the-record check,
//     Claude Code:  work/<id>/source.txt holds the redacted text (local/redact.js redactMessages, only the turns since the last
//                   capture) and, optionally, work/<id>/prompt.txt the extractor prompt (local/extract-prompt.js extractPrompt);
//                   the mod writes both before the job file, then detaches worker.sh,
//     optional:     "model": the capture_model choice (Claude Code), "decisionTitles", "queuedTitles", "earlierTitles": string arrays }
//   Without Node, worker.sh extracts a Claude Code job itself and renames it jobs/<id>.answered.json beside work/<id>/answer.txt;
//   the mod then calls local/capture.js submissionsFromAnswer({ answer, source, … }) itself and deletes both.
//
// Outbox entry (JSON, version 1). A drainer submits it, deletes it on `draft_submitted` or a final refusal (capture_duplicate,
// capture_session_forgotten, capture_sensitive_pattern, capture_too_large, capture_extractor_retired), and keeps it otherwise
// until it expires: a submit entry 24 hours after createdAt, a forget entry 7 days after.
//   { "version": 1, "kind": "submit", "surface", "session", "createdAt", "arguments": submitDraft's arguments (local/capture.js) }
//   { "version": 1, "kind": "forget", "surface", "session", "createdAt" }   → discard { captureSession: session }
//
// Ledger (JSON, version 1). The drainer sets "sent": true and fills "draftId" by idempotency key after a submission succeeds, so
// a later off the record knows to queue a forget.
//   { "version": 1, "session", "surface", "offset": bytes captured, "titles": titles proposed (newest 50),
//     "drafts": [{ "key": idempotencyKey, "draftId": string | null, "at": ISO }], "sent": boolean, "updatedAt": ISO }
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync,
  writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { submissionsFromAnswer } from "../local/capture.js";
import { isCaptureSession } from "../local/capture-session.js";
import { EXTRACTORS, extractPrompt } from "../local/extract-prompt.js";
import { redactCodexJsonl } from "../local/redact.js";

const MINUTE = 60_000, DAY = 24 * 60 * MINUTE;
export const LIMITS = Object.freeze({ spoolMs: DAY, submitMs: DAY, forgetMs: 7 * DAY, ledgerMs: 30 * DAY, lockMs: 10 * MINUTE, stableMs: 2_000, stableMaxMs: 60_000,
  extractTimeoutMs: 180_000, maxAnswerBytes: 1_000_000, maxReadBytes: 8 * 1024 * 1024, perSession: 10, notes: 200 });
const SURFACES = ["claude_code", "codex"], TRIGGERS = ["pre_compact", "session_end", "idle"];
const ID = /^(cs1_[a-f0-9]{64})\.[A-Za-z0-9._-]{1,80}$/;
/** Final refusals: the item can never be accepted, so the outbox drops it. */
export const FINAL_REFUSALS = Object.freeze(["capture_duplicate", "capture_session_forgotten", "capture_sensitive_pattern", "capture_too_large", "capture_extractor_retired"]);

/** The person's Codex MCP servers by name, from `codex mcp list --json` (which reads Codex's own configuration and starts no
 * server), or null when that cannot be told, including a name a configuration override cannot address. A mock replaces the
 * listing through ORGSYNC_CAPTURE_MCP_LIST_CMD (run by /bin/sh). @returns {string[] | null} */
export function codexServers() {
  const custom = process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD;
  const [command = "", ...args] = custom ? ["/bin/sh", "-c", custom] : ["codex", "mcp", "list", "--json"];
  const listed = spawnSync(command, args, { encoding: "utf8", timeout: 10_000, maxBuffer: 1_000_000, stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, ORGSYNC_CAPTURE_CHILD: "1" } });
  if (listed.status !== 0) return null;
  try {
    const servers = JSON.parse(listed.stdout);
    if (!Array.isArray(servers)) return null;
    const names = servers.map(server => record(server)?.name);
    return names.every(name => typeof name === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(name)) ? /** @type {string[]} */ (names) : null;
  } catch { return null; }
}

/** Overrides that switch off every Codex MCP server but those in `keep` (plan B2 §4.5: the extractor reaches none, the courier
 * only OrgSync's). Codex merges `-c mcp_servers={}` into the person's servers instead of replacing them, so each is named.
 * @param {readonly string[]} servers @param {readonly string[]} [keep] */
export const mcpOff = (servers, keep = []) => servers.filter(name => !keep.includes(name)).flatMap(name => ["-c", `mcp_servers.${name}.enabled=false`]);

/** The person's own extractor (plan B2 §4.5 step 5, with spike S1's correction: --safe-mode keeps a subscription's sign-in,
 * --bare does not, and loads no plugins, hooks or MCP). The prompt arrives on stdin, so it needs no tool at all; Codex's
 * extractor runs with every MCP server off. */
export const EXTRACT_COMMANDS = Object.freeze({
  claude_code: (/** @type {string} */ model) => ["claude", "-p", "--safe-mode", "--strict-mcp-config", "--tools", "",
    "--no-session-persistence", "--max-turns", "3", "--output-format", "json", "--model", model],
  codex: (/** @type {readonly string[]} */ servers) => ["codex", "exec", "--ephemeral", "-s", "read-only", "--skip-git-repo-check", ...mcpOff(servers),
    "--output-last-message", "answer.txt", "-"]
});

/** @param {unknown} value @returns {Record<string, any> | null} */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, any>} */ (value) : null;
/** @param {string} path */
const readJson = path => { try { return record(JSON.parse(readFileSync(path, "utf8"))); } catch { return null; } };
/** Written whole or not at all, readable only by this person. @param {string} path @param {unknown} value */
export function writePrivate(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, typeof value === "string" ? value : `${JSON.stringify(value)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}
/** @param {unknown} list @returns {string[]} */
const titles = list => Array.isArray(list) ? list.filter(title => typeof title === "string" && title.trim()).slice(0, 200).map(title => title.slice(0, 200)) : [];
/** @param {number} ms */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The folders a run needs, private to this person. @param {string} root */
export function ensureDirs(root) {
  for (const name of ["jobs", "spool", "work", "outbox", "ledger", "off", "locks"]) mkdirSync(join(root, name), { recursive: true, mode: 0o700 });
}

/** One content-free line. @param {string} root @param {string} line @param {number} now */
export function note(root, line, now = Date.now()) {
  try { appendFileSync(join(root, "notes.log"), `${new Date(now).toISOString()} ${line}\n`, { mode: 0o600 }); } catch { /* best effort */ }
}

/** A job file, checked, or null. @param {string} root @param {string} name */
export function readJob(root, name) {
  const id = name.replace(/\.json$/, ""), match = ID.exec(id), job = readJson(join(root, "jobs", name));
  if (!match || !job || job.version !== 1 || !SURFACES.includes(job.surface) || job.session !== match[1] || !isCaptureSession(job.session) ||
    !TRIGGERS.includes(job.trigger) || typeof job.createdAt !== "string" || !Number.isFinite(Date.parse(job.createdAt))) return null;
  if (job.surface === "codex" && (!Number.isSafeInteger(job.offset) || job.offset < 0 || typeof job.linked !== "boolean" || typeof job.source !== "string" ||
    !(job.steering === undefined || (typeof job.steering === "string" && /^[A-Za-z0-9_-]{1,80}\.json$/.test(job.steering))))) return null;
  const model = typeof job.model === "string" && /^[a-z0-9][a-z0-9.-]{0,39}$/.test(job.model) ? job.model : null;
  return { id, surface: /** @type {"claude_code" | "codex"} */ (job.surface), session: /** @type {string} */ (job.session), trigger: /** @type {string} */ (job.trigger),
    createdAt: /** @type {string} */ (job.createdAt), offset: job.surface === "codex" ? /** @type {number} */ (job.offset) : 0, linked: job.linked === true,
    source: typeof job.source === "string" ? job.source : "", steering: typeof job.steering === "string" ? job.steering : null, model,
    decisionTitles: titles(job.decisionTitles), queuedTitles: titles(job.queuedTitles), earlierTitles: titles(job.earlierTitles) };
}
/** @typedef {NonNullable<ReturnType<typeof readJob>>} Job */

/** @param {string} root @param {string} session */
export function readLedger(root, session) {
  const ledger = readJson(join(root, "ledger", `${session}.json`));
  return { version: 1, session, surface: typeof ledger?.surface === "string" ? ledger.surface : null, offset: Number.isSafeInteger(ledger?.offset) ? ledger?.offset : 0,
    titles: titles(ledger?.titles).slice(-50), drafts: Array.isArray(ledger?.drafts) ? ledger.drafts.filter(record) : [], sent: ledger?.sent === true,
    updatedAt: typeof ledger?.updatedAt === "string" ? ledger.updatedAt : null };
}

/** Whether the session is off the record: capture's sticky marker, or the steering ledger's (Codex). Seeing the steering
 * marker writes capture's own, so it outlives the steering file. @param {string} root @param {Job} job */
export function isOff(root, job) {
  if (existsSync(join(root, "off", job.session))) return true;
  if (!job.steering) return false;
  const steering = readJson(join(dirname(root), "sessions", job.steering)), ledger = record(steering?.ledger);
  if (ledger?.captureOff !== true && ledger?.off !== true) return false;
  writePrivate(join(root, "off", job.session), "");
  return true;
}

/** Nothing from an off-the-record session leaves: its jobs, copies and unsent items are deleted, and if anything was sent, a
 * forget entry asks OrgSync to erase the session's pending items. @param {string} root @param {string} session @param {string} surface @param {number} now */
export function purgeSession(root, session, surface, now) {
  for (const folder of ["jobs", "spool", "work"]) for (const name of list(join(root, folder))) if (name.startsWith(`${session}.`)) rmSync(join(root, folder, name), { recursive: true, force: true });
  for (const name of list(join(root, "outbox"))) if (name.startsWith(`${session}.`) && name !== `${session}.forget.json`) rmSync(join(root, "outbox", name), { force: true });
  const forget = join(root, "outbox", `${session}.forget.json`);
  if (readLedger(root, session).sent && !existsSync(forget)) writePrivate(forget, { version: 1, kind: "forget", surface, session, createdAt: new Date(now).toISOString() });
}

/** @param {string} dir */
function list(dir) { try { return readdirSync(dir); } catch { return []; } }
/** @param {string} path @param {number} now */
function age(path, now) { try { return now - statSync(path).mtimeMs; } catch { return Infinity; } }
/** The local pause's end in seconds since 1970, or NaN. @param {string} root */
function pausedUntil(root) { try { return Number(readFileSync(join(root, "paused"), "utf8").trim()) || NaN; } catch { return NaN; } }

/** Deletes what has outlived its use: transcript copies, jobs and work folders after 24 hours, submit entries after 24 hours,
 * forget entries after 7 days, ledgers and off markers after 30 days, stale locks after 10 minutes. @param {string} root @param {number} now */
export function sweep(root, now) {
  for (const folder of ["spool", "jobs", "work"]) for (const name of list(join(root, folder))) if (age(join(root, folder, name), now) > LIMITS.spoolMs) rmSync(join(root, folder, name), { recursive: true, force: true });
  for (const name of list(join(root, "outbox"))) {
    const path = join(root, "outbox", name), entry = readJson(path), created = Date.parse(String(entry?.createdAt));
    const limit = entry?.kind === "forget" ? LIMITS.forgetMs : LIMITS.submitMs;
    if (!entry || !Number.isFinite(created) || now - created > limit || age(path, now) > limit) rmSync(path, { force: true });
  }
  for (const folder of ["ledger", "off"]) for (const name of list(join(root, folder))) if (age(join(root, folder, name), now) > LIMITS.ledgerMs) rmSync(join(root, folder, name), { force: true });
  for (const name of list(join(root, "locks"))) if (age(join(root, "locks", name), now) > LIMITS.lockMs) rmSync(join(root, "locks", name), { recursive: true, force: true });
  try {
    const lines = readFileSync(join(root, "notes.log"), "utf8").split("\n").filter(Boolean);
    if (lines.length > LIMITS.notes) writePrivate(join(root, "notes.log"), `${lines.slice(-LIMITS.notes).join("\n")}\n`);
  } catch { /* no notes yet */ }
}

/** Waits until the file's size and time have held for `stableMs` (the transcript is written asynchronously and may lag).
 * @param {string} path @param {number} stableMs */
export async function waitStable(path, stableMs) {
  const started = Date.now();
  let last = statSync(path), since = Date.now();
  while (Date.now() - started < LIMITS.stableMaxMs) {
    if (Date.now() - since >= stableMs) return true;
    await sleep(Math.max(10, Math.min(250, stableMs / 4)));
    const now = statSync(path);
    if (now.size !== last.size || now.mtimeMs !== last.mtimeMs) { last = now; since = Date.now(); }
  }
  return false;
}

/** The transcript from a byte offset, at most the newest 8 MiB, starting on a whole line. @param {string} path @param {number} offset */
function readFrom(path, offset) {
  const size = statSync(path).size;
  // A shorter file than the offset is another file (or a rewritten one): read it from the start.
  let start = offset > size ? 0 : offset;
  const skipped = size - start > LIMITS.maxReadBytes;
  if (skipped) start = size - LIMITS.maxReadBytes;
  const buffer = Buffer.alloc(size - start), fd = openSync(path, "r");
  try { readSync(fd, buffer, 0, buffer.length, start); } finally { closeSync(fd); }
  if (!skipped) return { text: buffer.toString("utf8"), start };
  const newline = buffer.indexOf(10);
  return { text: buffer.subarray(newline + 1).toString("utf8"), start: start + newline + 1 };
}

/** Runs the extractor in its folder with the prompt on stdin; a mock replaces it through ORGSYNC_CAPTURE_EXTRACT_CMD (run by
 * /bin/sh). Its answer is answer.txt when it wrote one, else what it printed. @param {Job} job @param {string} cwd */
export function runExtractor(job, cwd) {
  const custom = process.env.ORGSYNC_CAPTURE_EXTRACT_CMD;
  const model = job.model ?? (/^[a-z0-9][a-z0-9.-]{0,39}$/.test(process.env.ORGSYNC_CAPTURE_MODEL ?? "") ? String(process.env.ORGSYNC_CAPTURE_MODEL) : "sonnet");
  // Codex's extractor runs only when every MCP server the person has can be switched off by name.
  const servers = custom || job.surface !== "codex" ? [] : codexServers();
  if (servers === null) return Promise.resolve({ ok: false, answer: "" });
  const [command = "", ...args] = custom ? ["/bin/sh", "-c", custom] : job.surface === "codex" ? EXTRACT_COMMANDS.codex(servers) : EXTRACT_COMMANDS.claude_code(model);
  return /** @type {Promise<{ ok: boolean, answer: string }>} */ (new Promise(resolve => {
    const input = openSync(join(cwd, "prompt.txt"), "r");
    let output = "", done = false;
    const finish = (/** @type {boolean} */ ok) => {
      if (done) return;
      done = true; clearTimeout(timer); closeSync(input);
      const file = join(cwd, "answer.txt");
      const answer = existsSync(file) ? readFileSync(file, "utf8").slice(0, LIMITS.maxAnswerBytes) : output;
      resolve({ ok, answer });
    };
    const child = spawn(command, args, { cwd, stdio: [input, "pipe", "ignore"], env: { ...process.env, ORGSYNC_CAPTURE_CHILD: "1", ORGSYNC_CAPTURE_SURFACE: job.surface } });
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(false); }, LIMITS.extractTimeoutMs);
    child.stdout?.on("data", chunk => { if (output.length < LIMITS.maxAnswerBytes) output += String(chunk); });
    child.on("error", () => finish(false));
    child.on("close", code => finish(code === 0));
  }));
}

/** Titles the extractor and the duplicate check must not repeat: current decisions from the steering index this computer keeps,
 * the person's unsent items and recent captures from other sessions, and this session's earlier captures.
 * @param {string} root @param {Job} job @param {number} now */
function knownTitles(root, job, now) {
  const index = readJson(join(dirname(root), "index.json"));
  const decisionTitles = [...job.decisionTitles, ...(Array.isArray(index?.entries) ? index.entries.map(entry => record(entry)?.title).filter(title => typeof title === "string") : [])];
  const queuedTitles = [...job.queuedTitles];
  for (const name of list(join(root, "outbox"))) {
    const entry = readJson(join(root, "outbox", name));
    // This session's own unsent items are its earlier captures, in its ledger.
    if (entry?.kind === "submit" && entry.session !== job.session && typeof entry.arguments?.title === "string") queuedTitles.push(entry.arguments.title);
  }
  for (const name of list(join(root, "ledger"))) {
    if (name === `${job.session}.json`) continue;
    const other = readJson(join(root, "ledger", name));
    if (other && now - Date.parse(String(other.updatedAt)) <= 7 * DAY) queuedTitles.push(...titles(other.titles));
  }
  return { decisionTitles: decisionTitles.slice(0, 1_000), queuedTitles: queuedTitles.slice(-200), earlierTitles: [...job.earlierTitles, ...readLedger(root, job.session).titles] };
}

/** @param {Record<string, number>} counts */
const tally = counts => Object.entries(counts).map(([reason, count]) => `${reason}:${count}`).join(",") || "none";

/** One job, under its session's lock. Returns a content-free outcome word. @param {string} root @param {Job} job @param {{ now: number, stableMs: number }} options */
export async function processJob(root, job, options) {
  const { now } = options, short = job.session.slice(0, 12), jobFile = join(root, "jobs", `${job.id}.json`), work = join(root, "work", job.id);
  const spool = join(root, "spool", `${job.id}.jsonl`), ledger = readLedger(root, job.session);
  const cleanup = () => { for (const path of [jobFile, spool, work]) rmSync(path, { recursive: true, force: true }); };
  const saveLedger = (/** @type {Partial<typeof ledger>} */ change) =>
    writePrivate(join(root, "ledger", `${job.session}.json`), { ...ledger, surface: job.surface, ...change, updatedAt: new Date(now).toISOString() });
  if (isOff(root, job)) { purgeSession(root, job.session, job.surface, now); note(root, `${short} off_the_record`, now); return "off"; }
  const paused = pausedUntil(root);

  /** @type {string} */
  let source = "", nextOffset = ledger.offset;
  if (job.surface === "codex") {
    if (!existsSync(spool)) {
      if (job.linked || !job.source) { cleanup(); note(root, `${short} skip transcript_missing`, now); return "missing"; }
      try { copyFileSync(job.source, spool); } catch { cleanup(); note(root, `${short} skip transcript_missing`, now); return "missing"; }
      note(root, `${short} copied_transcript`, now);
    }
    if (!(await waitStable(spool, options.stableMs))) note(root, `${short} transcript_still_growing`, now);
    if (Number.isFinite(paused) && paused * 1000 > now) {
      saveLedger({ offset: statSync(spool).size }); cleanup(); note(root, `${short} paused`, now); return "paused";
    }
    const read = readFrom(spool, Math.max(job.offset, ledger.offset));
    const redacted = redactCodexJsonl(read.text, 0);
    if (redacted.text === null) { cleanup(); note(root, `${short} skip unknown_format`, now); return "unknown_format"; }
    source = redacted.text; nextOffset = read.start + redacted.nextOffset;
  } else {
    if (Number.isFinite(paused) && paused * 1000 > now) { cleanup(); note(root, `${short} paused`, now); return "paused"; }
    try { source = readFileSync(join(work, "source.txt"), "utf8"); } catch { cleanup(); note(root, `${short} skip job_incomplete`, now); return "incomplete"; }
  }
  if (!source.trim()) { saveLedger({ offset: nextOffset }); cleanup(); return "empty"; }
  if (ledger.drafts.length >= LIMITS.perSession) { saveLedger({ offset: nextOffset }); cleanup(); note(root, `${short} session_limit`, now); return "session_limit"; }

  const known = knownTitles(root, job, now);
  mkdirSync(work, { recursive: true, mode: 0o700 });
  if (!existsSync(join(work, "prompt.txt"))) writePrivate(join(work, "prompt.txt"), extractPrompt({ transcript: source, ...known }));
  // Off the record may be set at any moment: checked again before the extractor and before anything reaches the outbox.
  if (isOff(root, job)) { purgeSession(root, job.session, job.surface, now); note(root, `${short} off_the_record`, now); return "off"; }
  const extracted = await runExtractor(job, work);
  if (!extracted.ok) { cleanup(); note(root, `${short} skip extract_failed`, now); return "extract_failed"; }
  if (isOff(root, job)) { purgeSession(root, job.session, job.surface, now); note(root, `${short} off_the_record`, now); return "off"; }

  const result = submissionsFromAnswer({ answer: extracted.answer, source, surface: job.surface, extractor: EXTRACTORS[job.surface], trigger: job.trigger,
    session: job.session, date: job.createdAt, ...known });
  const room = Math.max(0, LIMITS.perSession - ledger.drafts.length), submissions = result.submissions.slice(0, room);
  for (const args of submissions) {
    writePrivate(join(root, "outbox", `${job.session}.${args.idempotencyKey.slice(5, 21)}.json`),
      { version: 1, kind: "submit", surface: job.surface, session: job.session, createdAt: new Date(now).toISOString(), arguments: args });
  }
  saveLedger({ offset: nextOffset, titles: [...ledger.titles, ...submissions.map(args => args.title)].slice(-50),
    drafts: [...ledger.drafts, ...submissions.map(args => ({ key: args.idempotencyKey, draftId: null, at: new Date(now).toISOString() }))] });
  cleanup();
  /** @type {Record<string, number>} */
  const reasons = {};
  for (const dropped of result.dropped) reasons[dropped.reason] = (reasons[dropped.reason] ?? 0) + 1;
  note(root, `${short} ${job.surface} ${job.trigger} extracted=${result.extracted} kept=${submissions.length} dropped=${tally(reasons)}`, now);
  return "done";
}

/** Takes the session's lock, a directory, or reports that another worker holds it. @param {string} root @param {string} session @param {number} now */
function lock(root, session, now) {
  const path = join(root, "locks", session);
  try { mkdirSync(path, { mode: 0o700 }); return true; } catch { /* held */ }
  if (age(path, now) <= LIMITS.lockMs) return false;
  rmSync(path, { recursive: true, force: true });
  try { mkdirSync(path, { mode: 0o700 }); return true; } catch { return false; }
}

/** Every waiting job, oldest first, then the sweep; the courier after it when the person turned it on.
 * @param {string} root @param {{ now?: () => number, stableMs?: number }} [options] */
export async function runWorker(root, options = {}) {
  if (!root || !existsSync(join(root, "jobs"))) return [];
  const clock = options.now ?? Date.now, stableMs = options.stableMs ?? (Number(process.env.ORGSYNC_CAPTURE_STABLE_MS) || LIMITS.stableMs);
  ensureDirs(root);
  sweep(root, clock());
  /** @type {string[]} */
  const outcomes = [];
  for (const name of list(join(root, "jobs")).filter(file => file.endsWith(".json") && !file.endsWith(".answered.json")).sort()) {
    const job = readJob(root, name);
    if (!job) { rmSync(join(root, "jobs", name), { force: true }); note(root, "skip job_invalid", clock()); outcomes.push("invalid"); continue; }
    if (!lock(root, job.session, clock())) { outcomes.push("locked"); continue; }
    try { outcomes.push(await processJob(root, job, { now: clock(), stableMs })); }
    catch { rmSync(join(root, "jobs", name), { force: true }); note(root, `${job.session.slice(0, 12)} skip worker_error`, clock()); outcomes.push("error"); }
    finally { rmSync(join(root, "locks", job.session), { recursive: true, force: true }); }
  }
  if (process.env.ORGSYNC_CAPTURE_COURIER === "1") {
    const { runCourier } = await import("./courier.mjs");
    await runCourier(root, { now: clock() }).catch(() => note(root, "skip courier_error", clock()));
  }
  return outcomes;
}

if (process.argv[1]?.endsWith("capture-worker.mjs")) runWorker(process.argv[2] ?? "").catch(() => {}).finally(() => { process.exitCode = 0; });
