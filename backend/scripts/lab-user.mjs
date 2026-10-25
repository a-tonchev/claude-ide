#!/usr/bin/env node
// Run from backend: node --import ./register.mjs scripts/lab-user.mjs --secret-file /run/secrets/lab-admin-password
// Additional personal accounts: --email colleague@example.com --role member --secret-file ...
// Password rotation: add --reset. Account revocation: --email ... --disable.
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { hashPassword } from '../src/modules/labAuth/LabAuthCore.js';

const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
const email = (value('--email') || 'at.tonchev@gmail.com').trim().toLowerCase();
const role = value('--role') || (email === 'at.tonchev@gmail.com' ? 'admin' : 'member');
let client;
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'member'].includes(role)) throw new Error('Provide a valid email and admin/member role.');
  const { default: allSettings } = await import('../settings.js');
  const settings = allSettings[process.env.environment || 'local'];
  if (!settings?.labAuth?.enabled) throw new Error('Lab authentication must be enabled in the selected settings.');
  let passwordHash;
  if (!args.includes('--disable')) {
    const secretFile = value('--secret-file');
    if (!!secretFile === args.includes('--stdin')) throw new Error('Use exactly one of --secret-file /absolute/external/path or --stdin.');
    let password;
    if (secretFile) {
      if (!path.isAbsolute(secretFile)) throw new Error('The secret file must use an absolute path outside the repository.');
      const repo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
      const resolved = await realpath(secretFile);
      const relative = path.relative(repo, resolved);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('Secret files must be outside the repository.');
      password = await readFile(resolved, 'utf8');
    } else {
      if (process.stdin.isTTY) throw new Error('Pipe the password over stdin; do not enter it as a command argument.');
      const chunks = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        size += chunk.length;
        if (size > 8192) throw new Error('Secret input is too large.');
        chunks.push(chunk);
      }
      password = Buffer.concat(chunks).toString('utf8');
    }
    password = password.replace(/\r?\n$/, '');
    passwordHash = await hashPassword(password);
    password = null;
  }
  client = new MongoClient(settings.MONGO_URL);
  await client.connect();
  const db = client.db(settings.dbName);
  await db.collection('labUsers').createIndex({ email: 1 }, { unique: true });
  await db.collection('labSessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('labSessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const users = db.collection('labUsers');
  const existing = await users.findOne({ email });
  if (args.includes('--disable')) {
    if (!existing) throw new Error('Account does not exist.');
    await users.updateOne({ _id: existing._id }, { $set: { disabled: true, authVersion: randomUUID(), updatedAt: new Date() } });
  } else if (existing) {
    if (!args.includes('--reset')) throw new Error('Account already exists. Use --reset to rotate its password and revoke sessions.');
    await users.updateOne({ _id: existing._id }, { $set: { passwordHash, role, disabled: false, authVersion: randomUUID(), updatedAt: new Date() } });
  } else {
    await users.insertOne({ email, role, passwordHash, disabled: false, authVersion: randomUUID(), createdAt: new Date() });
  }
  if (existing) await db.collection('labSessions').deleteMany({ userId: existing._id });
  console.info(`Lab account ${args.includes('--disable') ? 'disabled' : existing ? 'updated' : 'created'}: ${email}`);
} catch (error) {
  // Driver errors can contain connection strings. Keep failures generic except our own validations.
  const safe = error.name === 'Error' ? error.message : 'Database operation failed.';
  console.error(`Lab account provisioning failed: ${safe}`);
  process.exitCode = 1;
} finally { await client?.close(); }
