import {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import StopIcon from '@mui/icons-material/Stop';
import ArticleIcon from '@mui/icons-material/Article';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import EditableTitle from '@/components/EditableTitle/EditableTitle';
import PlansDialog from '@/components/PlansDialog/PlansDialog';
import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import ChatInput from '@/components/ChatInput/ChatInput';
import {
  CARD_COLORS, FeedItem, PendingChoices, StatusMark, latestQuestion,
} from '@/components/CardParts/CardParts';
import { FileDropZone } from '@/components/Attachments/Attachments';
import useAttachments from '@/hooks/useAttachments';
import PlanViewerDialog from '@/components/PlanViewerDialog/PlanViewerDialog';
import useConfirm from '@/components/dialogs/hooks/useConfirm';
import useInstances from '@/hooks/useInstances';
import useFeedWindow from '@/hooks/useFeedWindow';
import {
  setPendingInput, updateInstanceField, markPlanSeen,
} from '@/stores/instanceAtoms';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import { STATUS_CONFIG, getInstanceTitle, stopConfirmText } from '@/helpers/instanceHelper';
import useMobile from '@/components/layout/hooks/useMobile';

const InstanceWindow = () => {
  const { instanceId } = useParams();
  const termRef = useRef(null);
  const feedRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [viewingPlan, setViewingPlan] = useState(null);
  const [viewingMessage, setViewingMessage] = useState(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [plansAnchorEl, setPlansAnchorEl] = useState(null);
  const [arrowsAnchorEl, setArrowsAnchorEl] = useState(null);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);
  const [panelWidth, setPanelWidth] = useState(440);
  const resizing = useRef(false);
  const { isMobile } = useMobile();
  const { openDialog: openStopConfirm, ConfirmDialog: StopConfirmDialog } = useConfirm();

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
    sendUserResponse,
    sendUserMessage,
    stopInstance,
    renameInstance,
  } = useInstances(onMessage);

  const instance = instances?.[instanceId];
  const plans = instance?.plans || [];
  const pending = instance?.pendingInput;

  // The feed as stored in the database. Keys are the stored ids, so appends don't
  // force MarkdownRenderer to re-parse the whole visible feed.
  const {
    feed, visibleFeed, hiddenCount, showMore, newestId,
  } = useFeedWindow(instance);

  const isProcessing = ['thinking', 'planning', 'working'].includes(instance?.status);

  // Not unsubscribed on unmount: this window's connection is shared, and closing the window
  // ends it anyway. Unsubscribing would silence the instance until the page is reloaded.
  useEffect(() => {
    if (instanceId) subscribeInstance(instanceId);
  }, [instanceId, subscribeInstance]);

  useEffect(() => {
    const name = instance?.title || instance?.projectName || instance?.name;
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
  }, [instance?.title, instance?.projectName, instance?.name, instance?.status]);

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
  }, [newestId, pending]);

  // Resize handle for activity panel (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handleMouseMove = e => {
      if (!resizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(250, Math.min(newWidth, window.innerWidth - 300)));
    };
    const handleMouseUp = () => {
      if (resizing.current) {
        resizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile]);

  const handleResizeStart = useCallback(e => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // The backend stores the message and sends it back as a feed item to every window.
  // Files attached to the message being written (📎, pasted or dropped on the input)
  const attachments = useAttachments(instanceId);

  const handleSend = useCallback((data, attachmentIds) => {
    sendUserMessage(instanceId, data.slice(0, -1), new Date().toISOString(), attachmentIds);
    setPendingInput(instanceId, null);
    // Immediately set "thinking" for Claude instances
    if (instance?.type === 'claude' && instance.status !== 'exited') {
      updateInstanceField(instanceId, 'status', 'thinking');
    }
    writeToInstance(instanceId, data, attachmentIds);
    setInputText('');
  }, [instanceId, writeToInstance, sendUserMessage, instance?.type, instance?.status]);

  const handleTerminalData = useCallback(data => {
    writeToInstance(instanceId, data);
  }, [instanceId, writeToInstance]);

  // Send raw control bytes to the PTY (e.g. Ctrl+C = \x03, ESC = \x1b).
  // This goes through the same input pipe as keystrokes — the foreground
  // process inside the PTY handles it; the backend instance is not restarted.
  const sendTerminalKey = useCallback(data => {
    writeToInstance(instanceId, data);
  }, [instanceId, writeToInstance]);

  const handleResize = useCallback((cols, rows) => {
    resizeInstance(instanceId, cols, rows);
  }, [instanceId, resizeInstance]);

  const handleChoiceClick = useCallback(choice => {
    setPendingInput(instanceId, null);
    sendUserResponse(instanceId, choice);
  }, [instanceId, sendUserResponse]);

  const handleStopClick = useCallback(() => {
    openStopConfirm(stopConfirmText(instance), () => stopInstance(instanceId));
  }, [instance, instanceId, openStopConfirm, stopInstance]);

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
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      bgcolor: '#2B2B2B',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: '#1E1F21',
        borderBottom: '1px solid #3C3F41',
      }}
      >
        <EditableTitle
          title={getInstanceTitle(instance) || 'Instance'}
          onRename={title => renameInstance(instanceId, title)}
          fontSize="0.92rem"
          color={CARD_COLORS.strong}
        />
        <StatusMark status={instance.status} />
        <IconButton
          size="small"
          onClick={() => window.location.reload()}
          title="Reload page"
          sx={{ color: '#A9B7C6', '&:hover': { color: '#FFFFFF' } }}
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
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
          onClick={handleStopClick}
          disabled={instance.status === 'exited'}
          title="Stop instance"
          sx={{ color: '#BC3F3C', '&:hover': { color: '#D45B58' }, '&.Mui-disabled': { color: '#4E5254' } }}
        >
          <StopIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Mobile tabs */}
      {isMobile && (instance.type === 'claude' || instance.type === 'observer') && (
        <Tabs
          value={mobileTab}
          onChange={(e, v) => setMobileTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            bgcolor: '#1E1F21',
            borderBottom: '1px solid #3C3F41',
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              fontSize: '0.8rem',
              color: '#808080',
              textTransform: 'none',
            },
            '& .Mui-selected': { color: '#D6DCE3' },
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
          {/* Terminal key bar — sends raw control bytes to the PTY (no backend restart) */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 0.5,
            px: 1,
            mt: 1,
            mb: 0.5,
            flexShrink: 0,
          }}
          >
            <Box
              component="button"
              type="button"
              onClick={e => setArrowsAnchorEl(e.currentTarget)}
              disabled={instance.status === 'exited'}
              title="Send arrow key"
              sx={{
                bgcolor: '#3C3F41',
                color: '#A9B7C6',
                border: '1px solid #4E5254',
                borderRadius: '4px',
                px: 0.75,
                py: 0.4,
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: '#4E5254', borderColor: '#6897BB' },
                '&:active': { bgcolor: '#2B2B2B' },
                '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
              }}
            >
              <OpenWithIcon sx={{ fontSize: 14 }} />
            </Box>
            <Popover
              open={Boolean(arrowsAnchorEl)}
              anchorEl={arrowsAnchorEl}
              onClose={() => setArrowsAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              PaperProps={{
                sx: {
                  bgcolor: '#313335',
                  border: '1px solid #4E5254',
                  p: 0.75,
                },
              }}
            >
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 36px)',
                gridTemplateRows: 'repeat(3, 36px)',
                gap: 0.5,
              }}
              >
                <Box />
                <IconButton
                  size="small"
                  onClick={() => sendTerminalKey('\x1b[A')}
                  title="Arrow Up"
                  sx={{
                    bgcolor: '#3C3F41',
                    color: '#A9B7C6',
                    borderRadius: '4px',
                    '&:hover': { bgcolor: '#4E5254', color: '#FFFFFF' },
                  }}
                >
                  <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box />
                <IconButton
                  size="small"
                  onClick={() => sendTerminalKey('\x1b[D')}
                  title="Arrow Left"
                  sx={{
                    bgcolor: '#3C3F41',
                    color: '#A9B7C6',
                    borderRadius: '4px',
                    '&:hover': { bgcolor: '#4E5254', color: '#FFFFFF' },
                  }}
                >
                  <KeyboardArrowLeftIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box />
                <IconButton
                  size="small"
                  onClick={() => sendTerminalKey('\x1b[C')}
                  title="Arrow Right"
                  sx={{
                    bgcolor: '#3C3F41',
                    color: '#A9B7C6',
                    borderRadius: '4px',
                    '&:hover': { bgcolor: '#4E5254', color: '#FFFFFF' },
                  }}
                >
                  <KeyboardArrowRightIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box />
                <IconButton
                  size="small"
                  onClick={() => sendTerminalKey('\x1b[B')}
                  title="Arrow Down"
                  sx={{
                    bgcolor: '#3C3F41',
                    color: '#A9B7C6',
                    borderRadius: '4px',
                    '&:hover': { bgcolor: '#4E5254', color: '#FFFFFF' },
                  }}
                >
                  <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box />
              </Box>
            </Popover>
            <Box
              component="button"
              type="button"
              onClick={() => sendTerminalKey('\x1b')}
              disabled={instance.status === 'exited'}
              title="Send ESC key"
              sx={{
                bgcolor: '#3C3F41',
                color: '#A9B7C6',
                border: '1px solid #4E5254',
                borderRadius: '4px',
                px: 1.25,
                py: 0.4,
                fontSize: '0.7rem',
                fontFamily: '"JetBrains Mono", "Consolas", monospace',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: '#4E5254', borderColor: '#6897BB' },
                '&:active': { bgcolor: '#2B2B2B' },
                '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
              }}
            >
              ESC
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => sendTerminalKey('\x03')}
              disabled={instance.status === 'exited'}
              title="Send Ctrl+C (interrupt running command, does not stop the instance)"
              sx={{
                bgcolor: '#3C3F41',
                color: '#A9B7C6',
                border: '1px solid #4E5254',
                borderRadius: '4px',
                px: 1.25,
                py: 0.4,
                fontSize: '0.7rem',
                fontFamily: '"JetBrains Mono", "Consolas", monospace',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: '#4E5254', borderColor: '#CC7832' },
                '&:active': { bgcolor: '#2B2B2B' },
                '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
              }}
            >
              Ctrl+C
            </Box>
          </Box>
          <TerminalWidget
            ref={termRef}
            onData={handleTerminalData}
            onResize={handleResize}
          />
        </Box>

        {/* Activity panel (Claude and Observer instances) */}
        {(instance.type === 'claude' || instance.type === 'observer') && (
          <>
            {/* Resize handle (desktop only) */}
            {!isMobile && (
              <Box
                onMouseDown={handleResizeStart}
                sx={{
                  width: 4,
                  cursor: 'col-resize',
                  bgcolor: 'transparent',
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#6897BB55' },
                  transition: 'background-color 0.15s',
                }}
              />
            )}
            <Box sx={{
              width: isMobile ? '100%' : panelWidth,
              flexShrink: 0,
              display: isMobile && mobileTab !== 0 ? 'none' : 'flex',
              flexDirection: 'column',
              borderLeft: isMobile ? 'none' : '1px solid #3C3F41',
              bgcolor: '#313335',
            }}
            >
              {/* Sticky header with "Show more" — always visible above the feed */}
              {hiddenCount > 0 && (
              <Box
                onClick={showMore}
                role="button"
                className="no-select"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  py: 0.75,
                  cursor: 'pointer',
                  borderBottom: '1px solid #3C3F41',
                  bgcolor: '#2B2B2B',
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#363839' },
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#808080', flex: 1 }}>
                  Show 5 more ({hiddenCount} older)
                </Typography>
                <IconButton size="small" sx={{ p: 0 }}>
                  <ExpandLessIcon sx={{ fontSize: 18, color: '#808080' }} />
                </IconButton>
              </Box>
              )}
              {/* Activity feed */}
              <Box
                ref={feedRef}
                sx={{
                  flex: 1, overflow: 'auto', px: 1, py: 1,
                }}
              >
                {feed.length === 0 && !isProcessing && (
                <Typography sx={{
                  color: '#606366', fontSize: '0.8rem', textAlign: 'center', mt: 4,
                }}
                >
                  No activity yet. Send a message to get started.
                </Typography>
                )}

                {visibleFeed.map(item => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    instanceId={instanceId}
                    size="lg"
                    onOpen={({ title, content }) => setViewingMessage({ title, text: content })}
                  />
                ))}

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

              {/* Plans — show only the last plan; history icon opens full list */}
              {plans.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderTop: '1px solid #3C3F41' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{
                    fontSize: '0.75rem', color: '#808080', fontWeight: 600,
                  }}
                  >PLANS
                  </Typography>
                  {plans.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={e => setPlansAnchorEl(e.currentTarget)}
                      sx={{ p: 0, ml: 'auto' }}
                    >
                      <HistoryIcon sx={{ fontSize: 16, color: '#808080' }} />
                    </IconButton>
                  )}
                </Box>
                <Box
                  onClick={() => {
                    const lp = plans[plans.length - 1];
                    if (!lp.seen) markPlanSeen(instanceId, lp.id);
                    handleOpenPlan(lp);
                  }}
                  onMouseEnter={() => {
                    const lp = plans[plans.length - 1];
                    if (!lp.seen) markPlanSeen(instanceId, lp.id);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
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
                    sx={{ fontSize: '0.8rem', color: '#6897BB', lineHeight: 1.4 }}
                  >
                    {plans[plans.length - 1].title || 'Untitled Plan'}
                  </Typography>
                </Box>
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
                    fontSize: '0.75rem', color: '#808080', fontWeight: 600, px: 1.5, py: 0.5,
                  }}
                  >
                    ALL PLANS
                  </Typography>
                  {plans.map((plan, idx) => (
                    <Typography
                      key={idx}
                      onClick={() => { handleOpenPlan(plan); setPlansAnchorEl(null); }}
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

              {/* The question waiting for an answer, with its options */}
              {pending && Array.isArray(pending.choices) && pending.choices.length > 0 && (
                <PendingChoices
                  choices={pending.choices}
                  question={latestQuestion(feed)}
                  collapsed={pendingCollapsed}
                  onToggle={() => setPendingCollapsed(c => !c)}
                  onChoose={handleChoiceClick}
                />
              )}

              {/* Input */}
              <FileDropZone enabled={attachments.enabled} onFiles={attachments.addFiles} sx={{ flexShrink: 0 }}>
                <Box sx={{ px: 1, py: 0.5, borderTop: '1px solid #3C3F41' }}>
                  <ChatInput
                    value={inputText}
                    onChange={setInputText}
                    onSend={handleSend}
                    disabled={instance.status === 'exited'}
                    maxRows={4}
                    attachments={attachments}
                  />
                </Box>
              </FileDropZone>
            </Box>
          </>
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
      {StopConfirmDialog}
    </Box>
  );
};

export default InstanceWindow;
