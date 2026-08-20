// A tombstone for the service worker that used to live here.
//
// The game shipped a CACHE-FIRST worker scoped to this directory: it answered
// navigations from the cache and refreshed in the background. Deleting the
// files and leaving a notice in their place therefore would not have worked —
// a returning player's browser would keep serving them the whole cached game
// from the old address, indefinitely and offline, and they would never see a
// word about the move.
//
// A worker is re-fetched and byte-compared on navigation, so replacing it with
// this is the way out: it takes over, empties every cache it can see,
// unregisters itself, and reloads whatever windows it controls — which land on
// `index.html`, which is now the notice. `index.html` clears up after it as
// well, for anyone whose registration outlived this file.
//
// There is deliberately no `fetch` handler. Without one the worker is
// transparent, and every request goes to the network as if it were not here.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      // Reload the tabs that were being served the old game, so the notice is
      // seen on this visit rather than the next one.
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) {
        try {
          await client.navigate(client.url);
        } catch {
          // A client we are not allowed to navigate. It will pick the notice up
          // on its next load, which is now uncached.
        }
      }
    })(),
  );
});
