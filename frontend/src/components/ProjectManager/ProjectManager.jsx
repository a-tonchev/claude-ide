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

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import DirectoryBrowser from '@/components/DirectoryBrowser/DirectoryBrowser';

const emptyForm = { name: '', path: '' };

const ProjectManager = ({ open, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.projectsAll, {});
    if (result?.ok) {
      setProjects(result.data.projects || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchProjects();
      setForm(emptyForm);
      setEditingId(null);
    }
  }, [open, fetchProjects]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.path.trim()) return;
    setSaving(true);

    if (editingId) {
      const result = await Connections.postRequest(ApiEndpoints.projectsUpdate, {
        _id: editingId,
        name: form.name.trim(),
        path: form.path.trim(),
      });
      if (result?.ok) {
        setEditingId(null);
        setForm(emptyForm);
        fetchProjects();
      }
    } else {
      const result = await Connections.postRequest(ApiEndpoints.projectsAdd, {
        name: form.name.trim(),
        path: form.path.trim(),
      });
      if (result?.ok) {
        setForm(emptyForm);
        fetchProjects();
      }
    }

    setSaving(false);
  }, [form, editingId, fetchProjects]);

  const handleEdit = useCallback(project => {
    setEditingId(project._id);
    setForm({ name: project.name, path: project.path });
  }, []);

  const handleDelete = useCallback(async (projectId) => {
    await Connections.postRequest(ApiEndpoints.projectsDelete, { _id: projectId });
    fetchProjects();
  }, [fetchProjects]);

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
        <DialogTitle sx={{ color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1 }}>
          Projects
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
          }}
          >
            <TextField
              size="small"
              label="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={handleKeyDown}
              sx={{ flex: '1 1 120px', ...inputSx }}
            />
            <TextField
              size="small"
              label="Path"
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

          {/* Project list */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#6897BB' }} />
            </Box>
          ) : projects.length === 0 ? (
            <Typography sx={{ color: '#606366', py: 3, textAlign: 'center', fontSize: 14 }}>
              No projects yet. Add one above.
            </Typography>
          ) : (
            <List dense sx={{ mx: -1 }}>
              {projects.map(project => (
                <ListItem
                  key={project._id}
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
                          onClick={() => handleEdit(project)}
                          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(project._id)}
                          sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={project.name}
                    secondary={project.path}
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

export default ProjectManager;
