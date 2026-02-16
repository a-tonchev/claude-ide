# Claude IDE — Project Plan v2

## Vision

A web-based dashboard for running multiple Claude Code instances simultaneously. Each instance runs in its own terminal tied to a project directory (multiple instances per project allowed). Full interaction through the browser — live terminal streaming, plan mode for generating reviewable markdown documents, everything backed by MongoDB.

Works on Linux and Windows.

---

## Core Principles

- **Plain JavaScript** — no TypeScript anywhere
- **Use existing boilerplates** — rest-api-boilerplate + react-boilerplate
- **Minimal new dependencies** — only node-pty, marked, xterm.js on top of what boilerplates provide
- **Functional over clever** — readable code, simple patterns

---

## Tech Stack

### Backend — rest-api-boilerplate

| What | How |
|------|-----|
| Server | uWebSockets.js (already in boilerplate) |
| WebSocket | uWebSockets.js built-in WS (use existing pattern from other projects) |
| Database | Native MongoDB driver + generic-pool (already in boilerplate) |
| PTY | node-pty (new dependency) |
| Route pattern | Existing route creator with auth/validation/handler pipeline |
| Config | settings.js pattern (already in boilerplate) |

**New dependencies to add:** `node-pty`

### Frontend — react-boilerplate

| What | How |
|------|-----|
| Framework | React + Vite (already in boilerplate) |
| State | Jotai (migration from Recoil) |
| UI | Material UI (already in boilerplate) |
| Terminal | xterm.js + xterm-addon-fit (new) |
| Markdown | marked + highlight.js (new) |
| WebSocket | Existing WS pattern from other projects (auto-reconnect etc.) |

**New dependencies to add:** `xterm`, `xterm-addon-fit`, `xterm-addon-web-links`, `marked`, `highlight.js`

---

## Cross-Platform Support (Linux + Windows)

### Shell spawning in instance manager

```js
const os = require('os');
const platform = os.platform();

function spawnClaude(cwd, args = []) {
  if (platform === 'win32') {
    return pty.spawn('powershell.exe', ['-NoLogo', '-Command', 'claude', ...args], {
      name: 'xterm-256color',
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  }
  return pty.spawn('claude', args, {
    name: 'xterm-256color',
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  });
}
```

### Differences handled

| | Linux | Windows |
|---|---|---|
| PTY backend | Unix PTY | ConPTY (Win10+) |
| Shell | claude (direct) | powershell.exe → claude |
| Line endings | \n | \r\n (normalized for plan capture) |
| node-pty install | Works natively | Needs windows-build-tools |

---

## Data Models (MongoDB)

### `projects` collection

```js
{
  _id: ObjectId,
  name: 'my-api',
  path: '/home/user/projects/my-api',  // or C:\Users\... on Windows
  created_at: Date,
  updated_at: Date
}
```

**Validation:** name required, path required, path unique

### `plans` collection

```js
{
  _id: ObjectId,
  project_id: ObjectId,
  instance_id: String,        // which terminal session created it
  title: String,              // extracted from first # heading
  prompt: String,             // what the user originally asked
  content: String,            // full markdown
  status: 'draft',            // draft | in_progress | done
  created_at: Date,
  updated_at: Date
}
```

**Validation:** project_id required, content required

---

## Backend Structure (rest-api-boilerplate)

```
src/
├── lib/
│   ├── projects/
│   │   ├── actions/
│   │   │   ├── CreateProject.js
│   │   │   ├── GetProjects.js
│   │   │   ├── GetProject.js
│   │   │   ├── UpdateProject.js
│   │   │   └── DeleteProject.js
│   │   ├── routes.js
│   │   └── schema.js
│   │
│   └── plans/
│       ├── actions/
│       │   ├── CreatePlan.js
│       │   ├── GetPlans.js
│       │   ├── GetPlan.js
│       │   ├── UpdatePlan.js
│       │   └── DeletePlan.js
│       ├── routes.js
│       └── schema.js
│
├── modules/
│   ├── instanceManager/
│   │   └── InstanceManager.js    # PTY pool — create, stop, list, getOutput
│   │
│   └── wsHandler/
│       └── WsHandler.js          # WebSocket message routing by instanceId
│
└── startup/
    └── (existing boot files)
```

### Instance Manager (core new module)

```js
// modules/instanceManager/InstanceManager.js

// In-memory store — instances are ephemeral (not persisted to DB)
const instances = new Map();

// Each instance:
// {
//   id: string (uuid),
//   projectId: string,
//   projectName: string,
//   cwd: string,
//   pty: node-pty process,
//   status: 'running' | 'idle' | 'exited',
//   startedAt: Date,
//   outputBuffer: string (for plan capture),
//   isCapturingPlan: boolean,
//   planPrompt: string,
// }

module.exports = {
  create(projectId, projectName, cwd, args = []) {},
  stop(instanceId) {},
  write(instanceId, data) {},
  resize(instanceId, cols, rows) {},
  list() {},
  get(instanceId) {},
  startPlanCapture(instanceId, prompt) {},
  finishPlanCapture(instanceId) {},  // returns { prompt, content }
};
```

### WebSocket Protocol

Single connection, multiplexed by instanceId.

**Client → Server:**

```js
{ type: 'input', instanceId: 'abc', data: 'fix the bug\r' }
{ type: 'plan', instanceId: 'abc', prompt: 'fix the auth system' }
{ type: 'create', projectId: '...', name: 'my-api', path: '/home/...' }
{ type: 'stop', instanceId: 'abc' }
{ type: 'resize', instanceId: 'abc', cols: 120, rows: 40 }
```

**Server → Client:**

```js
{ type: 'output', instanceId: 'abc', data: '...' }
{ type: 'status', instanceId: 'abc', status: 'running' }
{ type: 'plan_ready', instanceId: 'abc', planId: '...', title: '...' }
{ type: 'created', instanceId: 'abc', projectName: 'my-api' }
{ type: 'stopped', instanceId: 'abc' }
{ type: 'instances', list: [...] }  // sent on connect
```

### REST API Routes

```
GET    /api/projects              — list all projects
POST   /api/projects              — create project { name, path }
PUT    /api/projects/:id          — update project
DELETE /api/projects/:id          — delete project

GET    /api/plans                 — list plans (optional ?projectId=...)
GET    /api/plans/:id             — get single plan
POST   /api/plans                 — create plan (used internally by plan capture)
PATCH  /api/plans/:id             — update plan (change status, edit content)
DELETE /api/plans/:id             — delete plan
```

---

## Frontend Structure (react-boilerplate)

```
src/
├── screens/
│   ├── Dashboard/
│   │   └── Dashboard.js           # Main grid of instance cards
│   ├── InstanceView/
│   │   └── InstanceView.js        # Full terminal + input bar
│   └── PlanViewer/
│       └── PlanViewer.js           # Rendered markdown view
│
├── components/
│   ├── InstanceCard/
│   │   └── InstanceCard.js         # Dashboard card with live preview
│   ├── TerminalWidget/
│   │   └── TerminalWidget.js       # xterm.js wrapper
│   ├── InputBar/
│   │   └── InputBar.js             # Text input + Send + Plan buttons
│   ├── PlanList/
│   │   └── PlanList.js             # List of plans for a project
│   ├── ProjectManager/
│   │   └── ProjectManager.js       # Add/edit/remove projects dialog
│   └── NewInstanceDialog/
│       └── NewInstanceDialog.js    # Pick project → launch instance
│
├── stores/
│   ├── instanceAtoms.js            # Jotai atoms for instances
│   └── planAtoms.js                # Jotai atoms for plans
│
├── hooks/
│   ├── useWebSocket.js             # WS connection (your existing pattern)
│   ├── useInstances.js             # Instance CRUD + WS integration
│   └── usePlans.js                 # Plan CRUD via REST API
│
└── helpers/
    ├── api.js                      # REST API calls
    └── ansiUtils.js                # ANSI strip for plan capture display
```

### Jotai Store Design

```js
// stores/instanceAtoms.js
import { atom } from 'jotai';

// Map of instanceId → instance data
export const instancesAtom = atom({});

// Currently focused instance
export const activeInstanceIdAtom = atom(null);

// Derived: list of instances as array
export const instanceListAtom = atom((get) => {
  return Object.values(get(instancesAtom));
});
```

```js
// stores/planAtoms.js
import { atom } from 'jotai';

export const plansAtom = atom([]);
export const activePlanIdAtom = atom(null);
```

---

## Plan Mode Flow

### User perspective

1. Types prompt in InputBar
2. Clicks **Plan** button (instead of Send)
3. Sees Claude working in the terminal (live streaming as usual)
4. When done, a notification appears: "📋 Plan ready: Auth System Fix"
5. Clicks notification → PlanViewer opens with rendered markdown
6. Can change status (draft → in_progress → done)

### Technical flow

1. Client sends `{ type: 'plan', instanceId, prompt }`
2. Server's WsHandler receives it, calls:
   ```js
   instanceManager.startPlanCapture(instanceId, prompt);
   ```
3. Server wraps the prompt and writes to PTY:
   ```
   Create a detailed implementation plan in markdown for the following task.
   Structure it with:
   - A clear title as # heading
   - Overview section
   - Phases or steps with ## headings
   - Specific file changes needed
   - Acceptance criteria or definition of done

   Task: <user's prompt>
   ```
4. Instance's `outputBuffer` starts collecting all output
5. Output still streams normally to client (user sees it live)
6. Plan end detection: idle timeout (no output for 3 seconds) + prompt reappearing
7. On plan end:
   - Strip ANSI codes from buffer
   - Extract title from first `# ` line
   - Save to MongoDB via plan service
   - Send `plan_ready` to client
   - Reset capture state

### Multiple plans per session

Each plan request starts a new capture. Previous captures are already saved. So you can ask for several plans in one session — each saved separately.

---

## UI Layout

### Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ ⬡ Claude IDE                     [+ New Instance] [⚙ Projects] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ my-api            │  │ my-api (2)       │  │ frontend     │  │
│  │ ~/projects/api    │  │ ~/projects/api   │  │ ~/projects/w │  │
│  │                   │  │                  │  │              │  │
│  │ > Reading         │  │ > Idle           │  │ > Waiting    │  │
│  │   auth.py...      │  │                  │  │   for input  │  │
│  │                   │  │                  │  │              │  │
│  │ ⏱ 4:22  💬 12    │  │ ⏱ 1:05  💬 3   │  │ ⏱ 0:30      │  │
│  │ [Open] [Stop]     │  │ [Open] [Stop]   │  │ [Open][Stop] │  │
│  │ 📋 2 plans        │  │                 │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 3 instances · 2 active                                          │
└─────────────────────────────────────────────────────────────────┘
```

Note: "my-api" and "my-api (2)" — two instances in the same project.

### Instance View (expanded or tab)

```
┌─────────────────────────────────────────────────────────────────┐
│ ⬡ my-api                          [Plans 📋2] [Dashboard] [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Live terminal (xterm.js)                                       │
│                                                                 │
│  > I'll fix the authentication bug...                           │
│  ⚙ Reading login.py                                            │
│  ⚙ Editing login.py lines 26-35                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ │ fix the auth bug and add tests          │ [📋 Plan] [➤ Send] │
└─────────────────────────────────────────────────────────────────┘
```

### Plan Viewer (side panel or dialog)

```
┌──────────────────────────────────────────────┐
│ 📋 Auth System Fix          [draft ▾]  [×]  │
├──────────────────────────────────────────────┤
│                                              │
│  # Authentication System Fix                 │
│                                              │
│  ## Overview                                 │
│  The current login flow has a timing         │
│  vulnerability in token comparison...        │
│                                              │
│  ## Phase 1: Fix Token Validation            │
│  - Replace == with compare_digest()          │
│  - Files: login.py, auth/middleware.py       │
│                                              │
│  ## Acceptance Criteria                      │
│  - [ ] All auth tests pass                   │
│  - [ ] No timing side-channels               │
│                                              │
└──────────────────────────────────────────────┘
```

---

## Build Phases

### Phase 1 — Core Backend

- [ ] Set up rest-api-boilerplate with settings.js for Claude IDE
- [ ] Create `projects` lib (CRUD + schema + routes)
- [ ] Create `plans` lib (CRUD + schema + routes)
- [ ] Create `instanceManager` module (node-pty spawn/stop/list/write/resize)
- [ ] Create `wsHandler` module (message routing by type + instanceId)
- [ ] Cross-platform shell detection (Linux direct / Windows PowerShell)
- [ ] Test: can spawn claude, send input, receive output over WS

### Phase 2 — Core Frontend

- [ ] Set up react-boilerplate with Jotai (migration from Recoil)
- [ ] WebSocket hook (your existing pattern with auto-reconnect)
- [ ] Jotai atoms for instances + plans
- [ ] Dashboard screen with instance cards grid
- [ ] NewInstanceDialog — pick project, launch instance
- [ ] InstanceCard — shows project name, path, status, live preview snippet
- [ ] InstanceView screen with TerminalWidget (xterm.js)
- [ ] InputBar with Send button
- [ ] Instance lifecycle: start, stop, open, back to dashboard
- [ ] Multiple instances per project support

### Phase 3 — Plan Mode

- [ ] Plan button on InputBar
- [ ] Server-side prompt wrapping + output buffering
- [ ] Plan end detection (idle timeout + prompt detection)
- [ ] ANSI stripping + title extraction
- [ ] Save plan to MongoDB
- [ ] plan_ready WebSocket notification
- [ ] PlanList component (per project)
- [ ] PlanViewer with rendered markdown + syntax highlighting
- [ ] Plan status management (draft / in_progress / done)

### Phase 4 — Polish

- [ ] ProjectManager dialog (add/edit/remove saved projects)
- [ ] Dashboard card live preview (last few lines of output)
- [ ] Status detection (running/idle/waiting for input)
- [ ] Terminal resize handling
- [ ] Reconnection logic (resume viewing existing instances on page refresh)
- [ ] Keyboard shortcuts
- [ ] Responsive layout

---

## Feeding This Plan to Claude Code

### Recommended setup

**1. `CLAUDE.md` in each project root** (auto-read by Claude Code on startup):

```
# Claude IDE — Backend (or Frontend)

## Architecture
<condensed version of this plan — structure, conventions, patterns>

## Rules
- Plain JavaScript only, no TypeScript
- Follow existing boilerplate patterns (route creator, ctx.db, etc.)
- Use Jotai for state (frontend)
- Use native MongoDB driver (backend)
```

**2. `docs/PROJECT_PLAN.md`** — this full document, referenced per task:

```
> Read docs/PROJECT_PLAN.md Phase 1, then implement the projects lib
```

**3. Once Claude IDE is built** — use Plan mode to generate task-specific plans and feed them back into Claude Code instances through the tool itself.

---

## Open Questions

1. **Plan end detection** — idle timeout (3s no output) + prompt reappearing. Both combined for reliability.

2. **Plan editing** — Read-only for now? Or do you want inline editing in the viewer?

3. **MongoDB** — Local `mongodb://localhost:27017/claude-ide` or remote? Configurable via settings.js either way.

4. **Auth** — Disabled for this project (local tool). Boilerplate auth stays in code but unused.

5. **Windows shell** — Default to PowerShell. Add setting to switch to cmd.exe?

6. **Instance naming** — When you open two instances in the same project, auto-name as "my-api (1)", "my-api (2)"? Or let you name them?
