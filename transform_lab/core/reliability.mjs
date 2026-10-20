// Tests of the raw total-station observations (Hz, Z, S) of every control point, from the
// adjusted transformation (data snooping as in intersecao_re_3D, one test per observation).
//
// For point i the adjustment gives g_i = (BᵀK)_i, the PV of its three coordinates, and its
// cofactor H_i = B_iᵀ Q_K B_i. The coordinates are x = x(Hz, Z, S) with Jacobian J_i, and
// Σ_T,i = J_i Σ_raw J_iᵀ, so in the space of the raw observations
//   v_raw = Σ_raw J_iᵀ g_i,   Q_v,raw = Σ_raw G_i Σ_raw,   G_i = J_iᵀ H_i J_i
// and, for observation k:
//   w_k = (J_iᵀ g_i)_k / √G_kk  ~ N(0, 1)          Baarda (σ0 known a priori)
//   τ_k = w_k / σ̂0                                 Pope (σ0 estimated)
//   r_k = σ_k² G_kk                                 redundancy number (0 … 1)
//   ∇0_k = δ0 σ_k / √r_k = δ0 / √G_kk              minimal detectable error
// Without polar observations (coordinate files) or with the diagonal VCM, the three
// coordinates are tested instead (J = I).
import { polarJacobian, DEG } from '../../shared/total_station.mjs';
import { unitFactor } from './units.mjs';
import { wCritical, tauCritical, delta0, chi2Inv } from './stats.mjs';

export const POLAR_KEYS = ['Hz', 'Z', 'S'];
export const XYZ_KEYS = ['x', 'y', 'z'];

// res: the adjustment (pointStat with g, H); items: [{ ts, cov }] of the control points in order
export function observationTests(res, items, { tsUnit = 'm', diagonal = false, alpha0 = 0.001, power = 0.8 } = {}) {
  const r = res.r, s0 = Math.sqrt(res.sigma0sq);
  const crit = { w: wCritical(alpha0), tau: tauCritical(alpha0, r), delta0: delta0(alpha0, power), T: chi2Inv(1 - alpha0, 3), alpha0, power, r };
  const f = unitFactor('m', tsUnit);
  const points = items.map(({ ts, cov }, i) => {
    const { g, H, T } = res.pointStat[i];
    const polar = !!ts.polar && !diagonal;
    const J = polar
      ? polarJacobian(ts.polar.hzDeg * DEG, ts.polar.zenDeg * DEG, ts.polar.dist).map(row => row.map(v => v * f))
      : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const sig = polar ? ts.polar.sigmas : [0, 1, 2].map(k => Math.sqrt(Math.max(cov[k][k], 0)));
    const e = [0, 1, 2].map(k => J[0][k] * g[0] + J[1][k] * g[1] + J[2][k] * g[2]);
    const HJ = [0, 1, 2].map(a => [0, 1, 2].map(k => H[a][0] * J[0][k] + H[a][1] * J[1][k] + H[a][2] * J[2][k]));
    const obs = [0, 1, 2].map(k => {
      const Gkk = J[0][k] * HJ[0][k] + J[1][k] * HJ[1][k] + J[2][k] * HJ[2][k];
      const red = sig[k] * sig[k] * Gkk;
      const ok = Gkk > 0 && red > 1e-9;
      const w = ok ? e[k] / Math.sqrt(Gkk) : NaN;
      return {
        key: polar ? POLAR_KEYS[k] : XYZ_KEYS[k], unit: polar ? (k < 2 ? 'rad' : 'm') : tsUnit,
        v: sig[k] * sig[k] * e[k], sigma: sig[k], w, tau: w / s0, r: red, mdb: ok ? crit.delta0 / Math.sqrt(Gkk) : NaN
      };
    });
    return { kind: polar ? 'polar' : 'xyz', obs, T };
  });
  return { crit, points };
}

// The observation with the largest |w| (or another statistic) among the control points
export function worstObservation(tests, names, stat = 'w') {
  let best = null;
  tests.points.forEach((p, i) => p.obs.forEach(o => {
    const v = Math.abs(o[stat]);
    if (Number.isFinite(v) && (!best || v > best.abs)) best = { name: names[i], key: o.key, value: o[stat], abs: v };
  }));
  return best;
}
