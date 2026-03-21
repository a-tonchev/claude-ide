import {
  useEffect, useRef, useImperativeHandle, forwardRef,
} from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Box } from '@mui/material';
import 'xterm/css/xterm.css';

const TerminalWidget = forwardRef(({ instanceId, onData, onResize }, ref) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);

  // Expose write method to parent via ref
  useImperativeHandle(ref, () => ({
    write: data => {
      if (termRef.current) {
        termRef.current.write(data);
      }
    },
    clear: () => {
      if (termRef.current) {
        termRef.current.clear();
      }
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Consolas", "Courier New", monospace',
      theme: {
        background: '#2B2B2B',
        foreground: '#A9B7C6',
        cursor: '#A9B7C6',
        cursorAccent: '#2B2B2B',
        selectionBackground: '#214283',
        black: '#3C3F41',
        red: '#CC7832',
        green: '#6A8759',
        yellow: '#FFC66D',
        blue: '#6897BB',
        magenta: '#9876AA',
        cyan: '#299999',
        white: '#A9B7C6',
        brightBlack: '#808080',
        brightRed: '#D4843E',
        brightGreen: '#7A9769',
        brightYellow: '#FFD080',
        brightBlue: '#7AAACF',
        brightMagenta: '#AB89BD',
        brightCyan: '#4FBDBD',
        brightWhite: '#FFFFFF',
      },
      convertEol: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Initial fit
    try {
      fitAddon.fit();
    } catch {
      // Container might not be visible yet
    }

    // Report initial size
    if (onResize) {
      onResize(term.cols, term.rows);
    }

    // Forward user keyboard input
    term.onData(data => {
      if (onData) onData(data);
    });

    // Throttled scroll-to-bottom after renders (covers writes, fit, resize, reflow)
    let scrollRafId = null;
    term.onRender(() => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        const viewport = containerRef.current?.querySelector('.xterm-viewport');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      });
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Resize handler — refit terminal on container or window size change
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (onResize) {
          onResize(term.cols, term.rows);
        }
      } catch {
        // Ignore fit errors on unmounted
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [instanceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        width: '100%',
        bgcolor: '#2B2B2B',
        overflow: 'hidden',
        '& .xterm': {
          height: '100%',
          padding: '8px',
        },
        '& .xterm-viewport': {
          overflowY: 'auto',
        },
      }}
    />
  );
});

TerminalWidget.displayName = 'TerminalWidget';

export default TerminalWidget;
