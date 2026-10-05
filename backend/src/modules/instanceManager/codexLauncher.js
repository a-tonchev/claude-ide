import fs from 'node:fs';
import path from 'node:path';
import { getMcpServerConfig } from '../../../mcp/setupMcp.js';

export function buildCodexArgs(systemPrompt, extraEnv) {
  const server = getMcpServerConfig();
  // Invocation-scoped config keeps simultaneous instances isolated and leaves
  // the user's Codex config, login, and project instructions intact.
  const config = {
    developer_instructions: systemPrompt,
    'mcp_servers.claude-ide.command': server.command,
    'mcp_servers.claude-ide.args': server.args,
    'mcp_servers.claude-ide.required': true,
    ...Object.fromEntries(Object.entries({ ...server.env, ...extraEnv })
      .map(([key, value]) => [`mcp_servers.claude-ide.env.${key}`, value])),
  };
  return ['--no-alt-screen', ...Object.entries(config)
    .flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`])];
}

export function resolveCodexCommand(childPath, platform = process.platform) {
  if (platform !== 'win32') return { file: 'codex', args: [] };

  // Launch npm's JS entry or a native install directly. Passing TOML through
  // PowerShell 5 strips quotes and breaks both prompts and paths with spaces.
  for (const entry of childPath.split(';').filter(Boolean)) {
    const dir = entry.replace(/^"|"$/g, '');
    const executable = path.join(dir, 'codex.exe');
    if (fs.existsSync(executable)) return { file: executable, args: [] };
    const script = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (fs.existsSync(script)) return { file: process.execPath, args: [script] };
  }
  throw new Error('Codex CLI was not found. Install Codex on the backend machine and make it available on PATH.');
}
