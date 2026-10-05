import { useCallback, useEffect } from 'react';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import { InstanceStores, setFeedPage } from '@/stores/instanceAtoms';

const PAGE_SIZE = 50;
const EMPTY_FEED = [];

// Page requests in flight, shared because several views (card, placeholder,
// popup window) can show the same instance's feed at once.
const pendingPages = new Map();

export const fetchFeedPage = (instanceId, { beforeId, limit = PAGE_SIZE } = {}) => Connections.postRequest(
  ApiEndpoints.instancesFeed,
  { instanceId, beforeId, limit },
);

export const loadFeedIntoStore = (instanceId, { older = false } = {}) => {
  const beforeId = older ? InstanceStores.instancesStore.get()[instanceId]?.feed?.[0]?.id : undefined;
  if (older && !beforeId) return Promise.resolve(null);

  const key = `${instanceId}:${beforeId || 'latest'}`;
  if (!pendingPages.has(key)) {
    pendingPages.set(key, fetchFeedPage(instanceId, { beforeId })
      .then(result => {
        if (result?.ok) setFeedPage(instanceId, result.data);
        return result;
      })
      .finally(() => pendingPages.delete(key)));
  }
  return pendingPages.get(key);
};

// An AI instance's feed: loaded from the database the first time a view needs it,
// then kept current by feed_item events.
const useInstanceFeed = instance => {
  const instanceId = instance?.id;
  const needsLoad = !!instance && instance.type !== 'terminal' && !instance.feedLoaded;

  useEffect(() => {
    if (needsLoad) loadFeedIntoStore(instanceId);
  }, [instanceId, needsLoad]);

  const loadOlder = useCallback(
    () => (instanceId ? loadFeedIntoStore(instanceId, { older: true }) : null),
    [instanceId],
  );

  return {
    feed: instance?.feed || EMPTY_FEED,
    total: instance?.feedTotal || 0,
    loadOlder,
  };
};

export default useInstanceFeed;
