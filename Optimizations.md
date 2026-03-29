# Claude IDE - Optimizations & Bug Fixes

## Completed

### Memory Leak Fixes

#### Unbounded Array Growth (Backend)
Instance data arrays (`milestones`, `messages`, `userMessages`, `plans`) were growing without any limit for the lifetime of each instance. Long-running instances could accumulate thousands of entries in memory, all serialized and sent to every client on subscribe/reconnect.

**Fix:** Added size caps to all arrays in `InstanceManager`:
- `milestones`: max 100 entries
- `messages`: max 200 entries
- `userMessages`: max 100 entries
- `plans`: max 50 entries

Oldest entries are trimmed on every push. Files: `backend/src/modules/instanceManager/InstanceManager.js`

#### Dead Plan Capture Mechanism Removed
The old `handlePlan` PTY capture feature was dead code — plans are now handled via the MCP `send_plan` tool. The old mechanism started buffering ALL terminal output into `outputBuffer` on plan request, but had no mechanism to ever stop capturing. This caused unbounded memory growth for the lifetime of the instance.

**Fix:** Removed entirely: `handlePlan`, `startPlanCapture`, `finishPlanCapture`, `isCapturingPlan`, `outputBuffer`, `planPrompt` from backend. Removed `requestPlan` from frontend hook and `InstanceView`. Files: `backend/src/modules/wsHandler/WsHandler.js`, `backend/src/modules/instanceManager/InstanceManager.js`, `frontend/src/hooks/useInstances.js`, `frontend/src/screens/InstanceView/InstanceView.jsx`

#### Input Drafts Not Cleaned on Instance Removal
When an instance was stopped/removed, its entry in `inputDraftsStore` was never deleted. Over many instance lifecycles, stale draft entries accumulated.

**Fix:** `removeInstance()` now also cleans up the corresponding `inputDraftsStore` entry. File: `frontend/src/stores/instanceAtoms.js`

#### Exited Instances Never Cleaned from Backend Map
If a PTY exited on its own (crash, normal exit), the instance stayed in the backend's `instances` Map forever with `status: 'exited'`. Only explicit `stop()` calls removed instances.

**Fix:** The `onExit` handler now schedules `removeIfExited()` after 5 seconds, giving clients time to receive the exit status before cleanup. File: `backend/src/modules/wsHandler/WsHandler.js`, `backend/src/modules/instanceManager/InstanceManager.js`

### Timer & Resource Leak Fixes

#### Idle Timer Outliving Instance
The `idleTimer` in `wireInstance` was a closure variable. When `stop()` disposed `onExit` before it could fire, the timer could execute on a deleted instance.

**Fix:** `wireInstance` now exposes `clearIdleTimer` on the instance object. `stop()` calls it before disposing listeners. Files: `backend/src/modules/wsHandler/WsHandler.js`, `backend/src/modules/instanceManager/InstanceManager.js`

#### Pending Timers Not Cleaned on Natural Exit
`pendingEnter` and `pendingSubmit` Maps were only cleaned on explicit `stop()`, not when a PTY exited naturally via `onExit`.

**Fix:** Added `cleanupPendingTimers(instance.id)` to the `onExit` handler. File: `backend/src/modules/wsHandler/WsHandler.js`

#### Pending Timers Not Cleaned on Group Stop
`handleStopGroup` wasn't cleaning up `pendingEnter`/`pendingSubmit` timers for stopped instances.

**Fix:** Added `cleanupPendingTimers(instanceId)` call in the group stop loop. File: `backend/src/modules/wsHandler/WsHandler.js`

#### VersionDetector Event Listener Leak
`window.addEventListener('newVersion', ...)` was added but cleanup tried to remove it from `navigator.serviceWorker` instead of `window`, so it was never cleaned up.

**Fix:** Changed cleanup target to `window.removeEventListener(...)`. File: `frontend/src/screens/update/VersionDetector.jsx`

### Performance Fixes

#### TextDecoder Created Per WebSocket Message
A new `TextDecoder` was instantiated inside the WebSocket `message` handler for every incoming message.

**Fix:** Hoisted to module scope as a reusable singleton. File: `backend/src/modules/wsHandler/WsHandler.js`

#### TerminalWidget Scroll RAF Throttling
The `onRender` handler queued a `requestAnimationFrame` on every terminal render. Multiple rapid renders could queue unlimited callbacks.

**Fix:** Added RAF throttling — if a callback is already pending, subsequent renders are skipped until it executes. File: `frontend/src/components/TerminalWidget/TerminalWidget.jsx`

### Bug Fixes

#### `removeByQuery` Inverted Logic
`ServicesBase.removeByQuery` had `deleteOne`/`deleteMany` swapped — `multiple: true` called `deleteOne`, `multiple: false` called `deleteMany`. Worked by accident since the only caller happened to use the wrong value in the right direction.

**Fix:** Swapped to correct logic. Updated `PlanController.removeAll` to pass `multiple: true`. Files: `backend/src/lib/base/services/ServicesBase.js`, `backend/src/lib/plans/controller/PlanController.js`

---

## Under Consideration (Need More Investigation)

### Frontend Re-render Performance
The entire `instancesStore` is a single Jotai atom. Every WebSocket message replaces the whole map, triggering re-renders of all cards and the Dashboard tree. No `React.memo` is used anywhere. Every keystroke in one card's input re-renders all cards via shared `inputDraftsStore`. Feed arrays are rebuilt and sorted on every render without `useMemo`. This is the largest potential performance improvement but requires significant refactoring (splitting atoms, adding memoization).

### Duplicate User Responses from Multiple Browser Windows
If two browser windows both show pending input choices and the user clicks in both, both responses are written to the PTY. No idempotency check exists. Needs a design decision on how to handle (lock input to one window, add idempotency key, etc.).

### `setUserInput` Drops Message Parameter
`InstanceController.setUserInput` only passes `choices` to `setPendingInput`, not the `message` text. On reconnect, `pendingInput` has choices but no question context. The question text is in the `messages` array separately.

### Status Guard for `exited` State
The frontend's `status_update` handler guards `waiting` from being overridden by `working`/`thinking`, but doesn't guard `exited`. A delayed `completed` broadcast (500ms timeout in InstanceController) could briefly make an exited instance show as "completed".

### WebSocket Reconnection Data Loss
During the window between socket close and reconnect, terminal output (`type: 'output'`) is permanently lost. Accumulated state (milestones, messages) is restored on reconnect, but the xterm.js terminal will have a gap.

### No Rate Limiting on MCP Tool Endpoints
A misbehaving Claude instance could call `send_milestone` or `send_message` hundreds of times, each triggering a WebSocket publish. No rate limiting exists.

### Group Deletion Does Not Stop Running Instances
When a group is deleted from MongoDB, running instances belonging to that group continue as orphans. Their PTY processes, timers, and subscriptions remain active.

### `startGroup` Can Be Called Twice
No guard prevents calling `startGroup` twice with the same `groupId`, which would create double the expected instances.

### Synchronous File System Operations
`setupMcp.js` performs multiple synchronous FS operations (`existsSync`, `readFileSync`, `writeFileSync`) on every instance creation. When creating a group with many instances, these block the event loop sequentially. `FileBrowser` also uses sync FS for directory listing.

### MCP Server Crash Detection
If the MCP server process crashes, the Claude instance loses MCP tool access silently. The dashboard stops receiving status updates, milestones, and messages from that instance with no notification to the user.
