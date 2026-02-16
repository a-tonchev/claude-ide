import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import InstanceManager from '#modules/instanceManager/InstanceManager';

const prefix = SystemSettingsServices.getRoutePrefix();
const wsPath = `${prefix}/ws`;

function sendJson(ws, data) {
  try {
    if (!ws.isClosed) {
      ws.send(JSON.stringify(data), false, true);
    }
  } catch (e) {
    console.error('WsHandler sendJson error:', e);
  }
}

function wireInstance(ws, instance) {
  ws.subscribe(`instance_${instance.id}`);

  instance.onData = instance.pty.onData(data => {
    if (instance.isCapturingPlan) {
      instance.outputBuffer += data;
    }

    WsHandler.publish(`instance_${instance.id}`, {
      type: 'output',
      instanceId: instance.id,
      data,
    });
  });

  instance.onExit = instance.pty.onExit(({ exitCode }) => {
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

  WsHandler.publish('global', {
    type: 'created',
    instanceId: instance.id,
    projectId: instance.projectId,
    projectName: instance.projectName,
    instanceType: instance.type,
    groupId: instance.groupId,
    cwd: instance.cwd,
  });
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
const ENTER_DELAY_MS = 100;

function handleInput(ws, message) {
  const { instanceId, data } = message;
  if (!instanceId || data === undefined) return;

  if (data.length > 1 && data.endsWith('\r')) {
    InstanceManager.write(instanceId, data.slice(0, -1));
    setTimeout(() => InstanceManager.write(instanceId, '\r'), ENTER_DELAY_MS);
  } else {
    InstanceManager.write(instanceId, data);
  }
}

function handleStop(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const stopped = InstanceManager.stop(instanceId);
  if (stopped) {
    WsHandler.publish('global', { type: 'stopped', instanceId });
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
  setTimeout(() => InstanceManager.write(instanceId, '\r'), ENTER_DELAY_MS);
}

function handleSubscribe(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const instance = InstanceManager.get(instanceId);
  if (!instance) {
    return sendJson(ws, { type: 'error', message: 'Instance not found' });
  }

  ws.subscribe(`instance_${instanceId}`);
  sendJson(ws, {
    type: 'status',
    instanceId,
    status: instance.status,
  });
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
  InstanceManager.write(instanceId, choice);
  setTimeout(() => InstanceManager.write(instanceId, '\r'), ENTER_DELAY_MS);
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
        ws.subscribe('global');
        const instancesList = InstanceManager.list();
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
      },
    });
  },

  publish(topic, data) {
    if (WsHandler.app) {
      WsHandler.app.publish(topic, JSON.stringify(data), false, true);
    }
  },
};

export default WsHandler;
