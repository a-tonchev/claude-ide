import {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  Alert, Box, Divider, Grid, Menu, MenuItem, Snackbar, Typography,
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import { Helmet } from 'react-helmet-async';

import TitleBar from '@/components/TitleBar/TitleBar';
import GroupTabs from '@/components/GroupTabs/GroupTabs';
import ActionBar from '@/components/ActionBar/ActionBar';
import StatusBar from '@/components/StatusBar/StatusBar';
import PlaceholderPanel from '@/components/PlaceholderPanel/PlaceholderPanel';
import ClaudeInstanceCard from '@/components/ClaudeInstanceCard/ClaudeInstanceCard';
import ObserverCard from '@/components/ObserverCard/ObserverCard';
import TerminalCard from '@/components/TerminalCard/TerminalCard';
import SavedItemCard from '@/components/SavedItemCard/SavedItemCard';
import NewInstanceDialog from '@/components/NewInstanceDialog/NewInstanceDialog';
import NewTerminalDialog from '@/components/NewTerminalDialog/NewTerminalDialog';
import NewObserverDialog from '@/components/NewObserverDialog/NewObserverDialog';
import ObserverManager from '@/components/ObserverManager/ObserverManager';
import KeePassSettingsDialog from '@/components/KeePassSettingsDialog/KeePassSettingsDialog';
import LaunchFlagsDialog from '@/components/LaunchFlagsDialog/LaunchFlagsDialog';
import InstructionsDialog from '@/components/InstructionsDialog/InstructionsDialog';
import SaveGroupDialog from '@/components/SaveGroupDialog/SaveGroupDialog';
import ProjectManager from '@/components/ProjectManager/ProjectManager';
import TerminalManager from '@/components/TerminalManager/TerminalManager';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import PlansDialog from '@/components/PlansDialog/PlansDialog';
import LoadGroupDialog from '@/components/LoadGroupDialog/LoadGroupDialog';
import MinifiedSidebar from '@/components/MinifiedSidebar/MinifiedSidebar';
import RememberedInstancesDialog from '@/components/RememberedInstancesDialog/RememberedInstancesDialog';
import MobileGroupPicker from '@/components/MobileGroupPicker/MobileGroupPicker';
import MobileCardPager from '@/components/MobileCardPager/MobileCardPager';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import useInstances from '@/hooks/useInstances';
import useGroups from '@/hooks/useGroups';
import useLaunchFlags from '@/hooks/useLaunchFlags';
import useAiProvider from '@/hooks/useAiProvider';
import useRememberedInstances from '@/hooks/useRememberedInstances';
import {
  getAiProvider, matchesSavedItem, runsInOtherGroup, unsavedInstances,
} from '@/helpers/aiHelper';
import createUuid from '@/helpers/createUuid';
import { stopConfirmText } from '@/helpers/instanceHelper';
import { splitGroupTabs } from '@/helpers/groupTabsHelper';
import useMobile from '@/components/layout/hooks/useMobile';
import useConfirm from '@/components/dialogs/hooks/useConfirm';
import { assignToPlaceholder } from '@/helpers/placeholderHelper';
import {
  GroupStores, setPlaceholder, upsertGroup, initPlaceholders,
} from '@/stores/groupAtoms';
import {
  InstanceStores, setPendingInput, updateInstanceField,
} from '@/stores/instanceAtoms';

const UNGROUPED_ID = '__ungrouped__';

const withAdded = (set, value) => new Set(set).add(value);
const withRemoved = (set, value) => {
  const next = new Set(set);
  next.delete(value);
  return next;
};
const withoutKeys = (map, keys) => {
  const present = keys.filter(key => key && key in map);
  if (!present.length) return map;
  const next = { ...map };
  present.forEach(key => { delete next[key]; });
  return next;
};

const Dashboard = () => {
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [observerDialogOpen, setObserverDialogOpen] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState(null);
  const [saveGroupOpen, setSaveGroupOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [terminalsOpen, setTerminalsOpen] = useState(false);
  const [observersOpen, setObserversOpen] = useState(false);
  const [keepassOpen, setKeepassOpen] = useState(false);
  const [launchFlagsOpen, setLaunchFlagsOpen] = useState(false);
  const [loadGroupOpen, setLoadGroupOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [rememberedOpen, setRememberedOpen] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [instanceError, setInstanceError] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [minimizedCards, setMinimizedCards] = useState(new Set());
  const [wsGroupStatuses, setWsGroupStatuses] = useState({});
  const [openTabIds, setOpenTabIds] = useState(new Set());
  // Tabs whose X was clicked this session; the groups stay loaded so they can come back
  const [closedTabIds, setClosedTabIds] = useState(new Set());
  // "Move to group…" menu of a running card: { instanceId, anchorEl }
  const [moveMenu, setMoveMenu] = useState(null);
  // Why a saved card's last Start failed, by card id; cleared when it is started again
  const [startErrors, setStartErrors] = useState({});
  const [cardsHeight, setCardsHeight] = useState(() => {
    const saved = parseFloat(localStorage.getItem('claude-ide:cardsHeight'));
    return Number.isFinite(saved) && saved >= 15 && saved <= 80 ? saved : 40;
  });
  const { isMobile } = useMobile();
  const { lastProvider, providerLoaded, rememberProvider } = useAiProvider();
  const { openDialog: openStopConfirm, ConfirmDialog: StopConfirmDialog } = useConfirm();

  const {
    instances: rememberedInstances,
    loading: rememberedLoading,
    refresh: refreshRemembered,
    remove: removeRemembered,
  } = useRememberedInstances();

  // Remembered instances with a resume on its way, so a second click can't start one twice
  const resumingIds = useRef(new Set());

  const onWsMessage = useCallback(msg => {
    if (msg.type === 'error') setInstanceError(msg.message || 'The instance request failed. Please try again.');
    if (msg.type === 'ws_connected') setWsConnected(true);
    if (msg.type === 'ws_disconnected') setWsConnected(false);
    // After a reconnect the backend may have restarted, which changes what it remembers
    if (msg.type === 'remembered_changed' || msg.type === 'ws_connected') refreshRemembered();
    if (msg.type === 'remembered_changed' || msg.type === 'error') resumingIds.current.clear();
    // An instance died right after starting (e.g. a bad launch flag): say so, on its card too
    if (msg.type === 'start_failed') {
      setInstanceError(`${msg.name || 'The instance'}: ${msg.message}`);
      if (msg.savedItemId) setStartErrors(prev => ({ ...prev, [msg.savedItemId]: msg.message }));
    }
    if (msg.type === 'group_status') {
      setWsGroupStatuses(prev => ({ ...prev, [msg.groupId]: msg.statuses }));
    }
  }, [refreshRemembered]);

  const {
    instances,
    instanceList,
    createInstance,
    stopInstance,
    renameInstance,
    writeToInstance,
    sendUserResponse,
    sendUserMessage,
    createTerminal,
    createObserver,
    startGroup,
    stopGroup,
    resumeInstance,
    moveInstance,
  } = useInstances(onWsMessage);

  const {
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
  } = useGroups();

  const {
    launchFlags,
    loading: launchFlagsLoading,
    refresh: refreshLaunchFlags,
  } = useLaunchFlags();

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Derive group statuses from instance data (covers reconnect when no group_status event fires)
  const derivedGroupStatuses = useMemo(() => {
    const derived = {};
    instanceList.forEach(inst => {
      if (!inst.groupId || (inst.type !== 'claude' && inst.type !== 'observer')) return;
      if (!derived[inst.groupId]) derived[inst.groupId] = {};
      const s = inst.status || 'running';
      derived[inst.groupId][s] = (derived[inst.groupId][s] || 0) + 1;
    });
    return derived;
  }, [instanceList]);

  // Merge: WS group_status takes priority, fall back to derived
  const groupStatuses = useMemo(() => {
    const merged = { ...derivedGroupStatuses };
    Object.entries(wsGroupStatuses).forEach(([gid, statuses]) => {
      merged[gid] = statuses;
    });
    return merged;
  }, [derivedGroupStatuses, wsGroupStatuses]);

  // Instances without a group
  const ungroupedInstances = useMemo(
    () => instanceList.filter(i => !i.groupId),
    [instanceList],
  );

  // Build tabs list — all groups, plus Ungrouped if needed
  const tabList = useMemo(() => {
    const tabs = [...groupList];
    if (ungroupedInstances.length > 0) {
      tabs.unshift({ id: UNGROUPED_ID, name: 'Ungrouped', virtual: true });
    }
    return tabs;
  }, [groupList, ungroupedInstances.length]);

  // The tabs as the tab bar shows them
  const visibleTabIds = useMemo(() => splitGroupTabs({
    groups: tabList, instances, activeGroupId, openTabIds, closedTabIds,
  }).visible.map(g => g.id), [tabList, instances, activeGroupId, openTabIds, closedTabIds]);

  // Auto-select ungrouped tab if it appears and nothing is selected
  useEffect(() => {
    if (!activeGroupId && ungroupedInstances.length > 0) {
      setActiveGroupId(UNGROUPED_ID);
    }
  }, [activeGroupId, ungroupedInstances.length, setActiveGroupId]);

  // Filter instances for active group
  const activeGroupInstances = useMemo(
    () => (activeGroupId === UNGROUPED_ID
      ? ungroupedInstances
      : instanceList.filter(i => i.groupId === activeGroupId)),
    [instanceList, activeGroupId, ungroupedInstances],
  );

  const activeGroup = activeGroupId && activeGroupId !== UNGROUPED_ID ? groups[activeGroupId] : null;
  const currentPlaceholders = placeholders[activeGroupId] || { placeholder1: null, placeholder2: null };

  // The instance whose "Move to group…" menu is open, and the groups it can move to
  const movingInstance = moveMenu ? instances[moveMenu.instanceId] : null;
  const moveTargets = useMemo(
    () => (movingInstance ? groupList.filter(g => g.id !== movingInstance.groupId) : []),
    [groupList, movingInstance],
  );

  // The group a new instance goes into: the active one, or a new draft group when
  // there is none (or the virtual Ungrouped tab is active). Resolves to null on failure.
  const ensureGroup = useCallback(async () => (
    activeGroupId && activeGroupId !== UNGROUPED_ID ? activeGroupId : createImplicitGroup()
  ), [activeGroupId, createImplicitGroup]);

  // Add AI starts a brand-new instance and never touches the group's saved cards: a
  // stopped instance is gone, and only Save / Update Group turns it into a saved card.
  // The fresh savedItemId becomes that card's id if the group is saved with it.
  const handleAddAI = useCallback(async (projectId, name, path, provider, flagIds = []) => {
    const gid = await ensureGroup();
    if (!gid) return { ok: false, errorMessage: 'Could not create a group for the AI instance. Please try again.' };
    const aiProvider = getAiProvider({ provider });
    rememberProvider(aiProvider);
    createInstance(projectId, name, path, [], gid, aiProvider === 'claude' ? flagIds : [], {
      provider: aiProvider, savedItemId: createUuid(),
    });
    return { ok: true };
  }, [ensureGroup, createInstance, rememberProvider]);

  const handleCreateTerminal = useCallback(async (name, shell, command) => {
    const gid = await ensureGroup();
    if (!gid) {
      setInstanceError('Could not create a group for the terminal. Please try again.');
      return;
    }
    createTerminal(name, shell, command, gid, createUuid());
  }, [createTerminal, ensureGroup]);

  const handleCreateObserver = useCallback(async (observerId, name, path) => {
    const gid = await ensureGroup();
    if (!gid) {
      setInstanceError('Could not create a group for the observer. Please try again.');
      return;
    }
    createObserver(name, observerId, path, gid);
  }, [createObserver, ensureGroup]);

  const handleViewInstructions = useCallback((observerId, observerName) => {
    setInstructionsDialog({ observerId, observerName });
  }, []);

  // Update group tab status immediately when user sends input
  const setInstanceThinking = useCallback(instanceId => {
    const inst = InstanceStores.instancesStore.get()[instanceId];
    if (!inst || (inst.type !== 'claude' && inst.type !== 'observer')
      || inst.status === 'exited' || !inst.groupId) return;
    updateInstanceField(instanceId, 'status', 'thinking');
    // Update group tab status immediately
    const allInstances = InstanceStores.instancesStore.get();
    const statuses = {};
    for (const i of Object.values(allInstances)) {
      if (i.groupId === inst.groupId && (i.type === 'claude' || i.type === 'observer') && i.status !== 'exited') {
        const s = i.id === instanceId ? 'thinking' : (i.status || 'running');
        statuses[s] = (statuses[s] || 0) + 1;
      }
    }
    setWsGroupStatuses(prev => ({ ...prev, [inst.groupId]: statuses }));
  }, []);

  // The backend stores the user's message and sends it back as a feed item, so
  // every open window shows it the same way.
  // attachments: ids of uploaded files; they go with the message to the feed and the AI
  const handleSendInput = useCallback((instanceId, data, attachments = []) => {
    const displayText = data.endsWith('\r') ? data.slice(0, -1) : data;
    if (displayText.trim()) {
      sendUserMessage(instanceId, displayText, new Date().toISOString(), attachments);
      // Always clear pending choices when user types their own input
      setPendingInput(instanceId, null);
      setInstanceThinking(instanceId);
    }
    writeToInstance(instanceId, data, attachments);
  }, [writeToInstance, sendUserMessage, setInstanceThinking]);

  const handleSendResponse = useCallback((instanceId, choice) => {
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
    setInstanceThinking(instanceId);
  }, [sendUserResponse, setInstanceThinking]);

  const confirmStopInstance = useCallback(instanceId => {
    // Read the instance from the store at call time rather than closing over
    // `instances`, so this callback stays referentially stable across store
    // updates and doesn't defeat React.memo on the cards it's passed to.
    const inst = InstanceStores.instancesStore.get()[instanceId];
    openStopConfirm(stopConfirmText(inst), () => stopInstance(instanceId));
  }, [openStopConfirm, stopInstance]);

  const handleOpenPlaceholder = useCallback(instanceId => {
    if (!activeGroupId) return;
    assignToPlaceholder(activeGroupId, instanceId);
  }, [activeGroupId]);

  const handleMinimize = useCallback(instanceId => {
    setMinimizedCards(prev => withAdded(prev, instanceId));
  }, []);

  const handleRestore = useCallback(instanceId => {
    setMinimizedCards(prev => withRemoved(prev, instanceId));
  }, []);

  const handleOpenMoveMenu = useCallback((instanceId, anchorEl) => {
    setMoveMenu({ instanceId, anchorEl });
  }, []);

  // Move a running instance to another group (or a new one) for good: the backend updates
  // its record. Its saved card stays in the old group until Update Group there drops it.
  const handleMoveToGroup = useCallback(async targetGroupId => {
    const menu = moveMenu;
    setMoveMenu(null);
    if (!menu) return;
    const gid = targetGroupId || await createImplicitGroup();
    if (!gid) {
      setInstanceError('Could not create a group for the instance. Please try again.');
      return;
    }
    setClosedTabIds(prev => withRemoved(prev, gid));
    setMinimizedCards(prev => withRemoved(prev, menu.instanceId));
    moveInstance(menu.instanceId, gid);
  }, [moveMenu, createImplicitGroup, moveInstance]);

  const handleToggleExpand = useCallback(instanceId => {
    setExpandedCards(prev => (prev.has(instanceId) ? withRemoved(prev, instanceId) : withAdded(prev, instanceId)));
  }, []);

  const handleOpenWindow = useCallback(instanceId => {
    const url = UrlEnums.INSTANCE_WINDOW.replace(':instanceId', instanceId);
    window.open(url, `instance_${instanceId}`);
  }, []);

  // Open a group's tab: from the "Add group…" picker, Open Saved Group, or a resume
  const handleAddGroupTab = useCallback(groupId => {
    setClosedTabIds(prev => withRemoved(prev, groupId));
    setOpenTabIds(prev => withAdded(prev, groupId));
    setActiveGroupId(groupId);
  }, [setActiveGroupId]);

  const handleNewGroup = useCallback(async () => {
    const gid = await createImplicitGroup();
    if (!gid) setInstanceError('Could not create the group. Please try again.');
  }, [createImplicitGroup]);

  const handleLoadGroup = useCallback(group => {
    const id = group._id || group.id;
    upsertGroup({
      id, name: group.name, items: group.items || [], saved: true,
    });
    initPlaceholders(id);
    handleAddGroupTab(id);
  }, [handleAddGroupTab]);

  // The tab to activate when the active one goes away: its right neighbour, else its left one
  const neighbourTab = useCallback(groupId => {
    const index = visibleTabIds.indexOf(groupId);
    return visibleTabIds[index + 1] || visibleTabIds[index - 1] || null;
  }, [visibleTabIds]);

  // X only hides the tab: the group stays loaded, its instances keep running, and the
  // "Add group…" picker or Open Saved Group bring it back (a refresh does too while its
  // instances run). A draft with no cards, nothing running and no remembered instance
  // pointing to it has nothing to come back for and is deleted.
  const handleCloseGroup = useCallback(async groupId => {
    const group = groups[groupId];
    const nextActiveId = groupId === activeGroupId ? neighbourTab(groupId) : null;
    setOpenTabIds(prev => withRemoved(prev, groupId));

    const inUse = instanceList.some(i => i.groupId === groupId)
      || rememberedInstances.some(r => r.groupId === groupId);
    if (group && !group.saved && !inUse && !group.items?.length) {
      await deleteGroup(groupId);
    } else {
      setClosedTabIds(prev => withAdded(prev, groupId));
    }
    if (groupId === activeGroupId) setActiveGroupId(nextActiveId);
  }, [groups, activeGroupId, neighbourTab, instanceList, rememberedInstances, deleteGroup, setActiveGroupId]);

  const handleDeleteGroup = useCallback(async groupId => {
    const nextActiveId = groupId === activeGroupId ? neighbourTab(groupId) : null;
    instanceList.filter(i => i.groupId === groupId).forEach(i => stopInstance(i.id));
    setOpenTabIds(prev => withRemoved(prev, groupId));
    setClosedTabIds(prev => withRemoved(prev, groupId));
    await deleteGroup(groupId);
    if (groupId === activeGroupId) setActiveGroupId(nextActiveId);
  }, [activeGroupId, neighbourTab, instanceList, stopInstance, deleteGroup, setActiveGroupId]);

  // Deleting a group also deletes its running and remembered instances, messages included.
  const confirmDeleteGroup = useCallback(groupId => {
    const label = groups[groupId]?.name || 'this group';
    const running = instanceList.filter(i => i.groupId === groupId).length;
    const remembered = rememberedInstances.filter(r => r.groupId === groupId).length;
    const counts = [running && `${running} running`, remembered && `${remembered} remembered`].filter(Boolean);
    const detail = counts.length ? ` Its instances (${counts.join(', ')}) and their messages are deleted too.` : '';
    openStopConfirm(`Delete "${label}" permanently?${detail}`, () => handleDeleteGroup(groupId));
  }, [groups, instanceList, rememberedInstances, openStopConfirm, handleDeleteGroup]);

  // Bring a remembered instance back, in the picked group or a new draft named after it.
  const handleResumeRemembered = useCallback(async (record, groupId) => {
    if (resumingIds.current.has(record.id)) return;
    resumingIds.current.add(record.id);
    const gid = groupId || await createImplicitGroup(record.title || record.projectName || undefined);
    if (!gid || !GroupStores.groupsStore.get()[gid]) {
      resumingIds.current.delete(record.id);
      setInstanceError(gid
        ? 'The selected group is no longer available. Pick another group and try again.'
        : 'Could not create a group for the instance. Please try again.');
      return;
    }
    handleAddGroupTab(gid);
    resumeInstance(record.id, gid);
  }, [createImplicitGroup, handleAddGroupTab, resumeInstance]);

  const handleRemoveRemembered = useCallback(record => removeRemembered(record.id), [removeRemembered]);

  // Saved items that don't have a running instance
  const stoppedItems = useMemo(() => {
    if (!activeGroup?.items?.length) return [];
    return activeGroup.items.filter(item => !activeGroupInstances.some(inst => matchesSavedItem(inst, item)));
  }, [activeGroup, activeGroupInstances]);

  // A saved group has unsaved changes when something runs in it that isn't one of its cards,
  // or one of its cards was moved to another group (Update Group drops that card). Other
  // stopped cards don't count: they are saved already, and removing one saves at once.
  const hasUnsavedChanges = useMemo(() => {
    if (!activeGroup?.saved) return false;
    const savedItems = activeGroup.items || [];
    return savedItems.some(item => runsInOtherGroup(item, activeGroupId, instanceList))
      || unsavedInstances(activeGroupInstances, savedItems).length > 0;
  }, [activeGroup, activeGroupId, activeGroupInstances, instanceList]);

  const runGroup = useCallback(async groupId => {
    const group = groups[groupId];
    if (!group?.items?.length) return;
    // Enrich claude items that are missing path
    const needsEnrichment = group.items.some(i => i.type === 'claude' && !i.path);
    let items = group.items.filter(item => !instanceList.some(inst => (
      inst.groupId === groupId && inst.status !== 'exited' && matchesSavedItem(inst, item)
    )));
    if (!items.length) return;
    if (needsEnrichment) {
      const result = await Connections.postRequest(ApiEndpoints.projectsAll, {});
      if (result?.ok) {
        const projects = result.data.projects || [];
        items = items.map(item => {
          if (item.type === 'claude' && !item.path && item.projectId) {
            const project = projects.find(p => p._id === item.projectId);
            return project ? { ...item, path: project.path } : item;
          }
          return item;
        });
      }
    }
    // Default shell for terminals missing it
    items = items.map(item => (item.type === 'terminal' && !item.shell ? { ...item, shell: 'powershell' } : item));
    const aiItems = items.filter(item => item.type === 'claude');
    if (aiItems.length) rememberProvider(getAiProvider(aiItems[aiItems.length - 1]));
    setStartErrors(prev => withoutKeys(prev, items.map(item => item.id)));
    startGroup(groupId, items);
  }, [groups, instanceList, startGroup, rememberProvider]);

  const handleRunGroup = useCallback(() => {
    if (activeGroupId) runGroup(activeGroupId);
  }, [activeGroupId, runGroup]);

  // Stopping a whole group is one click away in two places (action bar and tab
  // context menu), so both go through a confirm to survive a misclick.
  const confirmStopGroup = useCallback(groupId => {
    if (!groupId) return;
    const allInstances = InstanceStores.instancesStore.get();
    const count = Object.values(allInstances)
      .filter(i => i.groupId === groupId && i.status !== 'exited').length;
    const fallback = groupId === UNGROUPED_ID ? 'Ungrouped' : 'this group';
    const label = groups[groupId]?.name || fallback;
    const suffix = count > 0 ? ` (${count} running)` : '';
    openStopConfirm(
      `Stop all instances in "${label}"${suffix}? They are deleted for good, messages included.`,
      () => stopGroup(groupId),
    );
  }, [groups, openStopConfirm, stopGroup]);

  const handleStopGroup = useCallback(() => {
    confirmStopGroup(activeGroupId);
  }, [activeGroupId, confirmStopGroup]);

  const handleStartSavedItem = useCallback(async item => {
    const gid = activeGroupId;
    if (!gid) return;
    setStartErrors(prev => withoutKeys(prev, [item.id]));
    if (item.type === 'claude') {
      let { path } = item;
      if (!path && item.projectId) {
        const result = await Connections.postRequest(ApiEndpoints.projectsAll, {});
        if (result?.ok) {
          const project = (result.data.projects || []).find(p => p._id === item.projectId);
          if (project) path = project.path;
        }
      }
      if (!path) return;
      rememberProvider(getAiProvider(item));
      createInstance(item.projectId, item.name, path, [], gid, item.flagIds || [], {
        provider: getAiProvider(item), savedItemId: item.id,
      });
    } else {
      let { shell, command } = item;
      if (!shell) {
        // Look up saved terminal config by name
        const result = await Connections.postRequest(ApiEndpoints.terminalsAll, {});
        if (result?.ok) {
          const config = (result.data.terminals || []).find(t => t.name === item.name);
          if (config) {
            shell = config.shell;
            command = command || config.command;
          }
        }
      }
      createTerminal(item.name, shell || 'powershell', command, gid, item.id);
    }
  }, [activeGroupId, createInstance, createTerminal, rememberProvider]);

  const handleRemoveSavedItem = useCallback(async item => {
    if (!activeGroupId || !activeGroup?.items) return;
    const newItems = activeGroup.items.filter(i => i !== item);
    await updateGroupItems(activeGroupId, newItems);
  }, [activeGroupId, activeGroup, updateGroupItems]);

  const handleProviderChange = useCallback(async (item, provider) => {
    if (!activeGroupId || !activeGroup?.items) return;
    await updateGroupItems(activeGroupId, activeGroup.items.map(i => (i === item ? { ...i, provider } : i)));
  }, [activeGroupId, activeGroup, updateGroupItems]);

  const handleToggleFlag = useCallback(async (item, flagId) => {
    if (!activeGroupId || !activeGroup?.items) return;
    const newItems = activeGroup.items.map(i => {
      if (i !== item) return i;
      const current = i.flagIds || [];
      const flagIds = current.includes(flagId)
        ? current.filter(id => id !== flagId)
        : [...current, flagId];
      return { ...i, flagIds };
    });
    setStartErrors(prev => withoutKeys(prev, [item.id]));
    await updateGroupItems(activeGroupId, newItems);
  }, [activeGroupId, activeGroup, updateGroupItems]);

  const handleResizerMouseDown = useCallback(e => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = cardsHeight;
    const vhPx = window.innerHeight / 100;
    const onMove = ev => {
      const deltaVh = (ev.clientY - startY) / vhPx;
      const next = Math.min(80, Math.max(15, startHeight + deltaVh));
      setCardsHeight(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [cardsHeight]);

  useEffect(() => {
    localStorage.setItem('claude-ide:cardsHeight', String(cardsHeight));
  }, [cardsHeight]);

  const handleSaveGroup = useCallback(async groupData => {
    const response = await saveGroup(groupData);
    if (!response?.ok) setInstanceError(response?.errorMessage || 'Could not save the group. Please try again.');
  }, [saveGroup]);

  // Mobile shows one card per page: running cards first, then the saved ones. A running
  // card started from a saved one keeps its key, so the pager stays on it.
  const mobilePages = useMemo(() => {
    if (!isMobile) return [];
    const seen = new Set();
    const uniqueKey = (preferred, fallback) => {
      const key = preferred && !seen.has(preferred) ? preferred : fallback;
      seen.add(key);
      return key;
    };
    return [
      ...activeGroupInstances.map(instance => ({ key: uniqueKey(instance.savedItemId, instance.id), instance })),
      ...stoppedItems.map((item, idx) => ({ key: uniqueKey(item.id, `saved-${idx}`), item })),
    ];
  }, [isMobile, activeGroupInstances, stoppedItems]);

  // A running card. On mobile it fills its page and has no placeholder, minimize or
  // expand buttons: the pager has its own terminal tab and shows one card at a time.
  const renderInstanceCard = (instance, mobile = false) => {
    const isExpanded = expandedCards.has(instance.id);
    const desktopOnly = mobile ? {} : {
      onOpenPlaceholder: handleOpenPlaceholder,
      onMinimize: handleMinimize,
    };
    if (instance.type === 'terminal') {
      return (
        <TerminalCard
          instance={instance}
          onOpenWindow={handleOpenWindow}
          onStop={confirmStopInstance}
          onMoveToGroup={handleOpenMoveMenu}
          onRename={renameInstance}
          {...desktopOnly}
        />
      );
    }
    const Card = instance.type === 'observer' ? ObserverCard : ClaudeInstanceCard;
    return (
      <Card
        instance={instance}
        expanded={isExpanded}
        fill={mobile}
        onToggleExpand={mobile ? undefined : handleToggleExpand}
        onOpenWindow={handleOpenWindow}
        onStop={confirmStopInstance}
        onSendInput={handleSendInput}
        onSendResponse={handleSendResponse}
        onViewPlan={setViewingPlan}
        onViewInstructions={instance.type === 'observer' ? handleViewInstructions : undefined}
        onMoveToGroup={handleOpenMoveMenu}
        onRename={renameInstance}
        {...desktopOnly}
      />
    );
  };

  const renderSavedCard = item => (
    <SavedItemCard
      item={item}
      onStart={handleStartSavedItem}
      onRemove={handleRemoveSavedItem}
      launchFlags={launchFlags}
      onToggleFlag={handleToggleFlag}
      onProviderChange={handleProviderChange}
      error={item.id ? startErrors[item.id] : null}
    />
  );

  const renderMobilePage = page => (
    page.instance ? renderInstanceCard(page.instance, true) : renderSavedCard(page.item)
  );

  // Run / Stop / Save for the active group: in the tab row on desktop, the title bar on mobile
  const groupActions = (
    <ActionBar
      onSaveGroup={() => setSaveGroupOpen(true)}
      onRunGroup={handleRunGroup}
      onStopGroup={handleStopGroup}
      showSave={!!activeGroup && (!activeGroup.saved || hasUnsavedChanges)}
      isUpdate={!!activeGroup?.saved && hasUnsavedChanges}
      showRun={stoppedItems.length > 0}
      showStop={activeGroupInstances.length > 0}
    />
  );

  const emptyState = (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, px: 2, textAlign: 'center',
    }}
    >
      <Box sx={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        bgcolor: '#313335',
        border: '1px solid #4E5254',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2,
      }}
      >
        <TerminalIcon sx={{ fontSize: 28, color: '#4E5254' }} />
      </Box>
      <Typography sx={{ color: '#808080', fontSize: '0.85rem' }}>
        {groupList.length === 0
          ? 'Create a group and add instances to get started.'
          : 'No instances in this group. Use the + button to add one.'}
      </Typography>
    </Box>
  );

  return (
    <>
      <Helmet>
        <title>Claude IDE</title>
      </Helmet>

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        // dvh: on mobile browsers 100vh also counts the hidden address bar
        height: isMobile ? '100dvh' : '100vh',
        bgcolor: '#2B2B2B',
      }}
      >
        <TitleBar
          onNewGroup={handleNewGroup}
          onAddAI={() => setAiDialogOpen(true)}
          onAddTerminal={() => setTerminalDialogOpen(true)}
          onAddObserver={() => setObserverDialogOpen(true)}
          onLoadGroup={() => setLoadGroupOpen(true)}
          onManageProjects={() => setProjectsOpen(true)}
          onManageTerminals={() => setTerminalsOpen(true)}
          onManageObservers={() => setObserversOpen(true)}
          onManageKeePass={() => setKeepassOpen(true)}
          onManageLaunchFlags={() => setLaunchFlagsOpen(true)}
          onManagePlans={() => setPlansOpen(true)}
          rememberedCount={rememberedInstances.length}
          onOpenRemembered={() => setRememberedOpen(true)}
          groupSelector={isMobile ? (
            <>
              <MobileGroupPicker
                groups={tabList}
                activeGroupId={activeGroupId}
                groupStatuses={groupStatuses}
                instances={instances}
                openTabIds={openTabIds}
                closedTabIds={closedTabIds}
                onSelect={setActiveGroupId}
                onAddGroup={handleAddGroupTab}
                onClose={handleCloseGroup}
                onDelete={confirmDeleteGroup}
                onRunGroup={runGroup}
                onStopGroup={confirmStopGroup}
                onNewGroup={handleNewGroup}
              />
              {groupActions}
            </>
          ) : null}
        />

        {/* Floats over the page: an inline banner took its height from the terminal panels */}
        <Snackbar
          open={!!instanceError}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ top: { xs: 56 } }}
        >
          <Alert severity="error" onClose={() => setInstanceError('')} sx={{ maxWidth: 760, boxShadow: 6 }}>
            {instanceError}
          </Alert>
        </Snackbar>

        {isMobile ? (
          // Mobile: one card per page, each running card with its own terminal tab
          <Box sx={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          }}
          >
            {mobilePages.length ? (
              <MobileCardPager key={activeGroupId || 'none'} pages={mobilePages} renderCard={renderMobilePage} />
            ) : emptyState}
          </Box>
        ) : (
          <>
            <GroupTabs
              groups={tabList}
              activeGroupId={activeGroupId}
              onSelect={setActiveGroupId}
              onClose={handleCloseGroup}
              onDelete={confirmDeleteGroup}
              onRunGroup={runGroup}
              onStopGroup={confirmStopGroup}
              groupStatuses={groupStatuses}
              instances={instances}
              openTabIds={openTabIds}
              closedTabIds={closedTabIds}
              onAddGroup={handleAddGroupTab}
              actions={groupActions}
            />

            {/* Cards Area + Minimized Sidebar */}
            <Box sx={{
              display: 'flex',
              flex: '0 0 auto',
              height: `${cardsHeight}vh`,
              maxHeight: `${cardsHeight}vh`,
            }}
            >
              <Box sx={{
                flex: 1, overflow: 'auto', px: 2, py: 1.5, minWidth: 0,
              }}
              >
                {activeGroupInstances.filter(i => !minimizedCards.has(i.id)).length === 0
                  && stoppedItems.length === 0 ? emptyState : (
                    <Grid container spacing={1.5}>
                      {activeGroupInstances
                        .filter(i => !minimizedCards.has(i.id))
                        .map(instance => {
                          const isExpanded = expandedCards.has(instance.id);
                          return (
                            <Grid
                              size={{
                                xs: 12,
                                sm: isExpanded ? 12 : 6,
                                md: isExpanded ? 8 : 4,
                                lg: isExpanded ? 6 : 3,
                              }}
                              key={instance.id}
                            >
                              {renderInstanceCard(instance)}
                            </Grid>
                          );
                        })}
                      {stoppedItems.map((item, idx) => (
                        <Grid
                          size={{
                            xs: 12, sm: 6, md: 4, lg: 3,
                          }}
                          key={`saved-${idx}`}
                        >
                          {renderSavedCard(item)}
                        </Grid>
                      ))}
                    </Grid>
                  )}
              </Box>
              <MinifiedSidebar
                instances={activeGroupInstances.filter(i => minimizedCards.has(i.id))}
                onRestore={handleRestore}
                onOpenPlaceholder={handleOpenPlaceholder}
              />
            </Box>

            <Box
              onMouseDown={handleResizerMouseDown}
              sx={{
                height: '5px',
                flexShrink: 0,
                bgcolor: '#3C3F41',
                cursor: 'ns-resize',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: '#6897BB' },
              }}
            />
          </>
        )}

        {/* Placeholder Panel (desktop only) + StatusBar */}
        {!isMobile && (
          <PlaceholderPanel
            placeholder1Id={currentPlaceholders.placeholder1}
            placeholder2Id={currentPlaceholders.placeholder2}
            instances={instances}
            onSelect1={id => setPlaceholder(activeGroupId, 'placeholder1', id)}
            onSelect2={id => setPlaceholder(activeGroupId, 'placeholder2', id)}
            onClear1={() => setPlaceholder(activeGroupId, 'placeholder1', null)}
            onClear2={() => setPlaceholder(activeGroupId, 'placeholder2', null)}
          />
        )}
        <StatusBar instances={instances} wsConnected={wsConnected} />
      </Box>

      <NewInstanceDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onCreate={handleAddAI}
        disabled={!providerLoaded}
        defaultProvider={lastProvider}
        launchFlags={launchFlags}
      />

      <NewTerminalDialog
        open={terminalDialogOpen}
        onClose={() => setTerminalDialogOpen(false)}
        onCreate={handleCreateTerminal}
      />

      <NewObserverDialog
        open={observerDialogOpen}
        onClose={() => setObserverDialogOpen(false)}
        onCreate={handleCreateObserver}
      />

      <InstructionsDialog
        open={!!instructionsDialog}
        onClose={() => setInstructionsDialog(null)}
        observerId={instructionsDialog?.observerId}
        observerName={instructionsDialog?.observerName}
      />

      <SaveGroupDialog
        open={saveGroupOpen}
        onClose={() => setSaveGroupOpen(false)}
        onSave={handleSaveGroup}
        group={activeGroup}
        instances={instances}
        isUpdate={hasUnsavedChanges}
      />

      <ProjectManager
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
      />

      <TerminalManager
        open={terminalsOpen}
        onClose={() => setTerminalsOpen(false)}
      />

      <ObserverManager
        open={observersOpen}
        onClose={() => setObserversOpen(false)}
      />

      <KeePassSettingsDialog
        open={keepassOpen}
        onClose={() => setKeepassOpen(false)}
      />

      <LaunchFlagsDialog
        open={launchFlagsOpen}
        onClose={() => setLaunchFlagsOpen(false)}
        launchFlags={launchFlags}
        loading={launchFlagsLoading}
        onRefresh={refreshLaunchFlags}
      />

      <LoadGroupDialog
        open={loadGroupOpen}
        onClose={() => setLoadGroupOpen(false)}
        onLoad={handleLoadGroup}
        openGroupIds={visibleTabIds}
      />

      <PlansDialog
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
      />

      <RememberedInstancesDialog
        open={rememberedOpen}
        onClose={() => setRememberedOpen(false)}
        instances={rememberedInstances}
        loading={rememberedLoading}
        groups={groupList}
        onResume={handleResumeRemembered}
        onRemove={handleRemoveRemembered}
      />

      <PlanViewerDialog
        open={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        plan={viewingPlan}
      />

      <Menu
        anchorEl={moveMenu?.anchorEl}
        open={!!movingInstance}
        onClose={() => setMoveMenu(null)}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            minWidth: 180,
            '& .MuiMenuItem-root': { fontSize: '0.8rem', color: '#A9B7C6' },
          },
        }}
      >
        <Typography sx={{
          px: 2, py: 0.5, fontSize: '0.7rem', color: '#808080',
        }}
        >
          Move to group
        </Typography>
        {moveTargets.map(g => (
          <MenuItem key={g.id} onClick={() => handleMoveToGroup(g.id)}>
            {g.saved ? g.name : `${g.name} (unsaved)`}
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: '#4E5254' }} />
        <MenuItem onClick={() => handleMoveToGroup(null)}>New group</MenuItem>
      </Menu>

      {StopConfirmDialog}
    </>
  );
};

export default Dashboard;
