import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

// B1's Codex hooks, run as Codex runs them: the event's JSON on stdin, PLUGIN_DATA set, output on stdout, always exit 0.
const HERE = dirname(fileURLToPath(import.meta.url)), SCRIPT = join(HERE, 'steer.mjs'), run = promisify(execFile);
const ENTRY = { sourceId: 'src_annual', revision: 1, title: 'Annual plan is $30 per seat', knowledgeStatus: 'accepted_decision', classification: null, area: null, tagIds: [] };
const base = { session_id: 'session-a', transcript_path: '/t', cwd: '/project', model: 'm' };

async function hook(event, input, env = {}) {
  const child = execFile(process.execPath, [SCRIPT, event], { env: { PATH: process.env.PATH, ...env } });
  child.stdin.end(typeof input === 'string' ? input : JSON.stringify({ ...base, hook_event_name: event, ...input }));
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  const code = await new Promise(resolve => child.on('exit', resolve));
  return { code, stdout };
}
async function data() { return mkdtemp(join(tmpdir(), 'orgsync-codex-')); }
const indexResult = (lastChangedAt = new Date(Date.now() - 30 * 86_400_000).toISOString()) => ({ structuredContent: { status: 'decision_index', requestId: 'r',
  asOf: new Date().toISOString(), ordering: 'last_changed_desc', nextCursor: null, entries: [{ ...ENTRY, lastChangedAt }] } });

test('the index arrives from the list result Codex receives, then a prompt on its topic gets one hint', async () => {
  const root = await data();
  try {
    assert.deepEqual(await hook('UserPromptSubmit', { turn_id: 't1', prompt: 'Quote the annual plan for 3 seats' }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    assert.deepEqual(await hook('PostToolUse', { turn_id: 't1', tool_name: 'mcp__orgsync__list', tool_input: { what: 'decisions', view: 'index' }, tool_response: indexResult() }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    const prompted = await hook('UserPromptSubmit', { turn_id: 't2', prompt: 'Quote the annual plan for 3 seats. PROMPT SENTINEL' }, { PLUGIN_DATA: root });
    assert.equal(prompted.code, 0);
    const out = JSON.parse(prompted.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(out.hookSpecificOutput.additionalContext, /^OrgSync decision index \(company data\): "Annual plan is \$30 per seat", accepted, is on this topic/);
    for (const name of await readdir(join(root, 'orgsync'), { recursive: true }))
      if (name.endsWith('.json')) assert.doesNotMatch(await readFile(join(root, 'orgsync', name), 'utf8'), /SENTINEL/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Stop blocks with the hint only on a contradiction and never inside a stop-hook loop', async () => {
  const root = await data();
  try {
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__list', tool_response: indexResult() }, { PLUGIN_DATA: root });
    assert.deepEqual(await hook('Stop', { turn_id: 't1', stop_hook_active: false, last_assistant_message: 'The annual plan is $30 per seat.' }, { PLUGIN_DATA: root }), { code: 0, stdout: '{}' });
    assert.deepEqual(await hook('Stop', { turn_id: 't1', stop_hook_active: true, last_assistant_message: 'The annual plan is $25 per seat.' }, { PLUGIN_DATA: root }), { code: 0, stdout: '{}' });
    const blocked = JSON.parse((await hook('Stop', { turn_id: 't1', stop_hook_active: false, last_assistant_message: 'The annual plan is $25 per seat.' }, { PLUGIN_DATA: root })).stdout);
    assert.equal(blocked.decision, 'block'); assert.match(blocked.reason, /states \$30; the text above states \$25/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('apply_patch counts only the lines it adds', async () => {
  const root = await data();
  try {
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__list', tool_response: indexResult() }, { PLUGIN_DATA: root });
    const patch = '*** Begin Patch\n*** Update File: pricing.md\n-The annual plan is $25 per seat.\n+The annual plan is $30 per seat.\n*** End Patch';
    assert.deepEqual(await hook('PostToolUse', { turn_id: 't1', tool_name: 'apply_patch', tool_input: { command: patch } }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    const added = await hook('PostToolUse', { turn_id: 't2', tool_name: 'apply_patch', tool_input: { command: patch.replace('+The annual plan is $30', '+The annual plan is $27') } }, { PLUGIN_DATA: root });
    assert.match(JSON.parse(added.stdout).hookSpecificOutput.additionalContext, /states \$30; the text above states \$27/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('session start names recent changes once the person has a last session, and an access refusal wipes everything', async () => {
  const root = await data();
  try {
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__list', tool_response: indexResult(new Date(Date.now() + 1000).toISOString()) }, { PLUGIN_DATA: root });
    assert.deepEqual(await hook('SessionStart', { source: 'startup' }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    await writeFile(join(root, 'orgsync', 'seen.json'), String(Date.now() - 86_400_000));
    const started = JSON.parse((await hook('SessionStart', { source: 'resume' }, { PLUGIN_DATA: root })).stdout);
    assert.match(started.hookSpecificOutput.additionalContext, /Changed since your last session[\s\S]*"Annual plan is \$30 per seat" changed/);
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__readPicture', tool_response: { structuredContent: { status: 'error', code: 'machine_credential_revoked' } } }, { PLUGIN_DATA: root });
    await assert.rejects(readdir(join(root, 'orgsync')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing data, broken input and an unreadable index print nothing and exit 0', async () => {
  const root = await data();
  try {
    assert.deepEqual(await hook('UserPromptSubmit', { prompt: 'annual plan' }), { code: 0, stdout: '' });
    assert.deepEqual(await hook('UserPromptSubmit', '{not json', { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__list', tool_response: indexResult() }, { PLUGIN_DATA: root });
    await writeFile(join(root, 'orgsync', 'index.json'), '{broken');
    assert.deepEqual(await hook('UserPromptSubmit', { prompt: 'Quote the annual plan' }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    assert.deepEqual(await hook('Unknown', {}, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every hook command checks the capture-child guard first, then node, and the scripts hold no network code', async () => {
  const all = JSON.parse(await readFile(join(HERE, 'hooks.json'), 'utf8')).hooks;
  // Capture's PreCompact and SessionEnd hooks and the courier's PreToolUse check are tested in capture.test.mjs (B2).
  assert.deepEqual(Object.keys(all), ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd']);
  const hooks = { SessionStart: all.SessionStart, UserPromptSubmit: all.UserPromptSubmit, PostToolUse: all.PostToolUse, Stop: all.Stop };
  for (const group of Object.values(hooks).flat()) for (const handler of group.hooks) {
    assert.match(handler.command, /^sh -c '\[ -n "\$ORGSYNC_CAPTURE_CHILD" \] && exit 0; command -v node >\/dev\/null 2>&1 \|\| exit 0; exec node "\$PLUGIN_ROOT\/codex\/steer\.mjs" (SessionStart|UserPromptSubmit|PostToolUse|Stop)'$/);
    assert.equal(handler.timeout, 2); assert.equal(handler.commandWindows, 'exit /b 0');
  }
  // ChatGPT Desktop's hook review titles a hook "Hook N - <statusMessage>", or a bare "Hook N" without one.
  const messages = Object.values(all).flat().flatMap(group => group.hooks.map(handler => handler.statusMessage));
  assert.equal(messages.length, 8); assert.equal(new Set(messages).size, 8);
  for (const message of messages) assert.match(message, /^OrgSync: .{10,70}$/);
  const { stdout } = await run('sh', ['-c', hooks.Stop[0].hooks[0].command], { env: { PATH: process.env.PATH, ORGSYNC_CAPTURE_CHILD: '1', PLUGIN_ROOT: join(HERE, '..') } });
  assert.equal(stdout, '');
  const source = await readFile(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /\bfetch\b|node:(?:http|https|net|tls|dgram|dns|child_process)|WebSocket|XMLHttpRequest/);
});

test('off the record silences prompt, write and Stop hints until the person says it is back on the record', async () => {
  const root = await data();
  try {
    await hook('PostToolUse', { tool_name: 'mcp__orgsync__list', tool_response: indexResult() }, { PLUGIN_DATA: root });
    assert.deepEqual(await hook('UserPromptSubmit', { turn_id: 't1', prompt: 'Off the record: quote the annual plan at $25 per seat.' }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    assert.deepEqual(await hook('Stop', { turn_id: 't1', stop_hook_active: false, last_assistant_message: 'The annual plan is $25 per seat.' }, { PLUGIN_DATA: root }), { code: 0, stdout: '{}' });
    assert.deepEqual(await hook('PostToolUse', { turn_id: 't1', tool_name: 'Write', tool_input: { content: 'The annual plan is $25 per seat.' } }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    const back = await hook('UserPromptSubmit', { turn_id: 't2', prompt: 'Back on the record. Tell Acme the annual plan is $25 per seat.' }, { PLUGIN_DATA: root });
    assert.match(JSON.parse(back.stdout).hookSpecificOutput.additionalContext, /states \$30; the text above states \$25/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a missing index at session start is stated as a fact, with no instruction', async () => {
  const root = await data();
  try {
    const started = JSON.parse((await hook('SessionStart', { source: 'startup' }, { PLUGIN_DATA: root })).stdout);
    assert.equal(started.hookSpecificOutput.additionalContext, 'OrgSync decision index (company data): this computer holds no list of company decisions from the last day.');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("SessionStart tells the model not to save captured items itself only while Codex hooks capture", async () => {
  const root = await mkdtemp(join(tmpdir(), "orgsync-steer-capture-"));
  try {
    const off = JSON.parse((await hook("SessionStart", { source: "startup" }, { PLUGIN_DATA: root })).stdout).hookSpecificOutput.additionalContext;
    assert.doesNotMatch(off, /captures here/);
    const on = JSON.parse((await hook("SessionStart", { source: "startup" }, { PLUGIN_DATA: root, ORGSYNC_CAPTURE_COURIER: "1" })).stdout).hookSpecificOutput.additionalContext;
    assert.match(on, /^This app's OrgSync plugin captures here: never save captured items yourself\.\n/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('off the record, "don\'t save this" or a forget writes capture\'s own sticky marker at once, outliving the day-long hint state (D-195)', async () => {
  const { captureSession } = await import('../local/capture-session.js');
  const root = await data(), off = id => join(root, 'orgsync', 'capture', 'off', captureSession(id));
  try {
    assert.deepEqual(await hook('UserPromptSubmit', { session_id: 'session-b', prompt: 'Quote the annual plan for 3 seats' }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
    await assert.rejects(readFile(off('session-b')));
    for (const [id, prompt] of [['session-b', "Let's keep this off the record."], ['session-c', "Don't save this."], ['session-d', 'Forget this session.']]) {
      assert.deepEqual(await hook('UserPromptSubmit', { session_id: id, prompt }, { PLUGIN_DATA: root }), { code: 0, stdout: '' });
      assert.equal(await readFile(off(id), 'utf8'), '');
    }
    // "Back on the record" brings hints back; capture's marker stays.
    await hook('UserPromptSubmit', { session_id: 'session-b', prompt: 'Back on the record.' }, { PLUGIN_DATA: root });
    assert.equal(await readFile(off('session-b'), 'utf8'), '');
  } finally { await rm(root, { recursive: true, force: true }); }
});
