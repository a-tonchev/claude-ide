import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import TvIcon from '@mui/icons-material/Tv';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StopIcon from '@mui/icons-material/Stop';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import MinimizeIcon from '@mui/icons-material/Minimize';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import { ArrowFatLinesUp } from '@phosphor-icons/react';
import DescriptionIcon from '@mui/icons-material/Description';
import HistoryIcon from '@mui/icons-material/History';

import ChatInput from '@/components/ChatInput/ChatInput';
import {
  CARD_COLORS, FeedItem, HeaderMeta, PendingChoices, StatusMark, cardSx, latestQuestion,
} from '@/components/CardParts/CardParts';
import { FileDropZone } from '@/components/Attachments/Attachments';
import useAttachments from '@/hooks/useAttachments';
import EditableTitle from '@/components/EditableTitle/EditableTitle';
import { useStoreFamilyValue } from '@/components/state/GlobalState';
import { InstanceStores, setInputDraft, markPlanSeen } from '@/stores/instanceAtoms';
import { getInstanceTitle } from '@/helpers/instanceHelper';
import useFeedWindow from '@/hooks/useFeedWindow';

const ObserverCard = ({
  instance,
  expanded,
  onToggleExpand,
  onOpenPlaceholder,
  onOpenWindow,
  onStop,
  onSendInput,
  onSendResponse,
  onViewPlan,
  onViewInstructions,
  onMinimize,
  onMoveToGroup,
  onRename,
  fill = false,
}) => {
  const inputText = useStoreFamilyValue(InstanceStores.inputDraftFamilyStore, instance.id);
  const [plansAnchorEl, setPlansAnchorEl] = useState(null);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const feedRef = useRef(null);

  const plans = instance.plans || [];
  const pending = instance.pendingInput;

  // The feed as stored in the database; an expanded card shows every loaded item.
  // Keys are the stored ids, so appends don't force MarkdownRenderer to re-parse the visible feed.
  const {
    feed, visibleFeed, hiddenCount, showMore, newestId,
  } = useFeedWindow(instance, { showAll: expanded });

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
      <Card sx={cardSx({ status: instance.status, waiting: !!pending?.choices?.length, fill })}>
        {/* Header: status + editable title + show-more, single compact row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.6,
            borderBottom: `1px solid ${CARD_COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <StatusMark status={instance.status} dotOnly />
          <EditableTitle
            title={getInstanceTitle(instance)}
            onRename={title => onRename?.(instance.id, title)}
            fontSize="0.84rem"
            color={CARD_COLORS.strong}
            icon={<ArrowFatLinesUp size={13} weight="bold" color="#B07ACC" style={{ flexShrink: 0 }} />}
          />
          <HeaderMeta>Observer</HeaderMeta>
          {hiddenCount > 0 && (
            <Box
              onClick={showMore}
              role="button"
              className="no-select"
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

        {/* Activity Feed */}
        {feed.length > 0 && (
          <Box sx={{
            px: 1,
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
              {visibleFeed.map(item => (
                <FeedItem key={item.id} item={item} instanceId={instance.id} onOpen={onViewPlan} />
              ))}
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
        {feed.length === 0 && isProcessing && (
          <Box sx={{
            px: 1.5, py: 0.5, borderBottom: '1px solid #3C3F41', flexShrink: 0,
          }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CircularProgress size={10} sx={{ color: '#6897BB' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#6897BB', fontStyle: 'italic' }}>
                Observer is working...
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

        {/* The question waiting for an answer, with its options */}
        {pending && Array.isArray(pending.choices) && pending.choices.length > 0 && (
          <PendingChoices
            choices={pending.choices}
            question={latestQuestion(feed)}
            collapsed={pendingCollapsed}
            onToggle={() => setPendingCollapsed(c => !c)}
            onChoose={choice => onSendResponse(instance.id, choice)}
            maxListHeight={fill ? '30vh' : 'min(30vh, 160px)'}
          />
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
          className="no-select"
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
          <IconButton
            size="small"
            onClick={() => onViewInstructions?.(instance.projectId, instance.projectName)}
            title="View instructions"
            sx={{ color: '#B07ACC', '&:hover': { color: '#C5A5D6' } }}
          >
            <DescriptionIcon sx={{ fontSize: 16 }} />
          </IconButton>
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
          <Box sx={{
            flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', px: 0.5,
          }}
          >
            <StatusMark status={instance.status} />
          </Box>
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

export default React.memo(ObserverCard);
