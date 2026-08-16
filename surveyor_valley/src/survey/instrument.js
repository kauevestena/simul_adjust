// The instrument model: what the player owns, and how wrong it is.
//
// Three physically distinct error sources, because that separation is what
// makes the simulation teach something rather than just add fuzz:
//
//   1. Centring, drawn ONCE PER OCCUPATION — not per observation. This is why
//      short sights hurt: the same millimetres of setup error subtend a much
//      larger angle over 20 m than over 200 m, and the student can watch it
//      appear in the residuals.
//   2. Direction, the instrument's stated arc-second precision, plus a pointing
//      term that grows on short sights for the same reason.
//   3. Distance, the classic `a mm + b ppm` combined in quadrature.

import { secToDeg } from './units.js';

/**
 * Total station tiers. The player starts on `et10` and buys upward.
 *
 * `collimationSec` is the horizontal collimation error c: a fixed mechanical
 * misalignment of the line of sight, NOT noise. It is the same value on every
 * sight from that instrument, in every job, forever — which is exactly why
 * averaging more single-face readings can never remove it, and why the
 * two-face procedure exists. Cheaper instruments carry more of it.
 */
export const TIERS = [
  { id: 'et10', sigmaDirSec: 10, distA_mm: 10, distPPM: 10, collimationSec: 22, price: 0 },
  { id: 'et5', sigmaDirSec: 5, distA_mm: 5, distPPM: 5, collimationSec: 12, price: 9000 },
  { id: 'et3', sigmaDirSec: 3, distA_mm: 3, distPPM: 2, collimationSec: 6, price: 22000 },
  { id: 'et1', sigmaDirSec: 1, distA_mm: 2, distPPM: 2, collimationSec: 3, price: 55000 },
];

/** Telescope face. */
export const FACE = { DIRECT: 'PD', INVERTED: 'PI' };

/**
 * The collimation error as a signed angle in DEGREES, for a given face.
 *
 * Direct face reads high by c; inverted face, having swung the telescope
 * through 180°, reads low by the same c. So
 *
 *     mean = ((PD) + (PI − 180°)) / 2
 *
 * cancels it exactly, and the half-difference recovers 2c — the number a
 * student is asked to compute and which tells them how far out the instrument
 * is. This is the whole reason the procedure is taught.
 */
export const collimationFor = (instrument, face) =>
  ((face === FACE.INVERTED ? -1 : 1) * (instrument.collimationSec ?? 0)) / 3600;

export const TRIPODS = [
  { id: 'tri-mad', centringSigma_mm: 2.5, setupSeconds: 180, price: 0 },
  { id: 'tri-fib', centringSigma_mm: 1.0, setupSeconds: 110, price: 3200 },
];

export const TARGETS = [
  { id: 'bastao', centringSigma_mm: 5.0, price: 0 },
  { id: 'prisma-tri', centringSigma_mm: 1.5, price: 2600 },
];

export const MARCOS = [
  { id: 'estaca-mad', price: 0, unitPrice: 12 },
  { id: 'marco-conc', price: 0, unitPrice: 65 },
];

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

export const getInstrument = (id) => byId(TIERS, id);
export const getTripod = (id) => byId(TRIPODS, id);
export const getTarget = (id) => byId(TARGETS, id);

/** Everything the player is carrying, resolved from inventory ids. */
export function resolveKit(inventory) {
  return {
    instrument: getInstrument(inventory.instrument),
    tripod: getTripod(inventory.tripod),
    target: getTarget(inventory.target),
  };
}

/**
 * Standard deviation of a measured distance, in metres.
 * σ = √( (a/1000)² + (b·10⁻⁶·d)² )  — quadrature, never a linear sum.
 */
export function distanceSigma(instrument, d) {
  const fixed = instrument.distA_mm / 1000;
  const ppm = (instrument.distPPM * 1e-6) * d;
  return Math.hypot(fixed, ppm);
}

/**
 * Standard deviation of a horizontal direction, in DEGREES.
 * The instrument's own σ, plus a pointing term worth roughly 6" at 2 m and
 * fading out beyond 100 m — the short-sight penalty again.
 */
export function directionSigma(instrument, d) {
  const base = secToDeg(instrument.sigmaDirSec);
  const pointing = secToDeg(6 * (2 / Math.max(d, 2)));
  return Math.hypot(base, Math.min(pointing, secToDeg(30)));
}

/**
 * Draw a centring offset for one occupation of a point.
 * @returns {{dE:number, dN:number}} metres
 */
export function drawCentring(rng, sigma_mm) {
  const s = sigma_mm / 1000;
  return { dE: rng.gauss() * s, dN: rng.gauss() * s };
}

/** Perturb a true direction. Returns degrees (unwrapped; caller normalizes). */
export function observeDirection(rng, trueDeg, sigmaDeg) {
  return trueDeg + rng.gauss() * sigmaDeg;
}

/** Perturb a true distance. Returns metres. */
export function observeDistance(rng, trueD, sigmaM) {
  return trueD + rng.gauss() * sigmaM;
}

/** Human-readable spec, e.g. `10" · 10 mm + 10 ppm`. */
export function specOf(instrument) {
  return `${instrument.sigmaDirSec}" · ${instrument.distA_mm} mm + ${instrument.distPPM} ppm`;
}
