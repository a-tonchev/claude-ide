import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

import {
  CloseIcon, DeleteIcon, PlayArrowIcon, StopIcon,
} from '@/components/Icons/Icons';
import { splitGroupTabs } from '@/helpers/groupTabsHelper';
import GroupStatusChips, { getGroupCounts } from '@/components/GroupStatusChips/GroupStatusChips';

const GroupTabs = ({
  groups, activeGroupId, onSelect, onClose, onDelete, onRunGroup, onStopGroup,
  groupStatuses, instances, openTabIds, closedTabIds, onAddGroup, actions = null,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  const instanceList = Object.values(instances || {});
  // Visible tabs, and the closed or never-opened groups the "Add group…" picker offers
  const { visible: visibleGroups, hidden: hiddenGroups } = splitGroupTabs({
    groups, instances, activeGroupId, openTabIds, closedTabIds,
  });

  const activeIdx = visibleGroups.findIndex(g => g.id === activeGroupId);
  const hasVisibleGroups = visibleGroups.length > 0;

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

  if (!hasVisibleGroups && hiddenGroups.length === 0) return null;

  return (
    <Box sx={{
      bgcolor: '#1E1F21', borderBottom: '1px solid #3C3F41', display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    }}
    >
      {hasVisibleGroups && (
      <Tabs
        value={activeIdx >= 0 ? activeIdx : 0}
        onChange={(_, idx) => onSelect(visibleGroups[idx]?.id)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            color: '#808080',
            px: { xs: 1, sm: 2 },
            '&.Mui-selected': { color: '#D6DCE3' },
          },
          '& .MuiTabs-indicator': { bgcolor: '#6897BB' },
          '& .MuiTabScrollButton-root': {
            color: '#808080',
            '&.Mui-disabled': { opacity: 0.3 },
          },
        }}
      >
        {visibleGroups.map(group => (
          <Tab
            key={group.id}
            onContextMenu={group.virtual ? undefined : e => handleContextMenu(e, group.id)}
            label={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                  {group.name}
                </Typography>
                <GroupStatusChips counts={getGroupCounts(group, groupStatuses, instanceList)} />
                {onClose && !group.virtual && (
                <Box
                  component="span"
                  onClick={e => { e.stopPropagation(); onClose(group.id); }}
                  title="Close tab (instances keep running)"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ml: 0.25,
                    width: 18,
                    height: 18,
                    color: '#606366',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    '&:hover': { color: '#A9B7C6', bgcolor: 'rgba(104,151,187,0.15)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </Box>
                )}
              </Box>
            )}
          />
        ))}
      </Tabs>
      )}

      {/* The active group's Run / Stop / Save icons */}
      {actions}

      {hiddenGroups.length > 0 && (
        <Autocomplete
          size="small"
          options={hiddenGroups}
          getOptionLabel={option => option.name}
          onChange={(_, value) => {
            if (value) onAddGroup?.(value.id);
          }}
          value={null}
          blurOnSelect
          clearOnBlur
          sx={{
            minWidth: { xs: 120, sm: 160 },
            maxWidth: { xs: '100%', sm: 220 },
            mx: 1,
            my: { xs: 0.5, sm: 0 },
            flexShrink: { xs: 1, sm: 0 },
            '& .MuiInputBase-root': {
              height: 30,
              bgcolor: '#313335',
              color: '#A9B7C6',
              fontSize: '0.75rem',
              '& fieldset': { borderColor: '#4E5254' },
              '&:hover fieldset': { borderColor: '#6897BB' },
              '&.Mui-focused fieldset': { borderColor: '#6897BB' },
            },
            '& .MuiAutocomplete-popupIndicator': { color: '#808080' },
            '& .MuiAutocomplete-clearIndicator': { color: '#808080' },
          }}
          componentsProps={{
            paper: {
              sx: {
                bgcolor: '#313335',
                border: '1px solid #4E5254',
                '& .MuiAutocomplete-option': {
                  fontSize: '0.75rem',
                  color: '#A9B7C6',
                  '&:hover': { bgcolor: 'rgba(104,151,187,0.15)' },
                  '&[aria-selected="true"]': { bgcolor: 'rgba(104,151,187,0.25)' },
                },
              },
            },
          }}
          renderInput={params => (
            <TextField
              {...params}
              placeholder="Add group..."
              variant="outlined"
            />
          )}
        />
      )}

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
