import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArticleIcon from '@mui/icons-material/Article';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import Divider from '@mui/material/Divider';

const TitleBar = ({
  onNewGroup, onAddClaude, onAddTerminal, onLoadGroup, onManageProjects, onManageTerminals, onManagePlans,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        bgcolor: '#1A1A1A',
        borderBottom: '1px solid #3C3F41',
        minHeight: 48,
      }}
    >
      <HexagonOutlinedIcon sx={{ color: '#6897BB', mr: 1, fontSize: 24 }} />
      <Typography
        variant="h6"
        sx={{
          color: '#A9B7C6',
          fontWeight: 600,
          fontSize: '1rem',
          mr: 3,
        }}
      >
        Claude IDE
      </Typography>

      <Button
        size="small"
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onNewGroup}
        sx={{
          bgcolor: '#579945',
          '&:hover': { bgcolor: '#68AD55' },
          textTransform: 'none',
          fontSize: '0.8rem',
          px: 1.5,
          py: 0.5,
        }}
      >
        New Group
      </Button>

      <Button
        size="small"
        variant="outlined"
        startIcon={<SmartToyIcon sx={{ fontSize: 16 }} />}
        onClick={onAddClaude}
        sx={{
          ml: 1.5,
          borderColor: '#4E5254',
          color: '#A9B7C6',
          '&:hover': { borderColor: '#6897BB', bgcolor: '#313335' },
          textTransform: 'none',
          fontSize: '0.8rem',
          px: 1.5,
          py: 0.5,
        }}
      >
        Add Claude
      </Button>

      <Button
        size="small"
        variant="outlined"
        startIcon={<TerminalIcon sx={{ fontSize: 16 }} />}
        onClick={onAddTerminal}
        sx={{
          ml: 1,
          borderColor: '#4E5254',
          color: '#A9B7C6',
          '&:hover': { borderColor: '#6897BB', bgcolor: '#313335' },
          textTransform: 'none',
          fontSize: '0.8rem',
          px: 1.5,
          py: 0.5,
        }}
      >
        Add Terminal
      </Button>

      <Box sx={{ flex: 1 }} />

      <IconButton
        size="small"
        onClick={e => setAnchorEl(e.currentTarget)}
        sx={{ color: '#808080' }}
      >
        <SettingsIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            '& .MuiMenuItem-root': { fontSize: '0.85rem', color: '#A9B7C6' },
          },
        }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); onLoadGroup?.(); }}>
          <ListItemIcon><FolderOpenIcon sx={{ fontSize: 18, color: '#7CB368' }} /></ListItemIcon>
          Open Saved Group
        </MenuItem>
        <Divider sx={{ borderColor: '#3C3F41' }} />
        <MenuItem onClick={() => { setAnchorEl(null); onManageProjects?.(); }}>
          <ListItemIcon><SmartToyIcon sx={{ fontSize: 18, color: '#6897BB' }} /></ListItemIcon>
          Claude Projects
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onManageTerminals?.(); }}>
          <ListItemIcon><TerminalIcon sx={{ fontSize: 18, color: '#808080' }} /></ListItemIcon>
          Terminal Configs
        </MenuItem>
        <Divider sx={{ borderColor: '#3C3F41' }} />
        <MenuItem onClick={() => { setAnchorEl(null); onManagePlans?.(); }}>
          <ListItemIcon><ArticleIcon sx={{ fontSize: 18, color: '#CC7832' }} /></ListItemIcon>
          Plans
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TitleBar;
