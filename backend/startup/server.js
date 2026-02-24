import uWebSockets from 'uWebSockets.js';

import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import mongoPool from '#modules/db/mongoPool';

import setupFaviconRoute from './routes/setup/setupFaviconRoute';
import setupMainRoute from './routes/setup/setupMainRoute';
import setupCorsPreflightRoute from './routes/setup/setupCorsPreflightRoute';
import setupRouteHandlers from './routes/setup/setupRouteHandlers';
import setupNotFoundRoute from './routes/setup/setupNotFoundRoute';
import WsHandler from '#modules/wsHandler/WsHandler';
import InstanceManager from '#modules/instanceManager/InstanceManager';

const settingsToUse = SystemSettingsServices.getSettings();

const mongoSetup = mongoPool({
  uri: settingsToUse.MONGO_URL,
  dbName: settingsToUse.dbName,
});

const port = Number(process.env.PORT || 6950);

const app = uWebSockets.App();

setupFaviconRoute(app);

setupMainRoute(app);

setupCorsPreflightRoute(app);

WsHandler.setup(app);

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
process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});
