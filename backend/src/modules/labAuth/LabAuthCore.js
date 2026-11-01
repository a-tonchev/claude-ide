import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = '__Host-claude_lab_session';
export const LOCAL_COOKIE_NAME = 'claude_local_session';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

// Use a literal bind address, never DNS, for the HTTP-only local exception.
export function validateLabAuthBind(config = {}, host) {
  if (config.enabled === true && config.allowLoopbackHttp === true
    && !['127.0.0.1', '::1'].includes(host)) {
    throw new Error('labAuth.allowLoopbackHttp requires a literal loopback listenHost.');
  }
  return host;
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) {
    throw new Error('Password must contain 14 to 1024 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, passwordOptions);
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [, salt, expected] = String(encoded || '').split('$');
  if (typeof password !== 'string' || password.length > 1024 || !salt || !expected) return false;
  const hash = await scrypt(password, salt, 64, passwordOptions);
  const target = Buffer.from(expected, 'hex');
  return target.length === hash.length && timingSafeEqual(target, hash);
}

export class LabAuthCore {
  constructor(config = {}, db = () => null, prefix = '/api/v1') {
    this.config = config;
    this.enabled = config.enabled === true;
    this.localHttp = this.enabled && config.allowLoopbackHttp === true;
    this.cookieName = this.localHttp ? LOCAL_COOKIE_NAME : COOKIE_NAME;
    this.db = db;
    this.prefix = prefix;
    this.services = new Map();
    this.sockets = new Set();
    this.attempts = new Map();
    this.sessionMs = Math.min(Math.max(Number(config.sessionHours) || 12, 1), 24) * 3600000;
    if (this.enabled && (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.length
      || config.allowedOrigins.some(origin => {
        try {
          const url = new URL(origin);
          return url.origin !== origin || (this.localHttp
            ? url.protocol !== 'http:' || !loopbackHosts.has(url.hostname)
            : url.protocol !== 'https:');
        } catch { return true; }
      }))) throw new Error(this.localHttp
      ? 'labAuth.allowedOrigins must contain only exact loopback HTTP origins.'
      : 'labAuth.allowedOrigins must contain exact HTTPS origins.');
  }

  originAllowed(origin) { return this.config.allowedOrigins?.includes(origin) === true; }

  cookie(token, clear = false) {
    return `${this.cookieName}=${clear ? '' : token}; Path=/; HttpOnly; ${this.localHttp ? '' : 'Secure; '}SameSite=Strict; Max-Age=${clear ? 0 : Math.floor(this.sessionMs / 1000)}`;
  }

  readToken(cookie = '') {
    const values = cookie.split(';').map(s => s.trim()).filter(s => s.startsWith(`${this.cookieName}=`));
    const token = values.length === 1 ? values[0].slice(this.cookieName.length + 1) : '';
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }

  async session(cookie) {
    const token = this.readToken(cookie);
    if (!token) return null;
    const session = await this.db().collection('labSessions').findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const user = await this.db().collection('labUsers').findOne({ _id: session.userId, disabled: { $ne: true } });
    if (!user || user.authVersion !== session.authVersion) return null;
    return { tokenHash: session.tokenHash, expiresAt: session.expiresAt, user: { id: String(user._id), email: user.email, role: user.role } };
  }

  async ensureIndexes() {
    if (!this.enabled) return;
    await this.db().collection('labUsers').createIndex({ email: 1 }, { unique: true });
    await this.db().collection('labSessions').createIndex({ tokenHash: 1 }, { unique: true });
    await this.db().collection('labSessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  // A bounded per-peer AND per-account limiter. Forwarded headers are deliberately ignored:
  // only the trusted gateway controls access; a forged X-Forwarded-For cannot reset limits.
  takeLoginAttempt(peer, email) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    if (this.attempts.size > 10000) return false;
    const keys = [`peer:${peer}`, `email:${email}`];
    const limits = [60, 10];
    let allowed = true;
    keys.forEach((key, index) => {
      const value = this.attempts.get(key) || { count: 0, until: now + 15 * 60000 };
      value.count += 1;
      this.attempts.set(key, value);
      if (value.count > limits[index]) allowed = false;
    });
    return allowed;
  }

  issueServiceToken(scope) {
    if (!this.enabled) return undefined;
    this.revokeServiceToken(scope.instanceId);
    const token = newToken();
    this.services.set(tokenHash(token), { ...scope });
    return token;
  }

  revokeServiceToken(instanceId) {
    for (const [key, scope] of this.services) if (scope.instanceId === instanceId) this.services.delete(key);
  }

  serviceScope(authorization = '') {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
    return match ? this.services.get(tokenHash(match[1])) : null;
  }

  serviceAllowed(scope, method, path, body = {}) {
    if (!scope || method !== 'post' || !path.startsWith(`${this.prefix}/`)) return false;
    const relative = path.slice(this.prefix.length);
    if (['status', 'milestones', 'messages', 'user-input', 'title'].some(action => relative === `/instances/${scope.instanceId}/${action}`)) return true;
    if (relative === '/plans/add') return body.instance_id === scope.instanceId && body.project_id === scope.projectId;
    if (relative === '/settings/all') return body.type === 'keepass';
    if (relative === '/settings/getCredentials') return this.config.allowServiceKeePass === true;
    if (['/observers/getInstructions', '/observers/setInstructions'].includes(relative)) return !!scope.observerId && body.observerId === scope.observerId;
    return false;
  }

  closeSessionSockets(hash) {
    for (const ws of this.sockets) if (ws.labSession?.tokenHash === hash) ws.end(1008, 'Session ended');
  }
}
