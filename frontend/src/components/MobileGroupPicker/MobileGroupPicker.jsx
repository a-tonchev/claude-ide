import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import {
  ArrowDropDownIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  GroupAddIcon,
  MoreVertIcon,
  PlayArrowIcon,
  StopIcon,
  VisibilityOffIcon,
} from '@/components/Icons/Icons';
import GroupStatusChips, { getGroupCounts } from '@/components/GroupStatusChips/GroupStatusChips';
import { splitGroupTabs } from '@/helpers/groupTabsHelper';

// The colour of a group's most pressing status, for the dot on the picker button
const statusDotColor = statuses => {
  if (statuses.waiting || statuses.plan_ready) return '#CC7832';
  if (statuses.thinking || statuses.planning || statuses.working) return '#6897BB';
  if (Object.keys(statuses).length) return '#7CB368';
  return null;
};

const sectionTitleSx = {
  px: 2, pt: 2, pb: 0.75, fontSize: '0.7rem', fontWeight: 600, color: '#808080', letterSpacing: 0.5,
};

// Mobile replacement for the group tab bar: a button with the active group's name that
// opens a full-screen list of all groups and their instance statuses.
const MobileGroupPicker = ({
  groups, activeGroupId, groupStatuses, instances, openTabIds, closedTabIds,
  onSelect, onAddGroup, onClose, onDelete, onRunGroup, onStopGroup, onNewGroup,
}) => {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);

  const instanceList = Object.values(instances || {});
  const { visible, hidden } = splitGroupTabs({
    groups, instances, activeGroupId, openTabIds, closedTabIds,
  });
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeDot = activeGroup ? statusDotColor(groupStatuses?.[activeGroup.id] || {}) : null;

  // Open tabs are just selected; other groups are opened as a tab first
  const pick = (groupId, isOpenTab) => {
    if (isOpenTab) onSelect(groupId);
    else onAddGroup(groupId);
    setOpen(false);
  };

  const runMenuAction = action => {
    const groupId = menu?.groupId;
    setMenu(null);
    if (groupId) action?.(groupId);
  };

  const renderRow = (group, isOpenTab) => {
    const isActive = group.id === activeGroupId;
    return (
      <Box
        key={group.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #3C3F41',
          bgcolor: isActive ? 'rgba(104,151,187,0.12)' : 'transparent',
        }}
      >
        <ButtonBase
          onClick={() => pick(group.id, isOpenTab)}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.5,
            px: 2,
            py: 1.5,
            textAlign: 'left',
          }}
        >
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, width: '100%',
          }}
          >
            <Typography sx={{
              fontSize: '0.95rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#A9B7C6' : '#BBBBBB',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            >
              {group.name}
            </Typography>
            {!group.virtual && !group.saved && (
              <Typography sx={{ fontSize: '0.7rem', color: '#606366', flexShrink: 0 }}>unsaved</Typography>
            )}
            {isActive && <CheckIcon sx={{ fontSize: 16, color: '#6897BB', flexShrink: 0 }} />}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <GroupStatusChips counts={getGroupCounts(group, groupStatuses, instanceList)} />
          </Box>
        </ButtonBase>
        {!group.virtual && (
          <IconButton
            onClick={e => setMenu({ anchorEl: e.currentTarget, groupId: group.id, isOpenTab })}
            aria-label={`Actions for ${group.name}`}
            sx={{ color: '#808080', mr: 1 }}
          >
            <MoreVertIcon />
          </IconButton>
        )}
      </Box>
    );
  };

  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0.75,
          px: 1,
          py: 0.75,
          // Lined up with the card dropdown below it; the title bar's gap spaces the buttons
          borderRadius: 1,
          border: '1px solid #3C3F41',
          bgcolor: '#2B2B2B',
        }}
      >
        {activeDot && (
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', bgcolor: activeDot, flexShrink: 0,
        }}
        />
        )}
        <Typography sx={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: activeGroup ? '#A9B7C6' : '#808080',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        >
          {activeGroup?.name || 'Select group'}
        </Typography>
        <ArrowDropDownIcon sx={{ color: '#808080', flexShrink: 0 }} />
      </ButtonBase>

      <Dialog
        fullScreen
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { bgcolor: '#2B2B2B', backgroundImage: 'none' } }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          minHeight: 52,
          bgcolor: '#1A1A1A',
          borderBottom: '1px solid #3C3F41',
          flexShrink: 0,
        }}
        >
          <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ color: '#A9B7C6' }}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{
            flex: 1, fontSize: '1rem', fontWeight: 600, color: '#A9B7C6',
          }}
          >
            Groups
          </Typography>
          <Button
            size="small"
            startIcon={<GroupAddIcon />}
            onClick={() => { setOpen(false); onNewGroup?.(); }}
            sx={{ color: '#7CB368', textTransform: 'none' }}
          >
            New group
          </Button>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {visible.length === 0 && hidden.length === 0 && (
            <Typography sx={{
              p: 3, textAlign: 'center', fontSize: '0.85rem', color: '#808080',
            }}
            >
              No groups yet.
            </Typography>
          )}
          {visible.length > 0 && (
            <>
              <Typography sx={sectionTitleSx}>OPEN</Typography>
              {visible.map(g => renderRow(g, true))}
            </>
          )}
          {hidden.length > 0 && (
            <>
              <Typography sx={sectionTitleSx}>OTHER GROUPS</Typography>
              {hidden.map(g => renderRow(g, false))}
            </>
          )}
        </Box>
      </Dialog>

      <Menu
        anchorEl={menu?.anchorEl}
        open={!!menu}
        onClose={() => setMenu(null)}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            '& .MuiMenuItem-root': { fontSize: '0.9rem', color: '#A9B7C6', minHeight: 44 },
          },
        }}
      >
        <MenuItem onClick={() => runMenuAction(onRunGroup)}>
          <ListItemIcon><PlayArrowIcon sx={{ fontSize: 18, color: '#7CB368' }} /></ListItemIcon>
          Start all
        </MenuItem>
        <MenuItem onClick={() => runMenuAction(onStopGroup)}>
          <ListItemIcon><StopIcon sx={{ fontSize: 18, color: '#BC3F3C' }} /></ListItemIcon>
          Stop all
        </MenuItem>
        {menu?.isOpenTab && (
          <MenuItem onClick={() => runMenuAction(onClose)}>
            <ListItemIcon><VisibilityOffIcon sx={{ fontSize: 18, color: '#808080' }} /></ListItemIcon>
            Close tab
          </MenuItem>
        )}
        <MenuItem onClick={() => runMenuAction(onDelete)}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: '#BC3F3C' }} /></ListItemIcon>
          <Typography sx={{ color: '#BC3F3C' }}>Delete group permanently</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default MobileGroupPicker;
