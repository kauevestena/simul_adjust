// Offline support.
//
// Surveyor Valley loads PixiJS from a CDN, which is a real problem in the place
// it is meant to be used: a classroom behind a captive portal, or a laptop with
// no signal. This worker fixes that after exactly one successful visit — every
// app file and the Pixi bundle are cached, and from then on the game starts
// with no network at all.
//
// Strategy is cache-first with a background refresh. The game is a fixed set of
// static files; serving them instantly and quietly updating behind the player
// is both faster and more robust than going to the network first.
//
// Bump CACHE_VERSION whenever the file list or the Pixi pin changes; old caches
// are deleted on activate.

const CACHE_VERSION = 'sv-v3';
const PIXI_URL = 'https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/dist/pixi.min.mjs';

/**
 * Every file the game needs, precached on install.
 *
 * This list must be COMPLETE, and that is not a nicety. A service worker only
 * intercepts requests made after it takes control, so the module imports issued
 * during the very first page load are never seen by it — precaching just the
 * entry point leaves the second visit with a shell, a working PixiJS and no
 * game. `tests/offline.test.mjs` fails if this list and the files on disk ever
 * disagree, because nothing else would notice until someone lost their network.
 */
const CORE = [
  './',
  './index.html',
  './styles/base.css',
  './styles/game.css',
  './styles/report.css',
  './src/audio/audio.js',
  './src/core/bus.js',
  './src/core/loop.js',
  './src/core/math2d.js',
  './src/core/noise.js',
  './src/core/rng.js',
  './src/core/state.js',
  './src/core/storage.js',
  './src/game/assistant.js',
  './src/game/economy.js',
  './src/game/input.js',
  './src/game/timer.js',
  './src/game/player.js',
  './src/game/service.js',
  './src/game/tools.js',
  './src/game/tutorial.js',
  './src/main.js',
  './src/render/atlas.js',
  './src/render/camera.js',
  './src/render/display.js',
  './src/render/effects.js',
  './src/render/groundbake.js',
  './src/render/groundpaint.js',
  './src/render/overlays.js',
  './src/render/palette.js',
  './src/render/pixbuf.js',
  './src/render/pixi.js',
  './src/render/planview.js',
  './src/render/scene.js',
  './src/render/sprites/built.js',
  './src/render/sprites/character.js',
  './src/render/sprites/ground.js',
  './src/render/sprites/index.js',
  './src/render/sprites/nature.js',
  './src/render/sprites/shared.js',
  './src/render/sprites/survey.js',
  './src/report/docmodel.js',
  './src/report/memorial.js',
  './src/report/pdf.js',
  './src/report/planta.js',
  './src/report/reportview.js',
  './src/survey/geometry.js',
  './src/survey/instrument.js',
  './src/survey/network.js',
  './src/survey/observations.js',
  './src/survey/readout.js',
  './src/survey/resection.js',
  './src/survey/station.js',
  './src/survey/traverse.js',
  './src/survey/units.js',
  './src/ui/caderneta.js',
  './src/ui/calculos.js',
  './src/ui/dom.js',
  './src/ui/hud.js',
  './src/ui/i18n.js',
  './src/ui/intro.js',
  './src/ui/lang/en.js',
  './src/ui/lang/pt.js',
  './src/ui/modal.js',
  './src/ui/notify.js',
  './src/ui/parcelpicker.js',
  './src/ui/shop.js',
  './src/ui/stationdialog.js',
  './src/ui/toolbar.js',
  './src/world/entities.js',
  './src/world/los.js',
  './src/world/names.js',
  './src/world/parcels.js',
  './src/world/scatter.js',
  './src/world/spatial.js',
  './src/world/terrain.js',
  './src/world/world.js',
  PIXI_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Individually, so one failure (an offline first visit) does not abort
      // the whole install and leave the player with no worker at all.
      await Promise.allSettled(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isPixi = request.url === PIXI_URL;
  if (!sameOrigin && !isPixi) return; // leave anything else alone

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const hit = await cache.match(request, { ignoreSearch: sameOrigin });

      const network = fetch(request)
        .then((res) => {
          // `opaque` responses have status 0 and cannot be inspected; caching
          // one would poison the cache with something we cannot verify.
          if (res && res.ok && res.type !== 'opaque') cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);

      if (hit) {
        event.waitUntil(network); // refresh in the background
        return hit;
      }

      const res = await network;
      if (res) return res;

      // Offline with nothing cached. For a navigation, the shell is better than
      // a browser error page.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    })(),
  );
});
