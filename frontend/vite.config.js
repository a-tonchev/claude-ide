import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// import eslintPlugin from '@nabla/vite-plugin-eslint';
import visualizer from 'rollup-plugin-visualizer';
import path, { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

import resolveBranding from './branding.mjs';

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  const branding = resolveBranding(process.env, mode);

  return defineConfig({
    resolve: {
      alias: [{
        find: '@', replacement: path.resolve(__dirname, 'src'),
      }],
    },
    plugins: [
      {
        name: 'environment-branding',
        transformIndexHtml() {
          return [
            { tag: 'title', children: branding.name, injectTo: 'head' },
            {
              tag: 'link',
              attrs: {
                rel: 'icon', type: 'image/png', sizes: '32x32', href: `/branding/${branding.environment}-32.png`,
              },
              injectTo: 'head',
            },
            { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: branding.icon }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'apple-touch-icon', href: branding.appleIcon }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'theme-color', content: branding.color }, injectTo: 'head' },
          ];
        },
      },
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
        manifest: {
          id: '/',
          name: branding.name,
          short_name: branding.name,
          start_url: '/',
          display: 'standalone',
          theme_color: branding.color,
          background_color: '#2B2B2B',
          icons: [
            { src: branding.icon, sizes: 'any', type: 'image/svg+xml' },
            { src: branding.appleIcon, sizes: '192x192', type: 'image/png' },
            { src: `/branding/${branding.environment}-512.png`, sizes: '512x512', type: 'image/png' },
          ],
        },
        // The main bundle is over workbox's 2 MiB default, which fails the production build.
        injectManifest: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      }),
      // eslintPlugin({ eslintOptions: { cache: false } }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __APP_BRANDING__: JSON.stringify(branding),
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
