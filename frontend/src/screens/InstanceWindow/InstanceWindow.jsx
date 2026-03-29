import {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TerminalIcon from '@mui/icons-material/Terminal';
import ArticleIcon from '@mui/icons-material/Article';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';
import PlansDialog from '@/components/PlansDialog/PlansDialog';
import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import useInstances from '@/hooks/useInstances';
import {
  addUserMessage, addClaudeMessage, setPendingInput, updateInstanceField,
} from '@/stores/instanceAtoms';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import useMobile from '@/components/layout/hooks/useMobile';

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

const InstanceWindow = () => {
  const { instanceId } = useParams();
  const termRef = useRef(null);
  const feedRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [viewingPlan, setViewingPlan] = useState(null);
  const [viewingMessage, setViewingMessage] = useState(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);
  const { isMobile } = useMobile();

  const onMessage = useCallback(msg => {
    if (msg.type === 'output' && msg.instanceId === instanceId) {
      termRef.current?.write(msg.data);
    }
  }, [instanceId]);

  const {
    instances,
    writeToInstance,
    resizeInstance,
    subscribeInstance,
    unsubscribeInstance,
    sendUserResponse,
    sendUserMessage,
    stopInstance,
  } = useInstances(onMessage);

  const instance = instances?.[instanceId];
  const status = STATUS_CONFIG[instance?.status] || STATUS_CONFIG.running;
  const milestones = instance?.milestones || [];
  const messages = instance?.messages || [];
  const userMessages = instance?.userMessages || [];
  const plans = instance?.plans || [];
  const pending = instance?.pendingInput;

  // Build chronological feed
  const feed = [];
  userMessages.forEach(m => feed.push({ kind: 'user', text: m.text, ts: m.timestamp }));
  milestones.forEach(m => feed.push({
    kind: 'milestone', accomplished: m.accomplished, workingOn: m.workingOn, ts: m.timestamp,
  }));
  messages.forEach(m => feed.push({
    kind: 'message', text: m.text, messageType: m.type, ts: m.timestamp,
  }));
  feed.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const visibleFeed = feedExpanded ? feed : feed.slice(-5);

  const isProcessing = instance && !['ready', 'waiting', 'completed', 'plan_ready', 'exited'].includes(instance.status);

  useEffect(() => {
    if (instanceId) {
      subscribeInstance(instanceId);
      return () => unsubscribeInstance(instanceId);
    }
  }, [instanceId, subscribeInstance, unsubscribeInstance]);

  useEffect(() => {
    const name = instance?.projectName || instance?.name;
    if (name) {
      const s = STATUS_CONFIG[instance.status] || STATUS_CONFIG.running;
      document.title = `[${s.label}] ${name} — Claude IDE`;
      // Update browser tab theme color
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = s.color;
    }
  }, [instance?.projectName, instance?.name, instance?.status]);

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
  }, [feed.length, pending]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    const ts = new Date().toISOString();
    addUserMessage(instanceId, inputText, ts);
    sendUserMessage(instanceId, inputText, ts);
    setPendingInput(instanceId, null);
    // Immediately set "thinking" for Claude instances
    if (instance?.type === 'claude' && instance.status !== 'exited') {
      updateInstanceField(instanceId, 'status', 'thinking');
    }
    writeToInstance(instanceId, `${inputText}\r`);
    setInputText('');
  }, [inputText, instanceId, writeToInstance, sendUserMessage, instance?.type, instance?.status]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isMobile]);

  const handleTerminalData = useCallback(data => {
    writeToInstance(instanceId, data);
  }, [instanceId, writeToInstance]);

  const handleResize = useCallback((cols, rows) => {
    resizeInstance(instanceId, cols, rows);
  }, [instanceId, resizeInstance]);

  const handleChoiceClick = useCallback(choice => {
    addUserMessage(instanceId, choice, new Date().toISOString());
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
  }, [instanceId, sendUserResponse]);

  const handleOpenPlan = useCallback(plan => {
    if (plan.id && !isMobile) {
      const url = UrlEnums.PLAN_VIEW.replace(':planId', plan.id);
      window.open(url, `plan_${plan.id}`, 'width=900,height=700');
    } else {
      setViewingPlan(plan);
    }
  }, [isMobile]);

  if (!instance) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#2B2B2B',
      }}
      >
        <Typography sx={{ color: '#808080' }}>Instance not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: '#2B2B2B',
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: '#1A1A1A',
        borderBottom: '1px solid #3C3F41',
      }}
      >
        <FiberManualRecordIcon sx={{ fontSize: 10, color: status.color }} />
        {instance.type === 'terminal'
          ? <TerminalIcon sx={{ fontSize: 16, color: '#6897BB' }} />
          : <AutoAwesomeIcon sx={{ fontSize: 16, color: '#CC7832' }} />}
        <Typography sx={{
          color: '#A9B7C6', fontWeight: 600, fontSize: '0.9rem', flex: 1,
        }}
        >
          {instance.projectName || 'Instance'}
        </Typography>
        <Chip
          size="small"
          label={status.label}
          sx={{
            bgcolor: `${status.color}22`, color: status.color, fontSize: '0.7rem',
          }}
        />
        <IconButton
          size="small"
          onClick={() => setPlansOpen(true)}
          title="View stored plans"
          sx={{ color: '#6897BB', '&:hover': { color: '#89B8DE' } }}
        >
          <ArticleIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => stopInstance(instanceId)}
          disabled={instance.status === 'exited'}
          title="Stop instance"
          sx={{ color: '#BC3F3C', '&:hover': { color: '#D45B58' }, '&.Mui-disabled': { color: '#4E5254' } }}
        >
          <StopIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Mobile tabs */}
      {isMobile && instance.type === 'claude' && (
        <Tabs
          value={mobileTab}
          onChange={(e, v) => setMobileTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            bgcolor: '#1A1A1A',
            borderBottom: '1px solid #3C3F41',
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              fontSize: '0.8rem',
              color: '#808080',
              textTransform: 'none',
            },
            '& .Mui-selected': { color: '#A9B7C6' },
            '& .MuiTabs-indicator': { bgcolor: '#6897BB' },
          }}
        >
          <Tab label="Messages" />
          <Tab label="Terminal" />
        </Tabs>
      )}

      {/* Main area: Terminal (left) + Activity panel (right) */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Terminal */}
        <Box sx={{
          flex: 1,
          minWidth: 0,
          display: isMobile && instance.type === 'claude' && mobileTab !== 1 ? 'none' : 'flex',
          flexDirection: 'column',
        }}
        >
          <TerminalWidget
            ref={termRef}
            onData={handleTerminalData}
            onResize={handleResize}
          />
        </Box>

        {/* Activity panel (Claude instances only) */}
        {instance.type === 'claude' && (
          <Box sx={{
            width: isMobile ? '100%' : 440,
            flexShrink: 0,
            display: isMobile && mobileTab !== 0 ? 'none' : 'flex',
            flexDirection: 'column',
            borderLeft: isMobile ? 'none' : '1px solid #3C3F41',
            bgcolor: '#313335',
          }}
          >
            {/* Activity feed */}
            <Box
              ref={feedRef}
              sx={{
                flex: 1, overflow: 'auto', px: 2, py: 1.5,
              }}
            >
              {feed.length > 5 && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', mb: 1, cursor: 'pointer',
                }}
                onClick={() => setFeedExpanded(!feedExpanded)}
                >
                  <Typography sx={{
                    fontSize: '0.75rem', color: '#808080', flex: 1,
                  }}
                  >
                    {feedExpanded ? 'Show less' : `${feed.length - 5} older messages`}
                  </Typography>
                  <IconButton size="small" sx={{ p: 0 }}>
                    {feedExpanded
                      ? <ExpandLessIcon sx={{ fontSize: 18, color: '#808080' }} />
                      : <ExpandMoreIcon sx={{ fontSize: 18, color: '#808080' }} />}
                  </IconButton>
                </Box>
              )}
              {feed.length === 0 && !isProcessing && (
                <Typography sx={{
                  color: '#606366', fontSize: '0.8rem', textAlign: 'center', mt: 4,
                }}
                >
                  No activity yet. Send a message to get started.
                </Typography>
              )}

              {visibleFeed.map((item, idx) => {
                if (item.kind === 'user') {
                  const isLongUser = item.text && item.text.length > 250;
                  const userDisplayText = isLongUser
                    ? `${item.text.slice(0, 200)}...`
                    : item.text;
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start',
                      }}
                    >
                      <PersonIcon sx={{
                        fontSize: 16, color: '#B07ACC', mt: '2px', flexShrink: 0,
                      }}
                      />
                      <Box
                        onClick={isLongUser ? () => setViewingMessage({ text: item.text, title: 'User Message' }) : undefined}
                        sx={{
                          bgcolor: '#3C3F41',
                          border: '1px solid #4E5254',
                          borderRadius: '8px',
                          px: 1.5,
                          py: 0.75,
                          flex: 1,
                          ...(isLongUser && {
                            cursor: 'pointer',
                            '&:hover': { border: '1px solid #6E7274', bgcolor: '#434648' },
                          }),
                        }}
                      >
                        <Typography sx={{
                          fontSize: '0.8rem', color: '#C5A5D6', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                        }}
                        >
                          {userDisplayText}
                        </Typography>
                        {isLongUser && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography sx={{
                              fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic',
                            }}
                            >
                              Click to read full message
                            </Typography>
                            {item.text.trim().endsWith('?') && (
                              <HelpOutlineIcon sx={{ fontSize: 14, color: '#C5A5D6', pr: 0.5, pb: 0.5 }} />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }
                if (item.kind === 'message') {
                  const msgColor = item.messageType === 'success' ? '#7CB368'
                    : item.messageType === 'warning' ? '#CC7832'
                      : item.messageType === 'error' ? '#BC3F3C'
                        : item.messageType === 'question' ? '#CC7832'
                          : '#A9B7C6';
                  const isLong = item.text && item.text.length > 250;
                  const displayText = isLong
                    ? `${item.text.slice(0, 200)}...`
                    : item.text;
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start',
                      }}
                    >
                      <ChatIcon sx={{
                        fontSize: 16, color: msgColor, mt: '2px', flexShrink: 0,
                      }}
                      />
                      <Box
                        onClick={isLong ? () => setViewingMessage({ text: item.text, title: 'Message' }) : undefined}
                        sx={{
                          bgcolor: '#2B2B2B',
                          border: `1px solid ${msgColor}33`,
                          borderRadius: '8px',
                          px: 1.5,
                          py: 0.75,
                          flex: 1,
                          minWidth: 0,
                          ...(isLong && {
                            cursor: 'pointer',
                            '&:hover': { border: `1px solid ${msgColor}66`, bgcolor: '#323436' },
                          }),
                        }}
                      >
                        <MarkdownRenderer
                          content={displayText}
                          fontSize="0.8rem"
                          sx={{
                            color: msgColor,
                            '& p:last-child': { mb: 0 },
                          }}
                        />
                        {isLong && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography sx={{
                              fontSize: '0.7rem',
                              color: 'rgba(255,255,255,0.5)',
                              fontStyle: 'italic',
                            }}
                            >
                              Click to read full message
                            </Typography>
                            {item.text.trim().endsWith('?') && (
                              <HelpOutlineIcon sx={{ fontSize: 14, color: msgColor, pr: 0.5, pb: 0.5 }} />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }
                const milestoneText = `${item.accomplished || ''}${item.workingOn ? `\nNext: ${item.workingOn}` : ''}`;
                const isLongMilestone = milestoneText.length > 250;
                const milestoneDisplay = isLongMilestone
                  ? `${(item.accomplished || '').slice(0, 200)}...`
                  : item.accomplished;
                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start',
                    }}
                  >
                    <SmartToyIcon sx={{
                      fontSize: 16, color: '#7CB368', mt: '2px', flexShrink: 0,
                    }}
                    />
                    <Box
                      onClick={isLongMilestone ? () => setViewingMessage({ text: milestoneText, title: 'Milestone' }) : undefined}
                      sx={{
                        flex: 1,
                        ...(isLongMilestone && {
                          cursor: 'pointer',
                          borderRadius: '8px',
                          px: 1,
                          py: 0.5,
                          mx: -1,
                          '&:hover': { bgcolor: '#3C3F41' },
                        }),
                      }}
                    >
                      <Typography sx={{ fontSize: '0.8rem', color: '#7CB368', lineHeight: 1.5 }}>
                        {milestoneDisplay}
                      </Typography>
                      {!isLongMilestone && item.workingOn && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#7AAACF', lineHeight: 1.4 }}>
                          Next: {item.workingOn}
                        </Typography>
                      )}
                      {isLongMilestone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography sx={{
                            fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic',
                          }}
                          >
                            Click to read full message
                          </Typography>
                          {milestoneText.trim().endsWith('?') && (
                            <HelpOutlineIcon sx={{ fontSize: 14, color: '#7CB368', pr: 0.5, pb: 0.5 }} />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}

              {isProcessing && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                }}
                >
                  <CircularProgress size={14} sx={{ color: '#6897BB' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#6897BB', fontStyle: 'italic' }}>
                    Processing...
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Plans section */}
            {plans.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderTop: '1px solid #3C3F41' }}>
                <Typography sx={{
                  fontSize: '0.65rem', color: '#808080', fontWeight: 600, mb: 0.5,
                }}
                >PLANS
                </Typography>
                {plans.map((plan, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25,
                    }}
                  >
                    <Typography
                      onClick={() => handleOpenPlan(plan)}
                      sx={{
                        fontSize: '0.75rem',
                        color: '#6897BB',
                        cursor: 'pointer',
                        flex: 1,
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {plan.title || 'Untitled Plan'}
                    </Typography>
                    {plan.id && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenPlan(plan)}
                        sx={{ p: 0.25, color: '#808080', '&:hover': { color: '#6897BB' } }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Pending choices */}
            {pending && Array.isArray(pending.choices) && pending.choices.length > 0 && (
              <Box sx={{
                px: 2, py: 1, borderTop: '1px solid #3C3F41', bgcolor: '#3C3F41',
              }}
              >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {pending.choices.map((choice, idx) => (
                    <Chip
                      key={idx}
                      label={choice}
                      clickable
                      onClick={() => handleChoiceClick(choice)}
                      sx={{
                        bgcolor: '#214283',
                        color: '#A9B7C6',
                        fontSize: '0.85rem',
                        height: 32,
                        '&:hover': { bgcolor: '#2E5AA7' },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Input */}
            <Box sx={{
              px: 2, py: 1, borderTop: '1px solid #3C3F41',
              flexShrink: 0, position: 'relative',
            }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={instance.status === 'exited'}
                multiline
                maxRows={4}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#2B2B2B',
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
                }}
              />
              <IconButton
                size="small"
                onClick={handleSend}
                disabled={instance.status === 'exited' || !inputText.trim()}
                sx={{
                  position: 'absolute',
                  right: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 32,
                  bgcolor: inputText.trim() ? '#6897BB' : 'transparent',
                  color: inputText.trim() ? '#fff' : '#4E5254',
                  '&:hover': { bgcolor: inputText.trim() ? '#89B8DE' : 'rgba(104,151,187,0.15)' },
                  '&.Mui-disabled': { color: '#4E5254', bgcolor: 'transparent' },
                }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>

      <PlanViewerDialog
        open={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        plan={viewingPlan}
      />
      <PlanViewerDialog
        open={!!viewingMessage}
        onClose={() => setViewingMessage(null)}
        plan={viewingMessage ? { title: viewingMessage.title || 'Message', content: viewingMessage.text } : null}
      />
      <PlansDialog
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
      />
    </Box>
  );
};

export default InstanceWindow;
