import React, { useRef, useEffect, useCallback } from 'react';

import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import useWebSocket from '@/hooks/useWebSocket';

// An xterm wired to one instance: shows its output and sends keystrokes and size back.
// The backend doesn't replay old output, so a terminal shows what arrives while mounted.
const InstanceTerminal = ({ instanceId }) => {
  const termRef = useRef(null);

  const onMessage = useCallback(msg => {
    if (msg.type === 'output' && msg.instanceId === instanceId) {
      termRef.current?.write(msg.data);
    }
  }, [instanceId]);

  const { send } = useWebSocket(onMessage);

  // Make sure this window receives the instance's output. It is never unsubscribed: the
  // window has a single connection, so dropping the topic would also silence that
  // instance's messages and status in the cards until the page is reloaded.
  useEffect(() => {
    if (instanceId) send('subscribe', { instanceId });
  }, [instanceId, send]);

  const handleTerminalData = useCallback(data => {
    send('input', { instanceId, data });
  }, [instanceId, send]);

  const handleResize = useCallback((cols, rows) => {
    send('resize', { instanceId, cols, rows });
  }, [instanceId, send]);

  return (
    <TerminalWidget
      key={instanceId}
      ref={termRef}
      onData={handleTerminalData}
      onResize={handleResize}
    />
  );
};

export default InstanceTerminal;
