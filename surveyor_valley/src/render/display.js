// Two stacked canvases, and the resize rules that keep them honest.
//
//   #world    PixiJS/WebGL. The pixel-art valley.
//   #overlay  Canvas2D at full device resolution. Sight lines, the tripod disc,
//             DMS labels, the traverse figure, the scale bar.
//
// The split is the single decision that made this overhaul cheap. The survey
// instrumentation wants crisp full-resolution text and hairlines; the world
// wants chunky nearest-neighbour pixels. Trying to serve both from one surface
// means either blurry sprites or aliased type. Stacked, each gets what it needs
// — and `render/overlays.js` carried over from Phase 1 untouched.
//
// Resolution is deliberately an INTEGER for the world layer. On a 1.5x display,
// a fractional device-pixel ratio puts art pixels between screen pixels and the
// whole scene crawls as you walk.

import { loadPixi } from './pixi.js';

const clampDpr = () => Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));

export async function makeDisplay({ worldCanvas, overlayCanvas, camera }) {
  const PIXI = await loadPixi();

  const worldRes = Math.min(2, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));

  const app = new PIXI.Application();
  await app.init({
    canvas: worldCanvas,
    antialias: false,
    resolution: worldRes,
    autoDensity: true,
    backgroundAlpha: 1,
    background: 0x6f8f52,
    preference: 'webgl',
    // Pixi rounds sprite positions for us as a second line of defence; the
    // scene already rounds in base pixels, and belt-and-braces costs nothing.
    roundPixels: true,
  });

  // The ticker is not used: `core/loop.js` owns the fixed timestep and calls
  // `app.renderer.render` itself. Two independent clocks would fight.
  app.ticker.stop();

  const ctx = overlayCanvas.getContext('2d');
  let overlayDpr = clampDpr();

  function resize() {
    const rect = worldCanvas.parentElement.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width));
    const cssH = Math.max(240, Math.round(rect.height));

    app.renderer.resize(cssW, cssH);

    overlayDpr = clampDpr();
    const wantW = Math.round(cssW * overlayDpr);
    const wantH = Math.round(cssH * overlayDpr);
    if (overlayCanvas.width !== wantW || overlayCanvas.height !== wantH) {
      overlayCanvas.width = wantW;
      overlayCanvas.height = wantH;
    }
    overlayCanvas.style.width = `${cssW}px`;
    overlayCanvas.style.height = `${cssH}px`;

    camera.setViewport(cssW, cssH);
    camera.clampToBounds();
    return { cssW, cssH };
  }

  /** Clear and set up the overlay context so all drawing is in CSS pixels. */
  function beginOverlay() {
    ctx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
    ctx.clearRect(0, 0, camera.vw, camera.vh);
    return ctx;
  }

  return {
    app,
    stage: app.stage,
    ctx,
    beginOverlay,
    resize,
    present: () => app.renderer.render(app.stage),
    get worldResolution() {
      return worldRes;
    },
    get overlayResolution() {
      return overlayDpr;
    },
    destroy() {
      app.destroy(true, { children: true });
    },
  };
}
