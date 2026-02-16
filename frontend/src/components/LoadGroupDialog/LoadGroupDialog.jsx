import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FolderIcon from '@mui/icons-material/Folder';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const LoadGroupDialog = ({ open, onClose, onLoad, openGroupIds }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Connections.postRequest(ApiEndpoints.groupsAll, {})
      .then(result => {
        if (result?.ok) {
          setGroups(result.data.groups || []);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const openIds = new Set(openGroupIds || []);
  const closedGroups = groups.filter(g => !openIds.has(g._id));

  const handleLoad = useCallback(group => {
    onLoad?.(group);
    onClose?.();
  }, [onLoad, onClose]);

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
      <DialogTitle sx={{ color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 1 }}>
        Open Saved Group
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : closedGroups.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', bgcolor: '#2B2B2B', borderRadius: 2, border: '1px solid #3C3F41' }}>
            <Typography sx={{ color: '#808080', fontSize: 14 }}>
              {groups.length === 0 ? 'No saved groups yet.' : 'All saved groups are already open.'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ mx: -1 }}>
            {closedGroups.map(group => (
              <ListItemButton
                key={group._id}
                onClick={() => handleLoad(group)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1.5,
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <FolderIcon sx={{ fontSize: 20, color: '#808080' }} />
                </ListItemIcon>
                <ListItemText
                  primary={group.name}
                  secondary={`${group.items?.length || 0} items`}
                  primaryTypographyProps={{ sx: { color: '#A9B7C6', fontWeight: 500, fontSize: 14 } }}
                  secondaryTypographyProps={{ sx: { color: '#606366', fontSize: 12 } }}
                />
                {(group.items || []).map((item, idx) => (
                  <Chip
                    key={idx}
                    size="small"
                    label={item.name}
                    sx={{
                      ml: 0.5,
                      height: 20,
                      fontSize: '0.6rem',
                      bgcolor: item.type === 'claude' ? '#21428322' : '#4E5254',
                      color: item.type === 'claude' ? '#6897BB' : '#808080',
                    }}
                  />
                ))}
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          sx={{ color: '#808080', textTransform: 'none', '&:hover': { bgcolor: 'rgba(78,82,84,0.3)' } }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoadGroupDialog;
