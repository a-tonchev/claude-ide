import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import useInstances from '@/hooks/useInstances';
import { addUserMessage, setPendingInput, updateInstanceField } from '@/stores/instanceAtoms';
import UrlEnums from '@/components/connections/enums/UrlEnums';

const STATUS_CONFIG = {
  ready: { label: 'Ready', color: '#6897BB' },
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
  milestones.forEach(m => feed.push({ kind: 'milestone', accomplished: m.accomplished, workingOn: m.workingOn, ts: m.timestamp }));
  messages.forEach(m => feed.push({ kind: 'message', text: m.text, messageType: m.type, ts: m.timestamp }));
  feed.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  const lastMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null;
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastClaudeActivity = [lastMilestone?.timestamp, lastMessage?.timestamp]
    .filter(Boolean).sort().pop();
  const isThinking = lastUserMsg && instance?.status !== 'exited' && instance?.status !== 'completed'
    && (!lastClaudeActivity || new Date(lastUserMsg.timestamp) > new Date(lastClaudeActivity));

  useEffect(() => {
    if (instanceId) {
      subscribeInstance(instanceId);
      return () => unsubscribeInstance(instanceId);
    }
  }, [instanceId, subscribeInstance, unsubscribeInstance]);

  useEffect(() => {
    if (instance?.projectName) {
      const s = STATUS_CONFIG[instance.status] || STATUS_CONFIG.running;
      document.title = `[${s.label}] ${instance.projectName} — Claude IDE`;
      // Update browser tab theme color
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = s.color;
    }
  }, [instance?.projectName, instance?.status]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed.length, pending]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    const ts = new Date().toISOString();
    addUserMessage(instanceId, inputText, ts);
    sendUserMessage(instanceId, inputText, ts);
    if (pending) setPendingInput(instanceId, null);
    // Immediately set "thinking" for Claude instances
    if (instance?.type === 'claude' && instance.status !== 'exited') {
      updateInstanceField(instanceId, 'status', 'thinking');
    }
    writeToInstance(instanceId, inputText + '\r');
    setInputText('');
  }, [inputText, instanceId, writeToInstance, sendUserMessage, pending, instance?.type, instance?.status]);

  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTerminalData = useCallback(data => {
    writeToInstance(instanceId, data);
  }, [instanceId, writeToInstance]);

  const handleResize = useCallback((cols, rows) => {
    resizeInstance(instanceId, cols, rows);
  }, [instanceId, resizeInstance]);

  const handleChoiceClick = useCallback(choice => {
    addUserMessage(instanceId, choice);
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
  }, [instanceId, sendUserResponse]);

  const handleOpenPlan = useCallback(plan => {
    if (plan.id) {
      const url = UrlEnums.PLAN_VIEW.replace(':planId', plan.id);
      window.open(url, `plan_${plan.id}`, 'width=900,height=700');
    } else {
      setViewingPlan(plan);
    }
  }, []);

  if (!instance) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#2B2B2B' }}>
        <Typography sx={{ color: '#808080' }}>Instance not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#2B2B2B' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: '#1A1A1A', borderBottom: '1px solid #3C3F41' }}>
        <FiberManualRecordIcon sx={{ fontSize: 10, color: status.color }} />
        <Typography sx={{ color: '#A9B7C6', fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>
          {instance.projectName || 'Instance'}
        </Typography>
        <Chip size="small" label={status.label} sx={{ bgcolor: `${status.color}22`, color: status.color, fontSize: '0.7rem' }} />
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

      {/* Main area: Terminal (left) + Activity panel (right) */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Terminal */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TerminalWidget
            ref={termRef}
            onData={handleTerminalData}
            onResize={handleResize}
          />
        </Box>

        {/* Activity panel */}
        <Box sx={{
          width: 440,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #3C3F41',
          bgcolor: '#313335',
        }}>
          {/* Activity feed */}
          <Box
            ref={feedRef}
            sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}
          >
            {feed.length === 0 && !isThinking && (
              <Typography sx={{ color: '#606366', fontSize: '0.8rem', textAlign: 'center', mt: 4 }}>
                No activity yet. Send a message to get started.
              </Typography>
            )}

            {feed.map((item, idx) => {
              if (item.kind === 'user') {
                return (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start' }}>
                    <PersonIcon sx={{ fontSize: 16, color: '#B07ACC', mt: '2px', flexShrink: 0 }} />
                    <Box sx={{
                      bgcolor: '#3C3F41',
                      border: '1px solid #4E5254',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 0.75,
                      flex: 1,
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', color: '#C5A5D6', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {item.text}
                      </Typography>
                    </Box>
                  </Box>
                );
              }
              if (item.kind === 'message') {
                const msgColor = item.messageType === 'success' ? '#7CB368'
                  : item.messageType === 'warning' ? '#CC7832'
                  : item.messageType === 'error' ? '#BC3F3C'
                  : '#A9B7C6';
                return (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start' }}>
                    <ChatIcon sx={{ fontSize: 16, color: msgColor, mt: '2px', flexShrink: 0 }} />
                    <Box sx={{
                      bgcolor: '#2B2B2B',
                      border: `1px solid ${msgColor}33`,
                      borderRadius: '8px',
                      px: 1.5,
                      py: 0.75,
                      flex: 1,
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', color: msgColor, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {item.text}
                      </Typography>
                    </Box>
                  </Box>
                );
              }
              return (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start' }}>
                  <SmartToyIcon sx={{ fontSize: 16, color: '#7CB368', mt: '2px', flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#7CB368', lineHeight: 1.5 }}>
                      {item.accomplished}
                    </Typography>
                    {item.workingOn && (
                      <Typography sx={{ fontSize: '0.75rem', color: '#7AAACF', lineHeight: 1.4 }}>
                        Next: {item.workingOn}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}

            {isThinking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CircularProgress size={14} sx={{ color: '#6897BB' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6897BB', fontStyle: 'italic' }}>
                  Claude is working...
                </Typography>
              </Box>
            )}
          </Box>

          {/* Plans section */}
          {plans.length > 0 && (
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid #3C3F41' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#808080', fontWeight: 600, mb: 0.5 }}>PLANS</Typography>
              {plans.map((plan, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
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
          {pending && (
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid #3C3F41', bgcolor: '#3C3F41' }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#CC7832', mb: 0.75, fontWeight: 500 }}>
                {pending.message}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(pending.choices || []).map((choice, idx) => (
                  <Chip
                    key={idx}
                    label={choice}
                    size="small"
                    clickable
                    onClick={() => handleChoiceClick(choice)}
                    sx={{
                      bgcolor: '#214283',
                      color: '#A9B7C6',
                      fontSize: '0.75rem',
                      '&:hover': { bgcolor: '#2E5AA7' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Input */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderTop: '1px solid #3C3F41' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={instance.status === 'exited'}
              multiline
              maxRows={4}
              slotProps={{ htmlInput: { onKeyDown: handleKeyDown } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#2B2B2B',
                  fontSize: '0.8rem',
                  color: '#A9B7C6',
                  '& fieldset': { borderColor: '#4E5254' },
                  '&:hover fieldset': { borderColor: '#6897BB' },
                  '&.Mui-focused fieldset': { borderColor: '#6897BB' },
                },
              }}
            />
            <IconButton
              size="small"
              onClick={handleSend}
              disabled={instance.status === 'exited' || !inputText.trim()}
              sx={{
                color: '#6897BB',
                bgcolor: 'rgba(104,151,187,0.15)',
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(104,151,187,0.25)' },
                '&.Mui-disabled': { color: '#4E5254', bgcolor: 'transparent' },
              }}
            >
              <SendIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <PlanViewerDialog
        open={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        plan={viewingPlan}
      />
    </Box>
  );
};

export default InstanceWindow;
