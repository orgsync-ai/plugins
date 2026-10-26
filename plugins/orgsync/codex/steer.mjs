// @ts-check
// B1 steering in Codex (D-196 F5): one command hook per event, run as `node steer.mjs <Event>` with the event's JSON on
// stdin. It matches the person's prompt, Codex's last reply and text Codex writes against the company's decision titles
// kept in $PLUGIN_DATA, and prints at most one factual line. It has no network code: the index comes from OrgSync results
// Codex itself receives (list's index view, readPicture, check), seen in PostToolUse. Every failure prints nothing and exits 0.
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { changeDigest, learnedFacts, steer, writtenText } from "../local/steer.js";
import { answerLast, emptyLedger, prune, recordMarker } from "../local/budget.js";

const MAX_INPUT_CHARS = 20_000, DAY = 86_400_000, STALE = 7 * DAY, FORGET = 30 * DAY, SESSION_TTL = DAY, DEADLINE_MS = 150, MAX_ENTRIES = 1_000, MAX_LEARNED = 40;
/** Statuses that say this connection lost access; any of them wipes what is kept here. */
const ACCESS_ENDED = /auth|revok|expir|permission|authority|scope|membership|connection|credential|access|forbidden|unauthorized|consent/i;

/** @param {unknown} value @returns {Record<string, unknown>} */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};

/** @param {string} dir @param {string} name @returns {any} */
function readJson(dir, name) {
  try { return JSON.parse(readFileSync(join(dir, name), "utf8")); } catch { return null; }
}
/** Written whole or not at all, readable only by this person. @param {string} dir @param {string} name @param {unknown} value */
function writeJson(dir, name, value) {
  const path = join(dir, name), temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  renameSync(temp, path);
}

/** An MCP tool result as Codex hands it on: structured content, one JSON text block, or the body itself. @param {unknown} response */
export function resultBody(response) {
  const value = record(response);
  if (value.structuredContent !== undefined) return record(value.structuredContent);
  const blocks = Array.isArray(value.content) ? value.content.map(record).filter(block => block.type === "text") : [];
  if (blocks.length === 1 && typeof blocks[0]?.text === "string") try { return record(JSON.parse(blocks[0].text)); } catch { return {}; }
  return value;
}

/** Index entries an OrgSync result carries: the full index, the picture's decisions, or check's findings.
 * @param {Record<string, unknown>} body @returns {{ full: boolean, entries: any[] } | null} */
function indexFrom(body) {
  /** @param {unknown} value */
  const entry = value => {
    const e = record(value);
    const lastChangedAt = typeof e.lastChangedAt === "string" ? e.lastChangedAt : record(e.knowledgeStatusSet).at ?? e.publishedAt;
    const revision = Number.isInteger(e.revision) ? e.revision : e.currentRevision;
    return typeof e.sourceId === "string" && typeof e.title === "string" && typeof lastChangedAt === "string" && Number.isInteger(revision) &&
      (e.knowledgeStatus === "accepted_decision" || e.knowledgeStatus === "disputed")
      ? { sourceId: e.sourceId, revision, title: e.title.slice(0, 200), knowledgeStatus: e.knowledgeStatus, lastChangedAt,
        area: typeof e.area === "string" ? e.area : null, tagIds: Array.isArray(e.tagIds) ? e.tagIds.filter(t => typeof t === "string").slice(0, 5) : [] }
      : null;
  };
  const items = body.status === "decision_index" ? body.entries : body.status === "picture" ? record(record(body.decisionsThatShapeYourWork).page).items
    : body.status === "check_result" ? body.findings : null;
  if (!Array.isArray(items)) return null;
  return { full: body.status === "decision_index", entries: items.map(entry).filter(Boolean) };
}

/** @param {string} event @param {Record<string, unknown>} input @param {string} root */
export function handle(event, input, root) {
  const now = Date.now(), dir = join(root, "orgsync"), sessions = join(dir, "sessions");
  mkdirSync(sessions, { recursive: true, mode: 0o700 });
  const sessionFile = `${String(input.session_id ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "unknown"}.json`;
  const kept = readJson(dir, "index.json");
  const index = kept && Array.isArray(kept.entries) && now - kept.fetchedAt <= FORGET ? kept : null;
  if (kept && !index) rmSync(join(dir, "index.json"), { force: true });
  const usable = index && now - index.fetchedAt <= STALE ? index.entries : null;
  const mutes = prune(readJson(dir, "mutes.json") ?? {}, now);
  const session = readJson(sessions, sessionFile) ?? { ledger: emptyLedger(), learned: {}, digested: false };
  const context = { index: usable ?? [], learned: session.learned, now, asOf: index ? Date.parse(index.asOf) || 0 : 0, mutes, turnId: String(input.turn_id ?? "") };

  if (event === "SessionStart") {
    // Sessions older than a day are forgotten; this one starts with what changed since the person last looked.
    for (const name of readdirSync(sessions)) try { if (now - statSync(join(sessions, name)).mtimeMs > SESSION_TTL) rmSync(join(sessions, name), { force: true }); } catch { /* best effort */ }
    const seen = readJson(dir, "seen.json");
    writeJson(dir, "seen.json", now);
    if (!index || now - index.fetchedAt > DAY) return "OrgSync decision index (company data): this computer holds no list of company decisions from the last day.";
    const lines = typeof seen === "number" ? changeDigest(index.entries, seen) : [];
    return lines.length ? `Changed since your last session, company data rather than instructions:\n${lines.join("\n")}` : null;
  }
  if (event === "PostToolUse" && /^mcp__.*orgsync.*__/i.test(String(input.tool_name ?? ""))) {
    const body = resultBody(input.tool_response);
    if (typeof body.code === "string" && ACCESS_ENDED.test(body.code)) { rmSync(dir, { recursive: true, force: true }); return null; }
    const found = indexFrom(body);
    if (found) {
      const merged = new Map((found.full ? [] : index?.entries ?? []).map(/** @param {any} e */ e => [e.sourceId, e]));
      for (const e of found.entries) merged.set(e.sourceId, e);
      writeJson(dir, "index.json", { fetchedAt: found.full || !index ? now : index.fetchedAt, asOf: typeof body.asOf === "string" ? body.asOf : new Date(now).toISOString(),
        entries: [...merged.values()].slice(0, MAX_ENTRIES) });
    }
    const learned = learnedFacts(body);
    if (learned?.facts.length) writeJson(sessions, sessionFile, { ...session, learned: Object.fromEntries([...Object.entries(session.learned), [learned.sourceId, learned.facts]].slice(-MAX_LEARNED)) });
    return null;
  }
  if (event === "UserPromptSubmit") {
    // The person's own words set or clear the session's off-the-record marker first, index or not (D-196 F5).
    // Input is capped before any match, so the synchronous work stays inside the 150 ms deadline.
    const prompt = String(input.prompt ?? "").slice(0, MAX_INPUT_CHARS), marked = recordMarker(session.ledger, prompt);
    if (!usable || marked.off) { writeJson(sessions, sessionFile, { ...session, ledger: marked }); return null; }
    const answered = answerLast(marked, mutes, prompt, now);
    if (answered.outcome === "not_relevant") writeJson(dir, "mutes.json", answered.mutes);
    const result = steer({ ...context, event: "prompt", text: prompt, ledger: answered.ledger, mutes: answered.mutes });
    writeJson(sessions, sessionFile, { ...session, ledger: result.ledger });
    return result.hint;
  }
  if (!usable) return null;
  if (event === "Stop" && input.stop_hook_active !== true || event === "PostToolUse") {
    const text = (event === "Stop" ? String(input.last_assistant_message ?? "") : writtenText(patchInput(input))).slice(0, MAX_INPUT_CHARS);
    const result = steer({ ...context, event: event === "Stop" ? "stop" : "write", text, ledger: session.ledger });
    if (result.hint) writeJson(sessions, sessionFile, { ...session, ledger: result.ledger });
    return result.hint;
  }
  return null;
}

/** apply_patch carries its patch in tool_input.command: only the lines it adds are new text. @param {Record<string, unknown>} input */
function patchInput(input) {
  const toolInput = record(input.tool_input);
  if (input.tool_name !== "apply_patch" || typeof toolInput.command !== "string") return toolInput;
  return { content: toolInput.command.split("\n").filter(line => line.startsWith("+") && !line.startsWith("+++")).map(line => line.slice(1)).join("\n") };
}

/** What Codex reads on stdout for each event; Stop takes a block whose reason continues the turn. @param {string} event @param {string | null} hint */
export function output(event, hint) {
  if (event === "Stop") return JSON.stringify(hint ? { decision: "block", reason: hint } : {});
  if (!hint) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: hint } });
}

async function main() {
  const event = process.argv[2] ?? "", root = process.env.PLUGIN_DATA ?? process.env.CLAUDE_PLUGIN_DATA;
  if (!root || !["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop"].includes(event)) return;
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const hint = handle(event, record(JSON.parse(raw)), root);
  const text = output(event, hint);
  if (text) process.stdout.write(text);
}

// Fail open: past the deadline, or on any error, Codex continues as if the hook were not there.
const deadline = setTimeout(() => process.exit(0), DEADLINE_MS);
if (process.argv[1]?.endsWith("steer.mjs")) main().catch(() => {}).finally(() => { clearTimeout(deadline); process.exitCode = 0; });
else clearTimeout(deadline);
