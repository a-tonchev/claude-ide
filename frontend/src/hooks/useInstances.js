import { useCallback } from 'react';

import { useStoreValue } from '@/components/state/GlobalState';
import {
  InstanceStores,
  setActiveInstanceId,
} from '@/stores/instanceAtoms';

import useWebSocket from './useWebSocket';

const useInstances = (onMessage) => {
  const instances = useStoreValue(InstanceStores.instancesStore);
  const activeInstanceId = useStoreValue(InstanceStores.activeInstanceIdStore);

  const { send } = useWebSocket(onMessage);

  const createInstance = useCallback((projectId, name, path, args, groupId) => {
    send('create', { projectId, name, path, args, groupId });
  }, [send]);

  const stopInstance = useCallback(instanceId => {
    send('stop', { instanceId });
  }, [send]);

  const writeToInstance = useCallback((instanceId, data) => {
    send('input', { instanceId, data });
  }, [send]);

  const resizeInstance = useCallback((instanceId, cols, rows) => {
    send('resize', { instanceId, cols, rows });
  }, [send]);

  const subscribeInstance = useCallback(instanceId => {
    send('subscribe', { instanceId });
  }, [send]);

  const unsubscribeInstance = useCallback(instanceId => {
    send('unsubscribe', { instanceId });
  }, [send]);

  const requestPlan = useCallback((instanceId, prompt) => {
    send('plan', { instanceId, prompt });
  }, [send]);

  const createTerminal = useCallback((name, shell, command, groupId) => {
    send('create_terminal', { name, shell, command, groupId });
  }, [send]);

  const sendUserResponse = useCallback((instanceId, choice) => {
    send('user_response', { instanceId, choice });
  }, [send]);

  const sendUserMessage = useCallback((instanceId, text, timestamp) => {
    send('user_message', { instanceId, text, timestamp });
  }, [send]);

  const startGroup = useCallback((groupId, items) => {
    send('start_group', { groupId, items });
  }, [send]);

  const stopGroup = useCallback(groupId => {
    send('stop_group', { groupId });
  }, [send]);

  const reassignGroup = useCallback((oldGroupId, newGroupId) => {
    send('reassign_group', { oldGroupId, newGroupId });
  }, [send]);

  const instanceList = Object.values(instances || {});

  return {
    instances,
    instanceList,
    activeInstanceId,
    setActiveInstanceId,
    createInstance,
    stopInstance,
    writeToInstance,
    resizeInstance,
    subscribeInstance,
    unsubscribeInstance,
    requestPlan,
    createTerminal,
    sendUserResponse,
    sendUserMessage,
    startGroup,
    stopGroup,
    reassignGroup,
  };
};

export default useInstances;
