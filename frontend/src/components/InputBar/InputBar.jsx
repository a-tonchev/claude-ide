import { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const InputBar = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (onSend) onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 2,
      py: 1,
      borderTop: '1px solid #3C3F41',
      bgcolor: '#1A1A1A',
    }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder="Type a message..."
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        multiline
        maxRows={4}
        slotProps={{ htmlInput: { onKeyDown: handleKeyDown } }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: '#2B2B2B',
            fontFamily: '"JetBrains Mono", "Consolas", "Courier New", monospace',
            fontSize: 13,
            color: '#A9B7C6',
            '& fieldset': { borderColor: '#4E5254' },
            '&:hover fieldset': { borderColor: '#6897BB' },
            '&.Mui-focused fieldset': { borderColor: '#6897BB' },
          },
          '& .MuiInputBase-input::placeholder': {
            color: '#606366',
            opacity: 1,
          },
        }}
      />
      <Tooltip title="Send (Enter)">
        <span>
          <IconButton
            size="small"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            sx={{
              color: '#6897BB',
              bgcolor: 'rgba(104,151,187,0.15)',
              borderRadius: 2,
              px: 1,
              py: 1,
              '&:hover': { bgcolor: 'rgba(104,151,187,0.25)' },
              '&.Mui-disabled': { color: '#4E5254', bgcolor: 'transparent' },
            }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

export default InputBar;
