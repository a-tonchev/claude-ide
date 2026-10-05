import {
  useCallback, useEffect, useRef, useState,
} from 'react';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

// Instances the backend remembers but isn't running. Callers refresh the list when
// the server says it changed (remembered_changed) or the WebSocket reconnects.
const useRememberedInstances = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  // Mount and the first WebSocket connect both ask for the list; share one request.
  const pending = useRef(null);

  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    setLoading(true);
    pending.current = Connections.postRequest(ApiEndpoints.instancesRemembered, {})
      .then(result => {
        if (result?.ok) setInstances(result.data.instances || []);
        return result;
      })
      .finally(() => {
        pending.current = null;
        setLoading(false);
      });
    return pending.current;
  }, []);

  const remove = useCallback(async instanceId => {
    const result = await Connections.postRequest(ApiEndpoints.instancesRememberedRemove, { instanceId });
    if (result?.ok) setInstances(prev => prev.filter(i => i.id !== instanceId));
    return result;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    instances, loading, refresh, remove,
  };
};

export default useRememberedInstances;
