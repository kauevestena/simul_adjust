// Planimetric surveying geometry: azimuths, bearings, polar survey, areas.
//
// Convention, fixed everywhere in the game and stated in the in-game help:
//   coordinates are (E, N) in metres on a local topographic plane;
//   azimuth is measured CLOCKWISE FROM NORTH in [0, 360).
//
// That makes the azimuth `atan2(dE, dN)` — East first, North second. It is the
// reverse of the usual `atan2(y, x)` and it is the single most common bug in
// survey code, so it gets its own unit test.

import { normalize360, toDeg, toRad, formatDMS } from './units.js';

/** Azimuth from A to B, in degrees clockwise from North. */
export function azimuth(aE, aN, bE, bN) {
  return normalize360(toDeg(Math.atan2(bE - aE, bN - aN)));
}

/** Horizontal distance between two points. */
export const distance = (aE, aN, bE, bN) => Math.hypot(bE - aE, bN - aN);

/**
 * Polar survey (irradiação): project a point from a station.
 * E = E0 + d·sin(Az), N = N0 + d·cos(Az)
 */
export function polarPoint(E0, N0, azDeg, dist) {
  const a = toRad(azDeg);
  return { E: E0 + dist * Math.sin(a), N: N0 + dist * Math.cos(a) };
}

/** Departure (ΔE) and latitude (ΔN) of a course. */
export function courseComponents(azDeg, dist) {
  const a = toRad(azDeg);
  return { dE: dist * Math.sin(a), dN: dist * Math.cos(a) };
}

/**
 * Quadrant bearing ("rumo") from an azimuth.
 * Exact cardinals are reported as such — due East is "E", not "90° NE".
 * @returns {{quadrant:string, angle:number, cardinal:string|null}}
 */
export function rumo(azDeg) {
  const az = normalize360(azDeg);
  const EPS = 1e-9;

  if (Math.abs(az) < EPS || Math.abs(az - 360) < EPS) return { quadrant: 'NE', angle: 0, cardinal: 'N' };
  if (Math.abs(az - 90) < EPS) return { quadrant: 'SE', angle: 90, cardinal: 'E' };
  if (Math.abs(az - 180) < EPS) return { quadrant: 'SE', angle: 0, cardinal: 'S' };
  if (Math.abs(az - 270) < EPS) return { quadrant: 'SW', angle: 90, cardinal: 'W' };

  if (az < 90) return { quadrant: 'NE', angle: az, cardinal: null };
  if (az < 180) return { quadrant: 'SE', angle: 180 - az, cardinal: null };
  if (az < 270) return { quadrant: 'SW', angle: az - 180, cardinal: null };
  return { quadrant: 'NW', angle: 360 - az, cardinal: null };
}

const CARDINAL_PT = { N: 'N', S: 'S', E: 'E', W: 'O' };

/**
 * Render a bearing the way each tradition writes it:
 *   pt → `87°12'45" NE`      en → `N 87°12'45" E`
 */
export function formatRumo(azDeg, lang = 'pt', decimals = 0) {
  const r = rumo(azDeg);
  if (r.cardinal) return lang === 'pt' ? CARDINAL_PT[r.cardinal] : r.cardinal;

  const ang = formatDMS(r.angle, { decimals, wrap: false });
  if (lang === 'pt') return `${ang} ${r.quadrant}`;
  const [ns, ew] = r.quadrant.split('');
  return `${ns} ${ang} ${ew}`;
}

/** Signed area of a ring of `{E, N}` points, square metres. CCW is positive. */
export function shoelaceArea(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += points[j].E * points[i].N - points[i].E * points[j].N;
  }
  return a / 2;
}

/** Absolute parcel area with the units a Brazilian survey actually quotes. */
export function areaOf(points) {
  const signed = shoelaceArea(points);
  const m2 = Math.abs(signed);
  return {
    signed,
    m2,
    hectares: m2 / 10000,
    alqueirePaulista: m2 / 24200,
    ccw: signed > 0,
  };
}

/** Perimeter of a closed ring of `{E, N}` points. */
export function perimeterOf(points) {
  let p = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    p += distance(points[j].E, points[j].N, points[i].E, points[i].N);
  }
  return p;
}

/**
 * Per-side table for a closed parcel ring. This single array is the input to
 * both the planta's side table and the memorial's paragraph generator, so the
 * drawing and the legal text can never disagree.
 *
 * @param {Array<{id:string, E:number, N:number}>} vertices  closed ring, CCW
 * @param {(index:number)=>string} confrontanteFor  neighbour label for side i
 */
export function sideTable(vertices, confrontanteFor = () => '') {
  const sides = [];
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    const az = azimuth(from.E, from.N, to.E, to.N);
    const d = distance(from.E, from.N, to.E, to.N);
    sides.push({
      index: i,
      from: from.id,
      to: to.id,
      fromPoint: from,
      toPoint: to,
      distance: d,
      azimuth: az,
      rumo: rumo(az),
      confrontante: confrontanteFor(i) || '',
    });
  }
  return sides;
}

/**
 * Interior angle at vertex B of the path A-B-C, measured to the right
 * (the "ângulo horizontal à direita" a total station actually reads).
 */
export function angleRight(azBack, azForward) {
  return normalize360(azForward - azBack);
}

/** Convert a ring of `{E, N}` objects to `[e, n]` pairs for the core geometry helpers. */
export const toPairs = (points) => points.map((p) => [p.E, p.N]);
