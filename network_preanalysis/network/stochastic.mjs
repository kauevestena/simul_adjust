export const zeros = (m, n) => Array.from({ length: m }, () => Array(n).fill(0));
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const diagonal = v => v.map((x, i) => v.map((_, j) => i === j ? x : 0));

// Validate and whiten covariance blocks without assuming independence forever.
export function covarianceBlock(q, size) {
  if (!Array.isArray(q) || q.length !== size || q.some(r => !Array.isArray(r) || r.length !== size || !r.every(Number.isFinite))) throw Error('invalidCovariance');
  const l = zeros(size, size);
  for (let i = 0; i < size; i++) for (let j = 0; j <= i; j++) {
    if (q[i][i] <= 0 || Math.abs(q[i][j] - q[j][i]) > 1e-10 * Math.sqrt(Math.abs(q[i][i] * q[j][j]))) throw Error('invalidCovariance');
    let v = q[i][j];
    for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k];
    if (i === j) {
      if (!(v > 1e-14 * q[i][i])) throw Error('invalidCovariance');
      l[i][j] = Math.sqrt(v);
    } else l[i][j] = v / l[j][j];
  }
  const w = zeros(size, size); // L^-1 by triangular solves
  for (let k = 0; k < size; k++) for (let i = 0; i < size; i++) {
    let v = i === k ? 1 : 0;
    for (let j = 0; j < i; j++) v -= l[i][j] * w[j][k];
    w[i][k] = v / l[i][i];
  }
  const p = zeros(size, size);
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++)
    for (let k = 0; k < size; k++) p[i][j] += w[k][i] * w[k][j];
  return { q, w, p };
}
export function controlCovariance(point) {
  if (point.controlCovariance) return covarianceBlock(point.controlCovariance, 3);
  if (!Array.isArray(point.controlSigma) || point.controlSigma.length !== 3 || !point.controlSigma.every(x => Number.isFinite(x) && x > 0)) throw Error('invalidSigma');
  return covarianceBlock(diagonal(point.controlSigma.map(x => x * x)), 3);
}
