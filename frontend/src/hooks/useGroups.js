import { useCallback } from 'react';

import { useStoreValue } from '@/components/state/GlobalState';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import useQueryState from '@/components/connections/hooks/useQueryState';
import {
  GroupStores,
  setGroups,
  upsertGroup,
  removeGroup,
  setActiveGroupId,
  initPlaceholders,
} from '@/stores/groupAtoms';
import { reassignInstancesToGroup } from '@/stores/instanceAtoms';

const useGroups = () => {
  const groups = useStoreValue(GroupStores.groupsStore);
  const activeGroupIdFromStore = useStoreValue(GroupStores.activeGroupIdStore);
  const placeholders = useStoreValue(GroupStores.placeholdersStore);
  const [groupFromUrl, setGroupInUrl] = useQueryState(null, 'group');

  // URL is source of truth for saved groups; 'new' means use the Jotai store value
  const activeGroupId = (groupFromUrl && groupFromUrl !== 'new')
    ? groupFromUrl
    : activeGroupIdFromStore;

  const setActiveGroup = useCallback(id => {
    setActiveGroupId(id);
    // Saved groups get their real ID in URL; unsaved get 'new'
    const currentGroups = GroupStores.groupsStore.get();
    const group = currentGroups[id];
    setGroupInUrl(group?.saved ? id : 'new');
  }, [setGroupInUrl]);

  const fetchGroups = useCallback(async () => {
    const response = await Connections.postRequest(ApiEndpoints.groupsAll, {});
    if (response?.ok && response.data?.groups) {
      const fetched = response.data.groups;
      // Mark all fetched groups as saved (they come from DB)
      const withSaved = fetched.map(g => ({ ...g, saved: true }));
      // Preserve implicit (unsaved) groups that exist in the store
      const current = GroupStores.groupsStore.get();
      const implicit = {};
      Object.entries(current).forEach(([id, g]) => {
        if (!g.saved) implicit[id] = g;
      });
      setGroups(withSaved, implicit);
      withSaved.forEach(g => {
        initPlaceholders(g._id || g.id);
      });
      // Restore from URL query param, or fall back to first saved group
      if (!activeGroupId && groupFromUrl !== 'new' && withSaved.length > 0) {
        const urlId = groupFromUrl;
        const matchesUrl = urlId && withSaved.some(g => (g._id || g.id) === urlId);
        setActiveGroup(matchesUrl ? urlId : (withSaved[0]._id || withSaved[0].id));
      }
    }
    return response;
  }, [activeGroupId, groupFromUrl, setActiveGroup]);

  const saveGroup = useCallback(async (groupData) => {
    const { id, name, items } = groupData;

    if (id && groups[id]?.saved) {
      // Update existing
      const response = await Connections.postRequest(ApiEndpoints.groupsUpdate, {
        _id: id, name, items,
      });
      if (response?.ok) {
        upsertGroup({ id, name, items, saved: true });
      }
      return response;
    }

    // Create new
    const response = await Connections.postRequest(ApiEndpoints.groupsAdd, {
      name, items,
    });
    if (response?.ok && response.data?._id) {
      const newId = response.data._id;
      // Reassign instances from old implicit group to new saved group
      if (id && id !== newId) {
        reassignInstancesToGroup(id, newId);
        removeGroup(id);
      }
      upsertGroup({ id: newId, name, items, saved: true });
      initPlaceholders(newId);
      setActiveGroup(newId);
    }
    return response;
  }, [groups, setActiveGroup]);

  const deleteGroup = useCallback(async (groupId) => {
    const group = groups[groupId];
    if (group?.saved) {
      await Connections.postRequest(ApiEndpoints.groupsDelete, { _id: groupId });
    }
    removeGroup(groupId);
  }, [groups]);

  const updateGroupItems = useCallback(async (groupId, items) => {
    const group = groups[groupId];
    if (!group?.saved) return;

    const response = await Connections.postRequest(ApiEndpoints.groupsUpdate, {
      _id: groupId, name: group.name, items,
    });
    if (response?.ok) {
      upsertGroup({ id: groupId, items });
    }
    return response;
  }, [groups]);

  const createImplicitGroup = useCallback((name) => {
    const groupId = crypto.randomUUID();
    upsertGroup({
      id: groupId,
      name: name || `Group ${Object.keys(groups).length + 1}`,
      items: [],
      saved: false,
    });
    initPlaceholders(groupId);
    setActiveGroupId(groupId);
    setGroupInUrl('new');
    return groupId;
  }, [groups, setGroupInUrl]);

  const groupList = Object.values(groups || {});

  return {
    groups,
    groupList,
    activeGroupId,
    placeholders,
    setActiveGroupId: setActiveGroup,
    fetchGroups,
    saveGroup,
    updateGroupItems,
    deleteGroup,
    createImplicitGroup,
  };
};

export default useGroups;
