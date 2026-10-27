// @ts-check
// D-195 capture on the person's side: one extraction run's items through the gate and the duplicate check, into `submitDraft`'s
// arguments, and the one indicator line. The Claude Code mod, the capture worker and the dry-run tool share these, so every
// surface submits the same shape. Only gated items become arguments, and an argument carries only the item's own text.
import { captureIdempotencyKey, isCaptureSession } from "./capture-session.js";
import { CAPTURED_LIMITS, GATE_VERSION, HELP_AREAS, THRESHOLDS, DEFAULT_THRESHOLD, dedupeItems, gateReason } from "./gate.js";
import { parseExtraction } from "./extract-prompt.js";
import { emptyLedger, recordMarker } from "./budget.js";
import { turnText } from "./redact.js";

/** The surfaces this package captures from, with the words its items' origin and intent use. Never a path or a session id. */
export const SURFACE_LABELS = Object.freeze(/** @type {Record<string, string>} */ ({ claude_code: "Claude Code", codex: "Codex" }));
export const CAPTURE_TRIGGERS = Object.freeze(["pre_compact", "session_end", "idle"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Oct 2026", in the computer's own time zone. @param {Date} date */
const dayLabel = date => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
/** @param {string} text */
const flat = text => text.replace(/\s+/g, " ").trim();

/** The fixed phrase a captured item's `captureIntent` carries for its surface. @param {string} surface */
export const captureIntentFor = surface => `Suggested from a ${SURFACE_LABELS[surface] ?? "work"} session`;
/** "Claude Code session, 26 Oct 2026". @param {string} surface @param {Date} date */
export const sourceOriginFor = (surface, date) => `${SURFACE_LABELS[surface] ?? "Work"} session, ${dayLabel(date)}`;

/**
 * `submitDraft`'s arguments for one gated item, as the OrgSync MCP tool takes them. `audience` and `approvalRequest` are the
 * server's to set (the tool always saves a private draft), so they are not sent. A way of working carries its classification
 * when it names an area, as the contract requires.
 * @param {import("./gate.js").CaptureItem} item
 * @param {{ surface: string, extractor: string, trigger: string, session: string, date: Date | string | number }} context
 */
export function toSubmission(item, context) {
  if (!SURFACE_LABELS[context.surface] || !CAPTURE_TRIGGERS.includes(context.trigger) || !isCaptureSession(context.session) ||
    !/^[a-z0-9][a-z0-9.-]{0,39}$/.test(context.extractor)) throw new TypeError("capture_context_invalid");
  const title = flat(item.title), summary = item.summary.trim(), excerpts = item.excerpts.slice(0, CAPTURED_LIMITS.maxExcerpts).map(text => ({ text: text.trim() }));
  const area = typeof item.area === "string" && HELP_AREAS.includes(item.area) ? item.area : null;
  return {
    idempotencyKey: captureIdempotencyKey(context.session, { title, summary }),
    title,
    summary,
    excerpts,
    sourceOrigin: sourceOriginFor(context.surface, new Date(context.date)),
    captureIntent: captureIntentFor(context.surface),
    ...(area ? { area } : {}),
    ...(area && item.kind === "way_of_working" ? { classification: "way_of_working" } : {}),
    capture: { session: context.session, surface: context.surface, extractor: context.extractor, trigger: context.trigger, gate: GATE_VERSION }
  };
}

/**
 * One run's items: the gate, then the duplicate check, then at most five, clearest first as the extractor ordered them. Each
 * dropped item names its index in `items` and a fixed reason.
 * @param {readonly unknown[]} items
 * @param {{ source: string | null | undefined, extractor?: string, threshold?: number, decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} options
 * @returns {{ kept: import("./gate.js").CaptureItem[], dropped: import("./gate.js").Dropped[] }}
 */
export function captureRun(items, options) {
  const threshold = options.threshold ?? (options.extractor ? THRESHOLDS[options.extractor] : undefined) ?? DEFAULT_THRESHOLD;
  /** @type {{ item: import("./gate.js").CaptureItem, index: number }[]} */
  const passed = [];
  /** @type {import("./gate.js").Dropped[]} */
  const dropped = [];
  items.forEach((item, index) => {
    const reason = gateReason(item, { source: options.source, threshold });
    if (reason) dropped.push({ index, reason });
    else passed.push({ item: /** @type {import("./gate.js").CaptureItem} */ (item), index });
  });
  const unique = dedupeItems(passed.map(entry => entry.item), options);
  for (const entry of unique.dropped) dropped.push({ index: passed[entry.index]?.index ?? -1, reason: entry.reason });
  const kept = passed.filter((_, index) => !unique.dropped.some(entry => entry.index === index));
  for (const entry of kept.slice(CAPTURED_LIMITS.perRun)) dropped.push({ index: entry.index, reason: "run_limit" });
  return { kept: kept.slice(0, CAPTURED_LIMITS.perRun).map(entry => entry.item), dropped: dropped.sort((a, b) => a.index - b.index) };
}

/**
 * From an extractor's raw answer to `submitDraft` arguments in one call: parse, gate, deduplicate, cap. The mod uses it on what
 * the worker left when it had no Node to gate with, and the worker uses it on what it extracted itself.
 * @param {{ answer: string, source: string, surface: string, extractor: string, trigger: string, session: string, date: Date | string | number,
 *   decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} input
 */
export function submissionsFromAnswer(input) {
  const items = parseExtraction(input.answer);
  const run = captureRun(items, { ...input, source: input.source });
  return { submissions: run.kept.map(item => toSubmission(item, input)), extracted: items.length, dropped: run.dropped };
}

/**
 * Whether any of the person's own turns in `$.session.messages()` put the session off the record, said not to save it or asked to
 * forget it (local/budget.js's words), so a resumed or forked session keeps it even under a new id (D-195: sticky for the whole
 * session). Text the app or OrgSync's mod injected, such as a skill a command loaded, is not the person's and is skipped.
 * @param {readonly { role?: unknown, text?: unknown }[]} messages
 */
export function offTheRecordIn(messages) {
  let ledger = emptyLedger();
  for (const message of messages) if (message && message.role === "user" && typeof message.text === "string") ledger = recordMarker(ledger, turnText(message.text));
  return ledger.captureOff === true;
}

/** @param {Date} date @param {number} now */
function untilLabel(date, now) {
  const hours = String(date.getHours()).padStart(2, "0"), minutes = String(date.getMinutes()).padStart(2, "0");
  return date.getTime() - now < 24 * 3_600_000 ? `${hours}:${minutes}` : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * The one indicator line (plan B2 §4.6) from a `status` or picture `capture` block and this computer's own state: the session's
 * off-the-record marker, a local pause, and items that could not reach OrgSync. An empty string shows nothing.
 * @param {{ capture?: { company?: string, you?: string, pausedUntil?: string | null } | null, off?: boolean, pausedUntil?: number | null,
 *   unsent?: boolean, now?: number }} state
 */
export function captureLine(state) {
  const now = state.now ?? Date.now();
  if (state.off) return "Off the record";
  const you = state.capture?.you;
  if (you !== "on" && you !== "paused" && you !== "needs_notice") return "";
  const local = typeof state.pausedUntil === "number" && state.pausedUntil > now ? state.pausedUntil : null;
  const server = you === "paused" && state.capture?.pausedUntil ? Date.parse(state.capture.pausedUntil) : NaN;
  const until = Math.max(local ?? 0, Number.isFinite(server) && server > now ? server : 0);
  if (until) return `Paused until ${untilLabel(new Date(until), now)}`;
  if (you === "needs_notice") return "Capture waiting for your OK";
  // A pause that has ended reads as on, as the server reads it.
  return state.unsent ? "Capture couldn't reach OrgSync" : "Capture on · /orgsync:capture off";
}
