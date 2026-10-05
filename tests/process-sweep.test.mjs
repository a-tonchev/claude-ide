import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectMcpOrphans } from '../backend/src/modules/instanceManager/processSweep.js';

const LIVE_SERVER = 'D:\\Programs\\claude-ide\\backend\\mcp\\server.js';
const DEV_SERVER = 'D:\\development\\own\\claude-ide\\backend\\mcp\\server.js';
const NODE = '"C:\\Program Files\\nodejs\\node.exe"';

const proc = (pid, ppid, cmd, created = pid) => ({
  pid, ppid, cmd, created,
});
const orphanPids = (table, options) => selectMcpOrphans(table, options).map(p => p.pid).sort((a, b) => a - b);

test('a backend kills only its own leftover MCP servers, never another install\'s', () => {
  const table = [
    proc(100, 1, 'node --import ./register.mjs index.js'),
    proc(300, 999, `${NODE} ${DEV_SERVER}`),
    proc(200, 1, 'claude.exe'),
    proc(301, 200, `${NODE} ${LIVE_SERVER}`),
    proc(302, 998, `${NODE} ${LIVE_SERVER}`),
  ];
  assert.deepEqual(orphanPids(table, { ownServerPath: DEV_SERVER, excludeRootPids: [100] }), [300]);
  assert.deepEqual(orphanPids(table, { ownServerPath: LIVE_SERVER, excludeRootPids: [100] }), [301, 302]);
});

test('own MCP servers under a running instance are protected', () => {
  const table = [
    proc(100, 1, 'node index.js'),
    proc(110, 100, 'powershell.exe -NoLogo -Command claude'),
    proc(120, 110, 'claude.exe'),
    proc(130, 120, `${NODE} ${DEV_SERVER}`),
    proc(131, 997, `${NODE} ${DEV_SERVER}`),
  ];
  assert.deepEqual(orphanPids(table, { ownServerPath: DEV_SERVER, excludeRootPids: [100, 110] }), [131]);
});

test('chrome-devtools-mcp is killed only once the process that started it is gone', () => {
  const table = [
    proc(200, 1, 'claude.exe'),
    proc(210, 200, 'cmd.exe /d /s /c npx chrome-devtools-mcp@latest'),
    proc(220, 210, 'node C:\\npm-cache\\chrome-devtools-mcp\\build\\index.js'),
    proc(310, 999, 'cmd.exe /d /s /c npx chrome-devtools-mcp@latest'),
    proc(320, 310, 'node C:\\npm-cache\\chrome-devtools-mcp\\build\\index.js'),
  ];
  assert.deepEqual(orphanPids(table, { ownServerPath: DEV_SERVER }), [310, 320]);
});

test('a reused parent PID does not count as the owner', () => {
  const table = [
    proc(400, 500, 'node chrome-devtools-mcp', 1000),
    proc(500, 1, 'explorer.exe', 2000),
  ];
  assert.deepEqual(orphanPids(table, { ownServerPath: DEV_SERVER }), [400]);
});

test('a JSON-escaped server path inside another command line is not matched', () => {
  const codexArgs = `mcp_servers.claude-ide.args=${JSON.stringify([DEV_SERVER])}`;
  const table = [
    proc(600, 999, `codex.exe --no-alt-screen -c ${codexArgs}`),
    proc(601, 999, `${NODE} ${DEV_SERVER}.bak`),
  ];
  assert.deepEqual(orphanPids(table, { ownServerPath: DEV_SERVER }), []);
});
