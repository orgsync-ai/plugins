// D-195 capture worker and Codex courier (plan B2 §4.5 steps 3-8, §11 hook package). Run with node --test. Extraction and the
// courier are mocks (ORGSYNC_CAPTURE_EXTRACT_CMD, ORGSYNC_CAPTURE_COURIER_CMD): no model runs and nothing reaches OrgSync.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { captureSession } from "../local/capture-session.js";
import { submissionsFromAnswer, toSubmission } from "../local/capture.js";
import { EXTRACT_COMMANDS, LIMITS, codexServers, mcpOff, runWorker, sweep } from "./capture-worker.mjs";
import { callHash, checkCall, courierCommand, runCourier } from "./courier.mjs";

const here = dirname(fileURLToPath(import.meta.url)), pluginRoot = dirname(here);
const SID = "0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000", SESSION = captureSession(SID);
const DECISION = "Refunds are allowed within 14 days of purchase on every plan.";
const message = (role, text) => JSON.stringify({ timestamp: "2026-10-26T13:00:00.000Z", type: "response_item",
  payload: { type: "message", role, content: [{ type: role === "user" ? "input_text" : "output_text", text }] } });
const TRANSCRIPT = [JSON.stringify({ timestamp: "2026-10-26T13:00:00.000Z", type: "session_meta", payload: { id: SID } }),
  message("user", `Confirmed. ${DECISION} My key is ${["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_")}.`),
  JSON.stringify({ type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: "CANARY-TOOLOUTPUT-1a2b3c4d5e" } }),
  message("assistant", "Noted.")].join("\n") + "\n";
const item = (title, summary, overrides = {}) => ({ title, summary, excerpts: [summary], kind: "rule", area: null, confidence: 0.9, sensitive: "none", decided: "confirmed", scope: "company", ...overrides });
const REFUNDS = item("Refunds within 14 days of purchase", DECISION);
const answer = (...items) => JSON.stringify({ items });
const CHECK = JSON.parse(readFileSync(join(pluginRoot, "codex", "hooks.json"), "utf8")).hooks.PreToolUse[0].hooks[0].command;

function setup() {
  const base = mkdtempSync(join(tmpdir(), "orgsync-capture-worker-")), data = join(base, "data"), root = join(data, "orgsync", "capture");
  for (const name of ["jobs", "spool", "work", "outbox", "ledger", "off", "locks"]) mkdirSync(join(root, name), { recursive: true, mode: 0o700 });
  mkdirSync(join(data, "orgsync", "sessions"), { recursive: true });
  const transcript = join(base, "rollout.jsonl");
  writeFileSync(transcript, TRANSCRIPT);
  return { base, data, root, transcript, answerFile: join(base, "answer.json"), promptCopy: join(base, "prompt.txt"), envCopy: join(base, "env.txt") };
}
/** The mock extractor: keeps what it was given and its recursion guard, and prints a fixed answer. */
function mockExtractor(t, text, before = "") {
  writeFileSync(t.answerFile, text);
  process.env.ORGSYNC_CAPTURE_EXTRACT_CMD = `${before}cat > "${t.promptCopy}"; printf %s "$ORGSYNC_CAPTURE_CHILD" > "${t.envCopy}"; cat "${t.answerFile}"`;
}
let stamp = 0;
function codexJob(t, overrides = {}) {
  const id = `${SESSION}.20261026T1300${String(stamp++).padStart(2, "0")}Z.1`;
  linkSync(t.transcript, join(t.root, "spool", `${id}.jsonl`));
  writeFileSync(join(t.root, "jobs", `${id}.json`), JSON.stringify({ version: 1, surface: "codex", session: SESSION, trigger: "session_end", offset: 0, linked: true,
    source: "", steering: `${SID}.json`, createdAt: "2026-10-26T13:05:00.000Z", ...overrides }));
  return id;
}
const outbox = t => readdirSync(join(t.root, "outbox")).sort();
const readOutbox = (t, name) => JSON.parse(readFileSync(join(t.root, "outbox", name), "utf8"));
const ledger = t => JSON.parse(readFileSync(join(t.root, "ledger", `${SESSION}.json`), "utf8"));
const notes = t => existsSync(join(t.root, "notes.log")) ? readFileSync(join(t.root, "notes.log"), "utf8") : "";
const run = t => runWorker(t.root, { stableMs: 20 });
const clean = t => rmSync(t.base, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });

test("mocked extraction end to end: only gated arguments reach the outbox, the copies are deleted, the ledger is kept", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS, item("Sam's sick leave", DECISION), item("Proposal only", DECISION, { decided: "proposed" })));
  const id = codexJob(t);
  assert.deepEqual(await run(t), ["done"]);
  const [name] = outbox(t);
  const entry = readOutbox(t, name);
  const expected = toSubmission(REFUNDS, { surface: "codex", extractor: "codex-1", trigger: "session_end", session: SESSION, date: "2026-10-26T13:05:00.000Z" });
  assert.deepEqual({ ...entry, createdAt: "x" }, { version: 1, kind: "submit", surface: "codex", session: SESSION, createdAt: "x", arguments: expected });
  assert.equal(name, `${SESSION}.${expected.idempotencyKey.slice(5, 21)}.json`);
  assert.doesNotMatch(readFileSync(join(t.root, "outbox", name), "utf8"), /CANARY|sk_live|Noted/);
  // The extractor read the redacted text: the decision, never the tool output or the key, and ran as a capture child.
  const prompt = readFileSync(t.promptCopy, "utf8");
  assert.match(prompt, /Refunds are allowed within 14 days/);
  assert.doesNotMatch(prompt, /CANARY|sk_live/);
  assert.equal(readFileSync(t.envCopy, "utf8"), "1");
  assert.deepEqual([existsSync(join(t.root, "spool", `${id}.jsonl`)), existsSync(join(t.root, "work", id)), existsSync(join(t.root, "jobs", `${id}.json`))], [false, false, false]);
  assert.equal(statSync(t.transcript).nlink, 1);
  assert.deepEqual({ ...ledger(t), updatedAt: "x", drafts: ledger(t).drafts.map(d => ({ ...d, at: "x" })) }, { version: 1, session: SESSION, surface: "codex",
    offset: Buffer.byteLength(TRANSCRIPT), titles: [REFUNDS.title], drafts: [{ key: expected.idempotencyKey, draftId: null, at: "x" }], sent: false, updatedAt: "x" });
  assert.match(notes(t), /codex session_end extracted=3 kept=1 dropped=(not_confirmed:1,topic_health:1|topic_health:1,not_confirmed:1)/);
  for (const folder of ["outbox", "ledger", "jobs", "spool"]) assert.equal(statSync(join(t.root, folder)).mode & 0o777, 0o700);
  assert.equal(statSync(join(t.root, "outbox", name)).mode & 0o777, 0o600);
  assert.equal(statSync(join(t.root, "ledger", `${SESSION}.json`)).mode & 0o777, 0o600);
  clean(t);
});

test("reads only what is new since the last offset, tells the extractor what it captured, and drops the same item again", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS));
  codexJob(t);
  await run(t);
  const added = message("user", `Confirmed. Support replies to every ticket within one business day. As before: ${DECISION}`);
  appendFileSync(t.transcript, `${added}\n${JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "half" }] } })}`);
  const SUPPORT = item("Support replies within one business day", "Support replies to every ticket within one business day.");
  mockExtractor(t, answer(REFUNDS, SUPPORT));
  codexJob(t, { offset: Buffer.byteLength(TRANSCRIPT) });
  await run(t);
  const prompt = readFileSync(t.promptCopy, "utf8");
  assert.match(prompt, /Already captured from this conversation \(do not repeat\):\n- "Refunds within 14 days of purchase"/);
  assert.doesNotMatch(prompt.slice(prompt.indexOf("BEGIN CONVERSATION")), /My key|Noted/);
  // The line still being written waits for the next run.
  assert.doesNotMatch(prompt, /half/);
  assert.equal(outbox(t).length, 2);
  assert.equal(ledger(t).offset, Buffer.byteLength(`${TRANSCRIPT}${added}\n`));
  assert.match(notes(t), /kept=1 dropped=duplicate_earlier:1/);
  clean(t);
});

test("skips an unknown transcript format with one note and keeps the offset", async () => {
  const t = setup();
  writeFileSync(t.transcript, '{"kind":"chat","text":"We decided refunds are 14 days."}\n');
  mockExtractor(t, answer(REFUNDS));
  codexJob(t);
  assert.deepEqual(await run(t), ["unknown_format"]);
  assert.deepEqual(outbox(t), []);
  assert.equal(existsSync(t.promptCopy), false);
  assert.match(notes(t), /skip unknown_format/);
  assert.equal(existsSync(join(t.root, "ledger", `${SESSION}.json`)), false);
  clean(t);
});

test("off the record during extraction keeps nothing; set before the run, it purges the session and queues a forget once sent", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS), `: > "${join(t.root, "off", SESSION)}"; `);
  codexJob(t);
  assert.deepEqual(await run(t), ["off"]);
  assert.deepEqual(outbox(t), []);

  const s = setup();
  writeFileSync(join(s.root, "ledger", `${SESSION}.json`), JSON.stringify({ version: 1, session: SESSION, offset: 10, titles: ["x"], drafts: [{ key: "cap1:k", draftId: "d1" }], sent: true }));
  writeFileSync(join(s.root, "outbox", `${SESSION}.0123456789abcdef.json`), JSON.stringify({ version: 1, kind: "submit", surface: "codex", session: SESSION, createdAt: new Date().toISOString(), arguments: {} }));
  writeFileSync(join(s.data, "orgsync", "sessions", `${SID}.json`), JSON.stringify({ ledger: { off: false, captureOff: true } }));
  mockExtractor(s, answer(REFUNDS));
  const id = codexJob(s);
  assert.deepEqual(await run(s), ["off"]);
  assert.deepEqual(outbox(s), [`${SESSION}.forget.json`]);
  assert.equal(readOutbox(s, `${SESSION}.forget.json`).kind, "forget");
  assert.ok(existsSync(join(s.root, "off", SESSION)));
  assert.equal(existsSync(join(s.root, "spool", `${id}.jsonl`)), false);
  assert.equal(existsSync(s.promptCopy), false);
  clean(t); clean(s);
});

test("copies the transcript when the hook could not link it, and says so", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS));
  const id = `${SESSION}.20261026T130000Z.9`;
  writeFileSync(join(t.root, "jobs", `${id}.json`), JSON.stringify({ version: 1, surface: "codex", session: SESSION, trigger: "pre_compact", offset: 0, linked: false,
    source: t.transcript, steering: `${SID}.json`, createdAt: "2026-10-26T13:05:00.000Z" }));
  assert.deepEqual(await run(t), ["done"]);
  assert.equal(outbox(t).length, 1);
  assert.match(notes(t), /copied_transcript/);
  assert.equal(existsSync(join(t.root, "spool", `${id}.jsonl`)), false);
  clean(t);
});

test("a Claude Code job from the mod: redacted text in, gated arguments out, the mod's own prompt used as written", async () => {
  const t = setup(), id = `${SESSION}.cc-1.1`;
  mkdirSync(join(t.root, "work", id));
  writeFileSync(join(t.root, "work", id, "source.txt"), `Person: Confirmed. ${DECISION}`);
  writeFileSync(join(t.root, "work", id, "prompt.txt"), "MOD PROMPT");
  writeFileSync(join(t.root, "jobs", `${id}.json`), JSON.stringify({ version: 1, surface: "claude_code", session: SESSION, trigger: "session_end", createdAt: "2026-10-26T13:05:00.000Z",
    model: "haiku", decisionTitles: ["Plans and prices"] }));
  mockExtractor(t, answer(REFUNDS));
  assert.deepEqual(await run(t), ["done"]);
  assert.equal(readFileSync(t.promptCopy, "utf8"), "MOD PROMPT");
  const [name] = outbox(t);
  assert.deepEqual(readOutbox(t, name).arguments.capture, { session: SESSION, surface: "claude_code", extractor: "cc-1", trigger: "session_end", gate: "gate-1" });
  assert.equal(readOutbox(t, name).arguments.sourceOrigin, "Claude Code session, 26 Oct 2026");
  assert.equal(existsSync(join(t.root, "work", id)), false);
  // The real command for this job: the person's own Claude Code, signed in, with no plugins, hooks, MCP or tools; the prompt is
  // on stdin. Codex's runs with every one of the person's MCP servers off.
  assert.deepEqual(EXTRACT_COMMANDS.claude_code("haiku"), ["claude", "-p", "--safe-mode", "--strict-mcp-config", "--tools", "",
    "--no-session-persistence", "--max-turns", "3", "--output-format", "json", "--model", "haiku"]);
  assert.deepEqual(EXTRACT_COMMANDS.codex(["gmail", "orgsync"]), ["codex", "exec", "--ephemeral", "-s", "read-only", "--skip-git-repo-check",
    "-c", "mcp_servers.gmail.enabled=false", "-c", "mcp_servers.orgsync.enabled=false", "--output-last-message", "answer.txt", "-"]);
  clean(t);
});

test("expires unsent items after 24 hours and forgets after 7 days, and deletes old copies, jobs and locks", () => {
  const t = setup(), now = Date.now(), iso = ms => new Date(now - ms).toISOString();
  const write = (name, kind, ms) => writeFileSync(join(t.root, "outbox", name), JSON.stringify({ version: 1, kind, surface: "codex", session: SESSION, createdAt: iso(ms) }));
  write("a.json", "submit", 25 * 3_600_000); write("b.json", "submit", 23 * 3_600_000); write("c.forget.json", "forget", 8 * LIMITS.spoolMs); write("d.forget.json", "forget", 6 * LIMITS.spoolMs);
  writeFileSync(join(t.root, "outbox", "e.json"), "not json");
  const old = (path) => utimesSync(path, (now - 25 * 3_600_000) / 1000, (now - 25 * 3_600_000) / 1000);
  writeFileSync(join(t.root, "spool", "old.jsonl"), "x"); old(join(t.root, "spool", "old.jsonl"));
  writeFileSync(join(t.root, "spool", "new.jsonl"), "x");
  writeFileSync(join(t.root, "jobs", "old.json"), "{}"); old(join(t.root, "jobs", "old.json"));
  mkdirSync(join(t.root, "locks", "stale")); utimesSync(join(t.root, "locks", "stale"), (now - 11 * 60_000) / 1000, (now - 11 * 60_000) / 1000);
  mkdirSync(join(t.root, "locks", "fresh"));
  sweep(t.root, now);
  assert.deepEqual(outbox(t), ["b.json", "d.forget.json"]);
  assert.deepEqual(readdirSync(join(t.root, "spool")), ["new.jsonl"]);
  assert.deepEqual(readdirSync(join(t.root, "jobs")), []);
  assert.deepEqual(readdirSync(join(t.root, "locks")), ["fresh"]);
  clean(t);
});

test("a held session lock leaves the job for the next run; an invalid job is deleted with a note", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS));
  codexJob(t);
  writeFileSync(join(t.root, "jobs", `${SESSION}.bad.json`), JSON.stringify({ version: 1, surface: "codex", session: "cs1_other", trigger: "session_end" }));
  mkdirSync(join(t.root, "locks", SESSION));
  assert.deepEqual(await run(t), ["locked", "invalid"]);
  assert.match(notes(t), /skip job_invalid/);
  rmSync(join(t.root, "locks", SESSION), { recursive: true });
  assert.deepEqual(await run(t), ["done"]);
  clean(t);
});

test("stops proposing after 10 items from one session (Q9)", async () => {
  const t = setup();
  writeFileSync(join(t.root, "ledger", `${SESSION}.json`), JSON.stringify({ version: 1, session: SESSION, offset: 0, titles: [],
    drafts: Array.from({ length: 10 }, (_, n) => ({ key: `cap1:${n}`, draftId: null, at: "2026-10-26T13:00:00.000Z" })) }));
  mockExtractor(t, answer(REFUNDS));
  codexJob(t);
  assert.deepEqual(await run(t), ["session_limit"]);
  assert.deepEqual(outbox(t), []);
  assert.equal(existsSync(t.promptCopy), false);
  clean(t);
});

test("without Node: a Claude Code job is extracted and left for the mod to gate; a Codex job is skipped with a note", () => {
  const t = setup(), id = `${SESSION}.cc-2.1`;
  mkdirSync(join(t.root, "work", id));
  writeFileSync(join(t.root, "work", id, "source.txt"), `Person: Confirmed. ${DECISION}`);
  writeFileSync(join(t.root, "work", id, "prompt.txt"), "MOD PROMPT");
  writeFileSync(join(t.root, "jobs", `${id}.json`), JSON.stringify({ version: 1, surface: "claude_code", session: SESSION, trigger: "session_end", createdAt: "2026-10-26T13:05:00.000Z" }));
  const codexId = codexJob(t);
  writeFileSync(t.answerFile, answer(REFUNDS));
  const result = spawnSync("sh", [join(here, "worker.sh"), t.root], { encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", ORGSYNC_CAPTURE_EXTRACT_CMD: `cat > "${t.promptCopy}"; printf %s "$ORGSYNC_CAPTURE_CHILD" > "${t.envCopy}"; cat "${t.answerFile}"` } });
  assert.equal(result.status, 0);
  assert.equal(readFileSync(t.envCopy, "utf8"), "1");
  assert.ok(existsSync(join(t.root, "jobs", `${id}.answered.json`)));
  assert.equal(existsSync(join(t.root, "jobs", `${codexId}.json`)), false);
  assert.match(notes(t), /skip codex_needs_node/);
  // What the mod then does with it, through the same local modules.
  const done = submissionsFromAnswer({ answer: readFileSync(join(t.root, "work", id, "answer.txt"), "utf8"), source: readFileSync(join(t.root, "work", id, "source.txt"), "utf8"),
    surface: "claude_code", extractor: "cc-1", trigger: "session_end", session: SESSION, date: "2026-10-26T13:05:00.000Z" });
  assert.equal(done.submissions.length, 1);
  assert.equal(done.submissions[0].title, REFUNDS.title);
  clean(t);
});

// ── Courier ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("the manifest check allows exactly the manifested calls and refuses anything changed, added or unknown", () => {
  const t = setup(), args = toSubmission(REFUNDS, { surface: "codex", extractor: "codex-1", trigger: "session_end", session: SESSION, date: "2026-10-26T13:05:00.000Z" });
  const manifest = join(t.base, "manifest.json"), now = Date.now();
  writeFileSync(manifest, JSON.stringify({ version: 1, expiresAt: new Date(now + 60_000).toISOString(), hashes: [callHash("submitDraft", args), callHash("discard", { captureSession: SESSION })] }));
  const call = (tool, input) => checkCall({ tool_name: `mcp__orgsync__${tool}`, tool_input: input }, manifest, now);
  const reordered = Object.fromEntries(Object.entries(args).reverse());
  assert.deepEqual(call("submitDraft", reordered), { allow: true, reason: "in_manifest" });
  assert.deepEqual(call("submitDraft", { ...args, requestId: "r9" }), { allow: true, reason: "in_manifest" });
  assert.deepEqual(call("submitDraft", JSON.stringify(args)), { allow: true, reason: "in_manifest" });
  assert.deepEqual(call("discard", { captureSession: SESSION }), { allow: true, reason: "in_manifest" });
  assert.deepEqual(call("discardDraft", { captureSession: SESSION }), { allow: true, reason: "in_manifest" });
  for (const changed of [{ ...args, title: "Injected" }, { ...args, tagIds: ["x"] }, { ...args, excerpts: [{ text: "other" }] }, (({ capture, ...rest }) => rest)(args)]) {
    assert.deepEqual(call("submitDraft", changed), { allow: false, reason: "not_in_manifest" });
  }
  assert.deepEqual(call("discardDraft", { draftId: "d1", revision: 1 }), { allow: false, reason: "not_in_manifest" });
  assert.deepEqual(call("status", { target: "connection" }), { allow: true, reason: "not_a_write" });
  assert.deepEqual(checkCall({ tool_name: "mcp__orgsync__submitDraft", tool_input: args }, manifest, now + 120_000), { allow: false, reason: "no_manifest" });
  assert.deepEqual(checkCall({ tool_name: "mcp__orgsync__submitDraft", tool_input: args }, undefined, now), { allow: false, reason: "no_manifest" });

  // The hook as codex/hooks.json runs it: inactive outside a courier run, exit 2 and one line when it refuses inside one.
  const hook = (env, input) => spawnSync("sh", ["-c", CHECK], { input: JSON.stringify(input), encoding: "utf8", env: { PATH: process.env.PATH, PLUGIN_ROOT: pluginRoot, ...env } });
  assert.equal(hook({}, { tool_name: "mcp__orgsync__submitDraft", tool_input: { title: "anything" } }).status, 0);
  const refused = hook({ ORGSYNC_CAPTURE_MANIFEST: manifest, ORGSYNC_CAPTURE_CHILD: "1" }, { tool_name: "mcp__orgsync__submitDraft", tool_input: { ...args, title: "Injected" } });
  assert.equal(refused.status, 2);
  assert.equal(refused.stderr.trim().split("\n").length, 1);
  assert.equal(hook({ ORGSYNC_CAPTURE_MANIFEST: manifest, ORGSYNC_CAPTURE_CHILD: "1" }, { tool_name: "mcp__orgsync__submitDraft", tool_input: args }).status, 0);
  clean(t);
});

/** A stand-in for `codex exec`: reads the courier prompt, runs the real PreToolUse hook command for each write, and answers. */
function mockCourier(t, mode) {
  const script = join(t.base, "mock-codex.mjs");
  writeFileSync(script, `import { readFileSync, writeFileSync } from "node:fs"; import { spawnSync } from "node:child_process";
const prompt = readFileSync(0, "utf8"), calls = JSON.parse(prompt.slice(prompt.indexOf("CALLS\\n") + 6)), mode = ${JSON.stringify(mode)};
writeFileSync(${JSON.stringify(t.envCopy)}, JSON.stringify({ child: process.env.ORGSYNC_CAPTURE_CHILD, manifest: Boolean(process.env.ORGSYNC_CAPTURE_MANIFEST) }));
if (mode === "paused") { writeFileSync("answer.txt", JSON.stringify({ you: "paused", results: [] })); process.exit(0); }
const results = [];
for (const call of calls) {
  const args = mode === "tamper" && call.tool === "submitDraft" ? { ...call.arguments, title: "Injected title" } : call.arguments;
  const hook = spawnSync("sh", ["-c", ${JSON.stringify(CHECK)}], { input: JSON.stringify({ tool_name: "mcp__orgsync__" + call.tool, tool_input: args }), env: process.env });
  if (hook.status !== 0) { results.push({ key: call.key, status: "refused_by_hook" }); continue; }
  console.log(JSON.stringify({ type: "item.completed", item: { type: "mcp_tool_call", server: "orgsync", tool: call.tool, arguments: args } }));
  results.push({ key: call.key, status: call.tool === "submitDraft" ? "draft_submitted" : "capture_session_forgotten", draftId: "drf_" + results.length });
}
if (mode === "bypass") console.log(JSON.stringify({ type: "item.completed", item: { type: "mcp_tool_call", tool: "submitDraft", arguments: { title: "Not in the manifest" } } }));
writeFileSync("answer.txt", JSON.stringify({ you: "on", results }));
`);
  process.env.ORGSYNC_CAPTURE_COURIER_CMD = `PLUGIN_ROOT="${pluginRoot}" "${process.execPath}" "${script}"`;
}

async function outboxWithItems(t) {
  mockExtractor(t, answer(REFUNDS));
  codexJob(t);
  await run(t);
  writeFileSync(join(t.root, "outbox", `${captureSession("older")}.forget.json`), JSON.stringify({ version: 1, kind: "forget", surface: "codex", session: captureSession("older"),
    createdAt: new Date().toISOString() }));
  return outbox(t);
}

test("the courier delivers each manifested item once, records the draft and the sent mark, and clears the outbox", async () => {
  const t = setup();
  assert.equal((await outboxWithItems(t)).length, 2);
  mockCourier(t, "honest");
  assert.deepEqual(await runCourier(t.root), { status: "ran", delivered: 1, refused: 0 });
  assert.deepEqual(outbox(t), []);
  assert.equal(ledger(t).sent, true);
  assert.match(ledger(t).drafts[0].draftId, /^drf_[01]$/);
  assert.deepEqual(JSON.parse(readFileSync(t.envCopy, "utf8")), { child: "1", manifest: true });
  assert.deepEqual(readdirSync(join(t.root, "courier")), []);
  assert.deepEqual(readdirSync(join(t.root, "locks")), []);
  assert.deepEqual(courierCommand(["gmail", "orgsync", "notion"]), ["codex", "exec", "--ephemeral", "-s", "read-only", "--skip-git-repo-check", "--json",
    "-c", "mcp_servers.gmail.enabled=false", "-c", "mcp_servers.notion.enabled=false",
    "-c", 'mcp_servers.orgsync.enabled_tools=["status","submitDraft","discard"]', "--output-last-message", "answer.txt", "-"]);
  clean(t);
});

test("the courier keeps an item its check refused, stops for good after a write outside the manifest, and waits while capture is not on", async () => {
  const t = setup();
  const before = await outboxWithItems(t);
  mockCourier(t, "tamper");
  assert.deepEqual(await runCourier(t.root), { status: "ran", delivered: 0, refused: 0 });
  assert.deepEqual(outbox(t), before.filter(name => !name.endsWith(".forget.json")));
  assert.equal(ledger(t).sent, false);

  mockCourier(t, "paused");
  assert.deepEqual(await runCourier(t.root), { status: "stopped" });
  assert.equal(JSON.parse(readFileSync(join(t.root, "status.json"), "utf8")).you, "paused");
  assert.equal(outbox(t).length, 1);

  mockCourier(t, "bypass");
  await runCourier(t.root);
  assert.ok(existsSync(join(t.root, "courier", "disabled")));
  assert.match(notes(t), /courier_unmanifested_call count=1/);
  assert.deepEqual(await runCourier(t.root), { status: "disabled" });
  clean(t);
});

test("the worker runs the courier only when the person turned it on", async () => {
  const t = setup();
  mockExtractor(t, answer(REFUNDS));
  mockCourier(t, "honest");
  codexJob(t);
  delete process.env.ORGSYNC_CAPTURE_COURIER;
  await run(t);
  assert.equal(outbox(t).length, 1);
  process.env.ORGSYNC_CAPTURE_COURIER = "1";
  await run(t);
  delete process.env.ORGSYNC_CAPTURE_COURIER;
  assert.deepEqual(outbox(t), []);
  clean(t);
});

test("the Codex extractor reaches no MCP server and the courier only OrgSync's, or neither runs (plan B2 §4.5)", t => {
  const list = (body, code = 0) => { process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD = `printf '%s' '${JSON.stringify(body)}'; exit ${code}`; };
  t.after(() => { delete process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD; });
  // codex mcp list --json's own shape, as Codex 0.163 prints it.
  list([{ name: "gmail", enabled: true, transport: { type: "stdio", command: "/bin/echo" } }, { name: "orgsync", enabled: true, transport: { type: "streamable_http", url: "https://orgsync.co/mcp" } }]);
  assert.deepEqual(codexServers(), ["gmail", "orgsync"]);
  assert.deepEqual(mcpOff(["gmail", "orgsync", "notion"], ["orgsync"]), ["-c", "mcp_servers.gmail.enabled=false", "-c", "mcp_servers.notion.enabled=false"]);
  // A server an override cannot name, an unreadable listing or a failed command: nobody can say every server is off.
  for (const [body, code] of [[[{ name: "my server.v2" }], 0], [{ servers: [] }, 0], [[], 1]]) { list(body, code); assert.equal(codexServers(), null); }
  process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD = "printf 'not json'";
  assert.equal(codexServers(), null);
});

test("a Codex job is not extracted when the person's MCP servers cannot all be switched off", async t => {
  const tc = setup();
  process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD = "exit 1";
  t.after(() => { delete process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD; });
  const { runExtractor } = await import("./capture-worker.mjs");
  writeFileSync(join(tc.root, "prompt.txt"), "PROMPT");
  assert.deepEqual(await runExtractor({ surface: "codex", model: null }, tc.root), { ok: false, answer: "" });
  clean(tc);
});

test("the courier does not run when the person's Codex has no OrgSync server or its servers cannot be listed, and the items wait", async t => {
  const tc = setup();
  const before = await outboxWithItems(tc);
  delete process.env.ORGSYNC_CAPTURE_COURIER_CMD;
  t.after(() => { delete process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD; });
  for (const listing of [`printf '%s' '[{"name":"gmail"}]'`, "exit 1"]) {
    process.env.ORGSYNC_CAPTURE_MCP_LIST_CMD = listing;
    assert.deepEqual(await runCourier(tc.root), { status: "failed" });
    assert.deepEqual(outbox(tc), before);
  }
  clean(tc);
});
