import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMETRIZATIONS, PARAM_KEYS, allForms, rotationDifference, horn, quatMatrix, matrixToQuaternion } from '../core/rotations.mjs';
import { matmul, transpose, det3, invert, eigSym, independentRows, nullBasis, identity } from '../core/linalg.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const maxDiff = (A, B) => Math.max(...A.flat().map((v, i) => Math.abs(v - B.flat()[i])));
const D = Math.PI / 180;

const PARAMS = {
  euler: [0.3, -0.5, 1.1],
  quaternion: [0.8, 0.2, -0.4, 0.3],
  matrix: null,
  axisAngle: [0.36, -0.48, 0.8, 0.9]
};
PARAMS.quaternion = PARAMS.quaternion.map(v => v / Math.hypot(...PARAMS.quaternion));
PARAMS.matrix = PARAMETRIZATIONS.matrix.fromMatrix(PARAMETRIZATIONS.euler.toMatrix([0.3, -0.5, 1.1]));

test('every parametrization gives a proper rotation when its constraints hold', () => {
  for (const k of PARAM_KEYS) {
    const P = PARAMETRIZATIONS[k], R = P.toMatrix(PARAMS[k]);
    close(maxDiff(matmul(transpose(R), R), identity(3)), 0, 1e-12, `${k} RᵀR`);
    close(det3(R), 1, 1e-12, `${k} det`);
    P.constraints(PARAMS[k]).forEach(g => close(g, 0, 1e-12, `${k} constraint`));
    assert.equal(P.constraints(PARAMS[k]).length, P.nConstraints);
  }
});

test('∂R/∂p and the constraint Jacobians match central differences', () => {
  const h = 1e-6;
  for (const k of PARAM_KEYS) {
    const P = PARAMETRIZATIONS[k], p = PARAMS[k], dR = P.derivatives(p);
    for (let j = 0; j < P.size; j++) {
      const a = p.slice(), b = p.slice(); a[j] += h; b[j] -= h;
      const Ra = P.toMatrix(a), Rb = P.toMatrix(b);
      const num = Ra.map((r, i) => r.map((v, c) => (v - Rb[i][c]) / (2 * h)));
      close(maxDiff(num, dR[j]), 0, 1e-7, `${k} ∂R/∂p${j}`);
    }
    const Cj = P.constraintJacobian(p);
    for (let j = 0; j < P.size; j++) {
      const a = p.slice(), b = p.slice(); a[j] += h; b[j] -= h;
      const ga = P.constraints(a), gb = P.constraints(b);
      ga.forEach((v, i) => close(Cj[i][j], (v - gb[i]) / (2 * h), 1e-7, `${k} ∂g${i}/∂p${j}`));
    }
  }
});

test('fromMatrix round-trips through toMatrix, including θ≈0, θ=π and φ near ±90°', () => {
  const cases = {
    euler: [[0.4, 0.2, -0.3], [3.0, 1.4, 2.0], [-1.2, -1.5, 0.7]],
    quaternion: [[1, 0, 0, 0], [0, 1, 0, 0], [0.5, 0.5, 0.5, 0.5]],
    axisAngle: [[0, 0, 1, 1e-9], [0.6, 0, 0.8, Math.PI], [0, 1, 0, 2.5]],
    matrix: [PARAMS.matrix]
  };
  for (const [k, list] of Object.entries(cases)) {
    const P = PARAMETRIZATIONS[k];
    for (const p of list) {
      const R = P.toMatrix(p), back = P.toMatrix(P.fromMatrix(R));
      close(maxDiff(R, back), 0, 1e-9, `${k} ${JSON.stringify(p)}`);
    }
  }
  const R = PARAMETRIZATIONS.euler.toMatrix([0.3, 1.5, -0.8]);
  const forms = allForms(R);
  PARAM_KEYS.forEach(k => close(maxDiff(PARAMETRIZATIONS[k].toMatrix(forms[k]), R), 0, 1e-10, k));
});

test('Euler convention: R[2][0] = sin φ, so φ = 90° is the gimbal lock', () => {
  const R = PARAMETRIZATIONS.euler.toMatrix([0.7, 90 * D, -0.2]);
  close(R[2][0], 1, 1e-15);
  close(PARAMETRIZATIONS.euler.singularity([0.7, 90 * D, -0.2]).measure, 0, 1e-15);
  // ω and κ only enter through their combination (ω + κ here): two different pairs give the same matrix
  const R2 = PARAMETRIZATIONS.euler.toMatrix([0.7 + 0.4, 90 * D, -0.2 - 0.4]);
  close(maxDiff(R, R2), 0, 1e-12);
});

test('rotationDifference is stable for tiny and large angles', () => {
  const Ra = PARAMETRIZATIONS.euler.toMatrix([0.1, 0.2, 0.3]);
  const small = PARAMETRIZATIONS.axisAngle.toMatrix([0, 0, 1, 1e-9]);
  close(rotationDifference(Ra, matmul(Ra, small)), 1e-9, 1e-15);
  close(rotationDifference(identity(3), PARAMETRIZATIONS.axisAngle.toMatrix([1, 0, 0, Math.PI])), Math.PI, 1e-12);
});

test('Horn recovers a similarity on planar noise-free data', () => {
  const R = PARAMETRIZATIONS.euler.toMatrix([0.5, -0.9, 2.4]), lam = 0.01, t = [3, -2, 8];
  const src = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) src.push([i * 3, j * 3, 0]);
  const dst = src.map(s => [0, 1, 2].map(r => t[r] + lam * (R[r][0] * s[0] + R[r][1] * s[1] + R[r][2] * s[2])));
  const h = horn(src, dst);
  close(h.lambda, lam, 1e-14); close(maxDiff(h.R, R), 0, 1e-12);
  h.t.forEach((v, i) => close(v, t[i], 1e-12));
  // exact on three points
  const tri = [0, 5, 1].map(i => i); // (0,0), (3,0)... non-collinear picks: indices of (0,0), (0,3·... )
  const pick = [src.findIndex(s => s[0] === 0 && s[1] === 0), src.findIndex(s => s[0] === 3 && s[1] === 0), src.findIndex(s => s[0] === 0 && s[1] === 3)];
  const h3 = horn(pick.map(i => src[i]), pick.map(i => dst[i]));
  close(maxDiff(h3.R, R), 0, 1e-10);
});

test('quaternion helpers are consistent', () => {
  const q = [0.5, 0.5, -0.5, 0.5];
  close(maxDiff(quatMatrix(matrixToQuaternion(quatMatrix(q))), quatMatrix(q)), 0, 1e-12);
});

test('linalg: relative-pivot inverse, independent rows, null basis', () => {
  const A = [[4, 1, 0], [1, 3, 1e-3], [0, 1e-3, 2e-8]];
  close(maxDiff(matmul(A, invert(A)), identity(3)), 0, 1e-7);
  assert.throws(() => invert([[1, 2], [2, 4]]), /singular/);
  assert.throws(() => invert([[1, 2], [2, 4 + 1e-15]]), /singular/);
  assert.deepEqual(independentRows([[1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 0], [0, 0, 1]]), [0, 1, 4]);
  const Z = nullBasis([[1, 1, 0]], 3);
  assert.equal(Z[0].length, 2);
  const { values } = eigSym([[2, 1], [1, 2]]);
  close(values[0], 1, 1e-12); close(values[1], 3, 1e-12);
});

// The closed forms printed on the theory page (§3.3–3.5) must be the ones the code uses
test('theory page formulas: r_ij of each parametrization and the Euler derivatives', () => {
  const [w, f, k] = [0.41, -0.73, 1.27], cw = Math.cos(w), sw = Math.sin(w), cf = Math.cos(f), sf = Math.sin(f), ck = Math.cos(k), sk = Math.sin(k);
  const euler = [
    [cf * ck, cw * sk + sw * sf * ck, sw * sk - cw * sf * ck],
    [-cf * sk, cw * ck - sw * sf * sk, sw * ck + cw * sf * sk],
    [sf, -sw * cf, cw * cf]
  ];
  close(maxDiff(euler, PARAMETRIZATIONS.euler.toMatrix([w, f, k])), 0, 1e-15, 'Euler r_ij');
  const [dw, df, dk] = PARAMETRIZATIONS.euler.derivatives([w, f, k]), R = euler;
  // ∂R/∂ω: columns (0, −r_·3, r_·2);  ∂R/∂κ: rows (r_2·, −r_1·, 0)
  close(maxDiff(dw, R.map(r => [0, -r[2], r[1]])), 0, 1e-15, '∂R/∂ω');
  close(maxDiff(dk, [R[1], R[0].map(v => -v), [0, 0, 0]]), 0, 1e-15, '∂R/∂κ');
  close(maxDiff(df, [[-sf * ck, sw * cf * ck, -cw * cf * ck], [sf * sk, -sw * cf * sk, cw * cf * sk], [cf, sw * sf, -cw * sf]]), 0, 1e-15, '∂R/∂φ');
  // small angles: R ≈ [[1, κ, −φ], [−κ, 1, ω], [φ, −ω, 1]]
  const e = 1e-6, small = PARAMETRIZATIONS.euler.toMatrix([e, 2 * e, 3 * e]);
  close(maxDiff(small, [[1, 3 * e, -2 * e], [-3 * e, 1, e], [2 * e, -e, 1]]), 0, 1e-11, 'small angles');
  const [q0, q1, q2, q3] = PARAMS.quaternion;
  const quat = [
    [q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
    [2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
    [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3]
  ];
  close(maxDiff(quat, quatMatrix(PARAMS.quaternion)), 0, 1e-15, 'quaternion r_ij');
  const [nx, ny, nz, th] = PARAMS.axisAngle, c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  const axis = [
    [c + nx * nx * C, nx * ny * C - nz * s, nx * nz * C + ny * s],
    [ny * nx * C + nz * s, c + ny * ny * C, ny * nz * C - nx * s],
    [nz * nx * C - ny * s, nz * ny * C + nx * s, c + nz * nz * C]
  ];
  close(maxDiff(axis, PARAMETRIZATIONS.axisAngle.toMatrix(PARAMS.axisAngle)), 0, 1e-15, 'axis–angle r_ij');
});
