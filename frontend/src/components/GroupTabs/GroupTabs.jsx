import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

const STATUS_CHIPS = {
  thinking: { label: 'thinking', bgcolor: '#CC783233', color: '#CC7832' },
  working: { label: 'working', bgcolor: '#6897BB33', color: '#6897BB' },
  waiting: { label: 'waiting', bgcolor: '#CC783233', color: '#CC7832' },
  planning: { label: 'planning', bgcolor: '#CC783233', color: '#CC7832' },
  plan_ready: { label: 'plan ready', bgcolor: '#7CB36833', color: '#7CB368' },
  completed: { label: 'done', bgcolor: '#7CB36833', color: '#7CB368' },
  running: { label: 'running', bgcolor: '#6897BB33', color: '#6897BB' },
  ready: { label: 'ready', bgcolor: '#6897BB33', color: '#6897BB' },
};

function getGroupCounts(instances, groupId) {
  const groupInstances = instances.filter(i => i.groupId === groupId);
  const counts = {};
  let terminals = 0;

  groupInstances.forEach(inst => {
    if (inst.type === 'terminal') {
      terminals++;
    } else if (inst.status !== 'exited') {
      const s = inst.status || 'running';
      counts[s] = (counts[s] || 0) + 1;
    }
  });

  return { counts, terminals };
}

const GroupTabs = ({
  groups, activeGroupId, onSelect, onClose, onDelete, onRunGroup, onStopGroup, instances,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  const instanceList = useMemo(
    () => Object.values(instances || {}),
    [instances],
  );

  if (!groups || groups.length === 0) return null;

  const activeIdx = groups.findIndex(g => g.id === activeGroupId);

  const handleContextMenu = (e, groupId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, groupId });
  };

  const handleCloseMenu = () => setContextMenu(null);

  const handleRunFromMenu = () => {
    if (contextMenu?.groupId) onRunGroup?.(contextMenu.groupId);
    setContextMenu(null);
  };

  const handleStopFromMenu = () => {
    if (contextMenu?.groupId) onStopGroup?.(contextMenu.groupId);
    setContextMenu(null);
  };

  const handleDeleteFromMenu = () => {
    if (contextMenu?.groupId) onDelete?.(contextMenu.groupId);
    setContextMenu(null);
  };

  return (
    <Box sx={{ bgcolor: '#1A1A1A', borderBottom: '1px solid #3C3F41' }}>
      <Tabs
        value={activeIdx >= 0 ? activeIdx : 0}
        onChange={(_, idx) => onSelect(groups[idx]?.id)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            color: '#808080',
            '&.Mui-selected': { color: '#A9B7C6' },
          },
          '& .MuiTabs-indicator': { bgcolor: '#6897BB' },
        }}
      >
        {groups.map(group => {
          const { counts, terminals } = getGroupCounts(instanceList, group.id);
          const savedItemCount = group.saved ? (group.items?.length || 0) : 0;
          const runningCount = Object.values(counts).reduce((a, b) => a + b, 0) + terminals;
          const stoppedCount = savedItemCount > runningCount ? savedItemCount - runningCount : 0;
          return (
            <Tab
              key={group.id}
              onContextMenu={group.virtual ? undefined : e => handleContextMenu(e, group.id)}
              label={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {group.name}
                  </Typography>
                  {Object.entries(counts).map(([status, count]) => {
                    const chip = STATUS_CHIPS[status] || STATUS_CHIPS.working;
                    return (
                      <Chip
                        key={status}
                        size="small"
                        label={`${count} ${chip.label}`}
                        sx={{
                          height: 18, fontSize: '0.65rem', bgcolor: chip.bgcolor, color: chip.color,
                        }}
                      />
                    );
                  })}
                  {terminals > 0 && (
                    <Chip
                      size="small"
                      label={`${terminals} term`}
                      sx={{
                        height: 18, fontSize: '0.65rem', bgcolor: '#4E5254', color: '#808080',
                      }}
                    />
                  )}
                  {stoppedCount > 0 && runningCount === 0 && (
                    <Chip
                      size="small"
                      label={`${savedItemCount} saved`}
                      sx={{
                        height: 18, fontSize: '0.65rem', bgcolor: '#3C3F41', color: '#606366',
                      }}
                    />
                  )}
                  {onClose && !group.virtual && (
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); onClose(group.id); }}
                      title="Close group"
                      sx={{
                        p: 0.25,
                        ml: 0.25,
                        color: '#606366',
                        '&:hover': { color: '#A9B7C6', bgcolor: 'rgba(104,151,187,0.15)' },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              )}
            />
          );
        })}
      </Tabs>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            '& .MuiMenuItem-root': { fontSize: '0.8rem', color: '#A9B7C6' },
          },
        }}
      >
        <MenuItem onClick={handleRunFromMenu}>
          <ListItemIcon><PlayArrowIcon sx={{ fontSize: 16, color: '#7CB368' }} /></ListItemIcon>
          <Typography sx={{ fontSize: '0.8rem' }}>Start all</Typography>
        </MenuItem>
        <MenuItem onClick={handleStopFromMenu}>
          <ListItemIcon><StopIcon sx={{ fontSize: 16, color: '#BC3F3C' }} /></ListItemIcon>
          <Typography sx={{ fontSize: '0.8rem' }}>Stop all</Typography>
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu} sx={{ '&:hover': { bgcolor: 'rgba(188,63,60,0.1)' } }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: '#BC3F3C' }} /></ListItemIcon>
          <Typography sx={{ fontSize: '0.8rem', color: '#BC3F3C' }}>Delete group permanently</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default GroupTabs;
