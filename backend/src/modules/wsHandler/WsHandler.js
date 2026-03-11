import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import InstanceManager from '#modules/instanceManager/InstanceManager';

const prefix = SystemSettingsServices.getRoutePrefix();
const wsPath = `${prefix}/ws`;

// Track all connected WebSocket clients so we can subscribe them to new instances
const connectedClients = new Set();

// How long (ms) with no PTY output before we consider a Claude instance idle
const IDLE_TIMEOUT_MS = 15000;

// Strip ANSI escape codes from terminal output
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

function sendJson(ws, data) {
  try {
    if (!ws.isClosed) {
      ws.send(JSON.stringify(data), false, true);
    }
  } catch (e) {
    console.error('WsHandler sendJson error:', e);
  }
}

// Subscribe ALL connected clients to an instance topic
function subscribeAllClients(instanceId) {
  const topic = `instance_${instanceId}`;
  for (const client of connectedClients) {
    if (!client.isClosed) {
      client.subscribe(topic);
    }
  }
}

// Compute and broadcast current status summary for an instance's group
function broadcastGroupStatus(instanceId) {
  const instance = InstanceManager.get(instanceId);
  if (!instance || !instance.groupId) return;

  const groupInstances = InstanceManager.getByGroupId(instance.groupId);
  const statuses = {};
  for (const inst of groupInstances) {
    if (inst.type !== 'terminal' && inst.status !== 'exited') {
      const s = inst.status || 'running';
      statuses[s] = (statuses[s] || 0) + 1;
    }
  }

  WsHandler.publish('global', {
    type: 'group_status',
    groupId: instance.groupId,
    statuses,
  });
}

function wireInstance(ws, instance) {
  ws.subscribe(`instance_${instance.id}`);

  // Idle detection for Claude instances
  let idleTimer = null;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function resetIdleTimer() {
    clearIdleTimer();
    if (instance.type !== 'claude') return;
    idleTimer = setTimeout(() => {
      // Only transition if currently in an active state
      if (['working', 'thinking'].includes(instance.status)) {
        instance.status = 'ready';
        WsHandler.publish(`instance_${instance.id}`, {
          type: 'status_update',
          instanceId: instance.id,
          status: 'ready',
        });
        broadcastGroupStatus(instance.id);
      }
    }, IDLE_TIMEOUT_MS);
  }

  instance.onData = instance.pty.onData(data => {
    if (instance.isCapturingPlan) {
      instance.outputBuffer += data;
    }

    // Reset idle timer on any output
    resetIdleTimer();

    // Quick prompt detection for Claude instances: if output contains
    // the Claude Code prompt indicator, transition to ready immediately
    if (instance.type === 'claude' && ['working', 'thinking', 'running'].includes(instance.status)) {
      const clean = stripAnsi(data);
      // Claude Code shows ">" or "❯" at start of line when waiting for input
      if (/(?:^|\n)\s*[>❯]\s*$/.test(clean)) {
        instance.status = 'ready';
        WsHandler.publish(`instance_${instance.id}`, {
          type: 'status_update',
          instanceId: instance.id,
          status: 'ready',
        });
        broadcastGroupStatus(instance.id);
      }
    }

    WsHandler.publish(`instance_${instance.id}`, {
      type: 'output',
      instanceId: instance.id,
      data,
    });
  });

  instance.onExit = instance.pty.onExit(({ exitCode }) => {
    clearIdleTimer();
    const uptime = Date.now() - instance.startedAt.getTime();
    if (uptime < 3000) {
      console.warn(`Instance ${instance.id} (${instance.type}/${instance.projectName}) exited after ${uptime}ms with code ${exitCode}`);
    }
    instance.status = 'exited';

    WsHandler.publish(`instance_${instance.id}`, {
      type: 'status',
      instanceId: instance.id,
      status: 'exited',
      exitCode,
    });

    broadcastGroupStatus(instance.id);
  });
}

function handleCreate(ws, message) {
  const { projectId, name, path, args, groupId } = message;

  if (!projectId || !path) {
    return sendJson(ws, { type: 'error', message: 'projectId and path are required' });
  }

  let instance;
  try {
    instance = InstanceManager.create(projectId, name || '', path, args || []);
  } catch (err) {
    console.error('Instance create failed:', err.message);
    return sendJson(ws, { type: 'error', message: err.message });
  }

  if (groupId) {
    InstanceManager.setGroupId(instance.id, groupId);
  }

  wireInstance(ws, instance);

  // Subscribe ALL connected clients to this new instance
  subscribeAllClients(instance.id);

  WsHandler.publish('global', {
    type: 'created',
    instanceId: instance.id,
    projectId: instance.projectId,
    projectName: instance.projectName,
    instanceType: instance.type,
    groupId: instance.groupId,
    cwd: instance.cwd,
  });

  if (instance.groupId) {
    broadcastGroupStatus(instance.id);
  }
}

function handleCreateTerminal(ws, message) {
  const { name, shell, command, cwd, groupId } = message;

  if (!shell) {
    return sendJson(ws, { type: 'error', message: 'shell is required' });
  }

  let instance;
  try {
    instance = InstanceManager.createTerminal({ name, shell, command, cwd, groupId });
  } catch (err) {
    console.error('Terminal create failed:', err.message);
    return sendJson(ws, { type: 'error', message: err.message });
  }

  wireInstance(ws, instance);

  // Subscribe ALL connected clients to this new instance
  subscribeAllClients(instance.id);

  WsHandler.publish('global', {
    type: 'created',
    instanceId: instance.id,
    projectName: instance.projectName,
    instanceType: instance.type,
    groupId: instance.groupId,
    cwd: instance.cwd,
    shell: instance.shell,
    command: instance.command,
  });
}

// Delay between writing text and \r so ConPTY forwards them as
// separate reads — otherwise the app treats it as pasted text.
const ENTER_DELAY_MS = 200;
// Delay before sending a second \r to confirm/submit the input.
// Claude Code treats the first Enter as a newline; the second (empty line) submits.
const SUBMIT_DELAY_MS = 1000;

// Track pending \r timeouts per instance to avoid overlap.
const pendingEnter = new Map();
// Track pending second-Enter (submit) timeouts per instance.
const pendingSubmit = new Map();

function cancelPendingSubmit(instanceId) {
  const prev = pendingSubmit.get(instanceId);
  if (prev) {
    clearTimeout(prev);
    pendingSubmit.delete(instanceId);
  }
}

function handleInput(ws, message) {
  const { instanceId, data } = message;
  if (!instanceId || data === undefined) return;

  // Cancel any pending submit-enter for this instance on new input.
  cancelPendingSubmit(instanceId);

  // If there's a pending \r for this instance, flush it before new input.
  const prev = pendingEnter.get(instanceId);
  if (prev) {
    clearTimeout(prev);
    pendingEnter.delete(instanceId);
    InstanceManager.write(instanceId, '\r');
  }

  if (data.length > 1 && data.endsWith('\r')) {
    InstanceManager.write(instanceId, data.slice(0, -1));
    const timer = setTimeout(() => {
      pendingEnter.delete(instanceId);
      InstanceManager.write(instanceId, '\r');
      // Schedule a second Enter after SUBMIT_DELAY_MS to actually submit.
      const submitTimer = setTimeout(() => {
        pendingSubmit.delete(instanceId);
        InstanceManager.write(instanceId, '\r');
      }, SUBMIT_DELAY_MS);
      pendingSubmit.set(instanceId, submitTimer);
    }, ENTER_DELAY_MS);
    pendingEnter.set(instanceId, timer);
  } else {
    InstanceManager.write(instanceId, data);
  }
}

function handleStop(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const instance = InstanceManager.get(instanceId);
  const groupId = instance?.groupId;

  cancelPendingSubmit(instanceId);
  const stopped = InstanceManager.stop(instanceId);
  if (stopped) {
    WsHandler.publish('global', { type: 'stopped', instanceId });
    // Update group tab status after removing the instance
    if (groupId) {
      const remaining = InstanceManager.getByGroupId(groupId);
      const statuses = {};
      for (const inst of remaining) {
        if (inst.type !== 'terminal' && inst.status !== 'exited') {
          const s = inst.status || 'running';
          statuses[s] = (statuses[s] || 0) + 1;
        }
      }
      WsHandler.publish('global', { type: 'group_status', groupId, statuses });
    }
  }
}

function handleResize(ws, message) {
  const { instanceId, cols, rows } = message;
  if (!instanceId || !cols || !rows) return;
  InstanceManager.resize(instanceId, cols, rows);
}

function handlePlan(ws, message) {
  const { instanceId, prompt } = message;
  if (!instanceId || !prompt) return;

  InstanceManager.startPlanCapture(instanceId, prompt);

  const planInput = [
    'Create a detailed implementation plan in markdown for the following task.',
    'Structure it with:',
    '- A clear title as # heading',
    '- Overview section',
    '- Phases or steps with ## headings',
    '- Specific file changes needed',
    '- Acceptance criteria or definition of done',
    '',
    `Task: ${prompt}`,
  ].join('\n');

  InstanceManager.write(instanceId, planInput);
  const planTimer = setTimeout(() => {
    pendingEnter.delete(instanceId);
    InstanceManager.write(instanceId, '\r');
  }, ENTER_DELAY_MS);
  pendingEnter.set(instanceId, planTimer);
}

function handleSubscribe(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const instance = InstanceManager.get(instanceId);
  if (!instance) {
    return sendJson(ws, { type: 'error', message: 'Instance not found' });
  }

  ws.subscribe(`instance_${instanceId}`);

  // Send full instance state so popup windows get all data
  sendJson(ws, {
    type: 'instance_state',
    instance: {
      id: instance.id,
      type: instance.type,
      projectId: instance.projectId,
      projectName: instance.projectName,
      cwd: instance.cwd,
      status: instance.status,
      startedAt: instance.startedAt,
      milestones: instance.milestones,
      messages: instance.messages || [],
      pendingInput: instance.pendingInput,
      userMessages: instance.userMessages,
      plans: instance.plans,
      groupId: instance.groupId,
      shell: instance.shell,
      command: instance.command,
    },
  });
}

function handleList(ws) {
  const instancesList = InstanceManager.list();
  // Re-subscribe in case this is a reconnect (open handler handles initial subscribe)
  for (const inst of instancesList) {
    ws.subscribe(`instance_${inst.id}`);
  }
  sendJson(ws, { type: 'instances', list: instancesList });
}

function handleUnsubscribe(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;
  ws.unsubscribe(`instance_${instanceId}`);
}

function handleUserResponse(ws, message) {
  const { instanceId, choice } = message;
  if (!instanceId || !choice) return;

  const instance = InstanceManager.get(instanceId);
  if (!instance) {
    return sendJson(ws, { type: 'error', message: 'Instance not found' });
  }

  InstanceManager.addUserMessage(instanceId, choice);
  cancelPendingSubmit(instanceId);
  InstanceManager.write(instanceId, choice);
  const choiceTimer = setTimeout(() => {
    pendingEnter.delete(instanceId);
    InstanceManager.write(instanceId, '\r');
  }, ENTER_DELAY_MS);
  pendingEnter.set(instanceId, choiceTimer);

  InstanceManager.clearPendingInput(instanceId);
  InstanceManager.updateStatus(instanceId, 'working');

  WsHandler.publish(`instance_${instanceId}`, {
    type: 'pending_cleared',
    instanceId,
  });

  WsHandler.publish(`instance_${instanceId}`, {
    type: 'status_update',
    instanceId,
    status: 'working',
  });
}

function handleUserMessage(ws, message) {
  const { instanceId, text, timestamp } = message;
  if (!instanceId || !text) return;
  InstanceManager.addUserMessage(instanceId, text, timestamp);

  // If there was a pending input (multiple-choice prompt), clear it on the backend
  // so reconnects don't resurrect stale choices.
  const instance = InstanceManager.get(instanceId);
  if (instance && instance.pendingInput) {
    InstanceManager.clearPendingInput(instanceId);
    WsHandler.publish(`instance_${instanceId}`, {
      type: 'pending_cleared',
      instanceId,
    });
  }
}

function handleStartGroup(ws, message) {
  const { groupId, items } = message;
  if (!groupId || !items || !items.length) {
    return sendJson(ws, { type: 'error', message: 'groupId and items are required' });
  }

  const createdInstances = [];

  for (const item of items) {
    try {
      let instance;
      if (item.type === 'claude') {
        instance = InstanceManager.create(item.projectId, item.name || '', item.path || '', []);
        InstanceManager.setGroupId(instance.id, groupId);
      } else if (item.type === 'terminal') {
        instance = InstanceManager.createTerminal({
          name: item.name,
          shell: item.shell,
          command: item.command,
          cwd: item.cwd,
          groupId,
        });
      }

      if (instance) {
        wireInstance(ws, instance);
        // Subscribe ALL connected clients to this new instance
        subscribeAllClients(instance.id);
        createdInstances.push({
          instanceId: instance.id,
          type: instance.type,
          name: instance.projectName,
          projectId: instance.projectId,
          cwd: instance.cwd,
          shell: instance.shell,
          command: instance.command,
        });
      }
    } catch (err) {
      console.error('Start group item failed:', err.message);
    }
  }

  WsHandler.publish('global', {
    type: 'group_started',
    groupId,
    instances: createdInstances,
  });

  // Broadcast initial group status so tabs show it immediately
  if (createdInstances.length > 0) {
    broadcastGroupStatus(createdInstances[0].instanceId);
  }
}

function handleStopGroup(ws, message) {
  const { groupId } = message;
  if (!groupId) return;

  const stoppedIds = InstanceManager.stopGroup(groupId);

  for (const instanceId of stoppedIds) {
    WsHandler.publish(`instance_${instanceId}`, {
      type: 'stopped',
      instanceId,
    });
  }

  WsHandler.publish('global', {
    type: 'group_stopped',
    groupId,
    stoppedIds,
  });

  // All instances stopped — clear group status
  WsHandler.publish('global', { type: 'group_status', groupId, statuses: {} });
}

function handleReassignGroup(ws, message) {
  const { oldGroupId, newGroupId } = message;
  if (!oldGroupId || !newGroupId) return;

  const instances = InstanceManager.getByGroupId(oldGroupId);
  for (const instance of instances) {
    InstanceManager.setGroupId(instance.id, newGroupId);
  }
}

const messageHandlers = {
  create: handleCreate,
  create_terminal: handleCreateTerminal,
  input: handleInput,
  stop: handleStop,
  resize: handleResize,
  plan: handlePlan,
  list: handleList,
  subscribe: handleSubscribe,
  unsubscribe: handleUnsubscribe,
  user_response: handleUserResponse,
  user_message: handleUserMessage,
  start_group: handleStartGroup,
  reassign_group: handleReassignGroup,
  stop_group: handleStopGroup,
};

const WsHandler = {
  app: null,

  setup(app) {
    WsHandler.app = app;

    app.ws(wsPath, {
      compression: 0,
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 0,

      upgrade: (res, req, context) => {
        res.onAborted(() => {
          console.error('WS upgrade aborted');
        });

        const secWsKey = req.getHeader('sec-websocket-key');
        const secWsProtocol = req.getHeader('sec-websocket-protocol');
        const secWsExtensions = req.getHeader('sec-websocket-extensions');

        res.cork(() => {
          res.upgrade(
            {},
            secWsKey,
            secWsProtocol,
            secWsExtensions,
            context,
          );
        });
      },

      open: ws => {
        ws.isClosed = false;
        connectedClients.add(ws);
        ws.subscribe('global');
        const instancesList = InstanceManager.list();
        // Auto-subscribe to all existing instance topics so the client
        // receives status_update, milestone, claude_message, etc.
        for (const inst of instancesList) {
          ws.subscribe(`instance_${inst.id}`);
        }
        sendJson(ws, { type: 'instances', list: instancesList });
      },

      message: (ws, message, isBinary) => {
        try {
          const utf8decoder = new TextDecoder();
          const raw = new Uint8Array(message);
          const parsed = JSON.parse(utf8decoder.decode(raw));
          const { type } = parsed;

          const handler = messageHandlers[type];
          if (handler) {
            handler(ws, parsed);
          } else {
            sendJson(ws, { type: 'error', message: `Unknown message type: ${type}` });
          }
        } catch (e) {
          console.error('WsHandler message parse error:', e);
          sendJson(ws, { type: 'error', message: 'Invalid message format' });
        }
      },

      close: (ws) => {
        ws.isClosed = true;
        connectedClients.delete(ws);
      },
    });
  },

  publish(topic, data) {
    if (WsHandler.app) {
      WsHandler.app.publish(topic, JSON.stringify(data), false, true);
    }
  },
};

export { broadcastGroupStatus };
export default WsHandler;
