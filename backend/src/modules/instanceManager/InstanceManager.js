import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import pty from 'node-pty';
import treeKill from 'tree-kill';
import { setupForClaude, cleanupForClaude } from '../../../mcp/setupMcp.js';
import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';

const platform = os.platform();
const instances = new Map();

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

const MCP_SYSTEM_PROMPT = [
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
  '- send_plan({ title, content }) — for detailed markdown content (plans, diffs, architecture).',
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
  'PERMISSIONS: Before EVERY action that changes something (running commands, editing files, writing files, deleting anything),',
  'you MUST call user_input_needed FIRST to ask the user for permission. Describe what you are about to do and provide choices like ["Yes", "No"].',
  'Only proceed after the user approves. Reading files, searching, and listing directories do NOT need permission.',
  'NEVER skip this step. NEVER assume permission. ALWAYS ask first via user_input_needed.',
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
].join('\n');

function spawnClaude(cwd, args = [], extraEnv = {}, mcpConfigPath = null) {
  const systemPrompt = extraEnv.CLAUDE_IDE_SYSTEM_PROMPT || MCP_SYSTEM_PROMPT;
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    CLAUDE_IDE_SYSTEM_PROMPT: systemPrompt,
    ...extraEnv,
  };

  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    const mcpFlag = mcpConfigPath ? ` --mcp-config "${mcpConfigPath}"` : '';
    return pty.spawn(psPath, ['-NoLogo', '-Command', `claude --append-system-prompt $env:CLAUDE_IDE_SYSTEM_PROMPT${mcpFlag}`], {
      name: 'xterm-256color',
      cwd,
      env,
    });
  }

  const mcpArgs = mcpConfigPath ? ['--mcp-config', mcpConfigPath] : [];
  return pty.spawn('claude', ['--append-system-prompt', systemPrompt, ...mcpArgs, ...args], {
    name: 'xterm-256color',
    cwd,
    env,
  });
}

// Observer instructions — injected via system prompt, not written to disk
const OBSERVER_INSTRUCTIONS = [

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
  '- send_plan({ title, content }) — for detailed markdown content (plans, diffs, architecture).',
  '- user_input_needed({ message, choices }) — ask the user a question. NEVER use AskUserQuestion, ALWAYS this tool.',
  '',
  'CRITICAL — user_input_needed is ASYNCHRONOUS:',
  'The API returns { ok: true } immediately — this is NOT the user\'s answer, just an acknowledgment.',
  'After calling user_input_needed you MUST: call update_status("waiting"), then STOP completely.',
  'Do NOT call any other tools. Do NOT proceed. Do NOT assume any answer. End your turn.',
  'The user\'s choice will arrive as the NEXT message in the conversation. Wait for it, then act on it.',
  '',
  'PERMISSIONS: Before EVERY action that changes something (running commands, editing files, writing files, deleting anything),',
  'you MUST call user_input_needed FIRST to ask the user for permission. Describe what you are about to do and provide choices like ["Yes", "No"].',
  'Only proceed after the user approves. Reading files, searching, and listing directories do NOT need permission.',
  'NEVER skip this step. NEVER assume permission. ALWAYS ask first via user_input_needed.',
  '',
  'Every task ends with: send_message (your answer) → update_status("completed"). Never skip completed.',
  '# Remote Observer',
  '',
  'You are a Remote Observer — a Claude Code instance that works with remote servers via SSH. You can also work with local files and data.',
  '',
  '## MCP Tools',
  'You have extra MCP tools in addition to the standard ones:',
  '- getObserver() — load your persistent instructions from the database. Call this FIRST on startup.',
  '- setObserver({ instructions }) — save instructions to database. Call after EVERY significant step.',
  '- listKeePassConfigs() — list all available KeePass database configurations.',
  '- getKeePassCredentials({ settingsId? }) — get decrypted KeePass DB credentials. If no settingsId is provided, automatically uses the observer\'s linked KeePass config.',
  '',
  '## On startup',
  '1. Call getObserver to load your instructions',
  '2. Call getKeePassCredentials() to check if a KeePass database is configured for this observer',
  '3. If no instructions exist (empty):',
  '   - If KeePass is configured: use the KeePass CLI (following the instructions from getKeePassCredentials) to check if an entry already exists at the keepassEntryPath returned by getObserver',
  '   - If a KeePass entry exists: read SSH credentials from it',
  '   - If no KeePass entry or no KeePass configured: ask the user for SSH credentials and task description (use user_input_needed MCP tool)',
  '   - Save state to instructions via setObserver IMMEDIATELY before doing anything else',
  '   - IMPORTANT: When KeePass is configured, NEVER store passwords in instructions — only store non-sensitive state (status, progress, timestamps, workspace path, tmux session, keepass entry path)',
  '4. If instructions exist, resume from where you left off',
  '',
  '## KeePass Credential Management',
  'If getKeePassCredentials() returned credentials:',
  '- The `instructions` field contains CLI usage instructions (e.g., which binary to use, flags, paths)',
  '- The `dbPath` is the path to the .kdbx file, `username` and `password` are the DB credentials',
  '- Use the KeePass CLI to manage entries in the database',
  '- On first setup: after getting SSH credentials from the user, create a KeePass entry with the server SSH credentials',
  '- Use the keepassEntryPath from getObserver to know where to store/retrieve the entry (e.g., "Servers/my-hetzner")',
  '- On subsequent startups: read SSH credentials from the KeePass entry instead of asking the user',
  '- NEVER store passwords in instructions when KeePass is configured — only store non-sensitive state',
  '- If KeePass CLI is not available on the local machine, inform the user and fall back to instructions-based storage',
  '',
  '## Setup (first time only)',
  '1. SSH into the server',
  '2. Tell the user which directory you connected to',
  '3. Ask what user you should work as and whether root/sudo is available (use user_input_needed) — in most cases no new user needs to be created',
  '4. Propose creating a dedicated workspace directory (e.g. ~/claude-workspace) so you don\'t pollute the home directory. Ask user to confirm or choose a path.',
  '5. Ask the user in which directory you should work (use user_input_needed) — skip if already in instructions',
  '6. Ask the user about auto-approval policy for worker permission prompts (use user_input_needed):',
  '   - Auto-approve everything',
  '   - Auto-approve except dangerous commands (reboot, rm -rf /, drop database)',
  '   - Always ask me first',
  '7. If running as root: --dangerously-skip-permissions won\'t work. Suggest to the user:',
  '   - Option A (recommended): Create a non-root sudo user with passwordless sudo',
  '   - Option B (slower): Run as root, observer auto-approves prompts via tmux (~10s delay per prompt)',
  '8. Save all decisions (user, workspace, approval policy, permissions approach) to instructions via setObserver',
  '9. Verify Claude Code is installed on the remote server',
  '10. Create workspace directory and sudo user if chosen',
  '11. Create all files the worker needs in the workspace:',
  '    - Claude Code hooks (pre/post execution writing to activity.log with timestamps)',
  '    - activity.log (or it will be created by hooks)',
  '    - progress.md — todo checklist for the task',
  '    - CLAUDE.md — instructions for the worker to maintain progress.md',
  '    - Any other config files needed',
  '12. Start a tmux session and launch the worker (with --dangerously-skip-permissions if non-root, or without if root with auto-approval)',
  '13. Save tmux session name and setup status to instructions via setObserver',
  '',
  '## Monitoring — CONTINUOUS LOOP (CRITICAL)',
  'After setup is complete, you MUST run a continuous monitoring loop. Do NOT stop after one check.',
  'Repeat this cycle every 30-60 seconds until the task is done or the user tells you to stop:',
  '',
  '1. Read new entries from activity.log via SSH (track last processed timestamp in instructions — timestamps are more stable than line numbers)',
  '2. Check tmux pane for permission prompts — follow the agreed approval policy',
  '3. Send send_milestone MCP messages with what the worker accomplished since last check',
  '4. Call setObserver({ instructions }) with updated status, progress summary, and last processed timestamp',
  '5. If the worker finished (check progress.md or activity.log for completion), send a final summary and stop the loop',
  '6. Otherwise, continue to the next iteration',
  '',
  'IMPORTANT: You MUST call setObserver in EVERY iteration of the loop, not just occasionally.',
  'The instructions are your persistent memory — if you crash and restart, a new instance reads them to resume.',
  'Stale instructions = lost progress = repeated work.',
  '',
  '## When the user talks to you',
  '- If a worker is running, check its status before responding',
  '- If they ask for a summary, read activity.log and progress.md from the remote server',
  '- If they want to inject a command into the worker, use: ssh tmux send-keys -t SESSION COMMAND Enter',
  '- If they ask to do something on the remote server directly (not through the worker), SSH and do it',
  '- If they ask to do something locally, do it — you have full local access',
  '- If it\'s unclear whether something should be done locally or remotely, ask the user',
  '- If they say "re-read instructions" or similar, call getObserver to reload from DB',
  '- If they ask to stop the worker, kill the tmux session and update instructions',
  '- If they ask to stop everything, kill tmux, optionally clean up remote files, update instructions',
  '- Use user_input_needed MCP tool when you need to ask the user questions — same as project instances',
  '',
  '## Recovery (after restart)',
  '- Read instructions via getObserver — they contain everything you need',
  '- SSH into the server, check if tmux session is alive',
  '- If alive — resume monitoring from stored last processed timestamp',
  '- If dead — recreate tmux, restart worker (it reads progress.md to continue)',
  '- If SSH fails — wait and retry, server might be rebooting',
  '- Update instructions after recovery',
  '',
  '## Instructions management — CRITICAL',
  '- Update instructions via setObserver after EVERY significant step',
  '- Always write the complete instructions string, not partial',
  '- Keep instructions concise — summarize completed work in one-line entries',
  '- Always include: working directory, workspace path, tmux session name, approval policy, permissions approach, current status, progress summary, last processed timestamp',
  '- If KeePass is NOT configured: also include SSH credentials in instructions',
  '- If KeePass IS configured: NEVER include passwords — reference the KeePass entry path instead',
  '- Write instructions as if you might be interrupted at any moment — a new instance must be able to read them and understand the full situation immediately',
  '- After everything is done, write a final completion summary to instructions',
  '',
  '## SSH optimization',
  '- Detect your shell environment',
  '- If Git Bash or Linux: set up SSH ControlMaster for persistent connection',
  '- If PowerShell: use plain SSH (no ControlMaster available)',
  '',
  '## Local vs Remote',
  '- You have access to both the local machine and the remote server',
  '- Default to remote for server-related tasks',
  '- Default to local for file reading, IDE-related tasks, or when the user explicitly asks',
  '- When in doubt, ask the user',
].join('\n');

const OBSERVER_SYSTEM_PROMPT = OBSERVER_INSTRUCTIONS;

function spawnObserver(cwd, args = [], extraEnv = {}, mcpConfigPath = null) {
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    CLAUDE_IDE_SYSTEM_PROMPT: OBSERVER_SYSTEM_PROMPT,
    ...extraEnv,
  };

  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
    const mcpFlag = mcpConfigPath ? ` --mcp-config "${mcpConfigPath}"` : '';
    return pty.spawn(psPath, ['-NoLogo', '-Command', `claude --append-system-prompt $env:CLAUDE_IDE_SYSTEM_PROMPT${mcpFlag}`], {
      name: 'xterm-256color',
      cwd,
      env,
    });
  }

  const mcpArgs = mcpConfigPath ? ['--mcp-config', mcpConfigPath] : [];
  return pty.spawn('claude', ['--append-system-prompt', OBSERVER_SYSTEM_PROMPT, ...mcpArgs, ...args], {
    name: 'xterm-256color',
    cwd,
    env,
  });
}

function spawnTerminal(shell, command, cwd) {
  const env = { ...process.env, TERM: 'xterm-256color' };
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

const InstanceManager = {
  create(projectId, projectName, rawCwd, args = []) {
    const cwd = normalizePath(rawCwd);
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Invalid working directory: ${cwd} (original: ${rawCwd})`);
    }

    const id = generateId();

    // Ensure shared MCP config + set tool permissions (no files in project dir)
    let mcpConfigPath = null;
    try {
      mcpConfigPath = setupForClaude(cwd);
    } catch (e) {
      console.error('MCP setup warning:', e.message);
    }

    const extraEnv = {
      INSTANCE_ID: id,
      PROJECT_ID: projectId,
    };
    const ptyProcess = spawnClaude(cwd, args, extraEnv, mcpConfigPath);

    const instance = {
      id,
      type: 'claude',
      projectId,
      projectName,
      cwd,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),
      outputBuffer: '',
      isCapturingPlan: false,
      planPrompt: '',
      onData: null,
      onExit: null,
      milestones: [],
      messages: [],
      pendingInput: null,
      userMessages: [],
      plans: [],
      groupId: null,
      shell: null,
      command: null,
    };

    instances.set(id, instance);
    return instance;
  },

  createObserver(observerId, name, rawCwd, groupId) {
    const cwd = normalizePath(rawCwd);
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Invalid working directory: ${cwd} (original: ${rawCwd})`);
    }

    const id = generateId();

    // Ensure shared MCP config + set tool permissions (no files in project dir)
    let mcpConfigPath = null;
    try {
      mcpConfigPath = setupForClaude(cwd);
    } catch (e) {
      console.error('MCP setup warning:', e.message);
    }

    const extraEnv = {
      INSTANCE_ID: id,
      PROJECT_ID: observerId,
      OBSERVER_ID: observerId,
    };
    const ptyProcess = spawnObserver(cwd, [], extraEnv, mcpConfigPath);

    const instance = {
      id,
      type: 'observer',
      projectId: observerId,
      projectName: name || 'Observer',
      cwd,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),
      outputBuffer: '',
      isCapturingPlan: false,
      planPrompt: '',
      onData: null,
      onExit: null,
      milestones: [],
      messages: [],
      pendingInput: null,
      userMessages: [],
      plans: [],
      groupId: groupId || null,
      shell: null,
      command: null,
    };

    instances.set(id, instance);
    return instance;
  },

  createTerminal({ name, shell, command, cwd, groupId }) {
    const id = generateId();
    const resolvedCwd = cwd ? normalizePath(cwd) : undefined;
    const ptyProcess = spawnTerminal(shell, command, resolvedCwd);

    // WSL: spawned as interactive PowerShell, enter WSL, then optionally run command
    if (platform === 'win32' && shell === 'wsl') {
      const wslSettings = SystemSettingsServices.getSettings().wsl || {};
      const wslDistro = wslSettings.distro || 'Ubuntu-20.04';
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
      cwd: resolvedCwd || null,
      pty: ptyProcess,
      status: 'running',
      startedAt: new Date(),
      outputBuffer: '',
      isCapturingPlan: false,
      planPrompt: '',
      onData: null,
      onExit: null,
      milestones: [],
      messages: [],
      pendingInput: null,
      userMessages: [],
      plans: [],
      groupId: groupId || null,
      shell,
      command,
    };

    instances.set(id, instance);
    return instance;
  },

  stop(instanceId) {
    const instance = instances.get(instanceId);
    if (!instance) return false;

    instance.status = 'exited';

    // Detach listeners first so we don't get spurious events during kill
    if (instance.onData) {
      instance.onData.dispose();
      instance.onData = null;
    }
    if (instance.onExit) {
      instance.onExit.dispose();
      instance.onExit = null;
    }

    const pid = instance.pty.pid;

    try {
      // Send Ctrl+C to gracefully stop processes inside the PTY (especially WSL children)
      instance.pty.write('\x03');
    } catch (e) { /* ignore */ }

    // Give processes a moment to handle SIGINT, then force-kill the tree
    setTimeout(() => {
      try {
        if (pid) {
          treeKill(pid, 'SIGKILL', () => {});
        }
      } catch (e) { /* ignore */ }
      try {
        instance.pty.kill();
      } catch (e) { /* ignore */ }
    }, 500);

    instances.delete(instanceId);
    return true;
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

  list() {
    const result = [];
    for (const instance of instances.values()) {
      result.push({
        id: instance.id,
        type: instance.type,
        projectId: instance.projectId,
        projectName: instance.projectName,
        cwd: instance.cwd,
        status: instance.status,
        startedAt: instance.startedAt,
        isCapturingPlan: instance.isCapturingPlan,
        milestones: instance.milestones,
        messages: instance.messages || [],
        pendingInput: instance.pendingInput,
        userMessages: instance.userMessages,
        plans: instance.plans,
        groupId: instance.groupId,
        shell: instance.shell,
        command: instance.command,
      });
    }
    return result;
  },

  get(instanceId) {
    return instances.get(instanceId) || null;
  },

  updateStatus(instanceId, status) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.status = status;
    return true;
  },

  addMilestone(instanceId, { accomplished, workingOn }) {
    const instance = instances.get(instanceId);
    if (!instance) return null;

    const milestone = {
      accomplished,
      workingOn,
      timestamp: new Date(),
    };
    instance.milestones.push(milestone);
    return milestone;
  },

  getMilestones(instanceId) {
    const instance = instances.get(instanceId);
    if (!instance) return [];
    return instance.milestones;
  },

  setPendingInput(instanceId, { message, choices }) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.pendingInput = { message, choices };
    instance.status = 'waiting';
    return true;
  },

  clearPendingInput(instanceId) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.pendingInput = null;
    return true;
  },

  addUserMessage(instanceId, text, timestamp) {
    const instance = instances.get(instanceId);
    if (!instance) return null;
    const msg = { text, timestamp: timestamp || new Date().toISOString() };
    instance.userMessages.push(msg);
    return msg;
  },

  addMessage(instanceId, { text, type }) {
    const instance = instances.get(instanceId);
    if (!instance) return null;
    if (!instance.messages) instance.messages = [];
    const msg = { text, type: type || 'info', timestamp: new Date() };
    instance.messages.push(msg);
    return msg;
  },

  addPlanReference(instanceId, { id, title, content }) {
    const instance = instances.get(instanceId);
    if (!instance) return null;
    const ref = { id, title, content: content || '' };
    instance.plans.push(ref);
    return ref;
  },

  setGroupId(instanceId, groupId) {
    const instance = instances.get(instanceId);
    if (!instance) return false;
    instance.groupId = groupId;
    return true;
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

  stopAll() {
    const ids = [...instances.keys()];
    for (const id of ids) {
      InstanceManager.stop(id);
    }
    return ids;
  },

  stopGroup(groupId) {
    const groupInstances = InstanceManager.getByGroupId(groupId);
    const stoppedIds = [];
    for (const instance of groupInstances) {
      if (InstanceManager.stop(instance.id)) {
        stoppedIds.push(instance.id);
      }
    }
    return stoppedIds;
  },

  startPlanCapture(instanceId, prompt) {
    const instance = instances.get(instanceId);
    if (!instance) return false;

    instance.isCapturingPlan = true;
    instance.planPrompt = prompt || '';
    instance.outputBuffer = '';
    return true;
  },

  finishPlanCapture(instanceId) {
    const instance = instances.get(instanceId);
    if (!instance || !instance.isCapturingPlan) return null;

    const result = {
      prompt: instance.planPrompt,
      content: instance.outputBuffer,
    };

    instance.isCapturingPlan = false;
    instance.planPrompt = '';
    instance.outputBuffer = '';

    return result;
  },
};

export default InstanceManager;
