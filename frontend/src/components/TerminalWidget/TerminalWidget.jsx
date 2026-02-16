import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
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
    } catch (e) {
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

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Window resize handler
    const handleWindowResize = () => {
      try {
        fitAddon.fit();
        if (onResize) {
          onResize(term.cols, term.rows);
        }
      } catch (e) {
        // Ignore fit errors on unmounted
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
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
