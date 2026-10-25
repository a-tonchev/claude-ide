const PROFILE_LABELS = { claude1: 'Claude1', claude2: 'Claude2', codex: 'Codex' };

export const getAiLaunchOptions = (profiles = []) => (profiles.length ? profiles.map(profile => ({
  id: profile.id,
  label: PROFILE_LABELS[profile.id] || profile.label,
  provider: profile.provider || (profile.id === 'codex' ? 'codex' : 'claude'),
  executionProfileId: profile.id,
})) : [
  { id: 'claude', label: 'Claude', provider: 'claude', executionProfileId: null },
  { id: 'codex', label: 'Codex', provider: 'codex', executionProfileId: null },
]);

export const getAiLaunchChoice = (selection, profiles = [], defaultId = null) => {
  const options = getAiLaunchOptions(profiles);
  const provider = selection?.provider === 'codex' ? 'codex' : 'claude';
  if (selection?.executionProfileId) {
    return options.find(option => option.executionProfileId === selection.executionProfileId && option.provider === provider) || null;
  }
  return options.find(option => option.provider === provider && option.id === defaultId)
    || options.find(option => option.provider === provider) || null;
};

export const getAiLabel = instance => {
  if (instance?.provider === 'codex') return 'Codex';
  return PROFILE_LABELS[instance?.executionProfileId] || instance?.executionProfileLabel || 'Claude';
};
