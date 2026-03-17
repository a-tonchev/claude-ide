#!/usr/bin/env node

/**
 * MCP Server for Claude IDE instances.
 * Communicates via stdio using newline-delimited JSON (NDJSON).
 * Reads INSTANCE_ID and PROJECT_ID from process.env.
 */

import { appendFileSync } from 'fs';
import { join } from 'path';

const LOG_FILE = join(process.env.TEMP || process.env.TMP || '/tmp', 'claude-ide-mcp.log');

function log(msg) {
  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // ignore log errors
  }
}

log(`MCP server starting. PID=${process.pid}`);

const INSTANCE_ID = process.env.INSTANCE_ID;
const PROJECT_ID = process.env.PROJECT_ID;
const OBSERVER_ID = process.env.OBSERVER_ID;
const API_URL = process.env.API_URL || 'http://localhost:6950';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

async function apiPost(path, body) {
  const url = `${API_URL}${API_PREFIX}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  } catch (err) {
    log(`API error: ${err.message} (${url})`);
    return { error: err.message };
  }
}

const tools = {
  update_status: {
    description: 'Update the status of this Claude instance',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ready', 'thinking', 'planning', 'plan_ready', 'waiting', 'working', 'completed'],
          description: 'The new status',
        },
      },
      required: ['status'],
    },
    async handler({ status }) {
      return apiPost(`/instances/${INSTANCE_ID}/status`, { status });
    },
  },

  send_milestone: {
    description: 'Send a progress milestone update',
    inputSchema: {
      type: 'object',
      properties: {
        accomplished: {
          type: 'string',
          description: 'What was just accomplished',
        },
        workingOn: {
          type: 'string',
          description: 'What is being worked on next',
        },
      },
      required: ['accomplished', 'workingOn'],
    },
    async handler({ accomplished, workingOn }) {
      return apiPost(`/instances/${INSTANCE_ID}/milestones`, { accomplished, workingOn });
    },
  },

  user_input_needed: {
    description: 'Request input from the user with a set of choices',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The question or message to show the user',
        },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of choices for the user to pick from',
        },
      },
      required: ['message', 'choices'],
    },
    async handler({ message, choices }) {
      return apiPost(`/instances/${INSTANCE_ID}/user-input`, { message, choices });
    },
  },

  send_message: {
    description: 'Send a message to the dashboard that the user should see. Use for responses to questions, important information, final summaries, or any output the user needs to read.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The message text to display to the user',
        },
        type: {
          type: 'string',
          enum: ['info', 'success', 'warning', 'error'],
          description: 'Message type for styling (default: info)',
        },
      },
      required: ['text'],
    },
    async handler({ text, type }) {
      return apiPost(`/instances/${INSTANCE_ID}/messages`, { text, type });
    },
  },

  send_plan: {
    description: 'Save a plan document',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the plan',
        },
        content: {
          type: 'string',
          description: 'Full markdown content of the plan',
        },
      },
      required: ['title', 'content'],
    },
    async handler({ title, content }) {
      await apiPost(`/instances/${INSTANCE_ID}/status`, { status: 'plan_ready' });
      return apiPost('/plans/add', {
        project_id: PROJECT_ID,
        instance_id: INSTANCE_ID,
        title,
        content,
        status: 'draft',
      });
    },
  },
};

// KeePass tools — available to ALL instances
tools.listKeePassConfigs = {
  description: 'List all KeePass database configurations. Returns { settings: [{ _id, name, dbPath, dbName, username, hasPassword, instructions }] }. Use the _id to call getKeePassCredentials.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async handler() {
    return apiPost('/settings/all', { type: 'keepass' });
  },
};

tools.getKeePassCredentials = {
  description: 'Get decrypted KeePass database credentials by settings ID. Returns { credentials: { name, dbPath, dbName, username, password, instructions } } or { credentials: null }. For observers: if no settingsId is provided, automatically uses the observer\'s linked KeePass config.',
  inputSchema: {
    type: 'object',
    properties: {
      settingsId: {
        type: 'string',
        description: 'The _id of the KeePass settings to retrieve. Optional for observers (auto-resolved from observer config).',
      },
    },
  },
  async handler({ settingsId } = {}) {
    let resolvedId = settingsId;
    // For observers: auto-resolve from observer config if no settingsId provided
    if (!resolvedId && OBSERVER_ID) {
      const observer = await apiPost('/observers/getInstructions', { observerId: OBSERVER_ID });
      resolvedId = observer?.data?.keepassSettingsId;
    }
    if (!resolvedId) {
      return { credentials: null };
    }
    const result = await apiPost('/settings/getCredentials', { settingsId: resolvedId });
    return result?.data || { credentials: null };
  },
};

// Observer-only tools — only available when OBSERVER_ID is set
if (OBSERVER_ID) {
  tools.getObserver = {
    description: 'Get the observer instructions from the database. Returns { name, instructions, keepassSettingsId, keepassEntryPath }.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async handler() {
      return apiPost('/observers/getInstructions', { observerId: OBSERVER_ID });
    },
  };

  tools.setObserver = {
    description: 'Save/overwrite the observer instructions in the database. Always write the complete instructions string.',
    inputSchema: {
      type: 'object',
      properties: {
        instructions: {
          type: 'string',
          description: 'The complete instructions string to save',
        },
      },
      required: ['instructions'],
    },
    async handler({ instructions }) {
      return apiPost('/observers/setInstructions', { observerId: OBSERVER_ID, instructions });
    },
  };

  log(`Observer tools enabled for observer ${OBSERVER_ID}`);
}

// --- NDJSON stdio transport ---
// Claude Code uses newline-delimited JSON, NOT Content-Length framing.

let inputBuffer = '';

process.stdin.setEncoding('utf8');

function send(obj) {
  const json = JSON.stringify(obj);
  log(`--> ${json.substring(0, 200)}`);
  process.stdout.write(json + '\n');
}

function sendResponse(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMessage(msg) {
  const { id, method, params } = msg;
  log(`<-- ${method} (id=${id})`);

  if (method === 'initialize') {
    return sendResponse(id, {
      protocolVersion: '2025-11-25',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'claude-ide',
        version: '1.0.0',
      },
    });
  }

  if (method === 'notifications/initialized') {
    return; // no response needed
  }

  if (method === 'tools/list') {
    const toolList = Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
    return sendResponse(id, { tools: toolList });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    const tool = tools[name];
    if (!tool) {
      return sendError(id, -32601, `Unknown tool: ${name}`);
    }

    try {
      const result = await tool.handler(args || {});
      return sendResponse(id, {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
      });
    } catch (err) {
      log(`Tool error (${name}): ${err.message}`);
      return sendResponse(id, {
        content: [
          { type: 'text', text: `Error: ${err.message}` },
        ],
        isError: true,
      });
    }
  }

  if (id) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

// Sequential message queue — ensures tool calls are processed in order
// so that e.g. send_message completes before update_status('completed')
const messageQueue = [];
let processing = false;

async function drainQueue() {
  if (processing) return;
  processing = true;
  while (messageQueue.length) {
    const msg = messageQueue.shift();
    try {
      await handleMessage(msg);
    } catch (err) {
      log(`Handler error: ${err.message}`);
    }
  }
  processing = false;
}

function processBuffer() {
  // Split by newlines — each line is a complete JSON message
  const lines = inputBuffer.split('\n');
  // Keep the last incomplete line in the buffer
  inputBuffer = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const msg = JSON.parse(trimmed);
      messageQueue.push(msg);
    } catch (err) {
      log(`Parse error: ${err.message} | line: ${trimmed.substring(0, 100)}`);
    }
  }

  drainQueue();
}

process.stdin.on('data', chunk => {
  inputBuffer += chunk;
  processBuffer();
});

process.stdin.on('end', () => {
  log('stdin ended, exiting');
  process.exit(0);
});

process.on('uncaughtException', err => {
  log(`UNCAUGHT: ${err.message}\n${err.stack}`);
  process.exit(1);
});

log('MCP server ready, waiting for input');
