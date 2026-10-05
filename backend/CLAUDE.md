# Claude IDE — Backend

## What This Is
Server for the Claude IDE dashboard: spawns and manages Claude Code, Codex and terminal
instances (node-pty), stores projects, groups, plans and instance history in MongoDB, and talks
to the dashboard over uWebSockets.js. Built on rest-api-boilerplate.

## Rules
- Plain JavaScript only. No TypeScript. Ever.
- Follow existing boilerplate patterns — route creator, ctx.db, ctx.libS, ctx.modS
- No Mongoose — native MongoDB driver with JSON Schema validation (`setupCollection` per lib)
- Keep dependencies minimal
- Port and database come from `settings.js` (git-ignored, one per install), never from `PORT`.
  Editing any file here restarts the dev server — see the root `CLAUDE.md`.

## Collections (MongoDB)
- `projects`, `terminals`, `observers`, `settings` (KeePass configs, launch flags), `users`, `authentications`
- `groups` — saved cards per group; `draft: true` until the group is saved
- `plans` — `instance_id` links a plan to the instance that wrote it
- `instances` — one record per AI instance, running or remembered: `_id` is the instance id,
  plus `sessionId`, `groupId`, `title`, `resumeError`, …
- `instanceMessages` — the feed: user messages, Claude messages and milestones (`instanceId`, `kind`)

## Modules (src/modules/)
- `instanceManager/InstanceManager.js` — running instances (process + live state in memory), spawn, resume, stop
- `instanceManager/processSweep.js` — process tables and this install's MCP orphan sweep
- `instanceManager/sessionFiles.js` — Claude transcripts and Codex session detection, for resume
- `instanceManager/wslCleanup.js` — marker-based cleanup of the programs WSL terminals start
- `instanceManager/codexLauncher.js` — Codex invocation-scoped MCP config
- `instanceStore/InstanceStore.js` — reads and writes of `instances` and `instanceMessages`
- `files/FileStore.js` — chat attachments under settings.js `filesDir` (instances/<id>, shared/);
  its raw HTTP routes (`/files/upload|get|delete|config`) are in `startup/routes/setup/setupFileRoutes.js`
- `wsHandler/WsHandler.js` — WebSocket messages and events

## Key Patterns
- Only a manual stop (Stop, Stop all, Delete group, Remove) deletes an instance record and its
  messages. Crashes, restarts and instances exiting on their own keep it, so it can be resumed.
- Feed items are written to MongoDB, then published as `feed_item`; no feed is kept in memory.
  Status and pending questions are live state in memory only.
- `/instances/:id/*` routes are called by the MCP server (`mcp/server.js`) inside each instance;
  `/instances/feed` and `/instances/remembered*` by the dashboard.
- Windows: Claude is spawned through powershell.exe; children never inherit the parent Claude Code
  session variables (they would switch transcript saving off).

## WebSocket Message Types
`input` and `user_message` take optional `attachments` (stored file ids): `input` appends their
paths to the text, `user_message` stores them on the feed item.
Client → Server: create, create_observer, create_terminal, resume, input, stop, stop_group,
start_group, resize, list, subscribe, unsubscribe, user_response, user_message, rename, move_group
Server → Client: instances, created, group_started, instance_state, output, status, status_update,
title_update, feed_item, user_input_needed, pending_cleared, plan_saved, stopped, group_stopped,
group_status, group_changed, start_failed, remembered_changed, error

## More
Root `CLAUDE.md` and `LIVE-AND-PERSISTENT-INSTANCES-PLAN.md`.
