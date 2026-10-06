import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';

import {
  AddIcon,
  ArrowFatLinesUpIcon as ArrowFatLinesUp,
  ArticleIcon,
  BookmarksOutlinedIcon,
  FolderOpenIcon,
  GroupAddIcon,
  HexagonOutlinedIcon,
  KeyIcon,
  MoreVertIcon,
  PlayArrowIcon,
  RestoreIcon,
  SaveIcon,
  SettingsIcon,
  SmartToyIcon,
  StopIcon,
  TerminalIcon,
  TuneIcon,
} from '@/components/Icons/Icons';
import useMobile from '@/components/layout/hooks/useMobile';

const menuPaperSx = {
  bgcolor: '#313335',
  border: '1px solid #4E5254',
  '& .MuiMenuItem-root': { fontSize: '0.85rem', color: '#A9B7C6' },
};

const menuIcon = (Icon, color) => <Icon sx={{ fontSize: 18, color }} />;

const mobileButtonSx = { width: 40, height: 40, flexShrink: 0 };

const countSx = {
  ml: 'auto', pl: 2, fontSize: '0.75rem', color: '#808080',
};

// groupActions (mobile only): the active group's Run / Stop / Save. Run shows next to the +
// while nothing in the group runs; Stop and Save sit in the ⋮ menu with everything else.
const TitleBar = ({
  onNewGroup, onAddAI, onAddTerminal, onAddObserver, onLoadGroup,
  onManageProjects, onManageTerminals, onManageObservers, onManagePlans, onManageKeePass,
  onManageLaunchFlags, rememberedCount = 0, onOpenRemembered, savedCount = 0, onOpenSaved, groupSelector = null,
  groupActions = null,
}) => {
  const { isMobile } = useMobile();
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [addAnchor, setAddAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);

  // The settings entries, in the Settings menu on desktop and the ⋮ menu on mobile
  const settingsItems = [
    {
      key: 'load', label: 'Open Saved Group', icon: menuIcon(FolderOpenIcon, '#7CB368'), onClick: onLoadGroup,
    },
    {
      key: 'projects',
      label: 'AI Instances',
      icon: menuIcon(SmartToyIcon, '#6897BB'),
      onClick: onManageProjects,
      divider: true,
    },
    {
      key: 'terminals',
      label: 'Terminal Instances',
      icon: menuIcon(TerminalIcon, '#808080'),
      onClick: onManageTerminals,
    },
    {
      key: 'observers',
      label: 'Observer Instances',
      icon: <ArrowFatLinesUp size={18} weight="bold" color="#B07ACC" />,
      onClick: onManageObservers,
    },
    {
      key: 'keepass', label: 'KeePass Credentials', icon: menuIcon(KeyIcon, '#CC7832'), onClick: onManageKeePass,
    },
    {
      key: 'flags', label: 'Launch Flags', icon: menuIcon(TuneIcon, '#6897BB'), onClick: onManageLaunchFlags,
    },
    {
      key: 'plans', label: 'Plans', icon: menuIcon(ArticleIcon, '#CC7832'), onClick: onManagePlans, divider: true,
    },
  ];

  const renderItems = (items, close) => items.flatMap(item => [
    item.divider && <Divider key={`${item.key}-divider`} sx={{ borderColor: '#3C3F41' }} />,
    <MenuItem key={item.key} onClick={() => { close(); item.onClick?.(); }}>
      <ListItemIcon>{item.icon}</ListItemIcon>
      {item.label}
      {item.count > 0 && <Box component="span" sx={countSx}>{item.count}</Box>}
    </MenuItem>,
  ]).filter(Boolean);

  const closeMore = () => setMoreAnchor(null);
  const saveLabel = groupActions?.isUpdate ? 'Update group' : 'Save group';
  const moreItems = [
    ...(groupActions?.showStop ? [{
      key: 'stop-group', label: 'Stop group', icon: menuIcon(StopIcon, '#BC3F3C'), onClick: groupActions.onStop,
    }] : []),
    ...(groupActions?.showSave ? [{
      key: 'save-group',
      label: saveLabel,
      icon: <SaveIcon sx={{ fontSize: 18, color: groupActions.isUpdate ? '#6897BB' : '#808080' }} />,
      onClick: groupActions.onSave,
    }] : []),
    {
      key: 'saved',
      label: 'Saved instances',
      icon: menuIcon(BookmarksOutlinedIcon, '#6897BB'),
      onClick: onOpenSaved,
      count: savedCount,
      divider: !!(groupActions?.showStop || groupActions?.showSave),
    },
    {
      key: 'remembered',
      label: 'Remembered instances',
      icon: menuIcon(RestoreIcon, '#CC7832'),
      onClick: onOpenRemembered,
      count: rememberedCount,
    },
    ...settingsItems.map((item, i) => (i === 0 ? { ...item, divider: true } : item)),
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        // Mobile: same spacing and 40px buttons as the card navigator below, so they line up
        pl: isMobile ? 1 : 2,
        pr: isMobile ? 0.5 : 2,
        py: isMobile ? 0.5 : 1,
        gap: isMobile ? 0.5 : 0,
        bgcolor: '#1E1F21',
        borderBottom: '1px solid #3C3F41',
        minHeight: 48,
        position: 'relative',
      }}
    >
      {/* Mobile: a tiny logo in the top-right corner, so the group picker gets the room */}
      <HexagonOutlinedIcon
        sx={isMobile ? {
          position: 'absolute', top: 3, right: 3, fontSize: 10, color: '#6897BB', opacity: 0.8, pointerEvents: 'none',
        } : { color: '#6897BB', mr: 1, fontSize: 24 }}
      />
      {/* On mobile the group picker takes the title's place (and the spacer's) */}
      {groupSelector || (
        <Typography
          variant="h6"
          sx={{
            color: '#A9B7C6',
            fontWeight: 600,
            fontSize: '1rem',
            mr: 2,
          }}
        >
          Claude IDE
        </Typography>
      )}

      {isMobile && groupActions?.showRun && (
        <IconButton
          size="small"
          onClick={groupActions.onRun}
          aria-label="Run group"
          title="Run group"
          sx={{
            ...mobileButtonSx, color: '#7CB368', '&:hover': { color: '#8FD47A', bgcolor: 'rgba(124,179,104,0.12)' },
          }}
        >
          <PlayArrowIcon />
        </IconButton>
      )}

      <IconButton
        size="small"
        onClick={e => setAddAnchor(e.currentTarget)}
        aria-label="Add"
        title="Add group, AI, terminal or observer"
        sx={{
          // A plain icon like its neighbours; green marks it as the add action
          color: '#7CB368',
          width: isMobile ? 40 : 32,
          height: isMobile ? 40 : 32,
          flexShrink: 0,
          '&:hover': { bgcolor: 'rgba(124,179,104,0.12)', color: '#8FD47A' },
        }}
      >
        <AddIcon sx={{ fontSize: isMobile ? 24 : 20 }} />
      </IconButton>

      <Menu
        anchorEl={addAnchor}
        open={Boolean(addAnchor)}
        onClose={() => setAddAnchor(null)}
        PaperProps={{ sx: menuPaperSx }}
      >
        <MenuItem onClick={() => { setAddAnchor(null); onNewGroup?.(); }}>
          <ListItemIcon><GroupAddIcon sx={{ fontSize: 18, color: '#7CB368' }} /></ListItemIcon>
          New Group
        </MenuItem>
        <Divider sx={{ borderColor: '#3C3F41' }} />
        <MenuItem onClick={() => { setAddAnchor(null); onAddAI?.(); }}>
          <ListItemIcon><SmartToyIcon sx={{ fontSize: 18, color: '#CC7832' }} /></ListItemIcon>
          Add AI
        </MenuItem>
        <MenuItem onClick={() => { setAddAnchor(null); onAddTerminal?.(); }}>
          <ListItemIcon><TerminalIcon sx={{ fontSize: 18, color: '#808080' }} /></ListItemIcon>
          Add Terminal
        </MenuItem>
        <MenuItem onClick={() => { setAddAnchor(null); onAddObserver?.(); }}>
          <ListItemIcon><ArrowFatLinesUp size={18} weight="bold" color="#B07ACC" /></ListItemIcon>
          Add Observer
        </MenuItem>
      </Menu>

      {isMobile ? (
        // Mobile: one ⋮ menu for the group's Stop / Save, Saved, Remembered and the settings
        <>
          <IconButton
            size="small"
            onClick={e => setMoreAnchor(e.currentTarget)}
            aria-label="More"
            title="More"
            sx={{ ...mobileButtonSx, color: '#A9B7C6' }}
          >
            <Badge
              variant="dot"
              color="warning"
              invisible={!(savedCount || rememberedCount || groupActions?.isUpdate)}
            >
              <MoreVertIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={closeMore}
            PaperProps={{ sx: menuPaperSx }}
          >
            {renderItems(moreItems, closeMore)}
          </Menu>
        </>
      ) : (
        <>
          {!groupSelector && <Box sx={{ flex: 1 }} />}

          <IconButton
            size="small"
            onClick={onOpenSaved}
            title={savedCount ? `Saved instances (${savedCount})` : 'Saved instances'}
            aria-label="Saved instances"
            sx={{ color: '#808080', mr: 0.5, ml: groupSelector ? 0.5 : 0 }}
          >
            <Badge
              badgeContent={savedCount}
              color="primary"
              max={99}
              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}
            >
              <BookmarksOutlinedIcon fontSize="small" />
            </Badge>
          </IconButton>

          <IconButton
            size="small"
            onClick={onOpenRemembered}
            title={rememberedCount ? `Remembered instances (${rememberedCount})` : 'Remembered instances'}
            aria-label="Remembered instances"
            sx={{ color: '#808080', mr: 0.5 }}
          >
            <Badge
              badgeContent={rememberedCount}
              color="warning"
              max={99}
              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16 } }}
            >
              <RestoreIcon fontSize="small" />
            </Badge>
          </IconButton>

          <IconButton
            size="small"
            onClick={e => setSettingsAnchor(e.currentTarget)}
            aria-label="Settings"
            title="Settings"
            sx={{ color: '#808080' }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>

          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={() => setSettingsAnchor(null)}
            PaperProps={{ sx: menuPaperSx }}
          >
            {renderItems(settingsItems, () => setSettingsAnchor(null))}
          </Menu>
        </>
      )}
    </Box>
  );
};

export default TitleBar;
