import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_SERVER_PATH = path.resolve(__dirname, 'server.js');

/**
 * Static MCP config path — lives inside claude-ide, shared by all instances.
 * INSTANCE_ID / PROJECT_ID are inherited from the pty environment.
 */
const MCP_CONFIG_PATH = path.resolve(__dirname, 'mcp-config.json');

/**
 * Walk up from cwd to find the git root (directory containing .git).
 * Falls back to cwd if no .git found.
 */
function findGitRoot(cwd) {
  let dir = cwd;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

/**
 * Tool permissions so Claude Code doesn't prompt the user
 * for standard operations inside the managed terminal.
 */
const TOOL_PERMISSIONS = [
  // Claude IDE MCP tools (both naming formats)
  'MCPTool(claude-ide:*)',
  'MCPTool',
  'mcp__claude-ide__update_status',
  'mcp__claude-ide__send_milestone',
  'mcp__claude-ide__user_input_needed',
  'mcp__claude-ide__send_message',
  'mcp__claude-ide__send_plan',
  // Observer-specific MCP tools
  'mcp__claude-ide__getObserver',
  'mcp__claude-ide__setObserver',
  // All built-in tools
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'NotebookEdit',
];

// Set by startup/server.js from settings.js; see the comment there.
let apiPort = null;
let additionalMcpServers = {};

function setMcpApiPort(port) {
  apiPort = port;
}

// This comes exclusively from the root-owned backend settings, never a client request.
// Keep the surface deliberately small: stdio command/args, with no literal credentials.
function setAdditionalMcpServers(servers = {}) {
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) throw new Error('additionalMcpServers must be an object');
  const validated = {};
  for (const [name, server] of Object.entries(servers)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || name === 'claude-ide'
      || !server || typeof server !== 'object' || Array.isArray(server)
      || Object.keys(server).some(key => !['command', 'args'].includes(key))
      || typeof server.command !== 'string' || !path.isAbsolute(server.command) || server.command.includes('\0')
      || !Array.isArray(server.args || []) || (server.args || []).some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
      throw new Error('Additional MCP servers require a safe unique name, absolute command, and string args only');
    }
    validated[name] = { command: server.command, args: [...(server.args || [])] };
  }
  additionalMcpServers = validated;
}

function getMcpServerConfig() {
  const port = apiPort || 6950;
  const apiPrefix = '/api/v1';

  return {
    command: process.execPath,
    args: [MCP_SERVER_PATH],
    env: { API_URL: `http://localhost:${port}`, API_PREFIX: apiPrefix },
  };
}

function getMcpServers() {
  return { 'claude-ide': getMcpServerConfig(), ...structuredClone(additionalMcpServers) };
}

/**
 * Ensures the shared mcp-config.json exists next to server.js.
 * Only writes when missing or when API_URL/port changed.
 */
function ensureMcpConfig() {
  const config = {
    mcpServers: getMcpServers(),
  };

  const desired = JSON.stringify(config, null, 2);

  try {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      const current = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
      if (current === desired) return MCP_CONFIG_PATH;
    }
  } catch (e) {
    // re-create on read error
  }

  fs.writeFileSync(MCP_CONFIG_PATH, desired, 'utf8');
  return MCP_CONFIG_PATH;
}

/**
 * Read, merge, and write a JSON settings file.
 */
function mergeSettingsFile(filePath, mergeFn) {
  let settings = {};
  try {
    if (fs.existsSync(filePath)) {
      settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    // Parse failed, start fresh
  }

  mergeFn(settings);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Ensures tools are auto-approved so Claude doesn't prompt in the terminal.
 */
function enableMcpInSettings(projectRoot) {
  const projectSettingsPath = path.join(projectRoot, '.claude', 'settings.local.json');
  mergeSettingsFile(projectSettingsPath, settings => {
    if (!settings.permissions) settings.permissions = {};
    if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

    for (const perm of TOOL_PERMISSIONS) {
      if (!settings.permissions.allow.includes(perm)) {
        settings.permissions.allow.push(perm);
      }
    }
  });
}

/**
 * Full setup: ensure shared MCP config exists + enable tool permissions.
 * Returns the config path for use with `claude --mcp-config`.
 */
function setupForClaude(projectCwd) {
  const root = findGitRoot(projectCwd);
  const mcpConfigPath = ensureMcpConfig();
  enableMcpInSettings(root);
  return mcpConfigPath;
}

export {
  setMcpApiPort,
  setAdditionalMcpServers,
  getMcpServerConfig,
  getMcpServers,
  ensureMcpConfig,
  enableMcpInSettings,
  findGitRoot,
  setupForClaude,
  MCP_SERVER_PATH,
  MCP_CONFIG_PATH,
};
