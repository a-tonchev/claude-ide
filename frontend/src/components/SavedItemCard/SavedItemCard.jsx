import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import TerminalIcon from '@mui/icons-material/Terminal';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const SavedItemCard = ({ item, onStart, onRemove }) => {
  const isClaude = item.type === 'claude';

  return (
    <Card
      sx={{
        bgcolor: '#2B2B2B',
        border: '1px dashed #4E5254',
        borderRadius: 2,
        overflow: 'hidden',
        opacity: 0.7,
        '&:hover': { opacity: 1, borderColor: '#6897BB' },
        transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #3C3F41' }}>
        {isClaude
          ? <SmartToyIcon sx={{ fontSize: 14, color: '#606366' }} />
          : <TerminalIcon sx={{ fontSize: 14, color: '#606366' }} />}
        <Chip
          size="small"
          label={isClaude ? 'Claude' : 'Terminal'}
          sx={{
            height: 18,
            fontSize: '0.6rem',
            bgcolor: isClaude ? '#21428322' : '#4E5254',
            color: isClaude ? '#6897BB' : '#808080',
          }}
        />
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: '#808080',
            fontWeight: 600,
            flex: 1,
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Typography>
      </Box>

      {/* Details */}
      <Box sx={{ px: 1.5, py: 0.75 }}>
        {isClaude && item.path && (
          <Typography sx={{ fontSize: '0.65rem', color: '#606366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.path}
          </Typography>
        )}
        {!isClaude && (
          <>
            <Typography sx={{ fontSize: '0.65rem', color: '#606366' }}>
              {item.shell}{item.command ? ` — ${item.command}` : ''}
            </Typography>
          </>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderTop: '1px solid #3C3F41' }}>
        <IconButton
          size="small"
          onClick={() => onStart(item)}
          title="Start"
          sx={{ color: '#7CB368', '&:hover': { color: '#8FD47A' } }}
        >
          <PlayArrowIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          onClick={() => onRemove(item)}
          title="Remove from group"
          sx={{ color: '#606366', '&:hover': { color: '#BC3F3C' } }}
        >
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    </Card>
  );
};

export default SavedItemCard;
