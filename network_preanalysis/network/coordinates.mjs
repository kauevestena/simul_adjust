// WGS84; degrees on the geographic API, metres on every Cartesian API.
// ENU rotation: ESA Navipedia, Transformations between ECEF and ENU coordinates.
export const WGS84 = Object.freeze({ a: 6378137, f: 1 / 298.257223563 });
const rad = Math.PI / 180;
const e2 = WGS84.f * (2 - WGS84.f);
export function llhToEcef({ lat, lon, h }) {
  if (![lat, lon, h].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || Math.abs(h) > 1e7) throw Error('coordinateRange');
  const p = lat * rad, l = lon * rad, s = Math.sin(p), c = Math.cos(p);
  const v = WGS84.a / Math.sqrt(1 - e2 * s * s);
  return [(v + h) * c * Math.cos(l), (v + h) * c * Math.sin(l), (v * (1 - e2) + h) * s];
}
export function ecefToLlh([x, y, z]) {
  if (![x, y, z].every(Number.isFinite) || Math.hypot(x, y, z) < 1) throw Error('coordinateRange');
  const p = Math.hypot(x, y), lon = Math.atan2(y, x) / rad;
  if (p < 1e-8) return { lat: Math.sign(z) * 90, lon, h: Math.abs(z) - WGS84.a * (1 - WGS84.f) };
  let phi = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 15; i++) {
    const v = WGS84.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const next = Math.atan2(z + e2 * v * Math.sin(phi), p);
    if (Math.abs(next - phi) < 1e-15) { phi = next; break; }
    phi = next;
  }
  const v = WGS84.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  // Projection on the normal is stable even near a pole.
  const h = p * Math.cos(phi) + z * Math.sin(phi) - v * (1 - e2 * Math.sin(phi) ** 2);
  return { lat: phi / rad, lon, h };
}
export function enuRotation(origin) {
  const p = origin.lat * rad, l = origin.lon * rad;
  return [[-Math.sin(l), Math.cos(l), 0],
    [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
    [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]];
}
export function ecefToEnu(xyz, origin) {
  const o = llhToEcef(origin), d = xyz.map((x, i) => x - o[i]);
  return enuRotation(origin).map(row => row.reduce((s, x, i) => s + x * d[i], 0));
}
export function enuToEcef(enu, origin) {
  const r = enuRotation(origin);
  return llhToEcef(origin).map((v, i) => v + enu.reduce((s, x, j) => s + r[j][i] * x, 0));
}
export const llhToEnu = (llh, origin) => ecefToEnu(llhToEcef(llh), origin);
export const enuToLlh = (enu, origin) => ecefToLlh(enuToEcef(enu, origin));
