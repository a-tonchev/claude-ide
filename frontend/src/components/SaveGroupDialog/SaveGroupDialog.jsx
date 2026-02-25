import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import SaveIcon from '@mui/icons-material/Save';

const SaveGroupDialog = ({
  open, onClose, onSave, group, instances,
}) => {
  const [groupName, setGroupName] = useState(group?.name || '');

  const groupInstances = Object.values(instances || {}).filter(
    i => i.groupId === group?.id,
  );

  // Items from the saved group that don't have a running instance
  const savedOnlyItems = (group?.items || []).filter(item => !groupInstances.some(inst => {
    if (inst.type !== item.type) return false;
    if (inst.type === 'claude') return inst.projectId === item.projectId;
    return (inst.projectName || inst.name) === item.name && inst.shell === item.shell;
  }));

  const handleSave = () => {
    // Build items from saved group items + running instances
    const existingItems = group?.items || [];
    const items = [];
    const usedInstanceIds = new Set();

    // For each running instance, create/update its item
    groupInstances.forEach(inst => {
      usedInstanceIds.add(inst.id);
      if (inst.type === 'terminal') {
        items.push({
          type: 'terminal',
          name: inst.projectName || inst.name,
          shell: inst.shell,
          command: inst.command,
          cwd: inst.cwd,
        });
      } else {
        items.push({
          type: 'claude', projectId: inst.projectId, name: inst.projectName || inst.name, path: inst.cwd,
        });
      }
    });

    // Keep saved items that don't have a running instance (stopped items)
    existingItems.forEach(item => {
      const alreadyCovered = items.some(i => {
        if (i.type !== item.type) return false;
        if (i.type === 'claude') return i.projectId === item.projectId;
        return i.name === item.name && i.shell === item.shell;
      });
      if (!alreadyCovered) items.push(item);
    });

    // Strip null/undefined values from each item to avoid schema validation errors
    const cleanItems = items.map(item => {
      const clean = {};
      for (const [k, v] of Object.entries(item)) {
        if (v != null) clean[k] = v;
      }
      return clean;
    });

    onSave({ id: group?.id, name: groupName, items: cleanItems });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SaveIcon sx={{ color: '#6897BB' }} />
        Save Group
      </DialogTitle>
      <DialogContent sx={{
        display: 'flex', flexDirection: 'column', gap: 2, pt: 1,
      }}
      >
        <TextField
          label="Group Name"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          size="small"
          fullWidth
          sx={{ mt: 1 }}
        />
        <Typography sx={{ fontSize: '0.8rem', color: '#808080' }}>
          This group contains:
        </Typography>
        <List dense sx={{ bgcolor: '#2B2B2B', borderRadius: 1, border: '1px solid #3C3F41' }}>
          {groupInstances.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No instances"
                primaryTypographyProps={{ fontSize: '0.8rem', color: '#606366' }}
              />
            </ListItem>
          )}
          {groupInstances.map(inst => (
            <ListItem key={inst.id}>
              <Chip
                size="small"
                label={inst.type === 'terminal' ? 'Terminal' : 'Claude'}
                sx={{
                  mr: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: inst.type === 'terminal' ? '#4E5254' : '#21428333',
                  color: inst.type === 'terminal' ? '#808080' : '#6897BB',
                }}
              />
              <ListItemText
                primary={inst.projectName || inst.name || inst.id.slice(0, 8)}
                primaryTypographyProps={{ fontSize: '0.8rem', color: '#A9B7C6' }}
              />
            </ListItem>
          ))}
          {savedOnlyItems.map((item, idx) => (
            <ListItem key={`saved-${idx}`}>
              <Chip
                size="small"
                label={item.type === 'terminal' ? 'Terminal' : 'Claude'}
                sx={{
                  mr: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: '#3C3F41',
                  color: '#606366',
                }}
              />
              <ListItemText
                primary={item.name}
                secondary="stopped"
                primaryTypographyProps={{ fontSize: '0.8rem', color: '#606366' }}
                secondaryTypographyProps={{ fontSize: '0.65rem', color: '#4E5254' }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#808080' }}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={!groupName.trim()}
          variant="contained"
          sx={{ bgcolor: '#579945', '&:hover': { bgcolor: '#68AD55' } }}
        >
          Save Group
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveGroupDialog;
