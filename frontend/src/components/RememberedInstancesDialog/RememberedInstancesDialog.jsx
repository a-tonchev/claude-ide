import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  BookmarkRemoveOutlinedIcon,
  ChatIcon,
  DeleteOutlineIcon,
  ExpandLessIcon,
  ExpandMoreIcon,
  PersonIcon,
  PlayArrowIcon,
  SmartToyIcon,
} from '@/components/Icons/Icons';
import useConfirm from '@/components/dialogs/hooks/useConfirm';
import { fetchFeedPage } from '@/hooks/useInstanceFeed';
import { dialogPaperSx } from '@/components/ManagerDialog/managerStyles';

const PREVIEW_PAGE_SIZE = 10;
const LONG_TEXT_LENGTH = 300;
const NEW_GROUP = '__new__';

const MESSAGE_COLORS = {
  success: '#7CB368',
  warning: '#CC7832',
  error: '#BC3F3C',
  question: '#CC7832',
};

const providerLabel = record => {
  if (record.type === 'observer') return 'Observer';
  return record.provider === 'codex' ? 'Codex' : 'Claude';
};

const formatDate = value => (value ? new Date(value).toLocaleString() : '');

const FeedLine = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const text = item.kind === 'milestone'
    ? `${item.accomplished || ''}${item.workingOn ? ` → ${item.workingOn}` : ''}`
    : item.text || '';
  const isLong = text.length > LONG_TEXT_LENGTH;
  const shown = isLong && !expanded ? `${text.slice(0, LONG_TEXT_LENGTH)}…` : text;

  let Icon = ChatIcon;
  let color = MESSAGE_COLORS[item.type] || '#A9B7C6';
  if (item.kind === 'user') {
    Icon = PersonIcon;
    color = '#C5A5D6';
  } else if (item.kind === 'milestone') {
    Icon = SmartToyIcon;
    color = '#7CB368';
  }

  return (
    <Box
      onClick={isLong ? () => setExpanded(e => !e) : undefined}
      title={isLong ? (expanded ? 'Collapse' : 'Show the full message') : undefined}
      sx={{
        display: 'flex',
        gap: 0.75,
        py: 0.25,
        alignItems: 'flex-start',
        ...(isLong && { cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: '#3C3F41' } }),
      }}
    >
      <Icon sx={{
        fontSize: 13, color, mt: '3px', flexShrink: 0,
      }}
      />
      <Typography sx={{
        fontSize: '0.8rem', color, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}
      >
        {shown}
      </Typography>
    </Box>
  );
};

// The newest messages of a remembered instance, with older pages on demand.
const RememberedFeed = ({ instanceId }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async beforeId => {
    setLoading(true);
    setError('');
    const result = await fetchFeedPage(instanceId, { beforeId, limit: PREVIEW_PAGE_SIZE });
    if (result?.ok) {
      setItems(prev => (beforeId ? [...result.data.items, ...prev] : result.data.items));
      setTotal(result.data.total);
    } else {
      setError(result?.errorMessage || 'Could not load the messages. Try again.');
    }
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={{
      bgcolor: '#2B2B2B', border: '1px solid #3C3F41', borderRadius: 1.5, px: 1.25, py: 0.75,
    }}
    >
      {items.length < total && (
        <Button
          size="small"
          disabled={loading}
          onClick={() => load(items[0]?.id)}
          startIcon={<ExpandLessIcon sx={{ fontSize: 16 }} />}
          sx={{
            color: '#808080', textTransform: 'none', fontSize: '0.75rem', mb: 0.5,
          }}
        >
          Show older ({total - items.length} more)
        </Button>
      )}
      {error && <Alert severity="error" sx={{ mb: 0.5 }}>{error}</Alert>}
      {!error && !loading && items.length === 0 && (
        <Typography sx={{ fontSize: '0.8rem', color: '#606366' }}>No messages.</Typography>
      )}
      {items.map(item => <FeedLine key={item.id} item={item} />)}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
          <CircularProgress size={16} sx={{ color: '#6897BB' }} />
        </Box>
      )}
    </Box>
  );
};

const RememberedRow = ({
  record, groups, onResume, onRemove,
}) => {
  // Only saved instances are listed while running; they can't be started twice
  const { running } = record;
  const group = groups.find(g => g.id === record.groupId);
  const [expanded, setExpanded] = useState(false);
  const [groupId, setGroupId] = useState(group ? group.id : NEW_GROUP);
  const [starting, setStarting] = useState(false);

  let groupLabel = 'No group';
  if (group) groupLabel = group.name;
  else if (record.groupId) groupLabel = 'Group missing';

  const handleStart = async () => {
    setStarting(true);
    try {
      await onResume(record, groupId === NEW_GROUP ? null : groupId);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Box sx={{
      border: '1px solid #3C3F41', borderRadius: 2, mb: 1, bgcolor: '#313335', overflow: 'hidden',
    }}
    >
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          flexWrap: 'wrap',
          '&:hover': { bgcolor: '#363839' },
        }}
      >
        <Chip
          size="small"
          label={providerLabel(record)}
          sx={{
            height: 18, fontSize: '0.65rem', color: '#6897BB', bgcolor: '#21428333',
          }}
        />
        <Typography sx={{
          color: '#A9B7C6', fontWeight: 600, fontSize: '0.85rem', flex: 1, minWidth: 120,
        }}
        >
          {record.title || record.projectName || 'Untitled instance'}
        </Typography>
        {running && (
          <Chip
            size="small"
            label="running"
            sx={{
              height: 18, fontSize: '0.65rem', color: '#7CB368', bgcolor: '#7CB36826',
            }}
          />
        )}
        <Typography sx={{ fontSize: '0.75rem', color: '#808080' }}>
          {record.messageCount} message{record.messageCount === 1 ? '' : 's'}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: group ? '#808080' : '#CC7832' }}>
          {groupLabel}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: '#606366' }}>
          {formatDate(record.lastActiveAt)}
        </Typography>
        {expanded
          ? <ExpandLessIcon sx={{ fontSize: 18, color: '#808080' }} />
          : <ExpandMoreIcon sx={{ fontSize: 18, color: '#808080' }} />}
      </Box>

      {record.resumeError && (
        <Alert severity="warning" sx={{ mx: 1.5, mb: 1, py: 0 }}>{record.resumeError}</Alert>
      )}

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1 }}>
          {record.cwd && (
            <Typography sx={{
              fontSize: '0.7rem',
              color: '#606366',
              mb: 0.75,
              fontFamily: '"JetBrains Mono", "Consolas", monospace',
            }}
            >
              {record.cwd}
            </Typography>
          )}
          <RememberedFeed instanceId={record.id} />
        </Box>
      </Collapse>

      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pb: 1.25, flexWrap: 'wrap',
      }}
      >
        {running ? (
          <Typography sx={{
            fontSize: '0.78rem', color: '#808080', flex: 1, minWidth: 200,
          }}
          >
            Running now. Stopping it keeps it here.
          </Typography>
        ) : (
          <>
            <TextField
              select
              size="small"
              label="Start in group"
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              sx={{ minWidth: 200, flex: 1 }}
            >
              <MenuItem value={NEW_GROUP}>New group</MenuItem>
              {groups.map(g => (
                <MenuItem key={g.id} value={g.id}>
                  {g.saved ? g.name : `${g.name} (unsaved)`}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              size="small"
              disabled={starting}
              onClick={handleStart}
              startIcon={starting
                ? <CircularProgress size={14} color="inherit" />
                : <PlayArrowIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: '#579945', textTransform: 'none', '&:hover': { bgcolor: '#68AD55' },
              }}
            >
              Start again
            </Button>
          </>
        )}
        <Button
          size="small"
          disabled={starting}
          onClick={() => onRemove(record)}
          startIcon={running
            ? <BookmarkRemoveOutlinedIcon sx={{ fontSize: 16 }} />
            : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{
            color: running ? '#808080' : '#BC3F3C',
            textTransform: 'none',
            '&:hover': { bgcolor: running ? 'rgba(255,255,255,0.06)' : 'rgba(188,63,60,0.1)' },
          }}
        >
          {running ? 'Unsave' : 'Remove'}
        </Button>
      </Box>
    </Box>
  );
};

const MODES = {
  remembered: {
    title: 'Remembered instances',
    intro: 'Instances that are not running. Start one again to continue its conversation, or remove it for good.',
    empty: 'No remembered instances.',
  },
  saved: {
    title: 'Saved instances',
    intro: 'Kept until you remove them here, even after Stop, Delete group or a restart. '
      + 'Start one again to continue its conversation.',
    empty: 'No saved instances. Use the bookmark on a card to save one.',
  },
};

// mode "remembered": instances that stopped; "saved": bookmarked ones, running or not
const RememberedInstancesDialog = ({
  open, onClose, instances, loading, groups, onResume, onRemove, mode = 'remembered',
}) => {
  const text = MODES[mode] || MODES.remembered;
  const { openDialog: openRemoveConfirm, ConfirmDialog: RemoveConfirmDialog } = useConfirm();
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  const handleRemove = useCallback(async record => {
    // Running saved instance: only the bookmark goes
    if (record.running) {
      const result = await onRemove(record);
      if (!result?.ok) setError(result?.errorMessage || 'Could not unsave the instance. Try again.');
      return;
    }
    const label = record.title || record.projectName || 'this instance';
    openRemoveConfirm(
      `Remove "${label}"? Its messages are deleted for good. Its plans stay in the Plans dialog.`,
      async () => {
        const result = await onRemove(record);
        if (!result?.ok) setError(result?.errorMessage || 'Could not remove the instance. Try again.');
      },
    );
  }, [openRemoveConfirm, onRemove]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{
          color: '#A9B7C6', fontWeight: 600, fontSize: 16, pb: 0.5,
        }}
        >
          {text.title}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#808080', fontSize: 13, mb: 1.5 }}>
            {text.intro}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          {loading && instances.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#6897BB' }} />
            </Box>
          )}
          {!loading && instances.length === 0 && (
            <Box sx={{
              py: 4, textAlign: 'center', bgcolor: '#313335', borderRadius: 2, border: '1px solid #3C3F41',
            }}
            >
              <Typography sx={{ color: '#808080', fontSize: 14 }}>{text.empty}</Typography>
            </Box>
          )}
          {instances.map(record => (
            <RememberedRow
              key={record.id}
              record={record}
              groups={groups}
              onResume={onResume}
              onRemove={handleRemove}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: '#808080', textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      {RemoveConfirmDialog}
    </>
  );
};

export default RememberedInstancesDialog;
