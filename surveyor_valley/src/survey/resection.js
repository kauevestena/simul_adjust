// Free station (estação livre) by 2D Helmert least squares — closed form.
//
// The trick that avoids any matrix machinery: the polar observations already
// ARE a coordinate set, expressed in the instrument's own arbitrary frame.
//
//     x_i = d_i·sin(hz_i)      y_i = d_i·cos(hz_i)
//
// Fitting that cloud onto the known coordinates is a similarity transform:
//
//     E_i = E_S + a·x_i + b·y_i
//     N_i = N_S − b·x_i + a·y_i        a = s·cosθ, b = s·sinθ
//
// Centre both clouds on their centroids and the least-squares solution drops
// out in two lines. Exact with 2 points, least squares with 3 or more.
//
// The recovered scale is the gift: a rigid setup should give s = 1 exactly, so
// any meaningful departure means a distance was misrecorded. Reporting it in
// ppm turns a blunder into a teachable moment.

import { normalize360, toDeg, toRad } from './units.js';

/**
 * @param {Array<{targetId:string, hz:number, distance:number}>} observations
 *        circle readings in degrees, horizontal distances in metres
 * @param {Map<string, {E:number, N:number}>|object} known  coordinates by id
 * @param {{rigid?:boolean}} opts  rigid forces the scale to 1
 */
export function solveResection(observations, known, opts = {}) {
  const get = (id) => (known instanceof Map ? known.get(id) : known[id]);

  const pts = [];
  for (const o of observations) {
    const k = get(o.targetId);
    if (!k || k.E == null || k.N == null) continue;
    const a = toRad(o.hz);
    pts.push({
      id: o.targetId,
      x: o.distance * Math.sin(a),
      y: o.distance * Math.cos(a),
      E: k.E,
      N: k.N,
      hz: o.hz,
      distance: o.distance,
    });
  }

  const n = pts.length;
  if (n < 2) {
    return { ok: false, reason: 'needTwoPoints', n };
  }

  const mean = (f) => pts.reduce((s, p) => s + f(p), 0) / n;
  const xm = mean((p) => p.x);
  const ym = mean((p) => p.y);
  const Em = mean((p) => p.E);
  const Nm = mean((p) => p.N);

  let den = 0;
  let sxE = 0;
  let syN = 0;
  let syE = 0;
  let sxN = 0;
  for (const p of pts) {
    const xp = p.x - xm;
    const yp = p.y - ym;
    const Ep = p.E - Em;
    const Np = p.N - Nm;
    den += xp * xp + yp * yp;
    sxE += xp * Ep;
    syN += yp * Np;
    syE += yp * Ep;
    sxN += xp * Np;
  }

  if (den < 1e-9) {
    // All sights landed on the same spot: nothing to fit.
    return { ok: false, reason: 'degenerate', n };
  }

  let a = (sxE + syN) / den;
  let b = (syE - sxN) / den;

  let theta = normalize360(toDeg(Math.atan2(b, a)));
  let scale = Math.hypot(a, b);

  if (opts.rigid) {
    const th = toRad(theta);
    a = Math.cos(th);
    b = Math.sin(th);
    scale = 1;
  }

  const E_S = Em - a * xm - b * ym;
  const N_S = Nm + b * xm - a * ym;

  // Residuals: fitted minus given, per known point.
  const residuals = pts.map((p) => {
    const fE = E_S + a * p.x + b * p.y;
    const fN = N_S - b * p.x + a * p.y;
    const vE = fE - p.E;
    const vN = fN - p.N;
    return { id: p.id, vE, vN, v: Math.hypot(vE, vN), distance: p.distance };
  });

  // Four parameters (E, N, θ, s) against 2n coordinate equations.
  const dof = Math.max(0, 2 * n - (opts.rigid ? 3 : 4));
  const sumSq = residuals.reduce((s, r) => s + r.vE * r.vE + r.vN * r.vN, 0);
  const rms = dof > 0 ? Math.sqrt(sumSq / dof) : 0;

  const worst = residuals.reduce((w, r) => (w === null || r.v > w.v ? r : w), null);

  return {
    ok: true,
    n,
    E: E_S,
    N: N_S,
    theta0: theta,
    scale,
    scalePPM: (scale - 1) * 1e6,
    residuals,
    rms,
    dof,
    worst,
    /** A scale error this big almost always means a mistyped distance. */
    scaleSuspect: Math.abs((scale - 1) * 1e6) > 200,
    geometry: geometryQuality(pts),
  };
}

/**
 * How well the known points surround the station. Near-collinear targets give a
 * mathematically valid but practically weak fix, and the player should be told.
 */
function geometryQuality(pts) {
  if (pts.length < 3) return { spread: 0, weak: true, reason: 'twoPointsOnly' };

  // Spread of the observed directions around the circle: if every target sits
  // in one narrow sector, the position is poorly controlled across that sector.
  const angles = pts.map((p) => normalize360(toDeg(Math.atan2(p.x, p.y)))).sort((u, v) => u - v);
  let maxGap = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i === angles.length - 1 ? angles[0] + 360 : angles[i + 1];
    maxGap = Math.max(maxGap, next - angles[i]);
  }
  const spread = 360 - maxGap;
  return { spread, maxGap, weak: spread < 60, reason: spread < 60 ? 'narrowSector' : null };
}

/**
 * Reduce a free station's observations once the resection has solved θ0 and the
 * station coordinates: every reading becomes an azimuth and a coordinate pair.
 */
export function reduceFreeStation(solution, observations) {
  return observations.map((o) => {
    const az = normalize360(o.hz + solution.theta0);
    const r = toRad(az);
    return {
      ...o,
      azimuth: az,
      E: solution.E + o.distance * Math.sin(r) * solution.scale,
      N: solution.N + o.distance * Math.cos(r) * solution.scale,
    };
  });
}
