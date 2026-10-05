// Which groups the tab bar shows as tabs, and which its "Add group…" picker offers. A tab
// shows while it is active, opened, or has running instances — unless its X was clicked
// (closedTabIds) since the page loaded.
export function splitGroupTabs({
  groups, instances, activeGroupId, openTabIds, closedTabIds,
}) {
  const runningGroupIds = new Set(Object.values(instances || {}).map(i => i.groupId).filter(Boolean));
  const isVisible = g => g.virtual || g.id === activeGroupId
    || (!closedTabIds?.has(g.id) && (runningGroupIds.has(g.id) || !!openTabIds?.has(g.id)));

  const visible = [];
  const hidden = [];
  for (const g of groups || []) {
    if (isVisible(g)) {
      visible.push(g);
    } else if (!g.virtual && (!g.draft || runningGroupIds.has(g.id))) {
      // Drafts only come back while something runs in them; empty ones are deleted on close
      hidden.push(g);
    }
  }
  return { visible, hidden };
}

export default { splitGroupTabs };
