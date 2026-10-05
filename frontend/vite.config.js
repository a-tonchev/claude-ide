import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// import eslintPlugin from '@nabla/vite-plugin-eslint';
import visualizer from 'rollup-plugin-visualizer';
import path, { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return defineConfig({
    resolve: {
      alias: [{
        find: '@', replacement: path.resolve(__dirname, 'src'),
      }],
    },
    plugins: [
      {
        name: 'open-browser',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            const { port } = server.httpServer.address();
            exec(`start http://localhost:${port}`);
          });
        },
      },
      react(),
      VitePWA({
        srcDir: 'src',
        strategies: 'injectManifest',
        injectRegister: null,
        filename: 'service-worker.js',
        // The main bundle is over workbox's 2 MiB default, which fails the production build.
        injectManifest: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      }),
      // eslintPlugin({ eslintOptions: { cache: false } }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      outDir: 'build',
      assetsDir: 'static',
      sourcemap: true,
      rollupOptions: {
        plugins: [
          visualizer({
            filename: resolve(__dirname, 'analyzed.html'),
            template: 'treemap', // sunburst|treemap|network
            sourcemap: true,
          }),
        ],
      },
    },
    server: {
      host: process.env.VITE_DEV_HOST || 'localhost',
      // 3010 is the live UI; dev must never fall back onto it
      port: process.env.VITE_DEV_PORT || 3030,
      open: false,
      fs: {
        // Allow serving files from one level up to the project root
        allow: [
          '..',
        ],
      },
    },
    esbuild: {
      // jsxFactory: 'jsx',
      // jsxInject: 'import { jsx } from \'@emotion/react\'',
    },
  });
};
