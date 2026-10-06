import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';

import { CheckIcon, ContentCopyIcon } from '@/components/Icons/Icons';
import { copyText } from '@/helpers/clipboard';

// "Copy" for a whole plan or message (its Markdown). When the browser refuses, onFail lets
// the caller select the text instead, so it can be copied with the device's own menu.
const CopyAllButton = ({ text, onFail, label = 'Copy' }) => {
  const [state, setState] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async e => {
    const ok = await copyText(text || '', e.currentTarget);
    setState(ok ? 'copied' : 'failed');
    if (!ok) onFail?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), ok ? 1500 : 4000);
  };

  const caption = { idle: label, copied: 'Copied', failed: 'Text selected — use Copy' }[state];

  return (
    <Box
      component="button"
      type="button"
      onClick={handleClick}
      title="Copy the whole text as Markdown"
      aria-live="polite"
      sx={{
        all: 'unset',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        height: 28,
        borderRadius: '6px',
        border: '1px solid #4E5254',
        fontSize: '0.78rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: state === 'copied' ? '#7CB368' : (state === 'failed' ? '#CC7832' : '#A9B7C6'),
        '&:hover': { borderColor: '#6897BB', color: '#FFFFFF' },
        '&:focus-visible': { outline: '2px solid #6897BB', outlineOffset: 1 },
      }}
    >
      {state === 'copied' ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
      {caption}
    </Box>
  );
};

export default CopyAllButton;
