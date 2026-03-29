import { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import useMobile from '@/components/layout/hooks/useMobile';

const InputBar = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const { isMobile } = useMobile();

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (onSend) onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isMobile]);

  return (
    <Box sx={{
      px: 2,
      py: 1,
      borderTop: '1px solid #3C3F41',
      bgcolor: '#1A1A1A',
      position: 'relative',
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
            fontSize: '0.9rem',
            color: '#A9B7C6',
            borderRadius: '24px',
            pr: '44px',
            minHeight: 48,
            '& fieldset': { borderColor: '#4E5254' },
            '&:hover fieldset': { borderColor: '#6897BB' },
            '&.Mui-focused fieldset': { borderColor: '#6897BB' },
          },
          '& .MuiOutlinedInput-input': {
            py: 1.25,
            px: 2,
          },
          '& .MuiInputBase-input::placeholder': {
            color: '#606366',
            opacity: 1,
          },
        }}
      />
      <IconButton
        size="small"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        sx={{
          position: 'absolute',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 32,
          height: 32,
          bgcolor: value.trim() ? '#6897BB' : 'transparent',
          color: value.trim() ? '#fff' : '#4E5254',
          '&:hover': { bgcolor: value.trim() ? '#89B8DE' : 'rgba(104,151,187,0.15)' },
          '&.Mui-disabled': { color: '#4E5254', bgcolor: 'transparent' },
        }}
      >
        <ArrowUpwardIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default InputBar;
