import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';

import {
  AddIcon, DeleteIcon, EditIcon, SaveIcon, TuneIcon,
} from '@/components/Icons/Icons';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import { LAUNCH_FLAG_TYPE } from '@/hooks/useLaunchFlags';
import { managerPaperSx } from '@/components/ManagerDialog/managerStyles';

const emptyForm = {
  name: '',
  args: '',
  instructions: '',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#2B2B2B',
    fontSize: 13,
    '& fieldset': { borderColor: '#4E5254' },
    '&:hover fieldset': { borderColor: '#6897BB' },
    '&.Mui-focused fieldset': { borderColor: '#6897BB' },
  },
  '& .MuiInputLabel-root': { color: '#808080', fontSize: 13 },
  '& .MuiInputBase-input': { color: '#A9B7C6' },
};

const monoSx = {
  '& .MuiInputBase-input': {
    color: '#A9B7C6',
    fontFamily: '"JetBrains Mono", "Consolas", monospace',
  },
};

const LaunchFlagsDialog = ({
  open, onClose, launchFlags = [], loading = false, onRefresh,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      onRefresh?.();
      setForm(emptyForm);
      setEditingId(null);
      setError('');
    }
  }, [open, onRefresh]);

  const handleSave = useCallback(async () => {
    const name = form.name.trim();
    const args = form.args.trim();
    if (!name || !args) return;
    setSaving(true);
    setError('');

    const payload = {
      type: LAUNCH_FLAG_TYPE,
      name,
      args,
      instructions: form.instructions.trim(),
    };

    const result = editingId
      ? await Connections.postRequest(ApiEndpoints.settingsUpdate, { ...payload, _id: editingId })
      : await Connections.postRequest(ApiEndpoints.settingsAdd, payload);

    if (result?.ok) {
      setEditingId(null);
      setForm(emptyForm);
      onRefresh?.();
    } else {
      setError(result?.data?.message || result?.message || 'Could not save launch flag');
    }
    setSaving(false);
  }, [form, editingId, onRefresh]);

  const handleEdit = useCallback(item => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      args: item.args || '',
      instructions: item.instructions || '',
    });
    setError('');
  }, []);

  const handleDelete = useCallback(async id => {
    await Connections.postRequest(ApiEndpoints.settingsDelete, { _id: id });
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    onRefresh?.();
  }, [editingId, onRefresh]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }, []);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const canSave = !!form.name.trim() && !!form.args.trim() && !saving;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: managerPaperSx }}
    >
      <DialogTitle sx={{
        color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1,
      }}
      >
        Launch Flags
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#808080', fontSize: 13, mb: 1.5 }}>
          Each flag becomes a checkbox when launching a Claude instance. Checked flags are
          appended to the command line after
          {' '}
          <Box component="code" sx={{ color: '#A9B7C6' }}>claude</Box>
          .
        </Typography>

        {/* Add / Edit form */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          mb: 2,
          p: 2,
          bgcolor: '#2B2B2B',
          borderRadius: 2,
          border: '1px solid #3C3F41',
        }}
        >
          <TextField
            size="small"
            label="Checkbox name"
            placeholder="e.g. Discord"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={inputSx}
          />
          <TextField
            size="small"
            label="Arguments appended after claude"
            placeholder="e.g. --channels plugin:discord@claude-plugins-official"
            value={form.args}
            onChange={e => setForm(f => ({ ...f, args: e.target.value }))}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={{ ...inputSx, ...monoSx }}
            helperText='{name} is replaced with the project name, e.g. --remote-control "{name}"'
            FormHelperTextProps={{ sx: { color: '#606366', fontSize: 11, mx: 0.5 } }}
          />
          <TextField
            size="small"
            label="Extra instructions (optional)"
            placeholder="Appended to the instance's system prompt while this flag is on"
            value={form.instructions}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            sx={inputSx}
          />
          {error && (
            <Typography sx={{ color: '#BC3F3C', fontSize: 12 }}>{error}</Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {editingId && (
              <Button
                size="small"
                onClick={handleCancel}
                sx={{ color: '#808080', textTransform: 'none' }}
              >
                Cancel
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={!canSave}
              startIcon={editingId ? <SaveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: '#579945',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { bgcolor: '#68AD55' },
                '&.Mui-disabled': { bgcolor: '#3C3F41', color: '#606366' },
              }}
            >
              {editingId ? 'Save' : 'Add'}
            </Button>
          </Box>
        </Box>

        {/* Existing flags */}
        {loading && launchFlags.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} sx={{ color: '#6897BB' }} />
          </Box>
        ) : launchFlags.length === 0 ? (
          <Typography sx={{
            color: '#606366', fontSize: 13, textAlign: 'center', py: 2,
          }}
          >
            No launch flags yet.
          </Typography>
        ) : (
          <List dense sx={{ bgcolor: '#2B2B2B', borderRadius: 2, border: '1px solid #3C3F41' }}>
            {launchFlags.map(item => (
              <ListItem
                key={item._id}
                secondaryAction={(
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit" arrow>
                      <IconButton size="small" onClick={() => handleEdit(item)} sx={{ color: '#808080' }}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete" arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(item._id)}
                        sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                sx={{
                  borderRadius: 1,
                  bgcolor: editingId === item._id ? 'rgba(104,151,187,0.1)' : 'transparent',
                }}
              >
                <TuneIcon sx={{ fontSize: 16, color: '#6897BB', mr: 1.5 }} />
                <ListItemText
                  primary={(
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#A9B7C6', fontSize: 14, fontWeight: 500 }}>
                        {item.name}
                      </Typography>
                      {item.instructions && (
                        <Tooltip title={item.instructions} arrow>
                          <Chip
                            size="small"
                            label="prompt"
                            sx={{
                              height: 16, fontSize: '0.6rem', bgcolor: '#3C3F41', color: '#808080',
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  )}
                  secondary={item.args}
                  secondaryTypographyProps={{
                    sx: {
                      color: '#606366',
                      fontSize: 12,
                      fontFamily: '"JetBrains Mono", "Consolas", monospace',
                      wordBreak: 'break-all',
                      pr: 8,
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          sx={{
            color: '#808080',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LaunchFlagsDialog;
