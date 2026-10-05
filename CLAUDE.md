# Claude IDE

## What This Is
A web-based IDE dashboard for running and managing multiple Claude Code terminal instances simultaneously. Think of it as a control panel where you can spin up multiple Claude agents, each working on different tasks or projects, and monitor all of them from a single UI.
## Architecture

### Frontend (`frontend/`)
React + Vite + Material UI dashboard. Displays instance cards with live status, milestones, and messages. Connects to backend via WebSocket for real-time updates. See `frontend/CLAUDE.md` for details.

### Backend (`backend/`)
uWebSockets.js + MongoDB server. Manages PTY instances (node-pty), spawns Claude Code processes, injects system prompts and MCP tool configurations at instance creation time via `--append-system-prompt`. See `backend/CLAUDE.md` for details.

### MCP Integration
The backend injects MCP tools and system prompts into spawned Claude instances automatically. These instructions (status updates, milestones, messaging, permissions) are hardcoded in `backend/src/modules/instanceManager/InstanceManager.js` — they do NOT come from this file.

### Launch Flags
User-defined checkboxes shown when launching a Claude instance (Settings → Launch Flags). Each is a
`settings` doc of type `launchFlag` with `name`, `args` and optional `instructions`. Checked flags
have `args` appended verbatim after `claude` (`{name}` expands to the project name) and
`instructions` appended to the injected system prompt. Saved group items keep their choice in
`flagIds`. Clients send only ids; `WsHandler.resolveLaunchFlags` reads the docs from MongoDB.
Example: name `Discord`, args `--channels plugin:discord@claude-plugins-official`.

## AI project cards

The plus menu's **Add AI** selects an existing project directory, provider and (Claude only)
launch flags, and starts a brand-new instance in the active group. The last flag choice is
remembered in localStorage (`claude-ide:add-ai-flag-ids`). It never changes the group's saved cards: a stopped
instance is simply gone, and only **Save / Update Group** turns running instances into saved cards.
A saved card's **Claude / Codex** toggle selects the CLI when Start is pressed (always a fresh
instance; only the remembered-instances list resumes an old conversation). Projects are shared
between providers. The last-started provider is stored through localForage using
`claude-ide:last-ai-provider` and preselected on new cards. Saved group items retain their own
`provider` and card `id`; running instances (terminals too) carry `savedItemId` so multiple cards
can use one project. **Move to group…** on a running card moves the instance for good (WS
`move_group`, its record follows); its saved card stays in the old group until Update Group there
drops it. A card whose Start dies right away gets a `start_failed` event, shown on the card.
The internal `type: 'claude'` remains the legacy AI-card type for compatibility.

Codex uses `codexLauncher.js` to receive invocation-scoped MCP configuration and dashboard
instructions. It reuses `backend/mcp/server.js` and does not modify the user's Codex config.
Launch flags currently apply to Claude only. Run `node --test tests/ai-provider.test.mjs`
for the provider identity and MCP routing checks.

## Security

Known security issues are tracked in a local, git-ignored `SECURITY-TODO.md`. Read it before
adding routes, WebSocket message types, or anything the MCP server calls, and add new findings
there rather than to tracked files.

## Live and dev installs

| | Live | Dev |
|---|---|---|
| Location | `D:\Programs\claude-ide` | this checkout |
| UI | pm2 static server, http://localhost:3010 | Vite, http://localhost:3030 |
| API / WebSocket / MCP | port 6950 | port 6960 |
| MongoDB database | `claude-ide` | `claude-ide-dev` (copy made with `npm run db:copy-dev`) |
| Runs under | pm2 (`claude-ide-backend`, `claude-ide-frontend`), restored at login | nodemon + Vite |

- Each install's port and database come from its own git-ignored `backend/settings.js` (`port`,
  `dbName`, `MONGO_URL`). Don't use a `PORT` env var: spawned instances inherit the backend's
  environment, and project dev servers read `PORT`.
- `npm run deploy:live` (repo root) builds the frontend, stops the live backend, mirrors `backend/`
  and `frontend/build` into `D:\Programs\claude-ide`, keeps the live `settings.js`, then reloads
  pm2 and saves the process list. **Never run it yourself** — it builds and restarts the live
  system. The user runs it. `node scripts/deploy-live.mjs --frontend-only` rebuilds and copies
  just the UI; the live backend and its instances keep running.
- Each backend's orphan sweep kills only its own MCP servers and `chrome-devtools-mcp` whose owner
  is gone (`processSweep.js`), so the two installs don't break each other's instances.
- WSL terminals pass `CLAUDE_IDE_TERMINAL=<install>:<backend run>:<instance>` into WSL through
  `WSLENV`, and every program they start inherits it (`wslCleanup.js`). Stopping a terminal or its
  group, the terminal exiting, and backend shutdown kill the WSL processes carrying the marker;
  backend startup kills this install's leftovers from runs that were killed or crashed.

## Editing the backend restarts dev instances

**Any** file written under `backend/` — including a new file nothing imports yet — restarts the
dev server (nodemon), which stops every dev instance. Their records and messages stay in
`claude-ide-dev`, so they show up in the remembered list and can be started again, but whatever
they were doing mid-task stops. The live install is not affected.

So before writing to anything under `backend/`, check whether dev instances are running (ask, or
look for child processes of the process listening on 6960) and ask first if they are. Put
throwaway files in the scratchpad directory, never under `backend/`. `frontend/` is safe — Vite
hot-reloads and never touches the backend or its PTYs.

## Remembered instances

- Every AI instance (Claude, Codex, observer) has a record in `instances`. Its feed (user
  messages, Claude messages, milestones) lives only in `instanceMessages`; plans stay in `plans`.
  Backend memory holds just the process and live state.
- Only a manual Stop, Stop all, Delete group, or Remove in the remembered list deletes the record
  and messages. An instance that exits on its own, or was running when the backend stopped, is
  remembered.
- The title bar's remembered-instances icon lists them. Start again resumes the session under the
  same instance id in any group: Claude with `--resume` (or `--session-id` if it never talked),
  Codex with `codex resume <id>` using the id detected from its rollout file.
- **Saved instances** (🔖 on a card or in the instance window; record field `saved`): kept through
  manual Stop, Stop all, Delete group and restarts, listed under the title bar's Saved icon, and
  deleted only by Remove there (a running one is just unsaved). Every record delete checks
  `saved` in the same query (`InstanceStore.deleteRecord`, `deleteRecordsInGroup`).
- Groups are stored from creation, unsaved ones as drafts (`draft: true`), so a group's id never
  changes; X only hides a tab. Design notes: `LIVE-AND-PERSISTENT-INSTANCES-PLAN.md`.
- Tests: `node --test "tests/*.test.mjs"` (Node 24 needs the glob) covers the orphan sweep and
  session-file lookup, among others.

## Chat attachments

- Each install's `settings.js` sets `filesDir` (full path, anywhere on disk; dev uses
  `D:/claude-uploads`); optional `maxUploadBytes` (default 25 MB). Without `filesDir` the 📎 is hidden.
  Never put it under `backend/` (nodemon restarts, `deploy:live` mirrors that folder).
- `<filesDir>/instances/<instanceId>/` is created on the first upload in a chat and deleted with the
  instance's record and messages (resume keeps the id, so its files stay). `<filesDir>/shared/` is
  for files the AI keeps for good, one folder per project, organised by the AI; the backend never
  touches it.
- Files upload over HTTP as soon as they are attached (📎, paste, drag & drop). On send, the
  backend appends `Attached files: "<full path>", …` to the text written to the PTY; the feed item
  stores `attachments` ({ id, name, size, mime }) and shows them as thumbnails/chips.
- Claude and Codex are started with `--add-dir <filesDir>` and get an "Attached files" section in
  their injected instructions (`FileStore.promptSection`), so they reach both folders without
  permission prompts. Instances started before `filesDir` was set need a restart.
- Code: `backend/src/modules/files/FileStore.js`, `backend/startup/routes/setup/setupFileRoutes.js`,
  `frontend/src/hooks/useAttachments.js`, `frontend/src/components/Attachments/`, `ChatInput/`.

## Rules
- Plain JavaScript only. No TypeScript.
- Never run build commands (`vite build`, `npm run build`, etc.)
- Frontend state: Jotai. UI: Material UI.
- Backend: native MongoDB driver (no Mongoose), uWebSockets.js.
- Keep dependencies minimal.
- When the user is describing an idea or asking whether something is possible, answer the
  question. Do not start implementing until they ask for code.
