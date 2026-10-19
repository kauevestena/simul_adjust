// Similarity transformation x_T = t + λ R(p) x_S between the reference sheet (S) and the total
// station frame (T), adjusted by the combined (Gauss–Helmert) or parametric (Gauss–Markov) model.
//
// Unknowns  X = [t (3), p (s), λ?]     p = rotation parameters, λ only when the scale is estimated
//
//   parametric   L = x_T of the control points,        F = f(X) − La_T                  (x_S constants)
//   combined     L = [x_T ; x_S] of the control points, F = La_T − t − λ R La_S          (both stochastic)
//
// Distance injunções between control points act on the adjusted TS coordinates:
//   absolute   h_ij(La_T) = |La_T,i − La_T,j| = D_ij  exactly (Lagrange / condition equations)
//   relative   D_ij is an observation with σ_D (pseudo-observation of the distance)
// In the parametric model the adjusted TS points are f(X), a scaled copy of the reference, so every
// absolute distance reduces to one injunção on λ (λ = λ0); in rigid mode they hold automatically.
import {
  zeros, matmul, matvec, invert, dot, eigSym, nullBasis, SingularError, symmetrize
} from './linalg.mjs';
import { solveGaussHelmert, cofactorK, residualVariances, sensitivity } from './lsq.mjs';
import { PARAMETRIZATIONS, horn, smallAngleColumn } from './rotations.mjs';
import { globalTest } from './stats.mjs';

export { SingularError };

// ---------------------------------------------------------------- parameter layout
export function makeLayout(rotation, estimateScale, lambdaFixed) {
  const P = PARAMETRIZATIONS[rotation], s = P.size;
  const lamIdx = estimateScale ? 3 + s : -1, u = 3 + s + (estimateScale ? 1 : 0);
  const unpack = X => ({
    t: X.slice(0, 3), p: X.slice(3, 3 + s),
    lambda: estimateScale ? X[lamIdx] : lambdaFixed
  });
  // t + λ R x
  const apply = (X, xs) => {
    const { t, p, lambda } = unpack(X), R = P.toMatrix(p);
    return [0, 1, 2].map(r => t[r] + lambda * (R[r][0] * xs[0] + R[r][1] * xs[1] + R[r][2] * xs[2]));
  };
  // ∂(t + λ R x)/∂X : 3 × u
  const pointJacobian = (X, xs) => {
    const { p, lambda } = unpack(X), R = P.toMatrix(p), dR = P.derivatives(p);
    const J = zeros(3, u);
    for (let r = 0; r < 3; r++) J[r][r] = 1;
    for (let k = 0; k < s; k++) for (let r = 0; r < 3; r++) J[r][3 + k] = lambda * (dR[k][r][0] * xs[0] + dR[k][r][1] * xs[1] + dR[k][r][2] * xs[2]);
    if (estimateScale) for (let r = 0; r < 3; r++) J[r][lamIdx] = R[r][0] * xs[0] + R[r][1] * xs[1] + R[r][2] * xs[2];
    return J;
  };
  const labels = ['t_x', 't_y', 't_z', ...P.symbols, ...(estimateScale ? ['λ'] : [])];
  return { rotation, P, s, u, lamIdx, estimateScale, lambdaFixed, unpack, apply, pointJacobian, labels };
}

// Small-rotation (ε) covariance of the rotation block of Σ_X, the same for every parametrization
export function rotationCovariance(layout, X, SigmaX) {
  const { p } = layout.unpack(X), R = layout.P.toMatrix(p), dR = layout.P.derivatives(p);
  const J = zeros(3, layout.u);
  for (let k = 0; k < layout.s; k++) {
    const c = smallAngleColumn(dR[k], R);
    for (let r = 0; r < 3; r++) J[r][3 + k] = c[r];
  }
  const JS = matmul(J, SigmaX);
  return symmetrize(matmul(JS, J[0].map((_, j) => J.map(row => row[j]))));
}

const hGradient = (La, i, j) => {
  const d = [La[3 * i] - La[3 * j], La[3 * i + 1] - La[3 * j + 1], La[3 * i + 2] - La[3 * j + 2]];
  const len = Math.hypot(...d) || 1e-300;
  return { len, g: d.map(v => v / len) };
};

// ---------------------------------------------------------------- the adjustment
// src, dst        control points: reference coordinates (already in the working unit) and TS coordinates
// SigmaT          array of 3×3 covariances of the TS points
// SigmaS          3m × 3m covariance of the reference points (used by the combined model only)
// lambda0         nominal scale (unit ratio, 1 when the reference was pre-converted)
// injunctions     { pairs: [{ i, j, D, sigma }], type: 'absolute' | 'relative' } with i, j control indices
export function adjustTransformation({
  method = 'combinado', rotation = 'euler', estimateScale = true, constrainRotation = true,
  src, dst, SigmaT, SigmaS, lambda0 = 1, injunctions = null, start = null, tol = 1e-11, maxIter = 40
}) {
  const m = src.length, P = PARAMETRIZATIONS[rotation];
  if (m < 3) throw new Error('fewer than 3 control points');
  const layout = makeLayout(rotation, estimateScale, lambda0);
  const { u, s } = layout, comb = method === 'combinado';
  const pairs = injunctions?.pairs ?? [], type = injunctions?.type ?? 'relative';
  const kInj = pairs.length;
  const relObs = type === 'relative' ? kInj : 0;
  const parametricAbsolute = !comb && type === 'absolute' && kInj > 0;

  // ---- initial values (Horn closed form, then converted to the chosen parametrization)
  const h = start ?? horn(src, dst);
  const lam0 = estimateScale ? h.lambda : lambda0;
  let t0 = h.t;
  if (!estimateScale) {
    const cs = [0, 1, 2].map(a => src.reduce((acc, p) => acc + p[a], 0) / m);
    const cd = [0, 1, 2].map(a => dst.reduce((acc, p) => acc + p[a], 0) / m);
    t0 = [0, 1, 2].map(r => cd[r] - lambda0 * (h.R[r][0] * cs[0] + h.R[r][1] * cs[1] + h.R[r][2] * cs[2]));
  }
  const X0 = [...t0, ...P.fromMatrix(h.R), ...(estimateScale ? [lam0] : [])];
  const scale = X0.map((_, i) => (i < 3 ? 1 : i === layout.lamIdx ? Math.abs(lambda0) : 1));

  // ---- observations and covariance blocks
  const n = (comb ? 6 * m : 3 * m) + relObs;
  const Lb = new Array(n).fill(0);
  dst.forEach((p, i) => { Lb[3 * i] = p[0]; Lb[3 * i + 1] = p[1]; Lb[3 * i + 2] = p[2]; });
  const blocks = SigmaT.map((S, i) => ({ start: 3 * i, S }));
  if (comb) {
    src.forEach((p, i) => { Lb[3 * m + 3 * i] = p[0]; Lb[3 * m + 3 * i + 1] = p[1]; Lb[3 * m + 3 * i + 2] = p[2]; });
    blocks.push({ start: 3 * m, S: SigmaS });
  }
  const dBase = comb ? 6 * m : 3 * m;
  if (relObs) pairs.forEach((q, r) => { Lb[dBase + r] = q.D; blocks.push({ start: dBase + r, S: [[q.sigma * q.sigma]] }); });
  const nEq = 3 * m + kInj * (parametricAbsolute ? 0 : 1);

  // ---- linearization
  const evaluate = (X, La) => {
    const { t, p, lambda } = layout.unpack(X), R = P.toMatrix(p), dR = P.derivatives(p);
    const F = new Array(nEq).fill(0), A = zeros(nEq, u), B = zeros(nEq, n);
    for (let i = 0; i < m; i++) {
      const xs = comb ? [La[3 * m + 3 * i], La[3 * m + 3 * i + 1], La[3 * m + 3 * i + 2]] : src[i];
      const Rx = [0, 1, 2].map(r => R[r][0] * xs[0] + R[r][1] * xs[1] + R[r][2] * xs[2]);
      for (let r = 0; r < 3; r++) {
        const row = 3 * i + r, sg = comb ? -1 : 1;           // combined: F = La_T − f ; parametric: F = f − La_T
        F[row] = sg * (t[r] + lambda * Rx[r]) + (comb ? La[row] : -La[row]);
        A[row][r] = sg;
        for (let k = 0; k < s; k++) A[row][3 + k] = sg * lambda * (dR[k][r][0] * xs[0] + dR[k][r][1] * xs[1] + dR[k][r][2] * xs[2]);
        if (estimateScale) A[row][layout.lamIdx] = sg * Rx[r];
        B[row][row] = comb ? 1 : -1;
        if (comb) for (let c = 0; c < 3; c++) B[row][3 * m + 3 * i + c] = -lambda * R[r][c];
      }
    }
    if (!parametricAbsolute) {
      pairs.forEach((q, r) => {
        const row = 3 * m + r, { len, g } = hGradient(La, q.i, q.j);
        F[row] = len - (relObs ? La[dBase + r] : q.D);
        for (let c = 0; c < 3; c++) { B[row][3 * q.i + c] = g[c]; B[row][3 * q.j + c] = -g[c]; }
        if (relObs) B[row][dBase + r] = -1;
      });
    }
    return { F, A, B };
  };

  // ---- injunções on the parameters: rotation orthonormality (+ λ = λ0 for absolute distances in the parametric model)
  const constraints = X => {
    const C = [], g = [];
    if (constrainRotation && P.nConstraints) {
      const { p } = layout.unpack(X), gj = P.constraintJacobian(p), gv = P.constraints(p);
      gj.forEach((row, r) => { C.push([0, 0, 0, ...row, ...(estimateScale ? [0] : [])]); g.push(gv[r]); });
    }
    if (parametricAbsolute && estimateScale) {
      const row = new Array(u).fill(0); row[layout.lamIdx] = 1 / Math.abs(lambda0 || 1);
      C.push(row); g.push((X[layout.lamIdx] - lambda0) / Math.abs(lambda0 || 1));
    }
    return { C, g };
  };

  const sol = solveGaussHelmert({ Lb, blocks, X0, evaluate, constraints, scale, tol, maxIter });
  const nC = sol.C.length;
  const r = nEq - u + nC;
  const un = layout.unpack(sol.X);
  const R = P.toMatrix(un.p);
  const SigmaXapriori = symmetrize(sol.Q11);
  const sigma0sq = r > 0 ? sol.Omega / r : NaN;
  const test = globalTest(sol.Omega, r, 0.05);

  // ---- cofactors of K and V, point statistics
  const QK = cofactorK(sol);
  const qv = residualVariances(sol, QK);
  const pointStat = [];
  for (let i = 0; i < m; i++) {
    const Ki = [sol.K[3 * i], sol.K[3 * i + 1], sol.K[3 * i + 2]];
    const Q = [0, 1, 2].map(a => [0, 1, 2].map(b => QK[3 * i + a][3 * i + b]));
    let T = NaN;
    try { T = dot(Ki, matvec(invert(Q, { relTol: 1e-9 }), Ki)); } catch { /* no redundancy at this point */ }
    pointStat.push({ T, redundancy: (Q[0][0] + Q[1][1] + Q[2][2]) });
  }
  // prior variance of every observation (diagonal of Σ) and standardized residuals v/σ_v;
  // observations with (numerically) no redundancy have no defined standardized residual
  const prior = new Array(n0(sol)).fill(0);
  sol.blocks.forEach(({ start, S }) => S.forEach((row, i) => { prior[start + i] = row[i]; }));
  const standardized = sol.V.map((v, i) => (qv[i] > 1e-9 * prior[i] ? v / Math.sqrt(qv[i]) : NaN));

  // reduced condition number of N on the null space of the constraints (comparable between parametrizations)
  let cond = NaN;
  try {
    const Z = nullBasis(sol.C, u);
    if (Z[0]?.length) {
      const NZ = matmul(matmul(Z[0].map((_, j) => Z.map(row => row[j])), sol.N), Z);
      const sc = NZ.map((row, i) => 1 / Math.sqrt(Math.max(row[i], 1e-300)));
      const eq = NZ.map((row, i) => row.map((v, j) => v * sc[i] * sc[j]));
      const { values } = eigSym(eq);
      cond = values[0] > 0 ? values[values.length - 1] / values[0] : Infinity;
    }
  } catch { /* leave NaN */ }

  const flags = [];
  const sing = P.singularity(un.p);
  if (rotation === 'euler' && sing.measure < 1e-2) flags.push({ code: 'gimbal', value: sing.measure });
  if (rotation === 'axisAngle' && sing.measure < 1e-3) flags.push({ code: 'axisUndefined', value: sing.measure });
  if (!constrainRotation && P.nConstraints) flags.push({ code: 'constraintsOff' });
  if (!sol.converged) flags.push({ code: 'notConverged', iterations: sol.iterations });
  if (Number.isFinite(cond) && cond > 1e10) flags.push({ code: 'illConditioned', value: cond });
  if (sol.gMax > 1e-8) flags.push({ code: 'constraintViolated', value: sol.gMax });

  return {
    method, rotation, estimateScale, layout, X: sol.X, t: un.t, p: un.p, lambda: un.lambda, R,
    lambda0, deltaLambdaPpm: (un.lambda / lambda0 - 1) * 1e6,
    SigmaXapriori, sigma0sq, SigmaX: SigmaXapriori.map(row => row.map(v => v * (sigma0sq > 0 ? sigma0sq : 1))),
    Omega: sol.Omega, r, nEq, nUnknown: u, nConstraints: nC, test, converged: sol.converged, iterations: sol.iterations, history: sol.history,
    V: sol.V, K: sol.K, La: sol.La, Lb, qv, standardized, pointStat, cond, flags, m, kInj, type, comb, parametricAbsolute,
    sol, sens: null
  };
}

const n0 = sol => sol.n;

// ∂X̂/∂Lb (computed on demand: it is only needed to propagate to points outside the adjustment)
export function estimatorSensitivity(res) {
  if (!res.sens) res.sens = sensitivity(res.sol);
  return res.sens;
}

