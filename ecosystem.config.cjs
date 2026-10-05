// pm2 apps for the live install (deployed by scripts/deploy-live.mjs). Dev runs from the
// checkout with nodemon + Vite on other ports; see CLAUDE.md. MongoDB is not a pm2 app: it
// runs as the Windows service "MongoDB" (config D:/development/db/mongo448.conf).
const LIVE_DIR = 'D:/Programs/claude-ide';

module.exports = {
  apps: [
    {
      // Port (6950) and database come from the live backend's own settings.js, not an
      // env var: spawned instances inherit this environment, and dev servers read PORT.
      name: 'claude-ide-backend',
      script: 'index.js',
      cwd: `${LIVE_DIR}/backend`,
      node_args: '--import ./register.mjs',
      autorestart: true,
      restart_delay: 2000,
      // Signals don't reach Node on Windows, so pm2 asks for a graceful shutdown with an
      // IPC message and waits for the backend to stop its instances.
      shutdown_with_message: true,
      kill_timeout: 10000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'claude-ide-frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: `${LIVE_DIR}/frontend`,
        PM2_SERVE_PORT: 3010,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
      autorestart: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
