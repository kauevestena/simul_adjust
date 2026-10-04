export const ARCSECOND = Math.PI / (180 * 3600);
export const COMPONENTS = ['direction', 'zenith', 'distance'];
export const wrap2Pi = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
export const wrapPi = a => wrap2Pi(a + Math.PI) - Math.PI;

// Observation frame is deliberately isolated: xi = eta = 0, parallel local Up.
// HI/HT are exact geometric offsets in this milestone, not extra observations.
export function sightGeometry(from, to, sight = {}) {
  const delta = [to.E - from.E, to.N - from.N, to.U + (sight.HT ?? to.HT) - from.U - from.HI];
  if (!delta.every(Number.isFinite)) throw Error('invalidPoint');
  const [e, n, u] = delta, horizontal = Math.hypot(e, n), distance = Math.hypot(horizontal, u);
  if (distance < 1e-8) throw Error('zeroLength');
  return { delta, horizontal, distance, azimuth: wrap2Pi(Math.atan2(e, n)),
    direction: wrap2Pi(Math.atan2(e, n) - (from.omega ?? 0)), zenith: Math.atan2(horizontal, u) };
}
// Derivatives with respect to target minus instrument coordinates; origin = -target.
export function sightJacobian(g, component) {
  const [e, n, u] = g.delta, h = g.horizontal, s = g.distance;
  if (component === 'distance') return [e / s, n / s, u / s];
  if (h < 1e-8) throw Error('verticalSight');
  if (component === 'direction') return [n / (h * h), -e / (h * h), 0];
  if (component === 'zenith') return [u * e / (h * s * s), u * n / (h * s * s), -h / (s * s)];
  throw Error('invalidComponent');
}
export function observationSigma(component, distance, instrument) {
  if (component === 'direction') return instrument.directionArcsec * ARCSECOND;
  if (component === 'zenith') return instrument.zenithArcsec * ARCSECOND;
  return Math.hypot(instrument.distanceMm / 1000, instrument.ppm * 1e-6 * distance);
}
