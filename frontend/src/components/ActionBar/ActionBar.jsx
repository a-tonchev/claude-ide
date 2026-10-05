import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

// The active group's Run / Stop / Save actions as small icons: in the group tab row on
// desktop, next to the group picker on mobile. Stop is muted on purpose and still confirms.
const ActionBar = ({
  onSaveGroup, onRunGroup, onStopGroup, showSave, showRun, showStop, isUpdate,
}) => {
  if (!showSave && !showRun && !showStop) return null;

  const saveLabel = isUpdate ? 'Update group' : 'Save group';

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, mx: 0.5,
    }}
    >
      {showRun && (
        <Tooltip title="Run group">
          <IconButton
            size="small"
            onClick={onRunGroup}
            aria-label="Run group"
            sx={{ color: '#7CB368', '&:hover': { color: '#8FD47A', bgcolor: 'rgba(124,179,104,0.12)' } }}
          >
            <PlayArrowIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {showStop && (
        <Tooltip title="Stop group">
          <IconButton
            size="small"
            onClick={onStopGroup}
            aria-label="Stop group"
            sx={{
              color: '#606366',
              '&:hover, &:active': { color: '#BC3F3C', bgcolor: 'rgba(188,63,60,0.12)' },
            }}
          >
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {showSave && (
        <Tooltip title={saveLabel}>
          <IconButton
            size="small"
            onClick={onSaveGroup}
            aria-label={saveLabel}
            sx={{
              // Unsaved changes in a saved group stand out a little
              color: isUpdate ? '#6897BB' : '#808080',
              '&:hover': { color: '#A9B7C6', bgcolor: 'rgba(104,151,187,0.12)' },
            }}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default ActionBar;
