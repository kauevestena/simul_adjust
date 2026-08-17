// Setting the instrument up, and reading it.
//
// The whole simulation hinges on one separation that is easy to blur and fatal
// to blur: observations are generated from the TRUE geometry of the world
// (where the marcos physically are, plus this occupation's centring error),
// while the player reduces them using the ASSUMED coordinates they have
// surveyed so far. Error therefore propagates the way it does in the field
// instead of being sprinkled on at the end.

import { normalize360, normalize180, toDeg, secToDeg } from './units.js';
import { azimuth, distance, polarPoint } from './geometry.js';
import { drawCentring, observeDirection, observeDistance, distanceSigma, directionSigma, collimationFor, FACE } from './instrument.js';

/** How the circle was oriented. Both workflows are taught, so both are offered. */
export const ORIENT = {
  ZERO_BACKSIGHT: 'zeroBacksight', // "zerar na ré": force the backsight to read 0°00'00"
  BY_AZIMUTH: 'byAzimuth', // "orientar pelo azimute": set the circle to read Az directly
  ARBITRARY: 'arbitrary', // leave the circle wherever it sits and compute θ0
};

let setupCounter = 0;

/**
 * Occupy a known point and orient on a backsight.
 *
 * @param {object} p
 * @param {{id:string, E:number, N:number, trueE:number, trueN:number}} p.over   station point
 * @param {{id:string, E:number, N:number, trueE:number, trueN:number}} p.backsight
 * @param {object} p.kit        resolved instrument/tripod/target
 * @param {object} p.rng        the service observation stream
 * @param {string} [p.orientMode]
 * @returns {object} setup record
 */
export function setupOverKnownPoint({ over, backsight, kit, rng, orientMode = ORIENT.ZERO_BACKSIGHT }) {
  const centring = drawCentring(rng, kit.tripod.centringSigma_mm);
  const trueE = over.trueE + centring.dE;
  const trueN = over.trueN + centring.dN;

  // True azimuth to the backsight, from where the instrument physically stands
  // to where the backsight target physically stands (with its own centring).
  const bs = drawCentring(rng, kit.target.centringSigma_mm);
  const bsTrueE = backsight.trueE + bs.dE;
  const bsTrueN = backsight.trueN + bs.dN;
  const trueAzBs = azimuth(trueE, trueN, bsTrueE, bsTrueN);
  const dBs = distance(trueE, trueN, bsTrueE, bsTrueN);

  // Azimuth computed from the coordinates the player believes.
  const knownAzBs = azimuth(over.E, over.N, backsight.E, backsight.N);

  const sigmaDir = directionSigma(kit.instrument, dBs);
  const pointingErr = rng.gauss() * sigmaDir;

  // `circleOffset` is the azimuth that the circle reads as zero.
  let circleOffset;
  let backsightReading;
  if (orientMode === ORIENT.ZERO_BACKSIGHT) {
    circleOffset = trueAzBs + pointingErr;
    backsightReading = 0;
  } else if (orientMode === ORIENT.BY_AZIMUTH) {
    circleOffset = trueAzBs + pointingErr - knownAzBs;
    backsightReading = knownAzBs;
  } else {
    circleOffset = rng.range(0, 360);
    backsightReading = normalize360(trueAzBs + pointingErr - circleOffset);
  }

  const theta0 = normalize360(knownAzBs - backsightReading);

  return {
    id: `st-${++setupCounter}`,
    mode: 'known',
    overId: over.id,
    backsightId: backsight.id,
    orientMode,
    E: over.E,
    N: over.N,
    trueE,
    trueN,
    circleOffset,
    theta0,
    backsightReading,
    backsightAzimuth: knownAzBs,
    backsightDistance: dBs,
    instrumentId: kit.instrument.id,
    centringSigma_mm: kit.tripod.centringSigma_mm,
    observations: [],
  };
}

/**
 * Build the setup record for a free station once resection has solved it.
 * The circle offset is arbitrary; θ0 comes out of the fit.
 */
export function setupFreeStation({ solution, kit, rng, circleOffset }) {
  const centring = drawCentring(rng, kit.tripod.centringSigma_mm);
  return {
    id: `st-${++setupCounter}`,
    mode: 'free',
    overId: null,
    backsightId: null,
    orientMode: ORIENT.ARBITRARY,
    E: solution.E,
    N: solution.N,
    trueE: solution.trueE + centring.dE,
    trueN: solution.trueN + centring.dN,
    circleOffset,
    theta0: solution.theta0,
    resection: solution,
    instrumentId: kit.instrument.id,
    centringSigma_mm: kit.tripod.centringSigma_mm,
    observations: [],
  };
}

/**
 * Take one sight from a setup to a target.
 *
 * @param {object} setup
 * @param {{id:string, trueE:number, trueN:number}} target  physical position
 * @param {object} kit
 * @param {object} rng
 * @returns {object} observation record
 */
export function sightTarget({ setup, target, kit, rng, label = null, twoFace = false }) {
  const tc = drawCentring(rng, kit.target.centringSigma_mm);
  const tE = target.trueE + tc.dE;
  const tN = target.trueN + tc.dN;

  const trueAz = azimuth(setup.trueE, setup.trueN, tE, tN);
  const trueDist = distance(setup.trueE, setup.trueN, tE, tN);

  const sigmaDir = directionSigma(kit.instrument, trueDist);
  const sigmaDist = distanceSigma(kit.instrument, trueDist);

  // The circle reading the player would take on the direct face. Collimation is
  // a fixed mechanical error, so it rides on every reading identically — no
  // amount of repeating on one face will average it away.
  const want = trueAz - setup.circleOffset;
  const cDeg = collimationFor(kit.instrument, FACE.DIRECT);
  const hzPD = normalize360(observeDirection(rng, want + cDeg, sigmaDir));

  let hz = hzPD;
  let hzPI = null;

  if (twoFace) {
    // Face II: telescope swung through, so the reading is 180° away and the
    // collimation error changes sign.
    hzPI = normalize360(observeDirection(rng, want - cDeg, sigmaDir) + 180);
    // Mean of the pair, taken the short way round the circle so a pair
    // straddling 0° does not average to its own opposite.
    hz = normalize360(hzPD + normalize180(hzPI - 180 - hzPD) / 2);
  }

  const dist = observeDistance(rng, trueDist, sigmaDist);

  // Reduction, done with the coordinates the player believes.
  const az = normalize360(hz + setup.theta0);
  const { E, N } = polarPoint(setup.E, setup.N, az, dist);

  return {
    id: `ob-${setup.id}-${setup.observations.length + 1}`,
    setupId: setup.id,
    targetId: target.id,
    label: label || target.label || target.id,
    hz,
    /** Both faces, when the pair was taken — the caderneta shows the working. */
    hzPD,
    hzPI,
    twoFace,
    /**
     * Twice the collimation error, as the student would derive it:
     * 2c = PD − (PI − 180°). Recovered from the readings, so it carries the
     * measurement noise too rather than being the answer copied off the model.
     */
    twoCSec: twoFace ? normalize180(hzPD - (hzPI - 180)) * 3600 : null,
    distance: dist,
    azimuth: az,
    E,
    N,
    sigmaDirSec: sigmaDir * 3600,
    sigmaDist,
    at: Date.now(),
  };
}

/**
 * Establish the local datum for the very first setup of the campaign, when no
 * coordinate exists anywhere yet.
 *
 * There used to be a choice here — a compass bearing good to 30', or declaring
 * the line to the ré to be north — and both rotated the surveyed frame away
 * from the world. That is defensible surveying and indefensible teaching: the
 * north arrow on the map pointed one way, every azimuth in the memorial was
 * measured from another, and nothing on screen said so. A student learning what
 * an azimuth IS should not be quietly handed two norths.
 *
 * So there is one datum now and its north is the canvas's north. The origin is
 * still an arbitrary local (1000, 1000), which keeps the coordinates reading
 * like a local grid — and costs nothing, because azimuth is `atan2(dE, dN)` and
 * is exactly invariant under translation.
 *
 * @param {{trueE:number, trueN:number}} p.m1
 * @param {{trueE:number, trueN:number}} p.m2
 * @param {number} p.originE @param {number} p.originN
 */
export function establishDatum({ m1, m2, originE = 1000, originN = 1000 }) {
  return {
    originE,
    originN,
    /** Identical to the world azimuth: the frame is a pure translation. */
    azimuthM1M2: azimuth(m1.trueE, m1.trueN, m2.trueE, m2.trueN),
  };
}

/** Convenience: the orientation constant, spelled out for the field book. */
export const orientationConstant = (knownAz, reading) => normalize360(knownAz - reading);

/** Angle to the right between two readings taken from the same setup. */
export const angleBetween = (reading1, reading2) => normalize360(reading2 - reading1);

/** Approximate σ of a direction in arc-seconds, for display. */
export const dirSigmaSec = (instrument, d) => directionSigma(instrument, d) * 3600;

export { secToDeg, toDeg };
