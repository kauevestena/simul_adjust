// Single entry point of the lab: run(dataset, config) → everything the pages display.
//
//   prepare   matching by name, roles, stochastic models, distance injunções
//   adjust    prepare + the adjustment + the tests of the raw observations (lean: used again
//             and again by the outlier detection)
//   run       the sheet plane + adjust + propagation to check, excluded, uncollected and
//             TS-only points
import { stream } from './rng.mjs';
import { UNITS, unitFactor } from './units.mjs';
import { eigSym, SingularError } from './linalg.mjs';
import { referenceCovariance, allPairs, selectPairs, independentPairs, distanceSigma } from './reference.mjs';
import { adjustTransformation, rotationCovariance } from './transform.mjs';
import { propagationContext, checkPoints, forwardMany, inverseTransform } from './propagate.mjs';
import { rotationDifference, allForms, horn } from './rotations.mjs';
import { describe } from './stats.mjs';
import { fitPlane, relateToPlane } from './plane.mjs';
import { observationTests } from './reliability.mjs';

export const OUTLIER_METHODS = ['snooping', 'tau', 'ksigma', 'ransac'];

export const DEFAULT_CONFIG = {
  method: 'combinado', rotation: 'euler', scaleMode: 'estimate', preConvert: false,
  outUnit: 'm',
  refSigma: { xyMm: 0.1, zMm: 0.1, ppmX: 0, ppmY: 0 },
  tsCovariance: 'full',
  checkPct: 20, checkSeed: 11, checkOverride: {},
  excluded: {},                                             // points left out of every adjustment
  injunctions: { set: 'none', randomPct: 10, seed: 3, type: 'relative', factor: 1 },
  constrainRotation: true, alpha: 0.05, varianceFactor: 'aposteriori',
  outliers: { method: 'snooping', alpha0: 0.001, power: 0.8, k: 3, ransacIters: 500, ransacK: 8, ransacSeed: 1 }
};

export const CONFIG_VERSION = 2;

const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') ? { ...base[k], ...v } : v;
  return out;
};
export const mergeConfig = over => merge(DEFAULT_CONFIG, over);

const tsCov = (c, diagonal) => c.map((row, i) => row.map((v, j) => (diagonal && i !== j ? 0 : v)));

function checkCollinear(pts) {
  const n = pts.length, c = [0, 1, 2].map(a => pts.reduce((s, p) => s + p[a], 0) / n);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  pts.forEach(p => { for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) S[r][q] += (p[r] - c[r]) * (p[q] - c[q]); });
  const { values } = eigSym(S);
  return !(values[1] > 1e-9 * Math.max(values[2], 1e-300));
}

// Which matched points are used in the adjustment and which are kept as check points. The draw
// is made over every matched point, so excluding one point does not reshuffle the others.
export function selectRoles(names, cfg) {
  const rng = stream(cfg.checkSeed, 'checks');
  const k = Math.min(names.length - 3, Math.round(names.length * cfg.checkPct / 100));
  const random = new Set(k > 0 ? rng.sample(names, k) : []);
  const roles = {};
  names.forEach(n => { roles[n] = random.has(n) ? 'check' : 'control'; });
  for (const [n, v] of Object.entries(cfg.checkOverride || {})) if (n in roles) roles[n] = v ? 'check' : 'control';
  for (const [n, v] of Object.entries(cfg.excluded || {})) if (v && n in roles) roles[n] = 'excluded';
  return roles;
}

// Matching, roles, stochastic models and injunções
export function prepare(dataset, cfgIn = {}) {
  const cfg = mergeConfig(cfgIn);
  const { refUnit, tsUnit } = dataset;
  const uf = unitFactor(refUnit, tsUnit);
  const rigid = cfg.scaleMode === 'rigid';
  const pre = (rigid || cfg.preConvert) ? uf : 1;
  const lambda0 = uf / pre;
  const diagonal = cfg.tsCovariance === 'diagonal';
  const base = { cfg, uf, pre, lambda0, rigid, diagonal, refUnit, tsUnit };

  const refIndex = new Map(dataset.ref.map((p, i) => [p.name, i]));
  const matched = [], tsOnly = [];
  dataset.ts.forEach(q => (refIndex.has(q.name) ? matched.push({ e: refIndex.get(q.name), ts: q }) : tsOnly.push(q)));
  matched.sort((a, b) => a.e - b.e);
  const matchedSet = new Set(matched.map(x => x.e));
  const uncollected = dataset.ref.map((p, i) => i).filter(i => !matchedSet.has(i));
  if (matched.length < 4) return { ...base, error: { code: 'fewPoints', count: matched.length } };

  const names = matched.map(x => dataset.ref[x.e].name);
  const roles = selectRoles(names, cfg);
  const role = x => roles[dataset.ref[x.e].name];
  const ctrl = matched.filter(x => role(x) === 'control');
  const chk = matched.filter(x => role(x) === 'check');
  const excl = matched.filter(x => role(x) === 'excluded');
  const counts = { matched: matched.length, control: ctrl.length, check: chk.length, excluded: excl.length, uncollected: uncollected.length, tsOnly: tsOnly.length };
  const out = { ...base, matched, tsOnly, uncollected, roles, ctrl, chk, excl, counts };
  if (ctrl.length < 3) return { ...out, error: { code: 'fewControl', count: ctrl.length } };
  const ctrlIdx = ctrl.map(x => x.e);
  const srcAll = dataset.ref.map(p => [p.x * pre, p.y * pre, p.z * pre]);
  if (checkCollinear(ctrl.map(x => srcAll[x.e]))) return { ...out, error: { code: 'collinear' } };

  // ---- stochastic model of the reference (declared), in the working unit
  const sigmaToRef = mm => mm * 1e-3 / UNITS[refUnit];
  const SigmaSref = referenceCovariance(dataset.ref, { sxy: sigmaToRef(cfg.refSigma.xyMm), sz: sigmaToRef(cfg.refSigma.zMm), ppmX: cfg.refSigma.ppmX, ppmY: cfg.refSigma.ppmY });
  const SigmaSfull = SigmaSref.map(r => r.map(v => v * pre * pre));
  const sub = idxs => {
    const k = 3 * idxs.length, o = Array.from({ length: k }, () => new Array(k).fill(0));
    idxs.forEach((a, i) => { for (let r = 0; r < 3; r++) { const src = SigmaSfull[3 * a + r], dst = o[3 * i + r]; idxs.forEach((b, j) => { for (let c = 0; c < 3; c++) dst[3 * j + c] = src[3 * b + c]; }); } });
    return o;
  };
  const SigmaS = sub(ctrlIdx);
  const SigmaT = ctrl.map(x => tsCov(x.ts.cov, diagonal));

  // ---- distance injunções among control points
  let inj = null, injInfo = { set: cfg.injunctions.set, pairs: 0, independent: 0, used: 0, type: cfg.injunctions.type };
  if (cfg.injunctions.set !== 'none') {
    const cpts = ctrl.map(x => ({ ...dataset.ref[x.e], x: srcAll[x.e][0], y: srcAll[x.e][1], z: srcAll[x.e][2] }));
    const all = allPairs(cpts);
    const chosen = selectPairs(all, cfg.injunctions.set, { pct: cfg.injunctions.randomPct, rng: stream(cfg.injunctions.seed, 'injunctions') });
    const ind = independentPairs(chosen, cpts);
    injInfo = { ...injInfo, pairs: chosen.length, independent: ind.rows.length };
    const rows = ind.rows.map(q => {
      const d = q.d / pre;                                         // nominal distance in the reference unit
      const sd = distanceSigma(cpts, q.i, q.j, SigmaS) / pre;      // propagated σ_d in the reference unit
      return { i: q.i, j: q.j, a: q.a, b: q.b, D: d * uf, sigma: Math.max(sd * uf * cfg.injunctions.factor, 1e-9 * d * uf), kind: q.kind };
    });
    if (rows.length) inj = { pairs: rows, type: cfg.injunctions.type };
    injInfo.used = rows.length;
    injInfo.rows = rows.map(r => ({ a: r.a, b: r.b, kind: r.kind, D: r.D, sigma: r.sigma }));
  }
  return { ...out, ctrlIdx, srcAll, SigmaSfull, SigmaS, SigmaT, inj, injInfo };
}

// prepare + adjustment + tests of the raw observations
export function adjust(dataset, cfgIn = {}) {
  const P = prepare(dataset, cfgIn), cfg = P.cfg;
  if (P.error) return { ok: false, error: P.error, cfg, prep: P };
  let res;
  try {
    res = adjustTransformation({
      method: cfg.method, rotation: cfg.rotation, estimateScale: !P.rigid, constrainRotation: cfg.constrainRotation,
      src: P.ctrlIdx.map(e => P.srcAll[e]), dst: P.ctrl.map(x => x.ts.xyz), SigmaT: P.SigmaT, SigmaS: P.SigmaS, lambda0: P.lambda0, injunctions: P.inj, alpha: cfg.alpha
    });
  } catch (err) {
    if (err instanceof SingularError || /singular|divergence/.test(err.message)) {
      const h = horn(P.ctrlIdx.map(e => P.srcAll[e]), P.ctrl.map(x => x.ts.xyz));
      return { ok: false, error: { code: 'singular', message: err.message, rotation: cfg.rotation, constrained: cfg.constrainRotation, scaleEstimated: !P.rigid, approx: { R: h.R, lambda: h.lambda, t: h.t } }, cfg, prep: P };
    }
    throw err;
  }
  const tests = observationTests(res, P.ctrl.map((x, i) => ({ ts: x.ts, cov: P.SigmaT[i] })), { tsUnit: P.tsUnit, diagonal: P.diagonal, alpha0: cfg.outliers.alpha0, power: cfg.outliers.power });
  return { ok: true, cfg, prep: P, res, tests, names: P.ctrl.map(x => dataset.ref[x.e].name) };
}

// The plane of the sheet from every active total-station point (matched or not)
export function sheetPlane(dataset, cfgIn = {}) {
  const cfg = mergeConfig(cfgIn), diagonal = cfg.tsCovariance === 'diagonal';
  const excluded = cfg.excluded || {};
  const item = q => ({ name: q.name, xyz: q.xyz, cov: tsCov(q.cov, diagonal) });
  const active = dataset.ts.filter(q => !excluded[q.name]).map(item);
  const plane = fitPlane(active, { alpha: cfg.alpha, alpha0: cfg.outliers.alpha0, power: cfg.outliers.power });
  if (plane.ok) plane.others = dataset.ts.filter(q => excluded[q.name]).map(q => relateToPlane(plane, item(q)));
  return plane;
}

export function run(dataset, cfgIn = {}) {
  const cfg = mergeConfig(cfgIn);
  const plane = sheetPlane(dataset, cfg);
  const A = adjust(dataset, cfg);
  if (!A.ok) return { ok: false, error: A.error, cfg, roles: A.prep.roles, injInfo: A.prep.injInfo, counts: A.prep.counts, plane, tsUnit: dataset.tsUnit, refUnit: dataset.refUnit };
  const { prep: P, res, tests } = A;
  const { pre, uf, lambda0, diagonal, ctrl, chk, excl, uncollected, tsOnly, ctrlIdx, srcAll, SigmaSfull } = P;
  const outFactor = unitFactor(dataset.tsUnit, cfg.outUnit);
  const s2 = cfg.varianceFactor === 'aposteriori' && res.sigma0sq > 0 ? res.sigma0sq : 1;

  // ---- propagation
  const ctx = propagationContext(res, SigmaSfull, ctrlIdx);
  const asItem = x => ({ xs: srcAll[x.e], e: x.e, xT: x.ts.xyz, SigmaT: tsCov(x.ts.cov, diagonal) });
  const checks = checkPoints(ctx, chk.map(asItem), cfg.alpha);
  const outside = checkPoints(ctx, excl.map(asItem), cfg.alpha);          // excluded: the size of the gross error
  const unc = forwardMany(ctx, uncollected.map(e => ({ xs: srcAll[e], e })));
  const inv = tsOnly.map(q => inverseTransform(ctx, q.xyz, tsCov(q.cov, diagonal)));

  const sd3 = S => [0, 1, 2].map(r => Math.sqrt(Math.max(S[r][r] * s2, 0)));
  const blk = (S, i) => [0, 1, 2].map(r => [0, 1, 2].map(c => S[3 * i + r][3 * i + c]));
  const m = res.m;
  const points = [];
  const sheetOf = x => {
    const inSheet = inverseTransform(ctx, x.ts.xyz, tsCov(x.ts.cov, diagonal));
    return { sheetObs: inSheet.xs.map(v => v / pre), sheetDiff: [0, 1, 2].map(r => (inSheet.xs[r] - srcAll[x.e][r]) / pre) };
  };
  ctrl.forEach((x, i) => {
    const ref = dataset.ref[x.e], st = res.pointStat[i];
    points.push({
      name: ref.name, role: 'control', e: x.e, tsObs: x.ts.xyz, tsAdj: [0, 1, 2].map(r => res.La[3 * i + r]),
      vT: [0, 1, 2].map(r => res.V[3 * i + r]), vS: res.comb ? [0, 1, 2].map(r => res.V[3 * m + 3 * i + r] / pre) : [0, 0, 0],
      stdT: [0, 1, 2].map(r => res.standardized[3 * i + r]), stdS: res.comb ? [0, 1, 2].map(r => res.standardized[3 * m + 3 * i + r]) : [NaN, NaN, NaN],
      T: st.T, redundancy: st.redundancy, rT: st.rT, rS: st.rS, kind: tests.points[i].kind, obs: tests.points[i].obs,
      ...sheetOf(x), blunder: x.ts.blunder
    });
  });
  const discrepancy = (role, list, stats) => list.forEach((x, i) => {
    const ref = dataset.ref[x.e], c = stats.points[i];
    points.push({
      name: ref.name, role, e: x.e, tsObs: x.ts.xyz, tsPred: c.d.map((d, r) => x.ts.xyz[r] - d),
      d: c.d, chi2: c.chi2, normal: c.normal, inPlane: c.inPlane, length: c.length, ...sheetOf(x), blunder: x.ts.blunder
    });
  });
  discrepancy('check', chk, checks);
  discrepancy('excluded', excl, outside);
  uncollected.forEach((e, i) => {
    points.push({ name: dataset.ref[e].name, role: 'uncollected', e, tsPred: unc.pred[i], sigma: sd3(blk(unc.Sig, i)), Sigma: blk(unc.Sig, i).map(r => r.map(v => v * s2)) });
  });
  tsOnly.forEach((q, i) => {
    points.push({ name: q.name, role: 'tsOnly', tsObs: q.xyz, sheet: inv[i].xs.map(v => v / pre), sheetSigma: sd3(inv[i].Sigma).map(v => v / pre),
      sheetSigmaMat: inv[i].Sigma, truth: dataset.truth?.extraSheet?.[q.name] ?? null, inactive: !!cfg.excluded?.[q.name], blunder: q.blunder });
  });

  const stdAll = res.standardized.filter(Number.isFinite);
  const SigmaEps = rotationCovariance(res.layout, res.X, res.SigmaXapriori).map(r => r.map(v => v * s2));
  const truthDiff = dataset.truth?.R ? rotationDifference(res.R, dataset.truth.R) : null;
  if (plane.ok) {
    const nz = res.R.map(r => r[2]);
    plane.normalAngleDeg = Math.acos(Math.min(1, Math.abs(nz[0] * plane.n[0] + nz[1] * plane.n[1] + nz[2] * plane.n[2]))) * 180 / Math.PI;
  }

  return {
    ok: true, cfg, warnings: [], res, s2, roles: P.roles, points, checks, injInfo: P.injInfo, uf, pre, lambda0, outFactor,
    tsUnit: dataset.tsUnit, refUnit: dataset.refUnit, refUnitM: UNITS[dataset.refUnit],
    counts: P.counts, tests, plane,
    params: {
      t: res.t, lambda: res.lambda, deltaPpm: res.deltaLambdaPpm, sigma: res.layout.labels.map((l, i) => ({ label: l, value: res.X[i], sd: Math.sqrt(Math.max(res.SigmaXapriori[i][i] * s2, 0)) })),
      forms: allForms(res.R), R: res.R, SigmaEps, epsSd: [0, 1, 2].map(i => Math.sqrt(Math.max(SigmaEps[i][i], 0))), truthDiff
    },
    histogram: { values: stdAll, summary: describe(stdAll) },
    ctx
  };
}
