import uWebSockets from 'uWebSockets.js';

import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import mongoPool from '#modules/db/mongoPool';

import setupFaviconRoute from './routes/setup/setupFaviconRoute';
import setupMainRoute from './routes/setup/setupMainRoute';
import setupCorsPreflightRoute from './routes/setup/setupCorsPreflightRoute';
import setupRouteHandlers from './routes/setup/setupRouteHandlers';
import setupNotFoundRoute from './routes/setup/setupNotFoundRoute';
import setupFileRoutes from './routes/setup/setupFileRoutes';
import WsHandler from '#modules/wsHandler/WsHandler';
import InstanceManager from '#modules/instanceManager/InstanceManager';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import { ensureMcpConfig, setMcpApiPort } from '../mcp/setupMcp.js';

const settingsToUse = SystemSettingsServices.getSettings();

const mongoSetup = mongoPool({
  uri: settingsToUse.MONGO_URL,
  dbName: settingsToUse.dbName,
});

// Each install (live, dev) sets its port in its own settings.js. A PORT variable is not
// read: spawned instances inherit this environment, and project dev servers inside them
// use PORT. CLAUDE_IDE_PORT overrides the setting when needed. The port reaches the MCP
// config through a setter for the same reason.
const port = Number(process.env.CLAUDE_IDE_PORT || settingsToUse.port || 6950);
setMcpApiPort(port);
// Write mcp-config.json now rather than at the first instance: a rewrite then would
// restart the dev server (nodemon) and kill that instance.
try {
  ensureMcpConfig();
} catch (err) {
  console.error('[startup] MCP config not written:', err.message);
}

// Leftovers from earlier runs (MCP servers, ownerless chrome-devtools-mcp, WSL terminal
// programs), cleaned up in the background.
InstanceManager.sweepStartupOrphans();

// Nothing runs yet, so empty unreferenced drafts and feed items without an instance are leftovers.
InstanceStore.deleteUnreferencedDraftGroups()
  .then(count => {
    if (count) console.info(`[startup] removed ${count} unused draft group(s)`);
  })
  .catch(err => console.error('[startup] draft group cleanup failed:', err.message));
InstanceStore.deleteOrphanFileDirs()
  .then(count => {
    if (count) console.info(`[startup] removed ${count} orphaned attachment folder(s)`);
  })
  .catch(err => console.error('[startup] attachment folder cleanup failed:', err.message));
InstanceStore.deleteOrphanMessages()
  .then(count => {
    if (count) console.info(`[startup] removed ${count} orphaned feed item(s)`);
  })
  .catch(err => console.error('[startup] feed item cleanup failed:', err.message));

const app = uWebSockets.App();

setupFaviconRoute(app);

setupMainRoute(app);

setupCorsPreflightRoute(app);

WsHandler.setup(app);

setupFileRoutes(app);

setupRouteHandlers(app, mongoSetup);

setupNotFoundRoute(app);

app.listen(port, listenSocket => {
  if (listenSocket) {
    if (process.env.npm_lifecycle_event === 'start-dev') {
      console.info('Start in DEVELOPMENT mode');
    } else if (!process.env.environment || process.env.environment === 'local') {
      console.info('\x1b[1m', '\x1b[33m');
      console.warn('Please use the command \'yarn start-dev\' if you intend to develop on the project');
      console.warn('\x1b[0m');
      console.info('Start in PRODUCTION mode');
    } else {
      console.info('Start in PRODUCTION mode');
    }
    console.info(`Server running on port ${port}`);
  }
});

// --- Graceful shutdown: kill all PTY instances on server exit ---
let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`\n[${signal}] Stopping all instances...`);
  const stopped = InstanceManager.stopAll();
  if (stopped.length > 0) {
    console.info(`Stopped ${stopped.length} instance(s)`);
  }
  // Give tree-kill a moment to finish before exiting
  setTimeout(() => process.exit(0), 700);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// pm2 can't deliver signals on Windows; with shutdown_with_message it sends this instead.
if (process.send) {
  process.on('message', msg => {
    if (msg === 'shutdown') gracefulShutdown('pm2 shutdown');
  });
}
process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});
