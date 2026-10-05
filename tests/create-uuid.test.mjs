import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';
import createUuid from '../frontend/src/helpers/createUuid.js';

test('uses the native UUID method when available', () => {
  const api = {
    randomUUID() {
      assert.equal(this, api);
      return 'native-uuid';
    },
  };
  assert.equal(createUuid(api), 'native-uuid');
});

test('creates a UUID v4 without randomUUID, retaining version and variant bits', () => {
  assert.equal(createUuid({
    getRandomValues(bytes) {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
      return bytes;
    },
  }), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('fallback works with the real Web Crypto random source', () => {
  const api = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
  const id = createUuid(api);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('reports unsupported browsers without using weak random IDs', () => {
  assert.throws(() => createUuid({}), /Web Crypto support/);
});
