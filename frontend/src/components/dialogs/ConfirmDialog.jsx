import {
  Box, Dialog, DialogActions, DialogContent, Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

// Confirmation for stopping, deleting and removing, in the dashboard's dark style. The safe
// choice sits first and gets the focus; the confirming one is red, since every use deletes.
const buttonSx = {
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
  minWidth: 96,
  px: 2,
  height: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  '&:focus-visible': { outline: '2px solid #6897BB', outlineOffset: 2 },
};

const ConfirmDialog = ({
  title,
  text,
  open,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
}) => (
  <Dialog
    open={open}
    onClose={() => onClose()}
    aria-labelledby="confirm-dialog-text"
    fullWidth
    maxWidth="xs"
    PaperProps={{
      sx: {
        bgcolor: '#313335',
        backgroundImage: 'none',
        border: '1px solid #3C3F41',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      },
    }}
  >
    <DialogContent sx={{
      display: 'flex', gap: 1.5, pt: 2.5, pb: 1.5,
    }}
    >
      <WarningAmberRoundedIcon sx={{
        fontSize: 22, color: '#CC7832', mt: '1px', flexShrink: 0,
      }}
      />
      <Box sx={{ minWidth: 0 }}>
        {title && (
        <Typography sx={{
          fontSize: '0.95rem', fontWeight: 600, color: '#D6DCE3', mb: 0.5,
        }}
        >
          {title}
        </Typography>
        )}
        <Typography
          id="confirm-dialog-text"
          sx={{
            fontSize: '0.88rem', color: '#BBC4CF', lineHeight: 1.5, overflowWrap: 'anywhere',
          }}
        >
          {text}
        </Typography>
      </Box>
    </DialogContent>
    <DialogActions sx={{
      px: 2.5, pb: 2, pt: 0.5, gap: 1,
    }}
    >
      <Box
        component="button"
        type="button"
        autoFocus
        onClick={() => onClose()}
        sx={{
          ...buttonSx,
          color: '#A9B7C6',
          border: '1px solid #4E5254',
          '&:hover': { borderColor: '#6897BB', color: '#FFFFFF' },
        }}
      >
        Cancel
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => {
          onClose(true);
          onConfirm();
        }}
        sx={{
          ...buttonSx,
          color: '#FFFFFF',
          bgcolor: '#BC3F3C',
          '&:hover': { bgcolor: '#D45B58' },
        }}
      >
        {confirmLabel}
      </Box>
    </DialogActions>
  </Dialog>
);
export default ConfirmDialog;
