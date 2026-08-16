// Seeded pseudo-random numbers.
//
// Everything random in Surveyor Valley flows through here so that a world is
// fully reproducible from its seed string. Sub-streams are named: tuning the
// vegetation density must never shift the parcel geometry, so each consumer
// gets its own independent stream derived from `seed + ':' + name`.

/** Hash an arbitrary string into a 32-bit integer seed. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Fast 32-bit PRNG. Returns a function producing uniforms in [0, 1). */
export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A named sub-stream of a seed.
 * `makeRng('sv-7f3a91', 'parcels')` is stable no matter what other streams do.
 */
export function makeRng(seed, name = 'default') {
  const uniform = mulberry32(xmur3(`${seed}:${name}`));
  let spare = null;

  const rng = {
    /** Uniform in [0, 1). */
    next: uniform,
    /** Uniform in [min, max). */
    range: (min, max) => min + uniform() * (max - min),
    /** Integer in [min, max]. */
    int: (min, max) => Math.floor(min + uniform() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => uniform() < p,
    /** Uniform element of an array. */
    pick: (arr) => arr[Math.floor(uniform() * arr.length)],
    /** Standard normal deviate (Box-Muller, second variate cached). */
    gauss() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = uniform();
      while (v === 0) v = uniform();
      const r = Math.sqrt(-2 * Math.log(u));
      const th = 2 * Math.PI * v;
      spare = r * Math.sin(th);
      return r * Math.cos(th);
    },
    /** Normal deviate with the given mean and standard deviation. */
    normal: (mean, sigma) => mean + rng.gauss() * sigma,
    /** Fisher-Yates, in place, returns the same array. */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(uniform() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}

/** A fresh random seed string, e.g. "sv-3f9a2c". */
export function randomSeed() {
  return 'sv-' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

/** Arithmetic mean of an array. */
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Root mean square of an array. */
export const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/** Sample standard deviation. */
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
