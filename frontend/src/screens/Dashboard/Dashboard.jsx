import {
  useState, useCallback, useEffect, useMemo,
} from 'react';
import { Box, Grid, Typography } from '@mui/material';
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
import InstructionsDialog from '@/components/InstructionsDialog/InstructionsDialog';
import SaveGroupDialog from '@/components/SaveGroupDialog/SaveGroupDialog';
import ProjectManager from '@/components/ProjectManager/ProjectManager';
import TerminalManager from '@/components/TerminalManager/TerminalManager';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import PlansDialog from '@/components/PlansDialog/PlansDialog';
import LoadGroupDialog from '@/components/LoadGroupDialog/LoadGroupDialog';
import MinifiedSidebar from '@/components/MinifiedSidebar/MinifiedSidebar';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import useInstances from '@/hooks/useInstances';
import useGroups from '@/hooks/useGroups';
import { assignToPlaceholder } from '@/helpers/placeholderHelper';
import {
  setPlaceholder, removeGroup, upsertGroup, initPlaceholders,
} from '@/stores/groupAtoms';
import {
  InstanceStores, addUserMessage, addClaudeMessage, setPendingInput, updateInstanceField,
} from '@/stores/instanceAtoms';

const UNGROUPED_ID = '__ungrouped__';

const Dashboard = () => {
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [observerDialogOpen, setObserverDialogOpen] = useState(false);
  const [instructionsDialog, setInstructionsDialog] = useState(null);
  const [saveGroupOpen, setSaveGroupOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [terminalsOpen, setTerminalsOpen] = useState(false);
  const [observersOpen, setObserversOpen] = useState(false);
  const [keepassOpen, setKeepassOpen] = useState(false);
  const [loadGroupOpen, setLoadGroupOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [minimizedCards, setMinimizedCards] = useState(new Set());
  const [wsGroupStatuses, setWsGroupStatuses] = useState({});

  const onWsMessage = useCallback(msg => {
    if (msg.type === 'ws_connected') setWsConnected(true);
    if (msg.type === 'ws_disconnected') setWsConnected(false);
    if (msg.type === 'group_status') {
      setWsGroupStatuses(prev => ({ ...prev, [msg.groupId]: msg.statuses }));
    }
  }, []);

  const {
    instances,
    instanceList,
    createInstance,
    stopInstance,
    writeToInstance,
    sendUserResponse,
    sendUserMessage,
    createTerminal,
    createObserver,
    startGroup,
    stopGroup,
    reassignGroup,
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

  // Build tabs list — add "Ungrouped" tab if there are orphan instances
  const tabList = useMemo(() => {
    const tabs = [...groupList];
    if (ungroupedInstances.length > 0) {
      tabs.unshift({ id: UNGROUPED_ID, name: 'Ungrouped', virtual: true });
    }
    return tabs;
  }, [groupList, ungroupedInstances.length]);

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

  // Ensure there's always at least one group tab
  const ensureGroup = useCallback(() => {
    if (!activeGroupId) {
      return createImplicitGroup();
    }
    return activeGroupId;
  }, [activeGroupId, createImplicitGroup]);

  const handleCreateClaude = useCallback((projectId, name, path) => {
    const gid = ensureGroup();
    createInstance(projectId, name, path, [], gid);
  }, [createInstance, ensureGroup]);

  const handleCreateTerminal = useCallback((name, shell, command) => {
    const gid = ensureGroup();
    createTerminal(name, shell, command, gid);
  }, [createTerminal, ensureGroup]);

  const handleCreateObserver = useCallback((observerId, name, path) => {
    const gid = ensureGroup();
    createObserver(name, observerId, path, gid);
  }, [createObserver, ensureGroup]);

  const handleViewInstructions = useCallback((observerId, observerName) => {
    setInstructionsDialog({ observerId, observerName });
  }, []);

  // Update group tab status immediately when user sends input
  const setInstanceThinking = useCallback(instanceId => {
    const inst = InstanceStores.instancesStore.get()[instanceId];
    if (!inst || (inst.type !== 'claude' && inst.type !== 'observer') || inst.status === 'exited' || !inst.groupId) return;
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

  const handleSendInput = useCallback((instanceId, data) => {
    // Record the user's message (strip trailing \r for display)
    const displayText = data.endsWith('\r') ? data.slice(0, -1) : data;
    if (displayText.trim()) {
      const now = Date.now();
      const ts = new Date(now).toISOString();
      addUserMessage(instanceId, displayText, ts);
      sendUserMessage(instanceId, displayText, ts);
      // Always clear pending choices when user types their own input
      setPendingInput(instanceId, null);
      setInstanceThinking(instanceId);
    }
    writeToInstance(instanceId, data);
  }, [writeToInstance, sendUserMessage, setInstanceThinking]);

  const handleSendResponse = useCallback((instanceId, choice) => {
    const now = Date.now();
    addUserMessage(instanceId, choice, new Date(now).toISOString());
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
    setInstanceThinking(instanceId);
  }, [sendUserResponse, setInstanceThinking]);

  const handleOpenPlaceholder = useCallback(instanceId => {
    if (!activeGroupId) return;
    assignToPlaceholder(activeGroupId, instanceId);
  }, [activeGroupId]);

  const handleMinimize = useCallback(instanceId => {
    setMinimizedCards(prev => {
      const next = new Set(prev);
      next.add(instanceId);
      return next;
    });
  }, []);

  const handleRestore = useCallback(instanceId => {
    setMinimizedCards(prev => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
  }, []);

  const handleRemoveFromGroup = useCallback(instanceId => {
    // Unassign instance from the active group (set groupId to null)
    updateInstanceField(instanceId, 'groupId', null);
    // Also remove from minimized if it was there
    setMinimizedCards(prev => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
  }, []);

  const handleToggleExpand = useCallback(instanceId => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }, []);

  const handleOpenWindow = useCallback(instanceId => {
    const url = UrlEnums.INSTANCE_WINDOW.replace(':instanceId', instanceId);
    window.open(url, `instance_${instanceId}`, 'width=1200,height=800');
  }, []);

  const handleNewGroup = useCallback(() => {
    createImplicitGroup();
  }, [createImplicitGroup]);

  const handleLoadGroup = useCallback(group => {
    const id = group._id || group.id;
    upsertGroup({
      id, name: group.name, items: group.items || [], saved: true,
    });
    initPlaceholders(id);
    setActiveGroupId(id);
  }, [setActiveGroupId]);

  const handleCloseGroup = useCallback(groupId => {
    // Stop running instances and remove tab, but keep saved groups in DB
    const groupInstances = instanceList.filter(i => i.groupId === groupId);
    groupInstances.forEach(i => stopInstance(i.id));
    const group = groups[groupId];
    if (group?.saved) {
      // Just remove from UI, stays in DB — will reappear on refresh
      removeGroup(groupId);
    } else {
      removeGroup(groupId);
    }
  }, [instanceList, stopInstance, groups]);

  const handleDeleteGroup = useCallback(async groupId => {
    const groupInstances = instanceList.filter(i => i.groupId === groupId);
    groupInstances.forEach(i => stopInstance(i.id));
    await deleteGroup(groupId);
  }, [instanceList, stopInstance, deleteGroup]);

  // Saved items that don't have a running instance
  const stoppedItems = useMemo(() => {
    if (!activeGroup?.items?.length) return [];
    return activeGroup.items.filter(item => !activeGroupInstances.some(inst => {
      if (inst.type !== item.type) return false;
      if (inst.type === 'claude') return inst.projectId === item.projectId;
      return (inst.projectName || inst.name) === item.name && inst.shell === item.shell;
    }));
  }, [activeGroup, activeGroupInstances]);

  // Check if group has unsaved changes (new instances added or saved items removed)
  const hasUnsavedChanges = useMemo(() => {
    if (!activeGroup?.saved) return false;
    const savedItems = activeGroup.items || [];
    if (!activeGroupInstances.length && !savedItems.length) return false;
    // Check for new instances not in saved items
    const hasNew = activeGroupInstances.some(inst => !savedItems.some(item => {
      if (inst.type !== item.type) return false;
      if (inst.type === 'claude') return inst.projectId === item.projectId;
      return (inst.projectName || inst.name) === item.name && inst.shell === item.shell;
    }));
    // Check for saved items that no longer have a running instance (were removed)
    const hasRemoved = savedItems.some(item => !activeGroupInstances.some(inst => {
      if (inst.type !== item.type) return false;
      if (inst.type === 'claude') return inst.projectId === item.projectId;
      return (inst.projectName || inst.name) === item.name && inst.shell === item.shell;
    }));
    return hasNew || hasRemoved;
  }, [activeGroup, activeGroupInstances]);

  const runGroup = useCallback(async groupId => {
    const group = groups[groupId];
    if (!group?.items?.length) return;
    // Enrich claude items that are missing path
    const needsEnrichment = group.items.some(i => i.type === 'claude' && !i.path);
    let { items } = group;
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
    startGroup(groupId, items);
  }, [groups, startGroup]);

  const handleRunGroup = useCallback(() => {
    if (activeGroupId) runGroup(activeGroupId);
  }, [activeGroupId, runGroup]);

  const handleStopGroup = useCallback(() => {
    if (activeGroupId) stopGroup(activeGroupId);
  }, [activeGroupId, stopGroup]);

  const handleStartSavedItem = useCallback(async item => {
    const gid = activeGroupId;
    if (!gid) return;
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
      createInstance(item.projectId, item.name, path, [], gid, !!item.remote);
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
      createTerminal(item.name, shell || 'powershell', command, gid);
    }
  }, [activeGroupId, createInstance, createTerminal]);

  const handleRemoveSavedItem = useCallback(async item => {
    if (!activeGroupId || !activeGroup?.items) return;
    const newItems = activeGroup.items.filter(i => i !== item);
    await updateGroupItems(activeGroupId, newItems);
  }, [activeGroupId, activeGroup, updateGroupItems]);

  const handleToggleRemote = useCallback(async item => {
    if (!activeGroupId || !activeGroup?.items) return;
    const newItems = activeGroup.items.map(i => (i === item ? { ...i, remote: !i.remote } : i));
    await updateGroupItems(activeGroupId, newItems);
  }, [activeGroupId, activeGroup, updateGroupItems]);

  const handleSaveGroup = useCallback(async groupData => {
    const oldId = groupData.id;
    const response = await saveGroup(groupData);
    // If group got a new DB id, tell the backend to reassign instances
    if (response?.ok && response.data?._id && oldId && oldId !== response.data._id) {
      reassignGroup(oldId, response.data._id);
    }
  }, [saveGroup, reassignGroup]);

  return (
    <>
      <Helmet>
        <title>Claude IDE</title>
      </Helmet>

      <Box sx={{
        display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#2B2B2B',
      }}
      >
        <TitleBar
          onNewGroup={handleNewGroup}
          onAddClaude={() => setClaudeDialogOpen(true)}
          onAddTerminal={() => setTerminalDialogOpen(true)}
          onAddObserver={() => setObserverDialogOpen(true)}
          onLoadGroup={() => setLoadGroupOpen(true)}
          onManageProjects={() => setProjectsOpen(true)}
          onManageTerminals={() => setTerminalsOpen(true)}
          onManageObservers={() => setObserversOpen(true)}
          onManageKeePass={() => setKeepassOpen(true)}
          onManagePlans={() => setPlansOpen(true)}
        />

        <GroupTabs
          groups={tabList}
          activeGroupId={activeGroupId}
          onSelect={setActiveGroupId}
          onClose={handleCloseGroup}
          onDelete={handleDeleteGroup}
          onRunGroup={runGroup}
          onStopGroup={stopGroup}
          groupStatuses={groupStatuses}
          instances={instances}
        />

        {/* Cards Area + Minimized Sidebar */}
        <Box sx={{ display: 'flex', flex: '0 0 auto', maxHeight: '40vh' }}>
          <Box sx={{
            flex: 1, overflow: 'auto', px: 2, py: 1.5, minWidth: 0,
          }}
          >
            {activeGroupInstances.filter(i => !minimizedCards.has(i.id)).length === 0
              && stoppedItems.length === 0 ? (
                <Box sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4,
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
                      : 'No instances in this group. Use the buttons above to add one.'}
                  </Typography>
                </Box>
              ) : (
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
                          {instance.type === 'terminal' ? (
                            <TerminalCard
                              instance={instance}
                              onOpenPlaceholder={handleOpenPlaceholder}
                              onOpenWindow={handleOpenWindow}
                              onStop={stopInstance}
                              onMinimize={handleMinimize}
                              onRemoveFromGroup={handleRemoveFromGroup}
                            />
                          ) : instance.type === 'observer' ? (
                            <ObserverCard
                              instance={instance}
                              expanded={isExpanded}
                              onToggleExpand={handleToggleExpand}
                              onOpenPlaceholder={handleOpenPlaceholder}
                              onOpenWindow={handleOpenWindow}
                              onStop={stopInstance}
                              onSendInput={handleSendInput}
                              onSendResponse={handleSendResponse}
                              onViewPlan={setViewingPlan}
                              onViewInstructions={handleViewInstructions}
                              onMinimize={handleMinimize}
                              onRemoveFromGroup={handleRemoveFromGroup}
                            />
                          ) : (
                            <ClaudeInstanceCard
                              instance={instance}
                              expanded={isExpanded}
                              onToggleExpand={handleToggleExpand}
                              onOpenPlaceholder={handleOpenPlaceholder}
                              onOpenWindow={handleOpenWindow}
                              onStop={stopInstance}
                              onSendInput={handleSendInput}
                              onSendResponse={handleSendResponse}
                              onViewPlan={setViewingPlan}
                              onMinimize={handleMinimize}
                              onRemoveFromGroup={handleRemoveFromGroup}
                            />
                          )}
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
                      <SavedItemCard
                        item={item}
                        onStart={handleStartSavedItem}
                        onRemove={handleRemoveSavedItem}
                        onToggleRemote={handleToggleRemote}
                      />
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

        <ActionBar
          onSaveGroup={() => setSaveGroupOpen(true)}
          onRunGroup={handleRunGroup}
          onStopGroup={handleStopGroup}
          showSave={!!activeGroup && (!activeGroup.saved || hasUnsavedChanges)}
          isUpdate={!!activeGroup?.saved && hasUnsavedChanges}
          showRun={stoppedItems.length > 0}
          showStop={activeGroupInstances.length > 0}
        />

        {/* Placeholder Panel */}
        <PlaceholderPanel
          placeholder1Id={currentPlaceholders.placeholder1}
          placeholder2Id={currentPlaceholders.placeholder2}
          instances={instances}
          onSelect1={id => setPlaceholder(activeGroupId, 'placeholder1', id)}
          onSelect2={id => setPlaceholder(activeGroupId, 'placeholder2', id)}
          onClear1={() => setPlaceholder(activeGroupId, 'placeholder1', null)}
          onClear2={() => setPlaceholder(activeGroupId, 'placeholder2', null)}
        />

        <StatusBar instances={instances} wsConnected={wsConnected} />
      </Box>

      <NewInstanceDialog
        open={claudeDialogOpen}
        onClose={() => setClaudeDialogOpen(false)}
        onCreate={handleCreateClaude}
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

      <LoadGroupDialog
        open={loadGroupOpen}
        onClose={() => setLoadGroupOpen(false)}
        onLoad={handleLoadGroup}
        openGroupIds={groupList.map(g => g.id)}
      />

      <PlansDialog
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
      />

      <PlanViewerDialog
        open={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        plan={viewingPlan}
      />
    </>
  );
};

export default Dashboard;
