import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canTypeNow, renameStep, renameTarget, sessionNameArgs, sessionNameFor,
} from '../backend/src/modules/instanceManager/sessionName.js';
import { claudeArgv, claudeWindowsCommand } from '../backend/src/modules/instanceManager/claudeLaunch.js';

test('sessionNameFor transliterates Cyrillic and slugs titles', () => {
  assert.equal(sessionNameFor('Ню фиксър'), 'nyu-fiksar');
  assert.equal(sessionNameFor('New Feature Fixer'), 'new-feature-fixer');
  assert.equal(sessionNameFor('Щастлива жаба, юнак!'), 'shtastliva-zhaba-yunak');
  assert.equal(sessionNameFor('Цех Чушка Хоп Йо'), 'tseh-chushka-hop-yo');
  assert.equal(sessionNameFor('Объём Эхо Ёлка'), 'obayom-eho-yolka');
  assert.equal(sessionNameFor('  --Café__API v2--  '), 'cafe-api-v2');
  assert.equal(sessionNameFor('a'.repeat(59) + ' b'), 'a'.repeat(59));
  assert.equal(sessionNameFor('x'.repeat(100)).length, 60);
});

test('sessionNameFor falls back, then gives null', () => {
  assert.equal(sessionNameFor('', 'metrik-fit'), 'metrik-fit');
  assert.equal(sessionNameFor('!!!', 'My Project'), 'my-project');
  assert.equal(sessionNameFor('***'), null);
  assert.equal(sessionNameFor(null, ''), null);
  assert.equal(sessionNameFor(undefined), null);
});

test('only a titled instance gets -n', () => {
  assert.deepEqual(sessionNameArgs('New Feature Fixer', 'proj'), ['-n', 'new-feature-fixer']);
  assert.deepEqual(sessionNameArgs(null, 'proj'), []);
  assert.deepEqual(sessionNameArgs('', 'proj'), []);
  assert.deepEqual(sessionNameArgs('???', 'Proj X'), ['-n', 'proj-x']);
});

test('spawn args include -n when titled, on Windows and POSIX', () => {
  const sessionArgs = ['--resume', '0b6f9b52-5b1a-4e43-9a43-5a2b6b5d1c11'];
  const named = claudeWindowsCommand({
    hasFilesDir: true, mcpConfigPath: 'C:\\x\\mcp.json', sessionArgs, nameArgs: sessionNameArgs('Ню фиксър'), flagStrings: ['--verbose'],
  });
  assert.equal(named, `claude --append-system-prompt $env:CLAUDE_IDE_SYSTEM_PROMPT --add-dir $env:CLAUDE_IDE_FILES_DIR --mcp-config "C:\\x\\mcp.json" ${sessionArgs.join(' ')} -n 'nyu-fiksar' --verbose`);
  assert.ok(!claudeWindowsCommand({ sessionArgs, nameArgs: sessionNameArgs(null) }).includes(' -n '));

  const argv = claudeArgv({
    systemPrompt: 'prompt', filesDir: '/f', mcpConfigPath: '/m.json', sessionArgs, nameArgs: sessionNameArgs('New Feature Fixer'), flagArgs: ['--x'],
  });
  assert.deepEqual(argv, ['--append-system-prompt', 'prompt', '--add-dir', '/f', '--mcp-config', '/m.json', ...sessionArgs, '-n', 'new-feature-fixer', '--x']);
  assert.ok(!claudeArgv({ systemPrompt: 'p', sessionArgs }).includes('-n'));
});

test('launch builders refuse a name that skipped sessionNameFor', () => {
  for (const nameArgs of [['-n', "x'; rm -rf /"], ['-n', 'Has Space'], ['-n', '-flag'], ['--name', 'ok']]) {
    assert.throws(() => claudeWindowsCommand({ nameArgs }), /Invalid session name/);
    assert.throws(() => claudeArgv({ systemPrompt: 'p', nameArgs }), /Invalid session name/);
  }
});

test('renameTarget follows the title and resets to the project name', () => {
  assert.equal(renameTarget({ title: 'New Feature Fixer', projectName: 'proj', currentName: null }), 'new-feature-fixer');
  assert.equal(renameTarget({ title: 'New Feature Fixer', projectName: 'proj', currentName: 'new-feature-fixer' }), null);
  assert.equal(renameTarget({ title: null, projectName: 'Metrik Fit', currentName: 'new-feature-fixer' }), 'metrik-fit');
  // Never named by the IDE: a reset leaves Claude's default name alone.
  assert.equal(renameTarget({ title: null, projectName: 'Metrik Fit', currentName: null }), null);
});

test('typing is safe only when no prompt is open and no input is in flight', () => {
  for (const status of ['ready', 'thinking', 'working', 'completed', 'planning']) {
    assert.equal(canTypeNow({ status }), true, status);
  }
  for (const status of ['running', 'waiting', 'waiting_input', 'plan_ready', 'exited']) {
    assert.equal(canTypeNow({ status }), false, status);
  }
  assert.equal(canTypeNow({ status: 'working', pendingInput: { choices: ['Yes'] } }), false);
  assert.equal(canTypeNow({ status: 'working', inputInFlight: true }), false);
});

test('renameStep queues, retries, waits and types', () => {
  assert.deepEqual(renameStep({ pendingName: null, status: 'ready' }), { action: 'none' });
  assert.deepEqual(renameStep({ pendingName: 'x', status: 'exited' }), { action: 'drop' });
  assert.deepEqual(renameStep({ pendingName: 'x', status: 'plan_ready' }), { action: 'wait' });
  assert.deepEqual(renameStep({ pendingName: 'x', status: 'working', pendingInput: { choices: [] } }), { action: 'wait' });
  // A question open AND a message in flight: wait for the status, not a timer.
  assert.deepEqual(renameStep({ pendingName: 'x', status: 'waiting', inputInFlight: true }), { action: 'wait' });
  assert.deepEqual(renameStep({ pendingName: 'x', status: 'working', inputInFlight: true }), { action: 'retry' });
  assert.deepEqual(renameStep({ pendingName: 'new-feature-fixer', status: 'working' }), { action: 'type', command: '/rename new-feature-fixer' });

  // The queue across a question: held while waiting, typed once the answer moves the status on.
  const instance = { pendingName: 'nyu-fiksar', status: 'waiting', pendingInput: { choices: ['Yes', 'No'] } };
  assert.equal(renameStep(instance).action, 'wait');
  Object.assign(instance, { pendingInput: null, status: 'working', inputInFlight: true });
  assert.equal(renameStep(instance).action, 'retry');
  instance.inputInFlight = false;
  assert.deepEqual(renameStep(instance), { action: 'type', command: '/rename nyu-fiksar' });
});
