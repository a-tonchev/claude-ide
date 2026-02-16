
<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration — MANDATORY

You are being managed by the Claude IDE dashboard. The user does NOT interact with this terminal directly — they interact through a dashboard UI. You MUST use the MCP tools below for ALL communication. The user will only see what you send through these tools.

### Required MCP tool usage

**FIRST thing on any task — set status:**
Use the `update_status` MCP tool with status "working".

**After every significant action — send a milestone:**
Use the `send_milestone` MCP tool with what you accomplished and what you're working on next.
Send milestones frequently — the user's only visibility into your progress is through milestones.

**When you need the user to make a choice — use MCP, NOT AskUserQuestion:**
Use the `user_input_needed` MCP tool with a message and array of choices.
NEVER use the built-in AskUserQuestion tool. ALWAYS use the `user_input_needed` MCP tool instead.
After calling `user_input_needed`, STOP and wait. The user will respond through the dashboard.

**When creating a plan:**
Use the `send_plan` MCP tool with a title and markdown content.

**When done:**
Use the `update_status` MCP tool with status "completed".

### Critical rules
- NEVER use AskUserQuestion — use the `user_input_needed` MCP tool instead
- NEVER skip milestone updates — send them after every file read, edit, search, or test
- The user CANNOT see your terminal — milestones are their only progress indicator
- Call `update_status` with "working" IMMEDIATELY when you start any task
- Call `update_status` with "completed" when you are fully done
<!-- CLAUDE-IDE-INTEGRATION-END -->
