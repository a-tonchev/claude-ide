import {
  useState, useEffect, useCallback, useRef,
} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  CircularProgress,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import AddIcon from '@mui/icons-material/Add';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import getRequestError from '@/helpers/requestErrorHelper';

// The launch flags picked last time, preselected on the next Add AI
const FLAG_IDS_KEY = 'claude-ide:add-ai-flag-ids';

const readSavedFlagIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(FLAG_IDS_KEY));
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

const NewInstanceDialog = ({
  open, onClose, onCreate, disabled = false, defaultProvider = 'claude', launchFlags = [],
}) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [provider, setProvider] = useState(defaultProvider);
  const [flagIds, setFlagIds] = useState(readSavedFlagIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savePending = useRef(false);

  const toggleFlag = useCallback(flagId => {
    setFlagIds(prev => {
      const next = prev.includes(flagId) ? prev.filter(id => id !== flagId) : [...prev, flagId];
      try {
        localStorage.setItem(FLAG_IDS_KEY, JSON.stringify(next));
      } catch { /* only a convenience */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (open) setProvider(defaultProvider);
  }, [open, defaultProvider]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSelected(null);
    setProjects([]);
    setError('');
    setLoading(true);

    Connections.postRequest(ApiEndpoints.projectsAll, {})
      .then(result => {
        if (!active) return;
        if (result?.ok) {
          setProjects(result.data.projects || []);
        } else {
          setError(getRequestError(result, 'Could not load projects. Close this dialog and try again.'));
        }
      })
      .catch(err => { if (active) setError(err.message || 'Could not load projects.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  const handleCreate = useCallback(async () => {
    if (!selected || disabled || savePending.current) return;
    savePending.current = true;
    setSaving(true);
    setError('');
    try {
      // Launch flags apply to Claude only; ids of flags deleted meanwhile are dropped
      const chosenFlagIds = provider === 'claude'
        ? flagIds.filter(id => launchFlags.some(flag => flag._id === id))
        : [];
      const result = await onCreate?.(selected._id, selected.name, selected.path, provider, chosenFlagIds);
      if (!result?.ok) {
        setError(getRequestError(result, 'Could not add the AI card. Please try again.'));
        return;
      }
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not add the AI card. Please try again.');
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  }, [selected, disabled, onCreate, onClose, provider, flagIds, launchFlags]);

  return (
    <Dialog
      open={open}
      onClose={() => { if (!savePending.current) onClose?.(); }}
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
        Add AI
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#808080', fontSize: 13, mb: 2 }}>
          Select a project and choose Claude or Codex to start it.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{
            py: 4,
            textAlign: 'center',
            bgcolor: '#2B2B2B',
            borderRadius: 2,
            border: '1px solid #3C3F41',
          }}
          >
            <Typography sx={{ color: '#808080', fontSize: 14 }}>
              No projects found. Add a project first.
            </Typography>
          </Box>
        ) : (
          <List sx={{ mx: -1 }}>
            {projects.map(project => (
              <Box
                component="li"
                key={project._id}
                sx={{
                  mb: 0.5,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: selected?._id === project._id ? 'rgba(104,151,187,0.05)' : 'transparent',
                  border: selected?._id === project._id ? '1px solid rgba(104,151,187,0.3)' : '1px solid transparent',
                }}
              >
                <ListItemButton
                  disabled={saving}
                  selected={selected?._id === project._id}
                  onClick={() => setSelected(project)}
                  sx={{
                    borderRadius: 2,
                    py: 1.5,
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(104,151,187,0.1)',
                      border: '1px solid rgba(104,151,187,0.3)',
                      '&:hover': { bgcolor: 'rgba(104,151,187,0.15)' },
                    },
                    '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <FolderOutlinedIcon sx={{ fontSize: 20, color: '#808080' }} />
                  </ListItemIcon>
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
                </ListItemButton>
                {selected?._id === project._id && (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={provider}
                    disabled={disabled || saving}
                    onChange={(event, value) => { if (value) setProvider(value); }}
                    aria-label={`AI provider for ${project.name}`}
                    sx={{
                      mx: 2,
                      mb: 1.5,
                      '& .MuiToggleButton-root': {
                        color: '#808080', fontSize: '0.8rem', px: 2, textTransform: 'none',
                      },
                      '& .MuiToggleButton-root.Mui-selected': { color: '#A9B7C6', bgcolor: '#21428355' },
                    }}
                  >
                    <ToggleButton value="claude">Claude</ToggleButton>
                    <ToggleButton value="codex">Codex</ToggleButton>
                  </ToggleButtonGroup>
                )}
                {selected?._id === project._id && provider === 'claude' && launchFlags.length > 0 && (
                  <Box sx={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mx: 2, mb: 1.5,
                  }}
                  >
                    <Typography sx={{ color: '#808080', fontSize: 12 }}>Launch flags:</Typography>
                    {launchFlags.map(flag => {
                      const active = flagIds.includes(flag._id);
                      return (
                        <Tooltip key={flag._id} title={flag.args || ''} arrow>
                          <Chip
                            size="small"
                            label={flag.name}
                            clickable
                            aria-pressed={active}
                            onClick={() => { if (!saving) toggleFlag(flag._id); }}
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              bgcolor: active ? '#21428355' : 'transparent',
                              color: active ? '#6897BB' : '#808080',
                              border: `1px solid ${active ? '#6897BB' : '#4E5254'}`,
                              '&:hover': { bgcolor: active ? '#21428377' : '#3C3F41' },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                )}
              </Box>
            ))}
          </List>
        )}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{
            color: '#808080',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!selected || disabled || loading || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon sx={{ fontSize: 16 }} />}
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
          {saving ? 'Adding AI…' : 'Add AI'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewInstanceDialog;
