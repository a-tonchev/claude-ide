import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  Box,
  Breadcrumbs,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckIcon from '@mui/icons-material/Check';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const DirectoryBrowser = ({ open, onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState('');
  const [parent, setParent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [roots, setRoots] = useState(null);

  const browse = useCallback(async dirPath => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.browse, { path: dirPath || '' });
    if (result?.ok) {
      const { data } = result;
      setCurrent(data.current || '');
      setParent(data.parent || null);
      setEntries(data.entries || []);
      setRoots(data.roots || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      browse('');
    }
  }, [open, browse]);

  const handleNavigate = useCallback(path => {
    browse(path);
  }, [browse]);

  const handleSelect = useCallback(() => {
    if (onSelect && current) {
      onSelect(current);
    }
    onClose?.();
  }, [current, onSelect, onClose]);

  const pathSegments = current
    ? current.split(/[/\\]/).filter(Boolean)
    : [];

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
        Browse Directory
      </DialogTitle>
      <DialogContent>
        {/* Current path breadcrumb */}
        <Box sx={{
          mb: 1.5,
          overflowX: 'auto',
          bgcolor: '#2B2B2B',
          borderRadius: 1.5,
          px: 1.5,
          py: 1,
          border: '1px solid #3C3F41',
        }}
        >
          <Breadcrumbs
            maxItems={5}
            sx={{
              fontSize: 12,
              '& .MuiBreadcrumbs-separator': { color: '#4E5254' },
            }}
          >
            {pathSegments.map((segment, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 12,
                  color: '#808080',
                  fontFamily: '"JetBrains Mono", "Consolas", monospace',
                }}
              >
                {segment}
              </Typography>
            ))}
          </Breadcrumbs>
        </Box>

        {/* Drive roots (Windows) */}
        {roots && roots.length > 0 && (
          <Box sx={{
            display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap',
          }}
          >
            {roots.map(root => (
              <Chip
                key={root.path}
                label={root.name}
                size="small"
                variant="outlined"
                onClick={() => handleNavigate(root.path)}
                sx={{
                  borderColor: '#4E5254',
                  color: '#808080',
                  fontSize: 12,
                  '&:hover': { borderColor: '#6897BB', color: '#6897BB' },
                }}
              />
            ))}
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 400, overflow: 'auto', mx: -1 }}>
            {parent && (
              <ListItemButton
                onClick={() => handleNavigate(parent)}
                sx={{
                  borderRadius: 2,
                  mb: 0.25,
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ArrowUpwardIcon sx={{ fontSize: 18, color: '#808080' }} />
                </ListItemIcon>
                <ListItemText
                  primary=".."
                  primaryTypographyProps={{ sx: { color: '#808080', fontSize: 13 } }}
                />
              </ListItemButton>
            )}

            {entries.length === 0 && !parent && (
              <Typography sx={{
                color: '#606366', py: 3, textAlign: 'center', fontSize: 13,
              }}
              >
                No subdirectories found.
              </Typography>
            )}

            {entries.map(entry => (
              <ListItemButton
                key={entry.path}
                onClick={() => handleNavigate(entry.path)}
                sx={{
                  borderRadius: 2,
                  mb: 0.25,
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <FolderIcon sx={{ fontSize: 18, color: '#6897BB' }} />
                </ListItemIcon>
                <ListItemText
                  primary={entry.name}
                  primaryTypographyProps={{ sx: { color: '#A9B7C6', fontSize: 13 } }}
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
          onClick={handleSelect}
          disabled={!current}
          startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
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
          Select This Folder
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DirectoryBrowser;
