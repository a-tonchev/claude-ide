import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';

import { CheckIcon, CloseIcon, EditIcon } from '@/components/Icons/Icons';

// Card title with a pencil icon: click to edit inline, Enter/blur/✓ saves,
// Escape/✕ cancels. Saving an unchanged or empty value is a no-op.
const EditableTitle = ({
  title,
  onRename,
  icon = null,
  fontSize = '0.8rem',
  color = '#A9B7C6',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = useCallback(() => {
    setDraft(title || '');
    setEditing(true);
  }, [title]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
  }, [draft, title, onRename]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  }, [commit]);

  // The buttons keep the input focused on press, so its blur doesn't save before ✕ cancels
  const keepFocus = e => e.preventDefault();

  if (editing) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.25, flex: 1, minWidth: 0,
      }}
      >
        <InputBase
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          inputProps={{ maxLength: 120 }}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize,
            fontWeight: 600,
            color,
            bgcolor: '#2B2B2B',
            border: '1px solid #6897BB',
            borderRadius: 1,
            px: 0.75,
            py: 0,
            '& .MuiInputBase-input': { p: 0 },
          }}
        />
        <IconButton
          size="small"
          onMouseDown={keepFocus}
          onClick={commit}
          title="Save title"
          aria-label="Save title"
          sx={{ p: 0.25, flexShrink: 0, color: '#7CB368' }}
        >
          <CheckIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={keepFocus}
          onClick={() => setEditing(false)}
          title="Cancel"
          aria-label="Cancel renaming"
          sx={{ p: 0.25, flexShrink: 0, color: '#808080' }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 48,
    }}
    >
      {icon}
      <Typography
        sx={{
          fontSize,
          color,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {title}
      </Typography>
      <IconButton
        size="small"
        onClick={startEdit}
        title="Edit title"
        sx={{
          p: 0.25, flexShrink: 0, color: '#808080', '&:hover': { color: '#6897BB' },
        }}
      >
        <EditIcon sx={{ fontSize: 13 }} />
      </IconButton>
    </Box>
  );
};

export default React.memo(EditableTitle);
