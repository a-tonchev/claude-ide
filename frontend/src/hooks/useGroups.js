import { useCallback, useMemo } from 'react';

import { useStoreValue } from '@/components/state/GlobalState';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import UrlHelper from '@/components/connections/UrlHelper';
import useQueryState from '@/components/connections/hooks/useQueryState';
import {
  GroupStores,
  setGroups,
  upsertGroup,
  removeGroup,
  setActiveGroupId,
  initPlaceholders,
} from '@/stores/groupAtoms';

// Every group lives in the database. Unsaved groups are drafts (saved: false here),
// created the moment they are needed, so a group's id never changes and running or
// remembered instances can point to it.
const useGroups = () => {
  const groups = useStoreValue(GroupStores.groupsStore);
  const activeGroupIdFromStore = useStoreValue(GroupStores.activeGroupIdStore);
  const placeholders = useStoreValue(GroupStores.placeholdersStore);
  const [groupFromUrl, setGroupInUrl] = useQueryState(null, 'group');

  // The URL carries the active group's id; the virtual Ungrouped tab lives only in the store.
  const activeGroupId = groupFromUrl || activeGroupIdFromStore;

  const setActiveGroup = useCallback(id => {
    setActiveGroupId(id);
    setGroupInUrl(GroupStores.groupsStore.get()[id] ? id : null);
  }, [setGroupInUrl]);

  // Reads the URL and the store when it runs, so it stays stable and runs once on load.
  const fetchGroups = useCallback(async () => {
    const response = await Connections.postRequest(ApiEndpoints.groupsAll, {});
    if (response?.ok && response.data?.groups) {
      const fetched = response.data.groups.map(g => ({ ...g, saved: !g.draft }));
      setGroups(fetched);
      fetched.forEach(g => {
        initPlaceholders(g._id || g.id);
      });

      // Restore the group from the URL, or fall back to the first saved group. A URL id
      // that no longer exists (e.g. a deleted draft) must not stay selected, or new
      // instances would join a group nobody can see.
      const urlId = UrlHelper.getParam('group') || null;
      if (urlId && fetched.some(g => (g._id || g.id) === urlId)) {
        setActiveGroup(urlId);
      } else if (urlId || !GroupStores.activeGroupIdStore.get()) {
        const fallback = fetched.find(g => g.saved) || fetched[0];
        setActiveGroup(fallback ? (fallback._id || fallback.id) : null);
      }
    }
    return response;
  }, [setActiveGroup]);

  // Groups are created as drafts, so saving always updates an existing group and keeps
  // its id (running instances stay attached).
  const saveGroup = useCallback(async ({ id, name, items }) => {
    if (!id || !GroupStores.groupsStore.get()[id]) {
      return { ok: false, errorMessage: 'This group is no longer available. Reload the page and try again.' };
    }
    const response = await Connections.postRequest(ApiEndpoints.groupsUpdate, {
      _id: id, name, items, draft: false,
    });
    if (response?.ok) {
      upsertGroup({
        id, name, items, saved: true, draft: false,
      });
    }
    return response;
  }, []);

  const deleteGroup = useCallback(async groupId => {
    await Connections.postRequest(ApiEndpoints.groupsDelete, { _id: groupId });
    removeGroup(groupId);
  }, []);

  const updateGroupItems = useCallback(async (groupId, items) => {
    const group = GroupStores.groupsStore.get()[groupId];
    if (!group) {
      return { ok: false, errorMessage: 'The selected group is no longer available. Select a group and try again.' };
    }

    const response = await Connections.postRequest(ApiEndpoints.groupsUpdate, {
      _id: groupId, name: group.name, items,
    });
    if (response?.ok) {
      upsertGroup({ id: groupId, items });
    }
    return response;
  }, []);

  // Create a draft group and make it active. Resolves to its id, or null on failure.
  const createImplicitGroup = useCallback(async name => {
    const groupName = name || `Group ${Object.keys(GroupStores.groupsStore.get()).length + 1}`;
    const response = await Connections.postRequest(ApiEndpoints.groupsAdd, {
      name: groupName, items: [], draft: true,
    });
    const groupId = response?.ok ? response.data?._id : null;
    if (!groupId) return null;

    upsertGroup({
      id: groupId, name: groupName, items: [], saved: false, draft: true,
    });
    initPlaceholders(groupId);
    setActiveGroupId(groupId);
    setGroupInUrl(groupId);
    return groupId;
  }, [setGroupInUrl]);

  const groupList = useMemo(() => Object.values(groups || {}), [groups]);

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
