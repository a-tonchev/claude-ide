import React, {
  useRef, useEffect, useCallback, useState,
} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TerminalIcon from '@mui/icons-material/Terminal';

import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import useWebSocket from '@/hooks/useWebSocket';

const PlaceholderSlot = ({
  instanceId, instance, instances, onSelect, onClear, send,
}) => {
  const termRef = useRef(null);

  const onMessage = useCallback(msg => {
    if (!instanceId) return;
    if (msg.type === 'output' && msg.instanceId === instanceId) {
      termRef.current?.write(msg.data);
    }
  }, [instanceId]);

  useWebSocket(onMessage);

  // Subscribe/unsubscribe on instanceId change
  useEffect(() => {
    if (!instanceId) return;
    send('subscribe', { instanceId });
    return () => {
      send('unsubscribe', { instanceId });
    };
  }, [instanceId, send]);

  const handleTerminalData = useCallback(data => {
    if (instanceId) {
      send('input', { instanceId, data });
    }
  }, [instanceId, send]);

  const handleResize = useCallback((cols, rows) => {
    if (instanceId) {
      send('resize', { instanceId, cols, rows });
    }
  }, [instanceId, send]);

  const instanceList = Object.values(instances || {});

  const renderInstanceName = val => {
    const inst = instanceList.find(i => i.id === val);
    return inst ? (inst.projectName || inst.name || val.slice(0, 8)) : 'Select...';
  };

  if (!instanceId) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#2B2B2B',
          border: '1px solid #3C3F41',
          borderRadius: 1,
          minHeight: 200,
        }}
      >
        <Box sx={{
          px: 1.5, py: 0.75, borderBottom: '1px solid #3C3F41', display: 'flex', alignItems: 'center',
        }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: '#606366', flex: 1 }}>
            No terminal selected
          </Typography>
          <Select
            size="small"
            displayEmpty
            value=""
            onChange={e => onSelect(e.target.value)}
            renderValue={renderInstanceName}
            sx={{
              fontSize: '0.7rem',
              color: '#808080',
              height: 24,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4E5254' },
            }}
          >
            <MenuItem value="" disabled>Select instance...</MenuItem>
            {instanceList.map(inst => (
              <MenuItem key={inst.id} value={inst.id} sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {inst.type === 'claude'
                  ? <AutoAwesomeIcon sx={{ fontSize: 13, color: '#CC7832' }} />
                  : <TerminalIcon sx={{ fontSize: 13, color: '#808080' }} />}
                {inst.projectName || inst.name || inst.id.slice(0, 8)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: '#4E5254' }}>
            Click &quot;Open in placeholder&quot; on a card
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#2B2B2B',
        border: '1px solid #3C3F41',
        borderRadius: 1,
        minHeight: 200,
      }}
    >
      <Box sx={{
        px: 1.5, py: 0.5, borderBottom: '1px solid #3C3F41', display: 'flex', alignItems: 'center', gap: 1,
      }}
      >
        {instance?.type === 'claude'
          ? <AutoAwesomeIcon sx={{ fontSize: 14, color: '#CC7832', flexShrink: 0 }} />
          : <TerminalIcon sx={{ fontSize: 14, color: '#808080', flexShrink: 0 }} />}
        <Typography sx={{
          fontSize: '0.75rem', color: '#A9B7C6', fontWeight: 500, flex: 1,
        }}
        >
          {instance?.projectName || instance?.name || instanceId.slice(0, 8)}
        </Typography>
        <Select
          size="small"
          value={instanceId}
          onChange={e => onSelect(e.target.value)}
          renderValue={renderInstanceName}
          sx={{
            fontSize: '0.7rem',
            color: '#808080',
            height: 24,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#4E5254' },
          }}
        >
          {instanceList.map(inst => (
            <MenuItem key={inst.id} value={inst.id} sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {inst.type === 'claude'
                ? <AutoAwesomeIcon sx={{ fontSize: 13, color: '#CC7832' }} />
                : <TerminalIcon sx={{ fontSize: 13, color: '#808080' }} />}
              {inst.projectName || inst.name || inst.id.slice(0, 8)}
            </MenuItem>
          ))}
        </Select>
        <IconButton size="small" onClick={() => onClear()} sx={{ p: 0, color: '#808080' }}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TerminalWidget
          key={instanceId}
          ref={termRef}
          onData={handleTerminalData}
          onResize={handleResize}
        />
      </Box>
    </Box>
  );
};

const PlaceholderPanel = ({
  placeholder1Id, placeholder2Id, instances, onSelect1, onSelect2, onClear1, onClear2,
}) => {
  const { send } = useWebSocket();

  return (
    <Box sx={{
      display: 'flex', gap: 1, px: 1, py: 1, flex: 1, minHeight: 0,
    }}
    >
      <PlaceholderSlot
        instanceId={placeholder1Id}
        instance={instances?.[placeholder1Id]}
        instances={instances}
        onSelect={onSelect1}
        onClear={onClear1}
        send={send}
      />
      <PlaceholderSlot
        instanceId={placeholder2Id}
        instance={instances?.[placeholder2Id]}
        instances={instances}
        onSelect={onSelect2}
        onClear={onClear2}
        send={send}
      />
    </Box>
  );
};

export default PlaceholderPanel;
