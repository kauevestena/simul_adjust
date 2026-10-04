// All distances are horizontal metres in the network's ENU frame.
export const STREET_LIMIT = 3;
export const SNAP_LIMIT = 15;

export function nearestStreet(point, streets = []) {
  let distance = Infinity, nearest = null, streetIndex = -1;
  streets.forEach((line, index) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (![...a, ...b].every(Number.isFinite)) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((point.E - a[0]) * dx + (point.N - a[1]) * dy) / den)) : 0;
      const p = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(point.E - p[0], point.N - p[1]);
      if (d < distance) { distance = d; nearest = p; streetIndex = index; }
    }
  });
  return { distance, nearest, streetIndex };
}

export function validatePointPlacement(point, scenario = {}) {
  if (![point.E, point.N].every(Number.isFinite) || Math.abs(point.E) > 1e6 || Math.abs(point.N) > 1e6)
    return { valid: false, reason: 'coordinateRange' };
  const b = scenario.bounds;
  if (b && (point.E < b[0] || point.N < b[1] || point.E > b[2] || point.N > b[3]))
    return { valid: false, reason: 'outsideTerrain' };
  if (scenario.level !== 2) return { valid: true };
  const nearest = nearestStreet(point, scenario.streets);
  if (!nearest.nearest) return { valid: false, reason: 'streetsMissing' };
  // One nanometre absorbs projection roundoff at the inclusive 3 m boundary.
  const valid = nearest.distance <= STREET_LIMIT + 1e-9;
  return { valid, reason: valid ? null : 'streetDistance', ...nearest };
}

export function resolvePointPlacement(point, scenario, snap = false) {
  const result = validatePointPlacement(point, scenario);
  if (!result.valid && result.reason === 'streetDistance' && snap && result.distance <= SNAP_LIMIT) {
    const position = { E: result.nearest[0], N: result.nearest[1] };
    const checked = validatePointPlacement(position, scenario);
    if (checked.valid) return { ...checked, position, snapped: true, snapDistance: result.distance };
  }
  return { ...result, position: { E: point.E, N: point.N }, snapped: false };
}

export function validateNetworkPlacement(network, scenario) {
  if (network.level === 2 && (scenario?.level !== 2 || !scenario.streets?.length)) throw Error('streetsMissing');
  if (network.level === 2 && (scenario.id !== network.streetDataset ||
      ['lat', 'lon', 'h'].some(k => scenario.origin?.[k] !== network.origin?.[k]))) throw Error('urbanReference');
  for (const point of network.points) {
    const result = validatePointPlacement(point, scenario);
    if (!result.valid) throw Error(result.reason);
  }
}

// Liang–Barsky clips each segment before snapping, so the nearest candidate is
// always inside the exercise bounds, even for OSM ways crossing the boundary.
export function clipSegment(a, b, bounds) {
  let lo = 0, hi = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - bounds[0], bounds[2] - a[0], a[1] - bounds[1], bounds[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  const at = t => [Math.max(bounds[0], Math.min(bounds[2], a[0] + t * dx)), Math.max(bounds[1], Math.min(bounds[3], a[1] + t * dy))];
  return [at(lo), at(hi)];
}
