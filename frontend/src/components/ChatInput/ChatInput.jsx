import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

import { AttachButton, AttachmentChips, takePastedFiles } from '@/components/Attachments/Attachments';
import useMobile from '@/components/layout/hooks/useMobile';

// What is sent when a message has files but no text
const ATTACHMENTS_ONLY_TEXT = 'See the attached files.';

// The chat input of an AI card: text, 📎 and pasted files (as chips above it), send button.
// `attachments` comes from useAttachments in the card, so files dropped anywhere on the card
// land here too. onSend(data, attachmentIds) gets the text with its trailing \r.
const ChatInput = ({
  value, onChange, onSend, disabled, maxRows = 8, attachments,
}) => {
  const { isMobile } = useMobile();
  const hasText = !!value.trim();
  const canSend = !disabled && !attachments.uploading && (hasText || attachments.ids.length > 0);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(`${hasText ? value : ATTACHMENTS_ONLY_TEXT}\r`, attachments.ids);
    attachments.clear();
  }, [canSend, hasText, value, onSend, attachments]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isMobile]);

  return (
    <Box sx={{
      px: 1, py: 0.5, borderBottom: '1px solid #3C3F41', flexShrink: 0,
    }}
    >
      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />
      <Box sx={{ position: 'relative' }}>
        <TextField
          fullWidth
          multiline
          maxRows={maxRows}
          size="small"
          placeholder="Type a message..."
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onPaste={attachments.enabled ? e => takePastedFiles(e, attachments.addFiles) : undefined}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              bgcolor: '#2B2B2B',
              color: '#A9B7C6',
              borderRadius: '24px',
              pr: '40px',
              pl: attachments.enabled ? '32px' : undefined,
              minHeight: 40,
              '& fieldset': { borderColor: '#3C3F41' },
              '&:hover fieldset': { borderColor: '#6897BB' },
              '&.Mui-focused fieldset': { borderColor: '#6897BB' },
            },
            '& .MuiOutlinedInput-input': {
              py: 1,
              px: 1.5,
              pl: attachments.enabled ? 0.75 : 1.5,
            },
          }}
        />
        {attachments.enabled && (
          <Box sx={{
            position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          }}
          >
            <AttachButton onFiles={attachments.addFiles} disabled={disabled} />
          </Box>
        )}
        <IconButton
          size="small"
          onClick={handleSend}
          disabled={!canSend}
          title={attachments.uploading ? 'Waiting for uploads…' : 'Send'}
          sx={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 28,
            bgcolor: canSend ? '#6897BB' : 'transparent',
            color: canSend ? '#fff' : '#4E5254',
            '&:hover': { bgcolor: canSend ? '#89B8DE' : 'rgba(104,151,187,0.15)' },
            '&.Mui-disabled': { color: '#4E5254', bgcolor: 'transparent' },
          }}
        >
          <ArrowUpwardIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatInput;
