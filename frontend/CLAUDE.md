# Claude IDE — Frontend

## What This Is
Dashboard UI for running and managing many Claude Code, Codex and terminal instances.
Built on react-boilerplate (Vite + React + Material UI).

## Rules
- Plain JavaScript only. No TypeScript. Ever.
- State management: Jotai, through `components/state/GlobalStateHelper`
- UI components: Material UI
- Follow existing boilerplate patterns — screens/, components/, hooks/, stores/, helpers/
- No unnecessary dependencies. Never run `vite build` yourself; the live deploy does it.

## Screens (src/screens/)
- `Dashboard/` — title bar, group tabs, instance cards, saved cards, placeholder panels, dialogs
- `InstanceWindow/` — popup at `/window/:instanceId`: terminal, activity feed, input
- `PlanView/` — `/viewPlan/:planId`

## Main components (src/components/)
- `ClaudeInstanceCard/`, `ObserverCard/`, `TerminalCard/` — running instance cards
- `SavedItemCard/` — a group's stopped card (Start, Claude/Codex toggle, launch flags)
- `GroupTabs/` — tabs and their context menu; which tabs show is `helpers/groupTabsHelper.js`
- `RememberedInstancesDialog/` — instances that aren't running: read messages, Start again, Remove
- `TitleBar/` — plus menu, remembered-instances badge, settings menu
- `NewInstanceDialog/` (Add AI), `NewTerminalDialog/`, `NewObserverDialog/`, `SaveGroupDialog/`, `LoadGroupDialog/`
- `ActionBar/` — Run / Stop / Save icons for the active group, shown in the group tab row (desktop) or
  next to the group picker (mobile)
- `PlaceholderPanel/`, `MinifiedSidebar/`, `TerminalWidget/` (xterm.js), `MarkdownRenderer/`
- `InstanceTerminal/` — an xterm bound to one instance (placeholders and the mobile pager)
- `ChatInput/` — AI chat input (cards and instance window): 📎, paste, chips, send. `Attachments/`
  has the chips, drop zone and feed thumbnails; `hooks/useAttachments.js` uploads (`/files/*`)
- Mobile (< md): no group tabs, placeholders or minimize. `MobileGroupPicker/` (title-bar button →
  full-screen group list) and `MobileCardPager/` (one card per page, swiped with CSS scroll snap;
  full-screen card list; each running card has Chat/Info and Terminal tabs). An opened terminal
  stays mounted because the backend doesn't replay output.

## State (src/stores/)
- `instanceAtoms.js` — running instances by id. AI instances also carry `feed` (loaded from the
  database, oldest first), `feedTotal`, `feedLoaded` and `plans`. Input drafts per instance; a
  BroadcastChannel syncs pending input and field updates between windows.
- `groupAtoms.js` — groups by id (`saved` is false for drafts), active group, placeholders.

## Hooks (src/hooks/)
- `useWebSocket.js` — one shared socket with auto-reconnect; applies server events to the stores
- `useInstances.js` — WebSocket commands: create, stop, input, resume, …
- `useInstanceFeed.js` / `useFeedWindow.js` — feed pages from `/instances/feed`, show-more paging
- `useGroups.js` — groups API; drafts are created in the database; the active group is `?group=`
- `useRememberedInstances.js` — the `/instances/remembered` list
- `useLaunchFlags.js`, `useAiProvider.js`, `usePlans.js`

## Key Patterns
- The backend stores user messages, Claude messages and milestones. Views load them from
  `/instances/feed` and append `feed_item` events; after a reconnect the loaded feeds reload once.
- One WebSocket per window, shared by the cards, placeholders and windows in it, and subscribed to
  every instance. Nothing unsubscribes: the topic also carries `feed_item` and `status_update`, so
  dropping it silenced the cards until a reload. A `list` every 30 s re-subscribes as a safety net.
- Add AI only starts a brand-new instance; saved cards change only through Save / Update Group
  (a card's Claude/Codex toggle, launch-flag chips and Remove save at once).
- Running cards can't leave a group, only move: **Move to group…** (`move_group`). The old group's
  saved card for it counts as a change, and Update Group drops it (`runsInOtherGroup`).
- Every group is in the database from creation (`draft: true` until saved). X hides a tab for the
  session (`closedTabIds`); the "Add group…" picker and Open Saved Group bring it back.
- Dev: Vite on port 3030 against the dev backend on 6960 (`.env`). The production build
  (`.env.production`) talks to the live backend on 6950.

## More
Root `CLAUDE.md`, `LIVE-AND-PERSISTENT-INSTANCES-PLAN.md`, `docs/PROJECT_PLAN_v2.md`.
