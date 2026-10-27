import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const ipaddr = require('ipaddr.js');
const errors = [];
const source = readFileSync(new URL('../backend/startup/startupHelpers/setupContext.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?$/gm, '')
  .replace('export default setupContext;', 'globalThis.setupContext = setupContext;');
const context = vm.createContext({
  ipaddr, URLSearchParams, Uint8Array,
  ContextError: Error, jsonParser: async () => null, setupUserAgent: () => {},
  console: { error: (...args) => errors.push(args) },
});
vm.runInContext(source, context);

for (const [address, expected] of [
  ['192.0.2.10', '192.0.2.10'],
  ['127.0.0.1', '127.0.0.1'],
  ['::ffff:192.0.2.10', '192.0.2.10'],
  ['::ffff:127.0.0.1', '127.0.0.1'],
  ['2001:db8::1234', '2001:db8::1234'],
  ['::1', '127.0.0.1'],
]) {
  test(`request context records ${address} without IPv4 conversion errors`, async () => {
    errors.length = 0;
    const bytes = Uint8Array.from(ipaddr.parse(address).toByteArray());
    const req = { getQuery: () => '', getUrl: () => '/api/v1/plans/add', forEach: () => {} };
    const res = { getRemoteAddress: () => bytes.buffer };
    const ctx = await context.setupContext(req, res, '/api/v1/plans/add');
    assert.equal(ctx.request.ip, expected);
    assert.equal(errors.length, 0);
  });
}
