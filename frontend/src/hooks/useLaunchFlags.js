import { useCallback, useEffect, useState } from 'react';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

// Launch flags are user-defined settings docs: a checkbox name plus the
// command-line text appended after `claude` when an instance is launched.
export const LAUNCH_FLAG_TYPE = 'launchFlag';

const useLaunchFlags = () => {
  const [launchFlags, setLaunchFlags] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.settingsAll, { type: LAUNCH_FLAG_TYPE });
    if (result?.ok) {
      setLaunchFlags(result.data?.settings || []);
    }
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { launchFlags, loading, refresh };
};

export default useLaunchFlags;
