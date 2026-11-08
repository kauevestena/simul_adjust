// distorcao_utm model: pure maths, no DOM (runs in the page, in the worker and in node:test).
// Angles in degrees on the public API, metres everywhere else; WGS84 throughout.
//  - ECEF <-> geodetic: same iteration as network_preanalysis/network/coordinates.mjs, batched.
//  - UTM: Krüger series to n^6, Karney (2011) "Transverse Mercator with an accuracy of a
//    few nanometers", J. Geodesy 85(8), eqs. 6-13 (forward, scale k and convergence γ).
//  - Scene: cubic buildings plumb along their own ellipsoid normal, flat terrain at constant
//    ellipsoidal height h0 (it follows the ellipsoid), sampled as a point cloud stored in ECEF.
import { WGS84, llhToEcef, ecefToLlh, enuRotation } from '../network_preanalysis/network/coordinates.mjs';
import { sampleGeoid } from './geoid.mjs';

export { WGS84, llhToEcef, ecefToLlh, enuRotation };
const RAD = Math.PI / 180;
const A = WGS84.a, F = WGS84.f, E2 = F * (2 - F), E = Math.sqrt(E2), B = A * (1 - F), EP2 = E2 / (1 - E2);
export const UTM_K0 = 0.9996;
export const FALSE_EASTING = 500000, FALSE_NORTHING_SOUTH = 10000000;

// ---------------------------------------------------------------- limits & defaults
export const LIMITS = Object.freeze({
  lat: [-80, 84], lon: [-180, 180], h0: [-500, 9000],
  spanWE: [100, 100000], spanNS: [100, 100000],
  grid: [1, 12], sizeMin: [5, 300], sizeMax: [5, 300],
  buildingDensity: [0.01, 25], terrainDensity: [0.0001, 4],
});
export const DEFAULTS = Object.freeze({
  lat: -26.229, lon: -52.671, h0: 1000,
  spanWE: 2000, spanNS: 2000,
  grid: 5, sizeMin: 20, sizeMax: 120,
  buildingDensity: 1, terrainDensity: 0.1,
  geoid: false, zone: 'auto', seed: 1,
});
/** Point budget: chosen from tests/bench.mjs (see README) — keeps generation ≲ 1–2 s. */
export const MAX_POINTS = 2_000_000;
export const MAX_POINTS_LOW = 1_000_000;

const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
export function normalizeParams(p = {}) {
  const q = { ...DEFAULTS, ...p };
  for (const key of ['lat', 'lon', 'h0', 'spanWE', 'spanNS', 'sizeMin', 'sizeMax', 'buildingDensity', 'terrainDensity']) {
    const v = Number(q[key]);
    q[key] = clamp(Number.isFinite(v) ? v : DEFAULTS[key], LIMITS[key]);
  }
  q.grid = Math.round(clamp(Number(q.grid) || DEFAULTS.grid, LIMITS.grid));
  if (q.sizeMin > q.sizeMax) [q.sizeMin, q.sizeMax] = [q.sizeMax, q.sizeMin];
  q.seed = (Number(q.seed) >>> 0) || 1;
  q.geoid = Boolean(q.geoid);
  q.zone = ['auto', 'west', 'east'].includes(q.zone) ? q.zone : 'auto';
  return q;
}

// ---------------------------------------------------------------- RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- ellipsoid helpers
/** Radii of curvature: meridian M, prime vertical N, Gaussian mean ρ = √(MN). */
export function radii(latDeg) {
  const s = Math.sin(latDeg * RAD), w2 = 1 - E2 * s * s, w = Math.sqrt(w2);
  const N = A / w, M = A * (1 - E2) / (w2 * w);
  return { M, N, rho: Math.sqrt(M * N) };
}
/** Elevation (height) factor ρ/(ρ+h): reduces a horizontal length at height h to the ellipsoid. */
export function elevationFactor(latDeg, h) {
  const { rho } = radii(latDeg);
  return rho / (rho + h);
}

/** Batch ECEF -> geodetic (radians in phi/lam, metres in h). Same fixed point as coordinates.mjs. */
export function ecefToGeodeticInto(x, y, z, out) {
  const p = Math.hypot(x, y);
  out.lam = Math.atan2(y, x);
  // Bowring's starting value, then the fixed-point iteration (2-3 steps reach 1e-15 rad near the surface)
  const t = Math.atan2(z * A, p * B), st = Math.sin(t), ct = Math.cos(t);
  let phi = Math.atan2(z + EP2 * B * st * st * st, p - E2 * A * ct * ct * ct);
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(phi), v = A / Math.sqrt(1 - E2 * s * s);
    const next = Math.atan2(z + E2 * v * s, p);
    if (Math.abs(next - phi) < 1e-15) { phi = next; break; }
    phi = next;
  }
  const s = Math.sin(phi), c = Math.cos(phi);
  out.phi = phi;
  out.h = p * c + z * s - A * Math.sqrt(1 - E2 * s * s);
  return out;
}

// ---------------------------------------------------------------- UTM (Krüger / Karney 2011)
const n = F / (2 - F), n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
const RECT = A / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256);  // rectifying radius A
const ALPHA = [
  n / 2 - 2 / 3 * n2 + 5 / 16 * n3 + 41 / 180 * n4 - 127 / 288 * n5 + 7891 / 37800 * n6,
  13 / 48 * n2 - 3 / 5 * n3 + 557 / 1440 * n4 + 281 / 630 * n5 - 1983433 / 1935360 * n6,
  61 / 240 * n3 - 103 / 140 * n4 + 15061 / 26880 * n5 + 167603 / 181440 * n6,
  49561 / 161280 * n4 - 179 / 168 * n5 + 6601661 / 7257600 * n6,
  34729 / 80640 * n5 - 3418889 / 1995840 * n6,
  212378941 / 319334400 * n6,
];
export const zoneOf = lonDeg => Math.min(60, Math.max(1, Math.floor((((lonDeg + 180) % 360) + 360) % 360 / 6) + 1));
export const centralMeridian = zone => -183 + 6 * zone;
/** Zone actually used for the whole cloud: the centre's zone, or a neighbour (to show off-zone distortion). */
export function chooseZone(lonDeg, mode = 'auto') {
  const z = zoneOf(lonDeg);
  if (mode === 'west') return z === 1 ? 60 : z - 1;
  if (mode === 'east') return z === 60 ? 1 : z + 1;
  return z;
}

/**
 * Transverse Mercator (UTM k0, false easting/northing) of φ, λ in radians for central meridian lam0 (rad).
 * Writes E, N, k (point scale) and gamma (meridian convergence, rad: bearing of grid north
 * clockwise from true north, the same sign as PROJ's meridian_convergence) into out.
 */
export function utmForwardInto(phi, lam, lam0, south, out) {
  let l = lam - lam0;
  l -= 2 * Math.PI * Math.round(l / (2 * Math.PI));
  const cl = Math.cos(l), sl = Math.sin(l);
  const tau = Math.tan(phi);
  const sig = Math.sinh(E * Math.atanh(E * tau / Math.sqrt(1 + tau * tau)));
  const taup = tau * Math.sqrt(1 + sig * sig) - sig * Math.sqrt(1 + tau * tau);
  const xip = Math.atan2(taup, cl);
  const etap = Math.asinh(sl / Math.sqrt(taup * taup + cl * cl));
  // complex ζ' = ξ' + iη'; sin(2jζ'), cos(2jζ') by Chebyshev recurrences from one sin/cos/sinh/cosh
  const s2 = Math.sin(2 * xip), c2 = Math.cos(2 * xip), sh2 = Math.sinh(2 * etap), ch2 = Math.cosh(2 * etap);
  const c1r = c2 * ch2, c1i = -s2 * sh2;   // cos(2ζ')
  const s1r = s2 * ch2, s1i = c2 * sh2;    // sin(2ζ')
  let sPr = 0, sPi = 0, sr = s1r, si = s1i; // s_{j-1}, s_j
  let cPr = 1, cPi = 0, cr = c1r, ci = c1i; // c_{j-1}, c_j
  let xi = xip, eta = etap, p = 1, q = 0;
  for (let j = 1; j <= 6; j++) {
    const a = ALPHA[j - 1];
    xi += a * sr; eta += a * si;             // ζ = ζ' + Σ α_j sin(2jζ')
    p += 2 * j * a * cr; q -= 2 * j * a * ci; // dζ/dζ' = 1 + Σ 2jα_j cos(2jζ') = p' − i q'
    // next: x_{j+1} = 2 cos(2ζ') x_j − x_{j−1}
    const nsr = 2 * (c1r * sr - c1i * si) - sPr, nsi = 2 * (c1r * si + c1i * sr) - sPi;
    const ncr = 2 * (c1r * cr - c1i * ci) - cPr, nci = 2 * (c1r * ci + c1i * cr) - cPi;
    sPr = sr; sPi = si; sr = nsr; si = nsi;
    cPr = cr; cPi = ci; cr = ncr; ci = nci;
  }
  out.E = FALSE_EASTING + UTM_K0 * RECT * eta;
  out.N = UTM_K0 * RECT * xi + (south ? FALSE_NORTHING_SOUTH : 0);
  const sphi = Math.sin(phi);
  const kp = Math.sqrt(1 - E2 * sphi * sphi) * Math.sqrt(1 + tau * tau) / Math.sqrt(taup * taup + cl * cl);
  out.k = UTM_K0 * (RECT / A) * Math.hypot(p, q) * kp;
  out.gamma = Math.atan2(taup * sl, Math.sqrt(1 + taup * taup) * cl) + Math.atan2(q, p);
  return out;
}

/** Convenience wrapper with degrees: { E, N, k, gamma (deg), zone, south }. */
export function utmForward(latDeg, lonDeg, zone = zoneOf(lonDeg), south = latDeg < 0) {
  const o = utmForwardInto(latDeg * RAD, lonDeg * RAD, centralMeridian(zone) * RAD, south, {});
  return { E: o.E, N: o.N, k: o.k, gamma: o.gamma / RAD, zone, south };
}

// ---------------------------------------------------------------- scene
/** Building layout (deterministic for a seed): n×n cubes on the tangent plane grid. */
export function buildingLayout(p) {
  const rng = mulberry32(p.seed);
  const cw = p.spanWE / p.grid, ch = p.spanNS / p.grid;
  const cap = 0.8 * Math.min(cw, ch);
  const list = [];
  for (let r = 0; r < p.grid; r++) {
    for (let c = 0; c < p.grid; c++) {
      const u = rng();
      const size = Math.max(1, Math.min(cap, p.sizeMin + u * (p.sizeMax - p.sizeMin)));
      list.push({ id: list.length, row: r, col: c, e: (c + 0.5) * cw - p.spanWE / 2, n: (r + 0.5) * ch - p.spanNS / 2, size });
    }
  }
  return { list, cellWE: cw, cellNS: ch, capped: p.sizeMax > cap };
}

const facePoints = (size, density) => {
  const m = Math.max(2, Math.round(size * Math.sqrt(density)));
  return m * m;
};
/** Point counts for given densities (terrain area excludes footprints). */
export function estimateCounts(p, layout = buildingLayout(p), densities = p) {
  let foot = 0, buildings = 0;
  for (const b of layout.list) {
    foot += b.size * b.size;
    buildings += 5 * facePoints(b.size, densities.buildingDensity);
  }
  const terrain = Math.max(0, Math.round((p.spanWE * p.spanNS - foot) * densities.terrainDensity));
  return { terrain, buildings, total: terrain + buildings };
}
/** Clamp densities to the point budget: terrain first, then buildings (kept ≥ 2×2 per face). */
export function applyBudget(p, maxPoints = MAX_POINTS, layout = buildingLayout(p)) {
  const want = estimateCounts(p, layout);
  let buildingDensity = p.buildingDensity, terrainDensity = p.terrainDensity;
  if (want.total <= maxPoints) return { buildingDensity, terrainDensity, reduced: false, want, counts: want, maxPoints };
  let bAvail = want.buildings;
  if (want.buildings > 0.8 * maxPoints) {
    // shrink buildings to 80 % of the budget (bisection on density; counts are monotone)
    let lo = 0, hi = buildingDensity;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (estimateCounts(p, layout, { buildingDensity: mid, terrainDensity: 0 }).buildings <= 0.8 * maxPoints) lo = mid; else hi = mid;
    }
    buildingDensity = lo;
    bAvail = estimateCounts(p, layout, { buildingDensity, terrainDensity: 0 }).buildings;
  }
  const area = Math.max(1, want.terrain / Math.max(p.terrainDensity, 1e-12));
  terrainDensity = Math.min(p.terrainDensity, Math.max(0, 0.995 * (maxPoints - bAvail) / area)); // 0.5 % margin for grid rounding
  const counts = estimateCounts(p, layout, { buildingDensity, terrainDensity });
  return { buildingDensity, terrainDensity, reduced: true, want, counts, maxPoints };
}

/** Local frame (ECEF origin + E/N/U unit vectors) on the h = h0 surface below tangent-plane point (e, n). */
function surfaceFrame(O, R0, e, nn, h0, tmp) {
  const x = O[0] + e * R0[0][0] + nn * R0[1][0];
  const y = O[1] + e * R0[0][1] + nn * R0[1][1];
  const z = O[2] + e * R0[0][2] + nn * R0[1][2];
  ecefToGeodeticInto(x, y, z, tmp);
  const lat = tmp.phi / RAD, lon = tmp.lam / RAD;
  return { origin: llhToEcef({ lat, lon, h: h0 }), R: enuRotation({ lat, lon }), lat, lon };
}

/**
 * Generate the ECEF point cloud.
 * Returns { X, Y, Z (Float64Array), cls (Uint8Array: 0 terrain, 1 roof, 2 wall E/W, 3 wall N/S),
 * bid (Int16Array building id or −1), buildings (with ECEF corners), counts, budget }.
 */
export function generateCloud(params, { maxPoints = MAX_POINTS } = {}) {
  const p = normalizeParams(params);
  const layout = buildingLayout(p);
  const budget = applyBudget(p, maxPoints, layout);
  const center = { lat: p.lat, lon: p.lon, h: p.h0 };
  const O = llhToEcef(center), R0 = enuRotation(center);
  const tmp = {};
  const rngJ = mulberry32((p.seed ^ 0x9e3779b9) >>> 0);
  // buildings
  const buildings = layout.list.map(b => {
    const f = surfaceFrame(O, R0, b.e, b.n, p.h0, tmp);
    const m = Math.max(2, Math.round(b.size * Math.sqrt(budget.buildingDensity)));
    const corners = [];
    for (const zc of [0, 1]) for (const yc of [-0.5, 0.5]) for (const xc of [-0.5, 0.5]) {
      const lx = xc * b.size, ly = yc * b.size, lz = zc * b.size;
      corners.push([0, 1, 2].map(i => f.origin[i] + lx * f.R[0][i] + ly * f.R[1][i] + lz * f.R[2][i]));
    }
    return { ...b, lat: f.lat, lon: f.lon, origin: f.origin, R: f.R, m, corners };
  });
  const nb = buildings.reduce((s, b) => s + 5 * b.m * b.m, 0);
  // terrain grid (stratified jitter on the tangent plane)
  const st = budget.terrainDensity > 0 ? 1 / Math.sqrt(budget.terrainDensity) : Infinity;
  const nx = Number.isFinite(st) ? Math.max(1, Math.round(p.spanWE / st)) : 0;
  const ny = Number.isFinite(st) ? Math.max(1, Math.round(p.spanNS / st)) : 0;
  const cap = nb + nx * ny;
  const X = new Float64Array(cap), Y = new Float64Array(cap), Z = new Float64Array(cap);
  const cls = new Uint8Array(cap), bid = new Int16Array(cap);
  let k = 0;
  for (const b of buildings) {
    const { origin: o, R, m, size: a } = b;
    const put = (lx, ly, lz, c) => {
      X[k] = o[0] + lx * R[0][0] + ly * R[1][0] + lz * R[2][0];
      Y[k] = o[1] + lx * R[0][1] + ly * R[1][1] + lz * R[2][1];
      Z[k] = o[2] + lx * R[0][2] + ly * R[1][2] + lz * R[2][2];
      cls[k] = c; bid[k] = b.id; k++;
    };
    const d = a / m;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
      const u = (i + rngJ()) * d - a / 2, v = (j + rngJ()) * d;
      put(u, (j + rngJ()) * d - a / 2, a, 1);          // roof
      put(-a / 2, u, v, 2); put(a / 2, -u, v, 2);       // west / east walls
      put(u, -a / 2, v, 3); put(-u, a / 2, v, 3);       // south / north walls
    }
  }
  const cw = layout.cellWE, ch = layout.cellNS;
  const dx = p.spanWE / Math.max(nx, 1), dy = p.spanNS / Math.max(ny, 1);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const e = (ix + rngJ()) * dx - p.spanWE / 2, nn = (iy + rngJ()) * dy - p.spanNS / 2;
      const x = O[0] + e * R0[0][0] + nn * R0[1][0];
      const y = O[1] + e * R0[0][1] + nn * R0[1][1];
      const z = O[2] + e * R0[0][2] + nn * R0[1][2];
      // inside the footprint of the building of this cell? (test in the building's own frame)
      const c = Math.min(p.grid - 1, Math.max(0, Math.floor((e + p.spanWE / 2) / cw)));
      const r = Math.min(p.grid - 1, Math.max(0, Math.floor((nn + p.spanNS / 2) / ch)));
      const b = buildings[r * p.grid + c];
      const qx = x - b.origin[0], qy = y - b.origin[1], qz = z - b.origin[2];
      const le = qx * b.R[0][0] + qy * b.R[0][1] + qz * b.R[0][2];
      const ln = qx * b.R[1][0] + qy * b.R[1][1] + qz * b.R[1][2];
      if (Math.abs(le) < b.size / 2 && Math.abs(ln) < b.size / 2) continue;
      // push the tangent-plane point along the normal onto the surface h = h0
      ecefToGeodeticInto(x, y, z, tmp);
      const dh = p.h0 - tmp.h, cp = Math.cos(tmp.phi);
      X[k] = x + dh * cp * Math.cos(tmp.lam);
      Y[k] = y + dh * cp * Math.sin(tmp.lam);
      Z[k] = z + dh * Math.sin(tmp.phi);
      cls[k] = 0; bid[k] = -1; k++;
    }
  }
  const terrain = k - nb;
  return {
    params: p, budget, buildings, center, O, R0,
    X: X.subarray(0, k), Y: Y.subarray(0, k), Z: Z.subarray(0, k), cls: cls.subarray(0, k), bid: bid.subarray(0, k),
    counts: { buildings: nb, terrain, total: k },
  };
}

// ---------------------------------------------------------------- transformations
/**
 * Projection context: centre, zone, rigid reference rotation θ and the centre's UTM/height.
 * θ = direction of a 1 m east step (ENU) on the UTM grid, so ref = R(θ)·(e, n) aligns the
 * undistorted ENU cloud with the grid (θ ≈ γ0: true east is turned by the convergence). The geoid (optional) maps h -> H = h − N.
 */
export function projectionContext(p, geoidPatch = null) {
  const zone = chooseZone(p.lon, p.zone);
  const lam0 = centralMeridian(zone) * RAD, south = p.lat < 0;
  const center = { lat: p.lat, lon: p.lon, h: p.h0 };
  const O = llhToEcef(center), R0 = enuRotation(center);
  const tmp = {}, u0 = {}, u1 = {};
  utmForwardInto(p.lat * RAD, p.lon * RAD, lam0, south, u0);
  const step = [0, 1, 2].map(i => O[i] + R0[0][i]);
  ecefToGeodeticInto(step[0], step[1], step[2], tmp);
  utmForwardInto(tmp.phi, tmp.lam, lam0, south, u1);
  const theta = Math.atan2(u1.N - u0.N, u1.E - u0.E);
  const useGeoid = Boolean(p.geoid && geoidPatch);
  const N0 = geoidPatch ? sampleGeoid(geoidPatch, p.lat, p.lon) : null;
  const V0 = p.h0 - (useGeoid ? N0 : 0);
  const ef = elevationFactor(p.lat, p.h0);
  return {
    zone, south, cm: centralMeridian(zone), lam0, O, R0, theta, cos: Math.cos(theta), sin: Math.sin(theta),
    E0: u0.E, N0utm: u0.N, k0: u0.k, gamma0: u0.gamma / RAD, ef, combined: u0.k * ef,
    ppm0: (u0.k * ef - 1) * 1e6, geoidN0: N0, useGeoid, V0, geoidPatch,
  };
}

/** Full pipeline for one ECEF point; fills out {e,n,u, lat, lon, h, E, N, V, k, gamma, ef, ppm, dx, dy, dz, geoidN}. */
export function transformPoint(ctx, x, y, z, out = {}) {
  const { O, R0 } = ctx;
  const qx = x - O[0], qy = y - O[1], qz = z - O[2];
  out.e = R0[0][0] * qx + R0[0][1] * qy + R0[0][2] * qz;
  out.n = R0[1][0] * qx + R0[1][1] * qy + R0[1][2] * qz;
  out.u = R0[2][0] * qx + R0[2][1] * qy + R0[2][2] * qz;
  ecefToGeodeticInto(x, y, z, out);
  utmForwardInto(out.phi, out.lam, ctx.lam0, ctx.south, out);
  const s = Math.sin(out.phi), w2 = 1 - E2 * s * s;
  const rho = A * Math.sqrt(1 - E2) / w2;                  // √(MN)
  out.ef = rho / (rho + out.h);
  out.ppm = (out.k * out.ef - 1) * 1e6;
  out.lat = out.phi / RAD; out.lon = out.lam / RAD;
  out.geoidN = ctx.geoidPatch ? sampleGeoid(ctx.geoidPatch, out.lat, out.lon) : NaN;
  out.V = out.h - (ctx.useGeoid ? out.geoidN : 0);
  const rx = ctx.cos * out.e - ctx.sin * out.n, ry = ctx.sin * out.e + ctx.cos * out.n;
  out.dx = (out.E - ctx.E0) - rx;
  out.dy = (out.N - ctx.N0utm) - ry;
  out.dz = (out.V - ctx.V0) - out.u;
  return out;
}

/**
 * Transform a cloud: ENU (left view) + rigid reference rotation + UTM displacement (right view).
 * Returns Float32 arrays: enu (3n), disp (3n, metres: UTM-local − R(θ)·ENU), ppm (n) and, with the
 * geoid on, dg (n) = −(N − N0), the part of the vertical displacement caused by the geoid.
 */
export function transformCloud(cloud, ctx) {
  const N = cloud.X.length;
  const enu = new Float32Array(3 * N), disp = new Float32Array(3 * N), ppm = new Float32Array(N);
  const dg = ctx.useGeoid ? new Float32Array(N) : null;   // geoid part of the vertical displacement
  const o = {};
  let ppmMin = Infinity, ppmMax = -Infinity, dMax = 0, dzMin = Infinity, dzMax = -Infinity, dhMax = 0;
  for (let i = 0; i < N; i++) {
    transformPoint(ctx, cloud.X[i], cloud.Y[i], cloud.Z[i], o);
    const j = 3 * i;
    enu[j] = o.e; enu[j + 1] = o.n; enu[j + 2] = o.u;
    disp[j] = o.dx; disp[j + 1] = o.dy; disp[j + 2] = o.dz;
    ppm[i] = o.ppm;
    if (dg) dg[i] = -(o.geoidN - ctx.geoidN0);
    if (o.ppm < ppmMin) ppmMin = o.ppm;
    if (o.ppm > ppmMax) ppmMax = o.ppm;
    const dh = Math.hypot(o.dx, o.dy), d3 = Math.hypot(dh, o.dz);
    if (dh > dhMax) dhMax = dh;
    if (d3 > dMax) dMax = d3;
    if (o.dz < dzMin) dzMin = o.dz;
    if (o.dz > dzMax) dzMax = o.dz;
  }
  return { enu, disp, ppm, dg, stats: { ppmMin, ppmMax, dhMax, dzMin, dzMax, d3Max: dMax } };
}

/** UTM-measured dimensions of each cube (from its corners) against its true edge length. */
export function buildingReport(buildings, ctx) {
  const o = {};
  return buildings.map(b => {
    const c = b.corners.map(([x, y, z]) => { transformPoint(ctx, x, y, z, o); return { E: o.E, N: o.N, V: o.V, ppm: o.ppm, e: o.e, n: o.n, u: o.u }; });
    // corner order: (x,y,z) loops z{0,1} × y{-,+} × x{-,+}: 0=(-,-,0) 1=(+,-,0) 2=(-,+,0) 3=(+,+,0), 4..7 roof
    const d2 = (a, b2) => Math.hypot(a.E - b2.E, a.N - b2.N);
    const we = (d2(c[0], c[1]) + d2(c[2], c[3])) / 2;
    const sn = (d2(c[0], c[2]) + d2(c[1], c[3])) / 2;
    const ht = (c[4].V - c[0].V + c[5].V - c[1].V + c[6].V - c[2].V + c[7].V - c[3].V) / 4;
    const base = transformPoint(ctx, ...b.origin, o);
    return {
      id: b.id, size: b.size, e: b.e, n: b.n, lat: b.lat, lon: b.lon,
      utmWE: we, utmSN: sn, utmH: ht, ppmBase: base.ppm,
      dWE: we - b.size, dSN: sn - b.size, dH: ht - b.size,
      cornersEnu: c.map(q => [q.e, q.n, q.u]),
    };
  });
}

/** Distortion map on a regular (e, n) grid over the area at terrain level h0. */
export function distortionGrid(p, ctx, size = 121) {
  const nx = size, ny = size, len = nx * ny;
  const fields = {};
  for (const key of ['ppm', 'dh', 'dz', 'd3', 'dg', 'k', 'gamma', 'ef', 'geoidN', 'lat', 'lon', 'dx', 'dy']) fields[key] = new Float32Array(len);
  const O = ctx.O, R0 = ctx.R0, tmp = {}, o = {};
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const e = -p.spanWE / 2 + ix * p.spanWE / (nx - 1), nn = -p.spanNS / 2 + iy * p.spanNS / (ny - 1);
      const x = O[0] + e * R0[0][0] + nn * R0[1][0], y = O[1] + e * R0[0][1] + nn * R0[1][1], z = O[2] + e * R0[0][2] + nn * R0[1][2];
      ecefToGeodeticInto(x, y, z, tmp);
      const dh = p.h0 - tmp.h, cp = Math.cos(tmp.phi);
      transformPoint(ctx, x + dh * cp * Math.cos(tmp.lam), y + dh * cp * Math.sin(tmp.lam), z + dh * Math.sin(tmp.phi), o);
      const i = iy * nx + ix;
      fields.ppm[i] = o.ppm; fields.dx[i] = o.dx; fields.dy[i] = o.dy;
      fields.dh[i] = Math.hypot(o.dx, o.dy); fields.dz[i] = o.dz; fields.d3[i] = Math.hypot(o.dx, o.dy, o.dz);
      fields.k[i] = o.k; fields.gamma[i] = o.gamma / RAD; fields.ef[i] = o.ef; fields.geoidN[i] = o.geoidN;
      fields.dg[i] = ctx.useGeoid ? -(o.geoidN - ctx.geoidN0) : 0;
      fields.lat[i] = o.lat; fields.lon[i] = o.lon;
    }
  }
  return { nx, ny, spanWE: p.spanWE, spanNS: p.spanNS, fields };
}

/** Geographic bounding box of the area (degrees, lon unwrapped around the centre). */
export function areaBounds(p, margin = 0.02) {
  const O = llhToEcef({ lat: p.lat, lon: p.lon, h: p.h0 }), R0 = enuRotation({ lat: p.lat, lon: p.lon });
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity;
  const tmp = {};
  for (const fe of [-0.5, 0, 0.5]) for (const fn of [-0.5, 0, 0.5]) {
    const e = fe * p.spanWE, nn = fn * p.spanNS;
    ecefToGeodeticInto(O[0] + e * R0[0][0] + nn * R0[1][0], O[1] + e * R0[0][1] + nn * R0[1][1], O[2] + e * R0[0][2] + nn * R0[1][2], tmp);
    const lat = tmp.phi / RAD;
    let lon = tmp.lam / RAD;
    lon += 360 * Math.round((p.lon - lon) / 360);
    latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
    lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
  }
  return { latMin: latMin - margin, latMax: latMax + margin, lonMin: lonMin - margin, lonMax: lonMax + margin };
}

/** Everything the UI needs, in one call (used by the worker). */
export function simulate(params, { geoidPatch = null, maxPoints = MAX_POINTS, gridSize = 121 } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cloud = generateCloud(params, { maxPoints });
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ctx = projectionContext(cloud.params, geoidPatch);
  const tr = transformCloud(cloud, ctx);
  const t2 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const report = buildingReport(cloud.buildings, ctx);
  const grid = distortionGrid(cloud.params, ctx, gridSize);
  const t3 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { geoidPatch: _omit, O, R0, ...context } = ctx;
  return {
    params: cloud.params, budget: cloud.budget, counts: cloud.counts, context,
    enu: tr.enu, disp: tr.disp, ppm: tr.ppm, dg: tr.dg, cls: cloud.cls, stats: tr.stats,
    buildings: report, grid,
    timing: { generate: t1 - t0, transform: t2 - t1, extras: t3 - t2, total: t3 - t0 },
  };
}

// ---------------------------------------------------------------- formatting helpers
export function toDms(deg, digits = 2) {
  const sign = deg < 0 ? '−' : '';
  let a = Math.abs(deg);
  let d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60;
  if (Number(s.toFixed(digits)) >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; d += 1; }
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${s.toFixed(digits).padStart(digits ? digits + 3 : 2, '0')}″`;
}
