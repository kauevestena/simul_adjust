// Detection of gross errors among the control points (the points used in the adjustment).
// Every method tests the raw observations (Hz, Z, S) of each point and flags the whole point,
// as in intersecao_re_3D:
//
//   snooping  iterative data snooping (Baarda): adjust, remove the point with the largest
//             |w| above z(1 − α0/2), adjust again … until no |w| exceeds it. σ0 is known a priori.
//   tau       Pope's τ test, in one pass: |τ| = |w| / σ̂0 above τ_c(α0, r). σ0 is estimated.
//   ksigma    the a-priori kσ rule on the raw residuals: |v| / σ > k.
//   ransac    RANSAC: Horn's closed form on minimal samples of 3 control points; a point agrees
//             with a sample when the Mahalanobis length of its discrepancy is below k_R; the
//             largest consensus is re-adjusted and each point outside it is flagged when its
//             discrepancy fails the χ²(3) test at α0.
//
// The detectors never change the configuration: they return the names to flag.
import { prepare, adjust, run, mergeConfig } from './pipeline.mjs';
import { horn } from './rotations.mjs';
import { stream } from './rng.mjs';
import { invert, SingularError } from './linalg.mjs';
import { chi2Inv } from './stats.mjs';
import { worstObservation } from './reliability.mjs';

const MIN_CONTROL = 4;

export async function detectOutliers(dataset, cfgIn, method, { tick = null } = {}) {
  const cfg = mergeConfig(cfgIn);
  if (method === 'snooping') return snooping(dataset, cfg, tick);
  if (method === 'tau') return onePass(dataset, cfg, 'tau');
  if (method === 'ksigma') return onePass(dataset, cfg, 'ksigma');
  if (method === 'ransac') return ransac(dataset, cfg, tick);
  throw new Error(`unknown outlier method ${method}`);
}

async function snooping(dataset, cfg, tick) {
  const excluded = { ...cfg.excluded };
  const flagged = [], comps = [], history = [];
  let crit = NaN, stop = 'none';
  for (let round = 1; round <= dataset.ts.length; round++) {
    const A = adjust(dataset, { ...cfg, excluded });
    if (!A.ok) {
      // the last removal made the system unsolvable: that point is essential, keep it
      const last = flagged.pop(); comps.pop();
      if (last) history[history.length - 1].essential = true;
      stop = 'essential';
      break;
    }
    crit = A.tests.crit.w;
    const worst = worstObservation(A.tests, A.names, 'w');
    const row = { round, sigma0sq: A.res.sigma0sq, r: A.res.r, crit };
    if (!worst || !(worst.abs > crit)) { history.push({ ...row, stop: 'none' }); break; }
    if (A.prep.ctrl.length - 1 < MIN_CONTROL) { history.push({ ...row, name: worst.name, obs: worst.key, w: worst.value, stop: 'minPoints' }); stop = 'minPoints'; break; }
    flagged.push(worst.name);
    comps.push({ name: worst.name, obs: worst.key, value: worst.value, crit });
    history.push({ ...row, name: worst.name, obs: worst.key, w: worst.value });
    excluded[worst.name] = true;
    if (tick) await tick({ round, name: worst.name });
  }
  return { method: 'snooping', flagged, comps, history, detail: { crit, alpha0: cfg.outliers.alpha0, stop, rounds: history.length } };
}

function onePass(dataset, cfg, method) {
  const A = adjust(dataset, cfg);
  if (!A.ok) return { method, flagged: [], comps: [], history: [], detail: { error: A.error.code } };
  const { crit } = A.tests, k = cfg.outliers.k;
  const limit = method === 'tau' ? crit.tau : k;
  const comps = [];
  A.tests.points.forEach((p, i) => p.obs.forEach(o => {
    const value = method === 'tau' ? o.tau : o.v / o.sigma;
    if (Number.isFinite(value) && Math.abs(value) > limit) comps.push({ name: A.names[i], obs: o.key, value, crit: limit });
  }));
  const flagged = [...new Set(comps.map(c => c.name))];
  return { method, flagged, comps, history: [], detail: { crit: limit, alpha0: cfg.outliers.alpha0, sigma0sq: A.res.sigma0sq, r: A.res.r, k } };
}

// d = x_T − (t + λ R x_S) and its Mahalanobis length with M = Σ_T + λ² R Σ_S Rᵀ
function mahalanobis(h, lambda, item, comb) {
  const { xs, xt, SigmaT, SigmaS } = item, R = h.R;
  const d = [0, 1, 2].map(r => xt[r] - (h.t[r] + lambda * (R[r][0] * xs[0] + R[r][1] * xs[1] + R[r][2] * xs[2])));
  let M = SigmaT;
  if (comb) {
    const RS = R.map(row => [0, 1, 2].map(c => row[0] * SigmaS[0][c] + row[1] * SigmaS[1][c] + row[2] * SigmaS[2][c]));
    M = SigmaT.map((row, a) => row.map((v, b) => v + lambda * lambda * (RS[a][0] * R[b][0] + RS[a][1] * R[b][1] + RS[a][2] * R[b][2])));
  }
  let Mi;
  try { Mi = invert(M); } catch (e) { if (e instanceof SingularError) return Infinity; throw e; }
  let s = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += d[a] * Mi[a][b] * d[b];
  return Math.sqrt(Math.max(s, 0));
}

async function ransac(dataset, cfg, tick) {
  const P = prepare(dataset, cfg);
  const o = cfg.outliers;
  if (!P.ctrl || P.ctrl.length < MIN_CONTROL) return { method: 'ransac', flagged: [], comps: [], history: [], detail: { error: 'fewControl' } };
  const comb = cfg.method === 'combinado';
  const items = P.ctrl.map((x, i) => ({
    name: dataset.ref[x.e].name, xs: P.srcAll[x.e], xt: x.ts.xyz, SigmaT: P.SigmaT[i],
    SigmaS: [0, 1, 2].map(r => [0, 1, 2].map(c => P.SigmaS[3 * i + r][3 * i + c]))
  }));
  const rng = stream(o.ransacSeed, 'ransac'), idx = items.map((_, i) => i);
  let best = null, valid = 0;
  for (let it = 0; it < o.ransacIters; it++) {
    const s = rng.sample(idx, 3).map(i => items[i]);
    // a non-degenerate sample: the three reference points span a triangle
    const u = [0, 1, 2].map(r => s[1].xs[r] - s[0].xs[r]), v = [0, 1, 2].map(r => s[2].xs[r] - s[0].xs[r]);
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    if (!(area > 1e-9 * (u[0] * u[0] + u[1] * u[1] + u[2] * u[2] + 1e-300))) continue;
    const h = horn(s.map(q => q.xs), s.map(q => q.xt));
    let lambda = h.lambda;
    if (P.rigid) {                                           // rigid motion: λ is the nominal scale
      lambda = P.lambda0;
      const cs = [0, 1, 2].map(a => s.reduce((acc, q) => acc + q.xs[a], 0) / 3), cd = [0, 1, 2].map(a => s.reduce((acc, q) => acc + q.xt[a], 0) / 3);
      h.t = [0, 1, 2].map(r => cd[r] - lambda * (h.R[r][0] * cs[0] + h.R[r][1] * cs[1] + h.R[r][2] * cs[2]));
    }
    if (!Number.isFinite(lambda)) continue;
    valid++;
    let count = 0, cost = 0;
    const inl = items.map(q => { const mq = mahalanobis(h, lambda, q, comb); const ok = mq < o.ransacK; if (ok) { count++; cost += mq * mq; } return ok; });
    if (!best || count > best.count || (count === best.count && cost < best.cost)) best = { count, cost, inl };
    if (tick && it % 100 === 99) await tick({ iteration: it + 1, consensus: best.count });
  }
  if (!best) return { method: 'ransac', flagged: [], comps: [], history: [], detail: { error: 'noSample' } };

  // re-adjust with the consensus; the points outside it are flagged if their discrepancy fails χ²(3)
  const outside = items.filter((_, i) => !best.inl[i]).map(q => q.name);
  const crit = chi2Inv(1 - o.alpha0, 3);
  const comps = [];
  let refit = null;
  if (outside.length) {
    refit = run(dataset, { ...cfg, excluded: { ...cfg.excluded, ...Object.fromEntries(outside.map(n => [n, true])) } });
    if (refit.ok) for (const p of refit.points) if (p.role === 'excluded' && outside.includes(p.name) && p.chi2 > crit) comps.push({ name: p.name, obs: 'χ²(3)', value: p.chi2, crit });
  }
  return {
    method: 'ransac', flagged: comps.map(c => c.name), comps, history: [],
    detail: { consensus: best.count, total: items.length, iterations: o.ransacIters, valid, k: o.ransacK, crit, alpha0: o.alpha0, outside, sigma0sq: refit?.ok ? refit.res.sigma0sq : NaN }
  };
}
