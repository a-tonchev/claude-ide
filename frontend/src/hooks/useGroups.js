import { useCallback } from 'react';

import { useStoreValue } from '@/components/state/GlobalState';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
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
  const activeGroupId = useStoreValue(GroupStores.activeGroupIdStore);
  const placeholders = useStoreValue(GroupStores.placeholdersStore);

  const fetchGroups = useCallback(async () => {
    const response = await Connections.postRequest(ApiEndpoints.groupsAll, {});
    if (response?.ok && response.data?.groups) {
      const fetched = response.data.groups;
      // Mark all fetched groups as saved (they come from DB)
      const withSaved = fetched.map(g => ({ ...g, saved: true }));
      setGroups(withSaved);
      withSaved.forEach(g => {
        initPlaceholders(g._id || g.id);
      });
      // Set first saved group as active if none is active
      if (!GroupStores.activeGroupIdStore.get() && withSaved.length > 0) {
        setActiveGroupId(withSaved[0]._id || withSaved[0].id);
      }
    }
    return response;
  }, []);

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
      setActiveGroupId(newId);
    }
    return response;
  }, [groups]);

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
    return groupId;
  }, [groups]);

  const groupList = Object.values(groups || {});

  return {
    groups,
    groupList,
    activeGroupId,
    placeholders,
    setActiveGroupId,
    fetchGroups,
    saveGroup,
    updateGroupItems,
    deleteGroup,
    createImplicitGroup,
  };
};

export default useGroups;
