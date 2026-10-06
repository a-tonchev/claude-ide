import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

import {
  ArrowsOutIcon as ArrowsOut,
  AutoAwesomeIcon,
  FiberManualRecordIcon,
  MonitorIcon,
  TvIcon,
} from '@/components/Icons/Icons';

// The minimized cards as icons; a click offers Restore (and Open in placeholder when given).
// variant "row": a titled row with a count, for the bottom of the mobile card list.
const MinifiedSidebar = ({
  instances, onRestore, onOpenPlaceholder, variant = 'sidebar',
}) => {
  const isRow = variant === 'row';
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
      {isRow && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5,
        }}
        >
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#808080' }}>
            Minified
          </Typography>
          <Box sx={{
            minWidth: 18,
            height: 18,
            px: 0.5,
            borderRadius: 9,
            bgcolor: '#579945',
            color: '#fff',
            fontSize: '0.68rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          >
            {instances.length}
          </Box>
        </Box>
      )}
      <Box
        sx={isRow ? {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          px: 1.5,
          py: 1,
        } : {
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
            title={inst.title || inst.projectName || inst.name || 'Instance'}
            placement={isRow ? 'top' : 'left'}
            arrow
          >
            <IconButton
              size="small"
              onClick={e => handleClick(e, inst)}
              sx={{
                width: isRow ? 40 : 30,
                height: isRow ? 40 : 30,
                ...(isRow && { border: '1px solid #3C3F41', borderRadius: 1.5 }),
                color: isRunning(inst) ? (inst.type === 'terminal' ? '#7CB368' : '#CC7832') : '#606366',
                '&:hover': { bgcolor: '#3C3F41' },
              }}
            >
              {inst.type === 'terminal'
                ? <MonitorIcon sx={{ fontSize: isRow ? 22 : 18 }} />
                : <AutoAwesomeIcon sx={{ fontSize: isRow ? 22 : 18 }} />}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={isRow ? { vertical: 'top', horizontal: 'center' } : { vertical: 'center', horizontal: 'left' }}
        transformOrigin={isRow
          ? { vertical: 'bottom', horizontal: 'center' }
          : { vertical: 'center', horizontal: 'right' }}
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
                {selectedInstance.title || selectedInstance.projectName || selectedInstance.name || 'Instance'}
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
              {onOpenPlaceholder && (
                <Tooltip title="Open in placeholder" placement="bottom">
                  <IconButton
                    size="small"
                    onClick={() => { onOpenPlaceholder(selectedInstance.id); handleClose(); }}
                    sx={{ color: '#808080', '&:hover': { bgcolor: '#3C3F41', color: '#6897BB' } }}
                  >
                    <TvIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default MinifiedSidebar;
