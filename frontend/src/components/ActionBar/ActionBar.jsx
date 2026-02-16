import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

const ActionBar = ({ onSaveGroup, onRunGroup, onStopGroup, showSave, showRun, showStop }) => {
  if (!showSave && !showRun && !showStop) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: '#1A1A1A',
        borderTop: '1px solid #3C3F41',
        borderBottom: '1px solid #3C3F41',
      }}
    >
      {showRun && (
        <Button
          size="small"
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={onRunGroup}
          sx={{
            bgcolor: '#579945',
            '&:hover': { bgcolor: '#68AD55' },
            textTransform: 'none',
            fontSize: '0.8rem',
          }}
        >
          Run Group
        </Button>
      )}

      {showStop && (
        <Button
          size="small"
          variant="contained"
          startIcon={<StopIcon />}
          onClick={onStopGroup}
          sx={{
            bgcolor: '#BC3F3C',
            '&:hover': { bgcolor: '#D45B58' },
            textTransform: 'none',
            fontSize: '0.8rem',
          }}
        >
          Stop Group
        </Button>
      )}

      {showSave && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={onSaveGroup}
          sx={{
            borderColor: '#4E5254',
            color: '#808080',
            '&:hover': { borderColor: '#6897BB', color: '#A9B7C6' },
            textTransform: 'none',
            fontSize: '0.8rem',
          }}
        >
          Save Group
        </Button>
      )}
    </Box>
  );
};

export default ActionBar;
