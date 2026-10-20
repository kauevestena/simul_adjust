// Gauss–Helmert (combined) least-squares engine, notation of Gemael:
//
//   F(Xa, La) = 0,   Xa = X0 + X,   La = Lb + V,   weights P = σ0² Σ⁻¹ (a priori σ0 = 1)
//   A X + B V + W = 0,  A = ∂F/∂Xa,  B = ∂F/∂La,  W = F(X0, L0) + B (Lb − L0)     (rigorous)
//   M = B Σ Bᵀ,  N = Aᵀ M⁻¹ A,  U = Aᵀ M⁻¹ W,  K = −M⁻¹ (A X + W),  V = Σ Bᵀ K
//
// Injunções on the parameters, g(Xa) = 0 (here the orthonormality of the rotation
// parametrizations), are solved with the bordered system  [N Cᵀ; C 0] [X; Kc] = [−U; −g].
// The parametric model (Gauss–Markov) is the particular case F = f(X) − La, B = −I, M = Σ.
//
// B is mostly zeros: a condition equation involves the coordinates of one point (or two, for
// a distance). Its rows are read once per linearization into short lists grouped by covariance
// block, and M = BΣBᵀ, which is block diagonal when no condition links two points, is inverted
// block by block (invertSym). That keeps the adjustment fast enough to be repeated many times
// by the outlier detection.
import { invert, invertSym, matmul, tmatmul, matvec, zeros, dot, SingularError } from './linalg.mjs';

export { SingularError };

// For every covariance block {start, S}: the rows of B that touch it, their entries there
// (vecs, length k) and the positions of the nonzero entries (nzs)
export function blockRows(B, blocks, n) {
  const blockOf = new Int32Array(n).fill(-1), local = new Int32Array(n);
  blocks.forEach(({ start, S }, b) => { for (let c = 0; c < S.length; c++) { blockOf[start + c] = b; local[start + c] = c; } });
  const out = blocks.map(() => ({ rows: [], vecs: [], nzs: [] }));
  for (let r = 0; r < B.length; r++) {
    const row = B[r];
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (v === 0 || blockOf[j] < 0) continue;
      const e = out[blockOf[j]], last = e.rows.length - 1;
      let vec, nz;
      if (last >= 0 && e.rows[last] === r) { vec = e.vecs[last]; nz = e.nzs[last]; }
      else { vec = new Float64Array(blocks[blockOf[j]].S.length); nz = []; e.rows.push(r); e.vecs.push(vec); e.nzs.push(nz); }
      vec[local[j]] = v; nz.push(local[j]);
    }
  }
  return out;
}

// Sparse rows of a (mostly zero) matrix, and products with them
const sparseRows = A => A.map(row => { const idx = [], val = []; for (let j = 0; j < row.length; j++) if (row[j] !== 0) { idx.push(j); val.push(row[j]); } return { idx, val }; });
const spmv = (S, x) => S.map(({ idx, val }) => { let s = 0; for (let t = 0; t < idx.length; t++) s += val[t] * x[idx[t]]; return s; });
// Aᵀ S for a dense A (m × u) and the sparse rows of a symmetric S (m × m)
function tmatmulSparse(A, S) {
  const u = A[0].length, C = zeros(u, S.length);
  S.forEach(({ idx, val }, p) => {
    const Ap = A[p];
    for (let i = 0; i < u; i++) { const a = Ap[i]; if (a === 0) continue; const Ci = C[i]; for (let t = 0; t < idx.length; t++) Ci[idx[t]] += a * val[t]; }
  });
  return C;
}
// S A for the sparse rows of S (m × m) and a dense A (m × u)
const spmm = (S, A) => S.map(({ idx, val }) => {
  const out = new Array(A[0].length).fill(0);
  for (let t = 0; t < idx.length; t++) { const a = val[t], Ar = A[idx[t]]; for (let j = 0; j < out.length; j++) out[j] += a * Ar[j]; }
  return out;
});

// B Σ Bᵀ from the block rows: M_ac += b_aᵀ S b_c over the rows a, c that touch each block
function sandwichRows(br, blocks, m) {
  const M = zeros(m, m);
  blocks.forEach(({ S }, b) => {
    const { rows, vecs, nzs } = br[b], k = S.length, R = rows.length;
    if (!R) return;
    // S b_a, using only the nonzero entries of b_a
    const SV = vecs.map((v, a) => {
      const o = new Float64Array(k), nz = nzs[a];
      for (let i = 0; i < k; i++) { let s = 0; const Si = S[i]; for (const j of nz) s += Si[j] * v[j]; o[i] = s; }
      return o;
    });
    for (let a = 0; a < R; a++) {
      const x = SV[a], Ma = M[rows[a]];
      for (let c = 0; c <= a; c++) {
        const y = vecs[c];
        let s = 0;
        for (const i of nzs[c]) s += x[i] * y[i];
        if (s === 0) continue;
        Ma[rows[c]] += s; if (a !== c) M[rows[c]][rows[a]] += s;
      }
    }
  });
  return M;
}

// Σ Bᵀ v (n-vector) from the block rows
function sigmaBtVRows(br, blocks, n, v) {
  const out = new Array(n).fill(0);
  blocks.forEach(({ start, S }, b) => {
    const { rows, vecs, nzs } = br[b], k = S.length;
    if (!rows.length) return;
    const t = new Float64Array(k);
    rows.forEach((r, a) => { const x = v[r]; if (x === 0) return; const vec = vecs[a]; for (const c of nzs[a]) t[c] += vec[c] * x; });
    for (let i = 0; i < k; i++) { let s = 0; const Si = S[i]; for (let c = 0; c < k; c++) s += Si[c] * t[c]; out[start + i] = s; }
  });
  return out;
}

// B Σ Bᵀ for a block-diagonal Σ given as [{ start, S }] (S dense; blocks may be adjacent)
export const sandwich = (B, blocks) => sandwichRows(blockRows(B, blocks, B[0]?.length ?? 0), blocks, B.length);

// Σ Bᵀ v (n-vector) for the block-diagonal Σ
export const sigmaBtV = (B, blocks, n, v) => sigmaBtVRows(blockRows(B, blocks, n), blocks, n, v);

function borderedSolve(N, U, C, g) {
  const u = N.length, k = C.length;
  const Nb = zeros(u + k, u + k);
  for (let i = 0; i < u; i++) for (let j = 0; j < u; j++) Nb[i][j] = N[i][j];
  for (let r = 0; r < k; r++) for (let j = 0; j < u; j++) { Nb[u + r][j] = C[r][j]; Nb[j][u + r] = C[r][j]; }
  const inv = invert(Nb);
  const rhs = [...U.map(v => -v), ...g.map(v => -v)];
  const sol = matvec(inv, rhs);
  return { dX: sol.slice(0, u), Kc: sol.slice(u), Q11: projectOut(inv.slice(0, u).map(r => r.slice(0, u)), C) };
}

// The constrained cofactor satisfies C Q11 = 0 exactly; in floating point the bordered inverse
// leaves a residue there of the order of ε times the unconstrained variance, which shows up as
// σ ≈ √ε σ_free for a parameter the injunção fixes. P Q11 Pᵀ, with P = I − Cᵀ(CCᵀ)⁻¹C the
// orthogonal projector onto null(C), changes nothing else and removes that residue.
function projectOut(Q, C) {
  const u = Q.length;
  let CCi;
  try { CCi = invert(matmul(C, C[0].map((_, j) => C.map(row => row[j])))); } catch { return Q; }
  const T = tmatmul(C, CCi);                               // Cᵀ (CCᵀ)⁻¹, u × k
  const P = Array.from({ length: u }, (_, i) => Array.from({ length: u }, (_, j) => (i === j ? 1 : 0) - C.reduce((s, row, r) => s + T[i][r] * row[j], 0)));
  const PQ = matmul(P, Q);
  return PQ.map((row, i) => P.map((Pj, j) => { let s = 0; for (let t = 0; t < u; t++) s += row[t] * Pj[t]; return s; })).map((row, i, M) => row.map((v, j) => 0.5 * (v + M[j][i])));
}

// One linearization: block rows of B, M, its inverse (dense and sparse rows), Aᵀ M⁻¹ and N
function linearize(evaluate, X, La, blocks, n) {
  const { F, A, B } = evaluate(X, La);
  const br = blockRows(B, blocks, n);
  const M = sandwichRows(br, blocks, B.length), Minv = invertSym(M);
  const Ms = sparseRows(M), Mis = sparseRows(Minv);
  const AtMi = tmatmulSparse(A, Mis);                      // u × m
  return { F, A, B, br, M, Minv, Ms, Mis, AtMi, N: matmul(AtMi, A) };
}

export function solveGaussHelmert({ Lb, blocks, X0, evaluate, constraints = null, scale = null, tol = 1e-11, maxIter = 40 }) {
  const n = Lb.length, u = X0.length;
  const sc = scale || new Array(u).fill(1);
  let X = X0.slice(), La = Lb.slice();
  const history = [];
  let converged = false, last = null;

  for (let it = 1; it <= maxIter; it++) {
    const L = linearize(evaluate, X, La, blocks, n);
    const dL = Lb.map((v, i) => v - La[i]);
    // W = F(X0, L0) + B (Lb − L0), from the block rows of B
    const W = L.F.slice();
    blocks.forEach(({ start }, b) => {
      const { rows, vecs } = L.br[b];
      rows.forEach((r, a) => { const vec = vecs[a]; let s = 0; for (let c = 0; c < vec.length; c++) s += vec[c] * dL[start + c]; W[r] += s; });
    });
    const U = matvec(L.AtMi, W);
    const cons = constraints ? constraints(X) : { C: [], g: [] };
    const { dX, Kc, Q11 } = cons.C.length ? borderedSolve(L.N, U, cons.C, cons.g) : (() => {
      const Q = invert(L.N); return { dX: matvec(Q, U).map(v => -v), Kc: [], Q11: Q };
    })();
    const K = spmv(L.Mis, W.map((w, r) => w + dot(L.A[r], dX))).map(v => -v);
    const V = sigmaBtVRows(L.br, blocks, n, K);
    X = X.map((v, i) => v + dX[i]);
    La = Lb.map((v, i) => v + V[i]);
    const step = Math.max(...dX.map((d, i) => Math.abs(d) / sc[i]));
    history.push({ iter: it, step, Omega: dot(K, spmv(L.Ms, K)), normW: Math.sqrt(Math.max(0, dot(W, spmv(L.Mis, W)))) });
    last = { M: L.M, Ms: L.Ms, Q11, K, V, Kc, C: cons.C };
    if (!Number.isFinite(step)) throw new Error('divergence: non-finite step');
    if (step < tol) { converged = true; break; }
  }

  // Final linearization at the converged point for the cofactors (K and V come from the last step)
  const L = linearize(evaluate, X, La, blocks, n);
  const cons = constraints ? constraints(X) : { C: [], g: [] };
  let Q11;
  if (cons.C.length) Q11 = borderedSolve(L.N, new Array(u).fill(0), cons.C, cons.g.map(() => 0)).Q11;
  else Q11 = invert(L.N);
  const Omega = dot(last.K, spmv(last.Ms, last.K));
  const gMax = cons.g.length ? Math.max(...cons.g.map(Math.abs)) : 0;
  return {
    X, La, V: last.V, K: last.K, Omega, converged, iterations: history.length, history,
    A: L.A, B: L.B, br: L.br, M: L.M, Minv: L.Minv, Mis: L.Mis, AtMi: L.AtMi, N: L.N, Q11, Kc: last.Kc, C: cons.C, gMax, blocks, n, u
  };
}

// Q_K = M⁻¹ − M⁻¹ A Q11 Aᵀ M⁻¹ (cofactor of the Lagrange multipliers)
export function cofactorK(sol) {
  const { A, Minv, Q11 } = sol;
  const MA = sol.Mis ? spmm(sol.Mis, A) : matmul(Minv, A);
  const MAQ = matmul(MA, Q11), u = Q11.length;
  return Minv.map((row, i) => {
    const x = MAQ[i];
    return row.map((v, j) => { const y = MA[j]; let s = 0; for (let k = 0; k < u; k++) s += x[k] * y[k]; return v - s; });
  });
}

// Statistics of every covariance block {start, S} of k observations, from the rows of B that
// touch it (B_b, |rows| × k):
//   G = B_bᵀ Q_K B_b                      k × k  (cofactor of PV = BᵀK for these observations)
//   diag(Q_V)  with Q_V = Σ Bᵀ Q_K B Σ    (cofactors of the residuals)
//   diag(Q_V P) = diag(Σ Bᵀ Q_K B)        (redundancy numbers; they add up to r)
// Σ is block diagonal, so the diagonal blocks of these n × n matrices are all that is needed.
export function blockStats(sol, QK) {
  const { blocks, n } = sol;
  const br = sol.br || blockRows(sol.B, blocks, n);
  const qv = new Array(n).fill(0), redundancy = new Array(n).fill(0), G = [];
  blocks.forEach(({ start, S }, b) => {
    const k = S.length, { rows, vecs, nzs } = br[b];
    // G = Σ_a Σ_c b_a Q_K[a][c] b_cᵀ over the nonzero entries of the rows
    const Gb = zeros(k, k);
    rows.forEach((ra, a) => {
      const Qa = QK[ra], va = vecs[a];
      rows.forEach((rc, c) => {
        const q = Qa[rc];
        if (q === 0) return;
        const vc = vecs[c];
        for (const i of nzs[a]) { const f = va[i] * q, Gi = Gb[i]; for (const j of nzs[c]) Gi[j] += f * vc[j]; }
      });
    });
    const SG = matmul(S, Gb);
    for (let i = 0; i < k; i++) {
      redundancy[start + i] = SG[i][i];
      let s = 0;
      for (let j = 0; j < k; j++) s += SG[i][j] * S[j][i];
      qv[start + i] = s;
    }
    G.push({ start, k, G: Gb, rows });
  });
  return { qv, redundancy, G };
}

// diag(Q_V) with Q_V = Σ Bᵀ Q_K B Σ  (cofactors of the residuals)
export const residualVariances = (sol, QK) => blockStats(sol, QK).qv;

// Bᵀ v without forming Bᵀ
export function tmatvec(B, v) {
  const out = new Array(B[0]?.length ?? 0).fill(0);
  B.forEach((row, r) => { const x = v[r]; if (x === 0) return; for (let j = 0; j < row.length; j++) if (row[j] !== 0) out[j] += row[j] * x; });
  return out;
}

// Sensitivity of the estimate to the observations, ∂X̂/∂Lb = −Q11 (Aᵀ M⁻¹) B  (u × n)
export function sensitivity(sol) {
  const { A, Minv, B, Q11 } = sol;
  const AtMi = sol.AtMi || tmatmul(A, Minv);
  return matmul(Q11, matmul(AtMi, B)).map(r => r.map(v => -v));
}
