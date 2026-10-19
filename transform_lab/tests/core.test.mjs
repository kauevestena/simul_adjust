import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDataset, PRESETS } from '../core/simulate.mjs';
import { run, selectRoles } from '../core/pipeline.mjs';
import { referencePoints, allPairs, selectPairs, independentPairs, referenceCovariance, distanceTable, distancesCsv, pointName } from '../core/reference.mjs';
import { PARAM_KEYS, rotationDifference } from '../core/rotations.mjs';
import { stream } from '../core/rng.mjs';
import { chi2Inv } from '../core/stats.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const ARCSEC = Math.PI / 648000;
const exact = (over = {}) => simulateDataset({ seed: 3, noise: false, ...over });

test('reference grid: 70 vertices, names A0…R2, pair-set sizes 2415 / 231 / 123', () => {
  const pts = referencePoints();
  assert.equal(pts.length, 70);
  assert.equal(pts[0].name, 'A0'); assert.equal(pts[25].name, 'Z0'); assert.equal(pts[26].name, 'A1'); assert.equal(pts[69].name, 'R2');
  assert.equal(new Set(pts.map(p => p.name)).size, 70);
  assert.deepEqual([pts[6].x, pts[6].y, pts[69].x, pts[69].y], [18, 0, 18, 27]);
  assert.equal(pointName(52), 'A2');
  const all = allPairs(pts);
  assert.equal(all.length, 2415);
  assert.equal(selectPairs(all, 'n8').length, 231);
  assert.equal(selectPairs(all, 'n4').length, 123);
  assert.equal(selectPairs(all, 'all').length, 2415);
  assert.equal(selectPairs(all, 'random', { pct: 10, rng: stream(1, 'x') }).length, 242);
  // 8-neighbour graph of a grid is rigid in the plane: rank 2n − 3 = 137, and "all" adds nothing
  assert.equal(independentPairs(selectPairs(all, 'n8'), pts).rows.length, 137);
  assert.equal(independentPairs(all, pts).rows.length, 137);
  assert.equal(independentPairs(selectPairs(all, 'n4'), pts).rows.length, 123);
});

test('distance CSV has one line per pair plus the header, with σ_d from Σ_S', () => {
  const pts = referencePoints(), S = referenceCovariance(pts, { sxy: 0.01, sz: 0.01 });   // 0.1 mm in cm
  const table = distanceTable(pts, S);
  const csv = distancesCsv(table);
  assert.equal(csv.trim().split('\r\n').length, 2416);
  close(table[0].sigma, Math.sqrt(2) * 0.01, 1e-12, 'σ_d of two independent points, in the line of sight of the pair');
  assert.equal(table[0].kind === 'h' || table[0].kind === 'v', true);
});

test('seeded streams are reproducible and independent', () => {
  const a = stream(5, 'noise'), b = stream(5, 'noise'), c = stream(5, 'checks');
  assert.equal(a.uniform(), b.uniform());
  assert.notEqual(stream(5, 'noise').uniform(), c.uniform());
  const r = stream(9, 'n'); let m = 0, v = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const z = r.normal(); m += z; v += z * z; }
  close(m / N, 0, 0.03); close(v / N, 1, 0.05);
});

test('check-point selection: percentages, overrides, and always ≥ 3 control points', () => {
  const names = referencePoints().map(p => p.name);
  const cfg = { checkSeed: 4, checkPct: 25, checkOverride: {} };
  const count = c => Object.values(selectRoles(names, c)).filter(v => v === 'check').length;
  assert.equal(count(cfg), Math.round(70 * 0.25));
  assert.equal(count({ ...cfg, checkPct: 0 }), 0);
  assert.equal(count({ ...cfg, checkPct: 90 }), 63);
  assert.deepEqual(selectRoles(names, cfg), selectRoles(names, { ...cfg }));
  assert.equal(selectRoles(names, { ...cfg, checkOverride: { A0: true } }).A0, 'check');
  assert.equal(count({ checkSeed: 4, checkPct: 100, checkOverride: {} }), 67);
});

test('noise-free data is recovered exactly: every parametrization × method × scale mode', () => {
  const ds = exact();
  for (const method of ['combinado', 'parametrico']) for (const scaleMode of ['estimate', 'rigid']) for (const rotation of PARAM_KEYS) {
    const r = run(ds, { method, rotation, scaleMode, checkPct: 20 });
    assert.ok(r.ok, `${method}/${rotation}/${scaleMode}: ${JSON.stringify(r.error)}`);
    close(rotationDifference(r.res.R, ds.truth.R), 0, 1e-9, `${method}/${rotation}/${scaleMode} rotation`);
    close(r.res.lambda, scaleMode === 'rigid' ? 1 : 0.01, 1e-11, `${method}/${rotation}/${scaleMode} λ`);
    assert.ok(r.res.Omega < 1e-6, `Ω ${r.res.Omega}`);
    assert.equal(r.res.r, 3 * r.counts.control - (scaleMode === 'rigid' ? 6 : 7), `${method}/${rotation} redundancy`);
    assert.ok(r.checks.rms.total < 1e-9, 'check points exact');
  }
});

test('invariants do not depend on the parametrization', () => {
  const ds = simulateDataset({ seed: 21 });
  for (const method of ['combinado', 'parametrico']) {
    const base = run(ds, { method, rotation: 'euler' });
    for (const rotation of ['quaternion', 'matrix', 'axisAngle']) {
      const r = run(ds, { method, rotation });
      close(rotationDifference(r.res.R, base.res.R), 0, 1e-9, `${method}/${rotation} R`);
      close(r.res.lambda, base.res.lambda, 1e-12, 'λ');
      close(r.res.Omega, base.res.Omega, 1e-7, 'Ω');
      r.res.t.forEach((v, i) => close(v, base.res.t[i], 1e-9, 't'));
      r.res.V.forEach((v, i) => close(v, base.res.V[i], 1e-9, 'V'));
      // covariance of the small-rotation vector is the same for every parametrization
      r.params.SigmaEps.forEach((row, i) => row.forEach((v, j) => close(v, base.params.SigmaEps[i][j], 1e-6 * Math.abs(base.params.SigmaEps[i][i]) + 1e-14, `Σε ${i}${j}`)));
    }
  }
});

test('combined with an (almost) exact reference equals the parametric model', () => {
  const ds = simulateDataset({ seed: 8, reference: { trueSigmaMm: 0 } });
  const cfg = { refSigma: { xyMm: 1e-7, zMm: 1e-7 } };
  const c = run(ds, { ...cfg, method: 'combinado' }), p = run(ds, { ...cfg, method: 'parametrico' });
  close(rotationDifference(c.res.R, p.res.R), 0, 1e-9, 'R');
  close(c.res.lambda, p.res.lambda, 1e-11, 'λ');
  close(c.res.Omega, p.res.Omega, 1e-6 * p.res.Omega, 'Ω');
  c.res.SigmaXapriori.forEach((row, i) => row.forEach((v, j) => close(v, p.res.SigmaXapriori[i][j], 1e-6 * Math.sqrt(Math.abs(p.res.SigmaXapriori[i][i] * p.res.SigmaXapriori[j][j])), `Q ${i}${j}`)));
});

test('rigid mode: distance injunções change nothing in the parametric model; they only pull λ in similarity mode', () => {
  const ds = simulateDataset({ seed: 12, reference: { printScalePpmX: 800, printScalePpmY: 800 } });
  for (const type of ['absolute', 'relative']) {
    const none = run(ds, { method: 'parametrico', scaleMode: 'rigid' });
    const withI = run(ds, { method: 'parametrico', scaleMode: 'rigid', injunctions: { set: 'n8', type } });
    close(rotationDifference(none.res.R, withI.res.R), 0, 1e-7 * ARCSEC * 1e3, `${type} rigid R`);
    none.res.t.forEach((v, i) => close(v, withI.res.t[i], type === 'absolute' ? 1e-12 : 2e-6, `${type} rigid t`));
  }
  const s0 = run(ds, { method: 'parametrico' });
  const sa = run(ds, { method: 'parametrico', injunctions: { set: 'n8', type: 'absolute' } });
  close(sa.res.lambda, 0.01, 1e-14, 'absolute: λ = nominal');
  assert.ok(Math.abs(s0.res.lambda - 0.01) > 1e-8, 'the printer scale error moves the free λ');
  const sr = run(ds, { method: 'parametrico', injunctions: { set: 'n8', type: 'relative' } });
  assert.ok(Math.abs(sr.res.lambda - 0.01) < Math.abs(s0.res.lambda - 0.01) + 1e-12, 'relative injunções pull λ towards nominal');
  assert.ok(sa.injInfo.independent > 60 && sa.injInfo.independent <= 2 * sa.counts.control - 3, `independent ${sa.injInfo.independent}`);
});

test('combined with absolute distances: adjusted TS distances equal the nominal ones exactly', () => {
  const ds = simulateDataset({ seed: 15 });
  const r = run(ds, { method: 'combinado', injunctions: { set: 'n4', type: 'absolute' } });
  assert.ok(r.ok);
  const pts = r.points.filter(p => p.role === 'control');
  const byName = Object.fromEntries(pts.map(p => [p.name, p.tsAdj]));
  const refs = Object.fromEntries(ds.ref.map(p => [p.name, p]));
  let worst = 0;
  for (const q of allPairs(referencePoints()).filter(p => p.kind === 'h' || p.kind === 'v')) {
    if (!byName[q.a] || !byName[q.b]) continue;
    const d = Math.hypot(...byName[q.a].map((v, i) => v - byName[q.b][i]));
    worst = Math.max(worst, Math.abs(d - q.d * 0.01));
  }
  assert.ok(worst < 1e-9, `worst ${worst}`);
  assert.equal(r.res.r, 3 * r.counts.control + r.injInfo.used - 7);
  void refs;
});

test('Euler gimbal lock: the landscape preset is flagged, the quaternion is not', () => {
  const ds = simulateDataset({ seed: 5, ...PRESETS.landscape });
  close(Math.abs(ds.truth.R[2][0]), 1, 1e-12, 'sheet x axis is vertical');
  const e = run(ds, { rotation: 'euler' });
  assert.ok(!e.ok || e.res.flags.some(f => f.code === 'gimbal'), 'Euler flags gimbal lock or fails');
  const q = run(ds, { rotation: 'quaternion' });
  assert.ok(q.ok && !q.res.flags.some(f => f.code === 'gimbal'));
  close(rotationDifference(q.res.R, ds.truth.R), 0, 2e-2, 'quaternion still recovers the pose');
});

test('without the orthonormality injunções the matrix and the homogeneous quaternion are singular', () => {
  const ds = simulateDataset({ seed: 5 });
  const m = run(ds, { rotation: 'matrix', constrainRotation: false });
  assert.equal(m.ok, false); assert.equal(m.error.code, 'singular');
  const q = run(ds, { rotation: 'quaternion', constrainRotation: false });
  assert.equal(q.ok, false, 'q and λ are confounded');
  const qr = run(ds, { rotation: 'quaternion', constrainRotation: false, scaleMode: 'rigid' });
  assert.ok(qr.ok, 'in rigid mode ‖q‖² silently acts as the scale');
  const e = run(ds, { rotation: 'euler', constrainRotation: false });
  assert.ok(e.ok, 'Euler needs no injunções');
});

test('axis–angle is singular when the sheet is aligned with the station (θ = 0)', () => {
  const ds = simulateDataset({ seed: 5, ...PRESETS.tableAligned, noise: false });
  const R = ds.truth.R;
  close(Math.abs(R[0][0]) + Math.abs(R[1][1]) + Math.abs(R[2][2]), 3, 1e-12, 'R = I');
  const a = run(ds, { rotation: 'axisAngle' });
  assert.ok(!a.ok || a.res.flags.some(f => f.code === 'axisUndefined' || f.code === 'illConditioned'));
  assert.ok(run(ds, { rotation: 'quaternion' }).ok);
});

test('unmatched points: uncollected reference forward, TS-only inverse (z_S ≈ 0 on the sheet)', () => {
  const ds = simulateDataset({ seed: 31, collectedPct: 80, extraPoints: 4 });
  const r = run(ds, {});
  assert.equal(r.counts.tsOnly, 4); assert.equal(r.counts.uncollected, 14);
  r.points.filter(p => p.role === 'tsOnly').forEach(p => {
    p.truth.forEach((v, i) => assert.ok(Math.abs(p.sheet[i] - v) < 5 * p.sheetSigma[i] + 1e-9, `${p.name}[${i}] ${p.sheet[i]} vs ${v} (σ ${p.sheetSigma[i]})`));
  });
});

test('Monte Carlo: σ̂0² ≈ 1 and the check-point statistics have the nominal coverage (combined model, true = declared)', () => {
  let s0 = 0, pass = 0, failGlobal = 0; const N = 60;
  for (let k = 0; k < N; k++) {
    const r = run(simulateDataset({ seed: 100 + k, collectedPct: 60 }), { method: 'combinado', checkPct: 30 });
    s0 += r.res.sigma0sq; if (r.checks.joint.pass) pass++; if (!r.res.test.pass) failGlobal++;
  }
  close(s0 / N, 1, 0.06, 'mean σ̂0²');
  assert.ok(pass / N > 0.85, `joint check coverage ${pass / N}`);
  assert.ok(failGlobal / N < 0.2, `global test rejections ${failGlobal / N}`);
});

test('parametric σ̂0² exceeds 1 when the reference is not exact (the default lesson)', () => {
  let s0 = 0; const N = 20;
  for (let k = 0; k < N; k++) s0 += run(simulateDataset({ seed: 300 + k }), { method: 'parametrico' }).res.sigma0sq;
  assert.ok(s0 / N > 1.5, `mean ${s0 / N}`);
});

test('units: mm reference and cm TS give the same adjusted pose as cm / m', () => {
  const a = simulateDataset({ seed: 9, noise: false }), b = simulateDataset({ seed: 9, noise: false, refUnit: 'mm', tsUnit: 'cm' });
  const ra = run(a, { checkPct: 0 }), rb = run(b, { checkPct: 0, outUnit: 'm' });
  close(rotationDifference(ra.res.R, rb.res.R), 0, 1e-8);
  close(rb.res.lambda, 0.1, 1e-10, 'λ mm → cm = 0.1');
  close(rb.params.deltaPpm, 0, 1e-3);
  // rigid mode pre-converts the reference
  const rr = run(b, { checkPct: 0, scaleMode: 'rigid' });
  close(rotationDifference(rr.res.R, ra.res.R), 0, 1e-8);
  assert.equal(rr.pre, 0.1);
});

test('the azimuth origin is arbitrary: a constant shift of every azimuth only rotates the frame about Z', () => {
  for (const off of [137.2, 250]) {
    const d0 = simulateDataset({ seed: 21 }), d1 = simulateDataset({ seed: 21, azimuthOffset: off });
    for (const method of ['combinado', 'parametrico']) for (const rotation of ['euler', 'quaternion']) {
      const a = run(d0, { method, rotation }), b = run(d1, { method, rotation });
      close(b.res.sigma0sq, a.res.sigma0sq, 1e-6, `${method} σ̂0²`);
      close(b.res.lambda, a.res.lambda, 1e-10, 'λ');
      close(b.counts.check, a.counts.check, 0, 'same roles');
      // x' = Rz x with Rz = rotation by −off about Z in the (sinHz, cosHz) convention: R' = Rz·R, t' = Rz·t
      const c = Math.cos(off * Math.PI / 180), s = Math.sin(off * Math.PI / 180), Rz = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
      const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((acc, v, k) => acc + v * B[k][j], 0)));
      close(rotationDifference(b.res.R, mul(Rz, a.res.R)), 0, 1e-8, 'R′ = Rz·R');
      close(b.res.Omega, a.res.Omega, 1e-7 * (1 + a.res.Omega), 'Ω');
    }
  }
});

test('IDs with no match are only transformed: never control, never check, and they do not change the fit', () => {
  const base = simulateDataset({ seed: 5, extraPoints: 0 });
  const more = structuredClone(base);
  const extra = base.ts[0];
  ['7', 'foo', 'EX9'].forEach((name, i) => more.ts.push({ ...structuredClone(extra), name, xyz: extra.xyz.map(v => v + 0.05 * (i + 1)) }));
  for (const checkPct of [0, 30, 90]) {
    const a = run(base, { checkPct }), b = run(more, { checkPct });
    assert.equal(b.counts.tsOnly, 3);
    for (const n of ['7', 'foo', 'EX9']) assert.equal(b.points.find(p => p.name === n).role, 'tsOnly');
    assert.equal(b.counts.control, a.counts.control); assert.equal(b.counts.check, a.counts.check);
    close(b.res.Omega, a.res.Omega, 1e-9, 'Ω'); close(b.res.lambda, a.res.lambda, 1e-12, 'λ');
    b.res.t.forEach((v, i) => close(v, a.res.t[i], 1e-12, 't'));
  }
  // with injunções as well
  const a = run(base, { injunctions: { set: 'n8', type: 'relative', factor: 1 } }), b = run(more, { injunctions: { set: 'n8', type: 'relative', factor: 1 } });
  close(b.res.Omega, a.res.Omega, 1e-9, 'Ω with injunções');
});
