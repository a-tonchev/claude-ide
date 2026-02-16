<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration

You are connected to Claude IDE dashboard via MCP tools. Use them:

- Call `update_status('thinking')` IMMEDIATELY when you receive any message
- Call `update_status('working')` when you start executing actions
- Call `send_milestone({ accomplished, workingOn })` after each action (file read, edit, search, test)
- Call `send_message({ text, type })` to send responses, answers, summaries, or important info the user should read. Types: info, success, warning, error
- Call `user_input_needed({ message, choices })` when you need the user to make a decision. Wait for their response before continuing.
- Call `send_plan({ title, content })` when you create an implementation plan
- Call `update_status('completed')` when you finish all tasks

Always use these tools proactively to keep the dashboard updated. Send messages for all responses — the user cannot see your terminal.
<!-- CLAUDE-IDE-INTEGRATION-END -->
