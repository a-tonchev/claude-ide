import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import TerminalIcon from '@mui/icons-material/Terminal';
import DeleteIcon from '@mui/icons-material/Delete';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const SHELLS = [
  { value: 'wsl', label: 'WSL' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Bash' },
  { value: 'gitbash', label: 'Git Bash' },
];

const SHELL_LABELS = Object.fromEntries(SHELLS.map(s => [s.value, s.label]));

const NewTerminalDialog = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [shell, setShell] = useState('powershell');
  const [command, setCommand] = useState('');
  const [saveConfig, setSaveConfig] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchConfigs = useCallback(() => {
    setLoading(true);
    Connections.postRequest(ApiEndpoints.terminalsAll, {})
      .then(result => {
        if (result?.ok) {
          setSavedConfigs(result.data.terminals || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setName('');
    setShell('powershell');
    setCommand('');
    setSaveConfig(false);
    fetchConfigs();
  }, [open, fetchConfigs]);

  const handleSelectConfig = useCallback(config => {
    setSelected(config);
    setName(config.name);
    setShell(config.shell);
    setCommand(config.command || '');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelected(null);
    setName('');
    setShell('powershell');
    setCommand('');
  }, []);

  const handleDelete = useCallback(async (e, configId) => {
    e.stopPropagation();
    await Connections.postRequest(ApiEndpoints.terminalsDelete, { _id: configId });
    fetchConfigs();
    if (selected?._id === configId) {
      handleClearSelection();
    }
  }, [fetchConfigs, selected, handleClearSelection]);

  const handleLaunch = useCallback(async () => {
    const termName = name.trim() || 'Terminal';
    const termCommand = command.trim() || null;

    if (saveConfig && !selected) {
      await Connections.postRequest(ApiEndpoints.terminalsAdd, {
        name: termName,
        shell,
        command: termCommand || '',
        cwd: '',
      });
    }

    onCreate(termName, shell, termCommand);
    onClose();
  }, [name, shell, command, saveConfig, selected, onCreate, onClose]);

  const canLaunch = !!shell;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#313335',
          border: '1px solid #4E5254',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{
        color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1, display: 'flex', alignItems: 'center', gap: 1,
      }}
      >
        <TerminalIcon sx={{ color: '#6897BB' }} />
        New Terminal
      </DialogTitle>
      <DialogContent>
        {/* Saved configs list */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ color: '#6897BB' }} />
          </Box>
        ) : savedConfigs.length > 0 && (
          <>
            <Typography sx={{
              color: '#808080', fontSize: 12, mb: 1, fontWeight: 600,
            }}
            >
              SAVED TERMINALS
            </Typography>
            <List dense sx={{ mx: -1, mb: 1 }}>
              {savedConfigs.map(config => (
                <ListItemButton
                  key={config._id}
                  selected={selected?._id === config._id}
                  onClick={() => handleSelectConfig(config)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    py: 1,
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(104,151,187,0.1)',
                      border: '1px solid rgba(104,151,187,0.3)',
                      '&:hover': { bgcolor: 'rgba(104,151,187,0.15)' },
                    },
                    '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <TerminalIcon sx={{ fontSize: 18, color: '#808080' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={config.name}
                    secondary={config.command || 'Interactive shell'}
                    primaryTypographyProps={{ sx: { color: '#A9B7C6', fontWeight: 500, fontSize: 13 } }}
                    secondaryTypographyProps={{
                      sx: { color: '#606366', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
                    }}
                  />
                  <Chip
                    size="small"
                    label={SHELL_LABELS[config.shell] || config.shell}
                    sx={{
                      mr: 1, height: 20, fontSize: '0.65rem', bgcolor: '#4E5254', color: '#808080',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={e => handleDelete(e, config._id)}
                    sx={{ color: '#606366', '&:hover': { color: '#BC3F3C' } }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
            <Divider sx={{ borderColor: '#3C3F41', mb: 2 }} />
          </>
        )}

        {/* Manual config form */}
        <Typography sx={{
          color: '#808080', fontSize: 12, mb: 1, fontWeight: 600,
        }}
        >
          {selected ? 'EDIT BEFORE LAUNCH' : 'CONFIGURE'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="API server"
            size="small"
            fullWidth
            InputProps={{ sx: { fontSize: 13 } }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Shell</InputLabel>
            <Select
              value={shell}
              label="Shell"
              onChange={e => setShell(e.target.value)}
              sx={{ fontSize: 13 }}
            >
              {SHELLS.map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Command (optional)"
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="Leave empty for interactive shell"
            size="small"
            fullWidth
            multiline
            maxRows={3}
            InputProps={{ sx: { fontSize: 13 } }}
          />
          {!selected && (
            <FormControlLabel
              control={(
                <Checkbox
                  checked={saveConfig}
                  onChange={e => setSaveConfig(e.target.checked)}
                  size="small"
                  sx={{ color: '#606366', '&.Mui-checked': { color: '#6897BB' } }}
                />
              )}
              label="Save this terminal config"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: 13, color: '#808080' } }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {selected && (
          <Button
            onClick={handleClearSelection}
            sx={{ color: '#808080', textTransform: 'none', mr: 'auto' }}
          >
            Clear selection
          </Button>
        )}
        <Button
          onClick={onClose}
          sx={{ color: '#808080', textTransform: 'none', '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' } }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleLaunch}
          disabled={!canLaunch}
          variant="contained"
          startIcon={<RocketLaunchIcon sx={{ fontSize: 16 }} />}
          sx={{
            bgcolor: '#579945',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 2.5,
            '&:hover': { bgcolor: '#68AD55' },
            '&.Mui-disabled': { bgcolor: '#3C3F41', color: '#606366' },
          }}
        >
          Launch
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewTerminalDialog;
