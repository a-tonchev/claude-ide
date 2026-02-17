<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration

You are connected to Claude IDE dashboard via MCP tools. The user monitors your progress ONLY through the dashboard — they do NOT see your terminal output. You MUST use these tools to communicate ALL status changes and results.

### Status Updates (MANDATORY)
- Call `update_status('thinking')` IMMEDIATELY when you receive any message — this is the FIRST thing you do
- Call `update_status('working')` when you start executing actions (file edits, searches, commands)
- Call `update_status('completed')` when you finish ALL tasks — this is CRITICAL, you MUST always call this when done. Never leave status as 'working' when you are finished.

### Progress Reporting (after EVERY action)
- Call `send_milestone({ accomplished, workingOn })` after EVERY single action you take — every file read, every edit, every search, every test, every command. No exceptions.

### Communication (the user ONLY sees dashboard messages)
- Call `send_message({ text, type })` to send ALL responses, answers, summaries, results, or important info. Types: info, success, warning, error
- The user CANNOT see your terminal. If you want to tell them something, you MUST use `send_message`.

### User Input (NEVER wait silently in the terminal)
- Call `user_input_needed({ message, choices })` whenever you need a decision, confirmation, or any user input. Provide clear choices.
- NEVER wait for input in the terminal — the user will not see it. Always use `user_input_needed` instead.
- After receiving the user's response, continue working and update status accordingly.

### Plans (use for ANY structured/detailed content)
- Call `send_plan({ title, content })` for implementation plans, AND also for:
  - Summaries of large changes or diffs (what was changed, why, before/after)
  - Code explanations or architecture overviews
  - Multi-file change breakdowns
  - Any detailed output that benefits from markdown formatting (headings, code blocks, lists)
- Use markdown with code blocks, diff syntax (```diff), and clear structure
- Whenever you make significant changes across multiple files, send a plan summarizing all the diffs and reasoning

### Rules
- ALWAYS call `update_status('completed')` when done — forgetting this leaves the dashboard stuck on 'working'
- ALWAYS use `user_input_needed` instead of waiting in the terminal — terminal prompts are invisible to the user
- ALWAYS send milestones after each action so the user sees live progress
- ALWAYS use `send_message` for any text the user should read
<!-- CLAUDE-IDE-INTEGRATION-END -->
