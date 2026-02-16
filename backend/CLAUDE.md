# Claude IDE — Backend

## What This Is
Web-based dashboard for running multiple Claude Code terminal instances simultaneously.
Built on top of rest-api-boilerplate (uWebSockets.js + native MongoDB driver).

## Rules
- Plain JavaScript only. No TypeScript. Ever.
- Follow existing boilerplate patterns — route creator, ctx.db, ctx.libS, ctx.modS
- No Mongoose — use native MongoDB driver with JSON Schema validation
- Keep dependencies minimal

## Architecture

### Collections (MongoDB)
- `projects` — { name, path, created_at, updated_at }
- `plans` — { project_id, instance_id, title, prompt, content, status, created_at, updated_at }

### Libs (src/lib/)
- `projects/` — CRUD for projects collection
- `plans/` — CRUD for plans collection

### Modules (src/modules/)
- `instanceManager/` — PTY pool management (node-pty). In-memory Map of active instances. Create/stop/write/resize/list.
- `wsHandler/` — WebSocket message routing. Single connection per client, multiplexed by instanceId.

### Key Patterns
- Instances are ephemeral (in-memory only, not persisted to DB)
- Projects and plans are persisted to MongoDB
- WebSocket messages are JSON with { type, instanceId, ... }
- Plan capture: buffer PTY output while streaming, save to DB when Claude finishes
- Cross-platform: detect os.platform(), spawn claude directly on Linux, via powershell.exe on Windows

## WebSocket Message Types
Client → Server: input, plan, create, stop, resize
Server → Client: output, status, plan_ready, created, stopped, instances

## Full Plan
See docs/PROJECT_PLAN.md for detailed specs, data models, and build phases.
