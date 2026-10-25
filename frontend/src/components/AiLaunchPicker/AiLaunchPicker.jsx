import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { getAiLaunchOptions } from '@/helpers/aiLaunchHelper';

const AiLaunchPicker = ({ profiles, value, onChange, disabled = false, label = 'AI', sx }) => {
  const options = getAiLaunchOptions(profiles);
  return (
    <ToggleButtonGroup
      exclusive size="small" value={value?.id || null} disabled={disabled} aria-label={label}
      onChange={(event, id) => { const option = options.find(item => item.id === id); if (option) onChange(option); }}
      sx={{
        '& .MuiToggleButton-root': { color: '#808080', fontSize: '0.75rem', py: 0.4, px: 1.5, textTransform: 'none' },
        '& .MuiToggleButton-root.Mui-selected': { color: '#A9B7C6', bgcolor: '#21428355' },
        ...sx,
      }}
    >
      {options.map(option => <ToggleButton key={option.id} value={option.id}>{option.label}</ToggleButton>)}
    </ToggleButtonGroup>
  );
};

export default AiLaunchPicker;
