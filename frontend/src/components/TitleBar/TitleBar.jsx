import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import RestoreIcon from '@mui/icons-material/Restore';
import { ArrowFatLinesUp } from '@phosphor-icons/react';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArticleIcon from '@mui/icons-material/Article';
import KeyIcon from '@mui/icons-material/Key';
import TuneIcon from '@mui/icons-material/Tune';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import Divider from '@mui/material/Divider';

import useMobile from '@/components/layout/hooks/useMobile';

const TitleBar = ({
  onNewGroup, onAddAI, onAddTerminal, onAddObserver, onLoadGroup,
  onManageProjects, onManageTerminals, onManageObservers, onManagePlans, onManageKeePass,
  onManageLaunchFlags, rememberedCount = 0, onOpenRemembered, groupSelector = null,
}) => {
  const { isMobile } = useMobile();
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [addAnchor, setAddAnchor] = useState(null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: isMobile ? 1 : 2,
        py: isMobile ? 0.5 : 1,
        bgcolor: '#1A1A1A',
        borderBottom: '1px solid #3C3F41',
        minHeight: 48,
      }}
    >
      <HexagonOutlinedIcon sx={{ color: '#6897BB', mr: isMobile ? 0 : 1, fontSize: isMobile ? 22 : 24 }} />
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

      <IconButton
        size="small"
        onClick={e => setAddAnchor(e.currentTarget)}
        sx={{
          bgcolor: '#579945',
          color: '#fff',
          borderRadius: 1.5,
          width: 32,
          height: 32,
          '&:hover': { bgcolor: '#68AD55' },
        }}
      >
        <AddIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Menu
        anchorEl={addAnchor}
        open={Boolean(addAnchor)}
        onClose={() => setAddAnchor(null)}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            '& .MuiMenuItem-root': { fontSize: '0.85rem', color: '#A9B7C6' },
          },
        }}
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

      {!groupSelector && <Box sx={{ flex: 1 }} />}

      <IconButton
        size="small"
        onClick={onOpenRemembered}
        title={rememberedCount ? `Remembered instances (${rememberedCount})` : 'Remembered instances'}
        sx={{ color: '#808080', mr: 0.5, ml: groupSelector ? 0.5 : 0 }}
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
        sx={{ color: '#808080' }}
      >
        <SettingsIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            '& .MuiMenuItem-root': { fontSize: '0.85rem', color: '#A9B7C6' },
          },
        }}
      >
        <MenuItem onClick={() => { setSettingsAnchor(null); onLoadGroup?.(); }}>
          <ListItemIcon><FolderOpenIcon sx={{ fontSize: 18, color: '#7CB368' }} /></ListItemIcon>
          Open Saved Group
        </MenuItem>
        <Divider sx={{ borderColor: '#3C3F41' }} />
        <MenuItem onClick={() => { setSettingsAnchor(null); onManageProjects?.(); }}>
          <ListItemIcon><SmartToyIcon sx={{ fontSize: 18, color: '#6897BB' }} /></ListItemIcon>
          AI Instances
        </MenuItem>
        <MenuItem onClick={() => { setSettingsAnchor(null); onManageTerminals?.(); }}>
          <ListItemIcon><TerminalIcon sx={{ fontSize: 18, color: '#808080' }} /></ListItemIcon>
          Terminal Instances
        </MenuItem>
        <MenuItem onClick={() => { setSettingsAnchor(null); onManageObservers?.(); }}>
          <ListItemIcon><ArrowFatLinesUp size={18} weight="bold" color="#B07ACC" /></ListItemIcon>
          Observer Instances
        </MenuItem>
        <MenuItem onClick={() => { setSettingsAnchor(null); onManageKeePass?.(); }}>
          <ListItemIcon><KeyIcon sx={{ fontSize: 18, color: '#CC7832' }} /></ListItemIcon>
          KeePass Credentials
        </MenuItem>
        <MenuItem onClick={() => { setSettingsAnchor(null); onManageLaunchFlags?.(); }}>
          <ListItemIcon><TuneIcon sx={{ fontSize: 18, color: '#6897BB' }} /></ListItemIcon>
          Launch Flags
        </MenuItem>
        <Divider sx={{ borderColor: '#3C3F41' }} />
        <MenuItem onClick={() => { setSettingsAnchor(null); onManagePlans?.(); }}>
          <ListItemIcon><ArticleIcon sx={{ fontSize: 18, color: '#CC7832' }} /></ListItemIcon>
          Plans
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TitleBar;
