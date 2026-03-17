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
  InputAdornment,
  Tooltip,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import KeyIcon from '@mui/icons-material/Key';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import DirectoryBrowser from '@/components/DirectoryBrowser/DirectoryBrowser';

const emptyForm = {
  name: '', path: '', keepassSettingsId: '', keepassEntryPath: '',
};

const ObserverManager = ({ open, onClose }) => {
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [keepassConfigs, setKeepassConfigs] = useState([]);

  const fetchObservers = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.observersAll, {});
    if (result?.ok) {
      setObservers(result.data.observers || []);
    }
    setLoading(false);
  }, []);

  const fetchKeepassConfigs = useCallback(async () => {
    const result = await Connections.postRequest(ApiEndpoints.settingsAll, { type: 'keepass' });
    if (result?.ok) {
      setKeepassConfigs(result.data.settings || []);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchObservers();
      fetchKeepassConfigs();
      setForm(emptyForm);
      setEditingId(null);
    }
  }, [open, fetchObservers, fetchKeepassConfigs]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.path.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      path: form.path.trim(),
    };
    if (form.keepassSettingsId) {
      payload.keepassSettingsId = form.keepassSettingsId;
    } else {
      payload.keepassSettingsId = '';
    }
    if (form.keepassEntryPath.trim()) {
      payload.keepassEntryPath = form.keepassEntryPath.trim();
    } else {
      payload.keepassEntryPath = '';
    }

    if (editingId) {
      const result = await Connections.postRequest(ApiEndpoints.observersUpdate, {
        _id: editingId,
        ...payload,
      });
      if (result?.ok) {
        setEditingId(null);
        setForm(emptyForm);
        fetchObservers();
      }
    } else {
      const result = await Connections.postRequest(ApiEndpoints.observersAdd, payload);
      if (result?.ok) {
        setForm(emptyForm);
        fetchObservers();
      }
    }

    setSaving(false);
  }, [form, editingId, fetchObservers]);

  const handleEdit = useCallback(observer => {
    setEditingId(observer._id);
    setForm({
      name: observer.name,
      path: observer.path || '',
      keepassSettingsId: observer.keepassSettingsId || '',
      keepassEntryPath: observer.keepassEntryPath || '',
    });
  }, []);

  const handleDelete = useCallback(async observerId => {
    await Connections.postRequest(ApiEndpoints.observersDelete, { _id: observerId });
    fetchObservers();
  }, [fetchObservers]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const handleBrowseSelect = useCallback(selectedPath => {
    const segments = selectedPath.split(/[/\\]/).filter(Boolean);
    const folderName = segments[segments.length - 1] || '';
    setForm(f => ({
      ...f,
      path: selectedPath,
      name: f.name || folderName,
    }));
  }, []);

  // Find KeePass config name by ID for display
  const getKeepassName = useCallback(id => {
    const config = keepassConfigs.find(c => c._id === id);
    return config ? config.name : null;
  }, [keepassConfigs]);

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

  const selectSx = {
    ...inputSx,
    '& .MuiSelect-icon': { color: '#808080' },
  };

  return (
    <>
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
          color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1,
        }}
        >
          Observer Configs
        </DialogTitle>
        <DialogContent>
          {/* Add / Edit form */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mb: 2,
            mt: 1,
            p: 2,
            bgcolor: '#2B2B2B',
            borderRadius: 2,
            border: '1px solid #3C3F41',
          }}
          >
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="Name"
                placeholder="e.g. hetzner-setup"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '1 1 120px', ...inputSx }}
              />
              <TextField
                size="small"
                label="Working Directory"
                value={form.path}
                onChange={e => setForm(f => ({ ...f, path: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '2 1 200px', ...inputSx }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Browse directories">
                        <IconButton
                          size="small"
                          onClick={() => setBrowserOpen(true)}
                          edge="end"
                          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                        >
                          <FolderOpenIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label="KeePass Config"
                value={form.keepassSettingsId}
                onChange={e => setForm(f => ({ ...f, keepassSettingsId: e.target.value }))}
                sx={{ flex: '1 1 180px', ...selectSx }}
              >
                <MenuItem value="">
                  <Typography sx={{ color: '#606366', fontSize: 13, fontStyle: 'italic' }}>
                    None (use instructions)
                  </Typography>
                </MenuItem>
                {keepassConfigs.map(config => (
                  <MenuItem key={config._id} value={config._id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <KeyIcon sx={{ fontSize: 14, color: '#CC7832' }} />
                      <Typography sx={{ fontSize: 13, color: '#A9B7C6' }}>{config.name}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
              {form.keepassSettingsId && (
                <TextField
                  size="small"
                  label="KeePass Entry Path"
                  placeholder="e.g. Servers/my-hetzner"
                  value={form.keepassEntryPath}
                  onChange={e => setForm(f => ({ ...f, keepassEntryPath: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  sx={{ flex: '1 1 180px', ...inputSx }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              {editingId && (
                <Button
                  size="small"
                  onClick={handleCancel}
                  sx={{
                    color: '#808080',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.path.trim()}
                startIcon={editingId ? <SaveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                sx={{
                  bgcolor: '#579945',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#68AD55' },
                  '&.Mui-disabled': { bgcolor: '#3C3F41', color: '#606366' },
                }}
              >
                {editingId ? 'Update' : 'Add'}
              </Button>
            </Box>
          </Box>

          {/* Observer list */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#6897BB' }} />
            </Box>
          ) : observers.length === 0 ? (
            <Typography sx={{
              color: '#606366', py: 3, textAlign: 'center', fontSize: 14,
            }}
            >
              No observers yet. Add one above.
            </Typography>
          ) : (
            <List dense sx={{ mx: -1 }}>
              {observers.map(observer => {
                const kpName = getKeepassName(observer.keepassSettingsId);
                const secondaryParts = [observer.path || 'No path set'];
                if (kpName) secondaryParts.push(`KeePass: ${kpName}`);
                if (observer.keepassEntryPath) secondaryParts.push(`Entry: ${observer.keepassEntryPath}`);
                return (
                  <ListItem
                    key={observer._id}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      '&:hover': { bgcolor: 'rgba(78,82,84,0.15)' },
                    }}
                    secondaryAction={(
                      <Box sx={{ display: 'flex', gap: 0.25 }}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(observer)}
                            sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(observer._id)}
                            sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  >
                    <ListItemText
                      primary={(
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {observer.name}
                          {kpName && (
                            <KeyIcon sx={{ fontSize: 14, color: '#CC7832', ml: 0.5 }} />
                          )}
                        </Box>
                      )}
                      secondary={secondaryParts.join(' \u2022 ')}
                      primaryTypographyProps={{
                        sx: { color: '#A9B7C6', fontWeight: 500, fontSize: 14 },
                      }}
                      secondaryTypographyProps={{
                        sx: {
                          color: '#606366',
                          fontSize: 12,
                          fontFamily: '"JetBrains Mono", "Consolas", monospace',
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
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

      <DirectoryBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleBrowseSelect}
      />
    </>
  );
};

export default ObserverManager;
