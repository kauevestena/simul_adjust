// Propagation of the adjusted transformation to points that were not (or not all) in the adjustment.
//
//  • forward  x_T = t + λ R x_S  for reference points: check points and points not collected;
//  • inverse  x_S = λ⁻¹ Rᵀ (x_T − t)  for total-station points without a reference counterpart.
//
// All covariances here are a priori (σ0 = 1); the caller scales them by σ̂0² for display.
// The reference is exact in the parametric model, so Σ_S enters only in the combined model,
// where it also correlates the prediction with the estimate through the dense Σ_S
// (printer scale error): Cov(X̂, e_S) = (∂X̂/∂L_S) Σ_S[control, point].
import { matmul, transpose, zeros, invert, dot, matvec } from './linalg.mjs';
import { estimatorSensitivity } from './transform.mjs';
import { chi2Inv } from './stats.mjs';

const sub3 = (S, a, b) => [0, 1, 2].map(r => [0, 1, 2].map(c => S[3 * a + r][3 * b + c]));
const scaleM = (A, s) => A.map(r => r.map(v => v * s));

// Context shared by all propagated points of one adjustment
//   SigmaSfull : covariance of ALL reference points in the working unit (3n × 3n)
//   ctrlIdx    : index, in the full reference list, of every control point (adjustment order)
export function propagationContext(res, SigmaSfull, ctrlIdx) {
  const { layout, X, SigmaXapriori, comb, m } = res;
  const { p, lambda } = layout.unpack(X), R = layout.P.toMatrix(p);
  const lamR = scaleM(R, lambda);
  let H = null;                                              // ∂X̂/∂L_S  (u × 3m), combined model only
  if (comb) {
    const S = estimatorSensitivity(res);
    H = S.map(row => row.slice(3 * m, 6 * m));
  }
  return { res, layout, X, R, lambda, lamR, SigmaX: SigmaXapriori, H, SigmaSfull, ctrlIdx, comb, m };
}

// Σ_S[control, e]: 3m × 3 cross-covariance of the control reference errors with point e
function crossToControl(ctx, e) {
  const { SigmaSfull, ctrlIdx } = ctx, out = zeros(3 * ctrlIdx.length, 3);
  ctrlIdx.forEach((c, k) => { for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) out[3 * k + r][q] = SigmaSfull[3 * c + r][3 * e + q]; });
  return out;
}

// Predicted TS position of reference points (full-list indices) and the joint covariance of the
// prediction errors (3k × 3k, a priori).
export function forwardMany(ctx, items) {
  const k = items.length, { layout, X, lamR, SigmaX, H, comb } = ctx;
  const J = items.map(it => layout.pointJacobian(X, it.xs));
  const pred = items.map(it => layout.apply(X, it.xs));
  const CovXe = comb ? items.map(it => matmul(H, crossToControl(ctx, it.e))) : null;   // u × 3
  const Sig = zeros(3 * k, 3 * k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    let B = matmul(matmul(J[i], SigmaX), transpose(J[j]));
    if (comb) {
      const a = matmul(matmul(J[i], CovXe[j]), transpose(lamR));
      const b = matmul(matmul(lamR, transpose(CovXe[i])), transpose(J[j]));
      const c = matmul(matmul(lamR, sub3(ctx.SigmaSfull, items[i].e, items[j].e)), transpose(lamR));
      B = B.map((row, r) => row.map((v, q) => v + a[r][q] + b[r][q] + c[r][q]));
    }
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) Sig[3 * i + r][3 * j + q] = B[r][q];
  }
  return { pred, Sig };
}

// Check points: d = x_T − f(X̂, x_S). Returns per-point and joint statistics.
// items: [{ xs (working unit), e (index in the full reference list), xT, SigmaT (3×3) }]
export function checkPoints(ctx, items, alpha = 0.05) {
  const k = items.length;
  if (!k) return { points: [], joint: null, rms: null };
  const { pred, Sig } = forwardMany(ctx, items);
  const d = items.map((it, i) => [0, 1, 2].map(r => it.xT[r] - pred[i][r]));
  const SigD = Sig.map(r => r.slice());
  items.forEach((it, i) => { for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) SigD[3 * i + r][3 * i + q] += it.SigmaT[r][q]; });
  const n = ctx.R.map(r => r[2]);                            // sheet normal in the TS frame (third column of R)
  const points = items.map((it, i) => {
    const Si = [0, 1, 2].map(r => [0, 1, 2].map(c => SigD[3 * i + r][3 * i + c]));
    let chi2 = NaN;
    try { chi2 = dot(d[i], matvec(invert(Si, { relTol: 1e-12 }), d[i])); } catch { /* singular */ }
    const dn = dot(d[i], n), inPlane = d[i].map((v, r) => v - dn * n[r]);
    return { d: d[i], chi2, normal: dn, inPlane: Math.hypot(...inPlane), length: Math.hypot(...d[i]), sigma: [0, 1, 2].map(r => Math.sqrt(Math.max(Si[r][r], 0))) };
  });
  const flat = d.flat();
  let joint = null;
  try {
    const chi2 = dot(flat, matvec(invert(SigD, { relTol: 1e-13 }), flat));
    joint = { chi2, dof: 3 * k, low: chi2Inv(alpha / 2, 3 * k), high: chi2Inv(1 - alpha / 2, 3 * k) };
    joint.pass = chi2 >= joint.low && chi2 <= joint.high;
  } catch { /* leave null */ }
  const rms = { total: Math.sqrt(points.reduce((a, p) => a + p.length ** 2, 0) / k), normal: Math.sqrt(points.reduce((a, p) => a + p.normal ** 2, 0) / k), inPlane: Math.sqrt(points.reduce((a, p) => a + p.inPlane ** 2, 0) / k) };
  return { points, joint, rms };
}

// Total-station points → sheet frame: x_S = λ⁻¹ Rᵀ (x_T − t), with covariance (a priori)
export function inverseTransform(ctx, xT, SigmaT) {
  const { layout, X, R, lambda } = ctx, { t, p } = layout.unpack(X), dR = layout.P.derivatives(p);
  const diff = [0, 1, 2].map(r => xT[r] - t[r]);
  const xs = [0, 1, 2].map(c => (R[0][c] * diff[0] + R[1][c] * diff[1] + R[2][c] * diff[2]) / lambda);
  const GT = scaleM(transpose(R), 1 / lambda);
  const GX = zeros(3, layout.u);
  for (let r = 0; r < 3; r++) GX[r][r] = 0;
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) GX[c][r] = -R[r][c] / lambda;                         // ∂/∂t
  for (let k = 0; k < layout.s; k++) for (let c = 0; c < 3; c++) {
    GX[c][3 + k] = (dR[k][0][c] * diff[0] + dR[k][1][c] * diff[1] + dR[k][2][c] * diff[2]) / lambda;           // ∂/∂p
  }
  if (layout.estimateScale) for (let c = 0; c < 3; c++) GX[c][layout.lamIdx] = -xs[c] / lambda;              // ∂/∂λ
  const A = matmul(matmul(GT, SigmaT), transpose(GT));
  const B = matmul(matmul(GX, ctx.SigmaX), transpose(GX));
  return { xs, Sigma: A.map((row, r) => row.map((v, q) => v + B[r][q])) };
}
