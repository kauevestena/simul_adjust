// Gauss–Helmert (combined) least-squares engine, notation of Gemael:
//
//   F(Xa, La) = 0,   Xa = X0 + X,   La = Lb + V,   weights P = σ0² Σ⁻¹ (a priori σ0 = 1)
//   A X + B V + W = 0,  A = ∂F/∂Xa,  B = ∂F/∂La,  W = F(X0, L0) + B (Lb − L0)     (rigorous)
//   M = B Σ Bᵀ,  N = Aᵀ M⁻¹ A,  U = Aᵀ M⁻¹ W,  K = −M⁻¹ (A X + W),  V = Σ Bᵀ K
//
// Injunções on the parameters, g(Xa) = 0 (here the orthonormality of the rotation
// parametrizations), are solved with the bordered system  [N Cᵀ; C 0] [X; Kc] = [−U; −g].
// The parametric model (Gauss–Markov) is the particular case F = f(X) − La, B = −I, M = Σ.
import { invert, matmul, tmatmul, transpose, matvec, zeros, dot, SingularError } from './linalg.mjs';

export { SingularError };

// B Σ Bᵀ for a block-diagonal Σ given as [{ start, S }] (S dense; blocks may be adjacent)
export function sandwich(B, blocks) {
  const m = B.length, M = zeros(m, m);
  for (const { start, S } of blocks) {
    const k = S.length;
    // only the rows of B that touch this block contribute (B is mostly zeros)
    const nz = [];
    for (let i = 0; i < m; i++) { const row = B[i]; for (let c = 0; c < k; c++) if (row[start + c] !== 0) { nz.push(i); break; } }
    if (!nz.length) continue;
    const Bb = nz.map(i => B[i].slice(start, start + k));
    const BS = matmul(Bb, S);
    for (let a = 0; a < nz.length; a++) for (let b = 0; b <= a; b++) {
      let sum = 0; const x = BS[a], y = Bb[b];
      for (let c = 0; c < k; c++) sum += x[c] * y[c];
      M[nz[a]][nz[b]] += sum; if (a !== b) M[nz[b]][nz[a]] += sum;
    }
  }
  return M;
}

// Σ Bᵀ v (n-vector) for the block-diagonal Σ
export function sigmaBtV(B, blocks, n, v) {
  const out = new Array(n).fill(0);
  for (const { start, S } of blocks) {
    const k = S.length, t = new Array(k).fill(0);
    for (let r = 0; r < B.length; r++) {
      if (v[r] === 0) continue;
      for (let c = 0; c < k; c++) t[c] += B[r][start + c] * v[r];
    }
    for (let i = 0; i < k; i++) { let s = 0; for (let c = 0; c < k; c++) s += S[i][c] * t[c]; out[start + i] = s; }
  }
  return out;
}

function borderedSolve(N, U, C, g) {
  const u = N.length, k = C.length;
  const Nb = zeros(u + k, u + k);
  for (let i = 0; i < u; i++) for (let j = 0; j < u; j++) Nb[i][j] = N[i][j];
  for (let r = 0; r < k; r++) for (let j = 0; j < u; j++) { Nb[u + r][j] = C[r][j]; Nb[j][u + r] = C[r][j]; }
  const inv = invert(Nb);
  const rhs = [...U.map(v => -v), ...g.map(v => -v)];
  const sol = matvec(inv, rhs);
  return { dX: sol.slice(0, u), Kc: sol.slice(u), Q11: inv.slice(0, u).map(r => r.slice(0, u)) };
}

export function solveGaussHelmert({ Lb, blocks, X0, evaluate, constraints = null, scale = null, tol = 1e-11, maxIter = 40 }) {
  const n = Lb.length, u = X0.length;
  const sc = scale || new Array(u).fill(1);
  let X = X0.slice(), La = Lb.slice();
  const history = [];
  let converged = false, last = null;

  for (let it = 1; it <= maxIter; it++) {
    const { F, A, B } = evaluate(X, La);
    const dL = Lb.map((v, i) => v - La[i]);
    const W = F.map((f, r) => f + dot(B[r], dL));
    const M = sandwich(B, blocks), Minv = invert(M);
    const AtMi = tmatmul(A, Minv);                         // u × m
    const N = matmul(AtMi, A), U = matvec(AtMi, W);
    const cons = constraints ? constraints(X) : { C: [], g: [] };
    const { dX, Kc, Q11 } = cons.C.length ? borderedSolve(N, U, cons.C, cons.g) : (() => {
      const Q = invert(N); return { dX: matvec(Q, U).map(v => -v), Kc: [], Q11: Q };
    })();
    const K = matvec(Minv, W.map((w, r) => w + dot(A[r], dX))).map(v => -v);
    const V = sigmaBtV(B, blocks, n, K);
    X = X.map((v, i) => v + dX[i]);
    La = Lb.map((v, i) => v + V[i]);
    const step = Math.max(...dX.map((d, i) => Math.abs(d) / sc[i]));
    history.push({ iter: it, step, Omega: dot(K, matvec(M, K)), normW: Math.sqrt(Math.max(0, dot(W, matvec(Minv, W)))) });
    last = { A, B, M, Minv, N, Q11, K, V, Kc, C: cons.C };
    if (!Number.isFinite(step)) throw new Error('divergence: non-finite step');
    if (step < tol) { converged = true; break; }
  }

  // Final linearization at the converged point for the cofactors (K and V come from the last step)
  const { A, B } = evaluate(X, La);
  const M = sandwich(B, blocks), Minv = invert(M);
  const AtMi = tmatmul(A, Minv), N = matmul(AtMi, A);
  const cons = constraints ? constraints(X) : { C: [], g: [] };
  let Q11;
  if (cons.C.length) Q11 = borderedSolve(N, new Array(u).fill(0), cons.C, cons.g.map(() => 0)).Q11;
  else Q11 = invert(N);
  const Omega = dot(last.K, matvec(last.M, last.K));
  const gMax = cons.g.length ? Math.max(...cons.g.map(Math.abs)) : 0;
  return { X, La, V: last.V, K: last.K, Omega, converged, iterations: history.length, history, A, B, M, Minv, N, Q11, Kc: last.Kc, C: cons.C, gMax, blocks, n, u };
}

// Q_K = M⁻¹ − M⁻¹ A Q11 Aᵀ M⁻¹ (cofactor of the Lagrange multipliers)
export function cofactorK(sol) {
  const { A, Minv, Q11 } = sol;
  const MA = matmul(Minv, A);
  const T = matmul(matmul(MA, Q11), transpose(MA));
  return Minv.map((r, i) => r.map((v, j) => v - T[i][j]));
}

// diag(Q_V) with Q_V = Σ Bᵀ Q_K B Σ  (cofactors of the residuals); the full matrix is n × n
export function residualVariances(sol, QK) {
  const { B, blocks, n } = sol;
  const BS = zeros(B.length, n);                          // B Σ, m × n, block by block
  for (const { start, S } of blocks) {
    const k = S.length, Bb = B.map(r => r.slice(start, start + k)), P = matmul(Bb, S);
    for (let r = 0; r < B.length; r++) for (let c = 0; c < k; c++) BS[r][start + c] = P[r][c];
  }
  const QBS = matmul(QK, BS);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = 0; for (let r = 0; r < B.length; r++) s += BS[r][i] * QBS[r][i]; out[i] = s; }
  return out;
}

// Sensitivity of the estimate to the observations, ∂X̂/∂Lb = −Q11 Aᵀ M⁻¹ B  (u × n)
export function sensitivity(sol) {
  const { A, Minv, B, Q11 } = sol;
  return matmul(Q11, tmatmul(A, matmul(Minv, B))).map(r => r.map(v => -v));
}
