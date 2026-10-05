import fs from 'fs';
import os from 'os';
import path from 'path';

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLLOUT_RX = /^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-([0-9a-f-]{36})\.jsonl$/i;
const MAX_LOOKUP_DAYS = 7;
// session_meta (ids, cwd, thread source) comes first, before Codex's long base instructions.
const ROLLOUT_META_BYTES = 8 * 1024;
// The dashboard instructions follow those base instructions, a few tens of KB in.
const ROLLOUT_HEAD_BYTES = 256 * 1024;
// Rollout names carry whole seconds, so a session can look slightly older than its process.
const START_TOLERANCE_MS = 2000;

export const isUuid = value => typeof value === 'string' && UUID_RX.test(value);

// Put at the top of a Codex instance's instructions, so the session file Codex writes
// can be traced back to the dashboard instance that started it.
export const codexInstanceMarker = instanceId => `claude-ide-instance:${instanceId}`;

const pad = n => String(n).padStart(2, '0');

const samePath = (a, b) => {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
};

// Claude keeps each conversation at <config dir>/projects/<encoded cwd>/<sessionId>.jsonl.
// Searching every project folder avoids depending on how the cwd gets encoded.
export function findClaudeTranscript(sessionId, { claudeDir } = {}) {
  if (!isUuid(sessionId)) return null;
  const root = claudeDir || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projectsDir = path.join(root, 'projects');
  let entries;
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const file = path.join(projectsDir, entry.name, `${sessionId}.jsonl`);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

function readHead(file, bytes) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buffer = Buffer.allocUnsafe(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.toString('utf8', 0, read);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function readCwd(head) {
  const match = head.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
}

// Subagent threads spawned inside a session carry the same instructions; only the
// thread the user started is the instance's session.
function isPrimaryThread(head) {
  const source = head.match(/"thread_source":"([^"]*)"/);
  if (source) return source[1] === 'user';
  const sessionId = head.match(/"session_id":"([^"]*)"/);
  const id = head.match(/"id":"([^"]*)"/);
  return !sessionId || !id || sessionId[1] === id[1];
}

// Codex can't be given a session id up front. It names each session file after the
// session id and its local start time, in sessions/YYYY/MM/DD, and writes the file at
// the first turn. An instance's session is the primary thread for its cwd, started
// after the instance, whose instructions carry the instance's marker.
export function findCodexSession({
  cwd, startedAt, instanceId, claimedIds = [], codexDir, now = new Date(),
}) {
  const root = codexDir || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const marker = codexInstanceMarker(instanceId);
  const since = startedAt.getTime() - START_TOLERANCE_MS;
  const claimed = new Set(claimedIds);
  const candidates = [];

  const day = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate());
  for (let i = 0; i < MAX_LOOKUP_DAYS && day <= now; i += 1, day.setDate(day.getDate() + 1)) {
    const dir = path.join(root, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()));
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      names = [];
    }
    for (const name of names) {
      const m = name.match(ROLLOUT_RX);
      const started = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0;
      if (m && !claimed.has(m[7]) && started >= since) {
        const file = path.join(dir, name);
        // Only a primary thread for this cwd is worth reading far enough to find the marker.
        const meta = readHead(file, ROLLOUT_META_BYTES);
        const sessionCwd = meta && isPrimaryThread(meta) ? readCwd(meta) : null;
        if (sessionCwd && samePath(sessionCwd, cwd) && readHead(file, ROLLOUT_HEAD_BYTES)?.includes(marker)) {
          candidates.push({ id: m[7], started });
        }
      }
    }
  }

  candidates.sort((a, b) => a.started - b.started);
  return candidates[0]?.id || null;
}
