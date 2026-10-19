// Dense linear algebra on arrays of arrays. Sizes here stay below a few hundred, so clarity
// wins over speed; zero entries of the left operand are skipped because the design matrices
// of the adjustment are mostly zeros.

export class SingularError extends Error {
  constructor(index, size) {
    super(`singular matrix (pivot ${index} of ${size})`);
    this.name = 'SingularError';
    this.index = index;
    this.size = size;
  }
}

export const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
export const identity = n => Array.from({ length: n }, (_, i) => { const row = new Array(n).fill(0); row[i] = 1; return row; });
export const transpose = A => A[0].map((_, j) => A.map(row => row[j]));
export const clone = A => A.map(row => row.slice());

export function matmul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i], Ci = C[i];
    for (let p = 0; p < k; p++) {
      const a = Ai[p];
      if (a === 0) continue;
      const Bp = B[p];
      for (let j = 0; j < m; j++) Ci[j] += a * Bp[j];
    }
  }
  return C;
}

export function matvec(A, x) {
  return A.map(row => { let s = 0; for (let j = 0; j < row.length; j++) if (row[j] !== 0) s += row[j] * x[j]; return s; });
}

// Aᵀ B without forming Aᵀ
export function tmatmul(A, B) {
  const n = A[0].length, m = B[0].length;
  const C = zeros(n, m);
  for (let p = 0; p < A.length; p++) {
    const Ap = A[p], Bp = B[p];
    for (let i = 0; i < n; i++) {
      const a = Ap[i];
      if (a === 0) continue;
      const Ci = C[i];
      for (let j = 0; j < m; j++) Ci[j] += a * Bp[j];
    }
  }
  return C;
}

export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const norm = a => Math.sqrt(dot(a, a));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const sub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
export const scale = (A, s) => A.map(r => r.map(v => v * s));
export const vadd = (a, b) => a.map((v, i) => v + b[i]);
export const vsub = (a, b) => a.map((v, i) => v - b[i]);
export const vscale = (a, s) => a.map(v => v * s);
export const symmetrize = A => A.map((r, i) => r.map((v, j) => 0.5 * (v + A[j][i])));

export function det3(M) {
  return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}

// Inverse by Gauss–Jordan with partial pivoting on a symmetrically equilibrated copy
// (d_i = 1/√max_j|A_ij|), so metres, radians and Lagrange rows of very different size do not
// decide the pivots. A pivot below relTol (the equilibrated matrix has entries ≤ 1) means the
// matrix is singular to working precision: SingularError, never a silently wrong inverse.
export function invert(A, { relTol = 1e-13 } = {}) {
  const n = A.length;
  const d = A.map(row => { let m = 0; for (const v of row) m = Math.max(m, Math.abs(v)); return m > 0 ? 1 / Math.sqrt(m) : 1; });
  const M = A.map((row, i) => {
    const r = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j] * d[i] * d[j];
    r[n + i] = 1;
    return r;
  });
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(M[c][c]);
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > best) { best = Math.abs(M[r][c]); p = r; }
    if (!(best > relTol)) throw new SingularError(c, n);
    if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
    const pr = M[c], inv = 1 / pr[c];
    for (let j = 0; j < 2 * n; j++) pr[j] *= inv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      const row = M[r];
      for (let j = c; j < 2 * n; j++) row[j] -= f * pr[j];
    }
  }
  // undo the equilibration: A⁻¹ = D (DAD)⁻¹ D
  return M.map((row, i) => row.slice(n).map((v, j) => v * d[i] * d[j]));
}

export const solve = (A, b, opts) => matvec(invert(A, opts), b);

// Inverse of a block-diagonal matrix given as [{ offset, M }]; blocks are inverted independently
export function invertBlocks(blocks, opts) {
  return blocks.map(({ offset, M }) => ({ offset, M: invert(M, opts) }));
}

export function cholesky(A) {
  const n = A.length, L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0)) throw new SingularError(i, n);
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

// Cyclic Jacobi for symmetric matrices: eigenvalues ascending, eigenvectors as columns
export function eigSym(S, maxSweeps = 100) {
  const n = S.length;
  const A = clone(S), V = identity(n);
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0, scaleS = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i !== j) off += A[i][j] * A[i][j]; else scaleS += A[i][i] * A[i][i];
    }
    if (off <= 1e-30 * Math.max(scaleS, 1e-300)) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p][q];
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = A.map((r, i) => i).sort((a, b) => A[a][a] - A[b][b]);
  return { values: order.map(i => A[i][i]), vectors: V.map(row => order.map(i => row[i])) };
}

// Make a 3×3 eigenvector matrix a proper rotation (det = +1)
export function rightHanded(V) {
  if (det3(V) >= 0) return V;
  return V.map(r => [r[0], r[1], -r[2]]);
}

// Rows of C that are linearly independent, kept greedily in the given order (modified
// Gram–Schmidt). A row is dropped when it is (numerically) zero or when what remains of it
// after removing the kept directions is below relTol of its own norm.
export function independentRows(C, { absTol = 1e-12, relTol = 1e-8 } = {}) {
  const basis = [], kept = [];
  C.forEach((row, i) => {
    const n0 = norm(row);
    if (!(n0 > absTol)) return;
    let r = row.slice();
    for (let pass = 0; pass < 2; pass++) for (const b of basis) { const f = dot(r, b); for (let j = 0; j < r.length; j++) r[j] -= f * b[j]; }
    const n1 = norm(r);
    if (n1 > relTol * n0) { basis.push(r.map(v => v / n1)); kept.push(i); }
  });
  return kept;
}

// Orthonormal basis (columns) of the null space of C (k × n), from the eigenvectors of CᵀC
export function nullBasis(C, n, relTol = 1e-10) {
  if (!C.length) return identity(n);
  const { values, vectors } = eigSym(tmatmul(C, C));
  const top = Math.max(...values.map(Math.abs), 1e-300);
  const cols = values.map((v, i) => i).filter(i => Math.abs(values[i]) <= relTol * top);
  return vectors.map(row => cols.map(i => row[i]));
}

// Condition number of a symmetric positive (semi)definite matrix
export function conditionSym(S) {
  const { values } = eigSym(S);
  const lo = values[0], hi = values[values.length - 1];
  return lo > 0 ? hi / lo : Infinity;
}
