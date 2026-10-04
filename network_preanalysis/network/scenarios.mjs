import { emptyNetwork, makePoint, makeSight } from './model.mjs';

export function example(name = 'traverse') {
  const n = emptyNetwork(); n.scenario = name;
  const add = (id, e, north, type = 'station', control = 'unknown') => n.points.push(makePoint(id, e, north, type, control));
  const sight = (from, to) => n.sights.push(makeSight(from, to));
  if (['traverse', 'weak', 'mixed', 'rural'].includes(name)) {
    add('G01', -240, -60, 'station', 'fixed');
    add('S01', -120, 45); add('S02', 0, -30); add('S03', 120, 70);
    add('G02', 250, 0, 'station', 'fixed');
    n.points[0].role = 'gnssStart'; n.points[4].role = 'gnssFinish';
    for (let i = 0; i < 4; i++) { sight(n.points[i].id, n.points[i + 1].id); sight(n.points[i + 1].id, n.points[i].id); }
    if (name === 'weak') n.points.forEach((p, i) => { p.E = [-240, -1000, -2000, -3000, -238][i]; p.N = [0, 1, 2, 3, 1][i]; });
    if (name === 'mixed') {
      add('P01', 0, 130, 'sighted_only');
      sight('S01', 'S03'); sight('S03', 'S01'); sight('S01', 'P01'); sight('S03', 'P01'); sight('S02', 'P01');
    }
  } else if (name === 'resection') {
    add('S01', 0, 0);
    add('C01', -150, -100, 'sighted_only', 'fixed'); add('C02', 140, -100, 'sighted_only', 'fixed'); add('C03', 20, 150, 'sighted_only', 'fixed');
    for (const id of ['C01', 'C02', 'C03']) sight('S01', id);
  } else if (name === 'intersection') {
    add('C01', -130, -70, 'station', 'fixed'); add('C02', 130, -70, 'station', 'fixed');
    add('P01', 20, 100, 'sighted_only');
    sight('C01', 'C02'); sight('C02', 'C01'); sight('C01', 'P01'); sight('C02', 'P01');
    // Actual angular intersection: control-to-control sights establish orientations.
    for (const s of n.sights) s.components.distance = false;
  } else throw Error('invalidNetwork');
  return n;
}

// Constraint extension point. Level 2 needs street data in this same metre frame.
// The UI intentionally does not offer the unfinished urban scenario.
export function validatePointPlacement(point, scenario = {}) {
  if (![point.E, point.N].every(Number.isFinite) || Math.abs(point.E) > 1e6 || Math.abs(point.N) > 1e6) return { valid: false, reason: 'coordinateRange' };
  if (scenario.bounds && (point.E < scenario.bounds[0] || point.E > scenario.bounds[2] || point.N < scenario.bounds[1] || point.N > scenario.bounds[3])) return { valid: false, reason: 'outsideTerrain' };
  if (scenario.level === 2) {
    if (!scenario.streets?.length) return { valid: false, reason: 'streetsMissing' };
    let distance = Infinity, nearest = null;
    for (const line of scenario.streets) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1];
      const den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((point.E - a[0]) * dx + (point.N - a[1]) * dy) / den)) : 0;
      const p = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(point.E - p[0], point.N - p[1]);
      if (d < distance) { distance = d; nearest = p; }
    }
    return { valid: distance <= 3, reason: distance <= 3 ? null : 'streetDistance', distance, nearest };
  }
  return { valid: true };
}
export const RURAL = Object.freeze({
  lat: -25.454, lon: -49.07, bounds: [-650, -500, 650, 500],
  // Explicit didactic constant, NOT an EGM96/ellipsoidal equivalence or measured N.
  geoidUndulation: 0, heightDatum: 'terrain H; h = H + N0, N0 = 0 m (local teaching approximation)',
});
