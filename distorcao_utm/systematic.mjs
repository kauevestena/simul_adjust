// Systematic-error assessment (pure). The UTM/geoid distortion is a deterministic, predictable
// error with a definite sign: it does not average out with more points or with the adjustment.
// It is judged against a tolerance T: |e| ≤ T/3 negligible, ≤ T tolerable, > T exceeds.

export const LEVELS = ['negligible', 'tolerable', 'exceeds'];

export function level(value, tolerance) {
  const v = Math.abs(value);
  if (v <= tolerance / 3) return 'negligible';
  if (v <= tolerance) return 'tolerable';
  return 'exceeds';
}

const worst = levels => levels.reduce((a, b) => (LEVELS.indexOf(b) > LEVELS.indexOf(a) ? b : a), 'negligible');

/**
 * out: result of model.simulate(); tolerance in metres.
 * Returns the scale error at the centre (ppm = mm/km, mm per 100 m), and three judged errors:
 * the largest error on a cube edge, the largest horizontal and the largest vertical position error.
 */
export function assessSystematic(out, tolerance) {
  const T = Math.max(1e-4, tolerance);
  let edge = { value: 0, id: -1, size: 0, which: 'WE' };
  for (const b of out.buildings) {
    for (const [which, d] of [['WE', b.dWE], ['SN', b.dSN], ['H', b.dH]]) {
      if (Math.abs(d) > Math.abs(edge.value)) edge = { value: d, id: b.id, size: b.size, which };
    }
  }
  const s = out.stats;
  const vertical = Math.abs(s.dzMax) >= Math.abs(s.dzMin) ? s.dzMax : s.dzMin;
  const geoidPart = Number.isFinite(s.dgMaxAbs) ? s.dgMaxAbs : null;
  const judged = {
    edge: { ...edge, level: level(edge.value, T) },
    horizontal: { value: s.dhMax, level: level(s.dhMax, T) },
    vertical: { value: vertical, geoid: geoidPart, level: level(vertical, T) },
  };
  return {
    tolerance: T,
    scale: { ppm: out.context.ppm0, per100m: out.context.ppm0 * 1e-4 },
    ...judged,
    overall: worst([judged.edge.level, judged.horizontal.level, judged.vertical.level]),
  };
}
