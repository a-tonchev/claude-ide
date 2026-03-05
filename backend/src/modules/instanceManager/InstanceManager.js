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
        return { file: psPath, args: ['-NoLogo', '-Command', command] };
      }
      return { file: psPath, args: ['-NoLogo'] };
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
].join('\n');

function spawnClaude(cwd, args = [], extraEnv = {}, mcpConfigPath = null) {
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    CLAUDE_IDE_SYSTEM_PROMPT: MCP_SYSTEM_PROMPT,
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
  return pty.spawn('claude', ['--append-system-prompt', MCP_SYSTEM_PROMPT, ...mcpArgs, ...args], {
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
