// Colour scales (pure). Hue carries the sign, lightness the magnitude:
//  - diverging: blue (negative: shrink / lower) <- neutral gray -> red (positive: stretch / higher)
//  - sequential: one blue hue, dark -> light (dark UI: the low end recedes toward the surface)
// Stops come from the dataviz reference ramps (blue 600..100, red arm stepped to the same
// OKLab lightness); interpolation is done in OKLab so lightness is monotone along each arm.

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToOklab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(x => srgbToLinear(x / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map(x => Math.round(255 * Math.min(1, Math.max(0, linearToSrgb(Math.min(1, Math.max(0, x)))))));
}

function lut(stops, size = 256) {
  const labs = stops.map(h => rgbToOklab(hexToRgb(h)));
  const out = new Uint8Array(size * 3);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1) * (labs.length - 1), k = Math.min(labs.length - 2, Math.floor(t)), f = t - k;
    const c = oklabToRgb(labs[k].map((v, j) => v + f * (labs[k + 1][j] - v)));
    out.set(c, 3 * i);
  }
  return out;
}

export const NEUTRAL = '#4b4b47';
export const BLUE_ARM = [NEUTRAL, '#2a78d6', '#6da7ec', '#b7d3f6'];
export const RED_ARM = [NEUTRAL, '#d03b3b', '#ee8a7f', '#f8c9c2'];
export const SEQUENTIAL = ['#173a6b', '#1c5cab', '#2a78d6', '#6da7ec', '#cde2fb'];
export const LUTS = Object.freeze({
  negative: lut(BLUE_ARM), positive: lut(RED_ARM), sequential: lut(SEQUENTIAL),
});

/** Units for a metric: ppm stays ppm; lengths pick mm / cm / m from the largest magnitude. */
export function unitFor(metric, maxAbs) {
  if (metric === 'ppm') return { unit: 'ppm', factor: 1 };
  if (!(maxAbs >= 0.01)) return { unit: 'mm', factor: 1000 };
  if (maxAbs < 1) return { unit: 'cm', factor: 100 };
  return { unit: 'm', factor: 1 };
}
export const SIGNED = new Set(['ppm', 'dz', 'dg']);

/**
 * Colour scale for a metric over values [min, max].
 * mode 'data': each arm stretched over the data magnitudes; 'zero': anchored at zero (absolute).
 * Returns { kind, min, max, color(v) -> [r,g,b] (0..255), stops(n) for colourbars }.
 */
export function makeScale(metric, min, max, mode = 'data') {
  if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
  const signed = SIGNED.has(metric);
  const pick = (L, t) => { const i = 3 * Math.round(Math.min(1, Math.max(0, t)) * 255); return [L[i], L[i + 1], L[i + 2]]; };
  if (!signed) {
    let lo = mode === 'zero' ? 0 : min, hi = max;
    if (!(hi > lo)) hi = lo + (Math.abs(lo) || 1) * 1e-6;
    return { kind: 'sequential', min: lo, max: hi, color: v => pick(LUTS.sequential, (v - lo) / (hi - lo)) };
  }
  // signed: blue for negative, red for positive, lightness grows with |v|
  let lo = min, hi = max;
  if (mode === 'zero') { const m = Math.max(Math.abs(min), Math.abs(max)) || 1; lo = -m; hi = m; }
  if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1) * 1e-6; }
  if (lo < 0 && hi > 0) {
    // both arms share one magnitude scale, so a small negative tail is not shown as strongly as a large positive side
    const m = Math.max(-lo, hi);
    return { kind: 'diverging', min: lo, max: hi, color: v => (v < 0 ? pick(LUTS.negative, -v / m) : pick(LUTS.positive, v / m)) };
  }
  // one-sided data in 'data' mode: stretch the arm from the smallest to the largest magnitude
  const arm = hi <= 0 ? LUTS.negative : LUTS.positive;
  const a = Math.min(Math.abs(lo), Math.abs(hi)), b = Math.max(Math.abs(lo), Math.abs(hi));
  const span = b - a || 1e-12;
  return { kind: hi <= 0 ? 'negative' : 'positive', min: lo, max: hi, color: v => pick(arm, 0.12 + 0.88 * (Math.abs(v) - a) / span) };
}

/** "Nice" tick values covering [lo, hi]. */
export function niceTicks(lo, hi, count = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) || 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

/** Point colours of the undistorted (ENU) cloud: neutral tones per surface class. */
export const CLASS_COLORS = [[120, 132, 120], [222, 216, 202], [176, 170, 158], [146, 141, 131]];
