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

## Rules
- Plain JavaScript only. No TypeScript.
- Never run build commands (`vite build`, `npm run build`, etc.)
- Frontend state: Jotai. UI: Material UI.
- Backend: native MongoDB driver (no Mongoose), uWebSockets.js.
- Keep dependencies minimal.
