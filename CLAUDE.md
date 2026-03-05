<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration

You are connected to Claude IDE dashboard via MCP tools. The user monitors your progress ONLY through the dashboard — they do NOT see your terminal output. You MUST use these tools to communicate ALL status changes and results.

### Status Updates (MANDATORY)
- Call `update_status('thinking')` IMMEDIATELY when you receive any message — this is the FIRST thing you do
- Call `update_status('working')` when you start executing actions (file edits, searches, commands)
- Call `update_status('completed')` when you are COMPLETELY DONE — this is your VERY LAST tool call, every single time, no exceptions.

### Completion Sequence (CRITICAL — follow this EXACT order every time)
When you are finished with a task, you MUST do these steps IN ORDER:
1. `send_milestone({ accomplished: "what you did", workingOn: "Done" })` — final milestone
2. `send_message({ text: "your result/answer", type: "success" })` — final message with the result
3. `update_status('completed')` — LAST call. ALWAYS. EVERY TIME. DO NOT FORGET THIS STEP.

If you skip step 3, the dashboard shows you as still working forever. You MUST call `update_status('completed')` after EVERY task, even trivial ones.

### Progress Reporting (after EVERY action — no exceptions)
- Call `send_milestone({ accomplished, workingOn })` after EVERY single action — every file read, every edit, every search, every test, every command.
- The user has NO other way to see what you are doing. Milestones are their ONLY window into your progress.
- Be specific in milestones: say WHAT file you read, WHAT you searched for, WHAT you edited. Not just "read a file" but "Read src/hooks/useWebSocket.js to understand reconnect logic".
- If you are about to do something that takes time (e.g., searching the codebase, running tests), send a milestone BEFORE starting so the user knows what's happening.
- Aim for at least one milestone every 10-15 seconds of work. If the user sees no updates for 30+ seconds, they think you are stuck.

### Communication (CRITICAL — NO terminal text, ONLY MCP tools)
- DO NOT write any text to the terminal. No explanations, no summaries, no "Here's what I did", no "Let me...", no conversational text AT ALL. The user CANNOT see it. Every word you write to the terminal is wasted.
- Instead, put ALL communication into `send_message()` or `send_plan()` calls:
  - `send_message({ text, type })` — for SHORT answers only (1-3 sentences). Types: info, success, warning, error
  - `send_plan({ title, content })` — for ANYTHING longer than a couple of sentences. Use full markdown.
- **IMPORTANT: When your response would be longer than ~3 sentences, ALWAYS use `send_plan()` instead of `send_message()`.** The plan viewer renders markdown beautifully (headings, code blocks, lists, diffs). `send_message` is only for brief confirmations or short answers. When in doubt, use `send_plan`.
- Your workflow should be: think silently → use tools (read/edit/search/bash) → report via `send_milestone` → deliver results via `send_message`/`send_plan` → call `update_status('completed')`. Zero terminal text output between these steps.

### Permissions & User Input (ALWAYS ask before acting)
- Before EVERY action that modifies something (bash commands, file edits, file writes, deletions), call `user_input_needed` FIRST to describe what you plan to do and get permission. Choices: ["Yes", "No"] or more specific options.
- Reading files, searching code, and listing directories are safe — no permission needed.
- NEVER run a command or edit a file without asking first via `user_input_needed`.
- NEVER wait for input in the terminal — the user will not see it. Always use `user_input_needed` instead.

#### CRITICAL: `user_input_needed` is ASYNCHRONOUS — you MUST STOP and WAIT
- When you call `user_input_needed`, the API returns `{ ok: true }` immediately. This is just an acknowledgment that the dialog was shown to the user — it is NOT the user's answer.
- After calling `user_input_needed`, you MUST **completely stop all work**. Do NOT call any other tools. Do NOT proceed with the action. Do NOT assume any answer.
- The user's actual choice will arrive as a new message in the conversation. Only after you receive that message should you continue.
- Your flow MUST be: call `user_input_needed` → call `update_status('waiting')` → **STOP** (end your turn, output nothing else) → wait for the user's response to appear as the next message → then continue based on their choice.
- If the user chose "No", do NOT proceed with the action. Acknowledge their decision via `send_message` and move on.

### Plans (use for ANY structured/detailed content)
- Call `send_plan({ title, content })` for implementation plans, AND also for:
  - Summaries of large changes or diffs (what was changed, why, before/after)
  - Code explanations or architecture overviews
  - Multi-file change breakdowns
  - Any detailed output that benefits from markdown formatting (headings, code blocks, lists)
- Use markdown with code blocks, diff syntax (```diff), and clear structure
- Whenever you make significant changes across multiple files, send a plan summarizing all the diffs and reasoning

### Restrictions
- NEVER run build commands (`vite build`, `npm run build`, `yarn build`, etc.). Only the user builds the project.

### Rules
- ZERO terminal text. Do not write prose, explanations, or commentary to the terminal. Use `send_message` or `send_plan` for everything.
- EVERY response MUST end with `update_status('completed')`. No exceptions.
- ALWAYS use `user_input_needed` instead of waiting in the terminal.
- ALWAYS send milestones frequently — the user cannot see anything else.
- The terminal is a hidden execution environment. `send_message` and `send_plan` are your ONLY way to talk to the user.
<!-- CLAUDE-IDE-INTEGRATION-END -->
