import os from 'os';
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
  'MCPTool(claude-ide:*)',
  'mcp__claude-ide__update_status',
  'mcp__claude-ide__send_milestone',
  'mcp__claude-ide__user_input_needed',
  'mcp__claude-ide__send_message',
  'mcp__claude-ide__send_plan',
  'Bash(dir:*)',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
];

/**
 * Ensures the shared mcp-config.json exists next to server.js.
 * Only writes when missing or when API_URL/port changed.
 */
function ensureMcpConfig() {
  const port = process.env.PORT || 6950;
  const apiPrefix = '/api/v1';

  const config = {
    mcpServers: {
      'claude-ide': {
        command: 'node',
        args: [MCP_SERVER_PATH],
        env: {
          API_URL: `http://localhost:${port}`,
          API_PREFIX: apiPrefix,
        },
      },
    },
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
    delete settings.enabledMcpjsonServers;
    delete settings.enableAllProjectMcpServers;

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
 * Removes the claude-ide entries from .claude/settings.local.json.
 */
function disableMcpInSettings(projectRoot) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.local.json');

  try {
    if (!fs.existsSync(settingsPath)) return;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    delete settings.enableAllProjectMcpServers;
    delete settings.enabledMcpjsonServers;

    if (Array.isArray(settings.permissions?.allow)) {
      const ourPerms = new Set(TOOL_PERMISSIONS);
      settings.permissions.allow = settings.permissions.allow.filter(p => !ourPerms.has(p));
      if (settings.permissions.allow.length === 0) delete settings.permissions.allow;
      if (settings.permissions && Object.keys(settings.permissions).length === 0) {
        delete settings.permissions;
      }
    }

    if (Object.keys(settings).length === 0) {
      fs.unlinkSync(settingsPath);
    } else {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch (e) {
    // Ignore cleanup errors
  }
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

/**
 * Full cleanup: remove tool permissions from project settings.
 */
function cleanupForClaude(projectCwd) {
  const root = findGitRoot(projectCwd);
  disableMcpInSettings(root);
}

export {
  ensureMcpConfig,
  enableMcpInSettings,
  disableMcpInSettings,
  findGitRoot,
  setupForClaude,
  cleanupForClaude,
  MCP_SERVER_PATH,
  MCP_CONFIG_PATH,
};
