import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import TerminalIcon from '@mui/icons-material/Terminal';
import { Helmet } from 'react-helmet-async';

import TerminalWidget from '@/components/TerminalWidget/TerminalWidget';
import InputBar from '@/components/InputBar/InputBar';
import UrlEnums from '@/components/connections/enums/UrlEnums';
import useInstances from '@/hooks/useInstances';

const InstanceView = () => {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const termRef = useRef(null);

  const {
    instances,
    writeToInstance,
    resizeInstance,
    stopInstance,
    subscribeInstance,
    unsubscribeInstance,
    requestPlan,
  } = useInstances(message => {
    if (message.type === 'output' && message.instanceId === instanceId) {
      termRef.current?.write(message.data);
    }
  });

  const instance = instances?.[instanceId];

  useEffect(() => {
    if (instanceId) {
      subscribeInstance(instanceId);
    }
    return () => {
      if (instanceId) {
        unsubscribeInstance(instanceId);
      }
    };
  }, [instanceId, subscribeInstance, unsubscribeInstance]);

  const handleTerminalData = useCallback(data => {
    writeToInstance(instanceId, data);
  }, [instanceId, writeToInstance]);

  const handleResize = useCallback((cols, rows) => {
    resizeInstance(instanceId, cols, rows);
  }, [instanceId, resizeInstance]);

  const handleSend = useCallback(text => {
    writeToInstance(instanceId, text + '\r');
  }, [instanceId, writeToInstance]);

  const handlePlan = useCallback(prompt => {
    requestPlan(instanceId, prompt);
  }, [instanceId, requestPlan]);

  const handleStop = useCallback(() => {
    stopInstance(instanceId);
    navigate(UrlEnums.DASHBOARD);
  }, [instanceId, stopInstance, navigate]);

  const handleBack = useCallback(() => {
    navigate(UrlEnums.DASHBOARD);
  }, [navigate]);

  const projectName = instance?.projectName || 'Instance';
  const status = instance?.status || 'unknown';
  const isRunning = status === 'running';
  const statusColor = isRunning ? '#7CB368' : '#606366';

  return (
    <>
      <Helmet>
        <title>Claude IDE | {projectName}</title>
      </Helmet>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: '#2B2B2B',
      }}
      >
        {/* Header bar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          bgcolor: '#1A1A1A',
          borderBottom: '1px solid #3C3F41',
          minHeight: 48,
        }}
        >
          <Tooltip title="Back to Dashboard">
            <IconButton
              size="small"
              onClick={handleBack}
              sx={{
                color: '#808080',
                '&:hover': { color: '#A9B7C6', bgcolor: 'rgba(78,82,84,0.3)' },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          <TerminalIcon sx={{ fontSize: 18, color: '#6897BB' }} />

          <Typography
            sx={{
              color: '#A9B7C6',
              fontWeight: 600,
              fontSize: 14,
              flex: 1,
            }}
            noWrap
          >
            {projectName}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 1 }}>
            <Box sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: statusColor,
              boxShadow: isRunning ? `0 0 6px ${statusColor}` : 'none',
            }}
            />
            <Typography sx={{
              fontSize: 12,
              color: statusColor,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
            >
              {status}
            </Typography>
          </Box>

          <Tooltip title="Stop Instance">
            <span>
              <IconButton
                size="small"
                onClick={handleStop}
                disabled={!isRunning}
                sx={{
                  color: '#BC3F3C',
                  opacity: isRunning ? 0.7 : 0.3,
                  '&:hover': { opacity: 1, bgcolor: 'rgba(188,63,60,0.1)' },
                }}
              >
                <StopCircleOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Terminal */}
        <TerminalWidget
          ref={termRef}
          instanceId={instanceId}
          onData={handleTerminalData}
          onResize={handleResize}
        />

        {/* Input bar */}
        <InputBar
          onSend={handleSend}
          onPlan={handlePlan}
          disabled={status === 'exited'}
        />
      </Box>
    </>
  );
};

export default InstanceView;
