import { newToken, tokenHash, verifyPassword } from './LabAuthCore.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'del', 'head', 'options', 'any']);

function snapshotRequest(req, pattern) {
  const headers = {};
  req.forEach((key, value) => { headers[key] = value; });
  const url = req.getUrl();
  const query = req.getQuery();
  const method = req.getMethod();
  const parameters = pattern.split('/').filter(part => part.startsWith(':')).map((_, i) => req.getParameter(i));
  return {
    getHeader: key => headers[key.toLowerCase()] || '',
    forEach: cb => Object.entries(headers).forEach(([key, value]) => cb(key, value)),
    getUrl: () => url,
    getQuery: key => key === undefined ? query : new URLSearchParams(query).get(key) || '',
    getMethod: () => method,
    getParameter: i => parameters[i],
  };
}

// uWS invalidates req on return and delivers bodies before asynchronous authentication
// finishes. Snapshot req and buffer only until the real handler attaches its onData.
function bridgeResponse(res, limit, onTooLarge) {
  const state = { aborted: false, done: false, chunks: [], size: 0, data: null, aborts: [] };
  res.onAborted(() => {
    state.aborted = true;
    state.chunks = [];
    state.aborts.forEach(cb => cb());
  });
  res.onData((chunk, last) => {
    if (state.aborted || state.done) return;
    state.size += chunk.byteLength;
    if (state.size > limit) { onTooLarge(); return; }
    if (state.data) state.data(chunk, last);
    else state.chunks.push([new Uint8Array(chunk).slice().buffer, last]);
  });
  let proxy;
  proxy = new Proxy(res, {
    get(target, name) {
      if (name === 'onAborted') return cb => { state.aborts.push(cb); return proxy; };
      if (name === 'onData') return cb => {
        state.data = cb;
        const chunks = state.chunks;
        state.chunks = [];
        chunks.forEach(([chunk, last]) => { if (!state.aborted && !state.done) cb(chunk, last); });
        return proxy;
      };
      if (name === 'end' || name === 'upgrade') return (...args) => {
        state.done = true;
        state.chunks = [];
        return target[name](...args);
      };
      const value = target[name];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { res: proxy, state };
}

function json(res, state, auth, origin, status, body, cookie) {
  if (state.aborted || state.done) return;
  res.cork(() => {
    res.writeStatus(`${status}`).writeHeader('Content-Type', 'application/json')
      .writeHeader('Cache-Control', 'no-store').writeHeader('X-Content-Type-Options', 'nosniff');
    if (auth.originAllowed(origin)) {
      res.writeHeader('Access-Control-Allow-Origin', origin)
        .writeHeader('Access-Control-Allow-Credentials', 'true').writeHeader('Vary', 'Origin');
    }
    if (cookie) res.writeHeader('Set-Cookie', cookie);
    res.end(JSON.stringify(body));
  });
}

function readBody(res, max = 16384) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    res.onAborted(() => reject(new Error('Aborted')));
    res.onData((chunk, last) => {
      size += chunk.byteLength;
      if (size > max) { reject(new Error('Body too large')); return; }
      chunks.push(Buffer.from(new Uint8Array(chunk)));
      if (last) {
        try { resolve({ body: JSON.parse(Buffer.concat(chunks).toString() || '{}'), raw: Buffer.concat(chunks) }); }
        catch { reject(new Error('Invalid JSON')); }
      }
    });
  });
}

async function authEndpoint(auth, res, req, state, send, peer) {
  const route = req.getUrl().slice(`${auth.prefix}/lab-auth/`.length);
  const method = req.getMethod();
  if (route === 'check' && method === 'get') {
    const session = await auth.session(req.getHeader('cookie'));
    send(session ? 200 : 401, { ok: !!session });
    return;
  }
  if (route === 'session' && method === 'get') {
    const session = await auth.session(req.getHeader('cookie'));
    send(200, { ok: true, enabled: true, user: session?.user || null });
    return;
  }
  if (!auth.originAllowed(req.getHeader('origin'))) { send(403, { ok: false, message: 'Origin denied' }); return; }
  if (route === 'login' && method === 'post') {
    const { body } = await readBody(res);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!auth.takeLoginAttempt(peer, email)) { send(429, { ok: false, message: 'Too many attempts. Try again in 15 minutes.' }); return; }
    const user = await auth.db().collection('labUsers').findOne({ email, disabled: { $ne: true } });
    // Spend the same scrypt work on unknown accounts to avoid an account oracle.
    const dummy = 'scrypt-v1$00000000000000000000000000000000$' + '00'.repeat(64);
    const valid = await verifyPassword(body.password, user?.passwordHash || dummy);
    if (!user || !valid) { send(401, { ok: false, message: 'Invalid email or password.' }); return; }
    const old = auth.readToken(req.getHeader('cookie'));
    if (old) {
      await auth.db().collection('labSessions').deleteOne({ tokenHash: tokenHash(old) });
      auth.closeSessionSockets(tokenHash(old));
    }
    const token = newToken();
    await auth.db().collection('labSessions').insertOne({
      tokenHash: tokenHash(token), userId: user._id, authVersion: user.authVersion,
      createdAt: new Date(), expiresAt: new Date(Date.now() + auth.sessionMs),
    });
    send(200, { ok: true, user: { id: String(user._id), email: user.email, role: user.role } }, auth.cookie(token));
    return;
  }
  if (route === 'logout' && method === 'post') {
    const token = auth.readToken(req.getHeader('cookie'));
    if (token) {
      await auth.db().collection('labSessions').deleteOne({ tokenHash: tokenHash(token) });
      auth.closeSessionSockets(tokenHash(token));
    }
    send(200, { ok: true }, auth.cookie('', true));
    return;
  }
  send(404, { ok: false, message: 'Not found' });
}

export default function protectApp(app, auth) {
  if (!auth.enabled) return app;
  let protectedApp;
  const wrap = (pattern, handler) => (rawRes, rawReq) => {
    const req = snapshotRequest(rawReq, pattern);
    const origin = req.getHeader('origin');
    let send;
    const isAuth = req.getUrl().startsWith(`${auth.prefix}/lab-auth/`);
    const { res, state } = bridgeResponse(rawRes, isAuth ? 16384 : 26 * 1024 * 1024,
      () => send(413, { ok: false, message: 'Request too large' }));
    send = (status, body, cookie) => json(res, state, auth, origin, status, body, cookie);
    const peer = Buffer.from(rawRes.getRemoteAddress()).toString('hex');
    if (origin && !auth.originAllowed(origin)) { send(403, { ok: false, message: 'Origin denied' }); return; }
    if (req.getMethod() === 'options') {
      if (!auth.originAllowed(origin)) { send(403, { ok: false }); return; }
      rawRes.cork(() => rawRes.writeStatus('204').writeHeader('Access-Control-Allow-Origin', origin)
        .writeHeader('Access-Control-Allow-Credentials', 'true')
        .writeHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .writeHeader('Access-Control-Allow-Headers', 'content-type, authorization, lang, domain-key, x-requested-with')
        .writeHeader('Vary', 'Origin').end());
      state.done = true;
      return;
    }
    (async () => {
      if (isAuth) { await authEndpoint(auth, res, req, state, send, peer); return; }
      // Disable the inherited signup/reset/login API entirely in lab mode.
      if (req.getUrl().startsWith(`${auth.prefix}/users/`)) { send(404, { ok: false }); return; }
      const scope = auth.serviceScope(req.getHeader('authorization'));
      if (scope && !origin) {
        const { body, raw } = await readBody(res, 1024 * 1024);
        if (!auth.serviceAllowed(scope, req.getMethod(), req.getUrl(), body)) { send(403, { ok: false, message: 'Service scope denied' }); return; }
        // Re-play the consumed JSON for the existing route parser.
        state.data = null;
        state.chunks = [[raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), true]];
        req.labPrincipal = { type: 'service', scope };
      } else {
        const session = await auth.session(req.getHeader('cookie'));
        if (!session) { send(401, { ok: false, message: 'Sign in required' }); return; }
        if (!['get', 'head'].includes(req.getMethod()) && !auth.originAllowed(origin)) {
          send(403, { ok: false, message: 'Origin required' }); return;
        }
        req.labPrincipal = { type: 'user', user: session.user };
      }
      if (!state.aborted && !state.done) res.cork(() => handler(res, req));
    })().catch(() => send(503, { ok: false, message: 'Authentication unavailable' }));
  };

  protectedApp = new Proxy(app, {
    get(target, name) {
      if (HTTP_METHODS.has(name)) return (pattern, handler) => { target[name](pattern, wrap(pattern, handler)); return protectedApp; };
      if (name === 'ws') return (pattern, behavior) => {
        target.ws(pattern, {
          ...behavior,
          upgrade(rawRes, rawReq, context) {
            const req = snapshotRequest(rawReq, pattern);
            const origin = req.getHeader('origin');
            let aborted = false;
            rawRes.onAborted(() => { aborted = true; });
            if (!auth.originAllowed(origin)) { rawRes.writeStatus('403').end(); return; }
            auth.session(req.getHeader('cookie')).then(session => {
              if (aborted) return;
              if (!session) { rawRes.cork(() => rawRes.writeStatus('401').end()); return; }
              rawRes.cork(() => rawRes.upgrade({ labSession: session, labCookie: req.getHeader('cookie') },
                req.getHeader('sec-websocket-key'), req.getHeader('sec-websocket-protocol'),
                req.getHeader('sec-websocket-extensions'), context));
            }).catch(() => { if (!aborted) rawRes.cork(() => rawRes.writeStatus('503').end()); });
          },
          open(ws) {
            auth.sockets.add(ws);
            ws.labExpiryTimer = setTimeout(() => ws.end(1008, 'Session expired'), Math.max(0, +new Date(ws.labSession.expiresAt) - Date.now()));
            // Re-check disabled accounts and password resets even on idle subscribed sockets.
            ws.labCheckTimer = setInterval(() => {
              auth.session(ws.labCookie).then(session => { if (!session && auth.sockets.has(ws)) ws.end(1008, 'Session ended'); })
                .catch(() => { if (auth.sockets.has(ws)) ws.end(1011, 'Authentication unavailable'); });
            }, 30000);
            behavior.open?.(ws);
          },
          message(ws, message, binary) {
            const copied = new Uint8Array(message).slice().buffer;
            ws.labMessageQueue = (ws.labMessageQueue || Promise.resolve()).then(() => auth.session(ws.labCookie)).then(session => {
              if (!auth.sockets.has(ws)) return;
              if (!session) { ws.end(1008, 'Session ended'); return; }
              ws.labSession = session;
              behavior.message?.(ws, copied, binary);
            }).catch(() => { if (auth.sockets.has(ws)) ws.end(1011, 'Authentication unavailable'); });
          },
          close(ws, ...args) {
            auth.sockets.delete(ws);
            clearTimeout(ws.labExpiryTimer);
            clearInterval(ws.labCheckTimer);
            behavior.close?.(ws, ...args);
          },
        });
        return protectedApp;
      };
      const value = target[name];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  // Routes must precede the wildcard fallback. Their handlers are implemented above.
  ['session', 'check', 'login', 'logout'].forEach(route => {
    const method = ['session', 'check'].includes(route) ? 'get' : 'post';
    protectedApp[method](`${auth.prefix}/lab-auth/${route}`, () => {});
  });
  return protectedApp;
}
