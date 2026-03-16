import { GroupStores, setPlaceholder } from '@/stores/groupAtoms';

export function assignToPlaceholder(groupId, instanceId) {
  const placeholders = GroupStores.placeholdersStore.get();
  const gp = placeholders[groupId] || { placeholder1: null, placeholder2: null };

  // Don't open the same instance in both placeholders
  if (gp.placeholder1 === instanceId || gp.placeholder2 === instanceId) return 0;

  // Left panel is fixed — if empty, fill it first
  if (!gp.placeholder1) {
    setPlaceholder(groupId, 'placeholder1', instanceId);
    return 1;
  }
  // Otherwise always assign to the right panel (quick-view slot)
  setPlaceholder(groupId, 'placeholder2', instanceId);
  return 2;
}

export function clearFromPlaceholder(groupId, instanceId) {
  const placeholders = GroupStores.placeholdersStore.get();
  const gp = placeholders[groupId];
  if (!gp) return;
  if (gp.placeholder1 === instanceId) setPlaceholder(groupId, 'placeholder1', null);
  if (gp.placeholder2 === instanceId) setPlaceholder(groupId, 'placeholder2', null);
}
