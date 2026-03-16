import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ArticleIcon from '@mui/icons-material/Article';
import CodeIcon from '@mui/icons-material/Code';
import SaveIcon from '@mui/icons-material/Save';

import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';
import Connections, { ApiEndpoints } from '@/components/connections/Connections';

const InstructionsDialog = ({ open, onClose, observerId, observerName }) => {
  const [viewMode, setViewMode] = useState('rendered');
  const [editing, setEditing] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !observerId) return;
    setLoading(true);
    setEditing(false);
    Connections.postRequest('/observers/getInstructions', { observerId })
      .then(result => {
        if (result?.ok) {
          setInstructions(result.data.instructions || '');
        }
      })
      .finally(() => setLoading(false));
  }, [open, observerId]);

  const handleEdit = useCallback(() => {
    setEditText(instructions);
    setEditing(true);
  }, [instructions]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Connections.postRequest('/observers/setInstructions', {
        observerId,
        instructions: editText,
      });
      setInstructions(editText);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [observerId, editText]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

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
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #3C3F41', py: 1.5,
      }}
      >
        <Box sx={{
          flex: 1,
          fontSize: '0.95rem',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        >
          {observerName || 'Observer'} — Instructions
        </Box>
        {!editing && (
          <>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, val) => val && setViewMode(val)}
              size="small"
            >
              <ToggleButton
                value="rendered"
                sx={{
                  py: 0.25, px: 1, color: '#808080', borderColor: '#4E5254',
                  '&.Mui-selected': { color: '#6897BB', bgcolor: '#3C3F41' },
                }}
              >
                <ArticleIcon sx={{ fontSize: 14, mr: 0.5 }} /> MD
              </ToggleButton>
              <ToggleButton
                value="code"
                sx={{
                  py: 0.25, px: 1, color: '#808080', borderColor: '#4E5254',
                  '&.Mui-selected': { color: '#6897BB', bgcolor: '#3C3F41' },
                }}
              >
                <CodeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Code
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton
              size="small"
              onClick={handleEdit}
              title="Edit instructions"
              sx={{ color: '#808080', '&:hover': { color: '#CC7832' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: '#808080' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ py: 2, px: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#6897BB' }} />
          </Box>
        ) : editing ? (
          <TextField
            fullWidth
            multiline
            minRows={15}
            maxRows={30}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.8rem',
                fontFamily: '"JetBrains Mono", monospace',
                color: '#A9B7C6',
                bgcolor: '#1A1A1A',
                '& fieldset': { borderColor: '#3C3F41' },
                '&:hover fieldset': { borderColor: '#6897BB' },
                '&.Mui-focused fieldset': { borderColor: '#6897BB' },
              },
            }}
          />
        ) : viewMode === 'rendered' ? (
          instructions ? (
            <MarkdownRenderer content={instructions} fontSize="0.85rem" />
          ) : (
            <Box sx={{ color: '#808080', fontStyle: 'italic', py: 4, textAlign: 'center' }}>
              No instructions yet. The observer will ask for SSH credentials on first startup.
            </Box>
          )
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
            {instructions || 'No instructions yet.'}
          </Box>
        )}
      </DialogContent>
      {editing && (
        <DialogActions sx={{ px: 3, pb: 2, borderTop: '1px solid #3C3F41' }}>
          <Button
            onClick={handleCancel}
            sx={{ color: '#808080', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: '#579945',
              textTransform: 'none',
              '&:hover': { bgcolor: '#68AD55' },
            }}
          >
            Save
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default InstructionsDialog;
