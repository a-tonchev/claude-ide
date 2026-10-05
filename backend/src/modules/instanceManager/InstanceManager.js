import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import pty from 'node-pty';
import treeKill from 'tree-kill';
import { fileURLToPath } from 'url';
import { setupForClaude } from '../../../mcp/setupMcp.js';
import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import FileStore from '#modules/files/FileStore';
import {
  descendantsOf, killPids, readProcessTable, readProcessTableAsync, sweepMcpOrphansAsync,
} from './processSweep.js';
import { buildCodexArgs, resolveCodexCommand } from './codexLauncher.js';
import {
  codexInstanceMarker, findClaudeTranscript, findCodexSession, isUuid,
} from './sessionFiles.js';
import {
  installKey, killMarkedWslProcesses, killMarkedWslProcessesSync, terminalMarker, withTerminalMarker,
} from './wslCleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OBSERVER_SKILL_PATH = path.resolve(__dirname, '../../../mcp/skills/observer.md');

const platform = os.platform();

// Marks the processes of this install's WSL terminals (see wslCleanup.js): the backend
// folder tells live and dev apart, the start time tells this run from earlier ones.
const INSTALL_KEY = installKey(path.resolve(__dirname, '../../..'));
const BOOT_ID = Date.now().toString(36);

// Running instances only: the process handle plus live state. Messages, milestones
// and plans live in MongoDB, and every AI instance also has a record there that
// outlives the process (see InstanceStore).
const instances = new Map();

// Codex session lookups read the sessions folder, so repeat calls are throttled.
const CODEX_SESSION_LOOKUP_INTERVAL_MS = 2000;

// One orphan sweep after a burst of stops (Stop all, Delete group), not one per instance.
const POST_STOP_SWEEP_DELAY_MS = 1000;

// Time processes get to react to Ctrl+C before the force-kill, when nothing else waits.
const KILL_GRACE_MS = 500;

function normalizePath(inputPath) {
  if (platform === 'win32' && /^\/[a-zA-Z]\//.test(inputPath)) {
    const drive = inputPath[1].toUpperCase();
    return `${drive}:${inputPath.slice(2).replace(/\//g, '\\')}`;
  }
  return inputPath;
}

function generateId() {
  return crypto.randomUUID();
}

const getWslDistro = () => SystemSettingsServices.getSettings().wsl?.distro || 'Ubuntu-20.04';

function getShellCommand(shell, command) {
  switch (shell) {
    case 'wsl':
    {
      // Spawn interactive PowerShell — WSL command will be written to it after init
      const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      return { file: psPath, args: ['-NoLogo', '-NoProfile'] };
    }
    case 'powershell':
    {
      const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      if (command) {
        // Windows PowerShell 5.1 doesn't support && — replace with ;
        const psCommand = command.replace(/\s*&&\s*/g, ' ; ');
        return { file: psPath, args: ['-ExecutionPolicy', 'Bypass', '-NoLogo', '-NoExit', '-Command', psCommand] };
      }
      return { file: psPath, args: ['-ExecutionPolicy', 'Bypass', '-NoLogo'] };
    }
    case 'cmd':
      if (command) {
        return { file: 'cmd.exe', args: ['/c', command] };
      }
      return { file: 'cmd.exe', args: [] };
    case 'bash':
      if (command) {
        return { file: 'bash', args: ['-c', command] };
      }
      return { file: 'bash', args: [] };
    case 'gitbash':
    {
      const gitBashPath = process.env.GIT_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';
      if (command) {
        return { file: gitBashPath, args: ['-c', command] };
      }
      return { file: gitBashPath, args: [] };
    }
    default:
      if (command) {
        return { file: 'bash', args: ['-c', command] };
      }
      return { file: 'bash', args: [] };
  }
}

// Claude asks before every change. Codex treats a clear instruction as the
// go-ahead and asks only when it has none.
const CLAUDE_PERMISSIONS = [
  'PERMISSIONS: Before EVERY action that changes something (running commands, editing files, writing files, deleting anything),',
  'you MUST call user_input_needed FIRST to ask the user for permission. Describe what you are about to do and provide choices like ["Yes", "No"].',
  'Only proceed after the user approves. Reading files, searching, and listing directories do NOT need permission.',
  'NEVER skip this step. NEVER assume permission. ALWAYS ask first via user_input_needed.',
];

const CODEX_PERMISSIONS = [
  'PERMISSIONS: A clear instruction from the user to make a change ("do this", "fix it", "implement X", "go ahead") IS permission.',
  'Carry it out — edit and write files, run the commands the task needs — without asking for confirmation first.',
  'Call user_input_needed (choices like ["Yes", "No"]) ONLY when there is no clear go-ahead:',
  '- the user is asking a question, describing an idea, or asking whether something is possible — answer it, change nothing;',
  '- the request is ambiguous, or doing it would go beyond what the user asked for;',
  '- the action is destructive or hard to undo (deleting files or data, git push/reset/rebase, dropping databases, production or external services) and the user did not explicitly ask for it.',
  'Reading files, searching, and listing directories never need permission.',
];

const buildMcpSystemPrompt = permissions => [
  'You are managed by Claude IDE. The user sees ONLY the dashboard — never the terminal.',
  '',
  'IMPORTANT OUTPUT RULE: Do NOT write any text to the terminal. No prose, no explanations, no summaries.',
  'Your text output is invisible to the user. ALL communication goes through MCP tool calls only.',
  'After your tool calls, output ONLY a single dot character (.) — nothing else. No sentences, no explanations.',
  '',
  'MCP tools (use these for ALL communication):',
  '- update_status("thinking") — FIRST thing on every message. Then "working" when executing. "completed" as LAST call when done.',
  '- send_milestone({ accomplished, workingOn }) — after EVERY action. Be specific: name files, describe what you did.',
  '- send_message({ text, type }) — for ALL responses, answers, results, explanations. Types: info, success, warning, error. This is how the user reads your output.',
  '- send_plan({ title, content }) — ALWAYS use this for implementation plans, architecture overviews, or structured documents. NEVER use built-in EnterPlanMode/Plan tool — use send_plan instead. Before any non-trivial task, create a plan first. Content must be markdown.',
  '- user_input_needed({ message, choices }) — ask the user a question. NEVER use AskUserQuestion, ALWAYS this tool.',
  '- listKeePassConfigs() — list all KeePass database configurations. Returns available configs with their IDs.',
  '- getKeePassCredentials({ settingsId }) — get decrypted KeePass DB credentials by settings ID. Use to access passwords stored in KeePass instead of asking the user.',
  '',
  'CRITICAL — user_input_needed is ASYNCHRONOUS:',
  'The API returns { ok: true } immediately — this is NOT the user\'s answer, just an acknowledgment.',
  'After calling user_input_needed you MUST: call update_status("waiting"), then STOP completely.',
  'Do NOT call any other tools. Do NOT proceed. Do NOT assume any answer. End your turn.',
  'The user\'s choice will arrive as the NEXT message in the conversation. Wait for it, then act on it.',
  '',
  ...permissions,
  '',
  '## KeePass Credentials',
  'You have access to KeePass credential storage. If the user asks you to retrieve credentials, API keys, or passwords:',
  '1. Call listKeePassConfigs() to see available KeePass databases',
  '2. Call getKeePassCredentials({ settingsId }) with the relevant config ID to get the decrypted DB credentials',
  '3. Use the returned credentials (dbPath, username, password) with the KeePass CLI to look up entries',
  '4. The instructions field in each config tells you how to use the CLI (binary path, flags, etc.)',
  'Never store or display decrypted passwords in plain text — use them only for the intended operation.',
  '',
  'Every task ends with: send_message (your answer) → update_status("completed"). Never skip completed.',
  '',
  '## Observer Mode',
  `If the user asks you to become an observer or manage a remote server, read the observer skill file at: ${OBSERVER_SKILL_PATH}`,
  'Then follow its instructions. You have access to getObserver/setObserver MCP tools for persistent state.',
].join('\n');

const MCP_SYSTEM_PROMPT = buildMcpSystemPrompt(CLAUDE_PERMISSIONS);
const CODEX_SYSTEM_PROMPT = buildMcpSystemPrompt(CODEX_PERMISSIONS);

// The backend usually runs inside a long-lived terminal whose PATH was captured
// when that terminal opened. Tools installed since (e.g. bun, which channel
// plugins need) are missing from it, and spawned instances inherit the gap.
// On Windows, merge the current machine + user PATH from the registry into
// the child PATH once per backend start.
let refreshedPath = null;
function getChildPath() {
  const current = process.env.PATH || process.env.Path || '';
  if (platform !== 'win32') return current;
  if (refreshedPath !== null) return refreshedPath;
  try {
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    const out = execFileSync(psPath, [
      '-NoProfile', '-NonInteractive', '-Command',
      "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')",
    ], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const merged = current.split(';').filter(Boolean);
    const seen = new Set(merged.map(p => p.toLowerCase()));
    for (const entry of out.split(';').map(p => p.trim()).filter(Boolean)) {
      if (!seen.has(entry.toLowerCase())) {
        seen.add(entry.toLowerCase());
        merged.push(entry);
      }
    }
    refreshedPath = merged.join(';');
  } catch (e) {
    console.warn('PATH refresh failed, spawned instances use the inherited PATH:', e.message);
    refreshedPath = current;
  }
  return refreshedPath;
}

// Set when the backend itself was started from inside a Claude Code session (or the
// Codex plugin). Instances must not inherit them: Claude would treat itself as a child
// session and turn transcript saving off, so its session could never be resumed.
const PARENT_SESSION_ENV_VARS = new Set([
  'CLAUDECODE',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_EFFORT',
  'CLAUDE_PID',
  'CLAUDE_PLUGIN_DATA',
  'CODEX_COMPANION_SESSION_ID',
]);

function withoutParentSession(env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !PARENT_SESSION_ENV_VARS.has(name.toUpperCase())));
}

// Windows env vars are case-insensitive; overwrite whichever spelling exists
// so the child doesn't end up with both `Path` and `PATH`.
function withChildPath(env) {
  const clean = withoutParentSession(env);
  const key = Object.keys(clean).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  return { ...clean, [key]: getChildPath() };
}

// Launch flags are user-configured settings ({ id, name, args, instructions }).
// `args` is appended verbatim after `claude`; `{name}` inside it is replaced
// with the instance's project name.
function expandFlagArgs(flagArgs, instanceName) {
  const safeName = (instanceName || '').replace(/["`$\\]/g, '');
  return (flagArgs || '').replace(/\{name\}/g, safeName).trim();
}

// Minimal shell-style tokenizer for the POSIX spawn path, where node-pty takes
// an argv array rather than a command line. Honors quotes and backslashes.
function tokenizeArgs(str) {
  const tokens = [];
  let current = '';
  let quote = null;
  let hasToken = false;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && i + 1 < str.length) {
        i += 1;
        current += str[i];
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (ch === '\\' && i + 1 < str.length) {
      i += 1;
      current += str[i];
      hasToken = true;
    } else if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (hasToken) tokens.push(current);
  return tokens;
}

// Flag instructions are appended to the injected system prompt so a flag can
// change how the instance behaves (e.g. answer on Discord via the plugin's
// reply tool) without hardcoding prompt variants here.
function buildSystemPrompt(basePrompt, launchFlags) {
  const extras = launchFlags
    .filter(f => f.instructions && f.instructions.trim())
    .map(f => `## ${f.name}\n${f.instructions.trim()}`);
  return extras.length ? [basePrompt, ...extras].join('\n\n') : basePrompt;
}

// Claude sessions get their id up front. One that already has a transcript is
// resumed; one that never talked (no transcript yet) starts fresh under that id.
function claudeSessionArgs(sessionId) {
  if (!isUuid(sessionId)) throw new Error('Invalid session ID');
  return findClaudeTranscript(sessionId) ? ['--resume', sessionId] : ['--session-id', sessionId];
}

// The attachments folder (settings.js filesDir) is added to the instance's allowed
// directories, so reading attachments and writing to shared/ never stops at a permission
// prompt nobody sees. Its instructions are appended to the system prompt.
function withFilesSection(prompt, instanceId) {
  const section = FileStore.promptSection(instanceId);
  return section ? `${prompt}\n\n${section}` : prompt;
}

function spawnClaude(cwd, args = [], extraEnv = {}, mcpConfigPath = null, launchFlags = [], instanceName = '', sessionArgs = []) {
  const basePrompt = extraEnv.CLAUDE_IDE_SYSTEM_PROMPT || MCP_SYSTEM_PROMPT;
  const systemPrompt = withFilesSection(buildSystemPrompt(basePrompt, launchFlags), extraEnv.INSTANCE_ID);
  const filesDir = FileStore.getRoot();
  const env = withChildPath({
    ...process.env,
    TERM: 'xterm-256color',
    ...extraEnv,
    CLAUDE_IDE_SYSTEM_PROMPT: systemPrompt,
    ...(filesDir ? { CLAUDE_IDE_FILES_DIR: filesDir } : {}),
  });

  const flagStrings = launchFlags
    .map(f => expandFlagArgs(f.args, instanceName))
    .filter(Boolean);

  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    // --add-dir takes several values, so it goes before the next option
    const addDirFlag = filesDir ? ' --add-dir $env:CLAUDE_IDE_FILES_DIR' : '';
    const mcpFlag = mcpConfigPath ? ` --mcp-config "${mcpConfigPath}"` : '';
    // Session args are a fixed flag plus a validated UUID, so they are safe to inline.
    const sessionSuffix = sessionArgs.length ? ` ${sessionArgs.join(' ')}` : '';
    const flagsSuffix = flagStrings.length ? ` ${flagStrings.join(' ')}` : '';
    return pty.spawn(psPath, ['-NoLogo', '-Command', `claude --append-system-prompt $env:CLAUDE_IDE_SYSTEM_PROMPT${addDirFlag}${mcpFlag}${sessionSuffix}${flagsSuffix}`], {
      name: 'xterm-256color',
      cwd,
      env,
    });
  }

  const mcpArgs = mcpConfigPath ? ['--mcp-config', mcpConfigPath] : [];
  const flagArgs = flagStrings.flatMap(tokenizeArgs);
  const addDirArgs = filesDir ? ['--add-dir', filesDir] : [];
  return pty.spawn('claude', ['--append-system-prompt', systemPrompt, ...addDirArgs, ...mcpArgs, ...sessionArgs, ...flagArgs, ...args], {
    name: 'xterm-256color',
    cwd,
    env,
  });
}

function spawnTerminal(shell, command, cwd, wslMarker = null) {
  const baseEnv = withoutParentSession({ ...process.env, TERM: 'xterm-256color' });
  const env = wslMarker ? withTerminalMarker(baseEnv, wslMarker) : baseEnv;
  const { file, args } = getShellCommand(shell, command);
  const defaultCwd = process.env.USERPROFILE || process.env.HOME || undefined;
  const resolvedCwd = cwd || defaultCwd;

  console.log('[spawnTerminal]', { shell, command, cwd: resolvedCwd, file, args });

  return pty.spawn(file, args, {
    name: 'xterm-256color',
    cwd: resolvedCwd,
    env,
  });
}

// Terminals have no session to resume, so only AI instances get a record.
const isRemembered = instance => instance.type === 'claude' || instance.type === 'observer';

// Record writes for one instance run in order, so an update never lands before
// the insert it depends on. A failed write is logged; the instance keeps running.
function persist(instance, write) {
  if (!isRemembered(instance)) return Promise.resolve();
  instance.persistChain = (instance.persistChain || Promise.resolve())
    .then(write)
    .catch(err => console.error(`[instance ${instance.id}] record not saved:`, err.message));
  return instance.persistChain;
}

// Insert the record of a new instance, or refresh the remembered one it resumes.
function persistStart(instance, flagIds = []) {
  const fields = {
    type: instance.type,
    provider: instance.provider || 'claude',
    sessionId: instance.sessionId || null,
    projectId: instance.projectId || null,
    projectName: instance.projectName || null,
    title: instance.title || null,
    cwd: instance.cwd,
    groupId: instance.groupId || null,
    savedItemId: instance.savedItemId || null,
    flagIds,
    status: instance.status,
    pendingInput: null,
    resumeError: null,
    startedAt: instance.startedAt,
  };
  return persist(instance, () => (instance.resumed
    ? InstanceStore.updateRecord(instance.id, { ...fields, lastActiveAt: instance.startedAt })
    : InstanceStore.createRecord({ _id: instance.id, ...fields })));
}

// A WSL terminal's programs keep running inside WSL when its Windows processes die,
// so ending the terminal also kills every WSL process carrying its marker.
function stopWslProcesses(instance) {
  if (!instance.wslMarker) return;
  killMarkedWslProcesses(instance.wslDistro, { marker: instance.wslMarker })
    .then(count => {
      if (count) console.info(`[terminal ${instance.id}] stopped ${count} WSL process(es)`);
    })
    .catch(err => console.error(`[terminal ${instance.id}] WSL processes not stopped:`, err.message));
}

let sweepTimer = null;
function scheduleOrphanSweep() {
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(async () => {
    sweepTimer = null;
    // Exclude the backend itself and every PTY root still running when the table is in.
    const swept = await sweepMcpOrphansAsync({
      getExcludeRootPids: () => [process.pid, ...[...instances.values()].map(i => i.pty?.pid).filter(Boolean)],
    });
    if (swept.length) {
      console.info(`[stop] swept ${swept.length} MCP orphan(s):`, swept.map(s => s.pid).join(', '));
    }
  }, POST_STOP_SWEEP_DELAY_MS);
}

// On Windows, node-pty's kill() forks a helper that looks up the console's processes. The
// shell is already tree-killed by then, so the helper crashes ("AttachConsole failed" stack
// in the log) and node-pty waits 5 s for it. The tree kill and the descendant snapshot
// cover those processes, so the lookup is skipped.
function killPty(ptyProcess) {
  const agent = ptyProcess._agent;
  if (platform === 'win32' && typeof agent?._getConsoleProcessList === 'function') {
    agent._getConsoleProcessList = () => Promise.resolve([]);
  }
  try {
    ptyProcess.kill();
  } catch (e) { /* ignore */ }
}

// Force-kill an instance's tree after `graceMs`, plus every descendant from the snapshot:
// tree-kill walks parent→child links and misses grandchildren (e.g. MCP servers spawned
// by Claude Code) that get reparented during the kill. The snapshot is just a PID list.
function terminate(instance, descendants, graceMs) {
  const { pid } = instance.pty;
  setTimeout(() => {
    try {
      if (pid) {
        treeKill(pid, 'SIGKILL', () => {});
      }
    } catch (e) { /* ignore */ }
    killPty(instance.pty);
    const survivors = killPids(descendants);
    if (survivors.length) {
      console.info(`[stop ${instance.id}] force-killed ${survivors.length} orphan descendant(s)`);
    }
    scheduleOrphanSweep();
  }, graceMs);
}

const InstanceManager = {
  // `record` is a remembered instance to resume: its id and session are reused.
  create(projectId, projectName, rawCwd, args = [], {
    launchFlags = [], provider = 'claude', savedItemId = null, groupId = null, record = null,
  } = {}) {
    if (!['claude', 'codex'].includes(provider)) throw new Error('Unknown AI provider');
    if (savedItemId !== null && typeof savedItemId !== 'string') throw new Error('Invalid card ID');
    const cwd = normalizePath(rawCwd);
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Invalid working directory: ${cwd} (original: ${rawCwd})`);
    }

    const id = record?._id || generateId();
    // Claude gets its session id up front (a record without one starts fresh under a
    // new id); Codex's is detected after it starts.
    const sessionId = record?.sessionId || (provider === 'claude' ? generateId() : null);

    // Ensure shared MCP config + set tool permissions (no files in project dir)
    let mcpConfigPath = null;
    try {
      if (provider === 'claude') mcpConfigPath = setupForClaude(cwd);
    } catch (e) {
      console.error('MCP setup warning:', e.message);
    }

    const extraEnv = {
      INSTANCE_ID: id,
      PROJECT_ID: projectId,
    };
    let ptyProcess;
    if (provider === 'codex') {
      const command = resolveCodexCommand(getChildPath());
      // The marker lets detectCodexSession find the session file Codex writes for this instance.
      const codexArgs = buildCodexArgs(withFilesSection(`${codexInstanceMarker(id)}\n\n${CODEX_SYSTEM_PROMPT}`, id), extraEnv);
      const filesDir = FileStore.getRoot();
      if (filesDir) codexArgs.push('--add-dir', filesDir);
      if (sessionId && !isUuid(sessionId)) throw new Error('Invalid session ID');
      const invocation = sessionId ? ['resume', ...codexArgs, sessionId] : codexArgs;
      ptyProcess = pty.spawn(command.file, [...command.args, ...invocation], {
        name: 'xterm-256color',
        cwd,
        env: withChildPath({ ...process.env, TERM: 'xterm-256color', ...extraEnv }),
      });
    } else {
      ptyProcess = spawnClaude(cwd, args, extraEnv, mcpConfigPath, launchFlags, projectName, claudeSessionArgs(sessionId));
    }

    const instance = {
      id,
      type: 'claude',
      provider,
      sessionId,
      savedItemId,
      projectId,
      projectName,
      title: record?.title || null,
      cwd,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),
      resumed: !!record,

      onData: null,
      onExit: null,
      pendingInput: null,
      groupId: groupId || null,
      shell: null,
      command: null,
      // { id, name } of the launch flags this instance was started with
      launchFlags: provider === 'claude' ? launchFlags.map(f => ({ id: f.id, name: f.name })) : [],
    };

    instances.set(id, instance);
    persistStart(instance, launchFlags.map(f => f.id));
    return instance;
  },

  createObserver(observerId, name, rawCwd, groupId, { record = null } = {}) {
    const cwd = normalizePath(rawCwd);
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Invalid working directory: ${cwd} (original: ${rawCwd})`);
    }

    const id = record?._id || generateId();
    const sessionId = record?.sessionId || generateId();

    // Ensure shared MCP config + set tool permissions (no files in project dir)
    let mcpConfigPath = null;
    try {
      mcpConfigPath = setupForClaude(cwd);
    } catch (e) {
      console.error('MCP setup warning:', e.message);
    }

    const observerSystemPrompt = [
      MCP_SYSTEM_PROMPT,
      '',
      `You are an Observer instance. Read your full instructions from: ${OBSERVER_SKILL_PATH}`,
      'After reading, call getObserver() to load your persistent state.',
    ].join('\n');

    const extraEnv = {
      INSTANCE_ID: id,
      PROJECT_ID: observerId,
      OBSERVER_ID: observerId,
      CLAUDE_IDE_SYSTEM_PROMPT: observerSystemPrompt,
    };
    const ptyProcess = spawnClaude(cwd, [], extraEnv, mcpConfigPath, [], '', claudeSessionArgs(sessionId));

    const instance = {
      id,
      type: 'observer',
      provider: 'claude',
      sessionId,
      projectId: observerId,
      projectName: name || 'Observer',
      title: record?.title || null,
      cwd,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),
      resumed: !!record,

      onData: null,
      onExit: null,
      pendingInput: null,
      groupId: groupId || null,
      shell: null,
      command: null,
    };

    instances.set(id, instance);
    persistStart(instance);
    return instance;
  },

  createTerminal({
    name, shell, command, cwd, groupId, savedItemId = null,
  }) {
    const id = generateId();
    const resolvedCwd = cwd ? normalizePath(cwd) : undefined;
    const isWsl = platform === 'win32' && shell === 'wsl';
    const wslDistro = isWsl ? getWslDistro() : null;
    const wslMarker = isWsl ? terminalMarker({ installKey: INSTALL_KEY, bootId: BOOT_ID, instanceId: id }) : null;
    const ptyProcess = spawnTerminal(shell, command, resolvedCwd, wslMarker);

    // WSL: spawned as interactive PowerShell, enter WSL, then optionally run command
    if (isWsl) {
      setTimeout(() => {
        ptyProcess.write(`wsl -d ${wslDistro}\r`);
        if (command) {
          setTimeout(() => ptyProcess.write(`${command}\r`), 1500);
        }
      }, 800);
    }

    const instance = {
      id,
      type: 'terminal',
      projectId: null,
      projectName: name || 'Terminal',
      title: null,
      cwd: resolvedCwd || null,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),

      onData: null,
      onExit: null,
      pendingInput: null,
      groupId: groupId || null,
      savedItemId: typeof savedItemId === 'string' ? savedItemId : null,
      shell,
      command,
      wslDistro,
      wslMarker,
    };

    instances.set(id, instance);
    return instance;
  },

  // `discard` is set only for a manual stop: it also deletes the instance's record
  // and messages. Shutdown and restarts stop without it, so the instance stays
  // remembered and can be resumed.
  // `table` is a process table (array) or a pending read (promise) shared by a batch
  // of stops; without it the table is read in the background.
  // `shuttingDown` leaves WSL cleanup to stopAll, which does it once for every terminal.
  stop(instanceId, { discard = false, table = null, shuttingDown = false } = {}) {
    const instance = instances.get(instanceId);
    if (!instance) return false;

    // A process that already ended has nothing left to kill, and its PID may by now
    // belong to an unrelated process.
    const alreadyExited = instance.status === 'exited';
    instance.status = 'exited';

    // Clear idle timer from wireInstance (closure-scoped, exposed via instance)
    if (instance.clearIdleTimer) {
      instance.clearIdleTimer();
      instance.clearIdleTimer = null;
    }

    // Detach listeners first so we don't get spurious events during kill
    if (instance.onData) {
      instance.onData.dispose();
      instance.onData = null;
    }
    if (instance.onExit) {
      instance.onExit.dispose();
      instance.onExit = null;
    }

    instances.delete(instanceId);
    if (discard) persist(instance, () => InstanceStore.deleteRecord(instanceId));
    if (!shuttingDown) stopWslProcesses(instance);
    if (alreadyExited) return true;

    // Ctrl+C first so processes inside the PTY (especially WSL children) can stop cleanly;
    // reading the process table gives them time before the force-kill.
    try {
      instance.pty.write('\x03');
    } catch (e) { /* ignore */ }

    const { pid } = instance.pty;
    if (!pid) {
      terminate(instance, [], KILL_GRACE_MS);
    } else if (Array.isArray(table)) {
      terminate(instance, descendantsOf(pid, table), KILL_GRACE_MS);
    } else {
      (table || readProcessTableAsync()).then(t => terminate(instance, descendantsOf(pid, t), 0));
    }
    return true;
  },

  // The process ended on its own. The record stays, so the instance can be resumed;
  // resumeError explains an instance that died right after starting. A WSL terminal's
  // programs are stopped with it.
  markExited(instanceId, { resumeError = null } = {}) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.status = 'exited';
    stopWslProcesses(instance);
    persist(instance, () => InstanceStore.updateRecord(instanceId, {
      status: 'exited', pendingInput: null, ...(resumeError && { resumeError }),
    }));
    return true;
  },

  removeIfExited(instanceId) {
    const instance = instances.get(instanceId);
    if (instance && instance.status === 'exited') {
      instances.delete(instanceId);
      return true;
    }
    return false;
  },

  write(instanceId, data) {
    const instance = instances.get(instanceId);
    if (!instance || instance.status === 'exited') return false;
    instance.pty.write(data);
    return true;
  },

  resize(instanceId, cols, rows) {
    const instance = instances.get(instanceId);
    if (!instance || instance.status === 'exited') return false;

    try {
      instance.pty.resize(cols, rows);
    } catch (e) {
      // Resize can fail if process already exited
    }
    return true;
  },

  // The instance as clients see it: no process handle or internal state.
  toPublic(instance) {
    return {
      id: instance.id,
      type: instance.type,
      provider: instance.provider || 'claude',
      savedItemId: instance.savedItemId || null,
      projectId: instance.projectId,
      projectName: instance.projectName,
      title: instance.title || null,
      cwd: instance.cwd,
      status: instance.status,
      startedAt: instance.startedAt,
      pendingInput: instance.pendingInput,
      groupId: instance.groupId,
      shell: instance.shell,
      command: instance.command,
      launchFlags: instance.launchFlags || [],
    };
  },

  list() {
    return [...instances.values()].map(InstanceManager.toPublic);
  },

  runningIds() {
    return [...instances.keys()];
  },

  get(instanceId) {
    return instances.get(instanceId) || null;
  },

  // Status and pending questions are live state: kept in memory only. The record holds
  // what a resume needs (session, group, title) plus the start and exit.
  updateStatus(instanceId, status) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.status = status;
    return true;
  },

  setTitle(instanceId, title) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.title = title || null;
    persist(instance, () => InstanceStore.updateRecord(instanceId, { title: instance.title }));
    return true;
  },

  // Move a running instance to another group. The record follows, so a refresh, restart
  // or resume keeps the new group. Returns { previousGroupId }, or null if not running.
  setGroup(instanceId, groupId) {
    const instance = instances.get(instanceId);
    if (!instance || instance.status === 'exited') return null;
    const previousGroupId = instance.groupId;
    instance.groupId = groupId;
    persist(instance, () => InstanceStore.updateRecord(instanceId, { groupId }));
    return { previousGroupId };
  },

  setPendingInput(instanceId, { choices }) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.pendingInput = { choices };
    instance.status = 'waiting';
    return true;
  },

  clearPendingInput(instanceId) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.pendingInput = null;
    return true;
  },

  // Codex can't be given a session id up front; find the session file it wrote for
  // this instance (by the marker in its instructions) so it can be resumed later.
  // Cheap to call often (throttled).
  detectCodexSession(instanceId, { force = false } = {}) {
    const instance = instances.get(instanceId);
    if (!instance || instance.provider !== 'codex' || instance.sessionId) return null;
    const now = Date.now();
    if (!force && instance.lastSessionLookup && now - instance.lastSessionLookup < CODEX_SESSION_LOOKUP_INTERVAL_MS) {
      return null;
    }
    instance.lastSessionLookup = now;
    const claimedIds = [...instances.values()].map(i => i.sessionId).filter(Boolean);
    const sessionId = findCodexSession({
      cwd: instance.cwd, startedAt: instance.startedAt, instanceId, claimedIds,
    });
    if (!sessionId) return null;
    instance.sessionId = sessionId;
    persist(instance, () => InstanceStore.updateRecord(instanceId, { sessionId }));
    return sessionId;
  },

  getByGroupId(groupId) {
    const result = [];
    for (const instance of instances.values()) {
      if (instance.groupId === groupId) {
        result.push(instance);
      }
    }
    return result;
  },

  // Shutdown path: records are kept so every instance can be resumed after restart.
  // The process exits right after, so one blocking table read covers every instance,
  // and the WSL programs of this run's terminals are stopped synchronously, once per distro.
  stopAll() {
    const ids = [...instances.keys()];
    const table = ids.length ? readProcessTable() : [];
    const wslDistros = new Set([...instances.values()].filter(i => i.wslMarker).map(i => i.wslDistro));
    for (const id of ids) {
      InstanceManager.stop(id, { table, shuttingDown: true });
    }
    for (const distro of wslDistros) {
      killMarkedWslProcessesSync(distro, { installKey: INSTALL_KEY, bootId: BOOT_ID });
    }
    return ids;
  },

  // One background table read shared by every instance in the group.
  stopGroup(groupId, { discard = false } = {}) {
    const groupInstances = InstanceManager.getByGroupId(groupId);
    if (!groupInstances.length) return [];
    const table = readProcessTableAsync();
    const stoppedIds = [];
    for (const instance of groupInstances) {
      if (InstanceManager.stop(instance.id, { discard, table })) {
        stoppedIds.push(instance.id);
      }
    }
    return stoppedIds;
  },

  // Called once at backend startup; runs in the background. This install's MCP servers
  // (and ownerless chrome-devtools-mcp) are leftovers — every descendant of this backend
  // is protected, so instances started meanwhile are safe. So are WSL programs of
  // terminals from a run that was killed or crashed (a reboot already stopped WSL).
  sweepStartupOrphans() {
    sweepMcpOrphansAsync({ getExcludeRootPids: () => [process.pid] })
      .then(swept => {
        if (swept.length) console.info(`[startup] swept ${swept.length} orphan MCP process(es):`, swept.map(o => o.pid).join(', '));
      })
      .catch(err => console.error('[startup] MCP orphan sweep failed:', err.message));
    killMarkedWslProcesses(getWslDistro(), { installKey: INSTALL_KEY, exceptBootId: BOOT_ID }, { onlyIfRunning: true })
      .then(count => {
        if (count) console.info(`[startup] stopped ${count} leftover WSL terminal process(es)`);
      })
      .catch(err => console.error('[startup] WSL leftover cleanup failed:', err.message));
  },

};

export default InstanceManager;
