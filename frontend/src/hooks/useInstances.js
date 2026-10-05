import { useCallback, useMemo } from 'react';

import { useStoreValue } from '@/components/state/GlobalState';
import {
  InstanceStores,
  setActiveInstanceId,
} from '@/stores/instanceAtoms';

import useWebSocket from './useWebSocket';

const useInstances = onMessage => {
  const instances = useStoreValue(InstanceStores.instancesStore);
  const activeInstanceId = useStoreValue(InstanceStores.activeInstanceIdStore);

  const { send } = useWebSocket(onMessage);

  const createInstance = useCallback((projectId, name, path, args, groupId, flagIds, options = {}) => {
    const { provider = 'claude', savedItemId } = options;
    send('create', {
      projectId,
      name,
      path,
      args,
      groupId,
      flagIds: Array.isArray(flagIds) ? flagIds : [],
      provider,
      savedItemId,
    });
  }, [send]);

  const stopInstance = useCallback(instanceId => {
    send('stop', { instanceId });
  }, [send]);

  const renameInstance = useCallback((instanceId, title) => {
    send('rename', { instanceId, title });
  }, [send]);

  // attachments: stored file ids; the backend adds their paths to the text the AI gets
  const writeToInstance = useCallback((instanceId, data, attachments) => {
    send('input', attachments?.length ? { instanceId, data, attachments } : { instanceId, data });
  }, [send]);

  const resizeInstance = useCallback((instanceId, cols, rows) => {
    send('resize', { instanceId, cols, rows });
  }, [send]);

  const subscribeInstance = useCallback(instanceId => {
    send('subscribe', { instanceId });
  }, [send]);

  // savedItemId: the saved card this terminal starts from, or a fresh id that becomes the
  // card's id if the group is saved with it.
  const createTerminal = useCallback((name, shell, command, groupId, savedItemId) => {
    send('create_terminal', {
      name, shell, command, groupId, savedItemId,
    });
  }, [send]);

  const createObserver = useCallback((name, observerId, cwd, groupId) => {
    send('create_observer', {
      name, observerId, cwd, groupId,
    });
  }, [send]);

  const sendUserResponse = useCallback((instanceId, choice) => {
    send('user_response', { instanceId, choice });
  }, [send]);

  const sendUserMessage = useCallback((instanceId, text, timestamp, attachments) => {
    send('user_message', {
      instanceId, text, timestamp, ...(attachments?.length ? { attachments } : {}),
    });
  }, [send]);

  const startGroup = useCallback((groupId, items) => {
    send('start_group', { groupId, items });
  }, [send]);

  const stopGroup = useCallback(groupId => {
    send('stop_group', { groupId });
  }, [send]);

  // Start a remembered instance again (same id and session) in the given group.
  const resumeInstance = useCallback((recordId, groupId) => {
    send('resume', { recordId, groupId });
  }, [send]);

  // Move a running instance to another group for good (its record follows).
  const moveInstance = useCallback((instanceId, groupId) => {
    send('move_group', { instanceId, groupId });
  }, [send]);

  const instanceList = useMemo(() => Object.values(instances || {}), [instances]);

  return {
    instances,
    instanceList,
    activeInstanceId,
    setActiveInstanceId,
    createInstance,
    stopInstance,
    renameInstance,
    writeToInstance,
    resizeInstance,
    subscribeInstance,
    createTerminal,
    createObserver,
    sendUserResponse,
    sendUserMessage,
    startGroup,
    stopGroup,
    resumeInstance,
    moveInstance,
  };
};

export default useInstances;
