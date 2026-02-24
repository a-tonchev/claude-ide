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
import TerminalCard from '@/components/TerminalCard/TerminalCard';
import SavedItemCard from '@/components/SavedItemCard/SavedItemCard';
import NewInstanceDialog from '@/components/NewInstanceDialog/NewInstanceDialog';
import NewTerminalDialog from '@/components/NewTerminalDialog/NewTerminalDialog';
import SaveGroupDialog from '@/components/SaveGroupDialog/SaveGroupDialog';
import ProjectManager from '@/components/ProjectManager/ProjectManager';
import TerminalManager from '@/components/TerminalManager/TerminalManager';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import LoadGroupDialog from '@/components/LoadGroupDialog/LoadGroupDialog';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import useInstances from '@/hooks/useInstances';
import useGroups from '@/hooks/useGroups';
import { assignToPlaceholder } from '@/helpers/placeholderHelper';
import {
  setPlaceholder, removeGroup, upsertGroup, initPlaceholders,
} from '@/stores/groupAtoms';
import { addUserMessage, setPendingInput, updateInstanceField } from '@/stores/instanceAtoms';

const UNGROUPED_ID = '__ungrouped__';

const Dashboard = () => {
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [saveGroupOpen, setSaveGroupOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [terminalsOpen, setTerminalsOpen] = useState(false);
  const [loadGroupOpen, setLoadGroupOpen] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  const onWsMessage = useCallback(msg => {
    if (msg.type === 'ws_connected') setWsConnected(true);
    if (msg.type === 'ws_disconnected') setWsConnected(false);
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

  const handleSendInput = useCallback((instanceId, data) => {
    // Record the user's message (strip trailing \r for display)
    const displayText = data.endsWith('\r') ? data.slice(0, -1) : data;
    if (displayText.trim()) {
      const ts = new Date().toISOString();
      addUserMessage(instanceId, displayText, ts);
      sendUserMessage(instanceId, displayText, ts);
      // Clear pending choices when user types their own input
      const inst = instances?.[instanceId];
      if (inst?.pendingInput) setPendingInput(instanceId, null);
      // Immediately set "thinking" for Claude instances
      if (inst?.type === 'claude' && inst.status !== 'exited') {
        updateInstanceField(instanceId, 'status', 'thinking');
      }
    }
    writeToInstance(instanceId, data);
  }, [writeToInstance, sendUserMessage, instances]);

  const handleSendResponse = useCallback((instanceId, choice) => {
    addUserMessage(instanceId, choice);
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
  }, [sendUserResponse]);

  const handleOpenPlaceholder = useCallback(instanceId => {
    if (!activeGroupId) return;
    assignToPlaceholder(activeGroupId, instanceId);
  }, [activeGroupId]);

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
      createInstance(item.projectId, item.name, path, [], gid);
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
          onLoadGroup={() => setLoadGroupOpen(true)}
          onManageProjects={() => setProjectsOpen(true)}
          onManageTerminals={() => setTerminalsOpen(true)}
        />

        <GroupTabs
          groups={tabList}
          activeGroupId={activeGroupId}
          onSelect={setActiveGroupId}
          onClose={handleCloseGroup}
          onDelete={handleDeleteGroup}
          onRunGroup={runGroup}
          onStopGroup={stopGroup}
          instances={instances}
        />

        {/* Cards Area */}
        <Box sx={{
          flex: '0 0 auto', maxHeight: '40vh', overflow: 'auto', px: 2, py: 1.5,
        }}
        >
          {activeGroupInstances.length === 0 && stoppedItems.length === 0 ? (
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
              {activeGroupInstances.map(instance => {
                const isExpanded = expandedCards.has(instance.id);
                return (
                  <Grid
                    item
                    xs={12}
                    sm={isExpanded ? 12 : 6}
                    md={isExpanded ? 8 : 4}
                    lg={isExpanded ? 6 : 3}
                    key={instance.id}
                  >
                    {instance.type === 'terminal' ? (
                      <TerminalCard
                        instance={instance}
                        onOpenPlaceholder={handleOpenPlaceholder}
                        onOpenWindow={handleOpenWindow}
                        onStop={stopInstance}
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
                      />
                    )}
                  </Grid>
                );
              })}
              {stoppedItems.map((item, idx) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`saved-${idx}`}>
                  <SavedItemCard
                    item={item}
                    onStart={handleStartSavedItem}
                    onRemove={handleRemoveSavedItem}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        <ActionBar
          onSaveGroup={() => setSaveGroupOpen(true)}
          onRunGroup={handleRunGroup}
          onStopGroup={handleStopGroup}
          showSave={!!activeGroup && !activeGroup.saved}
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

      <SaveGroupDialog
        open={saveGroupOpen}
        onClose={() => setSaveGroupOpen(false)}
        onSave={handleSaveGroup}
        group={activeGroup}
        instances={instances}
      />

      <ProjectManager
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
      />

      <TerminalManager
        open={terminalsOpen}
        onClose={() => setTerminalsOpen(false)}
      />

      <LoadGroupDialog
        open={loadGroupOpen}
        onClose={() => setLoadGroupOpen(false)}
        onLoad={handleLoadGroup}
        openGroupIds={groupList.map(g => g.id)}
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
