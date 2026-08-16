// The one place metres become pixels.
//
// `zoom` is screen pixels per metre, so a 100 m sight line at zoom 32 is 3200 px
// long and the scale bar needs no conversion factor of its own.
//
// The Y flip lives here and nowhere else: North is up in the world, down on a
// screen. Every other module works in metres and stays honest.
//
// Two rules keep the pixel art sharp, and both are load-bearing:
//
//   1. Field zoom is an INTEGER MULTIPLE of the 16 px/m art resolution. Scaling
//      pixel art by 1.37 gives the soft mush that made the first version look
//      like a stretched screenshot.
//   2. The camera snaps to whole base pixels (1/16 m). Without it, everything on
//      screen shimmers as you walk, because each sprite rounds to a different
//      pixel from one frame to the next.

import { PX_PER_M } from './pixbuf.js';

/**
 * Screen pixels per metre.
 * 16/32/48/64 are the field rungs (x1..x4 of the art). 4 and 8 are the plan
 * view, which draws lines rather than sprites and so does not need an integer
 * relationship to anything.
 */
export const ZOOM_LADDER = [4, 8, 16, 32, 48, 64];
export const ZOOM_MIN = ZOOM_LADDER[0];
export const ZOOM_MAX = ZOOM_LADDER[ZOOM_LADDER.length - 1];

/** The default: a 42 x 26 m view, with a 48 x 68 px surveyor in the middle. */
export const ZOOM_DEFAULT = 32;

/** Below this the world container is hidden and the plan view takes over. */
export const PLAN_MODE_ZOOM = 12;
/** Below this, small scenery is skipped. */
export const DETAIL_ZOOM = 14;

/** One art pixel, in metres. The camera never sits between two of them. */
const BASE = 1 / PX_PER_M;
const snap = (v) => Math.round(v / BASE) * BASE;

export function makeCamera({ e = 320, n = 320, zoom = ZOOM_DEFAULT } = {}) {
  const cam = {
    e,
    n,
    zoom,
    /** Viewport size in CSS pixels; set by the renderer on resize. */
    vw: 800,
    vh: 600,
    bounds: null,

    setViewport(w, h) {
      cam.vw = w;
      cam.vh = h;
    },

    setBounds(b) {
      cam.bounds = b;
    },

    /** Integer upscale of the 16 px/m art. 1, 2, 3 or 4 in the field. */
    get scale() {
      return cam.zoom / PX_PER_M;
    },

    /** World metres -> CSS pixels. Used by the overlay canvas and hit-testing. */
    worldToScreen(we, wn) {
      return {
        x: cam.vw / 2 + (we - cam.e) * cam.zoom,
        y: cam.vh / 2 - (wn - cam.n) * cam.zoom,
      };
    },

    screenToWorld(sx, sy) {
      return {
        e: cam.e + (sx - cam.vw / 2) / cam.zoom,
        n: cam.n - (sy - cam.vh / 2) / cam.zoom,
      };
    },

    /**
     * Where the world container must sit, in SCREEN pixels, given that the
     * container itself is laid out in base pixels and scaled by `scale`.
     * Comes out integral because `cam.e` is snapped and `scale` is an integer.
     */
    containerOffset() {
      return {
        x: Math.round(cam.vw / 2 - cam.e * cam.zoom),
        y: Math.round(cam.vh / 2 + cam.n * cam.zoom),
      };
    },

    /** World rectangle currently visible, with an optional margin in metres. */
    viewRect(margin = 0) {
      const halfW = cam.vw / 2 / cam.zoom + margin;
      const halfH = cam.vh / 2 / cam.zoom + margin;
      return {
        minE: cam.e - halfW,
        maxE: cam.e + halfW,
        minN: cam.n - halfH,
        maxN: cam.n + halfH,
      };
    },

    /**
     * Critically damped follow. The exponential form is frame-rate independent,
     * so the camera behaves identically at 60 and 144 Hz — and a 1.2 m dead-zone
     * keeps it from twitching while the player shuffles about setting up.
     */
    follow(target, dt, { deadZone = 1.2, stiffness = 8 } = {}) {
      const dE = target.e - cam.e;
      const dN = target.n - cam.n;
      const d = Math.hypot(dE, dN);
      if (d > deadZone) {
        const excess = (d - deadZone) / d;
        const k = 1 - Math.exp(-stiffness * dt);
        cam.e += dE * excess * k;
        cam.n += dN * excess * k;
      }
      cam.clampToBounds();
    },

    snapTo(target) {
      cam.e = target.e;
      cam.n = target.n;
      cam.clampToBounds();
    },

    /** Keep the valley on screen, with a little slack past the edge. */
    clampToBounds(margin = 40) {
      // Every camera mutation funnels through here, so this is the one place a
      // bad coordinate can be caught. A NaN camera draws nothing at all and
      // raises no error — the entire world simply disappears — which is a
      // miserable thing to debug from a screenshot.
      if (!Number.isFinite(cam.e) || !Number.isFinite(cam.n)) {
        const b = cam.bounds;
        cam.e = Number.isFinite(cam.e) ? cam.e : b ? (b.minE + b.maxE) / 2 : 0;
        cam.n = Number.isFinite(cam.n) ? cam.n : b ? (b.minN + b.maxN) / 2 : 0;
        console.warn('[camera] non-finite position, recentred');
      }

      if (cam.bounds) {
        const b = cam.bounds;
        const halfW = cam.vw / 2 / cam.zoom;
        const halfH = cam.vh / 2 / cam.zoom;

        const minE = b.minE - margin + halfW;
        const maxE = b.maxE + margin - halfW;
        const minN = b.minN - margin + halfH;
        const maxN = b.maxN + margin - halfH;

        // When the whole world fits on screen, centre it rather than fight over it.
        cam.e = minE > maxE ? (b.minE + b.maxE) / 2 : Math.min(maxE, Math.max(minE, cam.e));
        cam.n = minN > maxN ? (b.minN + b.maxN) / 2 : Math.min(maxN, Math.max(minN, cam.n));
      }
      // Always last: whatever moved the camera, it lands on an art pixel.
      cam.e = snap(cam.e);
      cam.n = snap(cam.n);
    },

    /**
     * Zoom toward a screen point, so the ground under the cursor stays put.
     * Snaps to the ladder — there are no in-between zoom levels, by design.
     */
    zoomAt(sx, sy, dir) {
      const before = cam.screenToWorld(sx, sy);
      const idx = ZOOM_LADDER.indexOf(cam.zoom);
      const from = idx >= 0 ? idx : nearestRung(cam.zoom);
      const next = Math.min(ZOOM_LADDER.length - 1, Math.max(0, from + dir));
      if (ZOOM_LADDER[next] === cam.zoom) return cam.zoom;

      cam.zoom = ZOOM_LADDER[next];
      const after = cam.screenToWorld(sx, sy);
      cam.e += before.e - after.e;
      cam.n += before.n - after.n;
      cam.clampToBounds();
      return cam.zoom;
    },

    stepZoom(dir, sx = null, sy = null) {
      if (sx != null) return cam.zoomAt(sx, sy, dir);
      const next = Math.min(ZOOM_LADDER.length - 1, Math.max(0, nearestRung(cam.zoom) + dir));
      cam.zoom = ZOOM_LADDER[next];
      cam.clampToBounds();
      return cam.zoom;
    },

    setZoom(z) {
      cam.zoom = ZOOM_LADDER[nearestRung(z)];
      cam.clampToBounds();
      return cam.zoom;
    },

    /**
     * Frame a set of world points — used when a station is set up, so the whole
     * figure being measured comes into view without the player fighting the
     * wheel. Picks the closest rung that fits.
     */
    fit(points, { padding = 12 } = {}) {
      if (!points.length) return cam.zoom;
      let minE = Infinity;
      let maxE = -Infinity;
      let minN = Infinity;
      let maxN = -Infinity;
      for (const p of points) {
        const pe = p.e ?? p.E;
        const pn = p.n ?? p.N;
        if (pe == null || pn == null) continue;
        if (pe < minE) minE = pe;
        if (pe > maxE) maxE = pe;
        if (pn < minN) minN = pn;
        if (pn > maxN) maxN = pn;
      }
      if (!Number.isFinite(minE)) return cam.zoom;

      const w = maxE - minE + padding * 2;
      const h = maxN - minN + padding * 2;
      const want = Math.min(cam.vw / w, cam.vh / h);

      let best = 0;
      for (let i = 0; i < ZOOM_LADDER.length; i++) if (ZOOM_LADDER[i] <= want) best = i;
      cam.zoom = ZOOM_LADDER[best];
      cam.e = (minE + maxE) / 2;
      cam.n = (minN + maxN) / 2;
      cam.clampToBounds();
      return cam.zoom;
    },

    get planMode() {
      return cam.zoom < PLAN_MODE_ZOOM;
    },
    get showDetail() {
      return cam.zoom >= DETAIL_ZOOM;
    },
  };

  cam.e = snap(cam.e);
  cam.n = snap(cam.n);
  return cam;
}

function nearestRung(zoom) {
  let best = 0;
  for (let i = 1; i < ZOOM_LADDER.length; i++) {
    if (Math.abs(ZOOM_LADDER[i] - zoom) < Math.abs(ZOOM_LADDER[best] - zoom)) best = i;
  }
  return best;
}
