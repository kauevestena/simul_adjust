// Single entry point of the lab: run(dataset, config) → everything the pages display.
import { stream } from './rng.mjs';
import { UNITS, unitFactor } from './units.mjs';
import { eigSym, SingularError } from './linalg.mjs';
import { referenceCovariance, allPairs, selectPairs, independentPairs, distanceSigma } from './reference.mjs';
import { adjustTransformation, rotationCovariance } from './transform.mjs';
import { propagationContext, checkPoints, forwardMany, inverseTransform } from './propagate.mjs';
import { rotationDifference, allForms, horn } from './rotations.mjs';
import { describe } from './stats.mjs';

export const DEFAULT_CONFIG = {
  method: 'combinado', rotation: 'euler', scaleMode: 'estimate', preConvert: false,
  outUnit: 'm',
  refSigma: { xyMm: 0.1, zMm: 0.1, ppmX: 0, ppmY: 0 },
  tsCovariance: 'full',
  checkPct: 20, checkSeed: 11, checkOverride: {},
  injunctions: { set: 'none', randomPct: 10, seed: 3, type: 'relative', factor: 1 },
  constrainRotation: true, alpha: 0.05, varianceFactor: 'aposteriori'
};

export const CONFIG_VERSION = 1;

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

// Which matched points are used in the adjustment and which are kept as check points
export function selectRoles(names, cfg) {
  const rng = stream(cfg.checkSeed, 'checks');
  const k = Math.min(names.length - 3, Math.round(names.length * cfg.checkPct / 100));
  const random = new Set(k > 0 ? rng.sample(names, k) : []);
  const roles = {};
  names.forEach(n => { roles[n] = random.has(n) ? 'check' : 'control'; });
  for (const [n, v] of Object.entries(cfg.checkOverride || {})) if (n in roles) roles[n] = v ? 'check' : 'control';
  return roles;
}

export function run(dataset, cfgIn = {}) {
  const cfg = mergeConfig(cfgIn);
  const warnings = [];
  const { refUnit, tsUnit } = dataset;
  const uf = unitFactor(refUnit, tsUnit);
  const rigid = cfg.scaleMode === 'rigid';
  const pre = (rigid || cfg.preConvert) ? uf : 1;
  const lambda0 = uf / pre;
  const outFactor = unitFactor(tsUnit, cfg.outUnit);

  // ---- matching by name
  const refIndex = new Map(dataset.ref.map((p, i) => [p.name, i]));
  const matched = [], tsOnly = [];
  dataset.ts.forEach(q => (refIndex.has(q.name) ? matched.push({ e: refIndex.get(q.name), ts: q }) : tsOnly.push(q)));
  matched.sort((a, b) => a.e - b.e);
  const matchedSet = new Set(matched.map(x => x.e));
  const uncollected = dataset.ref.map((p, i) => i).filter(i => !matchedSet.has(i));
  if (matched.length < 4) return { ok: false, error: { code: 'fewPoints', count: matched.length }, cfg };

  // ---- roles
  const names = matched.map(x => dataset.ref[x.e].name);
  const roles = selectRoles(names, cfg);
  const ctrl = matched.filter(x => roles[dataset.ref[x.e].name] === 'control');
  const chk = matched.filter(x => roles[dataset.ref[x.e].name] === 'check');
  if (ctrl.length < 3) return { ok: false, error: { code: 'fewControl', count: ctrl.length }, cfg };
  const ctrlIdx = ctrl.map(x => x.e);
  const srcAll = dataset.ref.map(p => [p.x * pre, p.y * pre, p.z * pre]);
  if (checkCollinear(ctrl.map(x => srcAll[x.e]))) return { ok: false, error: { code: 'collinear' }, cfg };

  // ---- stochastic model of the reference (declared), in the working unit
  const sigmaToRef = mm => mm * 1e-3 / UNITS[refUnit];
  const SigmaSref = referenceCovariance(dataset.ref, { sxy: sigmaToRef(cfg.refSigma.xyMm), sz: sigmaToRef(cfg.refSigma.zMm), ppmX: cfg.refSigma.ppmX, ppmY: cfg.refSigma.ppmY });
  const SigmaSfull = SigmaSref.map(r => r.map(v => v * pre * pre));
  const sub = idxs => idxs.flatMap(a => [0, 1, 2].map(r => idxs.flatMap(b => [0, 1, 2].map(c => SigmaSfull[3 * a + r][3 * b + c]))));
  const SigmaS = sub(ctrlIdx);
  const diagonal = cfg.tsCovariance === 'diagonal';
  const SigmaT = ctrl.map(x => tsCov(x.ts.cov, diagonal));

  // ---- distance injunções among control points
  let inj = null, injInfo = { set: cfg.injunctions.set, pairs: 0, independent: 0, used: 0, type: cfg.injunctions.type };
  if (cfg.injunctions.set !== 'none') {
    const cpts = ctrl.map(x => ({ ...dataset.ref[x.e], x: srcAll[x.e][0], y: srcAll[x.e][1], z: srcAll[x.e][2] }));
    const all = allPairs(cpts);
    const chosen = selectPairs(all, cfg.injunctions.set, { pct: cfg.injunctions.randomPct, rng: stream(cfg.injunctions.seed, 'injunctions') });
    const ind = independentPairs(chosen, cpts);
    injInfo = { ...injInfo, pairs: chosen.length, independent: ind.rows.length };
    const SigCtrl = SigmaS;
    const rows = ind.rows.map(q => {
      const d = q.d / pre;                                         // nominal distance in the reference unit
      const sd = distanceSigma(cpts, q.i, q.j, SigCtrl) / pre;     // propagated σ_d in the reference unit
      return { i: q.i, j: q.j, a: q.a, b: q.b, D: d * uf, sigma: Math.max(sd * uf * cfg.injunctions.factor, 1e-9 * d * uf), kind: q.kind };
    });
    if (rows.length) inj = { pairs: rows, type: cfg.injunctions.type };
    injInfo.used = rows.length;
    injInfo.rows = rows.map(r => ({ a: r.a, b: r.b, kind: r.kind, D: r.D, sigma: r.sigma }));
  }

  // ---- adjustment
  let res;
  try {
    res = adjustTransformation({
      method: cfg.method, rotation: cfg.rotation, estimateScale: !rigid, constrainRotation: cfg.constrainRotation,
      src: ctrlIdx.map(e => srcAll[e]), dst: ctrl.map(x => x.ts.xyz), SigmaT, SigmaS, lambda0, injunctions: inj
    });
  } catch (err) {
    if (err instanceof SingularError || /singular|divergence/.test(err.message)) {
      const h = horn(ctrlIdx.map(e => srcAll[e]), ctrl.map(x => x.ts.xyz));
      return { ok: false, error: { code: 'singular', message: err.message, rotation: cfg.rotation, constrained: cfg.constrainRotation, scaleEstimated: !rigid, approx: { R: h.R, lambda: h.lambda, t: h.t } }, cfg, roles, injInfo };
    }
    throw err;
  }
  const s2 = cfg.varianceFactor === 'aposteriori' && res.sigma0sq > 0 ? res.sigma0sq : 1;

  // ---- propagation
  const ctx = propagationContext(res, SigmaSfull, ctrlIdx);
  const chkItems = chk.map(x => ({ xs: srcAll[x.e], e: x.e, xT: x.ts.xyz, SigmaT: tsCov(x.ts.cov, diagonal) }));
  const checks = checkPoints(ctx, chkItems, cfg.alpha);
  const unc = forwardMany(ctx, uncollected.map(e => ({ xs: srcAll[e], e })));
  const inv = tsOnly.map(q => inverseTransform(ctx, q.xyz, tsCov(q.cov, diagonal)));

  const sd3 = S => [0, 1, 2].map(r => Math.sqrt(Math.max(S[r][r] * s2, 0)));
  const blk = (S, i) => [0, 1, 2].map(r => [0, 1, 2].map(c => S[3 * i + r][3 * i + c]));
  const m = res.m;
  const points = [];
  ctrl.forEach((x, i) => {
    const ref = dataset.ref[x.e];
    const vT = [0, 1, 2].map(r => res.V[3 * i + r]);
    const inSheet = inverseTransform(ctx, x.ts.xyz, tsCov(x.ts.cov, diagonal));
    points.push({
      name: ref.name, role: 'control', e: x.e, tsObs: x.ts.xyz, tsAdj: [0, 1, 2].map(r => res.La[3 * i + r]),
      vT, vS: res.comb ? [0, 1, 2].map(r => res.V[3 * m + 3 * i + r] / pre) : [0, 0, 0],
      stdT: [0, 1, 2].map(r => res.standardized[3 * i + r]), stdS: res.comb ? [0, 1, 2].map(r => res.standardized[3 * m + 3 * i + r]) : [NaN, NaN, NaN],
      T: res.pointStat[i].T, redundancy: res.pointStat[i].redundancy,
      sheetObs: inSheet.xs.map(v => v / pre), sheetDiff: [0, 1, 2].map(r => (inSheet.xs[r] - srcAll[x.e][r]) / pre)
    });
  });
  chk.forEach((x, i) => {
    const ref = dataset.ref[x.e], c = checks.points[i];
    const inSheet = inverseTransform(ctx, x.ts.xyz, tsCov(x.ts.cov, diagonal));
    points.push({
      name: ref.name, role: 'check', e: x.e, tsObs: x.ts.xyz, tsPred: checks.points[i].d.map((d, r) => x.ts.xyz[r] - d),
      d: c.d, chi2: c.chi2, normal: c.normal, inPlane: c.inPlane, length: c.length,
      sheetObs: inSheet.xs.map(v => v / pre), sheetDiff: [0, 1, 2].map(r => (inSheet.xs[r] - srcAll[x.e][r]) / pre)
    });
  });
  uncollected.forEach((e, i) => {
    points.push({ name: dataset.ref[e].name, role: 'uncollected', e, tsPred: unc.pred[i], sigma: sd3(blk(unc.Sig, i)), Sigma: blk(unc.Sig, i).map(r => r.map(v => v * s2)) });
  });
  tsOnly.forEach((q, i) => {
    points.push({ name: q.name, role: 'tsOnly', tsObs: q.xyz, sheet: inv[i].xs.map(v => v / pre), sheetSigma: sd3(inv[i].Sigma).map(v => v / pre),
      sheetSigmaMat: inv[i].Sigma, truth: dataset.truth?.extraSheet?.[q.name] ?? null });
  });

  const stdAll = res.standardized.filter(Number.isFinite);
  const SigmaEps = rotationCovariance(res.layout, res.X, res.SigmaXapriori).map(r => r.map(v => v * s2));
  const truthDiff = dataset.truth?.R ? rotationDifference(res.R, dataset.truth.R) : null;

  return {
    ok: true, cfg, warnings, res, s2, roles, points, checks, injInfo, uf, pre, lambda0, outFactor, tsUnit, refUnit, refUnitM: UNITS[refUnit],
    counts: { matched: matched.length, control: ctrl.length, check: chk.length, uncollected: uncollected.length, tsOnly: tsOnly.length },
    params: {
      t: res.t, lambda: res.lambda, deltaPpm: res.deltaLambdaPpm, sigma: res.layout.labels.map((l, i) => ({ label: l, value: res.X[i], sd: Math.sqrt(Math.max(res.SigmaXapriori[i][i] * s2, 0)) })),
      forms: allForms(res.R), R: res.R, SigmaEps, epsSd: [0, 1, 2].map(i => Math.sqrt(Math.max(SigmaEps[i][i], 0))), truthDiff
    },
    histogram: { values: stdAll, summary: describe(stdAll) },
    ctx
  };
}

