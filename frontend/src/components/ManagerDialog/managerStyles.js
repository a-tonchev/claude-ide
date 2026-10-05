// Shared, compact look for the app's dialogs (Add AI / Terminal / Observer, Open Saved Group,
// the directory browser and the settings managers). Applied to the dialog paper, so each dialog
// keeps its own structure and logic.
export const dialogPaperSx = {
  bgcolor: '#313335',
  backgroundImage: 'none',
  border: '1px solid #3C3F41',
  borderRadius: '8px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  // Phones: nearly the whole screen, small margins
  '@media (max-width: 600px)': {
    m: 1,
    width: 'calc(100% - 16px)',
    maxHeight: 'calc(100% - 16px)',
  },

  '& .MuiDialogTitle-root': {
    px: 2,
    py: 1.25,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#D6DCE3',
    borderBottom: '1px solid #3C3F41',
  },
  '& .MuiDialogContent-root': {
    px: 2,
    pt: '12px !important',
    pb: 1,
  },
  '& .MuiInputBase-root': { fontSize: '0.82rem' },
  '& .MuiInputBase-inputSizeSmall': { py: '7px' },
  '& .MuiInputLabel-root': { fontSize: '0.82rem' },
  '& .MuiButton-root': { textTransform: 'none', fontSize: '0.8rem', borderRadius: '6px' },

  // The saved entries: compact rows divided by hairlines
  '& .MuiList-root': { mx: 0, py: 0 },
  '& .MuiListItem-root': {
    borderRadius: 0,
    mb: 0,
    py: 0.5,
    pl: 1,
    borderBottom: '1px solid #3A3D40',
    '&:last-of-type': { borderBottom: 'none' },
    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
  },
  // Pickable rows (Add AI, Add Observer, Open Saved Group, directory browser)
  '& .MuiListItemButton-root': {
    py: 0.5,
    px: 1,
    borderRadius: '6px',
    '&.Mui-selected': { bgcolor: 'rgba(104,151,187,0.18)' },
  },
  '& .MuiListItemIcon-root': { minWidth: 32 },
  '& .MuiListItemIcon-root .MuiSvgIcon-root': { fontSize: 18 },
  '& .MuiListItemText-root': { my: 0.25 },
  '& .MuiListItemText-primary': { fontSize: '0.86rem !important', color: '#D6DCE3 !important' },
  '& .MuiListItemText-secondary': {
    fontSize: '0.72rem !important',
    color: '#7A7E83 !important',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .MuiListItemSecondaryAction-root .MuiIconButton-root': { p: 0.5 },
  '& .MuiListItemSecondaryAction-root .MuiSvgIcon-root': { fontSize: '17px !important' },

  '& .MuiDialogActions-root': {
    px: 2,
    py: 1,
    borderTop: '1px solid #3C3F41',
  },
};

// The settings managers (AI Instances, Terminal Instances, Observer Instances, KeePass
// Credentials, Launch Flags) also style their add/edit form at the top
export const managerPaperSx = {
  ...dialogPaperSx,
  // The add/edit form at the top
  '& .MuiDialogContent-root > .MuiBox-root:first-of-type': {
    p: 1.25,
    mt: 0,
    mb: 1.25,
    gap: 0.75,
    borderRadius: '8px',
    bgcolor: '#2B2B2B',
    border: '1px solid #3C3F41',
  },
};

export default managerPaperSx;
