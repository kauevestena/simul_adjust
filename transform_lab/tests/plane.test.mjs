import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPlane, planeFrame } from '../core/plane.mjs';
import { stream } from '../core/rng.mjs';
import { eigSym } from '../core/linalg.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const unit = a => { const s = Math.hypot(...a); return a.map(v => v / s); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A 7 × 10 grid on a tilted plane 8 m from the instrument, normal towards the origin
function grid(n, centre, step = 0.03) {
  const e1 = unit(cross([0, 0, 1], n)), e2 = cross(n, e1), pts = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 7; c++) pts.push(centre.map((v, a) => v + (c - 3) * step * e1[a] + (r - 4.5) * step * e2[a]));
  return pts;
}
// covariance of a reflectorless sighting: σ_s along the line of sight, σ_a across it
function cigar(x, sa, ss) {
  const u = unit(x), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] = (ss * ss - sa * sa) * u[i] * u[j] + (i === j ? sa * sa : 0);
  return C;
}
function noisy(x, C, rng) {
  // x + L z with C = L Lᵀ (eigen decomposition)
  const { values, vectors } = eigSym(C), z = values.map(v => Math.sqrt(Math.max(v, 0)) * rng.normal());
  return x.map((v, a) => v + vectors[a][0] * z[0] + vectors[a][1] * z[1] + vectors[a][2] * z[2]);
}

const N = unit([-0.6, -0.75, 0.1]), CENTRE = [4.8, 6.0, 0.4];

test('isotropic Σ: the Gauss–Helmert plane is the orthogonal regression (PCA) plane', () => {
  const rng = stream(4, 'plane');
  const pts = grid(N, CENTRE).map((x, i) => ({ name: `P${i}`, xyz: noisy(x, [[1e-6, 0, 0], [0, 1e-6, 0], [0, 0, 1e-6]], rng), cov: [[1e-6, 0, 0], [0, 1e-6, 0], [0, 0, 1e-6]] }));
  const p = fitPlane(pts);
  assert.ok(p.ok, JSON.stringify(p.error));
  const c = [0, 1, 2].map(a => pts.reduce((s, q) => s + q.xyz[a], 0) / pts.length);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  pts.forEach(q => { const d = q.xyz.map((v, a) => v - c[a]); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += d[i] * d[j]; });
  const { vectors } = eigSym(S), pca = [vectors[0][0], vectors[1][0], vectors[2][0]];
  close(Math.abs(dot(pca, p.n)), 1, 1e-12, 'same normal');
  close(Math.hypot(...p.n), 1, 1e-12, '‖n‖ = 1');
  close(p.points.reduce((s, q) => s + q.r, 0), pts.length - 3, 1e-8, 'Σ r_i = m − 3');
  assert.equal(p.r, pts.length - 3);
  assert.ok(dot(p.n, c) < 0, 'the normal points to the instrument');
  close(dot(p.n, N), 1, 1e-3, 'close to the true normal');
});

test('Monte Carlo with cigar-shaped Σ: mean σ̂0² ≈ 1 and the global test has its nominal size', () => {
  const rng = stream(7, 'mc-plane'), ideal = grid(N, CENTRE);
  let s0 = 0, rejected = 0; const K = 60;
  for (let k = 0; k < K; k++) {
    const pts = ideal.map((x, i) => { const C = cigar(x, 0.0004, 0.002); return { name: `P${i}`, xyz: noisy(x, C, rng), cov: C }; });
    const p = fitPlane(pts);
    s0 += p.sigma0sq; if (!p.test.pass) rejected++;
  }
  close(s0 / K, 1, 0.08, 'mean σ̂0²');
  assert.ok(rejected / K < 0.15, `rejections ${rejected / K}`);
});

test('a gross error along the normal gives the largest |w| above the critical value, with the sign of d', () => {
  const rng = stream(9, 'blunder-plane');
  const pts = grid(N, CENTRE).map((x, i) => { const C = cigar(x, 0.0004, 0.002); return { name: `P${i}`, xyz: noisy(x, C, rng), cov: C }; });
  const j = 23, sd = Math.sqrt(dot(N, pts[j].cov.map(row => dot(row, N))));
  pts[j].xyz = pts[j].xyz.map((v, a) => v + 10 * sd * N[a]);              // 10 σ towards the instrument
  const p = fitPlane(pts);
  const worst = p.points.reduce((a, q) => (Math.abs(q.w) > Math.abs(a.w) ? q : a));
  assert.equal(worst.name, 'P23');
  assert.ok(worst.w > p.crit.w, `w ${worst.w} > ${p.crit.w}`);
  assert.ok(worst.d > 0, 'in front of the plane: d > 0');
  close(p.crit.w, 3.2905, 1e-3, 'z(1 − 0.001/2)');
  assert.ok(worst.mdb > 0 && worst.mdb < 10 * sd, `∇0 ${worst.mdb}`);
});

test('the plane frame is right-handed and seen from the instrument (vertical and horizontal sheets)', () => {
  const wall = planeFrame(N, CENTRE);
  close(dot(wall.right, wall.up), 0, 1e-12); close(dot(wall.right, N), 0, 1e-12);
  close(dot(cross(wall.right, wall.up), N), 1, 1e-12, 'right × up = n (towards the viewer)');
  assert.ok(wall.up[2] > 0.9, 'up is the zenith for a wall');
  const table = planeFrame([0, 0, 1], [1, 2, -1.1]);
  close(dot(cross(table.right, table.up), [0, 0, 1]), 1, 1e-12);
  close(dot(table.up, unit([1, 2, 0])), 1, 1e-12, 'up points away from the instrument on a table');
});

test('fewer than 4 points or collinear points are reported, not thrown', () => {
  const C = [[1e-6, 0, 0], [0, 1e-6, 0], [0, 0, 1e-6]];
  assert.equal(fitPlane([0, 1, 2].map(i => ({ name: `${i}`, xyz: [i, 0, 0], cov: C }))).error.code, 'fewPlane');
  assert.equal(fitPlane([0, 1, 2, 3, 4].map(i => ({ name: `${i}`, xyz: [i, 2 * i, 3], cov: C }))).error.code, 'collinearPlane');
});
