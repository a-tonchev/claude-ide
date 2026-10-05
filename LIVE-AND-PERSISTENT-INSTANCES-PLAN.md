# Live install + remembered instances — plan

Two goals:

1. **A live system** that runs all the time from `D:\Programs\claude-ide`, separate from the dev
   checkout, so editing dev never touches the instances you actually work with.
2. **Instances that survive** crashes, server restarts, deploys and PC reboots. Only an explicit,
   manual Stop destroys an instance.

## Decisions

| Topic | Decision |
|---|---|
| Live location | `D:\Programs\claude-ide\{backend,frontend}`, managed by pm2 (`pm2 save` + existing `pm2-windows-startup`) |
| Static files | pm2's built-in static server serves the built frontend (same pattern as simple-erp) |
| Ports | Live keeps today's ports: UI **3010**, API **6950**. Dev moves to UI **3030**, API **6960** (3020 is taken by another app) |
| Databases | Live uses `claude-ide`. Dev uses a one-time copy, `claude-ide-dev` |
| What destroys an instance | Only manual Stop, Stop all, Delete group, or Remove in the remembered list |
| What keeps it | Claude exiting on its own, backend crash, backend stop/restart, deploy, PC reboot |
| Messages | Stored only in MongoDB (`instanceMessages`), never kept in backend memory |
| Plans on manual Stop | Kept (they stay in the Plans dialog) |
| Remembered list | Title-bar icon with a badge; dialog lists instances that exist in the DB but are not running |
| List row | Title, project, Claude/Codex, message count, group (or "group missing"), last active, last 10 messages with "show more", group picker (defaults to its own group), Start again, Remove |
| Failed resume | Row stays with the error shown; removed only manually |
| Terminals | Not remembered (no session to resume) |
| Closing a tab (X) | Only hides it; the group stays loaded and the "Add group…" picker or Open Saved Group bring it back (so does a refresh while its instances run). Groups are stored in MongoDB from creation (drafts) |

## 1. Orphan-sweep fix (prerequisite for two installs)

Today each backend kills every `backend\mcp\server.js` and `chrome-devtools-mcp` process that is
not its own descendant, which would break the other install's instances.

- Our MCP server is matched by **this install's absolute** `MCP_SERVER_PATH`, not a loose pattern.
- `chrome-devtools-mcp` has no install path, so it is killed only when **orphaned**: walk up through
  matching wrapper processes to the first non-MCP ancestor; kill only if that ancestor is gone
  (or its PID was reused — the "parent" was created after the child).
- The decision is a pure function (`selectMcpOrphans`) covered by `tests/process-sweep.test.mjs`.

## 2. Remembered instances

### Data model

`instances` — one document per AI instance (Claude, Codex, observer):

| Field | Notes |
|---|---|
| `_id` | The instance id (UUID string). Reused on resume, so messages and plans stay linked |
| `type`, `provider` | `claude` / `observer`; `claude` / `codex` |
| `sessionId` | Claude: generated up front and passed as `--session-id`. Codex: detected from its rollout file after start |
| `projectId`, `projectName`, `cwd`, `title` | |
| `groupId`, `savedItemId`, `flagIds` | Group is referenced by id |
| `status` | Set when the instance starts and when it exits; live status and pending questions stay in memory |
| `resumeError` | Set when a start or resume fails right away; cleared on the next successful start |
| `startedAt`, `lastActiveAt`, `createdAt`, `updatedAt` | |

`instanceMessages` — one document per feed item, ordered by `_id` (insertion order):
`instanceId`, `kind` (`user` / `message` / `milestone`), `text`, `type`, `accomplished`,
`workingOn`, `timestamp`. Index `{ instanceId: 1, _id: 1 }`.

Plans stay in `plans` (linked by `instance_id`) and are loaded from there, not from memory.

### Lifecycle

- **Create** → insert the record, spawn the process, keep only the process handle and live state in memory.
- **Feed item** (message, milestone, user message, question) → insert into `instanceMessages`, then
  broadcast `feed_item` with the stored document.
- **Manual Stop / Stop all / Delete group / Remove** → kill the process (if running), delete the
  record and its messages. Plans are kept.
- **Process exits by itself** → record stays, instance leaves the in-memory map, the card disappears
  and the badge count goes up.
- **Backend shutdown / crash** → processes die, records stay. At startup nothing is running, so
  every record is "remembered".

### Resume

- **Claude / observer**: if the transcript `~/.claude/projects/*/<sessionId>.jsonl` exists, start with
  `--resume <sessionId>`; otherwise (never talked) start fresh with `--session-id <sessionId>`.
- **Codex**: if the session id is known, start `codex resume <sessionId>` with the same invocation-scoped
  config; otherwise start fresh. The id is detected from `~/.codex/sessions/**/rollout-*.jsonl`:
  Codex's instructions start with `claude-ide-instance:<instance id>`, and the session is the primary
  thread (not a subagent) for the instance's `cwd`, started after it, whose file contains that marker.
- A resumed process that exits within a few seconds sets `resumeError`, so the row shows why.
- A task that was mid-run is not continued automatically; the conversation is.

### Backend surface

- WS: `resume { recordId, groupId }`. `stop` and `stop_group` now also delete records (manual stop).
  `instances` / `instance_state` no longer carry messages or plans.
- WS events: `feed_item`, `remembered_changed` (global).
- HTTP: `/instances/remembered` (records not running + message counts), `/instances/feed`
  (`{ instanceId, beforeId?, limit }` → items, total, plans), `/instances/remembered/remove`.

### Frontend

- Cards and the instance window read `instance.feed` (loaded from `/instances/feed`, live-appended from
  `feed_item`); "show more" fetches older pages when needed.
- Title bar: remembered-instances icon with badge → `RememberedInstancesDialog`.

## 3. Draft groups

- Every new group is created in MongoDB immediately with `draft: true`, so its id never changes and
  instance records can reference it. Saving a group sets `draft: false`.
- X hides the tab. A draft with no cards, nothing running and no remembered instance pointing to it
  is deleted when its tab is closed; at backend startup, empty drafts older than an hour that no
  instance record references are deleted.
- "Open Saved Group" ignores drafts; the add-group picker offers a draft only while something runs in it.

## 4. Live vs dev

| | Live | Dev |
|---|---|---|
| Location | `D:\Programs\claude-ide` | `D:\development\own\claude-ide` |
| UI | pm2 static server, port 3010 | Vite, port 3030 |
| API / WebSocket / MCP | port 6950 | port 6960 |
| MongoDB database | `claude-ide` | `claude-ide-dev` |
| Process manager | pm2 (`claude-ide-backend`, `claude-ide-frontend`) | nodemon + Vite |

- The backend port comes from `settings.js` (`port`), not a `PORT` environment variable, because
  spawned instances inherit the backend's environment and project dev servers read `PORT`.
- Each install has its own git-ignored `settings.js` and `mcp/mcp-config.json`; deploy never overwrites them.
- `node scripts/copy-db.mjs` makes the one-time `claude-ide` → `claude-ide-dev` copy.
- `node scripts/deploy-live.mjs` builds the frontend, stops the live backend, mirrors `backend/`
  (with `node_modules`) and `frontend/build` into `D:\Programs\claude-ide`, creates the live
  `settings.js` on first deploy, then `pm2 startOrRestart` + `pm2 save`. It asks for confirmation
  when the live backend is up, because restarting it stops live instances (they stay resumable).
- MongoDB must always run. It is the Windows service `MongoDB` (8.3, automatic start, config
  `D:\development\db\mongo448.conf`: data in `D:\development\db\mongo448`, replica set `rs0`), so it
  is up at boot before pm2 brings the backend back at sign-in.

## Build order

Status (2026-09-15): all five steps are done and the live install is deployed.

1. Orphan-sweep fix + tests.
2. Dev switch: copy the database, move dev to ports 3030/6960 and `claude-ide-dev`.
3. Backend persistence: collections, instance store, manager/handler/controller changes, resume.
4. Frontend: feed from the database, remembered dialog, draft groups.
5. Live: deploy script, ecosystem file, docs. The first deploy is run by hand.
