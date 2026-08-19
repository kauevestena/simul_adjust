// The control network: points the player has materialized and surveyed.
//
// The one invariant worth stating twice: `trueE/trueN` is where the marco
// physically sits in the world, and `E/N` is what the player has surveyed.
// Only `E/N` is ever shown. They differ by exactly the error the player earned,
// and the gap is revealed at the debrief as a score.
//
// The network survives across services — reusing a neighbour's control is the
// strategy layer the whole campaign is built around.

export const SOURCE = {
  ARBITRARY: 'arbitrario',
  IRRADIATED: 'irradiado',
  TRAVERSE: 'poligonal',
  FREE_STATION: 'estacao_livre',
};

let counter = 0;

/** Reset the id counter. Only for deterministic tests. */
export function resetCounter(v = 0) {
  counter = v;
}

/**
 * @param {object} p
 * @param {number} p.trueE @param {number} p.trueN  physical position, never shown
 * @param {number} [p.E] @param {number} [p.N]      surveyed position, null until measured
 */
export function makeControlPoint({
  id = null,
  label = null,
  kind = 'marco',
  trueE,
  trueN,
  E = null,
  N = null,
  sigmaE = null,
  sigmaN = null,
  source = null,
  serviceId = null,
  parcelId = null,
}) {
  const n = ++counter;
  const pid = id || `M${n}`;
  return {
    id: pid,
    label: label || pid,
    kind,
    trueE,
    trueN,
    E,
    N,
    sigmaE,
    sigmaN,
    source,
    serviceId,
    parcelId,
    materialized: true,
    createdAt: Date.now(),
  };
}

/** Points that carry surveyed coordinates and can therefore orient an instrument. */
export const knownPoints = (network) => network.filter((p) => p.E != null && p.N != null);

/** Give a point its surveyed coordinates. */
export function assignCoordinates(point, { E, N, source, sigmaE = null, sigmaN = null }) {
  point.E = E;
  point.N = N;
  point.source = source;
  // The coordinate as SURVEYED, kept beside the current best.
  //
  // A traverse is computed from the raw survey, never from a previous
  // adjustment of itself — and it was: compensating rewrote the stations, the
  // next run read those rewritten stations for its starting azimuth, and
  // bowditch → transit → bowditch did not give the first answer back. Keeping
  // the radiated value makes the input to the compensation fixed, which is the
  // only way switching rules is a comparison rather than a drift.
  if (source !== SOURCE.TRAVERSE) {
    point.radiatedE = E;
    point.radiatedN = N;
  }
  point.sigmaE = sigmaE;
  point.sigmaN = sigmaN;
  return point;
}

/** Straight-line distance between two network points, using true positions. */
export const trueDistance = (a, b) => Math.hypot(b.trueE - a.trueE, b.trueN - a.trueN);

/**
 * Known control close enough to serve a parcel. This is what makes the network
 * from one job worth something on the next one.
 * @param {Array} network
 * @param {{centroid:{e:number,n:number}}} parcel
 * @param {number} [radius] metres; by default a little over the parcel's own
 *        half-width, so "close enough to be worth reusing" means near THIS
 *        property. A fixed radius stops meaning anything once it is wide enough
 *        to sweep up the monuments of two or three neighbours as well.
 */
export function reusableFor(network, parcel, radius = null) {
  radius = radius ?? Math.max(60, Math.min(parcel.bbox.w, parcel.bbox.h) * 0.9);
  const { e, n } = parcel.centroid;
  return knownPoints(network)
    .map((p) => ({ point: p, d: Math.hypot(p.trueE - e, p.trueN - n) }))
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.point);
}

/**
 * The translation between the surveyed frame and the world's.
 *
 * The two differ by a pure shift and nothing else, and that is structural
 * rather than lucky: the datum takes an arbitrary origin at the first station
 * and its north IS the map's north, so there is no rotation to recover and no
 * scale. Measured on a real survey, the residual left after removing this shift
 * is 5-9 mm — which is the instrument, not a frame mismatch.
 *
 * Removing it is what makes a truth comparison mean anything. The origin was
 * arbitrary BY CONSTRUCTION, so subtracting exactly the arbitrary part leaves
 * only the error the player earned; comparing raw coordinates would report the
 * datum's own 900-odd metres as though the student had put it there.
 *
 * Fitted by least squares, which for a translation alone is the mean offset.
 */
export function datumShift(network) {
  const pts = knownPoints(network);
  if (!pts.length) return { dE: 0, dN: 0, n: 0 };
  const dE = pts.reduce((s, p) => s + (p.E - p.trueE), 0) / pts.length;
  const dN = pts.reduce((s, p) => s + (p.N - p.trueN), 0) / pts.length;
  return { dE, dN, n: pts.length };
}

/**
 * How far a surveyed coordinate ended up from the truth. Debrief only — this is
 * the number the player is scored on, and the only place truth is exposed.
 *
 * `shift` comes from `datumShift`, fitted on the CONTROL NETWORK: the network
 * is the frame, and fitting the shift on the very points being judged would
 * absorb part of their own error into it and quietly flatter the result.
 */
export function accuracyReport(network, shift = { dE: 0, dN: 0 }) {
  const pts = knownPoints(network);
  if (!pts.length) return { n: 0, rms: 0, worst: null, items: [] };
  const items = pts.map((p) => {
    const dE = p.E - shift.dE - p.trueE;
    const dN = p.N - shift.dN - p.trueN;
    return { id: p.id, label: p.label || p.id, dE, dN, d: Math.hypot(dE, dN) };
  });
  const rms = Math.sqrt(items.reduce((s, i) => s + i.d * i.d, 0) / items.length);
  const worst = items.reduce((w, i) => (w === null || i.d > w.d ? i : w), null);
  return { n: items.length, rms, worst, items };
}
