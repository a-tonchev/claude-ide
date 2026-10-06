import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import {
  BookmarkBorderIcon, BookmarkIcon, ExpandLessIcon, ExpandMoreIcon,
} from '@/components/Icons/Icons';
import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';
import { FeedAttachments } from '@/components/Attachments/Attachments';
import { STATUS_CONFIG } from '@/helpers/instanceHelper';

// Shared pieces of the AI cards (Claude and Observer), in the polished Darcula style.

export const CARD_COLORS = {
  card: '#313335',
  border: '#3C3F41',
  text: '#A9B7C6',
  strong: '#D6DCE3',
  user: '#C5A5D6',
  muted: '#808080',
  faint: '#606366',
  waiting: '#CC7832',
};

const LONG_TEXT = 250;
const SHORT_TEXT = 200;

// The card frame. Its edge takes the status colour (orange while a question waits), except
// once the work is completed, when the card goes quiet.
const edgeColor = (status, waiting) => {
  if (waiting) return `${CARD_COLORS.waiting}99`;
  if (!status || status === 'completed') return CARD_COLORS.border;
  return `${(STATUS_CONFIG[status] || STATUS_CONFIG.running).color}99`;
};

export const cardSx = ({ status = null, waiting = false, fill = false } = {}) => ({
  bgcolor: CARD_COLORS.card,
  border: `1px solid ${edgeColor(status, waiting)}`,
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  // fill: the card takes its container's full height (one card per page on mobile)
  height: fill ? '100%' : undefined,
  maxHeight: fill ? 'none' : 'calc(40vh - 36px)',
});

// A header title with its status: the dot in front of the title, the status label as a tiny
// caption under it, lined up with the title's first letter
export const StatusTitle = ({ status, children }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.running;
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '8px minmax(0, 1fr)',
      columnGap: 0.75,
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    }}
    >
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%', bgcolor: config.color,
      }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>{children}</Box>
      <Typography sx={{
        gridColumn: 2,
        fontSize: '0.62rem',
        fontWeight: 500,
        lineHeight: 1.2,
        color: config.color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      >
        {config.label}
      </Typography>
    </Box>
  );
};

// Bookmark: a saved instance is kept through manual stops, group deletes and restarts
export const SaveToggle = ({ saved, onToggle, size = 16 }) => (
  <IconButton
    size="small"
    onClick={onToggle}
    title={saved ? 'Saved — click to unsave' : 'Save this instance (kept until you remove it from Saved)'}
    aria-label={saved ? 'Unsave instance' : 'Save instance'}
    aria-pressed={!!saved}
    sx={{ color: saved ? '#6897BB' : '#808080', '&:hover': { color: '#89B8DE' } }}
  >
    {saved ? <BookmarkIcon sx={{ fontSize: size }} /> : <BookmarkBorderIcon sx={{ fontSize: size }} />}
  </IconButton>
);

// Provider and similar facts on the right of a card header
export const HeaderMeta = ({ children }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: '0.72rem',
    color: CARD_COLORS.muted,
  }}
  >
    {children}
  </Box>
);

const MESSAGE_COLORS = {
  success: '#7CB368',
  warning: '#CC7832',
  error: '#D25450',
  question: '#CC7832',
};

// Each feed item is a bubble; the kind sets its tint, a message's type its left edge
const bubbleSx = item => {
  if (item.kind === 'user') {
    return {
      bgcolor: `${CARD_COLORS.user}14`,
      border: `1px solid ${CARD_COLORS.user}33`,
      borderRight: `2px solid ${CARD_COLORS.user}`,
    };
  }
  if (item.kind === 'message') {
    return {
      bgcolor: 'rgba(255,255,255,0.035)',
      border: `1px solid ${CARD_COLORS.border}`,
      borderLeft: `2px solid ${MESSAGE_COLORS[item.type] || '#6897BB'}`,
    };
  }
  return { bgcolor: 'rgba(124,179,104,0.06)', border: '1px solid rgba(124,179,104,0.18)' };
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "09:35" today, "5 Oct 09:35" on earlier days
const formatFeedTime = date => {
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay(date, new Date())) return time;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
};

// Floats in the bubble's top-right corner, so the text flows around it
const FeedTime = ({ timestamp }) => {
  const date = timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return (
    <Box
      component="span"
      title={date.toLocaleString()}
      sx={{
        float: 'right',
        ml: 1,
        fontSize: '0.68rem',
        lineHeight: 1.9,
        color: CARD_COLORS.faint,
        whiteSpace: 'nowrap',
      }}
    >
      {formatFeedTime(date)}
    </Box>
  );
};

const ReadMore = () => (
  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
    Click to read full message
  </Typography>
);

// One feed item: a user message (with its attachments), an AI message or a milestone.
// Long items are shortened; a click opens the whole text through onOpen({ title, content }).
// size "lg": the instance window's roomier text
export const FeedItem = ({
  item, instanceId, onOpen, size = 'md',
}) => {
  const fontSize = size === 'lg' ? '0.92rem' : '0.84rem';
  let full;
  let title;
  if (item.kind === 'user') {
    full = item.text || '';
    title = 'User Message';
  } else if (item.kind === 'message') {
    full = item.text || '';
    title = 'Message';
  } else {
    full = `${item.accomplished || ''}${item.workingOn ? ` → ${item.workingOn}` : ''}`;
    title = 'Milestone';
  }
  // Questions always show in full: they have to be read to be answered
  const isQuestion = item.kind === 'message' && item.type === 'question';
  const isLong = !isQuestion && full.length > LONG_TEXT;
  const open = isLong ? () => onOpen?.({ title, content: full }) : undefined;

  let body;
  if (item.kind === 'user') {
    body = (
      <>
        <Typography sx={{
          fontSize,
          color: CARD_COLORS.user,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
        >
          {isLong ? `${full.slice(0, SHORT_TEXT)}...` : full}
        </Typography>
        <FeedAttachments instanceId={instanceId} attachments={item.attachments} />
      </>
    );
  } else if (item.kind === 'message') {
    const color = MESSAGE_COLORS[item.type] || CARD_COLORS.text;
    body = (
      <MarkdownRenderer
        content={isLong ? `${full.slice(0, SHORT_TEXT)}...` : full}
        fontSize={fontSize}
        sx={{
          color,
          lineHeight: 1.45,
          '& p': { mb: 0.25 },
          '& p:last-child': { mb: 0 },
          '& pre': { p: 0.75, mb: 0.5, fontSize: '0.85rem' },
          '& ul, & ol': { pl: 2, mb: 0.25 },
          '& li': { mb: 0 },
          '& h1, & h2, & h3': { fontSize: '0.88rem', mt: 0.5, mb: 0.25 },
        }}
      />
    );
  } else {
    body = (
      <Typography sx={{
        fontSize, lineHeight: 1.45, color: CARD_COLORS.muted, overflowWrap: 'anywhere',
      }}
      >
        <Box component="span" sx={{ color: '#7CB368' }}>
          {isLong ? `${(item.accomplished || '').slice(0, SHORT_TEXT)}...` : item.accomplished}
        </Box>
        {!isLong && item.workingOn && ` → ${item.workingOn}`}
      </Typography>
    );
  }

  return (
    <Box
      onClick={open}
      sx={{
        px: 1,
        py: size === 'lg' ? 0.6 : 0.4,
        mb: 0.75,
        borderRadius: '6px',
        display: 'flow-root',
        ...bubbleSx(item),
        ...(isLong && { cursor: 'pointer', '&:hover': { bgcolor: '#3C3F41' } }),
      }}
    >
      <FeedTime timestamp={item.timestamp} />
      {body}
      {isLong && <ReadMore />}
    </Box>
  );
};

// The question waiting for an answer, edge to edge across the card. The question text is the
// newest "question" message in the feed. ˅ folds the options away, ˄ opens them again.
// maxListHeight: past it the options scroll, so a long list can't push the input out of a card
export const PendingChoices = ({
  choices, question, collapsed, onToggle, onChoose, maxListHeight = '30vh',
}) => (
  <Box sx={{
    px: 1,
    py: 0.5,
    bgcolor: `${CARD_COLORS.waiting}14`,
    borderTop: `1px solid ${CARD_COLORS.waiting}55`,
    borderBottom: `1px solid ${CARD_COLORS.waiting}55`,
    flexShrink: 0,
  }}
  >
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1, mb: collapsed ? 0 : 0.5,
    }}
    >
      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.72rem',
          fontWeight: 500,
          color: '#BBC4CF',
          lineHeight: 1.35,
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
          // Open: the whole question, scrolling past a height so the options and input keep
          // their room. Folded: one line.
          ...(collapsed ? {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 1,
          } : { maxHeight: maxListHeight, overflowY: 'auto' }),
        }}
        title={question}
      >
        {question || 'Choose an option'}
      </Typography>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show options' : 'Hide options'}
        sx={{
          all: 'unset',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          px: 0.5,
          height: 22,
          borderRadius: '6px',
          fontSize: '0.72rem',
          color: CARD_COLORS.muted,
          '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.07)' },
          '&:focus-visible': { outline: '2px solid #6897BB', outlineOffset: 1 },
        }}
      >
        {collapsed && `${choices.length} option${choices.length === 1 ? '' : 's'}`}
        {collapsed ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>
    </Box>
    {!collapsed && (
      <Box sx={{
        display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: maxListHeight, overflowY: 'auto',
      }}
      >
        {choices.map((choice, idx) => (
          <Box
            key={idx}
            component="button"
            type="button"
            onClick={() => onChoose(choice)}
            sx={{
              bgcolor: '#214283',
              color: '#C9D3DD',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontFamily: 'inherit',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              width: '100%',
              lineHeight: 1.4,
              px: 1.25,
              py: 0.6,
              cursor: 'pointer',
              '&:hover': { bgcolor: '#2E5AA7' },
              '&:active': { bgcolor: '#1A3666' },
              '&:focus-visible': { outline: '2px solid #6897BB', outlineOffset: 1 },
            }}
          >
            {choice}
          </Box>
        ))}
      </Box>
    )}
  </Box>
);

// The newest question the agent asked, for the options block
export const latestQuestion = feed => {
  for (let i = feed.length - 1; i >= 0; i -= 1) {
    if (feed[i].kind === 'message' && feed[i].type === 'question') return feed[i].text;
  }
  return '';
};
