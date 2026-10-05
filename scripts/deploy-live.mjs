// Build this checkout and deploy it as the live install that runs all the time.
//
//   npm run deploy:live                     (from the repo root)
//   node scripts/deploy-live.mjs [--yes] [--skip-build] [--frontend-only] [--target D:/Programs/claude-ide]
//
// --frontend-only rebuilds and copies just the UI: the live backend and its running
// instances keep running (pm2's static server serves the new files right away).
//
// The live backend has its own settings.js (port 6950, database claude-ide). The first
// deploy derives it from the dev one; later deploys keep whatever is there.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_API_PORT = 6950;
const LIVE_UI_PORT = 3010;
const LIVE_DB = 'claude-ide';
const PM2_APPS = 'claude-ide-backend,claude-ide-frontend';

function readArgs(argv) {
  const args = {
    yes: false, skipBuild: false, frontendOnly: false, target: 'D:/Programs/claude-ide',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--yes') args.yes = true;
    else if (argv[i] === '--skip-build') args.skipBuild = true;
    else if (argv[i] === '--frontend-only') args.frontendOnly = true;
    else if (argv[i] === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return args;
}

// npm and pm2 are .cmd shims on Windows, so they need a shell, which takes one command
// line (Node warns about passing an argument list together with shell: true).
function run(command, commandArgs, { cwd = ROOT, allowFailure = false } = {}) {
  const line = [command, ...commandArgs].map(part => (/\s/.test(part) ? `"${part}"` : part)).join(' ');
  console.info(`\n> ${line}`);
  const result = spawnSync(line, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${commandArgs[0]} failed with exit code ${result.status}`);
  }
  return result.status;
}

// robocopy exit codes below 8 all mean success (files copied, extras removed, ...).
function mirror(from, to, extraArgs = []) {
  console.info(`\n> mirror ${from} -> ${to}`);
  const result = spawnSync('robocopy', [from, to, '/MIR', '/MT:16', '/R:2', '/W:2', '/NFL', '/NDL', '/NP', '/NJH', ...extraArgs], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status >= 8) throw new Error(`robocopy failed with exit code ${result.status}`);
}

const isListening = port => new Promise(resolve => {
  const socket = net.connect({ port, host: '127.0.0.1' });
  socket.setTimeout(1000);
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  socket.once('error', () => resolve(false));
});

async function confirmRestart(args) {
  if (!(await isListening(LIVE_API_PORT))) return;
  const warning = `The live backend is running on port ${LIVE_API_PORT}. Deploying restarts it: running live `
    + 'instances stop and move to the remembered list, where they can be started again.';
  if (args.yes) {
    console.warn(warning);
    return;
  }
  if (!process.stdin.isTTY) throw new Error(`${warning}\nRun again with --yes to deploy anyway.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${warning}\nContinue? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) throw new Error('Deploy cancelled.');
}

function liveSettingsFrom(devSettings) {
  const live = devSettings
    .replace(/claude-ide-dev/g, LIVE_DB)
    .replace(/port:\s*\d+/, `port: ${LIVE_API_PORT}`);
  if (!live.includes(`port: ${LIVE_API_PORT}`) || !live.includes(`'${LIVE_DB}'`)) {
    throw new Error('Could not derive the live settings.js from backend/settings.js (expected port and dbName). '
      + 'Create it by hand in the live backend folder, then deploy again.');
  }
  return live;
}

async function main() {
  if (process.platform !== 'win32') throw new Error('deploy-live targets the Windows install (robocopy + pm2).');
  const args = readArgs(process.argv.slice(2));
  const target = path.resolve(args.target);
  const liveBackend = path.join(target, 'backend');
  const liveSettingsPath = path.join(liveBackend, 'settings.js');
  const buildDir = path.join(ROOT, 'frontend', 'build');

  if (!args.frontendOnly) await confirmRestart(args);

  if (!args.skipBuild) run('npm', ['run', 'build'], { cwd: path.join(ROOT, 'frontend') });
  if (!fs.existsSync(path.join(buildDir, 'index.html'))) throw new Error(`No frontend build found at ${buildDir}`);

  if (args.frontendOnly) {
    mirror(buildDir, path.join(target, 'frontend'));
    console.info(`\nLive UI updated in ${target}/frontend (backend untouched). Reload the page to use it.`);
    return;
  }

  // Read before mirroring: /MIR replaces the live backend folder with the checkout.
  const liveSettings = fs.existsSync(liveSettingsPath)
    ? fs.readFileSync(liveSettingsPath, 'utf8')
    : liveSettingsFrom(fs.readFileSync(path.join(ROOT, 'backend', 'settings.js'), 'utf8'));

  fs.mkdirSync(target, { recursive: true });
  run('pm2', ['stop', 'claude-ide-backend'], { allowFailure: true });
  // The live mcp-config.json points at the live server and port; the backend writes its own.
  mirror(path.join(ROOT, 'backend'), liveBackend, ['/XF', 'mcp-config.json']);
  fs.writeFileSync(liveSettingsPath, liveSettings);
  mirror(buildDir, path.join(target, 'frontend'));

  // The backend was stopped on purpose, so start or restart rather than reload.
  run('pm2', ['startOrRestart', path.join(ROOT, 'ecosystem.config.cjs'), '--only', PM2_APPS]);
  run('pm2', ['save']);

  console.info(`\nLive system deployed to ${target}`);
  console.info(`  UI:  http://localhost:${LIVE_UI_PORT}`);
  console.info(`  API: http://localhost:${LIVE_API_PORT}`);
}

main().catch(err => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
