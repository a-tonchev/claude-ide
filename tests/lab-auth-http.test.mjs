import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { LabAuthCore, hashPassword, tokenHash } from '../backend/src/modules/labAuth/LabAuthCore.js';
import protectApp from '../backend/src/modules/labAuth/protectApp.js';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
let uWS;
try { uWS = require(process.env.CLAUDE_IDE_UWS_PATH || 'uWebSockets.js'); } catch { /* Optional native dependency unavailable. */ }

test('native uWS: login, session, guarded body replay, scoped MCP token, CSRF, logout', { skip: !uWS }, async () => {
  const origin = 'https://lab.metrik.fit';
  const user = { _id: 'user', email: 'person@example.com', role: 'admin', authVersion: 'v1', passwordHash: await hashPassword('long personal password!') };
  const sessions = [];
  const db = { collection: name => ({
    async findOne(query) {
      if (name === 'labUsers') return (query.email ? query.email === user.email : query._id === user._id) ? user : null;
      return sessions.find(s => s.tokenHash === query.tokenHash && s.expiresAt > query.expiresAt.$gt) || null;
    },
    async insertOne(doc) { sessions.push(doc); },
    async deleteOne(query) { const i = sessions.findIndex(s => s.tokenHash === query.tokenHash); if (i >= 0) sessions.splice(i, 1); },
  }) };
  const auth = new LabAuthCore({ enabled: true, allowedOrigins: [origin] }, () => db);
  const rawApp = uWS.App();
  const app = protectApp(rawApp, auth);
  app.post('/api/v1/instances/:id/status', (res, req) => {
    let body = '';
    res.onData((chunk, last) => {
      body += Buffer.from(chunk).toString();
      if (last) res.cork(() => res.writeHeader('Content-Type', 'application/json').end(JSON.stringify({ id: req.getParameter(0), body: JSON.parse(body), type: req.labPrincipal.type })));
    });
  });
  app.get('/api/v1/files/get', res => res.end('private file'));
  app.ws('/api/v1/ws', { message(ws, data) { ws.send(data); } });
  app.any('/*', res => res.writeStatus('404').end());
  const socket = await new Promise(resolve => rawApp.listen('127.0.0.1', 0, resolve));
  assert.ok(socket);
  const base = `http://127.0.0.1:${uWS.us_socket_local_port(socket)}`;
  const request = (path, method = 'GET', headers = {}, body) => fetch(`${base}/api/v1${path}`, { method, headers: { connection: 'close', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const upgrade = headers => new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/api/v1/ws`, { headers: {
      connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13',
      'sec-websocket-key': randomBytes(16).toString('base64'), ...headers,
    } });
    req.on('upgrade', (response, wsSocket) => resolve({ response, socket: wsSocket }));
    req.on('response', response => { response.resume(); resolve({ response }); });
    req.on('error', reject);
    req.end();
  });
  let wsSocket;
  try {
    assert.equal((await request('/files/get')).status, 401);
    assert.equal((await request('/lab-auth/check')).status, 401);
    let response = await request('/lab-auth/login', 'POST', { origin, 'content-type': 'application/json' }, { email: user.email, password: 'wrong' });
    assert.equal(response.status, 401);
    response = await request('/lab-auth/login', 'POST', { origin, 'content-type': 'application/json' }, { email: user.email, password: 'long personal password!' });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].tokenHash, tokenHash(cookie.split('=')[1]));
    response = await request('/lab-auth/session', 'GET', { cookie, origin });
    assert.equal((await response.json()).user.email, user.email);
    assert.equal((await request('/lab-auth/check', 'GET', { cookie })).status, 200);
    assert.equal((await request('/files/get', 'GET', { cookie })).status, 200);
    response = await request('/instances/i1/status', 'POST', { cookie, origin, 'content-type': 'application/json' }, { status: 'working' });
    assert.deepEqual(await response.json(), { id: 'i1', body: { status: 'working' }, type: 'user' });
    assert.equal((await request('/instances/i1/status', 'POST', { cookie }, {})).status, 403);
    const serviceToken = auth.issueServiceToken({ instanceId: 'i1', projectId: 'p1' });
    response = await request('/instances/i1/status', 'POST', { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json' }, { status: 'working' });
    assert.deepEqual(await response.json(), { id: 'i1', body: { status: 'working' }, type: 'service' });
    assert.equal((await request('/instances/i2/status', 'POST', { authorization: `Bearer ${serviceToken}` }, {})).status, 403);
    assert.equal((await request('/files/get', 'GET', { cookie, origin: 'https://evil.example' })).status, 403);
    assert.equal((await upgrade({ cookie })).response.statusCode, 403);
    assert.equal((await upgrade({ origin })).response.statusCode, 401);
    const opened = await upgrade({ origin, cookie });
    assert.equal(opened.response.statusCode, 101);
    wsSocket = opened.socket;
    const mask = Buffer.from([1, 2, 3, 4]);
    const payload = Buffer.from('hello');
    const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    const echoed = once(wsSocket, 'data');
    wsSocket.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]));
    const [echo] = await echoed;
    assert.equal(echo.subarray(2).toString(), 'hello');
    const closed = once(wsSocket, 'data');
    assert.equal((await request('/lab-auth/logout', 'POST', { cookie, origin }, {})).status, 200);
    const [closeFrame] = await closed;
    assert.equal(closeFrame[0] & 0x0f, 8);
    assert.equal(closeFrame.readUInt16BE(2), 1008);
    assert.equal(sessions.length, 0);
    assert.equal((await request('/lab-auth/check', 'GET', { cookie })).status, 401);
    assert.equal((await request('/files/get', 'GET', { cookie })).status, 401);
  } finally { wsSocket?.destroy(); rawApp.close(); }
});
