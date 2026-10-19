// Rotation parametrizations for x_T = t + λ R x_S. Each one gives R(p), the derivatives
// ∂R/∂p_k, its constraint equations g(p) = 0 (injunções absolutas, solved by Lagrange) with
// their Jacobian, and the conversion from a proper rotation matrix.
import { matmul, det3, eigSym, transpose } from './linalg.mjs';

const mm = (...Ms) => Ms.reduce((A, B) => matmul(A, B));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------------------------------------------------------------- Euler ω, φ, κ
// R = R3(κ) R2(φ) R1(ω), each R_i a rotation of axes (as in photogrammetry and in camera_proj).
// R[2][0] = sin φ, so φ = ±90° is the gimbal lock: ω and κ then turn about the same axis.
const R1 = w => { const c = Math.cos(w), s = Math.sin(w); return [[1, 0, 0], [0, c, s], [0, -s, c]]; };
const R2 = f => { const c = Math.cos(f), s = Math.sin(f); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; };
const R3 = k => { const c = Math.cos(k), s = Math.sin(k); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };
const dR1 = w => { const c = Math.cos(w), s = Math.sin(w); return [[0, 0, 0], [0, -s, c], [0, -c, -s]]; };
const dR2 = f => { const c = Math.cos(f), s = Math.sin(f); return [[-s, 0, -c], [0, 0, 0], [c, 0, -s]]; };
const dR3 = k => { const c = Math.cos(k), s = Math.sin(k); return [[-s, c, 0], [-c, -s, 0], [0, 0, 0]]; };

const euler = {
  id: 'euler', size: 3, symbols: ['ω', 'φ', 'κ'], kinds: ['angle', 'angle', 'angle'], nConstraints: 0,
  toMatrix: ([w, f, k]) => mm(R3(k), R2(f), R1(w)),
  derivatives: ([w, f, k]) => [mm(R3(k), R2(f), dR1(w)), mm(R3(k), dR2(f), R1(w)), mm(dR3(k), R2(f), R1(w))],
  constraints: () => [],
  constraintJacobian: () => [],
  fromMatrix(R) {
    const f = Math.atan2(R[2][0], Math.hypot(R[2][1], R[2][2]));
    if (Math.abs(Math.cos(f)) < 1e-12) return [0, f, Math.atan2(R[0][1], R[1][1])]; // ω and κ inseparable
    return [Math.atan2(-R[2][1], R[2][2]), f, Math.atan2(-R[1][0], R[0][0])];
  },
  // |cos φ| → 0 at the gimbal lock
  singularity: p => ({ measure: Math.abs(Math.cos(p[1])), kind: 'gimbal' })
};

// ---------------------------------------------------------------- quaternion (homogeneous)
// R(q) = (q0² − v·v) I + 2 v vᵀ + 2 q0 [v]× = ‖q‖² R(q/‖q‖); the norm injunction ‖q‖ = 1 is what
// makes it a rotation (without it ‖q‖² acts as a second scale factor).
function quatMatrix([a, b, c, d]) {
  return [
    [a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)],
    [2 * (b * c + a * d), a * a - b * b + c * c - d * d, 2 * (c * d - a * b)],
    [2 * (b * d - a * c), 2 * (c * d + a * b), a * a - b * b - c * c + d * d]
  ];
}

export function matrixToQuaternion(R) {
  const t = R[0][0] + R[1][1] + R[2][2];
  let q;
  if (t > 0) {
    const s = 2 * Math.sqrt(t + 1);
    q = [0.25 * s, (R[2][1] - R[1][2]) / s, (R[0][2] - R[2][0]) / s, (R[1][0] - R[0][1]) / s];
  } else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
    const s = 2 * Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]);
    q = [(R[2][1] - R[1][2]) / s, 0.25 * s, (R[0][1] + R[1][0]) / s, (R[0][2] + R[2][0]) / s];
  } else if (R[1][1] > R[2][2]) {
    const s = 2 * Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]);
    q = [(R[0][2] - R[2][0]) / s, (R[0][1] + R[1][0]) / s, 0.25 * s, (R[1][2] + R[2][1]) / s];
  } else {
    const s = 2 * Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]);
    q = [(R[1][0] - R[0][1]) / s, (R[0][2] + R[2][0]) / s, (R[1][2] + R[2][1]) / s, 0.25 * s];
  }
  const n = Math.hypot(...q), sg = q[0] < 0 ? -1 : 1;
  return q.map(v => sg * v / n);
}

const quaternion = {
  id: 'quaternion', size: 4, symbols: ['q₀', 'q₁', 'q₂', 'q₃'], kinds: ['unitless', 'unitless', 'unitless', 'unitless'], nConstraints: 1,
  toMatrix: quatMatrix,
  derivatives: ([a, b, c, d]) => [
    [[2 * a, -2 * d, 2 * c], [2 * d, 2 * a, -2 * b], [-2 * c, 2 * b, 2 * a]],
    [[2 * b, 2 * c, 2 * d], [2 * c, -2 * b, -2 * a], [2 * d, 2 * a, -2 * b]],
    [[-2 * c, 2 * b, 2 * a], [2 * b, 2 * c, 2 * d], [-2 * a, 2 * d, -2 * c]],
    [[-2 * d, -2 * a, 2 * b], [2 * a, -2 * d, 2 * c], [2 * b, 2 * c, 2 * d]]
  ],
  constraints: q => [q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3] - 1],
  constraintJacobian: q => [q.map(v => 2 * v)],
  fromMatrix: matrixToQuaternion,
  singularity: q => ({ measure: 1, kind: 'none', norm: Math.hypot(...q) })
};

// ---------------------------------------------------------------- rotation matrix (9 elements)
// p = (r11, r12, r13, r21, …, r33), row by row. Six injunções make the columns orthonormal:
// three unit norms and three orthogonalities. With a planar reference (z_S = 0) the third
// column never meets the data, and only these equations determine it.
const PAIRS = [[0, 0], [1, 1], [2, 2], [0, 1], [0, 2], [1, 2]];
const col = (p, j) => [p[j], p[3 + j], p[6 + j]];
const matrix = {
  id: 'matrix', size: 9, symbols: ['r₁₁', 'r₁₂', 'r₁₃', 'r₂₁', 'r₂₂', 'r₂₃', 'r₃₁', 'r₃₂', 'r₃₃'], kinds: new Array(9).fill('unitless'), nConstraints: 6,
  toMatrix: p => [[p[0], p[1], p[2]], [p[3], p[4], p[5]], [p[6], p[7], p[8]]],
  derivatives: () => Array.from({ length: 9 }, (_, k) => {
    const E = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; E[Math.floor(k / 3)][k % 3] = 1; return E;
  }),
  constraints: p => PAIRS.map(([a, b]) => {
    const ca = col(p, a), cb = col(p, b);
    return ca[0] * cb[0] + ca[1] * cb[1] + ca[2] * cb[2] - (a === b ? 1 : 0);
  }),
  constraintJacobian: p => PAIRS.map(([a, b]) => {
    const row = new Array(9).fill(0), ca = col(p, a), cb = col(p, b);
    for (let i = 0; i < 3; i++) { row[3 * i + a] += cb[i]; row[3 * i + b] += ca[i]; }
    return row;
  }),
  fromMatrix: R => [R[0][0], R[0][1], R[0][2], R[1][0], R[1][1], R[1][2], R[2][0], R[2][1], R[2][2]],
  singularity: p => ({ measure: 1, kind: 'none', det: det3(matrix.toMatrix(p)) })
};

// ---------------------------------------------------------------- axis–angle
// R = I + sinθ [n]× + (1 − cosθ) [n]×², with the injunção ‖n‖ = 1. At θ → 0 the axis is
// undefined (∂R/∂n → 0) and the normal matrix becomes singular.
const skew = ([x, y, z]) => [[0, -z, y], [z, 0, -x], [-y, x, 0]];
const DK = [skew([1, 0, 0]), skew([0, 1, 0]), skew([0, 0, 1])];
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const comb = (terms) => { const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; terms.forEach(([w, M]) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += w * M[i][j]; }); return S; };

const axisAngle = {
  id: 'axisAngle', size: 4, symbols: ['n_x', 'n_y', 'n_z', 'θ'], kinds: ['unitless', 'unitless', 'unitless', 'angle'], nConstraints: 1,
  toMatrix: ([x, y, z, th]) => { const K = skew([x, y, z]); return comb([[1, I3()], [Math.sin(th), K], [1 - Math.cos(th), matmul(K, K)]]); },
  derivatives: ([x, y, z, th]) => {
    const K = skew([x, y, z]), s = Math.sin(th), c = Math.cos(th);
    const dn = DK.map(D => comb([[s, D], [1 - c, matmul(D, K)], [1 - c, matmul(K, D)]]));
    return [...dn, comb([[c, K], [s, matmul(K, K)]])];
  },
  constraints: p => [p[0] * p[0] + p[1] * p[1] + p[2] * p[2] - 1],
  constraintJacobian: p => [[2 * p[0], 2 * p[1], 2 * p[2], 0]],
  fromMatrix: R => {
    const q = matrixToQuaternion(R), v = Math.hypot(q[1], q[2], q[3]);
    if (v < 1e-12) return [0, 0, 1, 0];
    return [q[1] / v, q[2] / v, q[3] / v, 2 * Math.atan2(v, q[0])];
  },
  singularity: p => ({ measure: Math.abs(Math.sin(p[3] / 2)), kind: 'axis' })
};

export const PARAMETRIZATIONS = { euler, quaternion, matrix, axisAngle };
export const PARAM_KEYS = Object.keys(PARAMETRIZATIONS);

// The same rotation in every parametrization (for display and comparison)
export function allForms(R) {
  return Object.fromEntries(PARAM_KEYS.map(k => [k, PARAMETRIZATIONS[k].fromMatrix(R)]));
}

// Angle of the rotation that takes Ra to Rb (stable for small and large angles)
export function rotationDifference(Ra, Rb) {
  const D = matmul(transpose(Ra), Rb);
  const s = 0.5 * Math.hypot(D[2][1] - D[1][2], D[0][2] - D[2][0], D[1][0] - D[0][1]);
  return Math.atan2(s, (D[0][0] + D[1][1] + D[2][2] - 1) / 2);
}

// Small-rotation vector of a perturbation dR of R: vee(skew(dR Rᵀ)). Applied to ∂R/∂p_k it
// gives the column k of J_ε, so Σ_ε = J_ε Σ_p J_εᵀ is the same for every parametrization.
export function smallAngleColumn(dR, R) {
  const A = matmul(dR, transpose(R));
  return [0.5 * (A[2][1] - A[1][2]), 0.5 * (A[0][2] - A[2][0]), 0.5 * (A[1][0] - A[0][1])];
}

// Horn (1987) closed-form similarity: dst ≈ t + λ R src (weighted). Works for planar sets.
export function horn(src, dst, weights = null) {
  const n = src.length, w = weights || new Array(n).fill(1), W = w.reduce((a, b) => a + b, 0);
  const cs = [0, 0, 0], cd = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { cs[a] += w[i] * src[i][a] / W; cd[a] += w[i] * dst[i][a] / W; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const a = src[i].map((v, k) => v - cs[k]), b = dst[i].map((v, k) => v - cd[k]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += w[i] * a[r] * b[c];
    ss += w[i] * (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz]
  ];
  const { vectors } = eigSym(N);
  let q = vectors.map(r => r[3]);
  if (q[0] < 0) q = q.map(v => -v);
  const R = quatMatrix(q);
  let num = 0;
  for (let i = 0; i < n; i++) {
    const a = src[i].map((v, k) => v - cs[k]), b = dst[i].map((v, k) => v - cd[k]);
    const Ra = [0, 1, 2].map(r => R[r][0] * a[0] + R[r][1] * a[1] + R[r][2] * a[2]);
    num += w[i] * (b[0] * Ra[0] + b[1] * Ra[1] + b[2] * Ra[2]);
  }
  const lambda = num / ss;
  const t = [0, 1, 2].map(r => cd[r] - lambda * (R[r][0] * cs[0] + R[r][1] * cs[1] + R[r][2] * cs[2]));
  return { q, R, lambda, t };
}

export { quatMatrix, clamp };
