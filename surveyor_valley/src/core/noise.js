// Value noise + fractional Brownian motion on a seeded lattice.
//
// The only source of terrain randomness. Deterministic for a given seed and
// stream name, and continuous, so soil classes form plausible patches rather
// than per-pixel confetti.

import { xmur3 } from './rng.js';

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // quintic fade
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A value-noise field. `at(x, y)` returns a value in [-1, 1].
 * @param {string} seed
 * @param {string} name  independent field name (e.g. 'moisture')
 */
export function makeNoise(seed, name) {
  const base = xmur3(`${seed}:noise:${name}`);

  // Hash a lattice corner to a uniform in [0, 1). No table allocation, so the
  // field is infinite and costs nothing to create.
  function corner(ix, iy) {
    let h = base ^ Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function at(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const top = lerp(corner(x0, y0), corner(x0 + 1, y0), fx);
    const bot = lerp(corner(x0, y0 + 1), corner(x0 + 1, y0 + 1), fx);
    return lerp(top, bot, fy) * 2 - 1;
  }

  /**
   * Fractal sum of octaves.
   * @param {number} x @param {number} y
   * @param {{octaves?:number, scale?:number, lacunarity?:number, gain?:number}} opts
   *        `scale` is the size in world metres of the largest feature.
   * @returns {number} roughly in [-1, 1]
   */
  function fbm(x, y, opts = {}) {
    const { octaves = 4, scale = 120, lacunarity = 2.0, gain = 0.5 } = opts;
    let freq = 1 / scale;
    let amp = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += at(x * freq, y * freq) * amp;
      norm += amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return sum / norm;
  }

  return { at, fbm };
}
