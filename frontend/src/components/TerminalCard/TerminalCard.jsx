import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import TvIcon from '@mui/icons-material/Tv';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StopIcon from '@mui/icons-material/Stop';
import MinimizeIcon from '@mui/icons-material/Minimize';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';

import EditableTitle from '@/components/EditableTitle/EditableTitle';
import {
  CARD_COLORS, HeaderMeta, StatusMark, cardSx,
} from '@/components/CardParts/CardParts';
import { getInstanceTitle } from '@/helpers/instanceHelper';

const SHELL_COLORS = {
  wsl: { bg: '#CC783222', color: '#CC7832', label: 'WSL' },
  powershell: { bg: '#6897BB22', color: '#6897BB', label: 'PowerShell' },
  cmd: { bg: '#80808022', color: '#808080', label: 'CMD' },
  bash: { bg: '#7CB36822', color: '#7CB368', label: 'Bash' },
  gitbash: { bg: '#CC783222', color: '#CC7832', label: 'Git Bash' },
};

const TerminalCard = ({
  instance, onOpenPlaceholder, onOpenWindow, onStop, onMinimize, onMoveToGroup, onRename,
}) => {
  const isRunning = instance.status !== 'exited';
  const shellInfo = SHELL_COLORS[instance.shell] || SHELL_COLORS.bash;

  return (
    <Card sx={{ ...cardSx({ status: isRunning ? 'running' : 'exited' }), maxHeight: 'none' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.6,
        borderBottom: `1px solid ${CARD_COLORS.border}`,
      }}
      >
        <StatusMark status={isRunning ? 'running' : 'exited'} dotOnly />
        <EditableTitle
          title={getInstanceTitle(instance) || 'Terminal'}
          onRename={title => onRename?.(instance.id, title)}
          fontSize="0.84rem"
          color={CARD_COLORS.strong}
        />
        <HeaderMeta>
          <Box component="span" sx={{ color: shellInfo.color }}>{shellInfo.label}</Box>
        </HeaderMeta>
      </Box>

      {/* Buttons */}
      <Box
        className="no-select"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          px: 0.75,
          py: 0.25,
          '& > .MuiIconButton-root': { p: 0.5 },
        }}
      >
        {onOpenPlaceholder && (
          <IconButton
            size="small"
            onClick={() => onOpenPlaceholder(instance.id)}
            title="Open in placeholder"
            sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
          >
            <TvIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={() => onOpenWindow(instance.id)}
          title="Open in new window"
          sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        {onMinimize && (
          <IconButton
            size="small"
            onClick={() => onMinimize?.(instance.id)}
            title="Minimize to sidebar"
            sx={{ color: '#808080', '&:hover': { color: '#6897BB' } }}
          >
            <MinimizeIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <Box sx={{
          flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', px: 0.5,
        }}
        >
          <StatusMark status={isRunning ? 'running' : 'exited'} />
        </Box>
        <IconButton
          size="small"
          onClick={e => onMoveToGroup?.(instance.id, e.currentTarget)}
          disabled={!isRunning}
          title="Move to group…"
          sx={{ color: '#808080', '&:hover': { color: '#6897BB' }, '&.Mui-disabled': { color: '#4E5254' } }}
        >
          <DriveFileMoveOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onStop(instance.id)}
          disabled={!isRunning}
          title="Stop"
          sx={{ color: '#BC3F3C', '&:hover': { color: '#D45B58' }, '&.Mui-disabled': { color: '#4E5254' } }}
        >
          <StopIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Card>
  );
};

export default React.memo(TerminalCard);
