import crypto from 'crypto';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Every process a WSL terminal starts inherits this variable (passed in through WSLENV),
// so the terminal's programs can be found and stopped even after their parents died.
export const WSL_MARKER_VAR = 'CLAUDE_IDE_TERMINAL';

const SAFE_VALUE = /^[0-9a-z:-]+$/i;
const WSL_TIMEOUT_MS = 20000;

// Scoped per install (live vs dev) by its backend folder, so one backend never stops the
// other's terminal processes.
export const installKey = backendDir => crypto.createHash('sha1')
  .update(backendDir.toLowerCase())
  .digest('hex')
  .slice(0, 10);

// <install>:<backend run>:<instance id>
export const terminalMarker = ({ installKey: key, bootId, instanceId }) => `${key}:${bootId}:${instanceId}`;

export function withTerminalMarker(env, marker) {
  const next = { ...env };
  let wslenv = '';
  for (const name of Object.keys(next)) {
    if (name.toUpperCase() === 'WSLENV') {
      wslenv = next[name] || '';
      delete next[name];
    }
  }
  const entries = wslenv.split(':').filter(entry => entry && entry.split('/')[0] !== WSL_MARKER_VAR);
  return { ...next, [WSL_MARKER_VAR]: marker, WSLENV: [...entries, `${WSL_MARKER_VAR}/u`].join(':') };
}

const safe = value => {
  if (typeof value !== 'string' || !SAFE_VALUE.test(value)) throw new Error(`Unsafe WSL marker value: ${value}`);
  return value;
};

// Shell script run inside the distro. Selectors:
// - { marker }                   one terminal's processes;
// - { installKey, bootId }       every terminal of one backend run (shutdown);
// - { installKey, exceptBootId } this install's leftovers from earlier runs (startup).
// procRoot and killCommand exist for tests.
export function buildKillScript({
  marker, installKey: key, bootId, exceptBootId,
}, { procRoot = '/proc', killCommand = 'kill -KILL' } = {}) {
  const read = 'tr \'\\0\' \'\\n\' < "$f"';
  let condition;
  if (marker) {
    condition = `${read} | grep -qx '${WSL_MARKER_VAR}=${safe(marker)}'`;
  } else if (key && bootId) {
    condition = `${read} | grep -q '^${WSL_MARKER_VAR}=${safe(key)}:${safe(bootId)}:'`;
  } else if (key && exceptBootId) {
    condition = `${read} | grep -q '^${WSL_MARKER_VAR}=${safe(key)}:'`
      + ` && ! ${read} | grep -q '^${WSL_MARKER_VAR}=${safe(key)}:${safe(exceptBootId)}:'`;
  } else {
    throw new Error('buildKillScript needs a marker, or an installKey with bootId or exceptBootId');
  }
  return [
    'n=0',
    `for d in "${procRoot}"/[0-9]*; do`,
    '  f="$d/environ"',
    '  [ -r "$f" ] || continue',
    `  if ${condition}; then ${killCommand} "\${d##*/}" 2>/dev/null && n=$((n+1)); fi`,
    'done',
    'echo "$n"',
  ].join('\n');
}

// wsl.exe prints its own messages as UTF-16LE; output from inside the distro is UTF-8.
const decode = output => (Buffer.isBuffer(output)
  ? output.toString(output.includes(0) ? 'utf16le' : 'utf8')
  : String(output)).replace(/\0/g, '');

const wslArgs = (distro, script) => ['-d', distro, '-e', 'sh', '-c', script];

// The kill itself must not carry a marker, or it could match its own shell.
const unmarkedEnv = () => {
  const env = { ...process.env };
  delete env[WSL_MARKER_VAR];
  return env;
};

async function isDistroRunning(distro) {
  try {
    const { stdout } = await execFileAsync('wsl.exe', ['-l', '--running', '-q'], {
      encoding: 'buffer', windowsHide: true, timeout: WSL_TIMEOUT_MS,
    });
    return decode(stdout).split(/\r?\n/).map(line => line.trim()).includes(distro);
  } catch {
    return false;
  }
}

// Resolves to the number of processes killed. With onlyIfRunning a stopped distro is left
// alone, so a sweep never boots WSL just to find nothing.
export async function killMarkedWslProcesses(distro, selector, { onlyIfRunning = false } = {}) {
  if (process.platform !== 'win32' || !distro) return 0;
  const script = buildKillScript(selector);
  if (onlyIfRunning && !(await isDistroRunning(distro))) return 0;
  const { stdout } = await execFileAsync('wsl.exe', wslArgs(distro, script), {
    encoding: 'buffer', windowsHide: true, timeout: WSL_TIMEOUT_MS, env: unmarkedEnv(),
  });
  return Number.parseInt(decode(stdout), 10) || 0;
}

// For shutdown, when the backend exits right after.
export function killMarkedWslProcessesSync(distro, selector) {
  if (process.platform !== 'win32' || !distro) return 0;
  try {
    const stdout = execFileSync('wsl.exe', wslArgs(distro, buildKillScript(selector)), {
      windowsHide: true, timeout: WSL_TIMEOUT_MS, env: unmarkedEnv(), stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Number.parseInt(decode(stdout), 10) || 0;
  } catch {
    return 0;
  }
}
