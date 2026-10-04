import { PATO_BRANCO } from './streets.mjs';

export const INSTRUMENTS = Object.freeze({
  educational: { directionArcsec: 5, zenithArcsec: 5, distanceMm: 5, ppm: 5 },
  standard: { directionArcsec: 2, zenithArcsec: 2, distanceMm: 2, ppm: 2 },
  precise: { directionArcsec: 0.5, zenithArcsec: 0.5, distanceMm: 1, ppm: 1 },
});
export const makePoint = (id, E, N, type = 'station', control = 'unknown', U = 0) => ({
  id, label: id, type, control, E, N, U, HI: 1.5, HT: 1.5, omega: 0, active: true,
  controlSigma: [0.01, 0.01, 0.02],
});
export const makeSight = (from, to, id = `${from}→${to}`) => ({
  id, from, to, active: true, components: { direction: true, zenith: true, distance: true },
});
export const emptyNetwork = () => ({ version: 1, level: 0, scenario: 'plane', origin: null,
  instrument: { ...INSTRUMENTS.standard }, statistics: { alpha: 0.001, power: 0.8 }, points: [], sights: [] });

// Limits bound interactive computation and reject invalid JSON before editing state.
export function validateNetwork(n) {
  if (!n || n.version !== 1 || ![0, 1, 2].includes(n.level) || !Array.isArray(n.points) || !Array.isArray(n.sights) ||
      n.points.length > 100 || n.sights.length > 500) throw Error('invalidNetwork');
  const ids = new Set(), sightIds = new Set();
  for (const p of n.points) {
    if (!p || typeof p.id !== 'string' || !p.id.trim() || p.id.length > 80 || ids.has(p.id) ||
        !['station', 'sighted_only'].includes(p.type) || !['unknown', 'fixed', 'stochastic'].includes(p.control) ||
        ![p.E, p.N, p.U, p.HI, p.HT, p.omega ?? 0].every(Number.isFinite) ||
        [p.E, p.N, p.U].some(x => Math.abs(x) > 1e6) || p.HI < 0 || p.HT < 0 || p.HI > 100 || p.HT > 100 ||
        (p.label != null && (typeof p.label !== 'string' || p.label.length > 100))) throw Error('invalidPoint');
    if (n.level === 0 && p.U !== 0) throw Error('planeHeight');
    ids.add(p.id);
  }
  for (const s of n.sights) {
    if (!s || typeof s.id !== 'string' || s.id.length > 160 || sightIds.has(s.id) || !ids.has(s.from) || !ids.has(s.to) ||
        !s.components || !['direction', 'zenith', 'distance'].every(k => typeof s.components[k] === 'boolean') ||
        (s.HT != null && (!Number.isFinite(s.HT) || s.HT < 0 || s.HT > 100))) throw Error('invalidSight');
    sightIds.add(s.id);
  }
  const i = n.instrument;
  if (!i || ![i.directionArcsec, i.zenithArcsec, i.distanceMm, i.ppm].every(Number.isFinite) ||
      i.directionArcsec <= 0 || i.zenithArcsec <= 0 || i.distanceMm < 0 || i.ppm < 0 || (!i.distanceMm && !i.ppm)) throw Error('invalidSigma');
  if (!n.statistics || !(n.statistics.alpha >= 1e-6 && n.statistics.alpha <= 0.2) ||
      !(n.statistics.power >= 0.5 && n.statistics.power < 0.9999)) throw Error('invalidStatistics');
  if (n.level > 0 && (!n.origin || ![n.origin.lat, n.origin.lon, n.origin.h, n.geoidUndulation].every(Number.isFinite) ||
      Math.abs(n.origin.lat) > 85 || Math.abs(n.origin.lon) > 180 || Math.abs(n.origin.h) > 12000 || Math.abs(n.geoidUndulation) > 200)) throw Error('coordinateRange');
  if (n.level === 2 && (n.scenario !== 'pato-branco' || n.streetDataset !== PATO_BRANCO.id ||
      n.origin.lat !== PATO_BRANCO.lat || n.origin.lon !== PATO_BRANCO.lon)) throw Error('urbanReference');
  return n;
}
export const serialize = n => JSON.stringify(validateNetwork(n), null, 2);
export function deserialize(text) {
  if (text.length > 2e6) throw Error('invalidNetwork');
  let n;
  try { n = JSON.parse(text); } catch { throw Error('invalidNetwork'); }
  return validateNetwork(n);
}
