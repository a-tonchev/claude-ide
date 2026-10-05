import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import IconButton from '@mui/material/IconButton';

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

// The card's one status: a coloured dot and its label. In the header only the dot shows
// (dotOnly), so the name keeps its room; the label sits in the card's footer.
export const StatusMark = ({ status, dotOnly = false }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.running;
  return (
    <Box
      title={config.label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        flexShrink: 1,
        minWidth: 8,
        maxWidth: dotOnly ? 8 : '100%',
        color: config.color,
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Box sx={{
        width: 8, height: 8, flexShrink: 0, borderRadius: '50%', bgcolor: config.color,
      }}
      />
      {!dotOnly && <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.label}</Box>}
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
  const isLong = full.length > LONG_TEXT;
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
        py: size === 'lg' ? 0.6 : 0.4,
        borderRadius: '6px',
        ...(item.kind === 'user' && {
          bgcolor: 'rgba(255,255,255,0.04)', px: 0.75, my: 0.25,
        }),
        ...(isLong && { cursor: 'pointer', '&:hover': { bgcolor: '#3C3F41' } }),
      }}
    >
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
          // The full question is in the feed above; here it stays short so the options and the
          // input keep their room in a small card
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: collapsed ? 1 : 2,
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
