import { useEffect, useRef, useCallback } from 'react';

import BasicConfig from '@/components/config/BasicConfig';
import {
  setInstances,
  upsertInstance,
  updateInstanceField,
  removeInstance,
  addMilestone,
  addClaudeMessage,
  setPendingInput,
  addPlanToInstance,
  InstanceStores,
  withoutBroadcast,
} from '@/stores/instanceAtoms';
import { clearPlaceholder } from '@/stores/groupAtoms';

const RECONNECT_DELAY = 3000;

// Singleton WebSocket state — shared across all hook consumers
const wsState = {
  socket: null,
  connecting: false,
  sendQueue: [],
  listeners: new Set(),
  reconnectTimer: null,
};

function getWsUrl() {
  const serverUrl = `${BasicConfig.SERVER_URL}/${BasicConfig.API_VERSION}`;
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
        case 'instances':
          // The backend open handler already subscribes us to all instance topics,
          // so we just need to set the state — no need to send subscribe messages
          // (sending subscribe would trigger redundant instance_state responses
          // that race with claude_message events and cause duplicates).
          setInstances(message.list || []);
          break;

        case 'created':
          // Backend's subscribeAllClients already subscribes us to this topic,
          // so no need to send a subscribe message here.
          upsertInstance({
            id: message.instanceId,
            projectId: message.projectId,
            projectName: message.projectName,
            type: message.instanceType || 'claude',
            groupId: message.groupId || null,
            cwd: message.cwd || null,
            shell: message.shell || null,
            command: message.command || null,
            status: 'running',
            startedAt: new Date().toISOString(),
            milestones: [],
            messages: [],
            plans: [],
            pendingInput: null,
          });
          break;

        case 'instance_state':
          upsertInstance(message.instance);
          break;

        case 'status':
          updateInstanceField(message.instanceId, 'status', message.status);
          break;

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

        case 'milestone':
          addMilestone(message.instanceId, {
            accomplished: message.accomplished,
            workingOn: message.workingOn,
            timestamp: message.timestamp || new Date().toISOString(),
          });
          break;

        case 'claude_message':
          addClaudeMessage(message.instanceId, {
            text: message.text,
            type: message.messageType || 'info',
            timestamp: message.timestamp || new Date().toISOString(),
          });
          break;

        case 'user_input_needed':
          // Add the question text as a chat message immediately
          if (message.message) {
            addClaudeMessage(message.instanceId, {
              text: message.message,
              type: 'question',
              timestamp: new Date().toISOString(),
            });
          }
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
          });
          break;

        case 'group_started':
          (message.instances || []).forEach(inst => {
            upsertInstance({
              id: inst.instanceId,
              type: inst.type,
              projectId: inst.projectId || null,
              projectName: inst.name,
              groupId: message.groupId,
              cwd: inst.cwd || null,
              shell: inst.shell || null,
              command: inst.command || null,
              status: 'running',
              startedAt: new Date().toISOString(),
              milestones: [],
              messages: [],
              plans: [],
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

    // Always forward to per-component listeners (for output, plan_ready, etc.)
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

    // Flush queued messages
    while (wsState.sendQueue.length) {
      const payload = wsState.sendQueue.shift();
      socket.send(payload);
    }

    notifyListeners({ type: 'ws_connected' });
  };

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    wsState.connecting = false;
    wsState.socket = null;
    notifyListeners({ type: 'ws_disconnected' });

    // Auto-reconnect
    wsState.reconnectTimer = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  };

  socket.onerror = error => {
    console.error('WS error:', error);
    wsState.connecting = false;
    // onclose will fire after onerror, which triggers reconnect
  };
}

function disconnect() {
  if (wsState.reconnectTimer) {
    clearTimeout(wsState.reconnectTimer);
    wsState.reconnectTimer = null;
  }
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
