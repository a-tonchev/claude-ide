import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeIcon from '@mui/icons-material/Code';
import ArticleIcon from '@mui/icons-material/Article';

import UrlEnums from '@/components/connections/enums/UrlEnums';
import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';

const PlanViewerDialog = ({ open, onClose, plan }) => {
  const [viewMode, setViewMode] = useState('rendered');

  if (!plan) return null;

  const handleOpenInWindow = () => {
    if (!plan.id) return;
    const url = UrlEnums.PLAN_VIEW.replace(':planId', plan.id);
    window.open(url, `plan_${plan.id}`, 'width=900,height=700');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#2B2B2B',
          color: '#A9B7C6',
          border: '1px solid #4E5254',
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #3C3F41', py: 1.5 }}>
        <Box sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plan.title || 'Untitled Plan'}
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="rendered" sx={{ py: 0.25, px: 1, color: '#808080', borderColor: '#4E5254', '&.Mui-selected': { color: '#6897BB', bgcolor: '#3C3F41' } }}>
            <ArticleIcon sx={{ fontSize: 14, mr: 0.5 }} /> MD
          </ToggleButton>
          <ToggleButton value="code" sx={{ py: 0.25, px: 1, color: '#808080', borderColor: '#4E5254', '&.Mui-selected': { color: '#6897BB', bgcolor: '#3C3F41' } }}>
            <CodeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Code
          </ToggleButton>
        </ToggleButtonGroup>
        {plan.id && (
          <IconButton size="small" onClick={handleOpenInWindow} title="Open in new window" sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: '#808080' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ py: 2, px: 3 }}>
        {viewMode === 'rendered' ? (
          <MarkdownRenderer content={plan.content} fontSize="0.85rem" />
        ) : (
          <Box
            component="pre"
            sx={{
              color: '#A9B7C6',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              fontFamily: '"JetBrains Mono", monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {plan.content || 'No content available.'}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlanViewerDialog;
