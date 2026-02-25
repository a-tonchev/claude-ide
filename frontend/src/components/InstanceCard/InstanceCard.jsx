import { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

function formatElapsed(startedAt) {
  if (!startedAt) return '0:00';
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const statusConfig = {
  running: { color: '#7CB368', label: 'Running', glow: 'rgba(124,179,104,0.15)' },
  idle: { color: '#CC7832', label: 'Idle', glow: 'rgba(204,120,50,0.15)' },
  exited: { color: '#606366', label: 'Exited', glow: 'none' },
};

const InstanceCard = ({ instance, onOpen, onStop }) => {
  const [elapsed, setElapsed] = useState('0:00');
  const status = statusConfig[instance.status] || statusConfig.exited;
  const isRunning = instance.status === 'running';

  useEffect(() => {
    if (instance.status === 'exited') return;

    setElapsed(formatElapsed(instance.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(instance.startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [instance.startedAt, instance.status]);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#313335',
        border: '1px solid #4E5254',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        '&:hover': {
          borderColor: '#6897BB',
          boxShadow: isRunning ? `0 0 20px ${status.glow}` : '0 4px 12px rgba(0,0,0,0.3)',
        },
      }}
      onClick={() => onOpen?.(instance.id)}
    >
      {/* Status accent bar */}
      <Box sx={{
        height: 3,
        width: '100%',
        bgcolor: status.color,
        opacity: isRunning ? 1 : 0.4,
      }}
      />

      {/* Content */}
      <Box sx={{
        p: 2, flex: 1, display: 'flex', flexDirection: 'column',
      }}
      >
        {/* Header row: name + status */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5,
        }}
        >
          <Typography
            sx={{
              color: '#A9B7C6',
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1.3,
              flex: 1,
              mr: 1,
            }}
            noWrap
          >
            {instance.projectName || 'Unnamed'}
          </Typography>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
          }}
          >
            <Box sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: status.color,
              boxShadow: isRunning ? `0 0 6px ${status.color}` : 'none',
              animation: isRunning ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
            />
            <Typography sx={{
              fontSize: 11,
              color: status.color,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            >
              {status.label}
            </Typography>
          </Box>
        </Box>

        {/* Path */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, mb: 1,
        }}
        >
          <FolderOutlinedIcon sx={{ fontSize: 14, color: '#606366' }} />
          <Typography
            sx={{
              fontSize: 12,
              color: '#808080',
              fontFamily: '"JetBrains Mono", "Consolas", monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={instance.cwd || instance.path || ''}
          >
            {instance.cwd || instance.path || ''}
          </Typography>
        </Box>

        {/* Elapsed */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <AccessTimeIcon sx={{ fontSize: 14, color: '#606366' }} />
          <Typography sx={{
            fontSize: 12,
            color: '#808080',
            fontFamily: '"JetBrains Mono", "Consolas", monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
          >
            {elapsed}
          </Typography>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 1,
        borderTop: '1px solid #3C3F41',
      }}
      >
        <Button
          size="small"
          startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          onClick={e => { e.stopPropagation(); onOpen?.(instance.id); }}
          sx={{
            color: '#6897BB',
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'none',
            px: 1.5,
            py: 0.5,
            borderRadius: 1.5,
            '&:hover': { bgcolor: 'rgba(104,151,187,0.1)' },
          }}
        >
          Open
        </Button>

        <Tooltip title="Stop instance">
          <span>
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); onStop?.(instance.id); }}
              disabled={instance.status === 'exited'}
              sx={{
                color: '#BC3F3C',
                opacity: instance.status === 'exited' ? 0.3 : 0.7,
                '&:hover': {
                  opacity: 1,
                  bgcolor: 'rgba(188,63,60,0.1)',
                },
              }}
            >
              <StopCircleOutlinedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Card>
  );
};

export default InstanceCard;
