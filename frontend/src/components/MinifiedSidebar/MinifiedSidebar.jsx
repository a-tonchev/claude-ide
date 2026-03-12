import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TvIcon from '@mui/icons-material/Tv';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ArrowsOut } from '@phosphor-icons/react';
import MonitorIcon from '@mui/icons-material/Monitor';

const MinifiedSidebar = ({
  instances, onRestore, onOpenPlaceholder,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);

  if (!instances || instances.length === 0) return null;

  const handleClick = (event, instance) => {
    setSelectedInstance(instance);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedInstance(null);
  };

  const isRunning = inst => inst.status !== 'exited';

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          py: 1,
          px: 0.5,
          bgcolor: '#1A1A1A',
          borderLeft: '1px solid #3C3F41',
          width: 40,
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {instances.map(inst => (
          <Tooltip
            key={inst.id}
            title={inst.projectName || inst.name || 'Instance'}
            placement="left"
            arrow
          >
            <IconButton
              size="small"
              onClick={e => handleClick(e, inst)}
              sx={{
                width: 30,
                height: 30,
                color: isRunning(inst) ? (inst.type === 'terminal' ? '#7CB368' : '#CC7832') : '#606366',
                '&:hover': { bgcolor: '#3C3F41' },
              }}
            >
              {inst.type === 'terminal'
                ? <MonitorIcon sx={{ fontSize: 18 }} />
                : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            borderRadius: 1.5,
            minWidth: 180,
            maxWidth: 260,
          },
        }}
      >
        {selectedInstance && (
          <Box sx={{ p: 1.5 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, mb: 1,
            }}
            >
              <FiberManualRecordIcon sx={{
                fontSize: 10,
                color: isRunning(selectedInstance) ? '#7CB368' : '#606366',
              }}
              />
              {selectedInstance.type === 'terminal'
                ? <MonitorIcon sx={{ fontSize: 16, color: '#808080' }} />
                : <AutoAwesomeIcon sx={{ fontSize: 16, color: '#CC7832' }} />}
              <Typography sx={{
                fontSize: '0.8rem',
                color: '#A9B7C6',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              >
                {selectedInstance.projectName || selectedInstance.name || 'Instance'}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: '#4E5254', my: 0.75 }} />
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Restore" placement="bottom">
                <IconButton
                  size="small"
                  onClick={() => { onRestore(selectedInstance.id); handleClose(); }}
                  sx={{ color: '#808080', '&:hover': { bgcolor: '#3C3F41', color: '#6897BB' } }}
                >
                  <ArrowsOut size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open in placeholder" placement="bottom">
                <IconButton
                  size="small"
                  onClick={() => { onOpenPlaceholder(selectedInstance.id); handleClose(); }}
                  sx={{ color: '#808080', '&:hover': { bgcolor: '#3C3F41', color: '#6897BB' } }}
                >
                  <TvIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default MinifiedSidebar;
