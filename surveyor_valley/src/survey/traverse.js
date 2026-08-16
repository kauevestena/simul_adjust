// Closed traverse (poligonal fechada) at Topografia 1 level.
//
// Deliberately NOT a rigorous least-squares network adjustment: angular closure,
// equal distribution, azimuth propagation, linear closure and a compass-rule
// compensation are what the course teaches, and the panel says as much while
// pointing forward to Ajustamento de Observações.
//
// Index convention, which everything below depends on:
//   stations[i]  the i-th station of the loop
//   angles[i]    the angle to the right measured AT station i,
//                from the back station i-1 to the forward station i+1
//   distances[i] the distance from station i to station i+1 (wrapping at the end)

import { normalize360 } from './units.js';
import { azimuth as azFromCoords, courseComponents } from './geometry.js';

export const RULE = { BOWDITCH: 'bowditch', TRANSIT: 'transit' };

/**
 * Which theoretical sum the observed angles are aiming at.
 *
 * Walk a loop counter-clockwise and the angles to the right come out INTERIOR,
 * summing to (n-2)·180. Walk it clockwise and the same readings are EXTERIOR,
 * summing to (n+2)·180. Students do both, so both branches must work.
 *
 * The two candidates are 720° apart — vastly beyond any plausible closure
 * error — so simply picking the nearer one is robust and needs no coordinates.
 */
export function expectedAngleSum(nStations, observedSum) {
  const interior = (nStations - 2) * 180;
  const exterior = (nStations + 2) * 180;
  const dInt = Math.abs(observedSum - interior);
  const dExt = Math.abs(observedSum - exterior);
  return dInt <= dExt
    ? { sum: interior, kind: 'interior', loop: 'ccw' }
    : { sum: exterior, kind: 'exterior', loop: 'cw' };
}

/**
 * Permissible angular closure, in arc-seconds.
 * A measured angle is the difference of two directions, hence the √2; the
 * factor 2 takes it to roughly 95% confidence.
 */
export function angularTolerance(sigmaDirSec, nStations) {
  return 2 * sigmaDirSec * Math.SQRT2 * Math.sqrt(nStations);
}

/**
 * @param {object} p
 * @param {Array<{id:string}>} p.stations   loop order, n >= 3
 * @param {number[]} p.angles               angle to the right at each station, degrees
 * @param {number[]} p.distances            station i -> i+1, metres
 * @param {{E:number, N:number}} p.startPoint  coordinates of stations[0]
 * @param {number} p.startAzimuth           azimuth of stations[0] -> stations[1]
 * @param {string} [p.rule]                 'bowditch' | 'transit'
 * @param {number} [p.sigmaDirSec]          instrument direction sigma, for the tolerance
 */
export function computeTraverse({
  stations,
  angles,
  distances,
  startPoint,
  startAzimuth,
  rule = RULE.BOWDITCH,
  sigmaDirSec = 10,
}) {
  const n = stations.length;
  if (n < 3) return { ok: false, reason: 'needThreeStations', n };
  if (angles.length !== n || distances.length !== n) {
    return { ok: false, reason: 'lengthMismatch', n };
  }

  // ---- 1. Angular closure -------------------------------------------------
  const obs = angles.map(normalize360);
  const sumObs = obs.reduce((s, a) => s + a, 0);
  const theo = expectedAngleSum(n, sumObs);
  const eAngSec = (sumObs - theo.sum) * 3600;
  const tolAngSec = angularTolerance(sigmaDirSec, n);
  const angOk = Math.abs(eAngSec) <= tolAngSec;

  // ---- 2. Equal distribution ---------------------------------------------
  const corrSec = -eAngSec / n;
  const adjAngles = obs.map((a) => a + corrSec / 3600);

  // ---- 3. Azimuth propagation --------------------------------------------
  // Az[i] is the azimuth of the leg stations[i] -> stations[i+1].
  const azimuths = new Array(n);
  azimuths[0] = normalize360(startAzimuth);
  for (let i = 1; i < n; i++) {
    azimuths[i] = normalize360(azimuths[i - 1] + 180 + adjAngles[i]);
  }

  // ---- 4. Linear closure --------------------------------------------------
  const legs = azimuths.map((az, i) => {
    const { dE, dN } = courseComponents(az, distances[i]);
    return { index: i, from: stations[i].id, to: stations[(i + 1) % n].id, az, d: distances[i], dE, dN };
  });

  const sumD = distances.reduce((s, d) => s + d, 0);
  const eE = legs.reduce((s, l) => s + l.dE, 0);
  const eN = legs.reduce((s, l) => s + l.dN, 0);
  const eLin = Math.hypot(eE, eN);
  const relDen = eLin > 1e-12 ? sumD / eLin : Infinity;

  // Raw (uncompensated) coordinates, so the panel can show the gap.
  const rawCoords = [{ id: stations[0].id, E: startPoint.E, N: startPoint.N }];
  for (let i = 0; i < n - 1; i++) {
    const prev = rawCoords[i];
    rawCoords.push({ id: stations[i + 1].id, E: prev.E + legs[i].dE, N: prev.N + legs[i].dN });
  }

  // ---- 5. Compensation ----------------------------------------------------
  const sumAbsE = legs.reduce((s, l) => s + Math.abs(l.dE), 0);
  const sumAbsN = legs.reduce((s, l) => s + Math.abs(l.dN), 0);

  const corrections = legs.map((l) => {
    if (rule === RULE.TRANSIT) {
      // Transit rule: distribute in proportion to each leg's own departure and
      // latitude. Better when the angles are stronger than the distances.
      return {
        index: l.index,
        dE: sumAbsE > 1e-12 ? (-eE * Math.abs(l.dE)) / sumAbsE : 0,
        dN: sumAbsN > 1e-12 ? (-eN * Math.abs(l.dN)) / sumAbsN : 0,
      };
    }
    // Bowditch / compass rule: proportional to leg length.
    const w = sumD > 1e-12 ? l.d / sumD : 0;
    return { index: l.index, dE: -eE * w, dN: -eN * w };
  });

  const coords = [{ id: stations[0].id, E: startPoint.E, N: startPoint.N }];
  for (let i = 0; i < n - 1; i++) {
    const prev = coords[i];
    coords.push({
      id: stations[i + 1].id,
      E: prev.E + legs[i].dE + corrections[i].dE,
      N: prev.N + legs[i].dN + corrections[i].dN,
    });
  }

  // ---- 6. Presentation table ---------------------------------------------
  const rows = legs.map((l, i) => ({
    from: l.from,
    to: l.to,
    angleObs: obs[i],
    angleAdj: adjAngles[i],
    azimuth: l.az,
    distance: l.d,
    dE: l.dE,
    dN: l.dN,
    corrE: corrections[i].dE,
    corrN: corrections[i].dN,
    E: coords[(i + 1) % n]?.E ?? coords[0].E,
    N: coords[(i + 1) % n]?.N ?? coords[0].N,
  }));

  return {
    ok: true,
    nStations: n,
    rule,
    sumObs,
    sumTheo: theo.sum,
    angleKind: theo.kind,
    loopDirection: theo.loop,
    eAngSec,
    tolAngSec,
    angOk,
    angleCorrSec: corrSec,
    adjAngles,
    azimuths,
    rawCoords,
    eE,
    eN,
    eLin,
    sumD,
    relPrecision: relDen === Infinity ? Infinity : 1 / relDen,
    relDenominator: relDen,
    corrections,
    coords,
    rows,
  };
}

/**
 * Angles to the right at every station of a closed loop, derived from
 * coordinates. Used to seed a traverse from a synthesized ground truth, and by
 * the tests to build a perfectly closing figure.
 * @param {Array<{E:number, N:number}>} pts loop order
 */
export function anglesFromCoords(pts) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const back = pts[(i - 1 + n) % n];
    const here = pts[i];
    const fwd = pts[(i + 1) % n];
    const azBack = azFromCoords(here.E, here.N, back.E, back.N);
    const azFwd = azFromCoords(here.E, here.N, fwd.E, fwd.N);
    out.push(normalize360(azFwd - azBack));
  }
  return out;
}

/** Leg lengths of a closed loop, i -> i+1. */
export function distancesFromCoords(pts) {
  const n = pts.length;
  return pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    return Math.hypot(q.E - p.E, q.N - p.N);
  });
}

/** `1:6480`, or `—` when the traverse closed exactly. */
export function formatRelPrecision(relDenominator, locale = 'pt-BR') {
  if (!Number.isFinite(relDenominator)) return '1:∞';
  return `1:${Math.floor(relDenominator).toLocaleString(locale)}`;
}
