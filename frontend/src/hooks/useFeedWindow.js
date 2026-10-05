import { useCallback, useState } from 'react';

import useInstanceFeed from '@/hooks/useInstanceFeed';

// The part of an instance's feed a view shows: the newest `shownCount` items. "Show
// more" reveals older ones and loads the next page from the database once the loaded
// items run out. With showAll every loaded item is shown.
const useFeedWindow = (instance, { showAll = false, initialCount = 10, step = 5 } = {}) => {
  const { feed, total, loadOlder } = useInstanceFeed(instance);
  const [shownCount, setShownCount] = useState(initialCount);

  const baseCount = showAll ? feed.length : shownCount;
  const visibleFeed = feed.slice(Math.max(0, feed.length - baseCount));
  const hiddenCount = Math.max(0, total - visibleFeed.length);

  const showMore = useCallback(() => {
    setShownCount(count => count + step);
    if (baseCount + step > feed.length && feed.length < total) loadOlder();
  }, [baseCount, step, feed.length, total, loadOlder]);

  return {
    feed,
    visibleFeed,
    hiddenCount,
    showMore,
    // Views follow the newest item only; loading older pages must not jump to the bottom
    newestId: feed[feed.length - 1]?.id,
  };
};

export default useFeedWindow;
