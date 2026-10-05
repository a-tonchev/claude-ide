# Discord ↔ Claude IDE bridge — design & build plan

Designed 2026-08-17. **Nothing is built yet.** This file is the record so the work can be
picked up in a session where backend edits are safe.

Goal: bind one running Claude instance to one Discord channel. Messages typed in Discord
arrive in the instance exactly as if they had been typed in the dashboard input bar, and
Claude's responses are mirrored back to the channel. Messages that arrive while no instance
is bound accumulate in MongoDB and can be read later.

---

## Core principle

A Discord message is **a regular user message**, not a special channel. It travels the same
path as dashboard typing (`user_message` + `input`), with the single difference that it is
also written to a MongoDB collection.

An earlier draft moved message content into the DB and used a content-free "poke" into the
PTY to wake Claude, which then pulled via MCP. **That was rejected** — it is more machinery
for no gain. The MCP pull tool survives only for reading *history / backlog*, not for live
delivery. There is no poke concept anywhere in this design.

---

## The three cases

### Case 1 — instance running, Discord active

Message arrives → bridge does three things:

1. Writes it to the `discordMessages` collection, marked **read** (read = *delivered into
   the instance*, not *Claude acknowledged it*).
2. Sends `user_message` to the backend (records it in the instance feed).
3. Sends `input` with `data: text + '\r'` (types it into the PTY).

Every open dashboard shows the message in the card feed. Claude responds via MCP, and the
response is mirrored back to Discord.

Mid-task arrivals need no special handling — they behave exactly like typing into the
dashboard while Claude is working, because it is literally the same code path.

### Case 2 — no instance running

Only step 1 happens. Rows accumulate as **unread**. Nothing else.

### Case 3 — starting an instance and catching up

Spawn an instance, flip the Discord toggle on its card. The toggle sends a **normal user
message** ("Discord connected, N unread messages"), and Claude reads the backlog with the
MCP tool, e.g. `get_discord_messages({ limit, skip, status })`. Paging with limit/skip keeps
a large backlog from overloading a single turn. The user can also ask for older history at
any time ("catch me up on the last 10", "everything since yesterday").

**The pull must mark returned rows as read**, otherwise every subsequent call replays the
same batch and Claude cannot tell what is new.

---

## Binding

Exclusive: **one bound instance at a time**, radio-button style — activating instance B
clears instance A. That makes inbound routing unambiguous with zero extra logic.

Held in memory (a single module-level variable in the backend), not persisted. It dies with
the instance and with a backend restart; you respawn and re-activate manually. This is
deliberate — it is the same decision made for instance titles on 2026-08-06, and it avoids
reintroducing the "new instance silently inherits stale state" bug class that fix removed.

Clear the binding automatically when the bound instance stops, and post a line into the
channel saying so, otherwise you type into a dead channel and wonder why nothing answers.

---

## Where the code lives

**A separate `discord-bridge/` process at repo root**, with its own `package.json`, run
under pm2 alongside the existing apps in `ecosystem.config.cjs`.

Reasons: any write under `backend/` restarts nodemon and tree-kills every running PTY, which
would make iterating on a bot miserable; it keeps `discord.js` out of the backend's
dependency list; and the bridge is just another API consumer, so the backend needs no
changes at all for the core live loop.

The bridge holds **two** long-lived connections, both needing reconnect logic:

- The Discord gateway (see below).
- The backend WebSocket — this one drops far more often, since every backend file edit
  restarts nodemon. The frontend already has auto-reconnect; the bridge needs its own.

---

## Discord API facts that shape the design

- **Webhooks are send-only.** There is no "outgoing webhook" like Slack has. A webhook URL
  is something you POST *to*; it never delivers messages *to you*.
- **The gateway is the only way to receive normal channel messages.** A persistent WSS
  connection, identify with a bot token, receive `MESSAGE_CREATE`. Crucially it is an
  **outbound** connection, so it works from localhost behind NAT with no public URL, no
  tunnel and no TLS certificate.
- **Interactions Endpoint URL** is the one webhook-shaped receive mechanism, but it only
  fires for slash commands / buttons / modals, never for typed messages, and needs a public
  HTTPS endpoint with Ed25519 signature verification. Rejected.
- Sending uses the same bot token: `POST /channels/{id}/messages`. No separate webhook
  needed once the bot connection exists.

### Reliability over days

Discord periodically sends a Reconnect opcode, invalidates sessions, and expects RESUME with
the correct session id and sequence number; a missed heartbeat ACK yields a zombie socket
that looks open but delivers nothing. **Use `discord.js`** rather than hand-rolling the
gateway — an earlier note in this conversation suggested a ~150-line zero-dependency client,
which is fine for a toy but wrong for something that must stay up for days.

(For reference: Node here is **v24.11.1**, which has global `WebSocket`, `FormData` and
`Blob`, so the REST/upload side is dependency-free regardless of the gateway choice.)

### Setup gotchas

- **MESSAGE_CONTENT is a privileged intent** (bitfield `33280` together with guild messages).
  For a private bot under 100 servers it is just a toggle in the Developer Portal with no
  review process — but without it, message text arrives **empty**, which is the classic
  first-run confusion.
- Ignore inbound messages where `author.bot` is true, so the bridge never consumes its own
  output.

---

## What flows out to Discord

| Event | Relay? | Notes |
|---|---|---|
| `claude_message` (from `send_message`) | **Yes** | The real content. The system prompt already forces `send_message` for every response, so this gives full coverage with no extra prompt burden. |
| `user_input_needed` | **Yes** | Claude's questions with choices. Answering them from Discord is one of the nicer parts of the feature. |
| `plan_saved` (from `send_plan`) | **Yes, as a file** | See below. |
| `status_update`, `milestone` | **Config flag, default off** | These fire on essentially every turn and will bury the actual conversation. |

Write outbound messages to the same collection with a **direction field**, so the collection
becomes the complete transcript of the Discord conversation in both directions, independent
of which instance was alive at the time.

### Plans as file attachments

The `plan_saved` WebSocket event carries **both `title` and full `content`** on the wire, so
the bridge needs no extra fetch from the plans collection.

Upload via `multipart/form-data` to the send-message endpoint with a `payload_json` part
alongside the file part — one API call posts the header line *and* the attachment. Name the
file from the plan title so it is recognizable when scrolling the channel. Attachment limits
are in the megabytes; a plan is kilobytes.

Always attach the `.md` rather than trying to inline it: Discord caps message bodies at 2000
characters and **renders no tables**, so anything non-trivial looks wrong inline. Put the
title and a one-or-two-line summary in the message body to keep the channel skimmable;
Discord shows a preview for text attachments anyway.

Long `claude_message` text needs chunking to 2000 characters for the same reason.

---

## Components to build

### Safe to write while instances are running

- `discord-bridge/` — the bot process. Gateway client, backend WS client with reconnect,
  channel↔instance routing, chunking, file upload, `author.bot` filter, allowlist.
- `frontend/` — the toggle on the instance card (Vite hot-reloads, never touches the PTYs).
  Precedent for the UI: the `remote` checkbox in `NewInstanceDialog`, and `EditableTitle`
  for inline card controls.
- `ecosystem.config.cjs` — a fourth pm2 app for the bridge, with `autorestart`.

### Kills every running instance — only with nothing in flight

- `backend/src/lib/discordMessages/` — new collection. Follow the pattern of
  `src/lib/plans/` (enums, schema/{Schema,SchemaFields}, services, setupCollection,
  setupServices, controller/{Controller,Routes}), and register it in `src/Config.js`
  (`collections` array + `setupLibs`).
- `backend/mcp/server.js` — the `get_discord_messages` tool.
- `backend/mcp/setupMcp.js` — **add the new tool name to `TOOL_PERMISSIONS`.** That list
  names each `mcp__claude-ide__*` tool explicitly; if the new one is missing, Claude stops
  and asks for permission inside the PTY, which looks exactly like a hung instance.
- `backend/src/modules/wsHandler/WsHandler.js` — a new message type to set/clear the bound
  instance and broadcast it (mirror the shape of the simplified `handleRename`), **plus the
  `user_message` broadcast fix below**.

### The `user_message` broadcast gap

`handleUserMessage` currently records the message into the instance's in-memory feed but
**publishes nothing**. The dashboard only shows your own typed messages because the frontend
adds them to its store locally and syncs other windows over BroadcastChannel — which the
bridge is not part of. So without a fix, a Discord-originated message would sit in the
backend feed and only surface after a reload.

Fix: publish the user message on the `instance_${id}` topic so every open dashboard renders
it live, the same way it renders `claude_message`.

(Note: `InstanceManager.list()` already includes `userMessages`, and the WS `open` handler
sends that snapshot to every connecting client — so **refresh persistence already works**
in-memory for the life of an instance. The DB collection is for history beyond the instance
lifetime and for the Case 2 backlog, not for surviving a page reload.)

---

## System prompt / tool discovery

The toggle is flipped **after** spawn, so the instance's `--append-system-prompt` will not
mention Discord at all. The MCP tools are still available, so Claude can discover
`get_discord_messages` from the tool list — which means **the tool description is doing the
work the system prompt normally does**. Write it to explain *when* to call it, not just what
it returns.

Alternative: add Discord instructions to the base prompt in `InstanceManager.js`
unconditionally, since they are harmless when unused.

---

## Security

`mcp/setupMcp.js` pre-approves `Bash`, `Write`, `Edit`, `WebFetch` and `Task` for spawned
instances, so **anyone who can post in the bound channel can type into a terminal running an
agent with pre-approved shell access.** Discord channel permissions become the auth boundary
(see also the local `SECURITY-TODO.md`).

Minimum: a private channel plus a hardcoded allowlist of Discord user IDs in the bridge that
ignores everyone else. Cheap, and worth having from day one.

---

## Build order

1. `discord-bridge/` process — live loop only (Case 1 in, `claude_message` out). Zero risk
   to running instances. Requires a bot token from the Discord Developer Portal, which must
   be supplied by the user; read it from a config file or env var, never commit it.
2. Frontend toggle on the card.
3. Backend pass, with nothing in flight: collection + routes, MCP tool + `TOOL_PERMISSIONS`,
   WS binding message type, and the `user_message` broadcast fix.
4. Plans as attachments, `user_input_needed` relay, statuses behind a config flag.

---

## Open decisions

- Whether the bridge writes to Mongo directly or posts through a backend route. A backend
  route keeps DB access in one place; direct access keeps the bridge working while the
  backend is restarting.
- Whether answering a `user_input_needed` question from Discord maps to `user_response`
  (choice-based) or is just handled as ordinary text.
- Retention/pruning policy for the `discordMessages` collection.
