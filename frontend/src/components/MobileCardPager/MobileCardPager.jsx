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

import {
  ArrowDropDownIcon,
  ArrowFatLinesUpIcon as ArrowFatLinesUp,
  AutoAwesomeIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  TerminalIcon,
} from '@/components/Icons/Icons';
import InstanceTerminal from '@/components/InstanceTerminal/InstanceTerminal';
import MinifiedSidebar from '@/components/MinifiedSidebar/MinifiedSidebar';
import { STATUS_CONFIG, getInstanceTitle } from '@/helpers/instanceHelper';

// How long the pager waits after the last scroll event before it treats a swipe as done
const SCROLL_SETTLE_MS = 70;
// An arrow, a pick from the list or a restored card slides over in this long (the browser's
// own smooth scroll took about half a second)
const SLIDE_MS = 180;

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
// activeKey (the ?card= URL param) is the shown page's key. A key that isn't in pages yet,
// such as a card just added or one still loading after a refresh, opens once it appears.
const MobileCardPager = ({
  pages, renderCard, activeKey, onActiveKeyChange, minimized = [], onRestoreMinimized,
}) => {
  const scrollerRef = useRef(null);
  const settleTimer = useRef(null);
  // The running slide: { frame, left } while one is under way
  const slide = useRef(null);
  // The page in view while a finger swipe is under way, so the title follows at once
  const [liveIndex, setLiveIndex] = useState(null);
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

  // Slides to a page with an ease-out. Scroll snapping is off meanwhile, or it would fight
  // the frames.
  const slideTo = useCallback(index => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const left = index * el.clientWidth;
    if (slide.current?.left === left) return;
    if (slide.current) cancelAnimationFrame(slide.current.frame);
    if (Math.abs(el.scrollLeft - left) <= 2) {
      slide.current = null;
      return;
    }
    const start = el.scrollLeft;
    const startedAt = performance.now();
    el.style.scrollSnapType = 'none';
    const step = now => {
      const t = Math.min(1, (now - startedAt) / SLIDE_MS);
      el.scrollLeft = start + (left - start) * (1 - (1 - t) ** 3);
      if (t < 1) {
        slide.current.frame = requestAnimationFrame(step);
      } else {
        el.style.scrollSnapType = '';
        slide.current = null;
      }
    };
    slide.current = { left, frame: requestAnimationFrame(step) };
  }, []);

  // Follow the active page: after a pick, an arrow, or when cards were added or removed
  useEffect(() => {
    slideTo(activeIndex);
  }, [activeIndex, pages.length, slideTo]);

  useEffect(() => () => {
    if (slide.current) cancelAnimationFrame(slide.current.frame);
  }, []);

  // Remember a terminal once it is shown, so swiping away keeps its output
  useEffect(() => {
    if (activePage && viewOf(activePage) === 'terminal' && !terminalKeys.has(activePage.key)) {
      setTerminalKeys(prev => new Set(prev).add(activePage.key));
    }
  }, [activePage, viewOf, terminalKeys]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // A swipe is done once scrolling stops; the page it snapped to becomes the active one
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    if (!slide.current) {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setLiveIndex(prev => (prev === index ? prev : index));
    }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setLiveIndex(null);
      if (slide.current || !el.clientWidth) return;
      const page = pages[Math.round(el.scrollLeft / el.clientWidth)];
      if (page && page.key !== activeKey) onActiveKeyChange(page.key);
    }, SCROLL_SETTLE_MS);
  }, [pages, activeKey, onActiveKeyChange]);

  // The slide starts right away; the URL (and the parent) follow
  const goTo = index => {
    const page = pages[index];
    if (!page) return;
    slideTo(index);
    onActiveKeyChange(page.key);
  };

  if (!pages.length) return null;

  // The navigator shows the page under the finger during a swipe
  const shownIndex = liveIndex !== null && pages[liveIndex] ? liveIndex : activeIndex;
  const shownPage = pages[shownIndex];
  const status = pageStatus(shownPage);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
    }}
    >
      {/* Navigator: card title (opens the list), then previous / next side by side */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        pl: 1,
        pr: 0.5,
        py: 0.5,
        bgcolor: '#1A1A1A',
        borderBottom: '1px solid #3C3F41',
        flexShrink: 0,
      }}
      >
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
          <TypeIcon type={pageType(shownPage)} size={14} muted={!shownPage.instance} />
          <Typography sx={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: shownPage.instance ? '#A9B7C6' : '#808080',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          >
            {pageTitle(shownPage)}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#808080', flexShrink: 0 }}>
            {shownIndex + 1}/{pages.length}
          </Typography>
          <ArrowDropDownIcon sx={{ color: '#808080', flexShrink: 0 }} />
        </ButtonBase>
        <IconButton
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous card"
          sx={{ color: '#A9B7C6', '&.Mui-disabled': { color: '#3C3F41' } }}
        >
          <ChevronLeftIcon />
        </IconButton>
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
          {/* Minimized cards: left out of the pages, restored (and opened) from here */}
          <MinifiedSidebar
            variant="row"
            instances={minimized}
            onRestore={id => { setPickerOpen(false); onRestoreMinimized?.(id); }}
          />
        </Box>
      </Dialog>
    </Box>
  );
};

export default MobileCardPager;
