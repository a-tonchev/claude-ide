// One-time copy of the live database into the dev database, so dev starts with the
// same projects, groups and settings but can never change live data.
//
//   node scripts/copy-db.mjs [--from claude-ide] [--to claude-ide-dev] [--uri mongodb://localhost:27017] [--force]
//
// --force drops the target database first. Without it the copy refuses to touch a
// target that already has collections.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'backend', 'package.json'));
const { MongoClient } = require('mongodb');

function readArgs(argv) {
  const args = {
    from: 'claude-ide', to: 'claude-ide-dev', uri: 'mongodb://localhost:27017', force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i].replace(/^--/, '');
    if (name === 'force') args.force = true;
    else if (name in args) {
      args[name] = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return args;
}

async function copyCollection(source, target, info) {
  const { name } = info;
  await target.createCollection(name, info.options || {});
  const from = source.collection(name);
  const to = target.collection(name);

  let batch = [];
  let copied = 0;
  for await (const doc of from.find({})) {
    batch.push(doc);
    if (batch.length === 1000) {
      // eslint-disable-next-line no-await-in-loop
      await to.insertMany(batch, { ordered: false, bypassDocumentValidation: true });
      copied += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await to.insertMany(batch, { ordered: false, bypassDocumentValidation: true });
    copied += batch.length;
  }

  const indexes = await from.indexes();
  for (const { key, v, ns, ...options } of indexes) {
    // eslint-disable-next-line no-continue
    if (options.name === '_id_') continue;
    // eslint-disable-next-line no-await-in-loop
    await to.createIndex(key, options);
  }
  return copied;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.from === args.to) throw new Error('--from and --to must be different databases');
  // The live install's database is never a copy target (--force would drop it).
  if (args.to === 'claude-ide') throw new Error('Refusing to write to "claude-ide", the live database.');

  const client = new MongoClient(args.uri);
  await client.connect();
  try {
    const source = client.db(args.from);
    const target = client.db(args.to);

    const sourceCollections = (await source.listCollections().toArray())
      .filter(c => c.type === 'collection' && !c.name.startsWith('system.'));
    if (!sourceCollections.length) throw new Error(`"${args.from}" has no collections — nothing to copy`);

    const existing = await target.listCollections().toArray();
    if (existing.length) {
      if (!args.force) {
        throw new Error(`"${args.to}" already has ${existing.length} collection(s). Pass --force to replace it.`);
      }
      await target.dropDatabase();
      console.info(`Dropped "${args.to}"`);
    }

    for (const info of sourceCollections) {
      // eslint-disable-next-line no-await-in-loop
      const count = await copyCollection(source, target, info);
      console.info(`  ${info.name}: ${count} document(s)`);
    }
    console.info(`Copied ${sourceCollections.length} collection(s) from "${args.from}" to "${args.to}".`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
