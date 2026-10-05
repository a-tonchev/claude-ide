import { atom } from 'jotai';

import GlobalStateHelper from '@/components/state/GlobalStateHelper';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';

export const InstanceStores = {
  instancesStore: null,
  activeInstanceIdStore: null,
  inputDraftsStore: null,
  inputDraftFamilyStore: null,
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

// Map of instanceId -> instance data. AI instances also carry what this window has
// loaded from the database: feed (oldest first), feedTotal, feedLoaded and plans.
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

// Per-instance derived view of a single instance's draft text. Cards subscribe
// to their own slice through this family (via useStoreFamilyValue) so a keystroke
// in one card re-renders only that card — not every other card mounted in the
// group. Writes still go through setInputDraft on the shared inputDraftsStore, so
// drafts persist across group-tab switches (which unmount off-tab cards).
GlobalStateHelper.atomFamily({
  key: 'inputDraftFamilyStore',
  factory: instanceId => atom(get => get(InstanceStores.inputDraftsStore.jotai)[instanceId] || ''),
  store: InstanceStores,
});

export const setInputDraft = (instanceId, text) => {
  const current = InstanceStores.inputDraftsStore.get();
  InstanceStores.inputDraftsStore.set({ ...current, [instanceId]: text });
};

const LOADED_FIELDS = ['feed', 'feedTotal', 'feedLoaded', 'plans'];

const keepLoaded = existing => {
  const kept = {};
  if (!existing) return kept;
  LOADED_FIELDS.forEach(field => {
    if (existing[field] !== undefined) kept[field] = existing[field];
  });
  return kept;
};

// Snapshot fields are primitives or small arrays/objects (launchFlags, pendingInput).
const sameValue = (a, b) => a === b
  || (typeof a === 'object' && a !== null && JSON.stringify(a) === JSON.stringify(b));

const matchesSnapshot = (existing, inst) => Object.keys(inst).every(key => sameValue(existing[key], inst[key]));

export const setInstances = instances => {
  const current = InstanceStores.instancesStore.get();
  const map = {};
  if (Array.isArray(instances)) {
    instances.forEach(inst => {
      const existing = current[inst.id];
      // Server snapshots carry no feed or plans: keep what this window loaded, and keep
      // unchanged instances as they are so memoized cards don't re-render.
      map[inst.id] = existing && matchesSnapshot(existing, inst)
        ? existing
        : { ...keepLoaded(existing), ...inst };
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
  // Drop this instance's derived draft atom so the family cache doesn't grow forever
  InstanceStores.inputDraftFamilyStore?.jotai?.remove?.(instanceId);
};

export const setActiveInstanceId = id => {
  InstanceStores.activeInstanceIdStore.set(id);
};

// Apply `update(existing)` to one instance; returning null means nothing changed.
const updateInstance = (instanceId, update) => {
  const current = InstanceStores.instancesStore.get();
  const existing = current[instanceId];
  if (!existing) return;
  const changes = update(existing);
  if (!changes) return;
  InstanceStores.instancesStore.set({
    ...current,
    [instanceId]: { ...existing, ...changes },
  });
};

// Feed item ids are MongoDB ObjectIds, whose hex strings sort in creation order.
// Items the server failed to save have "unsaved-…" ids, which sort after them.
const byId = (a, b) => {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
};

const mergeFeed = (existing, incoming) => {
  const seen = new Set(existing.map(item => item.id));
  const added = incoming.filter(item => !seen.has(item.id));
  return added.length ? [...existing, ...added].sort(byId) : existing;
};

const samePlans = (a = [], b = []) => a.length === b.length
  && a.every((plan, i) => plan.id === b[i].id && plan.seen === b[i].seen && plan.title === b[i].title);

export const appendFeedItem = (instanceId, item) => {
  if (!item?.id) return;
  updateInstance(instanceId, existing => {
    const feed = existing.feed || [];
    if (feed.some(i => i.id === item.id)) return null;
    return { feed: mergeFeed(feed, [item]), feedTotal: (existing.feedTotal || 0) + 1 };
  });
};

// A page from /instances/feed. The first page also brings the instance's plans.
export const setFeedPage = (instanceId, { items = [], total = 0, plans = null }) => {
  updateInstance(instanceId, existing => {
    const feed = mergeFeed(existing.feed || [], items);
    const feedTotal = Math.max(total, feed.length);
    const changes = { feed, feedTotal, feedLoaded: true };
    if (plans) {
      const loadedIds = new Set(plans.map(p => p.id));
      changes.plans = [...plans, ...(existing.plans || []).filter(p => !loadedIds.has(p.id))];
    }
    // A reload that brought nothing new must not re-render the views
    const nothingNew = existing.feedLoaded && feed === existing.feed && feedTotal === existing.feedTotal
      && (!changes.plans || samePlans(changes.plans, existing.plans));
    return nothingNew ? null : changes;
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

export const addPlanToInstance = (instanceId, plan) => {
  updateInstance(instanceId, existing => {
    const plans = existing.plans || [];
    if (plan.id && plans.some(p => p.id === plan.id)) return null;
    return { plans: [...plans, plan] };
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

// Listen for state changes from other windows
if (syncChannel) {
  syncChannel.onmessage = event => {
    _fromSync = true;
    try {
      const msg = event.data;
      switch (msg.action) {
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
