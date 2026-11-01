// The Claude Code command line, without spawning anything (so it is unit-tested).
// Windows runs it through powershell.exe -Command as one string; POSIX and execution
// profiles get an argv array.

// Session names come from sessionNameFor and are always [a-z0-9-]; anything else is refused
// rather than escaped, because it would mean the name skipped that helper.
function checkedNameArgs(nameArgs = []) {
  if (!nameArgs.length) return [];
  if (nameArgs.length !== 2 || nameArgs[0] !== '-n' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(nameArgs[1])) {
    throw new Error('Invalid session name');
  }
  return nameArgs;
}

// The system prompt and the files folder are passed through environment variables
// ($env:CLAUDE_IDE_SYSTEM_PROMPT, $env:CLAUDE_IDE_FILES_DIR), never inlined.
export function claudeWindowsCommand({
  hasFilesDir = false, mcpConfigPath = null, sessionArgs = [], nameArgs = [], flagStrings = [],
} = {}) {
  const name = checkedNameArgs(nameArgs);
  // --add-dir takes several values, so it goes before the next option
  const addDirFlag = hasFilesDir ? ' --add-dir $env:CLAUDE_IDE_FILES_DIR' : '';
  const mcpFlag = mcpConfigPath ? ` --mcp-config "${mcpConfigPath}"` : '';
  // Session args are a fixed flag plus a validated UUID, so they are safe to inline.
  const sessionSuffix = sessionArgs.length ? ` ${sessionArgs.join(' ')}` : '';
  const nameSuffix = name.length ? ` -n '${name[1]}'` : '';
  const flagsSuffix = flagStrings.length ? ` ${flagStrings.join(' ')}` : '';
  return `claude --append-system-prompt $env:CLAUDE_IDE_SYSTEM_PROMPT${addDirFlag}${mcpFlag}${sessionSuffix}${nameSuffix}${flagsSuffix}`;
}

export function claudeArgv({
  systemPrompt, filesDir = null, mcpConfigPath = null, sessionArgs = [], nameArgs = [], flagArgs = [], args = [],
} = {}) {
  const mcpArgs = mcpConfigPath ? ['--mcp-config', mcpConfigPath] : [];
  const addDirArgs = filesDir ? ['--add-dir', filesDir] : [];
  return ['--append-system-prompt', systemPrompt, ...addDirArgs, ...mcpArgs, ...sessionArgs, ...checkedNameArgs(nameArgs), ...flagArgs, ...args];
}
