import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCSEC, DEG, polarToLocal, localToPolar, polarJacobian, localToPolarJacobian, polarSigmas,
  localCovariance, lineOfSightFrame, simulatePolar, parseDmmss, degToDms, parseJobFile, distanceSigma
} from '../../shared/total_station.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('local frame is right-handed: Hz 90° -> +X, Hz 0° -> +Y, zenith -> +Z', () => {
  const ex = polarToLocal(90 * DEG, 90 * DEG, 1);
  const ey = polarToLocal(0, 90 * DEG, 1);
  const ez = polarToLocal(0, 0, 1);
  [[ex, [1, 0, 0]], [ey, [0, 1, 0]], [ez, [0, 0, 1]]].forEach(([v, e]) => v.forEach((c, i) => close(c, e[i], 1e-15)));
  close(dot(cross(ex, ey), ez), 1, 1e-15, 'det[eX, eY, eZ]');
  // Clockwise circle: a larger reading turns from +Y towards +X (seen from above)
  const a = polarToLocal(10 * DEG, 90 * DEG, 1), b = polarToLocal(20 * DEG, 90 * DEG, 1);
  assert.ok(cross(a, b)[2] < 0, 'increasing Hz rotates clockwise about +Z');
});

test('polar <-> local round trip', () => {
  for (const [hz, zen, d] of [[0.3, 1.2, 7.5], [3.5, 1.9, 120], [6.2, 0.4, 2.1], [1.5707, 1.5707, 30]]) {
    const p = localToPolar(polarToLocal(hz, zen, d));
    close(p.hz, hz, 1e-12); close(p.zen, zen, 1e-12); close(p.dist, d, 1e-12);
  }
});

test('Jacobians match central finite differences and invert each other', () => {
  const L = [2.1, 1.35, 8.4], h = 1e-7;
  const J = polarJacobian(...L);
  for (let c = 0; c < 3; c++) {
    const p = L.slice(), m = L.slice(); p[c] += h; m[c] -= h;
    const fp = polarToLocal(...p), fm = polarToLocal(...m);
    for (let r = 0; r < 3; r++) close(J[r][c], (fp[r] - fm[r]) / (2 * h), 1e-6, `J[${r}][${c}]`);
  }
  const xyz = polarToLocal(...L), K = localToPolarJacobian(xyz);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const v = K[r][0] * J[0][c] + K[r][1] * J[1][c] + K[r][2] * J[2][c];
    close(v, r === c ? 1 : 0, 1e-12, `KJ[${r}][${c}]`);
  }
});

test('coordinate covariance is a cigar along the line of sight', () => {
  const L = [0.4, 1.5, 8], sig = polarSigmas(L[2], L[1], { angleSec: 2, mm: 2, ppm: 2 });
  close(sig[2], 0.002 + 16e-6, 1e-15, 'σS = a + b·S');
  close(sig[0], 2 * ARCSEC, 1e-18);
  const C = localCovariance(...L, sig);
  const { los, across, up } = lineOfSightFrame(polarToLocal(...L));
  const q = v => dot(v, [dot(C[0], v), dot(C[1], v), dot(C[2], v)]);
  close(q(los), sig[2] ** 2, 1e-15, 'variance along the sight');
  close(q(across), (L[2] * Math.sin(L[1]) * sig[0]) ** 2, 1e-15, 'horizontal across');
  close(q(up), (L[2] * sig[1]) ** 2, 1e-15, 'vertical across');
  close(dot(cross(across, up), los), 1, 1e-12, 'triad is right-handed');
  assert.ok(up[2] > 0, 'up points upwards');
  const D = localCovariance(...L, sig, { diagonal: true });
  assert.equal(D[0][1], 0); assert.equal(D[1][2], 0); close(D[2][2], C[2][2], 0);
});

test('pointing error adds in quadrature to the angles', () => {
  const [sHz, sZ] = polarSigmas(10, Math.PI / 2, { angleSec: 0, pointingMm: 1 });
  close(sHz, 1e-4, 1e-15); close(sZ, 1e-4, 1e-15);
  close(distanceSigma(500, { mm: 2, ppm: 2 }), 0.003, 1e-15);
});

test('simulated observations scatter with the declared sigmas', () => {
  let s = 1;
  const normal = () => { // deterministic Box–Muller on an LCG
    const u = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    return Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  };
  const truth = [3, 7, 0.4], sig = [5 * ARCSEC, 5 * ARCSEC, 0.003];
  const n = 4000; let m = 0, v = 0;
  const exact = localToPolar(truth).dist;
  for (let i = 0; i < n; i++) { const o = simulatePolar(truth, sig, normal); const e = o.dist - exact; m += e; v += e * e; }
  close(m / n, 0, 3 * 0.003 / Math.sqrt(n));
  close(Math.sqrt(v / n), 0.003, 0.0002);
});

test('DDD.MMSS parsing and formatting', () => {
  close(parseDmmss('163.0330'), 163 + 3 / 60 + 30 / 3600, 1e-12);
  close(parseDmmss('163.033015'), 163 + 3 / 60 + 30.15 / 3600, 1e-12);
  close(parseDmmss('270.5603'), 270 + 56 / 60 + 3 / 3600, 1e-12);
  close(parseDmmss('12'), 12, 0);
  assert.ok(Number.isNaN(parseDmmss('10.6000')), 'minutes > 59');
  assert.ok(Number.isNaN(parseDmmss('abc')));
  assert.equal(degToDms(163 + 3 / 60 + 30 / 3600, 1), '163° 03′ 30.0″');
  assert.equal(degToDms(59.99999999, 0), '60° 00′ 00″');
});

test('job file keeps the SS point ids', () => {
  const txt = 'JOB     AJ4,\r\nUNITS   M,D\r\nSS      A7,0.000,\r\nSD      270.5603,117.5148,3.448\r\nSS      12,0.000,\r\nSD      266.3737,128.2428,2.593\r\nSD      bad,1,2\r\n';
  const { records, errors } = parseJobFile(txt);
  assert.deepEqual(records.map(r => r.id), ['A7', '12']);
  close(records[0].hzDeg, 270 + 56 / 60 + 3 / 3600, 1e-12);
  close(records[1].dist, 2.593, 0);
  assert.equal(errors.length, 1);
});
