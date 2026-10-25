import { MenuItem, TextField } from '@mui/material';
import { useStoreValue } from '@/components/state/GlobalState';
import { ExecutionProfileStores } from '@/stores/executionProfileAtoms';

const ExecutionProfileSelect = ({ value, onChange, disabled = false }) => {
  const { profiles, defaultId } = useStoreValue(ExecutionProfileStores.profilesStore);
  if (!profiles.length) return null;
  const selected = value || defaultId || profiles[0].id;
  const missing = !profiles.some(profile => profile.id === selected);
  return (
    <TextField
      select fullWidth size="small" label="Execution profile" value={selected} disabled={disabled}
      onChange={event => onChange(event.target.value)} sx={{ my: 1 }}
      helperText={missing ? 'This profile is unavailable. Select another profile to start a new session.' : 'The selected account and home are kept for this session.'}
    >
      {missing && <MenuItem value={selected} disabled>{selected} (unavailable)</MenuItem>}
      {profiles.map(profile => <MenuItem key={profile.id} value={profile.id}>{profile.label}</MenuItem>)}
    </TextField>
  );
};

export default ExecutionProfileSelect;
