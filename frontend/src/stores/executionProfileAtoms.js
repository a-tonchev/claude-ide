import GlobalStateHelper from '@/components/state/GlobalStateHelper';

export const ExecutionProfileStores = { profilesStore: null };
GlobalStateHelper.atom({
  key: 'profilesStore', default: { profiles: [], defaultId: null }, store: ExecutionProfileStores,
});

export const setExecutionProfiles = (profiles, defaultId) => ExecutionProfileStores.profilesStore.set({ profiles, defaultId });
