import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import InstanceManager from '#modules/instanceManager/InstanceManager';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import DatabaseHelpers from '#modules/db/DatabaseHelpers';
import { getSharedDb } from '#modules/db/mongoPool';
import SettingsEnums from '#lib/settings/enums/SettingsEnums';
import GroupEnums from '#lib/groups/enums/GroupEnums';
import { FeedKinds } from '#lib/instances/enums/InstanceEnums';
import FileStore from '#modules/files/FileStore';

const prefix = SystemSettingsServices.getRoutePrefix();
const wsPath = `${prefix}/ws`;

// Track all connected WebSocket clients so we can subscribe them to new instances
const connectedClients = new Set();

// How long (ms) with no PTY output before we consider a Claude instance idle
const IDLE_TIMEOUT_MS = 15000;

// An instance (new or resumed) that exits this quickly never really started.
const START_FAILURE_WINDOW_MS = 10000;

// Reusable TextDecoder for WebSocket messages
const utf8decoder = new TextDecoder();

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

// Status counts of a group's running AI instances, for the tab chips
function publishGroupStatus(groupId) {
  const statuses = {};
  for (const inst of InstanceManager.getByGroupId(groupId)) {
    if ((inst.type === 'claude' || inst.type === 'observer') && inst.status !== 'exited') {
      const s = inst.status || 'running';
      statuses[s] = (statuses[s] || 0) + 1;
    }
  }
  WsHandler.publish('global', { type: 'group_status', groupId, statuses });
}

function broadcastGroupStatus(instanceId) {
  const instance = InstanceManager.get(instanceId);
  if (instance?.groupId) publishGroupStatus(instance.groupId);
}

// Tell every client about an instance's status, including the group tab counts
function publishStatus(instanceId, status) {
  WsHandler.publish(`instance_${instanceId}`, { type: 'status_update', instanceId, status });
  broadcastGroupStatus(instanceId);
}

function setStatus(instanceId, status) {
  InstanceManager.updateStatus(instanceId, status);
  publishStatus(instanceId, status);
}

// Store a feed item (user message, Claude message, milestone) and push the stored
// item to every client. If the database write fails the item is still shown live,
// but it won't be there after a reload.
async function recordFeedItem(instanceId, item) {
  let stored;
  try {
    stored = await InstanceStore.addFeedItem(instanceId, item);
  } catch (err) {
    console.error(`[instance ${instanceId}] feed item not saved:`, err.message);
    stored = {
      ...item, id: `unsaved-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date(),
    };
  }
  WsHandler.publish(`instance_${instanceId}`, { type: 'feed_item', instanceId, item: stored });
  return stored;
}

// Launch flags are settings docs (type launchFlag). Clients send ids only; the
// args and instructions are read here so a client can't dictate what gets
// appended to the command line. Order follows the ids as sent.
async function resolveLaunchFlags(flagIds) {
  const ids = Array.isArray(flagIds) ? flagIds.filter(id => typeof id === 'string') : [];
  if (!ids.length) return [];
  const db = getSharedDb();
  if (!db) return [];
  const objectIds = DatabaseHelpers.getObjectIds(ids).filter(Boolean);
  const docs = await db.collection(SettingsEnums.COLLECTION_NAME)
    .find({ _id: { $in: objectIds }, type: SettingsEnums.TYPES.LAUNCH_FLAG })
    .toArray();
  const byId = new Map(docs.map(d => [d._id.toString(), d]));
  return ids
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(d => ({
      id: d._id.toString(),
      name: d.name,
      args: d.args || '',
      instructions: d.instructions || '',
    }));
}

function wireInstance(ws, instance) {
  // The creating socket may have closed while launch flags were resolved.
  if (!ws.isClosed) ws.subscribe(`instance_${instance.id}`);

  // Idle detection for Claude instances
  let idleTimer = null;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  // Expose cleanup so InstanceManager.stop() can clear it
  instance.clearIdleTimer = clearIdleTimer;

  function resetIdleTimer() {
    clearIdleTimer();
    if (instance.type !== 'claude' && instance.type !== 'observer') return;
    idleTimer = setTimeout(() => {
      // Only transition if currently in an active state
      if (['working', 'thinking'].includes(instance.status)) setStatus(instance.id, 'ready');
    }, IDLE_TIMEOUT_MS);
  }

  instance.onData = instance.pty.onData(data => {
    // Reset idle timer on any output
    resetIdleTimer();

    // Quick prompt detection for Claude instances: if output contains
    // the Claude Code prompt indicator, transition to ready immediately
    if (instance.provider !== 'codex' && (instance.type === 'claude' || instance.type === 'observer') && ['working', 'thinking', 'running'].includes(instance.status)) {
      const clean = stripAnsi(data);
      // Claude Code shows ">" or "❯" at start of line when waiting for input
      if (/(?:^|\n)\s*[>❯]\s*$/.test(clean)) setStatus(instance.id, 'ready');
    }

    WsHandler.publish(`instance_${instance.id}`, {
      type: 'output',
      instanceId: instance.id,
      data,
    });
  });

  instance.onExit = instance.pty.onExit(({ exitCode }) => {
    clearIdleTimer();
    cleanupPendingTimers(instance.id);
    InstanceManager.detectCodexSession(instance.id, { force: true });

    // An instance that ends this soon never really started; its remembered entry says so.
    const uptime = Date.now() - instance.startedAt.getTime();
    let startError = null;
    if (uptime < START_FAILURE_WINDOW_MS) {
      const seconds = Math.round(uptime / 1000);
      console.warn(`Instance ${instance.id} (${instance.type}/${instance.projectName}) exited after ${uptime}ms with code ${exitCode}`);
      startError = instance.resumed
        ? `The session could not be resumed (exited with code ${exitCode} after ${seconds}s).`
        : `The instance stopped right after starting (exit code ${exitCode} after ${seconds}s). `
          + 'Check that the CLI is installed and its launch flags are valid.';
    }
    InstanceManager.markExited(instance.id, { resumeError: startError });
    // Said out loud, so a card that can't start (e.g. a bad launch flag) doesn't fail silently
    if (startError && instance.type !== 'terminal') {
      WsHandler.publish('global', {
        type: 'start_failed',
        instanceId: instance.id,
        savedItemId: instance.savedItemId || null,
        groupId: instance.groupId,
        name: instance.title || instance.projectName,
        message: startError,
      });
    }

    WsHandler.publish(`instance_${instance.id}`, {
      type: 'status',
      instanceId: instance.id,
      status: 'exited',
      exitCode,
    });

    broadcastGroupStatus(instance.id);

    // Keep the card a moment so clients see the exit, then hand AI instances over
    // to the remembered list. Exited terminals stay until the page reloads.
    setTimeout(() => {
      if (InstanceManager.removeIfExited(instance.id) && instance.type !== 'terminal') {
        WsHandler.publish('global', { type: 'stopped', instanceId: instance.id, remembered: true });
        WsHandler.publish('global', { type: 'remembered_changed' });
      }
    }, 5000);
  });
}

// Wire a new or resumed instance and announce it to every client.
function announce(ws, instance) {
  wireInstance(ws, instance);
  subscribeAllClients(instance.id);
  WsHandler.publish('global', {
    ...InstanceManager.toPublic(instance),
    type: 'created',
    instanceId: instance.id,
    instanceType: instance.type,
  });
  broadcastGroupStatus(instance.id);
}

// The running instances, with the client subscribed to each one's topic so it
// receives status_update, feed_item, etc.
function sendInstanceList(ws) {
  const list = InstanceManager.list();
  for (const inst of list) {
    ws.subscribe(`instance_${inst.id}`);
  }
  sendJson(ws, { type: 'instances', list });
}

async function handleCreate(ws, message) {
  const {
    projectId, name, path, args, groupId, flagIds, provider = 'claude', savedItemId = null,
  } = message;

  if (!projectId || !path) {
    return sendJson(ws, { type: 'error', message: 'projectId and path are required' });
  }

  let instance;
  try {
    const launchFlags = provider === 'claude' ? await resolveLaunchFlags(flagIds) : [];
    instance = InstanceManager.create(projectId, name || '', path, args || [], {
      launchFlags, provider, savedItemId, groupId: groupId || null,
    });
  } catch (err) {
    console.error('Instance create failed:', err.message);
    return sendJson(ws, { type: 'error', message: err.message });
  }

  announce(ws, instance);
}

function handleCreateObserver(ws, message) {
  const { name, observerId, cwd, groupId } = message;

  if (!observerId || !cwd) {
    return sendJson(ws, { type: 'error', message: 'observerId and cwd are required' });
  }

  let instance;
  try {
    instance = InstanceManager.createObserver(observerId, name || '', cwd, groupId);
  } catch (err) {
    console.error('Observer create failed:', err.message);
    return sendJson(ws, { type: 'error', message: err.message });
  }

  announce(ws, instance);
}

function handleCreateTerminal(ws, message) {
  const {
    name, shell, command, cwd, groupId, savedItemId,
  } = message;

  if (!shell) {
    return sendJson(ws, { type: 'error', message: 'shell is required' });
  }

  let instance;
  try {
    instance = InstanceManager.createTerminal({
      name, shell, command, cwd, groupId, savedItemId,
    });
  } catch (err) {
    console.error('Terminal create failed:', err.message);
    return sendJson(ws, { type: 'error', message: err.message });
  }

  announce(ws, instance);
}

// Bring a remembered instance back: same id (so its messages and plans follow),
// same session, in the group the user picked.
async function handleResume(ws, message) {
  const { recordId, groupId = null } = message;
  if (!recordId) {
    return sendJson(ws, { type: 'error', message: 'recordId is required' });
  }

  const record = await InstanceStore.getRecord(recordId);
  if (!record) {
    return sendJson(ws, { type: 'error', message: 'This instance no longer exists.' });
  }

  let instance;
  try {
    const launchFlags = record.type !== 'observer' && record.provider === 'claude'
      ? await resolveLaunchFlags(record.flagIds)
      : [];
    // Checked after the last await: from here create() runs synchronously, so two resume
    // requests for the same record can't both start it.
    if (InstanceManager.get(recordId)) {
      return sendJson(ws, { type: 'error', message: 'This instance is already running.' });
    }
    instance = record.type === 'observer'
      ? InstanceManager.createObserver(record.projectId, record.projectName, record.cwd, groupId, { record })
      : InstanceManager.create(record.projectId, record.projectName || '', record.cwd, [], {
        launchFlags, provider: record.provider, savedItemId: record.savedItemId || null, groupId, record,
      });
  } catch (err) {
    console.error('Instance resume failed:', err.message);
    await InstanceStore.updateRecord(recordId, { resumeError: err.message })
      .catch(saveErr => console.error(`[instance ${recordId}] resume error not saved:`, saveErr.message));
    WsHandler.publish('global', { type: 'remembered_changed' });
    return sendJson(ws, { type: 'error', message: err.message });
  }

  announce(ws, instance);
  WsHandler.publish('global', { type: 'remembered_changed' });
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

// Attachments reach the AI as their full paths, added to the message it is sent
function withAttachmentPaths(instanceId, text, attachmentIds) {
  const files = FileStore.describe(instanceId, attachmentIds);
  if (!files.length) return text;
  const list = files.map(f => `"${f.path}"`).join(', ');
  return `${text}\n\nAttached files: ${list}`;
}

function handleInput(ws, message) {
  const { instanceId, attachments } = message;
  let { data } = message;
  if (!instanceId || data === undefined) return;
  if (Array.isArray(attachments) && attachments.length && data.endsWith('\r')) {
    data = `${withAttachmentPaths(instanceId, data.slice(0, -1), attachments)}\r`;
  }

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

function cleanupPendingTimers(instanceId) {
  cancelPendingSubmit(instanceId);
  const enterTimer = pendingEnter.get(instanceId);
  if (enterTimer) {
    clearTimeout(enterTimer);
    pendingEnter.delete(instanceId);
  }
}

// A manual stop: the instance is gone for good, record and messages included.
function handleStop(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const groupId = InstanceManager.get(instanceId)?.groupId;

  cleanupPendingTimers(instanceId);
  if (InstanceManager.stop(instanceId, { discard: true })) {
    WsHandler.publish('global', { type: 'stopped', instanceId });
    if (groupId) publishGroupStatus(groupId);
  }
}

function handleResize(ws, message) {
  const { instanceId, cols, rows } = message;
  if (!instanceId || !cols || !rows) return;
  InstanceManager.resize(instanceId, cols, rows);
}

function handleSubscribe(ws, message) {
  const { instanceId } = message;
  if (!instanceId) return;

  const instance = InstanceManager.get(instanceId);
  if (!instance) {
    return sendJson(ws, { type: 'error', message: 'Instance not found' });
  }

  ws.subscribe(`instance_${instanceId}`);

  // Full instance state so popup windows get all data. The feed and plans are
  // loaded from the database by the client.
  sendJson(ws, { type: 'instance_state', instance: InstanceManager.toPublic(instance) });
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

  recordFeedItem(instanceId, { kind: FeedKinds.USER, text: choice });
  cancelPendingSubmit(instanceId);
  InstanceManager.write(instanceId, choice);
  const choiceTimer = setTimeout(() => {
    pendingEnter.delete(instanceId);
    InstanceManager.write(instanceId, '\r');
  }, ENTER_DELAY_MS);
  pendingEnter.set(instanceId, choiceTimer);

  InstanceManager.clearPendingInput(instanceId);
  WsHandler.publish(`instance_${instanceId}`, {
    type: 'pending_cleared',
    instanceId,
  });
  setStatus(instanceId, 'working');
}

function handleUserMessage(ws, message) {
  const { instanceId, text, attachments } = message;
  if (!instanceId || !text) return;
  const instance = InstanceManager.get(instanceId);
  if (!instance) return;

  // The feed shows attachments as files, not as the paths the AI gets
  const files = FileStore.describe(instanceId, attachments).map(({ path: filePath, ...file }) => file);
  recordFeedItem(instanceId, { kind: FeedKinds.USER, text, attachments: files });
  InstanceManager.detectCodexSession(instanceId);

  // If there was a pending input (multiple-choice prompt), clear it on the backend
  // so reconnects don't resurrect stale choices.
  if (instance.pendingInput) {
    InstanceManager.clearPendingInput(instanceId);
    WsHandler.publish(`instance_${instanceId}`, {
      type: 'pending_cleared',
      instanceId,
    });
  }
}

async function handleStartGroup(ws, message) {
  const { groupId, items } = message;
  if (!groupId || !items || !items.length) {
    return sendJson(ws, { type: 'error', message: 'groupId and items are required' });
  }

  const createdInstances = [];

  for (const item of items) {
    try {
      let instance;
      if (item.type === 'claude') {
        // eslint-disable-next-line no-await-in-loop
        const launchFlags = (item.provider || 'claude') === 'claude' ? await resolveLaunchFlags(item.flagIds) : [];
        instance = InstanceManager.create(item.projectId, item.name || '', item.path || '', [], {
          launchFlags, provider: item.provider || 'claude', savedItemId: item.id || null, groupId,
        });
      } else if (item.type === 'observer') {
        instance = InstanceManager.createObserver(item.observerId, item.name || '', item.cwd || '', groupId);
      } else if (item.type === 'terminal') {
        instance = InstanceManager.createTerminal({
          name: item.name,
          shell: item.shell,
          command: item.command,
          cwd: item.cwd,
          groupId,
          savedItemId: item.id || null,
        });
      }

      if (instance) {
        wireInstance(ws, instance);
        // Subscribe ALL connected clients to this new instance
        subscribeAllClients(instance.id);
        createdInstances.push({
          ...InstanceManager.toPublic(instance), instanceId: instance.id, name: instance.projectName,
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

  // Group status so tabs show it immediately
  if (createdInstances.length > 0) publishGroupStatus(groupId);
}

// "Stop all" on a group is a manual stop for every instance in it. group_stopped
// carries the ids, so clients remove each instance from that one message.
function handleStopGroup(ws, message) {
  const { groupId } = message;
  if (!groupId) return;

  const stoppedIds = InstanceManager.stopGroup(groupId, { discard: true });
  stoppedIds.forEach(cleanupPendingTimers);

  WsHandler.publish('global', {
    type: 'group_stopped',
    groupId,
    stoppedIds,
  });
  publishGroupStatus(groupId);
}

// "Move to group…" on a running card. The instance's record follows, so it stays in the
// new group after a refresh, a restart or a resume.
async function handleMoveGroup(ws, message) {
  const { instanceId, groupId } = message;
  if (!instanceId || typeof groupId !== 'string') {
    return sendJson(ws, { type: 'error', message: 'instanceId and groupId are required' });
  }

  const groupObjectId = DatabaseHelpers.getObjectId(groupId);
  const group = groupObjectId && await getSharedDb()?.collection(GroupEnums.COLLECTION_NAME)
    .findOne({ _id: groupObjectId }, { projection: { _id: 1 } });
  if (!group) {
    return sendJson(ws, { type: 'error', message: 'The selected group no longer exists.' });
  }

  // After the await: the instance may have stopped meanwhile
  const moved = InstanceManager.setGroup(instanceId, groupId);
  if (!moved) {
    return sendJson(ws, { type: 'error', message: 'This instance is no longer running.' });
  }

  WsHandler.publish('global', {
    type: 'group_changed', instanceId, groupId, previousGroupId: moved.previousGroupId,
  });
  if (moved.previousGroupId) publishGroupStatus(moved.previousGroupId);
  publishGroupStatus(groupId);
}

// Titles are saved on the instance record, so they survive a resume.
// Empty title = reset to default.
function handleRename(ws, message) {
  const { instanceId, title } = message;
  if (!instanceId || typeof title !== 'string') return;

  const instance = InstanceManager.get(instanceId);
  if (!instance) {
    return sendJson(ws, { type: 'error', message: 'Instance not found' });
  }

  const trimmed = title.trim().slice(0, 120);
  InstanceManager.setTitle(instanceId, trimmed || null);

  WsHandler.publish(`instance_${instanceId}`, {
    type: 'title_update',
    instanceId,
    title: trimmed || null,
  });
}

const messageHandlers = {
  create: handleCreate,
  create_observer: handleCreateObserver,
  create_terminal: handleCreateTerminal,
  resume: handleResume,
  input: handleInput,
  stop: handleStop,
  resize: handleResize,
  list: sendInstanceList,
  subscribe: handleSubscribe,
  unsubscribe: handleUnsubscribe,
  user_response: handleUserResponse,
  user_message: handleUserMessage,
  rename: handleRename,
  move_group: handleMoveGroup,
  start_group: handleStartGroup,
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
        sendInstanceList(ws);
      },

      message: (ws, message, isBinary) => {
        try {
          const raw = new Uint8Array(message);
          const parsed = JSON.parse(utf8decoder.decode(raw));
          const { type } = parsed;

          const handler = messageHandlers[type];
          if (handler) {
            // create / start_group / resume are async (they read from the DB)
            const result = handler(ws, parsed);
            if (result && typeof result.catch === 'function') {
              result.catch(err => {
                console.error(`WsHandler ${type} failed:`, err);
                sendJson(ws, { type: 'error', message: err.message || 'Request failed' });
              });
            }
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

export {
  broadcastGroupStatus, publishStatus, recordFeedItem, setStatus,
};
export default WsHandler;
