import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
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
import MinimizeIcon from '@mui/icons-material/Minimize';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';

import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';
import ChatInput from '@/components/ChatInput/ChatInput';
import { FeedAttachments, FileDropZone } from '@/components/Attachments/Attachments';
import useAttachments from '@/hooks/useAttachments';
import EditableTitle from '@/components/EditableTitle/EditableTitle';
import { useStoreFamilyValue } from '@/components/state/GlobalState';
import { InstanceStores, setInputDraft, markPlanSeen } from '@/stores/instanceAtoms';
import { STATUS_CONFIG, getInstanceTitle } from '@/helpers/instanceHelper';
import useFeedWindow from '@/hooks/useFeedWindow';

// "Click to read full message" under a shortened feed item
const hintSx = { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' };

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
  onMinimize,
  onMoveToGroup,
  onRename,
  fill = false,
}) => {
  const inputText = useStoreFamilyValue(InstanceStores.inputDraftFamilyStore, instance.id);
  const [plansAnchorEl, setPlansAnchorEl] = useState(null);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const feedRef = useRef(null);

  const status = STATUS_CONFIG[instance.status] || STATUS_CONFIG.running;
  const plans = instance.plans || [];
  const pending = instance.pendingInput;

  // The feed (user messages, Claude messages, milestones) as stored in the database.
  // Keys are the stored ids, so appending an item doesn't force MarkdownRenderer to
  // re-parse the whole visible feed.
  const {
    feed, visibleFeed, hiddenCount, showMore, newestId,
  } = useFeedWindow(instance);

  const isProcessing = ['thinking', 'planning', 'working'].includes(instance.status);

  // Auto-scroll feed to bottom only if user hasn't scrolled up
  const userScrolledUp = useRef(false);
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);
  useEffect(() => {
    if (feedRef.current && !userScrolledUp.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [newestId]);

  // Files attached to the message being written; dropped anywhere on the card or pasted
  const attachments = useAttachments(instance.id);

  const handleSend = useCallback((data, attachmentIds) => {
    onSendInput(instance.id, data, attachmentIds);
    setInputDraft(instance.id, '');
  }, [instance.id, onSendInput]);

  return (
    <FileDropZone
      enabled={attachments.enabled}
      onFiles={attachments.addFiles}
      sx={fill ? { height: '100%' } : undefined}
    >
      <Card
        sx={{
          bgcolor: '#313335',
          border: '1px solid #3C3F41',
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // fill: the card takes its container's full height (one card per page on mobile)
          height: fill ? '100%' : undefined,
          maxHeight: fill ? 'none' : 'calc(40vh - 36px)',
        }}
      >
        {/* Header: status + editable title + show-more, single compact row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.5,
            borderBottom: '1px solid #3C3F41',
            flexShrink: 0,
          }}
        >
          <FiberManualRecordIcon titleAccess={status.label} sx={{ fontSize: 9, color: status.color, flexShrink: 0 }} />
          <Typography sx={{
            fontSize: '0.7rem', color: status.color, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
          }}
          >
            {status.label}
          </Typography>
          <EditableTitle
            title={getInstanceTitle(instance)}
            onRename={title => onRename?.(instance.id, title)}
            icon={<AutoAwesomeIcon sx={{ fontSize: 13, color: '#CC7832', flexShrink: 0 }} />}
          />
          <Chip
            size="small"
            label={instance.provider === 'codex' ? 'Codex' : 'Claude'}
            sx={{
              height: 16, fontSize: '0.6rem', color: '#6897BB', bgcolor: '#21428333',
            }}
          />
          {(instance.launchFlags || []).map(flag => (
            <Chip
              key={flag.id}
              size="small"
              label={flag.name}
              title={flag.name}
              sx={{
                height: 16,
                fontSize: '0.6rem',
                flexShrink: 0,
                bgcolor: '#21428355',
                color: '#6897BB',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          ))}
          {hiddenCount > 0 && (
            <Box
              onClick={showMore}
              title={`Show 5 more messages (${hiddenCount} hidden)`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                borderRadius: 1,
                cursor: 'pointer',
                flexShrink: 0,
                '&:hover': { bgcolor: '#3C3F41' },
              }}
            >
              <Typography sx={{ fontSize: '0.65rem', color: '#808080', whiteSpace: 'nowrap' }}>
                +5 ({hiddenCount})
              </Typography>
              <ExpandLessIcon sx={{ fontSize: 13, color: '#808080' }} />
            </Box>
          )}
        </Box>

        {/* Activity Feed — user messages + milestones interleaved */}
        {feed.length > 0 && (
          <Box sx={{
            px: 1.5,
            py: 0.5,
            borderBottom: '1px solid #3C3F41',
            flexShrink: 1,
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          >
            <Box ref={feedRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {visibleFeed.map(item => {
                if (item.kind === 'user') {
                  const isLongUser = item.text && item.text.length > 250;
                  const userDisplay = isLongUser ? `${item.text.slice(0, 200)}...` : item.text;
                  return (
                    <Box
                      key={item.id}
                      onClick={isLongUser
                        ? () => onViewPlan?.({ title: 'User Message', content: item.text })
                        : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.5,
                        mb: 0.25,
                        ...(isLongUser && { cursor: 'pointer', '&:hover': { bgcolor: '#3C3F41' }, borderRadius: 1 }),
                      }}
                    >
                      <PersonIcon sx={{
                        fontSize: 12, color: '#B07ACC', mt: '2px', flexShrink: 0,
                      }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8rem', color: '#C5A5D6', lineHeight: 1.4 }}>
                          {userDisplay}
                        </Typography>
                        <FeedAttachments instanceId={instance.id} attachments={item.attachments} />
                        {isLongUser && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={hintSx}>
                              Click to read full message
                            </Typography>
                            {item.text.trim().endsWith('?') && (
                              <HelpOutlineIcon sx={{
                                fontSize: 12, color: '#C5A5D6', pr: 0.5, pb: 0.5,
                              }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }
                if (item.kind === 'message') {
                  const msgColor = item.type === 'success' ? '#7CB368'
                    : item.type === 'warning' ? '#CC7832'
                      : item.type === 'error' ? '#BC3F3C'
                        : item.type === 'question' ? '#CC7832'
                          : '#A9B7C6';
                  const isLongMsg = item.text && item.text.length > 250;
                  const msgDisplay = isLongMsg ? `${item.text.slice(0, 200)}...` : item.text;
                  return (
                    <Box
                      key={item.id}
                      onClick={isLongMsg ? () => onViewPlan?.({ title: 'Message', content: item.text }) : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.5,
                        mb: 0.25,
                        ...(isLongMsg && { cursor: 'pointer', '&:hover': { bgcolor: '#3C3F41' }, borderRadius: 1 }),
                      }}
                    >
                      <ChatIcon sx={{
                        fontSize: 12, color: msgColor, mt: '2px', flexShrink: 0,
                      }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <MarkdownRenderer
                          content={msgDisplay}
                          fontSize="0.8rem"
                          sx={{
                            color: msgColor,
                            lineHeight: 1.4,
                            '& p': { mb: 0.25 },
                            '& p:last-child': { mb: 0 },
                            '& pre': { p: 0.75, mb: 0.5, fontSize: '0.85rem' },
                            '& ul, & ol': { pl: 2, mb: 0.25 },
                            '& li': { mb: 0 },
                            '& h1, & h2, & h3': { fontSize: '0.85rem', mt: 0.5, mb: 0.25 },
                          }}
                        />
                        {isLongMsg && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={hintSx}>
                              Click to read full message
                            </Typography>
                            {item.text.trim().endsWith('?') && (
                              <HelpOutlineIcon sx={{
                                fontSize: 12, color: msgColor, pr: 0.5, pb: 0.5,
                              }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }
                {
                  const milestoneText = `${item.accomplished || ''}${item.workingOn ? ` → ${item.workingOn}` : ''}`;
                  const isLongMs = milestoneText.length > 250;
                  const msDisplay = isLongMs ? `${(item.accomplished || '').slice(0, 200)}...` : null;
                  return (
                    <Box
                      key={item.id}
                      onClick={isLongMs
                        ? () => onViewPlan?.({ title: 'Milestone', content: milestoneText })
                        : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.5,
                        mb: 0.25,
                        ...(isLongMs && { cursor: 'pointer', '&:hover': { bgcolor: '#3C3F41' }, borderRadius: 1 }),
                      }}
                    >
                      <SmartToyIcon sx={{
                        fontSize: 12, color: '#7CB368', mt: '2px', flexShrink: 0,
                      }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8rem', color: '#A9B7C6', lineHeight: 1.4 }}>
                          <span style={{ color: '#7CB368' }}>{isLongMs ? msDisplay : item.accomplished}</span>
                          {!isLongMs && item.workingOn && <span style={{ color: '#7AAACF' }}> → {item.workingOn}</span>}
                        </Typography>
                        {isLongMs && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={hintSx}>
                              Click to read full message
                            </Typography>
                            {milestoneText.trim().endsWith('?') && (
                              <HelpOutlineIcon sx={{
                                fontSize: 12, color: '#7CB368', pr: 0.5, pb: 0.5,
                              }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }
              })}
            </Box>
            {isProcessing && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexShrink: 0,
              }}
              >
                <CircularProgress size={10} sx={{ color: '#6897BB' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6897BB', fontStyle: 'italic' }}>
                  Processing...
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {/* Show thinking indicator even when feed is empty (first message sent) */}
        {feed.length === 0 && isProcessing && (
          <Box sx={{
            px: 1.5, py: 0.5, borderBottom: '1px solid #3C3F41', flexShrink: 0,
          }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CircularProgress size={10} sx={{ color: '#6897BB' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#6897BB', fontStyle: 'italic' }}>
                Processing...
              </Typography>
            </Box>
          </Box>
        )}

        {/* Plans — single compact row: dot + last plan title + history icon */}
        {plans.length > 0 && (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderBottom: '1px solid #3C3F41',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box
              onClick={() => {
                const lp = plans[plans.length - 1];
                if (!lp.seen) markPlanSeen(instance.id, lp.id);
                onViewPlan?.(lp);
              }}
              onMouseEnter={() => {
                const lp = plans[plans.length - 1];
                if (!lp.seen) markPlanSeen(instance.id, lp.id);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flex: 1,
                minWidth: 0,
                cursor: 'pointer',
                '&:hover .plan-title': { textDecoration: 'underline' },
              }}
            >
              <Box
                className="plan-dot"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: '#CC7832',
                  flexShrink: 0,
                  opacity: plans[plans.length - 1].seen !== false ? 0.4 : undefined,
                  animation: plans[plans.length - 1].seen !== false ? 'none' : 'planPulse 2s ease-in-out infinite',
                  '@keyframes planPulse': {
                    '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
                    '50%': { opacity: 1, transform: 'scale(1.3)' },
                  },
                }}
              />
              <Typography
                className="plan-title"
                sx={{
                  fontSize: '0.8rem',
                  color: '#6897BB',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {plans[plans.length - 1].title || 'Untitled Plan'}
              </Typography>
            </Box>
            {plans.length > 1 && (
              <IconButton
                size="small"
                title="All plans"
                onClick={e => setPlansAnchorEl(e.currentTarget)}
                sx={{ p: 0.25, flexShrink: 0 }}
              >
                <HistoryIcon sx={{ fontSize: 14, color: '#808080' }} />
              </IconButton>
            )}
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
              fontSize: '0.85rem', color: '#808080', fontWeight: 600, px: 1.5, py: 0.5,
            }}
            >
              ALL PLANS
            </Typography>
            {plans.map((plan, idx) => (
              <Typography
                key={idx}
                onClick={() => { onViewPlan?.(plan); setPlansAnchorEl(null); }}
                sx={{
                  fontSize: '0.8rem',
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
            px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41', bgcolor: '#3C3F41', flexShrink: 0,
          }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: pendingCollapsed ? 0 : 0.5 }}>
              <Typography sx={{
                fontSize: '0.7rem', color: '#808080', fontWeight: 600, flex: 1,
              }}
              >
                {pendingCollapsed
                  ? `${pending.choices.length} option${pending.choices.length === 1 ? '' : 's'} hidden`
                  : 'OPTIONS'}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setPendingCollapsed(c => !c)}
                title={pendingCollapsed ? 'Show options' : 'Hide options'}
                sx={{
                  p: 0.25,
                  bgcolor: '#2B2B2B',
                  color: '#A9B7C6',
                  borderRadius: '6px',
                  '&:hover': { bgcolor: '#4E5254', color: '#FFFFFF' },
                }}
              >
                {pendingCollapsed
                  ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                  : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>
            {!pendingCollapsed && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                maxHeight: '30vh',
                overflowY: 'auto',
              }}
              >
                {pending.choices.map((choice, idx) => (
                  <Box
                    key={idx}
                    component="button"
                    type="button"
                    onClick={() => onSendResponse(instance.id, choice)}
                    sx={{
                      bgcolor: '#214283',
                      color: '#A9B7C6',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      overflow: 'visible',
                      width: '100%',
                      display: 'block',
                      lineHeight: 1.4,
                      px: 1.25,
                      py: 0.5,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#2E5AA7' },
                      '&:active': { bgcolor: '#1A3666' },
                    }}
                  >
                    {choice}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Input */}
        <ChatInput
          value={inputText}
          onChange={text => setInputDraft(instance.id, text)}
          onSend={handleSend}
          disabled={instance.status === 'exited'}
          maxRows={expanded ? 12 : 8}
          attachments={attachments}
        />

        {/* Buttons */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.75,
            py: 0.25,
            flexShrink: 0,
            '& > .MuiIconButton-root': { p: 0.5 },
          }}
        >
          {onOpenPlaceholder && (
            <IconButton
              size="small"
              onClick={() => onOpenPlaceholder(instance.id)}
              title="Open in placeholder"
              sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
            >
              <TvIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => onOpenWindow(instance.id)}
            title="Open in new window"
            sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
          >
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
          {onMinimize && (
            <IconButton
              size="small"
              onClick={() => onMinimize?.(instance.id)}
              title="Minimize to sidebar"
              sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
            >
              <MinimizeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          {onToggleExpand && (
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
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton
            size="small"
            onClick={e => onMoveToGroup?.(instance.id, e.currentTarget)}
            disabled={instance.status === 'exited'}
            title="Move to group…"
            sx={{ color: '#808080', '&:hover': { color: '#6897BB' }, '&.Mui-disabled': { color: '#4E5254' } }}
          >
            <DriveFileMoveOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
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
    </FileDropZone>
  );
};

export default React.memo(ClaudeInstanceCard);
