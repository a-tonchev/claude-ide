# Claude IDE — Frontend

## What This Is
Web-based dashboard UI for running multiple Claude Code terminal instances.
Built on top of react-boilerplate (Vite + React + Material UI).

## Rules
- Plain JavaScript only. No TypeScript. Ever.
- State management: Jotai (not Recoil)
- UI components: Material UI (already in boilerplate)
- Follow existing boilerplate patterns — screens/, components/, helpers/
- No unnecessary dependencies

## Architecture

### Screens (src/screens/)
- `Dashboard/` — Grid of instance cards, new instance button, project manager
- `InstanceView/` — Full xterm.js terminal + input bar with Send/Plan buttons
- `PlanViewer/` — Rendered markdown with status controls

### Components (src/components/)
- `InstanceCard/` — Dashboard card showing project name, path, status, live preview
- `TerminalWidget/` — xterm.js wrapper with fit addon
- `InputBar/` — Text input + Send button + Plan button
- `PlanList/` — List of plans per project
- `ProjectManager/` — Dialog for add/edit/remove projects
- `NewInstanceDialog/` — Pick project to launch new instance

### State (Jotai)
- `instanceAtoms.js` — instancesAtom (Map), activeInstanceIdAtom, instanceListAtom (derived)
- `planAtoms.js` — plansAtom, activePlanIdAtom

### Hooks
- `useWebSocket.js` — WS connection with auto-reconnect (existing pattern)
- `useInstances.js` — Instance CRUD + WS message handling
- `usePlans.js` — Plan CRUD via REST API

### Key Patterns
- Single WebSocket connection, messages multiplexed by instanceId
- xterm.js for terminal rendering (full color, cursor, interactive)
- marked + highlight.js for plan markdown rendering
- Multiple instances per project supported (auto-numbered in UI)
- InputBar: Send = normal execution, Plan = wraps prompt for plan generation

## Full Plan
See docs/PROJECT_PLAN.md for detailed specs, data models, and build phases.
