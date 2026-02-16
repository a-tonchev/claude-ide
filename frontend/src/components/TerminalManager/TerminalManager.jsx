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
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import TerminalIcon from '@mui/icons-material/Terminal';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const SHELLS = [
  { value: 'wsl', label: 'WSL' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Bash' },
  { value: 'gitbash', label: 'Git Bash' },
];

const SHELL_LABELS = Object.fromEntries(SHELLS.map(s => [s.value, s.label]));

const emptyForm = { name: '', shell: 'powershell', command: '', cwd: '' };

const TerminalManager = ({ open, onClose }) => {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchTerminals = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.terminalsAll, {});
    if (result?.ok) {
      setTerminals(result.data.terminals || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchTerminals();
      setForm(emptyForm);
      setEditingId(null);
    }
  }, [open, fetchTerminals]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.shell) return;
    setSaving(true);

    const params = {
      name: form.name.trim(),
      shell: form.shell,
    };
    if (form.command.trim()) params.command = form.command.trim();
    if (form.cwd.trim()) params.cwd = form.cwd.trim();

    if (editingId) {
      const result = await Connections.postRequest(ApiEndpoints.terminalsUpdate, {
        _id: editingId,
        ...params,
      });
      if (result?.ok) {
        setEditingId(null);
        setForm(emptyForm);
        fetchTerminals();
      }
    } else {
      const result = await Connections.postRequest(ApiEndpoints.terminalsAdd, params);
      if (result?.ok) {
        setForm(emptyForm);
        fetchTerminals();
      }
    }

    setSaving(false);
  }, [form, editingId, fetchTerminals]);

  const handleEdit = useCallback(terminal => {
    setEditingId(terminal._id);
    setForm({
      name: terminal.name,
      shell: terminal.shell,
      command: terminal.command || '',
      cwd: terminal.cwd || '',
    });
  }, []);

  const handleDelete = useCallback(async (terminalId) => {
    await Connections.postRequest(ApiEndpoints.terminalsDelete, { _id: terminalId });
    fetchTerminals();
  }, [fetchTerminals]);

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
      <DialogTitle sx={{ color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TerminalIcon sx={{ color: '#6897BB' }} />
        Terminal Configs
      </DialogTitle>
      <DialogContent>
        {/* Add / Edit form */}
        <Box sx={{
          display: 'flex',
          gap: 1,
          mb: 2,
          mt: 1,
          flexWrap: 'wrap',
          p: 2,
          bgcolor: '#2B2B2B',
          borderRadius: 2,
          border: '1px solid #3C3F41',
        }}>
          <TextField
            size="small"
            label="Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={handleKeyDown}
            sx={{ flex: '1 1 120px', ...inputSx }}
          />
          <FormControl size="small" sx={{ flex: '0 1 130px', ...inputSx }}>
            <InputLabel sx={{ color: '#808080', fontSize: 13 }}>Shell</InputLabel>
            <Select
              value={form.shell}
              label="Shell"
              onChange={e => setForm(f => ({ ...f, shell: e.target.value }))}
              sx={{ fontSize: 13, color: '#A9B7C6' }}
            >
              {SHELLS.map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Command"
            value={form.command}
            onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
            onKeyDown={handleKeyDown}
            placeholder="Optional"
            sx={{ flex: '2 1 200px', ...inputSx }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.shell}
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
        </Box>

        {/* Terminal list */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : terminals.length === 0 ? (
          <Typography sx={{ color: '#606366', py: 3, textAlign: 'center', fontSize: 14 }}>
            No terminal configs yet. Add one above.
          </Typography>
        ) : (
          <List dense sx={{ mx: -1 }}>
            {terminals.map(terminal => (
              <ListItem
                key={terminal._id}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.15)' },
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(terminal)}
                        sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(terminal._id)}
                        sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{terminal.name}</span>
                      <Chip
                        size="small"
                        label={SHELL_LABELS[terminal.shell] || terminal.shell}
                        sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#4E5254', color: '#808080' }}
                      />
                    </Box>
                  }
                  secondary={terminal.command || 'Interactive shell'}
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
  );
};

export default TerminalManager;
