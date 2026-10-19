// Seeded random numbers: mulberry32 and Box–Muller. Every random choice of the lab draws from
// its own named stream, so changing (say) the check-point percentage does not change the
// simulated noise.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function stream(seed, name) {
  const uniform = mulberry32((fnv1a(String(name)) ^ Math.imul((seed >>> 0) || 1, 0x9e3779b1)) >>> 0);
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u <= Number.MIN_VALUE) u = uniform();
    const v = uniform(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(uniform() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  return { uniform, normal, shuffle, sample: (arr, k) => shuffle(arr).slice(0, Math.max(0, Math.min(arr.length, k))) };
}
