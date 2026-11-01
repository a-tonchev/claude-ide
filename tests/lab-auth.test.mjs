import test from 'node:test';
import assert from 'node:assert/strict';
import { LabAuthCore, COOKIE_NAME, newToken, tokenHash, hashPassword, verifyPassword } from '../backend/src/modules/labAuth/LabAuthCore.js';
import protectApp from '../backend/src/modules/labAuth/protectApp.js';

const origin = 'https://lab.metrik.fit';
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function fixture() {
  const token = newToken();
  const user = { _id: 'user1', email: 'test@example.com', role: 'admin', authVersion: 'v1' };
  const session = { tokenHash: tokenHash(token), userId: user._id, authVersion: 'v1', expiresAt: new Date(Date.now() + 3600000) };
  const db = { collection: name => ({
    async findOne(query) {
      if (name === 'labSessions') return query.tokenHash === session.tokenHash && session.expiresAt > query.expiresAt.$gt ? session : null;
      if (name === 'labUsers') return !user.disabled ? user : null;
      return null;
    },
  }) };
  const auth = new LabAuthCore({ enabled: true, allowedOrigins: [origin] }, () => db);
  const routes = new Map();
  const raw = {};
  for (const name of ['get', 'post', 'options', 'any', 'ws']) raw[name] = (path, handler) => { routes.set(`${name} ${path}`, handler); return raw; };
  const app = protectApp(raw, auth);
  return { auth, app, routes, token, user, session };
}
function exchange({ path = '/api/v1/projects/all', method = 'post', headers = {}, parameters = [] } = {}) {
  const req = {
    getUrl: () => path,
    getMethod: () => method,
    getQuery: () => '',
    getParameter: i => parameters[i],
    getHeader: key => headers[key] || '',
    forEach: cb => Object.entries(headers).forEach(([key, value]) => cb(key, value)),
  };
  const res = {
    headers: {}, status: '', body: null,
    writeStatus(status) { this.status = status; return this; },
    writeHeader(key, value) { this.headers[key] = value; return this; },
    cork(cb) { cb(); return this; },
    end(body) { this.body = body; return this; },
    onAborted(cb) { this.abort = cb; return this; },
    onData(cb) { this.data = cb; return this; },
    getRemoteAddress: () => new Uint8Array([127, 0, 0, 1]).buffer,
    upgrade(data) { this.upgraded = data; },
    chunk(text, last = true) { this.data(new TextEncoder().encode(text).buffer, last); },
  };
  return { req, res };
}

test('cryptographic credentials and password hashing', async () => {
  const a = newToken();
  assert.equal(a.length, 43);
  assert.notEqual(a, newToken());
  assert.equal(tokenHash(a).length, 64);
  const hash = await hashPassword('a long unique secret!');
  assert.ok(!hash.includes('unique'));
  assert.equal(await verifyPassword('a long unique secret!', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  await assert.rejects(hashPassword('short'));
});

test('secure cookie scope; malformed tokens and obsolete account versions rejected', async () => {
  const { auth, token, user } = fixture();
  assert.match(auth.cookie(token), /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(!auth.cookie(token).includes('Domain='));
  assert.equal(auth.readToken(`${COOKIE_NAME}=507f1f77bcf86cd799439011`), null);
  assert.equal(auth.readToken(`${COOKIE_NAME}=${token}; ${COOKIE_NAME}=${token}`), null);
  assert.equal((await auth.session(`${COOKIE_NAME}=${token}`)).user.email, user.email);
  user.authVersion = 'changed';
  assert.equal(await auth.session(`${COOKIE_NAME}=${token}`), null);
});

test('lab configuration fails closed on missing/unsafe origins; local mode is untouched', () => {
  assert.throws(() => new LabAuthCore({ enabled: true }));
  assert.throws(() => new LabAuthCore({ enabled: true, allowedOrigins: ['https://lab.metrik.fit/'] }));
  const app = {};
  assert.equal(protectApp(app, new LabAuthCore()), app);
});

test('every registered HTTP handler, including raw files and fallback, requires session', async () => {
  const { app, routes } = fixture();
  for (const [method, path] of [['post', '/api/v1/projects/all'], ['get', '/api/v1/files/get'], ['any', '/*'], ['get', '/']]) {
    let called = false;
    app[method](path, () => { called = true; });
    const { res, req } = exchange({ path, method });
    routes.get(`${method} ${path}`)(res, req);
    await tick();
    assert.equal(res.status, '401');
    assert.equal(called, false);
  }
});

test('rejects malicious origins, unsafe requests without Origin, and inherited signup', async () => {
  const { app, routes, token } = fixture();
  let called = false;
  const path = '/api/v1/projects/all';
  app.post(path, () => { called = true; });
  for (const supplied of ['', 'https://evil.example', 'https://lab.metrik.fit.evil.example']) {
    const { res, req } = exchange({ path, headers: { origin: supplied, cookie: `${COOKIE_NAME}=${token}` } });
    routes.get(`post ${path}`)(res, req);
    await tick();
    assert.equal(res.status, '403');
    assert.equal(called, false);
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  }
  app.post('/api/v1/users/signUp', () => { called = true; });
  const { res, req } = exchange({ path: '/api/v1/users/signUp', headers: { origin } });
  routes.get('post /api/v1/users/signUp')(res, req);
  await tick();
  assert.equal(res.status, '404');
});

test('snapshots invalidated uWS request and replays copied body chunks after asynchronous auth', async () => {
  const { app, routes, token } = fixture();
  let received = '';
  app.post('/api/v1/instances/:id/status', (res, req) => {
    assert.equal(req.getParameter(0), 'instance1');
    assert.equal(req.getHeader('origin'), origin);
    res.onData((body, last) => { received += Buffer.from(body).toString(); if (last) res.end('ok'); });
  });
  const { req, res } = exchange({ headers: { origin, cookie: `${COOKIE_NAME}=${token}` }, parameters: ['instance1'] });
  routes.get('post /api/v1/instances/:id/status')(res, req);
  Object.keys(req).forEach(key => { req[key] = () => { throw new Error('Request invalidated'); }; });
  res.chunk('{"value":', false);
  res.chunk('42}');
  await tick();
  assert.equal(received, '{"value":42}');
  assert.equal(res.body, 'ok');
});

test('service tokens permit own MCP routes only and revoke on exit', async () => {
  const { auth, app, routes } = fixture();
  const token = auth.issueServiceToken({ instanceId: 'i1', projectId: 'p1' });
  const scope = auth.serviceScope(`Bearer ${token}`);
  assert.ok(scope);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/instances/i1/status'), true);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/instances/i2/status'), false);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/instances/i1/title'), true);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/instances/i2/title'), false);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/settings/getCredentials', {}), false);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/plans/add', { instance_id: 'i2', project_id: 'p1' }), false);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/plans/add', { instance_id: 'i1', project_id: 'p1' }), true);
  assert.equal(auth.serviceAllowed(scope, 'post', '/api/v1/observers/setInstructions', { observerId: 'other' }), false);
  let received;
  app.post('/api/v1/instances/:id/status', res => res.onData(body => { received = Buffer.from(body).toString(); }));
  const { req, res } = exchange({ path: '/api/v1/instances/i1/status', parameters: ['i1'], headers: { authorization: `Bearer ${token}` } });
  routes.get('post /api/v1/instances/:id/status')(res, req);
  res.chunk('{"status":"working"}');
  await tick();
  assert.equal(received, '{"status":"working"}');
  auth.revokeServiceToken('i1');
  assert.equal(auth.serviceScope(`Bearer ${token}`), undefined);
});

test('WebSocket upgrade requires valid session and exact allowed Origin; service tokens cannot upgrade', async () => {
  const { auth, app, routes, token } = fixture();
  app.ws('/api/v1/ws', {});
  const ws = routes.get('ws /api/v1/ws');
  for (const headers of [{}, { origin }, { origin: 'https://evil.example', cookie: `${COOKIE_NAME}=${token}` }, { origin, authorization: `Bearer ${auth.issueServiceToken({ instanceId: 'i1' })}` }]) {
    const { req, res } = exchange({ path: '/api/v1/ws', method: 'get', headers });
    ws.upgrade(res, req, {});
    await tick();
    assert.ok(['401', '403'].includes(res.status));
    assert.equal(res.upgraded, undefined);
  }
  const { req, res } = exchange({ path: '/api/v1/ws', method: 'get', headers: { origin, cookie: `${COOKIE_NAME}=${token}` } });
  ws.upgrade(res, req, {});
  await tick();
  assert.equal(res.upgraded.labSession.user.id, 'user1');
});

test('login limiter cannot be evaded by changing peer or email alone', () => {
  const { auth } = fixture();
  for (let i = 0; i < 10; i++) assert.equal(auth.takeLoginAttempt(`peer${i}`, 'same@example.com'), true);
  assert.equal(auth.takeLoginAttempt('new-peer', 'same@example.com'), false);
  for (let i = 0; i < 60; i++) assert.equal(auth.takeLoginAttempt('same-peer', `new${i}@example.com`), true);
  assert.equal(auth.takeLoginAttempt('same-peer', 'another@example.com'), false);
});
