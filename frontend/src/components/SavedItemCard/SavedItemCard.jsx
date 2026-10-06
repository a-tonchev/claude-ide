import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { DeleteIcon, PlayArrowIcon } from '@/components/Icons/Icons';
import { CARD_COLORS, HeaderMeta, cardSx } from '@/components/CardParts/CardParts';

const SavedItemCard = ({
  item, onStart, onRemove, launchFlags = [], onToggleFlag, onProviderChange, error,
}) => {
  const isClaude = item.type === 'claude';
  const provider = item.provider || 'claude';
  const activeFlagIds = item.flagIds || [];

  return (
    <Card sx={{
      ...cardSx(),
      maxHeight: 'none',
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: '#6897BB' },
    }}
    >
      {/* Header: a stopped card is "Saved"; its name is muted until it runs */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.6,
        borderBottom: `1px solid ${CARD_COLORS.border}`,
      }}
      >
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          flexShrink: 0,
          color: '#6A6E73',
          fontSize: '0.72rem',
          fontWeight: 600,
        }}
        >
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', bgcolor: '#6A6E73',
          }}
          />
        </Box>
        <Typography
          sx={{
            fontSize: '0.84rem',
            color: '#9BA3AD',
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Typography>
        <HeaderMeta>{isClaude ? 'AI' : 'Terminal'}</HeaderMeta>
      </Box>

      {/* Details */}
      <Box sx={{ px: 1.5, py: 0.75 }}>
        {isClaude && item.path && (
          <Typography sx={{
            fontSize: '0.65rem', color: '#606366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          >
            {item.path}
          </Typography>
        )}
        {!isClaude && (
          <Typography sx={{ fontSize: '0.65rem', color: '#606366' }}>
              {item.shell}{item.command ? ` — ${item.command}` : ''}
          </Typography>
        )}
      </Box>

      {/* The last Start of this card failed right away (e.g. a bad launch flag) */}
      {error && (
        <Typography
          role="alert"
          sx={{
            px: 1.5, pb: 0.75, fontSize: '0.7rem', color: '#BC3F3C', lineHeight: 1.4,
          }}
        >
          Last start failed: {error}
        </Typography>
      )}

      {/* Actions */}
      {isClaude && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={provider}
          onChange={(event, value) => { if (value) onProviderChange?.(item, value); }}
          aria-label={`AI provider for ${item.name}`}
          sx={{
            mx: 1.5,
            mb: 1,
            '& .MuiToggleButton-root': {
              color: '#808080', fontSize: '0.7rem', py: 0.25, px: 1.5, textTransform: 'none',
            },
            '& .MuiToggleButton-root.Mui-selected': { color: '#A9B7C6', bgcolor: '#21428355' },
          }}
        >
          <ToggleButton value="claude">Claude</ToggleButton>
          <ToggleButton value="codex">Codex</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderTop: '1px solid #3C3F41',
      }}
      >
        <IconButton
          size="small"
          onClick={() => onStart(item)}
          title={isClaude ? `Start ${provider === 'codex' ? 'Codex' : 'Claude'}` : 'Start'}
          aria-label={isClaude ? `Start ${provider === 'codex' ? 'Codex' : 'Claude'}` : 'Start'}
          sx={{ color: '#7CB368', '&:hover': { color: '#8FD47A' } }}
        >
          <PlayArrowIcon sx={{ fontSize: 18 }} />
        </IconButton>
        {/* Launch flag toggles — persisted on the saved item, applied on Start */}
        {isClaude && provider === 'claude' && launchFlags.length > 0 && (
          <Box sx={{
            display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 0.5, minWidth: 0,
          }}
          >
            {launchFlags.map(flag => {
              const active = activeFlagIds.includes(flag._id);
              const state = `${active ? 'On' : 'Off'} for this card (saved, used on every Start)`;
              return (
                <Tooltip key={flag._id} title={flag.args ? `${flag.args} · ${state}` : state} arrow>
                  <Chip
                    size="small"
                    label={flag.name}
                    clickable
                    onClick={() => onToggleFlag?.(item, flag._id)}
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      bgcolor: active ? '#21428355' : 'transparent',
                      color: active ? '#6897BB' : '#606366',
                      border: `1px solid ${active ? '#6897BB' : '#4E5254'}`,
                      '&:hover': { bgcolor: active ? '#21428377' : '#3C3F41' },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        )}
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
