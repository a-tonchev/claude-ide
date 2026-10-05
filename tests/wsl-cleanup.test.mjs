import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  WSL_MARKER_VAR, buildKillScript, installKey, terminalMarker, withTerminalMarker,
} from '../backend/src/modules/instanceManager/wslCleanup.js';

const hasSh = spawnSync('sh', ['-c', 'exit 0']).status === 0;
const noSh = hasSh ? false : 'no POSIX sh on PATH';

// A fake /proc: one folder per pid holding a NUL-separated environ file.
function fakeProc(t, processes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ide-proc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [pid, vars] of Object.entries(processes)) {
    fs.mkdirSync(path.join(root, pid));
    fs.writeFileSync(path.join(root, pid, 'environ'), `${vars.join('\0')}\0`);
  }
  return root.replace(/\\/g, '/');
}

const killedBy = script => spawnSync('sh', ['-c', script], { encoding: 'utf8' }).stdout
  .split('\n')
  .filter(line => line.startsWith('KILL '))
  .map(line => line.slice(5).trim())
  .sort();

const LIVE = installKey('D:\\Programs\\claude-ide\\backend');
const DEV = installKey('D:\\development\\own\\claude-ide\\backend');

test('the terminal marker reaches WSL through WSLENV without dropping existing entries', () => {
  const env = withTerminalMarker({ PATH: 'x', WslEnv: 'USERPROFILE/p' }, 'abc:def:123');
  assert.equal(env[WSL_MARKER_VAR], 'abc:def:123');
  assert.equal(env.WSLENV, `USERPROFILE/p:${WSL_MARKER_VAR}/u`);
  assert.equal('WslEnv' in env, false);
  assert.equal(withTerminalMarker({ WSLENV: `${WSL_MARKER_VAR}/u` }, 'a:b:c').WSLENV, `${WSL_MARKER_VAR}/u`);
  assert.equal(withTerminalMarker({}, 'a:b:c').WSLENV, `${WSL_MARKER_VAR}/u`);
});

test('install keys differ per backend folder and ignore letter case', () => {
  assert.equal(LIVE, installKey('d:\\programs\\CLAUDE-IDE\\backend'));
  assert.notEqual(LIVE, DEV);
  assert.match(LIVE, /^[0-9a-f]{10}$/);
});

test('stopping a terminal kills exactly the processes carrying its marker', { skip: noSh }, t => {
  const mine = terminalMarker({ installKey: LIVE, bootId: 'boot1', instanceId: 'aaaaaaaa-0000-4000-8000-000000000001' });
  const other = terminalMarker({ installKey: LIVE, bootId: 'boot1', instanceId: 'aaaaaaaa-0000-4000-8000-000000000002' });
  const procRoot = fakeProc(t, {
    101: ['PATH=/bin', `${WSL_MARKER_VAR}=${mine}`],
    102: [`${WSL_MARKER_VAR}=${mine}`, 'HOME=/home/bux'],
    103: [`${WSL_MARKER_VAR}=${other}`],
    104: ['PATH=/bin'],
    105: [`${WSL_MARKER_VAR}=${mine}-extra`],
  });
  assert.deepEqual(killedBy(buildKillScript({ marker: mine }, { procRoot, killCommand: 'echo KILL' })), ['101', '102']);
});

test('the startup sweep kills leftovers of earlier runs of this install only', { skip: noSh }, t => {
  const marker = (key, bootId, n) => terminalMarker({ installKey: key, bootId, instanceId: `bbbbbbbb-0000-4000-8000-00000000000${n}` });
  const procRoot = fakeProc(t, {
    201: [`${WSL_MARKER_VAR}=${marker(LIVE, 'oldboot', 1)}`],
    202: [`${WSL_MARKER_VAR}=${marker(LIVE, 'nowboot', 2)}`],
    203: [`${WSL_MARKER_VAR}=${marker(DEV, 'oldboot', 3)}`],
    204: ['PATH=/bin'],
  });
  const script = buildKillScript({ installKey: LIVE, exceptBootId: 'nowboot' }, { procRoot, killCommand: 'echo KILL' });
  assert.deepEqual(killedBy(script), ['201']);
});

test('values that could break out of the shell script are rejected', () => {
  assert.throws(() => buildKillScript({ marker: "a'; rm -rf / #" }));
  assert.throws(() => buildKillScript({ installKey: 'a b', exceptBootId: 'x' }));
  assert.throws(() => buildKillScript({}));
});
