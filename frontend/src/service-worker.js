import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// Workbox manifest revisions determine freshness; a static env suffix cannot identify a release.
// Keep caches scoped to this application. Never copy HTML between old and new precaches.
setCacheNameDetails({ prefix: 'claude-ide' });
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

const fileExtensionRegexp = /\/[^/?]+\.[^/]+$/;
registerRoute(
  ({ request, url }) => request.mode === 'navigate'
    && !url.pathname.startsWith('/_') && !fileExtensionRegexp.test(url.pathname),
  createHandlerBoundToURL('/index.html'),
);
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'claude-ide-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200 })],
  }),
);

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
  if (type === 'SKIP_WAITING_WHEN_SOLO') {
    event.waitUntil(self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      if (clients.length < 2) return self.skipWaiting();
      return undefined;
    }));
  }
  if (type === 'OPEN_MESSAGE_DIALOG_ALL_CLIENTS') {
    event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => client.postMessage({ msg: 'OPEN_DIALOG' }));
    }));
  }
  // Compatibility for a previously cached UI, once this worker is active. Always reply
  // to the requesting tab; never pick the first tab or navigate unrelated clients.
  if (type === 'FORCE_REFRESH_SW') {
    event.source?.postMessage({ msg: 'CACHE_PREPARED' });
  }
  if (type === 'RELOAD_CLIENTS') {
    event.waitUntil(Promise.resolve(event.source?.navigate?.(event.source.url)));
  }
});
