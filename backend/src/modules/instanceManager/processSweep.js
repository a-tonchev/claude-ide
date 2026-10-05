import os from 'os';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

import { MCP_SERVER_PATH } from '../../../mcp/setupMcp.js';

const execFileAsync = promisify(execFile);
const platform = os.platform();
const MAX_BUFFER = 32 * 1024 * 1024;

// chrome-devtools-mcp is started by Claude from the user's own MCP config, so its
// command line says nothing about which install (live or dev) owns it.
const SHARED_MCP_PATTERN = /chrome-devtools-mcp/i;

const WINDOWS_PROCESS_QUERY = [
  '-NoProfile', '-NonInteractive', '-Command',
  'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,'
    + "@{n='Created';e={if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }}}"
    + ' | ConvertTo-Json -Compress',
];
const POSIX_PS_ARGS = ['-A', '-o', 'pid=,ppid=,args='];

const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Our MCP server runs as `node <absolute path>\backend\mcp\server.js`. Matching the
// full path as its own token keeps a second install on this machine from killing
// the other install's servers. Backslashes are swapped one-for-one, so a
// JSON-escaped copy of the path inside another command line (Codex's -c config)
// never matches.
function createOwnServerMatcher(ownServerPath) {
  const normalized = escapeRegExp(ownServerPath.replace(/\\/g, '/'));
  const rx = new RegExp(`(^|[\\s"'])${normalized}($|[\\s"'])`, 'i');
  return cmd => rx.test(cmd.replace(/\\/g, '/'));
}

function parseWindowsTable(out) {
  const raw = JSON.parse(out);
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(p => ({
    pid: p.ProcessId,
    ppid: p.ParentProcessId,
    cmd: p.CommandLine || '',
    created: p.Created || 0,
  }));
}

function parsePosixTable(out) {
  return out.split('\n').filter(Boolean).map(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) return null;
    return {
      pid: Number(m[1]), ppid: Number(m[2]), cmd: m[3], created: 0,
    };
  }).filter(Boolean);
}

// Reading the table takes a couple of seconds on Windows (PowerShell + CIM), so only
// startup and shutdown use the blocking read.
export function readProcessTable() {
  try {
    if (platform === 'win32') {
      return parseWindowsTable(execFileSync('powershell.exe', WINDOWS_PROCESS_QUERY, {
        encoding: 'utf8', maxBuffer: MAX_BUFFER, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      }));
    }
    return parsePosixTable(execFileSync('ps', POSIX_PS_ARGS, { encoding: 'utf8', maxBuffer: MAX_BUFFER }));
  } catch {
    return [];
  }
}

export async function readProcessTableAsync() {
  try {
    if (platform === 'win32') {
      const { stdout } = await execFileAsync('powershell.exe', WINDOWS_PROCESS_QUERY, {
        encoding: 'utf8', maxBuffer: MAX_BUFFER, windowsHide: true,
      });
      return parseWindowsTable(stdout);
    }
    const { stdout } = await execFileAsync('ps', POSIX_PS_ARGS, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
    return parsePosixTable(stdout);
  } catch {
    return [];
  }
}

export function descendantsOf(rootPid, table) {
  const childMap = new Map();
  for (const p of table) {
    if (!childMap.has(p.ppid)) childMap.set(p.ppid, []);
    childMap.get(p.ppid).push(p.pid);
  }
  const found = new Set();
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    const children = childMap.get(pid) || [];
    for (const c of children) {
      if (!found.has(c)) {
        found.add(c);
        stack.push(c);
      }
    }
  }
  return [...found];
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

export function killPids(pids) {
  const killed = [];
  for (const pid of pids) {
    if (killPid(pid)) killed.push(pid);
  }
  return killed;
}

// Decide which MCP-shaped processes are leftovers this backend may kill:
// - this install's own MCP server, unless it sits under a protected root;
// - chrome-devtools-mcp whose owner is gone. Wrapper layers (cmd /c npx …) also
//   mention chrome-devtools-mcp, so the owner is the first ancestor that doesn't.
export function selectMcpOrphans(table, { ownServerPath, excludeRootPids = [] }) {
  const byPid = new Map(table.map(p => [p.pid, p]));
  const roots = excludeRootPids.filter(Boolean);
  const protectedPids = new Set(roots);
  for (const rootPid of roots) {
    for (const d of descendantsOf(rootPid, table)) protectedPids.add(d);
  }
  const isOwnServer = createOwnServerMatcher(ownServerPath);
  const isShared = p => SHARED_MCP_PATTERN.test(p.cmd);

  const ownerIsGone = proc => {
    const seen = new Set();
    let current = proc;
    while (!seen.has(current.pid)) {
      seen.add(current.pid);
      // PID 1 is init on POSIX, where orphans get reparented to it.
      const parent = current.ppid > 1 ? byPid.get(current.ppid) : null;
      if (!parent) return true;
      // Windows never reparents and reuses PIDs: a "parent" started after its
      // child is an unrelated process that inherited the dead parent's PID.
      if (parent.created && current.created && parent.created > current.created) return true;
      if (!isShared(parent)) return false;
      current = parent;
    }
    return false;
  };

  return table.filter(p => {
    if (protectedPids.has(p.pid)) return false;
    if (isOwnServer(p.cmd)) return true;
    return isShared(p) && ownerIsGone(p);
  });
}

function killOrphans(table, options) {
  const killed = [];
  for (const p of selectMcpOrphans(table, options)) {
    if (killPid(p.pid)) killed.push({ pid: p.pid, cmd: p.cmd.slice(0, 100) });
  }
  return killed;
}

// Kill MCP leftovers (see selectMcpOrphans) without blocking. The protected roots are
// read once the table is in, so an instance started while it was being read stays safe.
export async function sweepMcpOrphansAsync({ getExcludeRootPids, ownServerPath = MCP_SERVER_PATH }) {
  const table = await readProcessTableAsync();
  return killOrphans(table, { excludeRootPids: getExcludeRootPids(), ownServerPath });
}
