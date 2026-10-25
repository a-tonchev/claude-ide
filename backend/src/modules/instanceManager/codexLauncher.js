import fs from 'node:fs';
import path from 'node:path';
import { getMcpServers } from '../../../mcp/setupMcp.js';

export function buildCodexArgs(systemPrompt, extraEnv) {
  // Invocation-scoped config keeps simultaneous instances isolated and leaves
  // the user's Codex config, login, and project instructions intact.
  const config = {
    developer_instructions: systemPrompt,
  };
  for (const [name, server] of Object.entries(getMcpServers())) {
    config[`mcp_servers.${name}.command`] = server.command;
    config[`mcp_servers.${name}.args`] = server.args;
    if (name === 'claude-ide') {
      config[`mcp_servers.${name}.required`] = true;
      // Codex filters the MCP child's inherited environment; forward the credential by name.
      config[`mcp_servers.${name}.env_vars`] = ['CLAUDE_IDE_MCP_TOKEN'];
      for (const [key, value] of Object.entries({ ...server.env, ...extraEnv })) {
        if (key !== 'CLAUDE_IDE_MCP_TOKEN') config[`mcp_servers.${name}.env.${key}`] = value;
      }
    }
  }
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
