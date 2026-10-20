// Best plane through the total-station points of the sheet, adjusted by the combined
// (Gauss–Helmert) model with the unit-normal injunção:
//
//   F_i = n · x_iᵃ − d = 0           one condition per point        (n = (n_x, n_y, n_z))
//   g   = nᵀ n − 1 = 0               injunção that fixes the scale of (n, d)
//   A_i = [x_iᵃ  y_iᵃ  z_iᵃ  −1],    B_i = nᵀ on the three coordinates of point i
//   M_i = nᵀ Σ_i n (a scalar: M is diagonal),   r = m − 4 + 1 = m − 3
//
// The printed sheet is flat, so the distance of every observed point to the adjusted plane
// shows the depth error of the total station: with the line of sight close to the normal,
// that is essentially the distance (EDM) error, plus whatever non-flatness the sheet has.
// d_i > 0 means the point was measured in front of the plane (towards the instrument).
import { solveGaussHelmert, cofactorK } from './lsq.mjs';
import { eigSym, cross, dot, SingularError } from './linalg.mjs';
import { globalTest, wCritical, tauCritical, delta0 } from './stats.mjs';

const unit = a => { const s = Math.hypot(...a); return a.map(v => v / s); };

// Axes of the plane "as seen from the instrument": right and up on the screen, the normal
// pointing at the viewer. Vertical sheets use the zenith as up; nearly horizontal sheets use the
// horizontal direction from the instrument to the sheet (like a map read from the station).
export function planeFrame(n, centroid) {
  const f = n.map(v => -v);                                  // looking from the instrument
  let upRef = [0, 0, 1];
  if (Math.abs(n[2]) > 0.9) {
    const h = Math.hypot(centroid[0], centroid[1]);
    upRef = h > 1e-12 ? [centroid[0] / h, centroid[1] / h, 0] : [0, 1, 0];
  }
  const right = unit(cross(f, upRef));
  const up = cross(right, f);
  return { right, up };
}

// points: [{ name, xyz, cov }] (total-station frame and unit)
export function fitPlane(points, { alpha = 0.05, alpha0 = 0.001, power = 0.8, tol = 1e-11, maxIter = 30 } = {}) {
  const m = points.length;
  if (m < 4) return { ok: false, error: { code: 'fewPlane', count: m } };
  const c = [0, 1, 2].map(a => points.reduce((s, p) => s + p.xyz[a], 0) / m);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  points.forEach(p => { const q = p.xyz.map((v, a) => v - c[a]); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) S[r][k] += q[r] * q[k]; });
  const { values, vectors } = eigSym(S);
  if (!(values[1] > 1e-12 * Math.max(values[2], 1e-300))) return { ok: false, error: { code: 'collinearPlane' } };

  // starting plane: the smallest principal direction (orthogonal regression), oriented to the instrument
  let n0 = [vectors[0][0], vectors[1][0], vectors[2][0]];
  if (dot(n0, c) > 0) n0 = n0.map(v => -v);
  const X0 = [...n0, dot(n0, c)];

  const Lb = points.flatMap(p => p.xyz);
  const blocks = points.map((p, i) => ({ start: 3 * i, S: p.cov }));
  const evaluate = (X, La) => {
    const F = new Array(m), A = new Array(m), B = new Array(m);
    for (let i = 0; i < m; i++) {
      const x = La[3 * i], y = La[3 * i + 1], z = La[3 * i + 2];
      F[i] = X[0] * x + X[1] * y + X[2] * z - X[3];
      A[i] = [x, y, z, -1];
      const row = new Array(3 * m).fill(0);
      row[3 * i] = X[0]; row[3 * i + 1] = X[1]; row[3 * i + 2] = X[2];
      B[i] = row;
    }
    return { F, A, B };
  };
  const constraints = X => ({ C: [[2 * X[0], 2 * X[1], 2 * X[2], 0]], g: [X[0] * X[0] + X[1] * X[1] + X[2] * X[2] - 1] });

  let sol;
  try {
    sol = solveGaussHelmert({ Lb, blocks, X0, evaluate, constraints, scale: [1, 1, 1, Math.max(1, Math.abs(X0[3]))], tol, maxIter });
  } catch (err) {
    if (err instanceof SingularError || /singular|divergence/.test(err.message)) return { ok: false, error: { code: 'singularPlane', message: err.message } };
    throw err;
  }

  const n = sol.X.slice(0, 3), d = sol.X[3];
  const r = m - 3;
  const sigma0sq = sol.Omega / r;
  const QK = cofactorK(sol);
  const crit = { w: wCritical(alpha0), tau: tauCritical(alpha0, r), delta0: delta0(alpha0, power), alpha0 };
  const { right, up } = planeFrame(n, c);
  const s0 = Math.sqrt(sigma0sq);

  const pts = points.map((p, i) => {
    const Mi = sol.M[i][i], qk = QK[i][i];
    const red = qk * Mi;                                    // redundancy number of the condition
    const ok = red > 1e-9;
    // w has the sign of d: K_i ≈ −d_i / M_i at the solution
    const w = ok ? -sol.K[i] / Math.sqrt(qk) : NaN;
    const q = p.xyz.map((v, a) => v - c[a]);
    return {
      name: p.name, xyz: p.xyz,
      d: dot(n, p.xyz) - d, sigmaD: Math.sqrt(Mi),
      w, tau: w / s0, r: red, mdb: ok ? crit.delta0 / Math.sqrt(qk) : NaN,
      v: [0, 1, 2].map(a => sol.V[3 * i + a]),
      uv: [dot(q, right), dot(q, up)]
    };
  });
  const rms = Math.sqrt(pts.reduce((s, p) => s + p.d * p.d, 0) / m);
  const nominal = Math.sqrt(pts.reduce((s, p) => s + p.sigmaD * p.sigmaD, 0) / m);
  const cosInc = Math.abs(dot(n, c)) / Math.hypot(...c);

  return {
    ok: true, n, d, centroid: c, frame: { right, up },
    SigmaXapriori: sol.Q11, Omega: sol.Omega, r, m, sigma0sq, test: globalTest(sol.Omega, r, alpha), alpha,
    iterations: sol.iterations, converged: sol.converged, gMax: sol.gMax,
    points: pts, rms, nominal, incidenceDeg: Math.acos(Math.min(1, cosInc)) * 180 / Math.PI, crit
  };
}

// Signed distance and plane coordinates of further points (not in the fit) for display
export function relateToPlane(plane, p) {
  const q = p.xyz.map((v, a) => v - plane.centroid[a]);
  const Mi = dot(plane.n, p.cov.map(row => dot(row, plane.n)));
  return { name: p.name, xyz: p.xyz, d: dot(plane.n, p.xyz) - plane.d, sigmaD: Math.sqrt(Math.max(Mi, 0)), uv: [dot(q, plane.frame.right), dot(q, plane.frame.up)] };
}
