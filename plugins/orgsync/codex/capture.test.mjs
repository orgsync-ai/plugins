// D-195 capture: Codex's PreCompact and SessionEnd hook (plan B2 §4.5, §11 hook package). Run with node --test. The hook runs
// with sh only; the worker it detaches extracts through a mock (ORGSYNC_CAPTURE_EXTRACT_CMD), never a real model.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { captureSession } from "../local/capture-session.js";

const here = dirname(fileURLToPath(import.meta.url)), hook = join(here, "capture.sh");
const SID = "0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000", SESSION = captureSession(SID);
const line = (role, text) => JSON.stringify({ timestamp: "2026-10-26T13:00:00.000Z", type: "response_item",
  payload: { type: "message", role, content: [{ type: role === "user" ? "input_text" : "output_text", text }] } });
const TRANSCRIPT = [JSON.stringify({ timestamp: "2026-10-26T13:00:00.000Z", type: "session_meta", payload: { id: SID } }),
  line("user", "Confirmed. Refunds are allowed within 14 days of purchase on every plan."), line("assistant", "Noted.")].join("\n") + "\n";
const ANSWER = JSON.stringify({ items: [{ title: "Refunds within 14 days of purchase", summary: "Refunds are allowed within 14 days of purchase on every plan.",
  excerpts: ["Refunds are allowed within 14 days of purchase on every plan."], kind: "rule", area: null, confidence: 0.9, sensitive: "none", decided: "confirmed", scope: "company" }] });

function setup() {
  const base = mkdtempSync(join(tmpdir(), "orgsync-capture-hook-")), data = join(base, "data"), root = join(data, "orgsync", "capture");
  mkdirSync(join(data, "orgsync", "sessions"), { recursive: true });
  const transcript = join(base, "rollout.jsonl"), answer = join(base, "answer.json");
  writeFileSync(transcript, TRANSCRIPT);
  writeFileSync(answer, ANSWER);
  return { base, data, root, transcript, answer };
}
/** @param {{ data: string, transcript: string, answer: string }} t @param {Record<string, string>} [env] */
function runHook(t, trigger = "session_end", env = {}, input = JSON.stringify({ session_id: SID, transcript_path: t.transcript, cwd: "/work", hook_event_name: "SessionEnd" })) {
  const started = process.hrtime.bigint();
  const result = spawnSync("sh", [hook, trigger], { input, encoding: "utf8", env: { PATH: process.env.PATH, PLUGIN_DATA: t.data, ORGSYNC_CAPTURE_COURIER: "1", ORGSYNC_CAPTURE_STABLE_MS: "30",
    ORGSYNC_CAPTURE_EXTRACT_CMD: `sleep 0.3; cat "${t.answer}"`, ...env } });
  return { ...result, ms: Number(process.hrtime.bigint() - started) / 1e6 };
}
/** Detached workers may still be writing a note; removal retries until they are done. */
const clean = base => rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
/** A worker leaves a job alone while its session's lock is held, so a test can read the job the hook wrote. */
const holdLock = root => mkdirSync(join(root, "locks", SESSION), { recursive: true });
const jobs = root => existsSync(join(root, "jobs")) ? readdirSync(join(root, "jobs")).filter(name => name.endsWith(".json")) : [];
async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (check()) return true; await new Promise(resolve => setTimeout(resolve, 50)); }
  return false;
}

test("exits at once inside a capture worker's own run, for an unknown trigger, and without plugin data", () => {
  const t = setup();
  for (const [trigger, env] of [["session_end", { ORGSYNC_CAPTURE_CHILD: "1" }], ["stop", {}], ["session_end", { PLUGIN_DATA: "" }], ["session_end", { ORGSYNC_CAPTURE_COURIER: "" }]]) {
    const result = runHook(t, trigger, env);
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, "");
  }
  assert.equal(existsSync(t.root), false);
  clean(t.base);
});

test("hard-links the transcript, writes one job and returns while the detached worker runs (G9 on one run)", async () => {
  const t = setup();
  const result = runHook(t, "pre_compact", { ORGSYNC_CAPTURE_EXTRACT_CMD: `sleep 2; cat "${t.answer}"` });
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, "");
  assert.ok(result.ms < 1_000, `hook took ${result.ms} ms`);
  const [job] = jobs(t.root);
  assert.ok(job?.startsWith(`${SESSION}.`));
  const parsed = JSON.parse(readFileSync(join(t.root, "jobs", job), "utf8"));
  assert.deepEqual({ ...parsed, createdAt: "x" }, { version: 1, surface: "codex", session: SESSION, trigger: "pre_compact", offset: 0, linked: true, source: "",
    steering: `${SID}.json`, createdAt: "x" });
  const spool = join(t.root, "spool", job.replace(/\.json$/, ".jsonl"));
  assert.equal(statSync(spool).ino, statSync(t.transcript).ino);
  assert.equal(statSync(t.transcript).nlink, 2);
  assert.equal(statSync(t.root).mode & 0o777, 0o700);
  assert.equal(statSync(join(t.root, "jobs", job)).mode & 0o777, 0o600);
  // The worker finishes on its own, after the hook returned.
  assert.ok(await until(() => existsSync(join(t.root, "outbox")) && readdirSync(join(t.root, "outbox")).length === 1));
  assert.ok(await until(() => !existsSync(spool) && jobs(t.root).length === 0));
  clean(t.base);
});

test("notes a copy for the worker when the link fails, and refuses a path it cannot quote", () => {
  const t = setup();
  mkdirSync(join(t.root, "spool"), { recursive: true });
  holdLock(t.root);
  chmodSync(join(t.root, "spool"), 0o500);
  runHook(t);
  chmodSync(join(t.root, "spool"), 0o700);
  const [job] = jobs(t.root);
  const parsed = JSON.parse(readFileSync(join(t.root, "jobs", job), "utf8"));
  assert.equal(parsed.linked, false);
  assert.equal(parsed.source, t.transcript);
  clean(t.base);

  const q = setup();
  runHook(q, "session_end", {}, JSON.stringify({ session_id: SID, transcript_path: `${q.transcript}"quoted` }));
  assert.equal(jobs(q.root).length, 0);
  clean(q.base);
});

test("off the record is sticky: the steering marker, 'back on the record' after it, or capture's own marker stop every job", () => {
  for (const ledger of [{ off: true }, { off: false, captureOff: true }]) {
    const t = setup();
    writeFileSync(join(t.data, "orgsync", "sessions", `${SID}.json`), JSON.stringify({ ledger: { turnId: "t", turnHints: 0, sessionHints: 0, hinted: [], overridden: [], last: null, ...ledger } }));
    runHook(t);
    assert.equal(jobs(t.root).length, 0);
    assert.ok(existsSync(join(t.root, "off", SESSION)));
    assert.equal(statSync(t.transcript).nlink, 1);
    // The marker outlives the steering file.
    rmSync(join(t.data, "orgsync", "sessions", `${SID}.json`));
    runHook(t);
    assert.equal(jobs(t.root).length, 0);
    clean(t.base);
  }
});

test("off the record deletes the session's unsent items and queues a forget when something was already sent", () => {
  const t = setup(), other = captureSession("another-session");
  mkdirSync(join(t.root, "outbox"), { recursive: true });
  mkdirSync(join(t.root, "ledger"), { recursive: true });
  mkdirSync(join(t.root, "off"), { recursive: true });
  writeFileSync(join(t.root, "outbox", `${SESSION}.0123456789abcdef.json`), "{}");
  writeFileSync(join(t.root, "outbox", `${other}.0123456789abcdef.json`), "{}");
  writeFileSync(join(t.root, "ledger", `${SESSION}.json`), JSON.stringify({ version: 1, session: SESSION, offset: 10, sent: true }));
  writeFileSync(join(t.root, "off", SESSION), "");
  runHook(t);
  assert.deepEqual(readdirSync(join(t.root, "outbox")).sort(), [`${other}.0123456789abcdef.json`, `${SESSION}.forget.json`].sort());
  const forget = JSON.parse(readFileSync(join(t.root, "outbox", `${SESSION}.forget.json`), "utf8"));
  assert.deepEqual({ ...forget, createdAt: "x" }, { version: 1, kind: "forget", surface: "codex", session: SESSION, createdAt: "x" });
  clean(t.base);
});

test("a local pause stops the hook until it ends; the job carries the ledger's offset", () => {
  const t = setup();
  mkdirSync(t.root, { recursive: true });
  writeFileSync(join(t.root, "paused"), String(Math.floor(Date.now() / 1000) + 3600));
  runHook(t);
  assert.equal(jobs(t.root).length, 0);
  writeFileSync(join(t.root, "paused"), String(Math.floor(Date.now() / 1000) - 60));
  mkdirSync(join(t.root, "ledger"), { recursive: true });
  writeFileSync(join(t.root, "ledger", `${SESSION}.json`), JSON.stringify({ version: 1, session: SESSION, offset: 1234, titles: [] }));
  holdLock(t.root);
  runHook(t);
  const [job] = jobs(t.root);
  assert.equal(JSON.parse(readFileSync(join(t.root, "jobs", job), "utf8")).offset, 1234);
  clean(t.base);
});

test("G9: the hook returns within 300 ms at p95 over 20 runs", async () => {
  const t = setup(), times = [];
  // Each run detaches a real worker (Node starts and finds the session locked), so the runs compete with them for the CPU.
  holdLock(t.root);
  for (let run = 0; run < 20; run += 1) times.push(runHook(t, run % 2 ? "pre_compact" : "session_end").ms);
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
  assert.ok(p95 < 300, `p95 ${p95.toFixed(1)} ms over ${times.map(ms => ms.toFixed(0)).join(",")}`);
  console.log(`# G9 capture.sh p95 ${p95.toFixed(1)} ms, median ${times[10].toFixed(1)} ms, max ${times[19].toFixed(1)} ms`);
  await new Promise(resolve => setTimeout(resolve, 1_500));
  clean(t.base);
});

test("every Codex hook exits at once inside a capture worker's own run; the courier check only acts in a courier run", () => {
  const t = setup(), bin = join(t.base, "bin"), marker = join(t.base, "node-ran");
  mkdirSync(bin);
  // A stand-in node that leaves a mark: no hook may reach it under ORGSYNC_CAPTURE_CHILD.
  writeFileSync(join(bin, "node"), `#!/bin/sh\n: > "${marker}"\n`, { mode: 0o755 });
  const hooks = JSON.parse(readFileSync(join(here, "hooks.json"), "utf8")).hooks;
  const commands = Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap(group => group.hooks.map(hookEntry => [event, hookEntry.command])));
  assert.deepEqual([...new Set(commands.map(([event]) => event))].sort(), ["PostToolUse", "PreCompact", "PreToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"]);
  for (const [event, command] of commands) {
    const result = spawnSync("sh", ["-c", command], { input: JSON.stringify({ session_id: SID, transcript_path: t.transcript, tool_name: "mcp__orgsync__submitDraft", tool_input: {} }),
      encoding: "utf8", env: { PATH: `${bin}:/usr/bin:/bin`, PLUGIN_ROOT: dirname(here), PLUGIN_DATA: t.data, ORGSYNC_CAPTURE_CHILD: "1" } });
    assert.deepEqual([event, result.status, result.stdout + result.stderr], [event, 0, ""]);
  }
  assert.equal(existsSync(marker), false);
  assert.equal(existsSync(t.root), false);
  clean(t.base);
});
