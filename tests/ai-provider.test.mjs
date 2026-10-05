import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { buildCodexArgs } from '../backend/src/modules/instanceManager/codexLauncher.js';
import { MCP_SERVER_PATH } from '../backend/mcp/setupMcp.js';
import { getAiProvider, matchesSavedItem } from '../frontend/src/helpers/aiHelper.js';

test('cards in the same project remain distinct and legacy cards default to Claude', () => {
  assert.equal(getAiProvider({}), 'claude');
  const item = { id: 'card-a', type: 'claude', projectId: 'shared', provider: 'codex' };
  assert.equal(matchesSavedItem({ ...item, savedItemId: 'card-a' }, item), true);
  assert.equal(matchesSavedItem({ ...item, savedItemId: 'card-b' }, item), false);
  const legacy = { type: 'claude', projectId: 'shared' };
  assert.equal(matchesSavedItem(legacy, legacy), true);
  assert.equal(matchesSavedItem({ ...legacy, provider: 'codex' }, legacy), false);
});

test('Codex receives independent instance identity and preserves prompt quoting', () => {
  const prompt = 'Use "MCP" tools.\nDirectory: C:\\a path\\repo';
  const first = buildCodexArgs(prompt, { INSTANCE_ID: 'a', PROJECT_ID: 'shared' });
  const second = buildCodexArgs(prompt, { INSTANCE_ID: 'b', PROJECT_ID: 'shared' });
  assert.ok(first.includes(`developer_instructions=${JSON.stringify(prompt)}`));
  assert.ok(first.includes('mcp_servers.claude-ide.env.INSTANCE_ID="a"'));
  assert.ok(second.includes('mcp_servers.claude-ide.env.INSTANCE_ID="b"'));
  assert.ok(!second.includes('mcp_servers.claude-ide.env.INSTANCE_ID="a"'));
  assert.ok(!first.includes('--mcp-config'));
  assert.ok(!first.includes('--append-system-prompt'));
});

test('shared MCP tools route two agents to their own dashboard cards', { timeout: 10000 }, async t => {
  const requests = [];
  const api = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, body: JSON.parse(body) });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(() => { api.closeAllConnections(); api.close(); });

  for (const instanceId of ['claude-card', 'codex-card']) {
    const child = spawn(process.execPath, [MCP_SERVER_PATH], {
      windowsHide: true,
      env: {
        ...process.env,
        INSTANCE_ID: instanceId,
        PROJECT_ID: 'shared-project',
        API_URL: `http://127.0.0.1:${api.address().port}`,
        API_PREFIX: '/api/v1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    t.after(() => child.kill());
    const lines = createInterface({ input: child.stdout });
    const pending = new Map();
    let id = 0;
    lines.on('line', line => {
      const msg = JSON.parse(line);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    });
    const call = (method, params) => new Promise(resolve => {
      id += 1;
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
    const init = await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.ok(init.result.capabilities.tools);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const list = await call('tools/list', {});
    for (const tool of ['send_message', 'send_milestone', 'send_plan', 'user_input_needed', 'update_status']) {
      assert.ok(list.result.tools.some(entry => entry.name === tool), tool);
    }
    for (const [name, args, suffix] of [
      ['send_message', { text: 'Connected', type: 'info' }, 'messages'],
      ['send_milestone', { accomplished: 'Connected MCP', workingOn: 'Checking routing' }, 'milestones'],
      ['user_input_needed', { message: 'Continue?', choices: ['Yes', 'No'] }, 'user-input'],
      ['update_status', { status: 'completed' }, 'status'],
    ]) {
      const response = await call('tools/call', { name, arguments: args });
      assert.equal(JSON.parse(response.result.content[0].text).ok, true);
      assert.equal(requests.at(-1).url, `/api/v1/instances/${instanceId}/${suffix}`);
      assert.deepEqual(requests.at(-1).body, args);
    }
    child.stdin.end();
    await once(child, 'exit');
  }
});
