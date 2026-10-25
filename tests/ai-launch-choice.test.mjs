import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAiLaunchOptions, getAiLaunchChoice, getAiLabel } from '../frontend/src/helpers/aiLaunchHelper.js';

const profiles = [{ id: 'claude1', label: 'Claude 1' }, { id: 'claude2', label: 'Claude 2' }, { id: 'codex', label: 'Codex' }];

test('lab offers exactly two Claude accounts and Codex as direct choices', () => {
  assert.deepEqual(getAiLaunchOptions(profiles), [
    { id: 'claude1', label: 'Claude1', provider: 'claude', executionProfileId: 'claude1' },
    { id: 'claude2', label: 'Claude2', provider: 'claude', executionProfileId: 'claude2' },
    { id: 'codex', label: 'Codex', provider: 'codex', executionProfileId: 'codex' },
  ]);
});

test('local mode retains Claude/Codex with no profile', () => {
  assert.deepEqual(getAiLaunchOptions().map(option => [option.label, option.provider, option.executionProfileId]), [['Claude', 'claude', null], ['Codex', 'codex', null]]);
  assert.equal(getAiLaunchChoice({ provider: 'codex' }).executionProfileId, null);
});

test('saved selection keeps its account and incompatible or missing accounts require an explicit choice', () => {
  const saved = { provider: 'claude', executionProfileId: 'claude2' };
  assert.equal(getAiLaunchChoice(saved, profiles, 'claude1').id, 'claude2');
  assert.equal(getAiLaunchChoice({ provider: 'codex' }, profiles, 'claude1').id, 'codex');
  assert.equal(getAiLaunchChoice({ provider: 'codex', executionProfileId: 'claude2' }, profiles), null);
  assert.equal(getAiLaunchChoice({ provider: 'claude', executionProfileId: 'removed' }, profiles), null);
  assert.deepEqual(saved, { provider: 'claude', executionProfileId: 'claude2' });
  assert.equal(getAiLabel(saved), 'Claude2');
  assert.equal(getAiLabel({ provider: 'codex', executionProfileId: 'codex' }), 'Codex');
});
