import GlobalStateHelper from '@/components/state/GlobalStateHelper';
import UrlHelper from '@/components/connections/UrlHelper';

export const GroupStores = {
  groupsStore: null,
  activeGroupIdStore: null,
  placeholdersStore: null,
};

// Object map: groupId -> { id, name, items, saved }
GlobalStateHelper.atom({
  key: 'groupsStore',
  default: {},
  store: GroupStores,
});

// Currently selected group tab
GlobalStateHelper.atom({
  key: 'activeGroupIdStore',
  default: null,
  store: GroupStores,
});

// Object map: groupId -> { placeholder1: instanceId|null, placeholder2: instanceId|null }
GlobalStateHelper.atom({
  key: 'placeholdersStore',
  default: {},
  store: GroupStores,
});

// Derived: list of groups as array
GlobalStateHelper.computedAtom({
  key: 'groupListStore',
  factory: get => Object.values(get(GroupStores.groupsStore.jotai)),
  store: GroupStores,
});

export const setGroups = (groups, implicitToPreserve = {}) => {
  const map = { ...implicitToPreserve };
  if (Array.isArray(groups)) {
    groups.forEach(g => {
      map[g._id || g.id] = { ...g, id: g._id || g.id };
    });
  }
  GroupStores.groupsStore.set(map);
};

export const upsertGroup = group => {
  if (!group || !group.id) return;
  const current = GroupStores.groupsStore.get();
  GroupStores.groupsStore.set({
    ...current,
    [group.id]: {
      ...(current[group.id] || {}),
      ...group,
    },
  });
};

export const removeGroup = groupId => {
  const current = GroupStores.groupsStore.get();
  const { [groupId]: _, ...rest } = current;
  GroupStores.groupsStore.set(rest);

  if (GroupStores.activeGroupIdStore.get() === groupId) {
    const remaining = Object.keys(rest);
    const nextId = remaining.length ? remaining[0] : null;
    GroupStores.activeGroupIdStore.set(nextId);
    // Keep URL in sync
    if (nextId) {
      UrlHelper.setParam('group', nextId);
    } else {
      UrlHelper.deleteParam('group');
    }
  }

  // Clean up placeholders for this group
  const placeholders = GroupStores.placeholdersStore.get();
  const { [groupId]: __, ...restPlaceholders } = placeholders;
  GroupStores.placeholdersStore.set(restPlaceholders);
};

export const setActiveGroupId = id => {
  GroupStores.activeGroupIdStore.set(id);
};

export const setPlaceholder = (groupId, slot, instanceId) => {
  const current = GroupStores.placeholdersStore.get();
  const groupPlaceholders = current[groupId] || { placeholder1: null, placeholder2: null };
  GroupStores.placeholdersStore.set({
    ...current,
    [groupId]: {
      ...groupPlaceholders,
      [slot]: instanceId,
    },
  });
};

export const initPlaceholders = groupId => {
  const current = GroupStores.placeholdersStore.get();
  if (!current[groupId]) {
    GroupStores.placeholdersStore.set({
      ...current,
      [groupId]: { placeholder1: null, placeholder2: null },
    });
  }
};

export const clearPlaceholder = (groupId, instanceId) => {
  const current = GroupStores.placeholdersStore.get();
  const gp = current[groupId];
  if (!gp) return;
  const updated = { ...gp };
  if (updated.placeholder1 === instanceId) updated.placeholder1 = null;
  if (updated.placeholder2 === instanceId) updated.placeholder2 = null;
  GroupStores.placeholdersStore.set({
    ...current,
    [groupId]: updated,
  });
};

export default {};
