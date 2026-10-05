// Keep the legacy "claude" type for compatibility; provider selects the CLI.
export const getAiProvider = item => (item?.provider === 'codex' ? 'codex' : 'claude');

export const matchesSavedItem = (instance, item) => {
  if (instance.type !== item.type) return false;
  if (item.id) return instance.savedItemId === item.id;
  if (item.type === 'claude') {
    return instance.projectId === item.projectId && getAiProvider(instance) === getAiProvider(item);
  }
  return (instance.projectName || instance.name) === item.name && instance.shell === item.shell;
};

// Running instances that no saved card accounts for. Each card claims at most one instance:
// cards with an id first, then old cards without one, which match any instance of the same
// project. A second instance of that project is therefore unsaved, not covered by the card.
export const unsavedInstances = (instances, items) => {
  const left = [...instances];
  const claim = item => {
    const index = left.findIndex(inst => matchesSavedItem(inst, item));
    if (index >= 0) left.splice(index, 1);
  };
  items.filter(item => item.id).forEach(claim);
  items.filter(item => !item.id).forEach(claim);
  return left;
};

// A group's saved card whose instance now runs in another group ("Move to group…"). Only
// cards with an id count: look-alike cards without one can't be told apart.
export const runsInOtherGroup = (item, groupId, instanceList) => !!item.id
  && instanceList.some(inst => inst.groupId !== groupId && matchesSavedItem(inst, item));
