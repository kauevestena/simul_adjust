// Pixel art, painted by code.
//
// This module is the whole art style. Every sprite in the game is a function
// that paints into one of these buffers, which means a windbreak of forty
// visibly different trees is one `tree(rng)` called forty times rather than
// forty drawings — and it means the art has no binary assets at all.
//
// It is deliberately free of `document`, `window` and `canvas`: a buffer is a
// plain `{w, h, data: Uint8ClampedArray}`, so the sprite painters run under
// `node --test` and can be asserted on directly. The DOM only appears in
// `atlas.js`, which uploads the finished pixels.
//
// Two techniques carry most of the Stardew look:
//
//   `ramp()`    shifts hue while it shifts value — shadows toward cool, lights
//               toward warm. Flat lighten/darken is what makes hand-rolled
//               pixel art look like plastic, and it is the single most common
//               mistake.
//   `outline()` traces the alpha edge in a DARKENED VERSION OF THE LOCAL
//               COLOUR, not in black. That is what lets a sprite read cleanly
//               against grass without looking like a sticker.

/** Base art resolution. One metre of ground is 16 pixels — one Stardew tile. */
export const PX_PER_M = 16;

// ------------------------------------------------------------- colour ------

const hexCache = new Map();

/** `#rgb`, `#rrggbb` or `#rrggbbaa` -> `[r, g, b, a]`. */
export function rgba(hex) {
  let v = hexCache.get(hex);
  if (v) return v;

  let s = String(hex).replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 6) s += 'ff';
  v = [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
    parseInt(s.slice(6, 8), 16),
  ];
  hexCache.set(hex, v);
  return v;
}

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** `[r, g, b]` -> `#rrggbb`. */
export const toHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Highlights drift toward this hue, shadows toward the other. */
const HUE_LIGHT = 0.13; // yellow — sunlight
const HUE_DARK = 0.66; // blue-violet — skylight in shadow

/** Signed shortest way round the hue circle, in turns. */
function hueToward(from, to) {
  let d = to - from;
  while (d > 0.5) d -= 1;
  while (d < -0.5) d += 1;
  return d;
}

/**
 * A shading ramp for one material, darkest first.
 *
 * Hue rotates as value moves — highlights toward yellow, shadows toward
 * blue-violet — and saturation peaks in the midtones. This is the single
 * technique that separates painted-looking pixel art from a colour dragged
 * along a brightness slider.
 *
 * Crucially the rotation is a fraction of the way TOWARD a target hue, not a
 * fixed delta. A fixed +0.055 warms an orange correctly and sends a green
 * straight into cyan, which is exactly what happened to the first grass.
 *
 * @param {string} base   the midtone
 * @param {number} n      how many steps (3 is the house default)
 * @param {{spread?:number, hueShift?:number, satBoost?:number}} opts
 *        `hueShift` is the FRACTION of the distance to the target hue.
 * @returns {string[]}    hex strings, dark -> light
 */
export function ramp(base, n = 3, opts = {}) {
  const { spread = 0.17, hueShift = 0.32, satBoost = 0.1 } = opts;
  const [r, g, b] = rgba(base);
  const [h, s, l] = rgbToHsl(r, g, b);
  const out = [];

  for (let i = 0; i < n; i++) {
    // -1 at the dark end, +1 at the light end, 0 in the middle.
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const ll = l + t * spread;
    const target = t >= 0 ? HUE_LIGHT : HUE_DARK;
    const hh = h + hueToward(h, target) * Math.abs(t) * hueShift;
    // Midtones carry the most chroma; the extremes desaturate slightly.
    const ss = s + satBoost * (1 - Math.abs(t)) - Math.abs(t) * 0.06;
    const [rr, gg, bb] = hslToRgb(hh, ss, ll);
    out.push(toHex(rr, gg, bb));
  }
  return out;
}

/** Darken toward a cool shadow, the way `outline('auto')` does. */
export function shadeOf(hex, amount = 0.42) {
  const [r, g, b] = rgba(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const hh = h + hueToward(h, HUE_DARK) * 0.14;
  const [rr, gg, bb] = hslToRgb(hh, Math.min(1, s + 0.08), Math.max(0, l * (1 - amount)));
  return toHex(rr, gg, bb);
}

// -------------------------------------------------------------- buffer -----

/**
 * A pixel buffer with a small painting vocabulary.
 * @param {number} w @param {number} h
 */
export function makePix(w, h) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const data = new Uint8ClampedArray(w * h * 4);

  /** Source-over one pixel. Out-of-bounds writes are silently dropped. */
  function px(x, y, colour, alpha = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, g, b, a] = typeof colour === 'string' ? rgba(colour) : colour;
    const sa = (a / 255) * alpha;
    if (sa <= 0) return;

    const i = (y * w + x) * 4;
    if (sa >= 1) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
      return;
    }
    const da = data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    data[i] = (r * sa + data[i] * da * (1 - sa)) / oa;
    data[i + 1] = (g * sa + data[i + 1] * da * (1 - sa)) / oa;
    data[i + 2] = (b * sa + data[i + 2] * da * (1 - sa)) / oa;
    data[i + 3] = oa * 255;
  }

  function get(x, y) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0, 0];
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[((y | 0) * w + (x | 0)) * 4 + 3]);

  const api = {
    w,
    h,
    data,
    px,
    get,
    alphaAt,

    clear() {
      data.fill(0);
      return api;
    },

    hline(x0, x1, y, c, alpha = 1) {
      if (x1 < x0) [x0, x1] = [x1, x0];
      for (let x = x0 | 0; x <= (x1 | 0); x++) px(x, y, c, alpha);
      return api;
    },

    vline(x, y0, y1, c, alpha = 1) {
      if (y1 < y0) [y0, y1] = [y1, y0];
      for (let y = y0 | 0; y <= (y1 | 0); y++) px(x, y, c, alpha);
      return api;
    },

    /** Filled axis-aligned rectangle. */
    fill(x, y, rw, rh, c, alpha = 1) {
      for (let j = 0; j < rh; j++) api.hline(x, x + rw - 1, y + j, c, alpha);
      return api;
    },

    /** One-pixel rectangle outline. */
    rect(x, y, rw, rh, c, alpha = 1) {
      api.hline(x, x + rw - 1, y, c, alpha);
      api.hline(x, x + rw - 1, y + rh - 1, c, alpha);
      api.vline(x, y, y + rh - 1, c, alpha);
      api.vline(x + rw - 1, y, y + rh - 1, c, alpha);
      return api;
    },

    /** Bresenham line. */
    line(x0, y0, x1, y1, c, alpha = 1) {
      x0 |= 0;
      y0 |= 0;
      x1 |= 0;
      y1 |= 0;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        px(x0, y0, c, alpha);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
      return api;
    },

    /** Filled ellipse, scanline-exact so the edge is a clean pixel boundary. */
    ellipse(cx, cy, rx, ry, c, alpha = 1) {
      if (rx < 0.5 || ry < 0.5) return api;
      const y0 = Math.ceil(cy - ry);
      const y1 = Math.floor(cy + ry);
      for (let y = y0; y <= y1; y++) {
        const t = (y + 0.5 - cy) / ry;
        if (Math.abs(t) > 1) continue;
        const half = rx * Math.sqrt(1 - t * t);
        api.hline(Math.round(cx - half), Math.round(cx + half - 0.001), y, c, alpha);
      }
      return api;
    },

    disc(cx, cy, r, c, alpha = 1) {
      return api.ellipse(cx, cy, r, r, c, alpha);
    },

    /**
     * An organic lump: an ellipse whose radius wobbles with angle. Canopies,
     * bushes and boulders are all this function with different numbers.
     */
    blob(cx, cy, rx, ry, c, rng, { wobble = 0.22, lobes = 3 } = {}) {
      const phase = rng ? rng.range(0, Math.PI * 2) : 0;
      const phase2 = rng ? rng.range(0, Math.PI * 2) : 1.7;
      const y0 = Math.ceil(cy - ry * (1 + wobble));
      const y1 = Math.floor(cy + ry * (1 + wobble));
      for (let y = y0; y <= y1; y++) {
        for (let x = Math.ceil(cx - rx * (1 + wobble)); x <= Math.floor(cx + rx * (1 + wobble)); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const d = Math.hypot(dx, dy);
          if (d < 1e-6) {
            px(x, y, c);
            continue;
          }
          const a = Math.atan2(dy, dx);
          const edge = 1 + wobble * (Math.sin(a * lobes + phase) * 0.6 + Math.sin(a * (lobes + 2) + phase2) * 0.4);
          if (d <= edge) px(x, y, c);
        }
      }
      return api;
    },

    /** Filled polygon by scanline. Roofs, fields, anything with straight edges. */
    poly(points, c, alpha = 1) {
      if (points.length < 3) return api;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [, y] of points) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const xs = [];
      for (let y = Math.ceil(minY - 0.5); y <= Math.floor(maxY + 0.5); y++) {
        xs.length = 0;
        const sy = y + 0.5;
        for (let i = 0; i < points.length; i++) {
          const [ax, ay] = points[i];
          const [bx, by] = points[(i + 1) % points.length];
          if (ay === by) continue;
          if (sy >= Math.min(ay, by) && sy < Math.max(ay, by)) {
            xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
          }
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          api.hline(Math.round(xs[i]), Math.round(xs[i + 1] - 0.001), y, c, alpha);
        }
      }
      return api;
    },

    /** Compose another buffer in, respecting its alpha. */
    blit(src, dx = 0, dy = 0, alpha = 1) {
      for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
          const i = (y * src.w + x) * 4;
          const a = src.data[i + 3];
          if (a === 0) continue;
          px(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2], a], alpha);
        }
      }
      return api;
    },

    /**
     * Ordered (Bayer 4x4) dither between two colours. This is how soil classes
     * meet each other: a hard dithered seam reads as ground, a bilinear blur
     * reads as a JPEG.
     */
    dither(x, y, dw, dh, cA, cB, ratio = 0.5) {
      for (let j = 0; j < dh; j++) {
        for (let i = 0; i < dw; i++) {
          const threshold = (BAYER4[(j + y) & 3][(i + x) & 3] + 0.5) / 16;
          px(x + i, y + j, ratio > threshold ? cA : cB);
        }
      }
      return api;
    },

    /** Multiply a region's lightness. Negative brightens. */
    shade(x, y, sw, sh, amount = 0.2) {
      for (let j = 0; j < sh; j++) {
        for (let i = 0; i < sw; i++) {
          const cx = (x + i) | 0;
          const cy = (y + j) | 0;
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          const k = (cy * w + cx) * 4;
          if (data[k + 3] === 0) continue;
          const f = 1 - amount;
          data[k] *= f;
          data[k + 1] *= f;
          data[k + 2] *= f;
        }
      }
      return api;
    },

    /** Swap one exact colour for another. Cheap palette variants. */
    replace(from, to) {
      const [fr, fg, fb] = rgba(from);
      const [tr, tg, tb] = rgba(to);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if (data[i] === fr && data[i + 1] === fg && data[i + 2] === fb) {
          data[i] = tr;
          data[i + 1] = tg;
          data[i + 2] = tb;
        }
      }
      return api;
    },

    /**
     * Trace the alpha edge.
     *
     * `'auto'` (the default) takes each edge pixel's colour from its opaque
     * neighbours and darkens it, so a green canopy gets a deep green line and a
     * concrete monument a cool grey one. A single black outline everywhere is
     * the thing that makes amateur pixel art look pasted on.
     *
     * `threshold` is high on purpose: anything translucent is BACKGROUND, not
     * content. At a low threshold the contact shadow counts as part of the
     * sprite and every tree ends up standing inside a drawn black ellipse.
     */
    outline(colour = 'auto', { amount = 0.45, threshold = 128, diagonal = false } = {}) {
      const edges = [];
      const offs = diagonal
        ? [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]
        : [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (alphaAt(x, y) > threshold) continue;
          let rs = 0;
          let gs = 0;
          let bs = 0;
          let n = 0;
          for (const [ox, oy] of offs) {
            const nx = x + ox;
            const ny = y + oy;
            if (alphaAt(nx, ny) <= threshold) continue;
            const [r, g, b] = get(nx, ny);
            rs += r;
            gs += g;
            bs += b;
            n++;
          }
          if (n === 0) continue;
          edges.push([x, y, colour === 'auto' ? shadeOf(toHex(rs / n, gs / n, bs / n), amount) : colour]);
        }
      }
      for (const [x, y, c] of edges) px(x, y, c);
      return api;
    },

    /** Mirror horizontally, so a west-facing sprite is the east one flipped. */
    mirrorX() {
      const out = makePix(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          out.px(w - 1 - x, y, [data[i], data[i + 1], data[i + 2], data[i + 3]]);
        }
      }
      return out;
    },

    /** Trim fully transparent margins. Reported as the offset that was removed. */
    bounds() {
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] === 0) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    },

    /** A stable fingerprint, so a test can assert a painter is deterministic. */
    hash() {
      let hh = 2166136261 >>> 0;
      for (let i = 0; i < data.length; i++) {
        hh ^= data[i];
        hh = Math.imul(hh, 16777619) >>> 0;
      }
      return hh.toString(16).padStart(8, '0');
    },

    /** How many distinct opaque colours are in play. Guards palette discipline. */
    palette() {
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue;
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
      return seen;
    },
  };

  return api;
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * A cheap, stable hash of an integer pair to [0, 1).
 *
 * Ground detail — every blade of grass, every pebble — is placed with this
 * rather than stored. It costs nothing, never has to be saved, and the same
 * patch of pasture grows the same tufts every time it is baked.
 */
export function hash2(x, y, salt = 0) {
  let hh = 374761393 ^ Math.imul(x | 0, 668265263) ^ Math.imul(y | 0, 2246822519) ^ Math.imul(salt | 0, 3266489917);
  hh = Math.imul(hh ^ (hh >>> 13), 1274126177);
  return ((hh ^ (hh >>> 16)) >>> 0) / 4294967296;
}

/**
 * A soft contact shadow: everything standing up needs one to sit on the ground.
 *
 * Smooth alpha, deliberately NOT dithered. Dithering is right for large ground
 * areas where the pattern reads as texture, but on a shadow eight pixels across
 * it reads as a scattering of dirty pixels around the sprite's feet.
 */
export function contactShadow(pix, cx, cy, rx, ry, colour = '#1e2a18') {
  const y0 = Math.ceil(cy - ry);
  const y1 = Math.floor(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const t = (y + 0.5 - cy) / ry;
    if (Math.abs(t) > 1) continue;
    const half = rx * Math.sqrt(1 - t * t);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half - 0.001); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, t);
      const a = 0.26 * (1 - d * d);
      if (a <= 0.015) continue;
      pix.px(x, y, colour, a);
    }
  }
  return pix;
}
