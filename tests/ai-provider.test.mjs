import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { buildCodexArgs } from '../backend/src/modules/instanceManager/codexLauncher.js';
import { MCP_SERVER_PATH, getMcpServers, setAdditionalMcpServers } from '../backend/mcp/setupMcp.js';
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

test('trusted additional MCP servers reach Claude and Codex without credential literals', () => {
  const browser = { command: '/usr/local/bin/chrome-devtools-mcp', args: ['--browserUrl=http://127.0.0.1:9222', '--no-usage-statistics'] };
  try {
    setAdditionalMcpServers({ 'chrome-devtools': browser });
    assert.deepEqual(getMcpServers()['chrome-devtools'], browser);
    const args = buildCodexArgs('prompt', { INSTANCE_ID: 'i1', CLAUDE_IDE_MCP_TOKEN: 'must-not-be-in-argv' });
    assert.ok(args.includes('mcp_servers.chrome-devtools.command="/usr/local/bin/chrome-devtools-mcp"'));
    assert.ok(args.includes(`mcp_servers.chrome-devtools.args=${JSON.stringify(browser.args)}`));
    assert.ok(!JSON.stringify(args).includes('must-not-be-in-argv'));
    assert.throws(() => setAdditionalMcpServers({ 'claude-ide': browser }));
    assert.throws(() => setAdditionalMcpServers({ 'bad.name': browser }));
    assert.throws(() => setAdditionalMcpServers({ browser: { ...browser, env: { SECRET: 'no' } } }));
    assert.throws(() => setAdditionalMcpServers({ browser: { command: 'relative-command', args: [] } }));
  } finally { setAdditionalMcpServers({}); }
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
  assert.ok(first.includes('mcp_servers.claude-ide.env_vars=["CLAUDE_IDE_MCP_TOKEN"]'));
});

test('shared MCP tools route two agents to their own dashboard cards', { timeout: 10000 }, async t => {
  const requests = [];
  let failPlan = false;
  const api = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, body: JSON.parse(body), authorization: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.endsWith('/plans/add') && failPlan ? { ok: false, message: 'Plan rejected' } : { ok: true }));
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
        CLAUDE_IDE_MCP_TOKEN: 'test-service-token',
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
    for (const tool of ['send_message', 'send_milestone', 'send_plan', 'user_input_needed', 'update_status', 'rename_me']) {
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
    const renamed = await call('tools/call', { name: 'rename_me', arguments: { name: 'New Feature Fixer' } });
    assert.equal(JSON.parse(renamed.result.content[0].text).ok, true);
    assert.deepEqual(requests.at(-1), {
      url: `/api/v1/instances/${instanceId}/title`,
      body: { title: 'New Feature Fixer' },
      authorization: 'Bearer test-service-token',
    });
    const plan = { title: 'Implementation plan', content: '# Plan\n\n1. Verify routing.' };
    const response = await call('tools/call', { name: 'send_plan', arguments: plan });
    assert.equal(JSON.parse(response.result.content[0].text).ok, true);
    assert.deepEqual(requests.at(-2), {
      url: '/api/v1/plans/add',
      body: { project_id: 'shared-project', instance_id: instanceId, ...plan, status: 'draft' },
      authorization: 'Bearer test-service-token',
    });
    assert.equal(requests.at(-1).url, `/api/v1/instances/${instanceId}/status`);
    assert.deepEqual(requests.at(-1).body, { status: 'plan_ready' });
    failPlan = true;
    const beforeFailure = requests.length;
    const failed = await call('tools/call', { name: 'send_plan', arguments: plan });
    assert.equal(JSON.parse(failed.result.content[0].text).ok, false);
    assert.equal(requests.length, beforeFailure + 1, 'failed saves must not set plan_ready');
    failPlan = false;
    child.stdin.end();
    await once(child, 'exit');
  }
});
