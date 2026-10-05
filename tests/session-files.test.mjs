import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  codexInstanceMarker, findClaudeTranscript, findCodexSession,
} from '../backend/src/modules/instanceManager/sessionFiles.js';

const tempDir = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ide-sessions-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const pad = n => String(n).padStart(2, '0');

// Mirrors a Codex rollout: session_meta first (with long base instructions), then the
// developer message carrying the dashboard instructions, written at the first turn.
function writeRollout(codexDir, started, id, cwd, { instanceId = null, subagent = false } = {}) {
  const dir = path.join(codexDir, 'sessions', String(started.getFullYear()), pad(started.getMonth() + 1), pad(started.getDate()));
  fs.mkdirSync(dir, { recursive: true });
  const stamp = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}`
    + `T${pad(started.getHours())}-${pad(started.getMinutes())}-${pad(started.getSeconds())}`;
  const meta = {
    timestamp: started.toISOString(),
    type: 'session_meta',
    payload: {
      session_id: subagent ? 'aaaaaaaa-0000-4000-8000-000000000000' : id,
      id,
      timestamp: started.toISOString(),
      cwd,
      source: subagent ? { subagent: {} } : 'cli',
      thread_source: subagent ? 'subagent' : 'user',
      base_instructions: { text: 'x'.repeat(30000) },
    },
  };
  const instructions = `${instanceId ? `${codexInstanceMarker(instanceId)}\n\n` : ''}You are managed by Claude IDE.`;
  const developer = {
    timestamp: started.toISOString(),
    type: 'response_item',
    payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: instructions }] },
  };
  fs.writeFileSync(path.join(dir, `rollout-${stamp}-${id}.jsonl`), `${JSON.stringify(meta)}\n${JSON.stringify(developer)}\n`);
}

test('a Claude transcript is found in whichever project folder holds it', t => {
  const claudeDir = tempDir(t);
  const id = '4854e2f0-cb66-4acf-be69-0836a706954b';
  const projectDir = path.join(claudeDir, 'projects', 'D--work-app');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, `${id}.jsonl`), '{}\n');

  assert.equal(findClaudeTranscript(id, { claudeDir }), path.join(projectDir, `${id}.jsonl`));
  assert.equal(findClaudeTranscript('f3e1aa98-fbf6-4e14-9551-e1e5aec7ba0a', { claudeDir }), null);
  assert.equal(findClaudeTranscript('../../outside', { claudeDir }), null);
});

test('each Codex instance finds its own session by marker, even when two share a folder', t => {
  const codexDir = tempDir(t);
  const cwd = 'D:\\work\\app';
  const startedAt = new Date(2026, 8, 15, 10, 0, 0);
  const now = new Date(2026, 8, 15, 10, 5, 0);
  const instanceA = '11111111-1111-4111-8111-111111111111';
  const instanceB = '22222222-2222-4222-8222-222222222222';

  // B's session was written first, so start order alone would pair them wrongly.
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 1), '00000000-0000-4000-8000-00000000000b', cwd, { instanceId: instanceB });
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 2), '00000000-0000-4000-8000-00000000000a', cwd, { instanceId: instanceA });
  // A subagent thread spawned by A carries the same instructions and must be ignored.
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 3), '00000000-0000-4000-8000-0000000000a5', cwd, { instanceId: instanceA, subagent: true });
  // An older session from a previous run of A is before this start and must be ignored.
  writeRollout(codexDir, new Date(2026, 8, 15, 9, 0, 0), '00000000-0000-4000-8000-0000000000a0', cwd, { instanceId: instanceA });

  assert.equal(findCodexSession({
    cwd, startedAt, codexDir, now, instanceId: instanceA,
  }), '00000000-0000-4000-8000-00000000000a');
  assert.equal(findCodexSession({
    cwd, startedAt, codexDir, now, instanceId: instanceB,
  }), '00000000-0000-4000-8000-00000000000b');
});

test('a Codex session in another folder, without the marker, or already claimed is not matched', t => {
  const codexDir = tempDir(t);
  const cwd = 'D:\\work\\app';
  const startedAt = new Date(2026, 8, 15, 10, 0, 0);
  const now = new Date(2026, 8, 15, 10, 5, 0);
  const instanceId = '33333333-3333-4333-8333-333333333333';
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 1), '00000000-0000-4000-8000-000000000001', 'D:\\other', { instanceId });
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 2), '00000000-0000-4000-8000-000000000002', cwd);
  writeRollout(codexDir, new Date(2026, 8, 15, 10, 0, 3), '00000000-0000-4000-8000-000000000003', cwd, { instanceId });

  assert.equal(findCodexSession({
    cwd, startedAt, codexDir, now, instanceId, claimedIds: ['00000000-0000-4000-8000-000000000003'],
  }), null);
  assert.equal(findCodexSession({
    cwd, startedAt, codexDir, now, instanceId,
  }), '00000000-0000-4000-8000-000000000003');
});
