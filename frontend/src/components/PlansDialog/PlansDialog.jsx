import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import usePlans from '@/hooks/usePlans';
import UrlEnums from '@/components/connections/enums/UrlEnums';

const PlansDialog = ({ open, onClose }) => {
  const { plans, fetchPlans, deletePlan, deleteAllPlans } = usePlans();

  useEffect(() => {
    if (open) fetchPlans();
  }, [open, fetchPlans]);

  const handleOpen = plan => {
    const url = UrlEnums.PLAN_VIEW.replace(':planId', plan._id);
    window.open(url, `plan_${plan._id}`, 'width=900,height=700');
  };

  const handleDelete = async planId => {
    await deletePlan(planId);
  };

  const handleClearAll = async () => {
    await deleteAllPlans();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#2B2B2B',
          color: '#A9B7C6',
          border: '1px solid #4E5254',
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: '1px solid #3C3F41',
        py: 1.5,
        px: 2,
      }}
      >
        <Typography sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: '#A9B7C6' }}>
          Stored Plans
        </Typography>
        <Button
          size="small"
          startIcon={<DeleteSweepIcon sx={{ fontSize: 16 }} />}
          onClick={handleClearAll}
          disabled={plans.length === 0}
          sx={{
            color: '#BC3F3C',
            fontSize: '0.75rem',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(188,63,60,0.12)' },
            '&.Mui-disabled': { color: '#4E5254' },
          }}
        >
          Clear All
        </Button>
        <IconButton size="small" onClick={onClose} sx={{ color: '#808080', '&:hover': { color: '#A9B7C6' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {plans.length === 0 ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6,
          }}
          >
            <Typography sx={{ color: '#606366', fontSize: '0.85rem' }}>
              No plans stored
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {plans.map(plan => (
              <ListItem
                key={plan._id}
                sx={{
                  borderBottom: '1px solid #3C3F41',
                  '&:hover': { bgcolor: 'rgba(78,82,84,0.15)' },
                }}
                secondaryAction={(
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Open in new window">
                      <IconButton
                        size="small"
                        onClick={() => handleOpen(plan)}
                        sx={{ color: '#6897BB', '&:hover': { color: '#89B8DE' } }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(plan._id)}
                        sx={{ color: '#808080', '&:hover': { color: '#BC3F3C' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              >
                <ListItemText
                  primary={plan.title || 'Untitled Plan'}
                  secondary={plan.createdAt ? new Date(plan.createdAt).toLocaleString() : null}
                  primaryTypographyProps={{
                    sx: {
                      color: '#A9B7C6',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      '&:hover': { color: '#6897BB' },
                    },
                    onClick: () => handleOpen(plan),
                  }}
                  secondaryTypographyProps={{
                    sx: { color: '#606366', fontSize: '0.7rem' },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlansDialog;
