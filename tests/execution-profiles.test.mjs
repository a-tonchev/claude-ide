import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  configuredProfiles, resolveExecutionProfile, profileEnvironment, profileLaunch,
} from '../backend/src/modules/instanceManager/executionProfiles.js';
import { matchesSavedItem } from '../frontend/src/helpers/aiHelper.js';

const settings = {
  executionProfiles: [{ id: 'claude1', label: 'Claude 1' }, { id: 'claude2', label: 'Claude 2' }, { id: 'codex', label: 'Codex' }],
  executionProfileRunner: '/usr/local/sbin/claude-ide-profile-runner',
  defaultExecutionProfileId: 'claude1',
};

test('profiles expose only server-owned identifiers and labels', () => {
  assert.deepEqual(configuredProfiles({ executionProfiles: [{ id: 'claude1', label: 'Claude 1', username: 'private', home: '/private' }] }), [{ id: 'claude1', label: 'Claude 1' }]);
  assert.throws(() => configuredProfiles({ executionProfiles: [{ id: '../root', label: 'bad' }] }));
  assert.throws(() => configuredProfiles({ executionProfiles: [settings.executionProfiles[0], settings.executionProfiles[0]] }));
});

test('launch resolves allowlisted defaults and rejects client-supplied identities', () => {
  assert.equal(resolveExecutionProfile(settings, null, null, 'linux').id, 'claude1');
  assert.equal(resolveExecutionProfile(settings, 'claude2', null, 'linux').id, 'claude2');
  for (const value of ['root', '../../root', { username: 'root' }]) {
    assert.throws(() => resolveExecutionProfile(settings, value, null, 'linux'), /Unknown execution profile/);
  }
  assert.throws(() => resolveExecutionProfile(settings, 'claude1', null, 'win32'), /require Linux/);
  assert.equal(resolveExecutionProfile({}, null), null);
  assert.throws(() => resolveExecutionProfile({}, 'claude1'), /no longer configured/);
});

test('resume keeps original profile even if caller requests another; unavailable and legacy identities fail closed', () => {
  assert.equal(resolveExecutionProfile(settings, 'codex', { executionProfileId: 'claude2' }, 'linux').id, 'claude2');
  assert.throws(() => resolveExecutionProfile(settings, 'claude1', {}, 'linux'), /legacy session/);
  assert.throws(() => resolveExecutionProfile(settings, null, { executionProfileId: 'removed' }, 'linux'), /Unknown execution profile/);
});

test('profile launch strips inherited credentials and identity paths and keeps MCP credential off argv', () => {
  const env = { HOME: '/backend', USER: 'backend', CODEX_HOME: '/backend/.codex', CLAUDE_CONFIG_DIR: '/backend/.claude',
    NODE_OPTIONS: '--require=bad', LD_PRELOAD: 'bad', ANTHROPIC_API_KEY: 'backend-key', OPENAI_API_KEY: 'backend-key',
    TERM: 'xterm-256color', INSTANCE_ID: 'instance', CLAUDE_IDE_MCP_TOKEN: 'service-credential' };
  assert.deepEqual(profileEnvironment(env), { TERM: 'xterm-256color', INSTANCE_ID: 'instance', CLAUDE_IDE_MCP_TOKEN: 'service-credential' });
  const launch = profileLaunch(settings, settings.executionProfiles[1], 'instance', 'claude', '/shared', ['--session-id', 'uuid'], env);
  assert.equal(launch.file, '/usr/bin/sudo');
  assert.ok(!launch.args.some(arg => arg.includes('preserve-env')));
  assert.ok(!JSON.stringify(launch.args).includes('service-credential'));
  assert.ok(!JSON.stringify(launch.args).includes('backend-key'));
  const payload = JSON.parse(launch.env.CLAUDE_IDE_LAUNCH_DATA);
  assert.equal(payload.profileId, 'claude2');
  assert.equal(payload.env.CLAUDE_IDE_MCP_TOKEN, 'service-credential');
  assert.equal(payload.env.HOME, undefined);
});

test('legacy cards distinguish execution profiles within the same project', () => {
  const item = { type: 'claude', projectId: 'shared', executionProfileId: 'claude1' };
  assert.equal(matchesSavedItem({ ...item }, item), true);
  assert.equal(matchesSavedItem({ ...item, executionProfileId: 'claude2' }, item), false);
});
