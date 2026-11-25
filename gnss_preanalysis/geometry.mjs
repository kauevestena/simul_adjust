// Small local offsets (metres, already exaggerated) to geographic degrees for map drawings.
const A = 6378137, E2 = (1 / 298.257223563) * (2 - 1 / 298.257223563), rad = Math.PI / 180;
export function metresPerDegree(lat) {
  const s = Math.sin(lat * rad), w = Math.sqrt(1 - E2 * s * s);
  return { north: A * (1 - E2) / (w * w * w) * rad, east: A / w * Math.cos(lat * rad) * rad };
}
export function offset(lat, lon, east, north) {
  const m = metresPerDegree(lat);
  return [lon + east / m.east, lat + north / m.north];
}
/** Ellipse ring; azimuth of the major axis clockwise from North (radians). */
export function ellipseRing(lat, lon, major, minor, azimuth, steps = 72) {
  const ring = [], se = Math.sin(azimuth), ce = Math.cos(azimuth);
  for (let k = 0; k <= steps; k++) {
    const t = 2 * Math.PI * k / steps, a = major * Math.cos(t), b = minor * Math.sin(t);
    ring.push(offset(lat, lon, a * se + b * ce, a * ce - b * se));
  }
  return ring;
}
export const CONFIDENCE_2D = { '1sigma': 1, 95: Math.sqrt(-2 * Math.log(0.05)) };
/** Redundancy 0 → red, 0.5 → amber, 1 → green (numbers are clamped). */
export function redundancyColor(r) {
  const x = Math.max(0, Math.min(1, Number.isFinite(r) ? r : 0));
  const stops = [[0, [201, 42, 42]], [0.25, [230, 119, 0]], [0.5, [214, 170, 0]], [1, [47, 158, 68]]];
  let i = 1; while (i < stops.length - 1 && x > stops[i][0]) i++;
  const [x0, c0] = stops[i - 1], [x1, c1] = stops[i], f = (x - x0) / (x1 - x0 || 1);
  return '#' + c0.map((c, k) => Math.round(c + (c1[k] - c) * f).toString(16).padStart(2, '0')).join('');
}
