import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TvIcon from '@mui/icons-material/Tv';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StopIcon from '@mui/icons-material/Stop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';

import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';

const STATUS_CONFIG = {
  ready: { label: 'Ready', color: '#7CB368' },
  thinking: { label: 'Thinking', color: '#CC7832' },
  planning: { label: 'Planning', color: '#CC7832' },
  plan_ready: { label: 'Plan Ready', color: '#7CB368' },
  waiting: { label: 'Waiting', color: '#CC7832' },
  working: { label: 'Working', color: '#6897BB' },
  completed: { label: 'Completed', color: '#7CB368' },
  running: { label: 'Running', color: '#7CB368' },
  exited: { label: 'Exited', color: '#606366' },
};

const ClaudeInstanceCard = ({
  instance,
  expanded,
  onToggleExpand,
  onOpenPlaceholder,
  onOpenWindow,
  onStop,
  onSendInput,
  onSendResponse,
  onViewPlan,
}) => {
  const [inputText, setInputText] = useState('');
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [plansAnchorEl, setPlansAnchorEl] = useState(null);
  const feedRef = useRef(null);

  const status = STATUS_CONFIG[instance.status] || STATUS_CONFIG.running;
  const milestones = instance.milestones || [];
  const messages = instance.messages || [];
  const userMessages = instance.userMessages || [];
  const plans = instance.plans || [];
  const pending = instance.pendingInput;

  // Build a chronological feed of user messages + milestones + claude messages
  const feed = [];
  userMessages.forEach(m => feed.push({ kind: 'user', text: m.text, ts: m.timestamp }));
  milestones.forEach(m => feed.push({
    kind: 'milestone', accomplished: m.accomplished, workingOn: m.workingOn, ts: m.timestamp,
  }));
  messages.forEach(m => feed.push({
    kind: 'message', text: m.text, messageType: m.type, ts: m.timestamp,
  }));
  feed.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const visibleFeed = feedExpanded || expanded ? feed : feed.slice(-5);

  // Check if Claude is "thinking" — user sent a message but no milestone/message came after it
  const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  const lastMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null;
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastClaudeActivity = [lastMilestone?.timestamp, lastMessage?.timestamp]
    .filter(Boolean).sort().pop();
  const isThinking = lastUserMsg && instance.status !== 'exited' && instance.status !== 'completed'
    && (!lastClaudeActivity || new Date(lastUserMsg.timestamp) > new Date(lastClaudeActivity));

  // Auto-scroll feed to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed.length]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        onSendInput(instance.id, `${inputText}\r`);
        setInputText('');
      }
    }
  }, [inputText, instance.id, onSendInput]);

  return (
    <Card
      sx={{
        bgcolor: '#313335',
        border: '1px solid #3C3F41',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(40vh - 36px)',
      }}
    >
      {/* Header: Status + Name */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #3C3F41', flexShrink: 0,
      }}
      >
        <FiberManualRecordIcon sx={{ fontSize: 10, color: status.color }} />
        <Typography sx={{ fontSize: '0.75rem', color: status.color, fontWeight: 500 }}>
          {status.label}
        </Typography>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, justifyContent: 'flex-end', minWidth: 0,
        }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 14, color: '#CC7832', flexShrink: 0 }} />
          <Typography
            sx={{
              fontSize: '0.8rem',
              color: '#A9B7C6',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {instance.projectName || instance.name}
          </Typography>
        </Box>
      </Box>

      {/* Activity Feed — user messages + milestones interleaved */}
      {feed.length > 0 && (
        <Box sx={{
          px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41',
          flexShrink: 1, flexGrow: 1, minHeight: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25, flexShrink: 0 }}>
            <Typography sx={{
              fontSize: '0.65rem', color: '#808080', fontWeight: 600, flex: 1,
            }}
            >
              ACTIVITY
            </Typography>
            {feed.length > 5 && (
              <IconButton size="small" onClick={() => setFeedExpanded(!feedExpanded)} sx={{ p: 0 }}>
                {feedExpanded
                  ? <ExpandLessIcon sx={{ fontSize: 14, color: '#808080' }} />
                  : <ExpandMoreIcon sx={{ fontSize: 14, color: '#808080' }} />}
              </IconButton>
            )}
          </Box>
          <Box ref={feedRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {visibleFeed.map((item, idx) => {
              if (item.kind === 'user') {
                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.25,
                    }}
                  >
                    <PersonIcon sx={{
                      fontSize: 12, color: '#B07ACC', mt: '2px', flexShrink: 0,
                    }}
                    />
                    <Typography sx={{ fontSize: '0.7rem', color: '#C5A5D6', lineHeight: 1.4 }}>
                      {item.text}
                    </Typography>
                  </Box>
                );
              }
              if (item.kind === 'message') {
                const msgColor = item.messageType === 'success' ? '#7CB368'
                  : item.messageType === 'warning' ? '#CC7832'
                    : item.messageType === 'error' ? '#BC3F3C'
                      : item.messageType === 'question' ? '#CC7832'
                        : '#A9B7C6';
                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.25,
                    }}
                  >
                    <ChatIcon sx={{
                      fontSize: 12, color: msgColor, mt: '2px', flexShrink: 0,
                    }}
                    />
                    <MarkdownRenderer
                      content={item.text}
                      fontSize="0.7rem"
                      sx={{
                        color: msgColor,
                        lineHeight: 1.4,
                        flex: 1,
                        minWidth: 0,
                        '& p': { mb: 0.25 },
                        '& p:last-child': { mb: 0 },
                        '& pre': { p: 0.75, mb: 0.5, fontSize: '0.65rem' },
                        '& ul, & ol': { pl: 2, mb: 0.25 },
                        '& li': { mb: 0 },
                        '& h1, & h2, & h3': { fontSize: '0.75rem', mt: 0.5, mb: 0.25 },
                      }}
                    />
                  </Box>
                );
              }
              return (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.25,
                  }}
                >
                  <SmartToyIcon sx={{
                    fontSize: 12, color: '#7CB368', mt: '2px', flexShrink: 0,
                  }}
                  />
                  <Typography sx={{ fontSize: '0.7rem', color: '#A9B7C6', lineHeight: 1.4 }}>
                    <span style={{ color: '#7CB368' }}>{item.accomplished}</span>
                    {item.workingOn && <span style={{ color: '#7AAACF' }}> → {item.workingOn}</span>}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          {isThinking && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexShrink: 0,
            }}
            >
              <CircularProgress size={10} sx={{ color: '#6897BB' }} />
              <Typography sx={{ fontSize: '0.65rem', color: '#6897BB', fontStyle: 'italic' }}>
                Claude is working...
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {/* Show thinking indicator even when feed is empty (first message sent) */}
      {feed.length === 0 && isThinking && (
        <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CircularProgress size={10} sx={{ color: '#6897BB' }} />
            <Typography sx={{ fontSize: '0.65rem', color: '#6897BB', fontStyle: 'italic' }}>
              Claude is working...
            </Typography>
          </Box>
        </Box>
      )}

      {/* Plans — show only the last plan; history icon opens full list */}
      {plans.length > 0 && (
        <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#808080', fontWeight: 600 }}>
              PLANS
            </Typography>
            {plans.length > 1 && (
              <IconButton
                size="small"
                onClick={e => setPlansAnchorEl(e.currentTarget)}
                sx={{ p: 0, ml: 'auto' }}
              >
                <HistoryIcon sx={{ fontSize: 14, color: '#808080' }} />
              </IconButton>
            )}
          </Box>
          <Typography
            onClick={() => onViewPlan?.(plans[plans.length - 1])}
            sx={{
              fontSize: '0.7rem',
              color: '#6897BB',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
              lineHeight: 1.4,
            }}
          >
            {plans[plans.length - 1].title || 'Untitled Plan'}
          </Typography>
        </Box>
      )}
      <Popover
        open={Boolean(plansAnchorEl)}
        anchorEl={plansAnchorEl}
        onClose={() => setPlansAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            bgcolor: '#313335',
            border: '1px solid #4E5254',
            maxHeight: 300,
            overflowY: 'auto',
            minWidth: 200,
            maxWidth: 350,
          },
        }}
      >
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{
            fontSize: '0.65rem', color: '#808080', fontWeight: 600, px: 1.5, py: 0.5,
          }}
          >
            ALL PLANS
          </Typography>
          {plans.map((plan, idx) => (
            <Typography
              key={idx}
              onClick={() => { onViewPlan?.(plan); setPlansAnchorEl(null); }}
              sx={{
                fontSize: '0.7rem',
                color: '#6897BB',
                cursor: 'pointer',
                px: 1.5,
                py: 0.5,
                '&:hover': { bgcolor: '#3C3F41' },
                lineHeight: 1.4,
              }}
            >
              {plan.title || 'Untitled Plan'}
            </Typography>
          ))}
        </Box>
      </Popover>

      {/* User Choices (when waiting) */}
      {pending && Array.isArray(pending.choices) && pending.choices.length > 0 && (
        <Box sx={{
          px: 1.5, py: 1, borderBottom: '1px solid #3C3F41', bgcolor: '#3C3F41', flexShrink: 0,
        }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {pending.choices.map((choice, idx) => (
              <Chip
                key={idx}
                label={choice}
                size="small"
                clickable
                onClick={() => onSendResponse(instance.id, choice)}
                sx={{
                  bgcolor: '#214283',
                  color: '#A9B7C6',
                  fontSize: '0.7rem',
                  '&:hover': { bgcolor: '#2E5AA7' },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Input */}
      <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41', flexShrink: 0 }}>
        <TextField
          fullWidth
          multiline
          maxRows={expanded ? 12 : 8}
          size="small"
          placeholder="Type a message..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          disabled={instance.status === 'exited'}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.75rem',
              bgcolor: '#2B2B2B',
              color: '#A9B7C6',
              '& fieldset': { borderColor: '#3C3F41' },
              '&:hover fieldset': { borderColor: '#6897BB' },
              '&.Mui-focused fieldset': { borderColor: '#6897BB' },
            },
            '& .MuiOutlinedInput-input': {
              py: 0.75,
              px: 1,
            },
          }}
        />
      </Box>

      {/* Buttons */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, flexShrink: 0,
      }}
      >
        <IconButton
          size="small"
          onClick={() => onOpenPlaceholder(instance.id)}
          title="Open in placeholder"
          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
        >
          <TvIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onOpenWindow(instance.id)}
          title="Open in new window"
          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onToggleExpand?.(instance.id)}
          title={expanded ? 'Shrink card' : 'Expand card'}
          sx={{ color: expanded ? '#6897BB' : '#808080', '&:hover': { color: '#6897BB' } }}
        >
          {expanded
            ? <UnfoldLessIcon sx={{ fontSize: 16 }} />
            : <UnfoldMoreIcon sx={{ fontSize: 16 }} />}
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          onClick={() => onStop(instance.id)}
          disabled={instance.status === 'exited'}
          title="Stop"
          sx={{ color: '#BC3F3C', '&:hover': { color: '#D45B58' }, '&.Mui-disabled': { color: '#4E5254' } }}
        >
          <StopIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Card>
  );
};

export default ClaudeInstanceCard;
