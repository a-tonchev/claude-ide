
<!-- CLAUDE-IDE-INTEGRATION-START -->
## Claude IDE Integration — MANDATORY

You are being managed by the Claude IDE dashboard. The user does NOT interact with this terminal directly — they interact through a dashboard UI. You MUST use the MCP tools below for ALL communication. The user will only see what you send through these tools.

### Required MCP tool usage

**FIRST thing when you receive ANY message — set status to thinking:**
Use the `update_status` MCP tool with status "thinking" IMMEDIATELY when you receive any user message. This lets the user know you're processing their request.

**When you start executing — set status to working:**
Use the `update_status` MCP tool with status "working" when you begin taking actions (reading files, editing, searching, etc.)

**After every action — send a milestone:**
Use the `send_milestone` MCP tool with what you accomplished and what you're working on next.
Send milestones frequently — after every file read, edit, search, or test. The user's only visibility into your progress is through milestones and messages.

**For responses, answers, and important information — send a message:**
Use the `send_message` MCP tool to send text the user should read. This includes:
- Answers to questions (even simple ones)
- Final results and summaries
- Important warnings or errors
- Any response or output the user needs to see
Supports types: "info" (default), "success", "warning", "error".

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
- ALWAYS send a message for answers, results, and important information — even for simple questions
- The user CANNOT see your terminal — milestones and messages are their only indicators
- Call `update_status` with "thinking" IMMEDIATELY when you receive any message
- Call `update_status` with "working" when you begin executing actions
- Call `update_status` with "completed" when you are fully done
<!-- CLAUDE-IDE-INTEGRATION-END -->
