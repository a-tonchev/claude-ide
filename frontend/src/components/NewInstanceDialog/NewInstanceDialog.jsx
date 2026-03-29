import { useState, useEffect, useCallback } from 'react';
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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CastConnectedIcon from '@mui/icons-material/CastConnected';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const NewInstanceDialog = ({ open, onClose, onCreate }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [remote, setRemote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setRemote(false);
    setLoading(true);

    Connections.postRequest(ApiEndpoints.projectsAll, {})
      .then(result => {
        if (result?.ok) {
          setProjects(result.data.projects || []);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = useCallback(() => {
    if (!selected) return;
    onCreate?.(selected._id, selected.name, selected.path, remote);
    onClose?.();
  }, [selected, remote, onCreate, onClose]);

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
        color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1,
      }}
      >
        Launch New Instance
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#808080', fontSize: 13, mb: 2 }}>
          Select a project to launch a Claude Code instance.
        </Typography>

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
              <ListItemButton
                key={project._id}
                selected={selected?._id === project._id}
                onClick={() => setSelected(project)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
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
            ))}
          </List>
        )}
        <FormControlLabel
          control={(
            <Checkbox
              checked={remote}
              onChange={e => setRemote(e.target.checked)}
              size="small"
              sx={{
                color: '#6897BB',
                '&.Mui-checked': { color: '#6897BB' },
              }}
            />
          )}
          label={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CastConnectedIcon sx={{ fontSize: 16, color: remote ? '#6897BB' : '#606366' }} />
              <Typography sx={{ fontSize: '0.85rem', color: remote ? '#A9B7C6' : '#808080' }}>
                Remote control
              </Typography>
            </Box>
          )}
          sx={{ mt: 1, ml: 0 }}
        />
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
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!selected}
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

export default NewInstanceDialog;
