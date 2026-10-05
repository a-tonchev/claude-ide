import React from 'react';
import Chip from '@mui/material/Chip';

const STATUS_CHIPS = {
  thinking: { label: 'thinking', bgcolor: '#6897BB2E', color: '#6897BB' },
  working: { label: 'working', bgcolor: '#6897BB2E', color: '#6897BB' },
  waiting: { label: 'waiting', bgcolor: '#CC78322E', color: '#CC7832' },
  planning: { label: 'planning', bgcolor: '#6897BB2E', color: '#6897BB' },
  plan_ready: { label: 'plan ready', bgcolor: '#7CB36833', color: '#7CB368' },
  completed: { label: 'done', bgcolor: '#7CB36833', color: '#7CB368' },
  running: { label: 'running', bgcolor: '#7CB36833', color: '#7CB368' },
  ready: { label: 'ready', bgcolor: '#7CB36833', color: '#7CB368' },
};

const chipSx = {
  height: 18,
  fontSize: '0.66rem',
  fontWeight: 600,
  borderRadius: '9px',
  flexShrink: 0,
  '& .MuiChip-label': { px: 0.75 },
};

// What a group's tab shows next to its name: AI statuses, running terminals, and — when
// nothing runs — how many saved cards it has.
export const getGroupCounts = (group, groupStatuses, instanceList) => {
  const statuses = groupStatuses?.[group.id] || {};
  const terminals = instanceList.filter(i => i.groupId === group.id && i.type === 'terminal').length;
  const savedItemCount = group.saved ? (group.items?.length || 0) : 0;
  const runningCount = Object.values(statuses).reduce((a, b) => a + b, 0) + terminals;
  return {
    statuses, terminals, savedItemCount, runningCount,
  };
};

const GroupStatusChips = ({ counts }) => {
  const {
    statuses, terminals, savedItemCount, runningCount,
  } = counts;
  return (
    <>
      {Object.entries(statuses).map(([status, count]) => {
        const chip = STATUS_CHIPS[status] || STATUS_CHIPS.working;
        return (
          <Chip
            key={status}
            size="small"
            label={`${count} ${chip.label}`}
            sx={{ ...chipSx, bgcolor: chip.bgcolor, color: chip.color }}
          />
        );
      })}
      {terminals > 0 && (
        <Chip
          size="small"
          label={`${terminals} term`}
          sx={{ ...chipSx, bgcolor: '#2D4A3722', color: '#5A8A6A' }}
        />
      )}
      {savedItemCount > runningCount && runningCount === 0 && (
        <Chip
          size="small"
          label={`${savedItemCount} saved`}
          sx={{ ...chipSx, bgcolor: '#3C3F41', color: '#606366' }}
        />
      )}
    </>
  );
};

export default GroupStatusChips;
