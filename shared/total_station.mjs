// Shared total-station core: polar observations <-> local Cartesian coordinates, with the
// stochastic model of the observations propagated to the coordinates.
//
// Local frame (right-handed, origin at the instrument):
//   X -> Hz = 90° (the circle reads clockwise), Y -> Hz = 0° (circle zero), Z -> zenith
//   X = S sinZ sinHz,  Y = S sinZ cosHz,  Z = S cosZ        (Z = zenith angle, S = slope distance)
// so the horizontal direction is Hz = atan2(X, Y). With the circle zero pointing north this is
// the usual (E, N, U) frame. Angles are radians, distances metres.
//
// intersecao_re_3D (adjustment.js) and ajusta_planos (io.js) keep their own copies of these
// formulas; their tests check that they agree with this module.

export const DEG = Math.PI / 180;
export const ARCSEC = Math.PI / 648000;
export const TWO_PI = 2 * Math.PI;

export const wrap2Pi = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;

export function polarToLocal(hz, zen, dist) {
  const sz = Math.sin(zen);
  return [dist * sz * Math.sin(hz), dist * sz * Math.cos(hz), dist * Math.cos(zen)];
}

export function localToPolar([x, y, z]) {
  const h = Math.hypot(x, y);
  return { hz: wrap2Pi(Math.atan2(x, y)), zen: Math.atan2(h, z), dist: Math.hypot(h, z) };
}

// ∂(X, Y, Z)/∂(Hz, Z, S): rows X, Y, Z; columns Hz, zenith, distance
export function polarJacobian(hz, zen, dist) {
  const sh = Math.sin(hz), ch = Math.cos(hz), sz = Math.sin(zen), cz = Math.cos(zen);
  return [
    [dist * sz * ch, dist * cz * sh, sz * sh],
    [-dist * sz * sh, dist * cz * ch, sz * ch],
    [0, -dist * sz, cz]
  ];
}

// ∂(Hz, Z, S)/∂(X, Y, Z): rows Hz, zenith, distance
export function localToPolarJacobian([x, y, z]) {
  const h2 = x * x + y * y, h = Math.sqrt(h2), s2 = h2 + z * z, s = Math.sqrt(s2);
  return [
    [y / h2, -x / h2, 0],
    [x * z / (s2 * h), y * z / (s2 * h), -h / s2],
    [x / s, y / s, z / s]
  ];
}

// Distance standard deviation a + b·S (linear sum, as in the manufacturers' specification and
// in the other simulators of this repository). dist in metres, result in metres.
export function distanceSigma(dist, { mm = 2, ppm = 2 } = {}) {
  return mm / 1000 + ppm * 1e-6 * dist;
}

// Standard deviations of one sighting [σHz, σZ (rad), σS (m)]. pointingMm is the lateral
// pointing/centring error at the target; it becomes an angle that adds in quadrature (for the
// horizontal direction it grows as the line of sight steepens, 1/sinZ).
export function polarSigmas(dist, zen, { angleSec = 2, zenithSec = angleSec, mm = 2, ppm = 2, pointingMm = 0 } = {}) {
  const p = pointingMm / 1000;
  const sinZ = Math.max(Math.abs(Math.sin(zen)), 1e-9);
  const sHz = Math.hypot(angleSec * ARCSEC, p / (dist * sinZ));
  const sZ = Math.hypot(zenithSec * ARCSEC, p / dist);
  return [sHz, sZ, distanceSigma(dist, { mm, ppm })];
}

// Σ_XYZ = J diag(σ²) Jᵀ. With diagonal: true only the variances are kept (the common
// simplification whose effect the simulators let students see).
export function localCovariance(hz, zen, dist, sigmas, { diagonal = false } = {}) {
  const J = polarJacobian(hz, zen, dist);
  const v = sigmas.map(s => s * s);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      const c = J[i][0] * v[0] * J[j][0] + J[i][1] * v[1] * J[j][1] + J[i][2] * v[2] * J[j][2];
      C[i][j] = C[j][i] = (diagonal && i !== j) ? 0 : c;
    }
  }
  return C;
}

// Unit vector of the line of sight and two unit vectors across it, forming the right-handed
// triad (across, up, los): across is horizontal (to the left of the sight), up is the
// steepest upward direction across the sight. Shows the "cigar" shape of Σ_XYZ.
export function lineOfSightFrame([x, y, z]) {
  const s = Math.hypot(x, y, z), h = Math.hypot(x, y);
  const los = [x / s, y / s, z / s];
  const across = h > 0 ? [-y / h, x / h, 0] : [-1, 0, 0];
  const up = [
    los[1] * across[2] - los[2] * across[1],
    los[2] * across[0] - los[0] * across[2],
    los[0] * across[1] - los[1] * across[0]
  ];
  return { los, across, up };
}

// Noisy observation of a known local point. sigmas is [σHz, σZ, σS] or a function
// (exact polar observation) -> [σHz, σZ, σS]; normal() returns N(0, 1) samples.
export function simulatePolar(xyz, sigmas, normal) {
  const exact = localToPolar(xyz);
  const s = typeof sigmas === 'function' ? sigmas(exact) : sigmas;
  return {
    hz: wrap2Pi(exact.hz + s[0] * normal()),
    zen: exact.zen + s[1] * normal(),
    dist: exact.dist + s[2] * normal(),
    sigmas: s
  };
}

// ---------------------------------------------------------------- angle formats
// Packed sexagesimal DDD.MMSS: 163.0330 = 163° 03′ 30″; digits after the 4th decimal are
// fractions of a second (163.033015 = 163° 03′ 30.15″). Returns degrees or NaN.
export function parseDmmss(text) {
  const t = String(text).trim().replace(',', '.');
  const m = t.match(/^([+-]?)(\d+)(?:\.(\d*))?$/);
  if (!m) return NaN;
  const frac = (m[3] || '').padEnd(4, '0');
  const min = Number(frac.slice(0, 2));
  const sec = Number(frac.slice(2, 4) + (frac.length > 4 ? '.' + frac.slice(4) : ''));
  if (min > 59 || sec >= 60) return NaN;
  const deg = Number(m[2]) + min / 60 + sec / 3600;
  return m[1] === '-' ? -deg : deg;
}

export const dmsToDeg = (d, m, s) => Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600);

// Degrees -> "DDD° MM′ SS.s″"
export function degToDms(deg, decimals = 1) {
  const sign = deg < 0 ? '-' : '';
  let a = Math.abs(deg);
  let d = Math.floor(a), m = Math.floor((a - d) * 60);
  let s = ((a - d) * 60 - m) * 60;
  if (Number(s.toFixed(decimals)) >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; d += 1; }
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${s.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, '0')}″`;
}

// ---------------------------------------------------------------- instrument job file
// Records "SS id,targetHeight," followed by "SD Hz,Zen,SlopeDist" (angles DDD.MMSS). The
// point id of each SS record is kept and attached to the SD that follows it.
export function parseJobFile(text) {
  const records = [], errors = [];
  let pending = null;
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const ss = line.match(/^SS\s+([^,]*),?\s*([^,]*)/);
    if (ss) { pending = { id: ss[1].trim(), targetHeight: Number(ss[2]) || 0 }; return; }
    const sd = line.match(/^SD\s+(\S+)/);
    if (!sd) return;
    const [hz, zen, dist] = sd[1].split(',');
    const rec = {
      line: i + 1,
      id: pending ? pending.id : String(records.length + 1),
      targetHeight: pending ? pending.targetHeight : 0,
      hzDeg: parseDmmss(hz), zenDeg: parseDmmss(zen), dist: Number(dist)
    };
    pending = null;
    if (![rec.hzDeg, rec.zenDeg, rec.dist].every(Number.isFinite) || !(rec.dist > 0)) {
      errors.push({ line: i + 1, text: line });
      return;
    }
    records.push(rec);
  });
  return { records, errors };
}
