import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useStoreValue } from '@/components/state/GlobalState';
import { ExecutionProfileStores } from '@/stores/executionProfileAtoms';

const ExecutionProfileSelect = ({ value, onChange, disabled = false }) => {
  const { profiles, defaultId } = useStoreValue(ExecutionProfileStores.profilesStore);
  if (!profiles.length) return null;
  const selected = value || defaultId || profiles[0].id;
  return (
    <ToggleButtonGroup
      exclusive size="small" value={selected} disabled={disabled} aria-label="Terminal account"
      onChange={(event, id) => { if (id) onChange(id); }}
      sx={{
        my: 1,
        '& .MuiToggleButton-root': { color: '#808080', fontSize: '0.75rem', py: 0.4, px: 1.5, textTransform: 'none' },
        '& .MuiToggleButton-root.Mui-selected': { color: '#A9B7C6', bgcolor: '#21428355' },
      }}
    >
      {profiles.map(profile => <ToggleButton key={profile.id} value={profile.id}>{profile.label.replace(/^Claude (\d+)$/, 'Claude$1')}</ToggleButton>)}
    </ToggleButtonGroup>
  );
};

export default ExecutionProfileSelect;
