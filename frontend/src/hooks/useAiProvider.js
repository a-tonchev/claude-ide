import { useCallback, useEffect, useState } from 'react';

import Storage from '@/components/storage/Storage';

const STORAGE_KEY = 'claude-ide:last-ai-provider';

export default function useAiProvider() {
  const [lastProvider, setLastProvider] = useState('claude');
  const [providerLoaded, setProviderLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Storage.get(STORAGE_KEY)
      .then(value => {
        if (active && ['claude', 'codex'].includes(value)) setLastProvider(value);
      })
      .catch(error => console.warn('Could not load AI preference:', error))
      .finally(() => { if (active) setProviderLoaded(true); });
    return () => { active = false; };
  }, []);

  const rememberProvider = useCallback(provider => {
    if (!['claude', 'codex'].includes(provider)) return;
    setLastProvider(provider);
    Storage.save(STORAGE_KEY, provider)
      .catch(error => console.warn('Could not save AI preference:', error));
  }, []);

  return { lastProvider, providerLoaded, rememberProvider };
}
