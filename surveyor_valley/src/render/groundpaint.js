// Painting the ground.
//
// This is where the valley stops looking like a weather map. The Phase 1
// terrain was one flat colour per soil class, bilinearly blurred — which is
// exactly what a pasture does not look like. Here every square metre gets
// grain, and roughly one tuft of grass, and occasionally a flower.
//
// The density is affordable because none of it is an entity. Detail is placed
// by hashing the world position, painted straight into the chunk bitmap, and
// then forgotten: a screenful of ten thousand grass blades costs the same
// twenty blits as a screenful of bare dirt.
//
// Cost is split by frequency, which is the whole performance story:
//
//   once per SQUARE METRE   the expensive part — four octaves of fBm, three
//                           fields — - and it is memoised by `terrain.soilAt`
//   once per PIXEL          a hash, an array index and a colour write
//
// Phase 1 got this backwards and evaluated noise per pixel, which is why
// walking into fresh ground cost a 15-30 ms hitch.
//
// DOM-free on purpose: it fills a Uint8ClampedArray, and `groundbake.js` deals
// with canvases and textures.

import { rgba, hash2 } from './pixbuf.js';
import { GROUND, P } from './palette.js';

/**
 * Detail population per soil class, in items per square metre.
 *
 * Grass is deliberately dense — at 32 screen pixels per metre, a tuft every
 * square metre reads as scattered dashes on a green sheet rather than as a
 * pasture. Density is free here; these are baked, not drawn.
 */
const DETAIL = {
  PASTO: { tuft: 2.0, flower: 0.028, pebble: 0.015 },
  CAMPO_SUJO: { tuftDry: 1.7, tuftTall: 0.55, tussock: 0.1, pebble: 0.03 },
  SOLO_EXPOSTO: { clod: 0.5, pebble: 0.34, tuftDry: 0.06 },
  LAVOURA: { clod: 0.14 }, // the crops themselves come from the furrow pass
  AREIA: { pebble: 0.14 },
  ROCHA: { stone: 0.4, pebble: 0.42, tuftDry: 0.07 },
  BREJO: { reed: 0.85, tuft: 0.6 },
  AGUA: {},
};

/** Things that grow in patches rather than evenly. */
const CLUMPY = new Set(['flower', 'tussock', 'stone', 'reed']);

/** Soil ids, in the order `world/terrain.js` declares them. */
export const CLASS_IDS = Object.keys(GROUND);
const CLASS_INDEX = new Map(CLASS_IDS.map((id, i) => [id, i]));

/**
 * The soil class of every square metre of a chunk, plus a one-metre border so
 * the dithered edges have something to dither against.
 *
 * @returns {{grid:Uint8Array, size:number}} `size` includes the border.
 */
export function classGrid(terrain, originE, originN, metres) {
  const size = metres + 2;
  const grid = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const soil = terrain.soilAt(originE + i - 1 + 0.5, originN + j - 1 + 0.5);
      grid[j * size + i] = CLASS_INDEX.get(soil.id) ?? 0;
    }
  }
  return { grid, size };
}

const WATER = CLASS_INDEX.get('AGUA');

/** Shore tones, resolved once. */
const FOAM = rgba(P.foam[0]);
const SHALLOW = rgba(P.water[2]);

/**
 * Signed distance in metres from the water's edge — negative in the water,
 * positive on land — by a two-pass chamfer over the metre grid.
 *
 * A hard line where a lake meets a pasture is the single most artificial thing
 * a generated landscape can do. With this, the last metre of water gets a foam
 * lip and the first metre of land gets damp, and the boundary reads as a shore.
 *
 * The grid is 34x34, so the whole thing costs nothing.
 */
export function edgeField(grid, gridSize) {
  const FAR = 1e6;
  const d = new Float32Array(gridSize * gridSize);

  for (let i = 0; i < d.length; i++) {
    const wet = grid[i] === WATER;
    // Seed the boundary: a cell touching the other medium is half a metre away.
    let boundary = false;
    const x = i % gridSize;
    const y = (i / gridSize) | 0;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if ((grid[ny * gridSize + nx] === WATER) !== wet) boundary = true;
    }
    d[i] = boundary ? 0.5 : FAR;
  }

  const relax = (order) => {
    for (const i of order) {
      const x = i % gridSize;
      const y = (i / gridSize) | 0;
      let best = d[i];
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        const v = d[ny * gridSize + nx] + 1;
        if (v < best) best = v;
      }
      d[i] = best;
    }
  };
  const fwd = [...d.keys()];
  relax(fwd);
  relax(fwd.reverse());

  // Sign it: negative in the water.
  for (let i = 0; i < d.length; i++) if (grid[i] === WATER) d[i] = -d[i];
  return d;
}

/** Pre-resolved colour bytes, so the per-pixel loop never touches a string. */
const COLOURS = CLASS_IDS.map((id) => {
  const g = GROUND[id];
  return {
    base: rgba(g.base),
    grain: g.grain.map((c) => rgba(c)),
    patch: g.patch.map((c) => rgba(c)),
    /** Multiplier on how often grain replaces the base tone. */
    grainRate: g.grainRate ?? 1,
  };
});

/**
 * A smooth low-frequency brightness field, one sample every 2 m, bilinearly
 * interpolated per pixel.
 *
 * Real ground is lighter here and darker there over ten-metre scales. Sampling
 * a hash per 3 m cell and using it flat — the obvious first attempt — tiles the
 * valley with visible squares; interpolating removes the grid entirely for
 * about the same cost, because the samples are computed once per chunk.
 */
export function shadeField(originE, originN, metres, step = 2) {
  const n = Math.ceil(metres / step) + 2;
  const f = new Float32Array(n * n);
  const bx = Math.round(originE / step);
  const by = Math.round(originN / step);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Two octaves: broad regions, plus a little break-up inside them.
      f[j * n + i] = hash2(bx + i, by + j, 31) * 0.68 + hash2((bx + i) * 2, (by + j) * 2, 37) * 0.32;
    }
  }
  return { f, n, step };
}

/**
 * Paint one chunk's base ground.
 *
 * @param {Uint8ClampedArray} out   RGBA, `metres*pxPerM` square
 * @param {Uint8Array} grid         from `classGrid`
 * @param {number} rowStart, rowEnd rows of the OUTPUT to paint, for slicing the
 *                                  work across frames
 */
export function paintBase(out, grid, gridSize, originE, originN, metres, pxPerM, rowStart, rowEnd, shade, edges) {
  const W = metres * pxPerM;
  const inv = 1 / pxPerM;
  const sf = shade || shadeField(originE, originN, metres);
  const perSample = sf.step * pxPerM;
  const ef = edges || edgeField(grid, gridSize);

  for (let py = rowStart; py < rowEnd; py++) {
    // Canvas rows run north to south; the world's N axis runs the other way.
    const localN = metres - (py + 0.5) * inv;

    // Bilinear row setup for the brightness field, hoisted out of the x loop.
    const sy = py / perSample;
    const sy0 = Math.floor(sy);
    const ty = sy - sy0;
    const wy = ty * ty * (3 - 2 * ty);
    const rowA = Math.min(sf.n - 1, Math.max(0, sy0)) * sf.n;
    const rowB = Math.min(sf.n - 1, Math.max(0, sy0 + 1)) * sf.n;

    for (let px = 0; px < W; px++) {
      const localE = (px + 0.5) * inv;

      // Jitter the lookup by up to half a metre so class boundaries come out
      // ragged. A straight boundary between pasture and marsh looks drawn;
      // a ragged one looks like ground.
      const jx = (hash2(px, py, 11) - 0.5) * 0.85;
      const jy = (hash2(px, py, 23) - 0.5) * 0.85;

      let gi = Math.floor(localE + jx) + 1;
      let gj = Math.floor(metres - (localN + jy)) + 1;
      if (gi < 0) gi = 0;
      else if (gi >= gridSize) gi = gridSize - 1;
      if (gj < 0) gj = 0;
      else if (gj >= gridSize) gj = gridSize - 1;

      const gidx = gj * gridSize + gi;
      const cls = COLOURS[grid[gidx]];

      // Fine grain: two tones either side of the base, sprinkled sparsely and
      // staying close in value. Cranking this is what turns ground into static;
      // the large-scale variation is the smooth field below, not this.
      let c = cls.base;
      const r = hash2(px, py, 5);
      if (r > 1 - 0.12 * cls.grainRate) c = cls.grain[0];
      else if (r > 1 - 0.24 * cls.grainRate) c = cls.grain[1];

      // The shore. `dist` is signed metres from the water's edge, and the
      // jittered lookup above means the bands come out ragged rather than as
      // two clean offset curves.
      //
      // Half a metre of foam, not a metre and a half: a wide solid white lip
      // turns every lake into a skating rink.
      const dist = ef[gidx];
      if (dist < 0) {
        if (dist > -0.5) c = hash2(px, py, 71) > 0.55 ? FOAM : SHALLOW;
        else if (dist > -2.0) c = SHALLOW;
      } else if (dist < 1.2) {
        // Damp ground: the same tone, darker, so the bank reads as wet.
        c = [c[0] * 0.74, c[1] * 0.76, c[2] * 0.72];
      }

      const sx = px / perSample;
      const sx0 = Math.floor(sx);
      const tx = sx - sx0;
      const wx = tx * tx * (3 - 2 * tx);
      const ia = Math.min(sf.n - 1, Math.max(0, sx0));
      const ib = Math.min(sf.n - 1, Math.max(0, sx0 + 1));
      const top = sf.f[rowA + ia] + (sf.f[rowA + ib] - sf.f[rowA + ia]) * wx;
      const bot = sf.f[rowB + ia] + (sf.f[rowB + ib] - sf.f[rowB + ia]) * wx;
      // +-7%: enough to see as regions of ground, not enough to read as a stain.
      const k = 0.93 + (top + (bot - top) * wy) * 0.14;

      const o = (py * W + px) * 4;
      out[o] = c[0] * k;
      out[o + 1] = c[1] * k;
      out[o + 2] = c[2] * k;
      out[o + 3] = 255;
    }
  }
  void originE;
  void originN;
}

/**
 * Blit one sprite buffer into the chunk, clipped.
 * Anchored bottom-centre, like everything else that stands on the ground.
 */
function stamp(out, W, H, pix, cx, by) {
  const x0 = Math.round(cx - pix.w / 2);
  const y0 = Math.round(by - pix.h);
  for (let y = 0; y < pix.h; y++) {
    const ty = y0 + y;
    if (ty < 0 || ty >= H) continue;
    for (let x = 0; x < pix.w; x++) {
      const tx = x0 + x;
      if (tx < 0 || tx >= W) continue;
      const si = (y * pix.w + x) * 4;
      const a = pix.data[si + 3];
      if (a === 0) continue;
      const o = (ty * W + tx) * 4;
      if (a === 255) {
        out[o] = pix.data[si];
        out[o + 1] = pix.data[si + 1];
        out[o + 2] = pix.data[si + 2];
      } else {
        const sa = a / 255;
        out[o] = pix.data[si] * sa + out[o] * (1 - sa);
        out[o + 1] = pix.data[si + 1] * sa + out[o + 1] * (1 - sa);
        out[o + 2] = pix.data[si + 2] * sa + out[o + 2] * (1 - sa);
      }
      out[o + 3] = 255;
    }
  }
}

/**
 * Scatter ground cover over a chunk.
 *
 * Candidates sit on a jittered grid rather than a Poisson disc: the same
 * "natural but not clumped" result for a fraction of the work, and trivially
 * deterministic from the world position, so a chunk baked twice is identical.
 */
export function paintDetail(out, grid, gridSize, originE, originN, metres, pxPerM, sprites, jStart, jEnd) {
  const W = metres * pxPerM;
  const H = W;
  // Candidate spacing caps the achievable density at 1/STEP^2 per m², so it has
  // to be well under the grass figure above.
  const STEP = 0.6;
  const n = Math.ceil(metres / STEP);

  // Rows of candidates can be painted in slices so the baker can spread one
  // chunk across several frames and never blow the frame budget.
  const j0 = jStart ?? -1;
  const j1 = jEnd ?? n;

  for (let j = j0; j <= j1; j++) {
    for (let i = -1; i <= n; i++) {
      // World position of the candidate, jittered within its cell.
      const we = originE + (i + hash2(i, j, 101)) * STEP;
      const wn = originN + (j + hash2(i, j, 103)) * STEP;

      const gi = Math.max(0, Math.min(gridSize - 1, Math.floor(we - originE) + 1));
      const gj = Math.max(0, Math.min(gridSize - 1, Math.floor(metres - (wn - originN)) + 1));
      const cls = CLASS_IDS[grid[gj * gridSize + gi]];
      const wants = DETAIL[cls];
      if (!wants) continue;

      // Flowers grow in patches. Spread evenly at their true average density
      // they are one stray coloured pixel every few metres, which reads as a
      // dead pixel rather than as a flower; clumped, they are a thing you walk
      // past and notice.
      const clump = hash2(Math.floor(we / 7), Math.floor(wn / 7), 61) > 0.9 ? 22 : 0.01;

      // Pick at most one thing per candidate, by cumulative probability.
      const roll = hash2(i, j, 107);
      let acc = 0;
      let chosen = null;
      for (const [kind, perM2] of Object.entries(wants)) {
        acc += perM2 * STEP * STEP * (CLUMPY.has(kind) ? clump : 1);
        if (roll < acc) {
          chosen = kind;
          break;
        }
      }
      if (!chosen) continue;

      const bank = sprites[chosen];
      if (!bank || !bank.length) continue;
      const pix = bank[Math.floor(hash2(i, j, 109) * bank.length) % bank.length];

      const px = (we - originE) * pxPerM;
      const py = (metres - (wn - originN)) * pxPerM;
      stamp(out, W, H, pix, px, py);
    }
  }
}

/** Candidate rows in a chunk, so the baker knows how many slices there are. */
export const detailRows = (metres) => Math.ceil(metres / 0.6) + 2;

/**
 * Tilled fields get real furrows and rows of crops. It is the one soil class
 * whose whole character is geometric, and drawing it as speckle like the others
 * throws away the easiest legibility win in the valley — you can see at a
 * glance that this is somebody's planted ground.
 */
export function paintFurrows(out, grid, gridSize, originE, originN, metres, pxPerM, sprites) {
  const W = metres * pxPerM;
  const lavoura = CLASS_INDEX.get('LAVOURA');
  if (lavoura === undefined) return;

  // The furrow itself is a shadow line with a lit crest beside it. Both stay
  // close to the field's own tone: a high-contrast furrow turns a crop field
  // into corduroy seen from orbit.
  const dark = rgba(GROUND.LAVOURA.patch[0]);
  const light = rgba(GROUND.LAVOURA.patch[1]);

  // Row direction is constant over a 64 m block, so one field is coherent but
  // the neighbours are not all ploughed the same way.
  const vertical = hash2(Math.floor(originE / 64), Math.floor(originN / 64), 77) > 0.5;
  const spacingPx = Math.round(0.8 * pxPerM);

  const isField = (px, py) => {
    const gi = Math.max(0, Math.min(gridSize - 1, Math.floor(px / pxPerM) + 1));
    const gj = Math.max(0, Math.min(gridSize - 1, Math.floor(py / pxPerM) + 1));
    return grid[gj * gridSize + gi] === lavoura;
  };

  const put = (px, py, c) => {
    if (px < 0 || py < 0 || px >= W || py >= W) return;
    const o = (py * W + px) * 4;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
  };

  // World-anchored offset, so furrows continue across the chunk seam.
  const phase = vertical
    ? Math.round(originE * pxPerM) % spacingPx
    : Math.round(originN * pxPerM) % spacingPx;

  for (let a = -phase; a < W; a += spacingPx) {
    for (let b = 0; b < W; b++) {
      const px = vertical ? a : b;
      const py = vertical ? b : a;
      if (!isField(px, py)) continue;
      put(px, py, dark);
      put(vertical ? px + 1 : px, vertical ? py : py + 1, light);
    }
  }

  // Crops along the furrows.
  const bank = sprites.crop;
  if (!bank || !bank.length) return;
  const alongStep = Math.round(0.62 * pxPerM);
  for (let a = -phase; a < W; a += spacingPx) {
    for (let b = 0; b < W; b += alongStep) {
      const px = vertical ? a : b;
      const py = vertical ? b : a;
      if (!isField(px, py)) continue;
      const h = hash2(px, py, 131);
      if (h > 0.82) continue; // gaps, so the rows are not machine-perfect
      const pix = bank[Math.floor(hash2(px, py, 137) * bank.length) % bank.length];
      stamp(out, W, W, pix, px + (h - 0.5) * 3, py + 2);
    }
  }
}
