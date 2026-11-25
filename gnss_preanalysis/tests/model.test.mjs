import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, relativePrecision, externalEffect } from '../model/analysis.mjs';
import { emptyProject, makePoint, makeSession, makeBaseline, serialize, deserialize, validateProject, removePoint,
  removeSession, uniqueBaselineId } from '../model/network.mjs';
import { PRESETS, defaultSettings, nominalSigma, baselineCovariance, sessionCovariance, baselineGeometry,
  rotateEnuToXyz, rotateXyzToEnu, ibgeGuide, combine, validateSettings } from '../model/stochastic.mjs';
import { noncentrality } from '../../network_preanalysis/network/reliability.mjs';
import { buildExample, EXAMPLE_IDS } from '../model/examples.mjs';

const ref = JSON.parse(readFileSync(new URL('./numerical-reference.json', import.meta.url)));
const stations = JSON.parse(readFileSync(new URL('../data/rbmc-stations.json', import.meta.url))).stations;
const close = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);

function projectFromCase(c) {
  const p = emptyProject(), s = c.input.settings;
  Object.assign(p.settings, { preset: s.preset, ...PRESETS[s.preset], combination: s.combination, horizontal: s.horizontal,
    setupNew: { centering: s.setupNew[0], height: s.setupNew[1] }, setupCors: { centering: s.setupCors[0], height: s.setupCors[1] },
    sessionCorrelation: s.sessionCorrelation, trivial: s.trivial, statistics: { alpha: s.alpha, power: s.power } });
  delete p.settings.table;
  p.points = c.input.points.map(id => {
    const [lat, lon, h, kind] = ref.points[id], control = c.input.controls[id];
    return makePoint({ id, lat, lon, h, kind, hSource: kind === 'cors' ? 'cors' : 'manual',
      ...(control ? { control: 'stochastic', sigmaControl: control } : {}) });
  });
  p.sessions = c.input.sessions.map(([id], i) => makeSession(id, id, 600, i));
  for (const [sid, pairs] of c.input.sessions) for (const [a, b] of pairs) p.baselines.push(makeBaseline(a, b, sid));
  return p;
}

test('ENU → XYZ rotation reproduces the 5 km worked example (σ and correlations)', () => {
  const { lat, lon, enuMm: [e, v], xyz } = ref.example5km;
  const enu = [[(e * e + 2) * 1e-6, 0, 0], [0, (e * e + 2) * 1e-6, 0], [0, 0, (v * v + 8) * 1e-6]];
  const out = rotateEnuToXyz(enu, lat, lon);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(out[i][j], xyz[i][j], 1e-15, `Σ${i}${j}`);
  const s = [0, 1, 2].map(i => Math.sqrt(out[i][i]) * 1000);
  close(s[0], 6.60, 0.005, 'σX'); close(s[1], 6.87, 0.005, 'σY'); close(s[2], 6.16, 0.005, 'σZ');
  close(out[0][1] / Math.sqrt(out[0][0] * out[1][1]), -0.287, 0.001, 'ρXY');
  const back = rotateXyzToEnu(out, lat, lon);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(back[i][j], enu[i][j], 1e-18, 'round trip');
});

test('isotropic ENU covariance stays uncorrelated in XYZ', () => {
  const iso = [[1e-5, 0, 0], [0, 1e-5, 0], [0, 0, 1e-5]], out = rotateEnuToXyz(iso, -25, -49);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(out[i][j], iso[i][j], 1e-20, 'iso');
});

test('nominal precision: presets, linear/quadratic sum, 2D horizontal spec and IBGE table', () => {
  const s = defaultSettings();
  assert.deepEqual(nominalSigma(10, s), { aH: 3, aV: 5, sigmaH: 8, sigmaV: 10, E: 8, N: 8, U: 10 });
  close(nominalSigma(10, { ...s, combination: 'quadratic' }).E, Math.hypot(3, 5), 1e-12, 'quadratic');
  close(nominalSigma(10, { ...s, horizontal: 'radial' }).E, 8 / Math.SQRT2, 1e-12, 'radial');
  assert.equal(combine(3, 5, 'linear'), 8);
  const ibge = { ...s, preset: 'ibge2008', ...PRESETS.ibge2008 };
  assert.equal(nominalSigma(20, ibge).E, 30); assert.equal(nominalSigma(20.001, ibge).aH, 5);
  assert.deepEqual([3, 7, 15, 30, 80, 200].map(km => ibgeGuide(km).minMinutes), [5, 10, 10, 120, 180, 240]);
  assert.equal(ibgeGuide(20).singleFrequency, true); assert.equal(ibgeGuide(21).singleFrequency, false);
  assert.throws(() => validateSettings({ ...s, aH: 0, bH: 0 }), /invalidSigma/);
  assert.throws(() => validateSettings({ ...s, combination: 'cubic' }), /invalidSettings/);
});

test('setup errors enter both ends; forced-centering CORS adds none by default', () => {
  const s = defaultSettings();
  const a = makePoint({ id: 'A', lat: -25, lon: -49, h: 900, kind: 'cors' }), b = makePoint({ id: 'B', lat: -25.02, lon: -49, h: 900 });
  const c = baselineCovariance(a, b, s), km = c.geometry.km, n = nominalSigma(km, s);
  close(c.enu[0][0], ((n.E) ** 2 + 1) * 1e-6, 1e-18, 'E'); close(c.enu[2][2], ((n.U) ** 2 + 4) * 1e-6, 1e-18, 'U');
  b.setup = { centering: 3, height: 5 };
  close(baselineCovariance(a, b, s).enu[1][1], ((n.N) ** 2 + 9) * 1e-6, 1e-18, 'override');
});

test('session model keeps each baseline variance and gives ρ = 0.5 for equal radial lines', () => {
  const s = { ...defaultSettings(), bH: 0, bV: 0, setupNew: { centering: 0, height: 0 } };
  const base = makePoint({ id: 'B', lat: -25, lon: -49, h: 0, kind: 'cors' });
  const p = makePoint({ id: 'P', lat: -25.0001, lon: -49, h: 0 }), q = makePoint({ id: 'Q', lat: -25, lon: -49.0001, h: 0 });
  const items = [[base, p], [base, q]].map(([from, to]) => ({ from, to, geometry: baselineGeometry(from, to) }));
  const cov = sessionCovariance(items, s);
  for (let k = 0; k < 2; k++) {
    const ind = baselineCovariance(items[k].from, items[k].to, s, items[k].geometry).xyz;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(cov[3 * k + i][3 * k + j], ind[i][j], 1e-12, 'variance kept');
  }
  for (let i = 0; i < 3; i++) close(cov[i][3 + i] / Math.sqrt(cov[i][i] * cov[3 + i][3 + i]), 0.5, 1e-6, 'ρ');
  // Chained lines share the station with opposite signs: ρ = −0.5.
  const chain = [[p, base], [base, q]].map(([from, to]) => ({ from, to, geometry: baselineGeometry(from, to) }));
  const c2 = sessionCovariance(chain, s);
  close(c2[0][3] / Math.sqrt(c2[0][0] * c2[3][3]), -0.5, 1e-6, 'ρ chain');
});

test('network solutions match the independent NumPy/SciPy reference', () => {
  close(noncentrality(0.001, 0.8), ref.delta, 1e-9, 'δ0');
  for (const c of ref.cases) {
    const project = projectFromCase(c), r = analyze(project);
    assert.equal(r.rank, c.rank, `${c.name} rank`); assert.equal(r.dof, c.dof, `${c.name} dof`);
    assert.equal(r.parameters.length, c.unknowns, `${c.name} u`); assert.equal(r.rows.length, c.observations, `${c.name} n`);
    assert.equal(r.solvable, c.solvable, `${c.name} solvable`);
    const sum = r.rows.reduce((t, row) => t + row.redundancy, 0);
    close(sum, c.redundancySum, 1e-8, `${c.name} Σr`);
    for (const [id, p] of Object.entries(c.precision)) {
      const got = r.precision[id];
      got.sigma.forEach((x, i) => close(x, p.sigma[i], 1e-9 + 1e-7 * p.sigma[i], `${c.name} ${id} σ${i}`));
      close(got.ellipse.major, p.major, 1e-9, `${c.name} ${id} major`); close(got.ellipse.minor, p.minor, 1e-9, `${c.name} ${id} minor`);
      if (p.major - p.minor > 1e-6) {
        const d = Math.abs(got.ellipse.azimuth - p.azimuth);
        assert.ok(Math.min(d, Math.PI - d) < 1e-6, `${c.name} ${id} azimuth ${got.ellipse.azimuth} vs ${p.azimuth}`);
      }
      got.covXYZ.forEach((row, i) => row.forEach((x, j) => close(x, p.covXYZ[i][j], 1e-12, `${c.name} ${id} Σxx`)));
    }
    for (const b of c.baselines) {
      const info = r.baselines[b.id];
      assert.equal(info.trivial, b.trivial, `${c.name} ${b.id} trivial`);
      close(info.km, b.km, 1e-9, `${b.id} km`); close(info.redundancy, b.redundancy, 1e-8, `${c.name} ${b.id} r`);
      info.covENU.forEach((row, i) => close(Math.sqrt(row[i]), b.apriori[i], 1e-10, `${c.name} ${b.id} a priori σ${i}`));
      info.adjusted.sigma.forEach((x, i) => close(x, b.adjusted[i], 1e-10, `${c.name} ${b.id} adjusted σ${i}`));
      b.mdb.forEach((x, i) => x === null ? assert.equal(info.mdb[i], Infinity, `${b.id} undetectable`)
        : close(info.mdb[i], x, 1e-7 * x, `${c.name} ${b.id} MDB${i}`));
    }
  }
});

test('Cholesky fast path and SVD path give the same covariance, redundancy and MDB', () => {
  for (const c of ref.cases) {
    const project = projectFromCase(c), fast = analyze(project), slow = analyze(project, { forceSvd: true });
    assert.equal(slow.rank, fast.rank, c.name);
    fast.covariance.forEach((row, i) => row.forEach((x, j) => close(slow.covariance[i][j], x, 1e-12 + 1e-9 * Math.abs(x), `${c.name} Σ${i}${j}`)));
    fast.rows.forEach((row, i) => close(slow.rows[i].redundancy, row.redundancy, 1e-9, `${c.name} r${i}`));
    for (const [id, info] of Object.entries(fast.baselines)) info.mdb?.forEach((x, k) =>
      Number.isFinite(x) ? close(slow.baselines[id].mdb[k], x, 1e-6 * x, `${c.name} ${id} MDB`) : assert.equal(slow.baselines[id].mdb[k], Infinity));
  }
});

test('trivial baselines: flagged by default, excluded on request, and they make precision optimistic', () => {
  const flag = ref.cases.find(c => c.name === 'trivial-flag'), exclude = ref.cases.find(c => c.name === 'trivial-exclude');
  const rf = analyze(projectFromCase(flag)), rx = analyze(projectFromCase(exclude));
  assert.ok(rf.diagnostics.some(d => d.code === 'trivialBaselines' && d.count === 3));
  assert.ok(rx.diagnostics.some(d => d.code === 'trivialExcluded' && d.count === 3));
  assert.equal(rf.trivialCount, 3); assert.equal(rx.includedCount, 3); assert.equal(rx.dof, 0);
  assert.ok(rf.precision.P2.sigma[0] < rx.precision.P2.sigma[0] * 0.9, 'dependent baselines overstate precision');
});

test('datum: missing control, disconnected groups and isolated points are diagnosed', () => {
  const p = emptyProject();
  p.points = [makePoint({ id: 'A', lat: -25, lon: -49, h: 900 }), makePoint({ id: 'B', lat: -25.05, lon: -49, h: 900 }),
    makePoint({ id: 'C', lat: -25.1, lon: -49.1, h: 900 })];
  p.baselines = [makeBaseline('A', 'B', 'S1')];
  let r = analyze(p);
  assert.equal(r.solvable, false); assert.equal(r.defect, 3);
  assert.ok(r.diagnostics.some(d => d.code === 'datumMissing')); assert.ok(r.diagnostics.some(d => d.code === 'isolatedPoints'));
  p.points[0].kind = 'cors'; p.points[0].control = 'fixed';
  r = analyze(p);
  assert.equal(r.solvable, true); assert.equal(r.dof, 0);
  assert.ok(r.baselines['A-B@S1'].mdb.every(x => x === Infinity), 'a spur vector is uncontrolled');
  p.points.push(makePoint({ id: 'D', lat: -25.12, lon: -49.12, h: 900 }));
  p.baselines.push(makeBaseline('C', 'D', 'S1'));
  r = analyze(p);
  assert.ok(r.diagnostics.some(d => d.code === 'disconnected' && d.count === 2));
  assert.ok(r.diagnostics.some(d => d.code === 'datumMissing' && d.ids === 'C, D'));
  assert.equal(r.solvable, false);
  assert.equal(analyze(emptyProject()).diagnostics[0].code, 'noObservations');
});

test('IBGE observation-time guide, single-frequency limit and long-baseline note', () => {
  const c = ref.cases.find(x => x.name === 'long-ibge'), p = projectFromCase(c);
  p.sessions.forEach(s => { s.duration = 60; });
  p.settings.frequency = 'single'; p.settings.preset = 'static'; Object.assign(p.settings, PRESETS.static);
  const r = analyze(p);
  assert.ok(r.diagnostics.filter(d => d.code === 'sessionShort').length >= 2);
  assert.ok(r.diagnostics.some(d => d.code === 'singleFrequencyLong'));
  assert.ok(r.diagnostics.some(d => d.code === 'longBaselinePrecise'));
  assert.equal(r.baselines['UFPR-PG@S1'].guideMinutes, 240);
});

test('relative precision, external reliability and stochastic control behave consistently', () => {
  const c = ref.cases.find(x => x.name === 'network'), p = projectFromCase(c), r = analyze(p);
  const rel = relativePrecision(r, p, 'P1', 'P3');
  assert.ok(rel.sigma.every(x => x > 0));
  assert.equal(relativePrecision(r, p, 'UFPR', 'PRPI').sigma.every(x => x === 0), true, 'two fixed points');
  const effect = externalEffect(r, p, 'UFPR-P1@S1', 0);
  assert.ok(effect.mdb > 0 && Object.keys(effect.points).length === 4);
  assert.ok(Math.hypot(...effect.points.P1) > 0);
  const loose = projectFromCase(c);
  loose.points.find(x => x.id === 'PRPI').control = 'stochastic';
  loose.points.find(x => x.id === 'PRPI').sigmaControl = [1000, 1000, 1000];
  const rl = analyze(loose);
  assert.ok(rl.precision.P2.sigma[0] > r.precision.P2.sigma[0], 'weaker control, weaker points');
});

test('project JSON: round trip, validation, removals and limits', () => {
  const p = buildExample('network', stations);
  const back = deserialize(serialize(p));
  assert.deepEqual(back, p);
  assert.throws(() => deserialize('{'), /invalidProject/);
  assert.throws(() => deserialize(JSON.stringify({ ...p, version: 2 })), /invalidProject/);
  const bad = structuredClone(p); bad.baselines.push(makeBaseline('P1', 'P1', 'S1'));
  assert.throws(() => validateProject(bad), /invalidBaseline/);
  const missingSession = structuredClone(p); missingSession.baselines[0].session = 'S9';
  assert.throws(() => validateProject(missingSession), /invalidBaseline/);
  const nan = structuredClone(p); nan.points[2].lat = NaN;
  assert.throws(() => validateProject(nan), /invalidPoint/);
  const q = structuredClone(p); removePoint(q, 'P1');
  assert.ok(!q.baselines.some(b => b.from === 'P1' || b.to === 'P1'));
  removeSession(q, 'S1'); assert.ok(!q.baselines.some(b => b.session === 'S1'));
  const one = emptyProject(); assert.throws(() => removeSession(one, 'S1'), /lastSession/);
  assert.equal(uniqueBaselineId(p, 'UFPR', 'P1', 'S1'), 'UFPR-P1@S1#2');
});

test('didactic examples are valid and behave as described', () => {
  for (const id of EXAMPLE_IDS) validateProject(buildExample(id, stations));
  const radial = analyze(buildExample('radial', stations));
  assert.equal(radial.dof, 0); assert.ok(radial.minimumRedundancy < 1e-9);
  const network = analyze(buildExample('network', stations));
  assert.equal(network.solvable, true); assert.equal(network.dof, 12);
  assert.ok(network.diagnostics.some(d => d.code === 'heightAssumed'), 'pending DEM heights are reported');
  const trivial = analyze(buildExample('trivial', stations));
  assert.equal(trivial.trivialCount, 3);
  const long = analyze(buildExample('long', stations));
  assert.ok(long.diagnostics.some(d => d.code === 'sessionShort'));
});
