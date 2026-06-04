const assert = require('assert');

const TWO_PI = 2 * Math.PI;

function wrapPi(rad) {
  while (rad > Math.PI) rad -= TWO_PI;
  while (rad < -Math.PI) rad += TWO_PI;
  return rad;
}

function wrap2Pi(rad) {
  return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

function approx(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

function angleApprox(actual, expected, tol, label) {
  approx(wrapPi(actual - expected), 0, tol, label);
}

function logGamma(z) {
  const p = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaP(a, x) {
  if (x <= 0) return 0;
  const gln = logGamma(a);
  const EPS = 1e-14;
  const ITMAX = 200;
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= ITMAX; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }

  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

function chi2CDF(x, dof) {
  return regularizedGammaP(dof / 2, x / 2);
}

function chi2Inv(p, dof) {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  let lo = 0;
  let hi = Math.max(dof, 1);
  while (chi2CDF(hi, dof) < p) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (chi2CDF(mid, dof) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function transpose(A) {
  return A[0].map((_, j) => A.map(row => row[j]));
}

function multiply(A, B) {
  const C = Array.from({ length: A.length }, () => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i++) {
    for (let k = 0; k < B.length; k++) {
      for (let j = 0; j < B[0].length; j++) C[i][j] += A[i][k] * B[k][j];
    }
  }
  return C;
}

function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.slice().concat([b[i]]));
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
    }
    assert.ok(Math.abs(M[pivot][k]) > 1e-18, 'singular system');
    [M[k], M[pivot]] = [M[pivot], M[k]];
    const p = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= p;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map(row => row[n]);
}

function inverse(A) {
  const n = A.length;
  const M = A.map((row, i) => row.slice().concat(Array.from({ length: n }, (_, j) => i === j ? 1 : 0)));
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
    }
    assert.ok(Math.abs(M[pivot][k]) > 1e-18, 'singular matrix');
    [M[k], M[pivot]] = [M[pivot], M[k]];
    const p = M[k][k];
    for (let j = 0; j < 2 * n; j++) M[k][j] /= p;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map(row => row.slice(n));
}

function freeStationRows(station, observations) {
  const A = [];
  const L = [];
  observations.forEach(obs => {
    const dx = obs.target.E - station.E;
    const dy = obs.target.N - station.N;
    const s = Math.hypot(dx, dy);
    if (obs.type === 'dist') {
      A.push([-dx / s, -dy / s, 0]);
      L.push(obs.val - s);
    } else {
      const calcDir = wrap2Pi(Math.atan2(dx, dy) - station.omega);
      A.push([-dy / (s * s), dx / (s * s), -1]);
      L.push(wrapPi(obs.val - calcDir));
    }
  });
  return { A, L };
}

function adjustFreeStation(points, truth, omega, sigDist = 0.003, sigDir = 1e-5) {
  const observations = [];
  points.forEach(target => {
    const dx = target.E - truth.E;
    const dy = target.N - truth.N;
    observations.push({ type: 'dist', target, val: Math.hypot(dx, dy), std: sigDist });
    observations.push({ type: 'direction', target, val: wrap2Pi(Math.atan2(dx, dy) - omega), std: sigDir });
  });

  const station = {
    E: points.reduce((s, p) => s + p.E, 0) / points.length,
    N: points.reduce((s, p) => s + p.N, 0) / points.length,
    omega: 0
  };
  let ss = 0, cc = 0;
  observations.filter(o => o.type === 'direction').forEach(o => {
    const az = Math.atan2(o.target.E - station.E, o.target.N - station.N);
    const om = wrap2Pi(az - o.val);
    ss += Math.sin(om);
    cc += Math.cos(om);
  });
  station.omega = wrap2Pi(Math.atan2(ss, cc));

  const P = observations.map(o => 1 / (o.std * o.std));
  let A, L;
  for (let iter = 0; iter < 20; iter++) {
    ({ A, L } = freeStationRows(station, observations));
    const N = Array.from({ length: 3 }, () => Array(3).fill(0));
    const U = Array(3).fill(0);
    for (let i = 0; i < observations.length; i++) {
      for (let r = 0; r < 3; r++) {
        U[r] += A[i][r] * P[i] * L[i];
        for (let c = 0; c < 3; c++) N[r][c] += A[i][r] * P[i] * A[i][c];
      }
    }
    const dx = solve(N, U);
    station.E += dx[0];
    station.N += dx[1];
    station.omega = wrap2Pi(station.omega + dx[2]);
    if (Math.max(Math.abs(dx[0]), Math.abs(dx[1])) < 1e-10 && Math.abs(dx[2]) < 1e-12) break;
  }
  const residuals = observations.map(o => {
    const dx = o.target.E - station.E;
    const dy = o.target.N - station.N;
    return o.type === 'dist'
      ? Math.hypot(dx, dy) - o.val
      : wrapPi(wrap2Pi(Math.atan2(dx, dy) - station.omega) - o.val);
  });
  const VTPV = residuals.reduce((sum, v, i) => sum + v * P[i] * v, 0);
  return { station, VTPV };
}

function levelingAdjust(points, observations) {
  const unknowns = points.filter(p => !p.fixed);
  const unkIdx = Object.fromEntries(unknowns.map((p, i) => [p.id, i]));
  const A = observations.map(() => Array(unknowns.length).fill(0));
  const L = [];
  observations.forEach((o, i) => {
    const from = points.find(p => p.id === o.from);
    const to = points.find(p => p.id === o.to);
    if (!from.fixed) A[i][unkIdx[from.id]] = -1;
    if (!to.fixed) A[i][unkIdx[to.id]] = 1;
    L.push(o.val - (to.H - from.H));
  });
  const P = observations.map(o => 1 / (o.std * o.std));
  const N = Array.from({ length: unknowns.length }, () => Array(unknowns.length).fill(0));
  const U = Array(unknowns.length).fill(0);
  for (let i = 0; i < observations.length; i++) {
    for (let r = 0; r < unknowns.length; r++) {
      U[r] += A[i][r] * P[i] * L[i];
      for (let c = 0; c < unknowns.length; c++) N[r][c] += A[i][r] * P[i] * A[i][c];
    }
  }
  const dx = solve(N, U);
  unknowns.forEach((p, i) => { p.H += dx[i]; });
  const V = observations.map(o => {
    const from = points.find(p => p.id === o.from);
    const to = points.find(p => p.id === o.to);
    return to.H - from.H - o.val;
  });
  const VTPV = V.reduce((sum, v, i) => sum + v * P[i] * v, 0);
  const Qxx = inverse(N);
  const AQ = multiply(A, Qxx);
  const Qv = observations.map((o, i) => {
    const aqAt = A[i].reduce((sum, _, j) => sum + AQ[i][j] * A[i][j], 0);
    return o.std * o.std - aqAt;
  });
  const r = Qv.map((q, i) => q * P[i]);
  return { points, V, VTPV, Qxx, r, dof: observations.length - unknowns.length };
}

function validateLeveling(points, observations) {
  const errors = [];
  if (!points.some(p => p.fixed)) errors.push('datum');
  const ids = new Set(points.map(p => p.id));
  const adj = new Map(points.map(p => [p.id, new Set()]));
  observations.forEach(o => {
    if (!ids.has(o.from) || !ids.has(o.to)) errors.push('missing endpoint');
    if (o.from === o.to) errors.push('same endpoint');
    if (!(o.std > 0)) errors.push('invalid sigma');
    if (!(o.distance > 0)) errors.push('zero distance');
    if (ids.has(o.from) && ids.has(o.to) && o.from !== o.to) {
      adj.get(o.from).add(o.to);
      adj.get(o.to).add(o.from);
    }
  });
  const reachable = new Set(points.filter(p => p.fixed).map(p => p.id));
  const queue = [...reachable];
  while (queue.length) {
    const id = queue.shift();
    for (const next of adj.get(id) || []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  points.filter(p => !p.fixed && !reachable.has(p.id)).forEach(() => errors.push('disconnected'));
  return [...new Set(errors)];
}

// Exact chi-square quantiles.
approx(chi2Inv(0.95, 1), 3.841458820694124, 1e-10, 'chi2 df=1');
approx(chi2Inv(0.95, 3), 7.814727903251179, 1e-10, 'chi2 df=3');
approx(chi2Inv(0.95, 6), 12.591587243743977, 1e-10, 'chi2 df=6');

// Deterministic free-station adjustment.
{
  const points = [
    { id: 'A', E: 800, N: 900 },
    { id: 'B', E: 1250, N: 880 },
    { id: 'C', E: 1180, N: 1230 },
    { id: 'D', E: 850, N: 1190 }
  ];
  const truth = { E: 1005.25, N: 1010.75 };
  const omega = 1.2345;
  const result = adjustFreeStation(points, truth, omega);
  approx(result.station.E, truth.E, 1e-7, 'free station E');
  approx(result.station.N, truth.N, 1e-7, 'free station N');
  angleApprox(result.station.omega, omega, 1e-10, 'free station omega');
  approx(result.VTPV, 0, 1e-10, 'free station VTPV');
}

// Free-station Jacobian finite differences, including wrapped direction.
{
  const station = { E: 998.5, N: 1002.1, omega: TWO_PI - 0.003 };
  const target = { E: 1220.4, N: 903.2 };
  const { A } = freeStationRows(station, [
    { type: 'dist', target, val: 0 },
    { type: 'direction', target, val: 0 }
  ]);
  const h = 1e-5;
  const dist = s => Math.hypot(target.E - s.E, target.N - s.N);
  const dir = s => wrap2Pi(Math.atan2(target.E - s.E, target.N - s.N) - s.omega);
  approx(A[0][0], (dist({ ...station, E: station.E + h }) - dist({ ...station, E: station.E - h })) / (2 * h), 1e-8, 'dist dE');
  approx(A[0][1], (dist({ ...station, N: station.N + h }) - dist({ ...station, N: station.N - h })) / (2 * h), 1e-8, 'dist dN');
  approx(A[1][0], wrapPi(dir({ ...station, E: station.E + h }) - dir({ ...station, E: station.E - h })) / (2 * h), 1e-8, 'dir dE');
  approx(A[1][1], wrapPi(dir({ ...station, N: station.N + h }) - dir({ ...station, N: station.N - h })) / (2 * h), 1e-8, 'dir dN');
  approx(A[1][2], wrapPi(dir({ ...station, omega: station.omega + h }) - dir({ ...station, omega: station.omega - h })) / (2 * h), 1e-8, 'dir domega');
}

// Leveling closed-loop adjustment.
{
  const points = [
    { id: 'RN', H: 100, fixed: true },
    { id: 'P1', H: 109.8, fixed: false },
    { id: 'P2', H: 115.2, fixed: false }
  ];
  const observations = [
    { from: 'RN', to: 'P1', val: 10.002, std: 0.002 },
    { from: 'P1', to: 'P2', val: 5.001, std: 0.002 },
    { from: 'RN', to: 'P2', val: 15.000, std: 0.002 }
  ];
  const result = levelingAdjust(points, observations);
  approx(points[1].H, 110.001, 1e-12, 'leveling P1');
  approx(points[2].H, 115.001, 1e-12, 'leveling P2');
  approx(result.V[0], -0.001, 1e-12, 'leveling v1');
  approx(result.V[1], -0.001, 1e-12, 'leveling v2');
  approx(result.V[2], 0.001, 1e-12, 'leveling v3');
  approx(result.VTPV, 0.75, 1e-10, 'leveling VTPV');
  assert.strictEqual(result.dof, 1);
  approx(result.Qxx[0][0], 2.6666666666666664e-6, 1e-18, 'leveling Qxx 11');
  approx(result.Qxx[1][1], 2.6666666666666664e-6, 1e-18, 'leveling Qxx 22');
  result.r.forEach((ri, i) => approx(ri, 1 / 3, 1e-12, `leveling redundancy ${i}`));
}

// Leveling validation failures.
{
  assert.ok(validateLeveling([{ id: 'P1', fixed: false }], []).includes('datum'));
  assert.ok(validateLeveling([{ id: 'RN', fixed: true }, { id: 'P1', fixed: false }], [
    { from: 'P1', to: 'P1', std: 0.001, distance: 10 }
  ]).includes('same endpoint'));
  assert.ok(validateLeveling([{ id: 'RN', fixed: true }, { id: 'P1', fixed: false }], [
    { from: 'RN', to: 'P1', std: 0, distance: 10 }
  ]).includes('invalid sigma'));
  assert.ok(validateLeveling([{ id: 'RN', fixed: true }, { id: 'P1', fixed: false }], [
    { from: 'RN', to: 'P1', std: 0.001, distance: 0 }
  ]).includes('zero distance'));
  assert.ok(validateLeveling([{ id: 'RN', fixed: true }, { id: 'P1', fixed: false }, { id: 'P2', fixed: false }], [
    { from: 'P1', to: 'P2', std: 0.001, distance: 10 }
  ]).includes('disconnected'));
}

console.log('All tests passed.');
