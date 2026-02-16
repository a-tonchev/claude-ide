<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration

You are connected to Claude IDE dashboard via MCP tools. Use them:

- Call `update_status('working')` when you start a task
- Call `send_milestone({ accomplished, workingOn })` after each significant step
- Call `user_input_needed({ message, choices })` when you need the user to make a decision. Wait for their response before continuing.
- Call `send_plan({ title, content })` when you create an implementation plan
- Call `update_status('completed')` when you finish all tasks

Always use these tools proactively to keep the dashboard updated.
<!-- CLAUDE-IDE-INTEGRATION-END -->
