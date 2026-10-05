// Display name for an instance card: custom title (user-renamed, persisted
// in the backend DB) falls back to the original project/terminal name.
export const getInstanceTitle = instance => (
  instance?.title || instance?.projectName || instance?.name || ''
);

// Label and colour per instance status, shared by the cards and the instance window.
export const STATUS_CONFIG = {
  ready: { label: 'Ready', color: '#7CB368' },
  thinking: { label: 'Thinking', color: '#CC7832' },
  planning: { label: 'Planning', color: '#CC7832' },
  plan_ready: { label: 'Plan Ready', color: '#7CB368' },
  waiting: { label: 'Waiting', color: '#CC7832' },
  working: { label: 'Working', color: '#6897BB' },
  completed: { label: 'Completed', color: '#7CB368' },
  running: { label: 'Running', color: '#7CB368' },
  exited: { label: 'Exited', color: '#606366' },
};

// Stopping an AI instance deletes it for good; stopping a terminal just closes it.
export const stopConfirmText = instance => {
  const label = getInstanceTitle(instance) || 'this instance';
  return instance?.type === 'claude' || instance?.type === 'observer'
    ? `Stop "${label}"? The instance and its messages are deleted for good.`
    : `Stop "${label}"? This will close the terminal.`;
};

export default { getInstanceTitle, stopConfirmText };
