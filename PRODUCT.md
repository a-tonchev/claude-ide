# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** the developer who runs it (the repo owner) — runs many Claude Code and Codex agents in
  parallel across several projects, for hours at a time, often in the evening.
  - **Desktop (Windows):** the main dashboard with several agent cards per page, terminals below.
  - **Phone (mobile web over the LAN):** mostly the per-instance window (`/window/:instanceId`), which
    is cleaner for following and steering one agent; the dashboard's one-card-per-page view too.
- **Secondary:** other developers who self-host it (the repository is public).

Job: start agents, see at a glance which are thinking, working, waiting for an answer or done,
answer their questions and approve plans quickly, read their results, and drop into a terminal when
needed.

## Product Purpose

A control panel for running and supervising many AI coding agents at once. Success: the user can
keep a dozen agents moving without reading terminals — nothing waits unnoticed, answers take one
tap, and an agent's state and latest output are readable in seconds.

## Positioning

Agents don't talk in the terminal. Each spawned Claude/Codex instance gets injected instructions and
MCP tools, and reports through them: status, milestones, messages, plans and multiple-choice
questions. That structured feed is what lets many agents share one screen; the raw terminal is
secondary.

## Operating Context

- Groups (tabs) per project hold AI cards (Claude or Codex), observer cards and terminal cards; a
  group can be saved, started and stopped as a whole.
- Instances are remembered across exits, crashes and backend restarts and can be resumed.
- Observer agents manage remote servers; KeePass credentials are available to agents.
- Chat attachments: files uploaded, pasted or dropped into a chat are stored per instance and passed
  to the agent by path; a shared folder keeps files across instances.
- Two installs run side by side: live (always on) and dev.

## Capabilities and Constraints

- Web app for desktop and mobile web. Mobile flow: full-screen group and card pickers, one card per
  page, each running card with Chat and Terminal tabs.
- Stack: React 19 + Vite, **Material UI 7** (with Emotion) and Jotai; plain JavaScript (no
  TypeScript); xterm.js terminals; MUI icons and Phosphor icons. No Tailwind/shadcn. Keep
  dependencies minimal.
- Long sessions with many live-updating cards: density, scanability and status visibility matter more
  than decoration.
- Terminology in the UI: groups, cards, AI instances (Claude / Codex), terminal instances, observer
  instances, plans, remembered instances, launch flags.

## Evidence on Hand

No logo or brand assets beyond the product name "Claude IDE" and a hexagon icon in the title bar. No
testimonials, users or metrics — do not invent any.

## Product Principles

1. **Attention goes to what needs the user:** waiting questions and finished work must stand out
   from everything that is just running.
2. **Many at once, one at a time:** dense overview on desktop; focused single-agent view on mobile.
3. **The feed is the interface:** messages, milestones, plans and questions are the primary content;
   the terminal is a fallback.
4. **Never lose work:** state survives restarts; destructive actions confirm.
5. **Built for long sessions:** calm, low-glare, dark-first, readable for hours.
