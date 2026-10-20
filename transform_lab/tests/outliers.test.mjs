import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tInv, tCDF, tauCritical, wCritical, delta0, chi2Inv } from '../core/stats.mjs';
import { run, adjust } from '../core/pipeline.mjs';
import { detectOutliers } from '../core/outliers.mjs';
import { buildImported, applyBlunders } from '../core/io.mjs';
import { simulateDataset } from '../core/simulate.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const ATV = { angleSec: 2, mm: 2, ppm: 2, pointingMm: 0.4 };
const atv = file => buildImported(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'), { instrument: ATV, renumber: false }).dataset;
// IDs 57–70 of the job: the block that moved about 10 mm (README)
const BLOCK = ['E2', 'F2', 'G2', 'H2', 'I2', 'J2', 'K2', 'R2', 'Q2', 'P2', 'O2', 'N2', 'M2', 'L2'];

test('Student t and the critical values of the tests', () => {
  close(tInv(0.975, 9), 2.262157, 1e-6, 't(0.975; 9)');
  close(tInv(0.995, 20), 2.845340, 1e-6, 't(0.995; 20)');
  close(tCDF(tInv(0.9, 5), 5), 0.9, 1e-10);
  close(wCritical(0.001), 3.290527, 1e-5, 'z(1 − 0.001/2)');
  close(delta0(0.001, 0.8), 3.290527 + 0.841621, 1e-5, 'δ0 for α0 = 0.1 %, β0 = 80 %');
  const t = tInv(0.975, 9);
  close(tauCritical(0.05, 10), t * Math.sqrt(10) / Math.sqrt(9 + t * t), 1e-12, 'Pope τ_c');
  close(tauCritical(0.001, 5000), wCritical(0.001), 2e-3, 'τ_c → z for large r');
  assert.ok(Number.isNaN(tauCritical(0.05, 1)));
});

test('redundancy numbers: in [0, 1] and they add up to r (all observations, with and without injunções)', () => {
  const ds = simulateDataset({ seed: 3 });
  for (const cfg of [{}, { method: 'parametrico' }, { injunctions: { set: 'n4', type: 'relative' } }]) {
    const r = run(ds, cfg);
    close(r.res.redundancyObs.reduce((a, b) => a + b, 0), r.res.r, 1e-6, `Σr ${JSON.stringify(cfg)}`);
    for (const p of r.points.filter(q => q.role === 'control')) for (const o of p.obs) assert.ok(o.r > -1e-9 && o.r < 1 + 1e-9, `r ${o.r}`);
  }
});

test('the w of the slope distance is the w-test of a bias along the line of sight', () => {
  const r = run(simulateDataset({ seed: 6 }), {});
  const i = 4, st = r.res.pointStat[i], p = r.points.filter(q => q.role === 'control')[i];
  const s = Math.hypot(...p.tsObs), u = p.tsObs.map(v => v / s);
  const ug = u[0] * st.g[0] + u[1] * st.g[1] + u[2] * st.g[2];
  const uHu = u.reduce((a, ui, k) => a + ui * (st.H[k][0] * u[0] + st.H[k][1] * u[1] + st.H[k][2] * u[2]), 0);
  assert.equal(p.obs[2].key, 'S');
  close(p.obs[2].w, ug / Math.sqrt(uHu), 1e-9, 'w_S');
});

test('α of the configuration reaches the global test', () => {
  const r = run(simulateDataset({ seed: 2 }), { alpha: 0.01 });
  close(r.res.test.low, chi2Inv(0.005, r.res.r), 1e-6); close(r.res.test.high, chi2Inv(0.995, r.res.r), 1e-6);
});

test('blunders: S, Hz and Z are shifted by k σ and the coordinates follow', () => {
  const ds = simulateDataset({ seed: 5 }), name = ds.ts[7].name, t0 = ds.ts[7];
  const b = applyBlunders(ds, [{ name, obs: 'S', k: 10 }]).ts[7];
  close(b.polar.dist - t0.polar.dist, 10 * t0.polar.sigmas[2], 1e-12, 'ΔS = 10 σ_S');
  close(Math.hypot(...b.xyz) - Math.hypot(...t0.xyz), 10 * t0.polar.sigmas[2], 1e-9, 'moved along the line of sight');
  const h = applyBlunders(ds, [{ name, obs: 'Hz', k: -5 }]).ts[7];
  close((h.polar.hzDeg - t0.polar.hzDeg) * Math.PI / 180, -5 * t0.polar.sigmas[0], 1e-12, 'ΔHz');
  assert.equal(applyBlunders(ds, []), ds);
});

test('iterative data snooping finds a 20 σ distance blunder, and S is its worst observation', async () => {
  const base = simulateDataset({ seed: 14 });
  const ctrl = run(base, {}).points.filter(p => p.role === 'control').map(p => p.name);
  const name = ctrl[10];
  const ds = applyBlunders(base, [{ name, obs: 'S', k: 20 }]);
  const before = run(ds, {});
  const worst = before.points.filter(p => p.role === 'control').flatMap(p => p.obs.map(o => ({ name: p.name, key: o.key, w: Math.abs(o.w) }))).sort((a, b) => b.w - a.w)[0];
  assert.deepEqual([worst.name, worst.key], [name, 'S']);
  const d = await detectOutliers(ds, {}, 'snooping');
  assert.equal(d.history[0].name, name);
  assert.equal(d.comps[0].obs, 'S');
  assert.ok(d.flagged.length <= 2, `flagged ${d.flagged}`);
  const tau = await detectOutliers(ds, {}, 'tau'), ks = await detectOutliers(ds, {}, 'ksigma');
  assert.ok(tau.flagged.includes(name) && ks.flagged.includes(name));
});

test('ATV-AJ: RANSAC isolates the shifted block exactly; snooping removes the block first; τ is masked', async () => {
  const ds = atv('ATV-AJ.csv'), cfg = { checkPct: 0 };
  const r = await detectOutliers(ds, cfg, 'ransac');
  assert.deepEqual([...r.flagged].sort(), [...BLOCK].sort());
  const s = await detectOutliers(ds, cfg, 'snooping');
  assert.deepEqual(s.flagged.slice(0, BLOCK.length).sort(), [...BLOCK].sort(), `snooping order ${s.flagged}`);
  const tau = await detectOutliers(ds, cfg, 'tau');
  assert.ok(tau.flagged.filter(n => BLOCK.includes(n)).length < BLOCK.length, 'σ̂0 inflated by the block hides it');
  // after excluding the block the scale is the printer's again
  const clean = run(ds, { ...cfg, excluded: Object.fromEntries(BLOCK.map(n => [n, true])) });
  assert.ok(clean.params.deltaPpm > -4000 && clean.params.deltaPpm < -2500, `δλ ${clean.params.deltaPpm}`);
});

test('excluded points: out of the adjustment and of the plane, with their discrepancy reported', () => {
  const ds = atv('ATV-AJ_56.csv');
  const a = run(ds, {}), b = run(ds, { excluded: { B0: true } });
  assert.equal(b.roles.B0, 'excluded'); assert.equal(b.counts.excluded, 1);
  const p = b.points.find(q => q.name === 'B0');
  assert.equal(p.role, 'excluded'); assert.ok(Number.isFinite(p.chi2) && p.d.length === 3);
  assert.equal(b.checks.points.length, a.checks.points.length - (a.roles.B0 === 'check' ? 1 : 0), 'not a check point');
  assert.equal(b.plane.m, ds.ts.length - 1); assert.deepEqual(b.plane.others.map(o => o.name), ['B0']);
  const lean = adjust(ds, { excluded: { B0: true } });
  assert.ok(lean.ok && !lean.names.includes('B0'));
});

test('default sample ATV-AJ_56 with pointing σ = 0.4 mm passes the global test', () => {
  const r = run(atv('ATV-AJ_56.csv'), {});
  assert.ok(r.res.test.pass, `σ̂0² ${r.res.sigma0sq}`);
  assert.ok(r.plane.ok && r.plane.rms < r.plane.nominal, 'the EDM is better than its specification at 8 m');
});
