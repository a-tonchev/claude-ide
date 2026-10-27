import test from 'node:test';
import assert from 'node:assert/strict';
import { LabAuthCore, COOKIE_NAME, LOCAL_COOKIE_NAME, newToken, tokenHash, validateLabAuthBind } from '../backend/src/modules/labAuth/LabAuthCore.js';

const local = { enabled: true, allowLoopbackHttp: true, allowedOrigins: ['http://localhost:3030', 'http://localhost:6960'] };

test('HTTP authentication requires explicit opt-in and exact loopback origins only', () => {
  assert.doesNotThrow(() => new LabAuthCore(local));
  assert.doesNotThrow(() => new LabAuthCore({ ...local, allowedOrigins: ['http://127.0.0.1:3030', 'http://[::1]:6960'] }));
  for (const origin of ['http://localhost:3030', 'http://127.0.0.1:3030']) {
    assert.throws(() => new LabAuthCore({ enabled: true, allowedOrigins: [origin] }));
  }
  for (const origin of ['http://localhost:3030/', 'http://localhost.evil:3030', 'http://192.168.1.2:3030', 'https://lab.metrik.fit', 'https://localhost:3030', 'http://user@localhost:3030', 'http://localhost:3030/path', 'http://localhost:3030?x=1', 'null']) {
    assert.throws(() => new LabAuthCore({ ...local, allowedOrigins: [origin] }), origin);
  }
  assert.throws(() => new LabAuthCore({ ...local, allowedOrigins: [...local.allowedOrigins, 'https://lab.metrik.fit'] }));
  assert.throws(() => new LabAuthCore({ ...local, allowedOrigins: [] }));
});

test('HTTP exception fails closed for wildcard, LAN and DNS binds', () => {
  for (const host of ['127.0.0.1', '::1']) assert.equal(validateLabAuthBind(local, host), host);
  for (const host of [undefined, '', '0.0.0.0', '::', 'localhost', '192.168.1.2']) {
    assert.throws(() => validateLabAuthBind(local, host));
  }
  assert.equal(validateLabAuthBind({ enabled: true }, '0.0.0.0'), '0.0.0.0');
});

test('local cookie round trip uses host-only strict HttpOnly cookie and rejects HTTPS cookie', async () => {
  const token = newToken();
  const user = { _id: 'local-user', email: 'local@example.com', role: 'admin', authVersion: 'v1' };
  const db = { collection: name => ({ findOne: async query => name === 'labUsers' ? user
    : query.tokenHash === tokenHash(token) ? { userId: user._id, authVersion: 'v1', tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 10000) } : null }) };
  const auth = new LabAuthCore(local, () => db);
  const cookie = auth.cookie(token);
  assert.match(cookie, /^claude_local_session=.*; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200$/);
  assert.ok(!cookie.includes('Domain=') && !cookie.includes('Secure'));
  assert.equal((await auth.session(cookie.split(';')[0])).user.id, user._id);
  assert.equal(auth.readToken(`${COOKIE_NAME}=${token}`), null);
  assert.equal(auth.readToken(`${LOCAL_COOKIE_NAME}=${token}; ${LOCAL_COOKIE_NAME}=${token}`), null);
  assert.match(auth.cookie('', true), /Max-Age=0$/);
  const secure = new LabAuthCore({ enabled: true, allowedOrigins: ['https://lab.metrik.fit'] });
  assert.match(secure.cookie(token), /^__Host-claude_lab_session=.*; HttpOnly; Secure; SameSite=Strict;/);
  assert.equal(secure.readToken(`${LOCAL_COOKIE_NAME}=${token}`), null);
});
