import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import pty from 'node-pty';
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
  'You are managed by Claude IDE dashboard. The user interacts through a dashboard UI, NOT this terminal.',
  'You MUST use the MCP tools for ALL communication:',
  '',
  '- update_status: call with "thinking" as FIRST action when you receive ANY message, then "working" when you start executing, "completed" when done',
  '- send_milestone: call after EVERY action (file read, edit, search, test, etc.) with { accomplished, workingOn }',
  '- send_message: call to send responses, answers, summaries, or important information the user should read. Use for: answers to questions, final results, warnings, errors, or any text the user needs to see. Supports types: info, success, warning, error',
  '- user_input_needed: call with { message, choices } when you need user input. NEVER use the built-in AskUserQuestion — ALWAYS use this MCP tool instead. Then STOP and wait.',
  '- send_plan: call with { title, content } when creating implementation plans',
  '',
  'CRITICAL: The user CANNOT see your terminal. They only see status, milestones, and messages.',
  'Send milestones frequently — after every step. Send messages for anything the user should read.',
  'Even for simple questions, send a message with your answer. Never leave the user without feedback.',
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

    try {
      instance.pty.kill();
    } catch (e) {
      // Process may already be dead
    }

    if (instance.onData) {
      instance.onData.dispose();
      instance.onData = null;
    }
    if (instance.onExit) {
      instance.onExit.dispose();
      instance.onExit = null;
    }

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
