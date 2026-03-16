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
} from '@mui/material';
import { ArrowFatLinesUp } from '@phosphor-icons/react';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const NewObserverDialog = ({ open, onClose, onCreate }) => {
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setLoading(true);

    Connections.postRequest(ApiEndpoints.observersAll, {})
      .then(result => {
        if (result?.ok) {
          setObservers(result.data.observers || []);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = useCallback(() => {
    if (!selected) return;
    onCreate?.(selected._id, selected.name, selected.path);
    onClose?.();
  }, [selected, onCreate, onClose]);

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
        Launch Observer
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#808080', fontSize: 13, mb: 2 }}>
          Select an observer config to launch a remote observer instance.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : observers.length === 0 ? (
          <Box sx={{
            py: 4,
            textAlign: 'center',
            bgcolor: '#2B2B2B',
            borderRadius: 2,
            border: '1px solid #3C3F41',
          }}
          >
            <Typography sx={{ color: '#808080', fontSize: 14 }}>
              No observer configs found. Add one in Settings &rarr; Observer Configs.
            </Typography>
          </Box>
        ) : (
          <List sx={{ mx: -1 }}>
            {observers.map(observer => (
              <ListItemButton
                key={observer._id}
                selected={selected?._id === observer._id}
                onClick={() => setSelected(observer)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1.5,
                  border: '1px solid transparent',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(176,122,204,0.1)',
                    border: '1px solid rgba(176,122,204,0.3)',
                    '&:hover': { bgcolor: 'rgba(176,122,204,0.15)' },
                  },
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ArrowFatLinesUp size={20} weight="bold" color="#B07ACC" />
                </ListItemIcon>
                <ListItemText
                  primary={observer.name}
                  secondary={observer.path || 'No path set'}
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

export default NewObserverDialog;
