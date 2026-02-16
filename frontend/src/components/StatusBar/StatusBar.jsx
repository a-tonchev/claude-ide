import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const StatusBar = ({ instances, wsConnected }) => {
  const counts = useMemo(() => {
    const list = Object.values(instances || {});
    const total = list.length;
    const running = list.filter(i => i.status === 'running' || i.status === 'working' || i.status === 'ready').length;
    const waiting = list.filter(i => i.status === 'waiting').length;
    const completed = list.filter(i => i.status === 'completed').length;
    return { total, running, waiting, completed };
  }, [instances]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 0.5,
        bgcolor: '#1A1A1A',
        borderTop: '1px solid #3C3F41',
        minHeight: 28,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FiberManualRecordIcon
          sx={{ fontSize: 10, color: wsConnected ? '#7CB368' : '#BC3F3C' }}
        />
        <Typography sx={{ fontSize: '0.7rem', color: '#808080' }}>
          {wsConnected ? 'Connected' : 'Disconnected'}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '0.7rem', color: '#808080' }}>
        {counts.total} instances
      </Typography>
      {counts.running > 0 && (
        <Typography sx={{ fontSize: '0.7rem', color: '#7CB368' }}>
          {counts.running} active
        </Typography>
      )}
      {counts.waiting > 0 && (
        <Typography sx={{ fontSize: '0.7rem', color: '#CC7832' }}>
          {counts.waiting} waiting
        </Typography>
      )}
      {counts.completed > 0 && (
        <Typography sx={{ fontSize: '0.7rem', color: '#6897BB' }}>
          {counts.completed} done
        </Typography>
      )}
    </Box>
  );
};

export default StatusBar;
