import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Import without a browser: tests exercise the factory with isolated tab/worker event targets.
const moduleSource = await readFile(new URL('../frontend/src/components/helpers/SWHelper.js', import.meta.url), 'utf8');
const { createSWHelper } = await import(`data:text/javascript,${encodeURIComponent(moduleSource.replace('export default createSWHelper(window, navigator);', ''))}`);
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const page = new EventTarget();
  let reloads = 0;
  page.location = { href: 'https://ide.example/window/id', reload: () => { reloads += 1; } };
  const serviceWorker = new EventTarget();
  const worker = new EventTarget();
  worker.state = 'installed';
  worker.messages = [];
  worker.postMessage = message => worker.messages.push(message);
  const old = { postMessage() {} };
  serviceWorker.controller = old;
  const registration = { waiting: worker, active: old, update: async () => {} };
  serviceWorker.getRegistration = async url => { assert.equal(url, page.location.href); return registration; };
  return { page, serviceWorker, worker, registration, reloads: () => reloads,
    helper: createSWHelper(page, { serviceWorker }, 50) };
}

test('Update waits for controlling worker, deduplicates clicks, reloads once', async () => {
  const f = fixture();
  const update = f.helper.updateByUser();
  assert.equal(f.helper.updateByUser(), update);
  await tick();
  assert.deepEqual(f.worker.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(f.reloads(), 0);
  f.worker.state = 'activated';
  f.worker.dispatchEvent(new Event('statechange'));
  assert.equal(f.reloads(), 0, 'activated alone does not mean this page is controlled');
  f.serviceWorker.controller = f.worker;
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  await update;
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads(), 1);
});

test('another tab activating an update does not reload a tab without consent', () => {
  const f = fixture();
  f.serviceWorker.controller = f.worker;
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads(), 0);
});

test('activation failure is retryable and never reloads the old worker', async () => {
  const f = fixture();
  const update = f.helper.updateByUser();
  await assert.rejects(update, /taking too long/);
  assert.equal(f.reloads(), 0);
  const retry = f.helper.updateByUser();
  await tick();
  f.serviceWorker.controller = f.worker;
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  await retry;
  assert.equal(f.reloads(), 1);
});

test('an installing worker is activated after installation; another tab already updated can reload', async () => {
  const f = fixture();
  f.registration.waiting = null;
  f.registration.installing = f.worker;
  f.worker.state = 'installing';
  const update = f.helper.updateByUser();
  await tick();
  assert.equal(f.worker.messages.length, 0);
  f.worker.state = 'installed';
  f.worker.dispatchEvent(new Event('statechange'));
  assert.deepEqual(f.worker.messages, [{ type: 'SKIP_WAITING' }]);
  f.serviceWorker.controller = f.worker;
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  await update;
  const other = fixture();
  other.registration.waiting = null;
  await other.helper.updateByUser();
  assert.equal(other.reloads(), 1);
});

test('worker activation uses waitUntil; legacy reload affects only the requesting tab', async () => {
  const source = await readFile(new URL('../frontend/src/service-worker.js', import.meta.url), 'utf8');
  let handler;
  let skips = 0;
  let navigations = 0;
  const sender = { url: 'https://ide.example/', navigate: async () => { navigations += 1; }, postMessage() {} };
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, ''), {
    self: { __WB_MANIFEST: [], location: { origin: 'https://ide.example' }, skipWaiting: async () => { skips += 1; },
      clients: { matchAll: async () => [sender] }, addEventListener: (type, callback) => { if (type === 'message') handler = callback; } },
    clientsClaim() {}, setCacheNameDetails() {}, precacheAndRoute() {}, createHandlerBoundToURL() {}, registerRoute() {},
    StaleWhileRevalidate: class {}, ExpirationPlugin: class {},
  });
  let completion;
  handler({ data: { type: 'SKIP_WAITING' }, waitUntil: promise => { completion = promise; } });
  await completion;
  assert.equal(skips, 1);
  handler({ data: { type: 'RELOAD_CLIENTS' }, source: sender, waitUntil: promise => { completion = promise; } });
  await completion;
  assert.equal(navigations, 1);
  assert.ok(!source.includes('caches.delete'), 'activation cannot delete other applications caches');
});
