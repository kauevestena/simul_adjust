// Standard normal CDF. Positive-term integrated Gaussian series; no cancellation
// inside the sum. Sufficient for alpha >= 1e-6; verified against SciPy. Known a-priori covariance;
// two-sided single-observation test, not a family-wise/data-snooping procedure.
export function normalCdf(x) {
  const z = Math.abs(x);
  if (z > 10) return x > 0 ? 1 : 0;
  let term = z, sum = z;
  for (let i = 1; i < 1000; i++) {
    term *= z * z / (2 * i + 1); sum += term;
    if (term <= sum * Number.EPSILON) break;
  }
  const half = Math.min(0.5, Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * sum);
  return x >= 0 ? 0.5 + half : 0.5 - half;
}
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) throw Error('invalidStatistics');
  let lo = -10, hi = 10;
  for (let i = 0; i < 65; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
export function noncentrality(alpha = 0.001, power = 0.8) {
  if (!(alpha >= 1e-6 && alpha <= 0.2 && power >= 0.5 && power < 0.9999)) throw Error('invalidStatistics');
  const c = normalQuantile(1 - alpha / 2);
  let lo = 0, hi = 15;
  for (let i = 0; i < 65; i++) {
    const d = (lo + hi) / 2, probability = normalCdf(-c - d) + 1 - normalCdf(c - d);
    if (probability < power) lo = d; else hi = d;
  }
  return (lo + hi) / 2;
}
export function errorEllipse(cov, confidence = '1sigma') {
  const a = cov[0][0], b = cov[0][1], d = cov[1][1];
  const gap = Math.hypot(a - d, 2 * b), large = Math.max(0, (a + d + gap) / 2);
  const small = Math.max(0, (a + d - gap) / 2);
  const theta = 0.5 * Math.atan2(2 * b, a - d); // from East, counterclockwise
  const scale = confidence === '95' ? Math.sqrt(-2 * Math.log(0.05)) : 1;
  return { major: Math.sqrt(large) * scale, minor: Math.sqrt(small) * scale, theta,
    azimuth: ((Math.PI / 2 - theta) % Math.PI + Math.PI) % Math.PI, scale };
}
export function externalReliability(result, rowIndex) {
  const row = result.rows[rowIndex];
  if (!result.solvable || !row || !Number.isFinite(row.mdb)) return null;
  const dx = result.gain.map(r => r[rowIndex] * row.mdb);
  const points = Object.create(null);
  result.parameters.forEach((p, i) => {
    if (p.axis === 'omega') return;
    points[p.id] ??= [0, 0, 0];
    points[p.id][['E', 'N', 'U'].indexOf(p.axis)] = dx[i];
  });
  return { dx, points };
}
