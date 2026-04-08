import GlobalStateHelper from '@/components/state/GlobalStateHelper';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';

export const InstanceStores = {
  instancesStore: null,
  activeInstanceIdStore: null,
  inputDraftsStore: null,
};

// --- Cross-window sync via BroadcastChannel ---
const syncChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('claude-ide-instance-sync')
  : null;

let _fromSync = false; // prevent re-broadcasting received actions

function broadcast(action) {
  if (!syncChannel || _fromSync) return;
  syncChannel.postMessage(action);
}

/** Suppress BroadcastChannel broadcasts for the duration of fn().
 *  Use this when changes originate from a source all windows receive
 *  independently (e.g. WebSocket), so re-broadcasting would cause duplicates. */
export function withoutBroadcast(fn) {
  _fromSync = true;
  try {
    fn();
  } finally {
    _fromSync = false;
  }
}

// Map of instanceId -> instance data
GlobalStateHelper.atom({
  key: 'instancesStore',
  default: {},
  store: InstanceStores,
});

// Currently focused instance id
GlobalStateHelper.atom({
  key: 'activeInstanceIdStore',
  default: null,
  store: InstanceStores,
});

// Map of instanceId -> draft input text (persists across tab switches)
GlobalStateHelper.atom({
  key: 'inputDraftsStore',
  default: {},
  store: InstanceStores,
});

export const setInputDraft = (instanceId, text) => {
  const current = InstanceStores.inputDraftsStore.get();
  InstanceStores.inputDraftsStore.set({ ...current, [instanceId]: text });
};

export const getInputDraft = instanceId => {
  const current = InstanceStores.inputDraftsStore.get();
  return current[instanceId] || '';
};

// Derived: list of instances as array
GlobalStateHelper.computedAtom({
  key: 'instanceListStore',
  factory: get => Object.values(get(InstanceStores.instancesStore.jotai)),
  store: InstanceStores,
});

export const setInstances = instances => {
  const map = {};
  if (Array.isArray(instances)) {
    instances.forEach(inst => {
      map[inst.id] = inst;
    });
  }
  InstanceStores.instancesStore.set(map);
};

export const upsertInstance = instance => {
  if (!instance || !instance.id) return;
  const current = InstanceStores.instancesStore.get();
  InstanceStores.instancesStore.set({
    ...current,
    [instance.id]: {
      ...(current[instance.id] || {}),
      ...instance,
    },
  });
};

export const updateInstanceField = (instanceId, field, value) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      [field]: value,
    },
  });
  broadcast({
    action: 'updateField', instanceId, field, value,
  });
};

export const removeInstance = instanceId => {
  const current = InstanceStores.instancesStore.get();
  const { [instanceId]: _, ...rest } = current;
  InstanceStores.instancesStore.set(rest);

  if (InstanceStores.activeInstanceIdStore.get() === instanceId) {
    InstanceStores.activeInstanceIdStore.set(null);
  }

  // Clean up input draft for this instance
  const drafts = InstanceStores.inputDraftsStore.get();
  if (instanceId in drafts) {
    const { [instanceId]: _d, ...restDrafts } = drafts;
    InstanceStores.inputDraftsStore.set(restDrafts);
  }
};

export const setActiveInstanceId = id => {
  InstanceStores.activeInstanceIdStore.set(id);
};

export const addMilestone = (instanceId, milestone) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  // Deduplicate: skip if same accomplished+timestamp already exists
  const ms = existing.milestones || [];
  const ts = milestone.timestamp ? String(milestone.timestamp) : '';
  if (ts && ms.some(m => String(m.timestamp) === ts && m.accomplished === milestone.accomplished)) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      milestones: [...ms, milestone],
    },
  });
};

export const setPendingInput = (instanceId, pendingInput) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      pendingInput,
    },
  });
  broadcast({ action: 'setPendingInput', instanceId, pendingInput });
};

export const addUserMessage = (instanceId, text, timestamp) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  const ts = timestamp || new Date().toISOString();
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      userMessages: [...(existing.userMessages || []), { text, timestamp: ts }],
    },
  });
  broadcast({
    action: 'addUserMessage', instanceId, text, timestamp: ts,
  });
};

export const addClaudeMessage = (instanceId, message) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  // Deduplicate: skip if a message with the same text+timestamp already exists
  // (can happen when instance_state snapshot and claude_message event overlap)
  const msgs = existing.messages || [];
  const ts = message.timestamp ? String(message.timestamp) : '';
  if (ts && msgs.some(m => String(m.timestamp) === ts && m.text === message.text)) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      messages: [...msgs, message],
    },
  });
  broadcast({ action: 'addClaudeMessage', instanceId, message });
};

export const addPlanToInstance = (instanceId, plan) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: {
      ...existing,
      plans: [...(existing.plans || []), plan],
    },
  });
};

export const markPlanSeen = (instanceId, planId) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  const plans = (existing.plans || []).map(p => (p.id === planId ? { ...p, seen: true } : p));
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: { ...existing, plans },
  });
  Connections.postRequest(ApiEndpoints.plansMarkSeen, { _id: planId, instance_id: instanceId });
};

export const reassignInstancesToGroup = (oldGroupId, newGroupId) => {
  const current = InstanceStores.instancesStore.get();
  const updated = { ...current };
  let changed = false;
  for (const [id, inst] of Object.entries(updated)) {
    if (inst.groupId === oldGroupId) {
      updated[id] = { ...inst, groupId: newGroupId };
      changed = true;
    }
  }
  if (changed) {
    InstanceStores.instancesStore.set(updated);
  }
  return changed;
};

// Listen for state changes from other windows
if (syncChannel) {
  syncChannel.onmessage = event => {
    _fromSync = true;
    try {
      const msg = event.data;
      switch (msg.action) {
        case 'addUserMessage':
          addUserMessage(msg.instanceId, msg.text, msg.timestamp);
          break;
        case 'addClaudeMessage':
          addClaudeMessage(msg.instanceId, msg.message);
          break;
        case 'setPendingInput':
          setPendingInput(msg.instanceId, msg.pendingInput);
          break;
        case 'updateField':
          updateInstanceField(msg.instanceId, msg.field, msg.value);
          break;
        default:
          break;
      }
    } finally {
      _fromSync = false;
    }
  };
}

export default {};
