// Loading PixiJS.
//
// Pixi comes from a CDN, pinned to an exact version with a Subresource
// Integrity hash. That buys batched WebGL sprite rendering for free, at the
// cost of the one thing a classroom cannot always offer: a working network on
// first load.
//
// So the load is defended three ways, in order:
//
//   1. `index.html` carries `<link rel="modulepreload" integrity=...>`, which
//      is what applies SRI here — a bare dynamic `import()` cannot be checked.
//      The import below then reuses that already-verified response.
//   2. A service worker caches the bundle on first success, so every visit
//      after the first works with no network at all.
//   3. If it still fails, the caller gets a clean, translated explanation
//      instead of a black canvas.
//
// If a fully air-gapped lab ever needs it, drop the file next to index.html and
// point LOCAL_URL at it; the loader prefers a local copy when one exists.

export const PIXI_VERSION = '8.19.0';
export const PIXI_URL = `https://cdn.jsdelivr.net/npm/pixi.js@${PIXI_VERSION}/dist/pixi.min.mjs`;
export const PIXI_SRI = 'sha384-tzOF3u3ENZL6upupKzzwDX4ZejjfFAIk3YWjgqGaOhyGL5lgC0i4AYng0reLPTwu';

/** A vendored copy, if someone has placed one here. Absent by default. */
const LOCAL_URL = './vendor/pixi.min.mjs';

let PIXI = null;
let loading = null;

/**
 * @returns {Promise<object>} the Pixi namespace
 * @throws {Error} with `.code = 'pixi-unavailable'` when every route failed
 */
export function loadPixi() {
  if (PIXI) return Promise.resolve(PIXI);
  if (loading) return loading;

  loading = (async () => {
    // A vendored copy wins: it is the only route that cannot be blocked.
    try {
      const head = await fetch(LOCAL_URL, { method: 'HEAD' });
      if (head.ok) {
        PIXI = await import(/* @vite-ignore */ LOCAL_URL);
        return PIXI;
      }
    } catch {
      // No local copy. Entirely expected.
    }

    try {
      PIXI = await import(/* @vite-ignore */ PIXI_URL);
      return PIXI;
    } catch (cause) {
      const err = new Error(`PixiJS ${PIXI_VERSION} could not be loaded`);
      err.code = 'pixi-unavailable';
      err.cause = cause;
      loading = null;
      throw err;
    }
  })();

  return loading;
}

/** The namespace, once loaded. Throws rather than returning a half-built scene. */
export function pixi() {
  if (!PIXI) throw new Error('loadPixi() has not resolved yet');
  return PIXI;
}

export const isPixiReady = () => PIXI !== null;
