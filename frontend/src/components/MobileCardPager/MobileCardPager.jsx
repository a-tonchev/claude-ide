import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import TerminalIcon from '@mui/icons-material/Terminal';
import { ArrowFatLinesUp } from '@phosphor-icons/react';

import InstanceTerminal from '@/components/InstanceTerminal/InstanceTerminal';
import { STATUS_CONFIG, getInstanceTitle } from '@/helpers/instanceHelper';

// How long the pager waits after the last scroll event before it treats a swipe as done
const SCROLL_SETTLE_MS = 120;

const SAVED_STATUS = { label: 'Saved', color: '#606366' };

// A page is { key, instance } for a running card or { key, item } for a saved one
const pageType = page => page.instance?.type || page.item?.type || 'claude';

const pageTitle = page => (page.instance ? getInstanceTitle(page.instance) : page.item?.name) || 'Untitled';

const pageStatus = page => {
  if (!page.instance) return SAVED_STATUS;
  if (page.instance.type === 'terminal') {
    return page.instance.status === 'exited' ? STATUS_CONFIG.exited : STATUS_CONFIG.running;
  }
  return STATUS_CONFIG[page.instance.status] || STATUS_CONFIG.running;
};

const TypeIcon = ({ type, size = 16, muted = false }) => {
  if (type === 'observer') return <ArrowFatLinesUp size={size} weight="bold" color={muted ? '#606366' : '#B07ACC'} />;
  if (type === 'terminal') return <TerminalIcon sx={{ fontSize: size, color: muted ? '#606366' : '#808080' }} />;
  return <AutoAwesomeIcon sx={{ fontSize: size, color: muted ? '#606366' : '#CC7832' }} />;
};

const tabsSx = {
  minHeight: 36,
  bgcolor: '#1A1A1A',
  borderBottom: '1px solid #3C3F41',
  flexShrink: 0,
  '& .MuiTab-root': {
    minHeight: 36, py: 0.5, fontSize: '0.8rem', color: '#808080', textTransform: 'none',
  },
  '& .Mui-selected': { color: '#A9B7C6 !important' },
  '& .MuiTabs-indicator': { bgcolor: '#6897BB' },
};

// Mobile view of a group's cards: one card per page, swiped sideways (CSS scroll snap),
// with a navigator row whose title opens a full-screen list of all cards. A running card
// has a Chat (or Info) tab with the card and a Terminal tab with its xterm.
const MobileCardPager = ({ pages, renderCard }) => {
  const scrollerRef = useRef(null);
  const settleTimer = useRef(null);
  const [activeKey, setActiveKey] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Chosen tab per page; terminals open on their Terminal tab
  const [views, setViews] = useState({});
  // Pages whose terminal was opened. They stay mounted, since the backend doesn't replay
  // output and a remounted xterm would come back empty.
  const [terminalKeys, setTerminalKeys] = useState(() => new Set());

  // When the active card goes away (stopped), stay at the same position
  const lastIndex = useRef(0);
  const keyIndex = pages.findIndex(p => p.key === activeKey);
  const activeIndex = keyIndex >= 0 ? keyIndex : Math.max(0, Math.min(lastIndex.current, pages.length - 1));
  lastIndex.current = activeIndex;
  const activePage = pages[activeIndex];

  const viewOf = useCallback(page => {
    if (!page.instance) return 'card';
    return views[page.key] || (page.instance.type === 'terminal' ? 'terminal' : 'card');
  }, [views]);

  // Follow the active page: after a pick, an arrow, or when cards were added or removed
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const left = activeIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - left) > 2) el.scrollTo({ left, behavior: 'smooth' });
  }, [activeIndex, pages.length]);

  // Remember a terminal once it is shown, so swiping away keeps its output
  useEffect(() => {
    if (activePage && viewOf(activePage) === 'terminal' && !terminalKeys.has(activePage.key)) {
      setTerminalKeys(prev => new Set(prev).add(activePage.key));
    }
  }, [activePage, viewOf, terminalKeys]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // A swipe is done once scrolling stops; the page it snapped to becomes the active one
  const handleScroll = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollerRef.current;
      if (!el || !el.clientWidth) return;
      const page = pages[Math.round(el.scrollLeft / el.clientWidth)];
      if (page) setActiveKey(page.key);
    }, SCROLL_SETTLE_MS);
  }, [pages]);

  const goTo = index => {
    const page = pages[index];
    if (page) setActiveKey(page.key);
  };

  if (!pages.length) return null;

  const status = pageStatus(activePage);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
    }}
    >
      {/* Navigator: previous / card title (opens the list) / next */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5,
        py: 0.5,
        bgcolor: '#1A1A1A',
        borderBottom: '1px solid #3C3F41',
        flexShrink: 0,
      }}
      >
        <IconButton
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous card"
          sx={{ color: '#A9B7C6', '&.Mui-disabled': { color: '#3C3F41' } }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <ButtonBase
          onClick={() => setPickerOpen(true)}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderRadius: 1,
            border: '1px solid #3C3F41',
            bgcolor: '#2B2B2B',
          }}
        >
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', bgcolor: status.color, flexShrink: 0,
          }}
          />
          <TypeIcon type={pageType(activePage)} size={14} muted={!activePage.instance} />
          <Typography sx={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: activePage.instance ? '#A9B7C6' : '#808080',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          >
            {pageTitle(activePage)}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#808080', flexShrink: 0 }}>
            {activeIndex + 1}/{pages.length}
          </Typography>
          <ArrowDropDownIcon sx={{ color: '#808080', flexShrink: 0 }} />
        </ButtonBase>
        <IconButton
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex >= pages.length - 1}
          aria-label="Next card"
          sx={{ color: '#A9B7C6', '&.Mui-disabled': { color: '#3C3F41' } }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Pages */}
      <Box
        ref={scrollerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {pages.map(page => {
          const view = viewOf(page);
          const isTerminal = pageType(page) === 'terminal';
          const terminalMounted = page.instance && (view === 'terminal' || terminalKeys.has(page.key));
          return (
            <Box
              key={page.key}
              sx={{
                flex: '0 0 100%',
                width: '100%',
                minWidth: 0,
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {page.instance && (
                <Tabs
                  value={view}
                  onChange={(e, v) => setViews(prev => ({ ...prev, [page.key]: v }))}
                  variant="fullWidth"
                  sx={tabsSx}
                >
                  <Tab value="card" label={isTerminal ? 'Info' : 'Chat'} />
                  <Tab value="terminal" label="Terminal" />
                </Tabs>
              )}
              <Box sx={{
                display: view === 'card' ? 'flex' : 'none',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                p: 1,
              }}
              >
                {renderCard(page)}
              </Box>
              {terminalMounted && (
                <Box sx={{
                  display: view === 'terminal' ? 'flex' : 'none',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}
                >
                  <InstanceTerminal instanceId={page.instance.id} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Full-screen list of the group's cards */}
      <Dialog
        fullScreen
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        PaperProps={{ sx: { bgcolor: '#2B2B2B', backgroundImage: 'none' } }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          minHeight: 52,
          bgcolor: '#1A1A1A',
          borderBottom: '1px solid #3C3F41',
          flexShrink: 0,
        }}
        >
          <IconButton onClick={() => setPickerOpen(false)} aria-label="Close" sx={{ color: '#A9B7C6' }}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#A9B7C6' }}>
            Cards
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {pages.map((page, index) => {
            const pStatus = pageStatus(page);
            const isActive = index === activeIndex;
            return (
              <ButtonBase
                key={page.key}
                onClick={() => { goTo(index); setPickerOpen(false); }}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2,
                  py: 1.5,
                  textAlign: 'left',
                  borderBottom: '1px solid #3C3F41',
                  bgcolor: isActive ? 'rgba(104,151,187,0.12)' : 'transparent',
                }}
              >
                <Typography sx={{
                  fontSize: '0.75rem', color: '#606366', width: 18, flexShrink: 0,
                }}
                >
                  {index + 1}
                </Typography>
                <TypeIcon type={pageType(page)} size={18} muted={!page.instance} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontSize: '0.95rem',
                    fontWeight: isActive ? 600 : 500,
                    color: page.instance ? '#A9B7C6' : '#808080',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  >
                    {pageTitle(page)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', bgcolor: pStatus.color,
                    }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', color: pStatus.color }}>
                      {pStatus.label}
                    </Typography>
                  </Box>
                </Box>
                {isActive && <CheckIcon sx={{ fontSize: 18, color: '#6897BB', flexShrink: 0 }} />}
              </ButtonBase>
            );
          })}
        </Box>
      </Dialog>
    </Box>
  );
};

export default MobileCardPager;
