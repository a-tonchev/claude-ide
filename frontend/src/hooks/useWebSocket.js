import { useEffect, useRef, useCallback } from 'react';

import BasicConfig, { getServerBaseUrl } from '@/components/config/BasicConfig';
import {
  setInstances,
  upsertInstance,
  updateInstanceField,
  removeInstance,
  appendFeedItem,
  setPendingInput,
  addPlanToInstance,
  InstanceStores,
  withoutBroadcast,
} from '@/stores/instanceAtoms';
import { clearPlaceholder } from '@/stores/groupAtoms';
import { loadFeedIntoStore } from '@/hooks/useInstanceFeed';

const RECONNECT_DELAY = 3000;

// Safety net: ask for the instance list now and then. The answer re-subscribes this
// connection to every instance topic, so a window heals itself if it ever misses events.
const RESYNC_INTERVAL = 30000;

// Singleton WebSocket state — shared across all hook consumers
const wsState = {
  socket: null,
  connecting: false,
  sendQueue: [],
  listeners: new Set(),
  reconnectTimer: null,
  resyncTimer: null,
  // Set when a socket opens: feed items stored while this window was disconnected
  // aren't in its feeds yet, so the next snapshot reloads them once.
  resyncFeeds: false,
};

function getWsUrl() {
  const serverUrl = `${getServerBaseUrl()}/${BasicConfig.API_VERSION}`;
  return `${serverUrl.replace(/(http)(s)?:\/\//, 'ws$2://')}/ws`;
}

function sendJson(data) {
  const payload = JSON.stringify(data);

  if (wsState.socket?.readyState === WebSocket.OPEN) {
    wsState.socket.send(payload);
    return;
  }

  // Queue if not connected yet
  wsState.sendQueue.push(payload);
  // eslint-disable-next-line no-use-before-define
  connect();
}

function notifyListeners(message) {
  wsState.listeners.forEach(listener => {
    try {
      listener(message);
    } catch (e) {
      console.error('WS listener error:', e);
    }
  });
}

function handleMessage(event) {
  try {
    const message = JSON.parse(event.data);
    const { type } = message;

    // All windows receive the same WebSocket events independently,
    // so suppress BroadcastChannel re-broadcasting to prevent duplicates.
    withoutBroadcast(() => {
      switch (type) {
        case 'instances': {
          // The backend open handler already subscribes us to all instance topics,
          // so we just need to set the state — no need to send subscribe messages.
          setInstances(message.list || []);
          if (wsState.resyncFeeds) {
            wsState.resyncFeeds = false;
            const current = InstanceStores.instancesStore.get();
            (message.list || []).forEach(inst => {
              if (current[inst.id]?.feedLoaded) loadFeedIntoStore(inst.id);
            });
          }
          break;
        }

        case 'created':
          // Backend's subscribeAllClients already subscribes us to this topic,
          // so no need to send a subscribe message here. The feed is loaded from
          // the database by the views that show it (a resumed instance has one).
          upsertInstance({
            id: message.instanceId,
            projectId: message.projectId,
            projectName: message.projectName,
            title: message.title || null,
            type: message.instanceType || 'claude',
            provider: message.provider || 'claude',
            savedItemId: message.savedItemId || null,
            groupId: message.groupId || null,
            cwd: message.cwd || null,
            shell: message.shell || null,
            command: message.command || null,
            launchFlags: message.launchFlags || [],
            status: 'running',
            startedAt: new Date().toISOString(),
            pendingInput: null,
          });
          break;

        case 'instance_state':
          upsertInstance(message.instance);
          break;

        case 'status':
          updateInstanceField(message.instanceId, 'status', message.status);
          break;

        case 'title_update':
          updateInstanceField(message.instanceId, 'title', message.title || null);
          break;

        // The bookmark on a card: saved instances survive manual stops and group deletes
        case 'saved_update':
          updateInstanceField(message.instanceId, 'saved', !!message.saved);
          break;

        // "Move to group…": the instance now belongs to another group
        case 'group_changed': {
          const movedInst = InstanceStores.instancesStore.get()[message.instanceId];
          if (movedInst?.groupId && movedInst.groupId !== message.groupId) {
            clearPlaceholder(movedInst.groupId, message.instanceId);
          }
          updateInstanceField(message.instanceId, 'groupId', message.groupId);
          break;
        }

        case 'status_update': {
          // Don't let 'working'/'thinking' override 'waiting' — race condition guard
          const suInst = InstanceStores.instancesStore.get()[message.instanceId];
          if (suInst?.status === 'waiting' && suInst?.pendingInput
              && ['working', 'thinking', 'running'].includes(message.status)) {
            break;
          }
          updateInstanceField(message.instanceId, 'status', message.status);
          break;
        }

        // User messages, Claude messages (questions included) and milestones, as stored
        case 'feed_item':
          appendFeedItem(message.instanceId, message.item);
          break;

        case 'user_input_needed':
          setPendingInput(message.instanceId, {
            choices: message.choices,
          });
          updateInstanceField(message.instanceId, 'status', 'waiting');
          break;

        case 'pending_cleared':
          setPendingInput(message.instanceId, null);
          updateInstanceField(message.instanceId, 'status', 'working');
          break;

        case 'plan_saved':
          addPlanToInstance(message.instanceId, {
            id: message.planId,
            title: message.title,
            content: message.content || '',
            seen: false,
          });
          break;

        case 'group_started':
          (message.instances || []).forEach(inst => {
            upsertInstance({
              id: inst.instanceId,
              type: inst.type,
              provider: inst.provider || 'claude',
              savedItemId: inst.savedItemId || null,
              projectId: inst.projectId || null,
              projectName: inst.name,
              title: inst.title || null,
              groupId: message.groupId,
              cwd: inst.cwd || null,
              shell: inst.shell || null,
              command: inst.command || null,
              launchFlags: inst.launchFlags || [],
              status: 'running',
              startedAt: new Date().toISOString(),
              pendingInput: null,
            });
          });
          break;

        case 'group_stopped':
          (message.stoppedIds || []).forEach(id => {
            const inst = InstanceStores.instancesStore.get()[id];
            if (inst?.groupId) {
              clearPlaceholder(inst.groupId, id);
            }
            removeInstance(id);
          });
          break;

        // Manual stop, or (remembered: true) an instance that exited on its own and
        // moved to the remembered list.
        case 'stopped': {
          const stoppedInst = InstanceStores.instancesStore.get()[message.instanceId];
          if (stoppedInst?.groupId) {
            clearPlaceholder(stoppedInst.groupId, message.instanceId);
          }
          removeInstance(message.instanceId);
          break;
        }

        default:
          break;
      }
    });

    // Always forward to per-component listeners (for output, remembered_changed, etc.)
    notifyListeners(message);
  } catch (e) {
    console.error('WS message parse error:', e);
  }
}

function forceReconnect() {
  // If socket is already open, just request a fresh state snapshot
  if (wsState.socket?.readyState === WebSocket.OPEN) {
    sendJson({ type: 'list' });
    return;
  }
  // Kill any pending reconnect timer and connect immediately
  if (wsState.reconnectTimer) {
    clearTimeout(wsState.reconnectTimer);
    wsState.reconnectTimer = null;
  }
  wsState.connecting = false;
  // eslint-disable-next-line no-use-before-define
  connect();
}

// Re-sync when tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wsState.listeners.size > 0) {
    forceReconnect();
  }
});

function connect() {
  if (wsState.connecting || wsState.socket?.readyState === WebSocket.OPEN) return;
  wsState.connecting = true;

  if (wsState.reconnectTimer) {
    clearTimeout(wsState.reconnectTimer);
    wsState.reconnectTimer = null;
  }

  const url = getWsUrl();
  const socket = new WebSocket(url);

  socket.onopen = () => {
    wsState.connecting = false;
    wsState.socket = socket;
    wsState.resyncFeeds = true;

    // Flush queued messages
    while (wsState.sendQueue.length) {
      const payload = wsState.sendQueue.shift();
      socket.send(payload);
    }

    clearInterval(wsState.resyncTimer);
    wsState.resyncTimer = setInterval(() => {
      if (wsState.socket?.readyState === WebSocket.OPEN) sendJson({ type: 'list' });
    }, RESYNC_INTERVAL);

    notifyListeners({ type: 'ws_connected' });
  };

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    wsState.connecting = false;
    wsState.socket = null;
    clearInterval(wsState.resyncTimer);
    wsState.resyncTimer = null;
    notifyListeners({ type: 'ws_disconnected' });

    // Auto-reconnect
    wsState.reconnectTimer = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  };

  // Not logged: every reconnect attempt during a backend restart fires it, and onclose
  // (which always follows) reconnects.
  socket.onerror = () => {
    wsState.connecting = false;
  };
}

function disconnect() {
  if (wsState.reconnectTimer) {
    clearTimeout(wsState.reconnectTimer);
    wsState.reconnectTimer = null;
  }
  clearInterval(wsState.resyncTimer);
  wsState.resyncTimer = null;
  if (wsState.socket) {
    wsState.socket.close();
    wsState.socket = null;
  }
}

const useWebSocket = onMessage => {
  const listenerRef = useRef(onMessage);
  listenerRef.current = onMessage;

  useEffect(() => {
    const listener = msg => listenerRef.current?.(msg);
    wsState.listeners.add(listener);

    // Connect on first subscriber
    if (wsState.listeners.size === 1 && !wsState.socket) {
      connect();
    }

    return () => {
      wsState.listeners.delete(listener);

      // Disconnect when last subscriber leaves
      if (wsState.listeners.size === 0) {
        disconnect();
      }
    };
  }, []);

  const send = useCallback((type, data = {}) => {
    sendJson({ type, ...data });
  }, []);

  return { send };
};

export default useWebSocket;
