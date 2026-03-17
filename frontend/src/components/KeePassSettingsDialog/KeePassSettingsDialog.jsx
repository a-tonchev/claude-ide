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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import DirectoryBrowser from '@/components/DirectoryBrowser/DirectoryBrowser';

const SETTINGS_TYPE = 'keepass';

const emptyForm = {
  name: '',
  dbPath: '',
  dbName: '',
  username: '',
  password: '',
  instructions: '',
};

const KeePassSettingsDialog = ({ open, onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.settingsAll, { type: SETTINGS_TYPE });
    if (result?.ok) {
      setItems(result.data.settings || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchItems();
      setForm(emptyForm);
      setEditingId(null);
      setShowPassword(false);
    }
  }, [open, fetchItems]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.dbPath.trim()) return;
    setSaving(true);

    const payload = {
      type: SETTINGS_TYPE,
      name: form.name.trim(),
      dbPath: form.dbPath.trim(),
    };
    if (form.dbName.trim()) payload.dbName = form.dbName.trim();
    if (form.username.trim()) payload.username = form.username.trim();
    if (form.password) payload.password = form.password;
    if (form.instructions.trim()) payload.instructions = form.instructions.trim();

    if (editingId) {
      payload._id = editingId;
      const result = await Connections.postRequest(ApiEndpoints.settingsUpdate, payload);
      if (result?.ok) {
        setEditingId(null);
        setForm(emptyForm);
        fetchItems();
      }
    } else {
      const result = await Connections.postRequest(ApiEndpoints.settingsAdd, payload);
      if (result?.ok) {
        setForm(emptyForm);
        fetchItems();
      }
    }

    setSaving(false);
    setShowPassword(false);
  }, [form, editingId, fetchItems]);

  const handleEdit = useCallback(item => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      dbPath: item.dbPath || '',
      dbName: item.dbName || '',
      username: item.username || '',
      password: '',
      instructions: item.instructions || '',
    });
    setShowPassword(false);
  }, []);

  const handleDelete = useCallback(async id => {
    await Connections.postRequest(ApiEndpoints.settingsDelete, { _id: id });
    fetchItems();
  }, [fetchItems]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setShowPassword(false);
  }, []);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const handleBrowseSelect = useCallback(selectedPath => {
    setForm(f => ({ ...f, dbPath: selectedPath }));
  }, []);

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
          KeePass Credentials
        </DialogTitle>
        <DialogContent>
          {/* Add / Edit form */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mb: 2,
            mt: 1,
            p: 2,
            bgcolor: '#2B2B2B',
            borderRadius: 2,
            border: '1px solid #3C3F41',
          }}
          >
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                label="Name"
                placeholder="e.g. My KeePass DB"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '1 1 150px', ...inputSx }}
              />
              <TextField
                size="small"
                label="DB Name"
                placeholder="e.g. passwords"
                value={form.dbName}
                onChange={e => setForm(f => ({ ...f, dbName: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '1 1 150px', ...inputSx }}
              />
            </Box>
            <TextField
              size="small"
              label="DB Path"
              placeholder="Path to .kdbx file"
              value={form.dbPath}
              onChange={e => setForm(f => ({ ...f, dbPath: e.target.value }))}
              onKeyDown={handleKeyDown}
              fullWidth
              sx={inputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Browse">
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                label="Username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '1 1 150px', ...inputSx }}
              />
              <TextField
                size="small"
                label={editingId ? 'Password (leave empty to keep)' : 'Password'}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={handleKeyDown}
                sx={{ flex: '1 1 150px', ...inputSx }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(s => !s)}
                        edge="end"
                        sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                      >
                        {showPassword
                          ? <VisibilityOffIcon fontSize="small" />
                          : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <TextField
              size="small"
              label="Instructions"
              placeholder="CLI usage instructions for the observer (e.g., keepassxc-cli binary path, flags)"
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              multiline
              minRows={2}
              maxRows={5}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  fontFamily: '"JetBrains Mono", "Consolas", monospace',
                },
              }}
            />
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
                disabled={saving || !form.name.trim() || !form.dbPath.trim()}
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

          {/* List */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#6897BB' }} />
            </Box>
          ) : items.length === 0 ? (
            <Typography sx={{
              color: '#606366', py: 3, textAlign: 'center', fontSize: 14,
            }}
            >
              No KeePass configurations yet. Add one above.
            </Typography>
          ) : (
            <List dense sx={{ mx: -1 }}>
              {items.map(item => (
                <ListItem
                  key={item._id}
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
                          onClick={() => handleEdit(item)}
                          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(item._id)}
                          sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                >
                  <ListItemText
                    primary={item.name}
                    secondary={`${item.dbPath || 'No path'}${item.hasPassword ? ' \u2022 Password set' : ''}`}
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

      <DirectoryBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleBrowseSelect}
      />
    </>
  );
};

export default KeePassSettingsDialog;
