// A priori stochastic model of GNSS baselines. Inputs in mm / ppm / km, outputs in m².
// Nominal precision is specified in the local geodetic frame (E, N, U) of the baseline
// and rotated to geocentric (ΔX, ΔY, ΔZ): Σ_XYZ = Rᵀ Σ_ENU R (R as in Navipedia).
import { llhToEcef, ecefToLlh, enuRotation } from '../../network_preanalysis/network/coordinates.mjs';

// Catalogue values (RMS ≈ 1σ) typical of geodetic receivers, e.g. the Trimble R10/R12
// data sheet; RTK assumes a single baseline < 30 km. IBGE (2008, Table 3.2) gives one
// value for the whole baseline: 5–10 mm + 1 ppm up to 20 km (10 mm used: conservative end)
// and 5 mm + 1 ppm above 20 km with long sessions; it does not separate H and V.
export const PRESETS = Object.freeze({
  static: Object.freeze({ aH: 3, bH: 0.5, aV: 5, bV: 0.5 }),
  hpStatic: Object.freeze({ aH: 3, bH: 0.1, aV: 3.5, bV: 0.4 }),
  rtk: Object.freeze({ aH: 8, bH: 1, aV: 15, bV: 1 }),
  ibge2008: Object.freeze({ aH: 10, bH: 1, aV: 10, bV: 1, table: true }),
});
export const PRESET_IDS = ['static', 'hpStatic', 'rtk', 'ibge2008', 'custom'];

// IBGE (2008), Recomendações para levantamentos relativos estáticos – GPS, Table 3.2.
// Lower bound of each observation-time range; single frequency only up to 20 km.
export const IBGE_TABLE = Object.freeze([
  { maxKm: 5, minMinutes: 5, singleFrequency: true, aMm: 10 },
  { maxKm: 10, minMinutes: 10, singleFrequency: true, aMm: 10 },
  { maxKm: 20, minMinutes: 10, singleFrequency: true, aMm: 10 },
  { maxKm: 50, minMinutes: 120, singleFrequency: false, aMm: 5 },
  { maxKm: 100, minMinutes: 180, singleFrequency: false, aMm: 5 },
  { maxKm: Infinity, minMinutes: 240, singleFrequency: false, aMm: 5 },
]);
export const ibgeGuide = km => IBGE_TABLE.find(row => km <= row.maxKm);
export const IBGE_MIN_A = 5; // smallest constant term of the IBGE table (mm)

export const defaultSettings = () => ({
  preset: 'static', ...PRESETS.static,
  combination: 'linear',      // 'linear': σ = a + b·D ; 'quadratic': σ = √(a² + (b·D)²)
  horizontal: 'component',    // 'component': σE = σN = σH ; 'radial': σH is 2D, σE = σN = σH/√2
  setupNew: { centering: 1, height: 2 }, // mm, per occupation (tribrach / tape)
  setupCors: { centering: 0, height: 0 }, // forced centering on a pillar
  sessionCorrelation: false,
  trivial: 'flag',            // 'flag': keep dependent baselines and warn ; 'exclude': drop them
  frequency: 'dual',          // 'dual' | 'single' (L1 only)
  geoidUndulation: 0,         // N0 (m): h = H + N0 for points placed on the DEM
  statistics: { alpha: 0.001, power: 0.8 },
});

export function validateSettings(s) {
  const finite = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  if (!s || !PRESET_IDS.includes(s.preset) || !['linear', 'quadratic'].includes(s.combination) ||
      !['component', 'radial'].includes(s.horizontal) || !['flag', 'exclude'].includes(s.trivial) ||
      !['dual', 'single'].includes(s.frequency) || typeof s.sessionCorrelation !== 'boolean') throw Error('invalidSettings');
  if (![s.aH, s.aV].every(x => finite(x, 0, 1000)) || ![s.bH, s.bV].every(x => finite(x, 0, 1000)) ||
      !(s.aH > 0 || s.bH > 0) || !(s.aV > 0 || s.bV > 0)) throw Error('invalidSigma');
  for (const setup of [s.setupNew, s.setupCors])
    if (!setup || !finite(setup.centering, 0, 100) || !finite(setup.height, 0, 100)) throw Error('invalidSetup');
  if (!finite(s.geoidUndulation, -200, 200)) throw Error('coordinateRange');
  if (!s.statistics || !(s.statistics.alpha >= 1e-6 && s.statistics.alpha <= 0.2) ||
      !(s.statistics.power >= 0.5 && s.statistics.power < 0.9999)) throw Error('invalidStatistics');
  return s;
}

export const combine = (a, bD, mode) => mode === 'quadratic' ? Math.hypot(a, bD) : a + bD;

/** Nominal (receiver) part only, per component, in mm. km = baseline length. */
export function nominalSigma(km, s) {
  const row = ibgeGuide(km);
  const aH = s.preset === 'ibge2008' ? row.aMm : s.aH, aV = s.preset === 'ibge2008' ? row.aMm : s.aV;
  const sigmaH = combine(aH, s.bH * km, s.combination), sigmaV = combine(aV, s.bV * km, s.combination);
  const horizontal = s.horizontal === 'radial' ? sigmaH / Math.SQRT2 : sigmaH;
  return { aH, aV, sigmaH, sigmaV, E: horizontal, N: horizontal, U: sigmaV };
}

/** Setup errors of one occupation (mm). point.setup overrides the defaults by kind. */
export function setupSigma(point, s) {
  const fallback = point.kind === 'cors' ? s.setupCors : s.setupNew;
  const setup = point.setup ?? fallback;
  return { centering: setup.centering ?? fallback.centering, height: setup.height ?? fallback.height };
}

export const mat3 = rows => rows.map(r => r.slice());
export function rotateEnuToXyz(cov, lat, lon) {
  const r = enuRotation({ lat, lon }), out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) out[i][j] += r[k][i] * cov[k][l] * r[l][j];
  return out;
}
export function rotateXyzToEnu(cov, lat, lon) {
  const r = enuRotation({ lat, lon }), out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) out[i][j] += r[i][k] * cov[k][l] * r[j][l];
  return out;
}
export const unitVectors = (lat, lon) => enuRotation({ lat, lon }); // rows: e, n, u in XYZ

export const pointXyz = p => llhToEcef({ lat: p.lat, lon: p.lon, h: p.h });
export function baselineGeometry(from, to) {
  const a = pointXyz(from), b = pointXyz(to), delta = b.map((x, i) => x - a[i]);
  const length = Math.hypot(...delta);
  if (!(length > 1e-3)) throw Error('coincident');
  const mid = ecefToLlh(a.map((x, i) => (x + b[i]) / 2));
  return { from: a, to: b, delta, length, km: length / 1000, mid };
}

const mm2 = x => (x / 1000) ** 2;
/** Independent-baseline model: receiver spec + both setups, in ENU at the midpoint. */
export function baselineCovariance(from, to, s, geometry = baselineGeometry(from, to)) {
  const nominal = nominalSigma(geometry.km, s), a = setupSigma(from, s), b = setupSigma(to, s);
  const enu = [[mm2(nominal.E) + mm2(a.centering) + mm2(b.centering), 0, 0],
    [0, mm2(nominal.N) + mm2(a.centering) + mm2(b.centering), 0],
    [0, 0, mm2(nominal.U) + mm2(a.height) + mm2(b.height)]];
  return { geometry, nominal, enu, xyz: rotateEnuToXyz(enu, geometry.mid.lat, geometry.mid.lon) };
}

/** Station share of the session model, ENU (m²): half the constant receiver term + setup. */
export function stationShare(point, s) {
  const aH = s.preset === 'ibge2008' ? IBGE_MIN_A : s.aH, aV = s.preset === 'ibge2008' ? IBGE_MIN_A : s.aV;
  const aE = s.horizontal === 'radial' ? aH / Math.SQRT2 : aH, setup = setupSigma(point, s);
  return [[mm2(aE) / 2 + mm2(setup.centering), 0, 0], [0, mm2(aE) / 2 + mm2(setup.centering), 0],
    [0, 0, mm2(aV) / 2 + mm2(setup.height)]];
}
/** Baseline share of the session model, ENU (m²): what the nominal σ² adds to the constant term. */
export function lengthShare(km, s) {
  const n = nominalSigma(km, s);
  const aH = s.preset === 'ibge2008' ? IBGE_MIN_A : s.aH, aV = s.preset === 'ibge2008' ? IBGE_MIN_A : s.aV;
  const aE = s.horizontal === 'radial' ? aH / Math.SQRT2 : aH;
  return [[mm2(n.E) - mm2(aE), 0, 0], [0, mm2(n.N) - mm2(aE), 0], [0, 0, mm2(n.U) - mm2(aV)]];
}

/**
 * Covariance of the baselines measured in one session, modelled as differences of
 * station errors (shared by every baseline at that station: half of the constant term
 * plus that occupation's setup) plus an independent length-dependent part per baseline.
 * Each baseline keeps the variance of the independent model (to rotation differences);
 * baselines sharing a station get covariance ±Σ_station (ρ = 0.5 for two equal radial lines).
 * items: [{ from, to, geometry }] with point objects. Returns a 3k × 3k matrix (m²).
 */
export function sessionCovariance(items, s) {
  const k = items.length, q = Array.from({ length: 3 * k }, () => Array(3 * k).fill(0));
  const stations = new Map();
  items.forEach((item, index) => {
    for (const [point, sign] of [[item.from, -1], [item.to, 1]]) {
      if (!stations.has(point.id)) stations.set(point.id, { point, uses: [] });
      stations.get(point.id).uses.push({ index, sign });
    }
    const g = item.geometry, share = rotateEnuToXyz(lengthShare(g.km, s), g.mid.lat, g.mid.lon);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) q[3 * index + i][3 * index + j] += share[i][j];
  });
  for (const { point, uses } of stations.values()) {
    const share = rotateEnuToXyz(stationShare(point, s), point.lat, point.lon);
    for (const p of uses) for (const r of uses)
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        q[3 * p.index + i][3 * r.index + j] += p.sign * r.sign * share[i][j];
  }
  return q;
}
