// What the instrument would be reading, right now.
//
// The live counterpart of `sightTarget`: the same geometry, with no random
// draws, no collimation and no record kept. Swinging the telescope around and
// watching the circle move is how the relationship between a reading, the
// orientation constant and an azimuth stops being three formulas and becomes
// one thing — which is what `descricao.md` asks for when it says angles,
// distances and azimuths must be presented interactively.
//
// It lives in its own DOM-free module rather than inside the canvas call that
// draws it, because the arithmetic here is the didactic claim of the panel, and
// a claim is worth testing.

import { normalize360 } from './units.js';
import { azimuth, distance } from './geometry.js';
import { angleBetween } from './station.js';

/**
 * The readout for a setup pointed at a world position.
 *
 * The frame question is the whole difficulty here, and getting it wrong is
 * silent. There are two coordinate systems in this game:
 *
 *   * the WORLD frame, where the terrain, the entities and the tripod actually
 *     are — this is what `tE, tN` must be given in;
 *   * the SURVEYED frame, born at an arbitrary (1000, 1000) the first time a
 *     datum is established, which is where `setup.E/N` and every reduced
 *     coordinate live.
 *
 * They are typically about a kilometre apart, so mixing them produces a
 * plausible-looking distance that is nonsense. Everything below therefore
 * measures in the TRUE frame and then maps into the surveyed one exactly the
 * way `sightTarget` does: through `circleOffset` to get the circle reading, and
 * through `theta0` to reduce that reading to an azimuth.
 *
 * @param {object} setup                  a station record from `station.js`
 * @param {number} tE @param {number} tN  where the telescope points, WORLD frame
 * @returns {{azimuth:number, hz:number, fromBacksight:number|null,
 *            distance:number, backsightId:string|null, backsightReading:number|null}}
 */
export function aimReadout(setup, tE, tN) {
  // Where the instrument physically stands, including its centring error.
  const trueAz = azimuth(setup.trueE, setup.trueN, tE, tN);

  // The circle reading. `circleOffset` is the azimuth the circle calls zero, so
  // subtracting it is what turns a direction in the world into a number on the
  // instrument face.
  const hz = normalize360(trueAz - setup.circleOffset);

  // And the reduction the player would then do by hand.
  const az = normalize360(hz + setup.theta0);

  // A free station is oriented by resection, not by a backsight, so there is no
  // ré to measure an angle from and the panel must not invent one.
  const hasBacksight = setup.backsightId != null && setup.backsightReading != null;

  return {
    azimuth: az,
    hz,
    fromBacksight: hasBacksight ? angleBetween(setup.backsightReading, hz) : null,
    distance: distance(setup.trueE, setup.trueN, tE, tN),
    backsightId: hasBacksight ? setup.backsightId : null,
    backsightReading: hasBacksight ? setup.backsightReading : null,
  };
}

/**
 * The horizontal circle, as a diagram.
 *
 * Everything is in AZIMUTH space: zero at the top, increasing clockwise, with
 * **north always at twelve o'clock**. So the diagram is oriented the same way
 * as the map above it, and every angle in it can be read straight off against
 * the ground — the ré ray points where the ré physically lies, the target ray
 * points at what the telescope is pointed at, and the shaded wedge between them
 * is the angle you would see standing over the tripod looking down.
 *
 * It used to be drawn in CIRCLE-READING space, which put the ré at twelve
 * o'clock whenever the circle was zeroed on it and pushed north round by θ0.
 * That is a truthful picture of the instrument's face and a confusing one on
 * screen: the diagram and the map disagreed about which way was up, so a
 * student had to mentally rotate one to compare it with the other. Since round
 * six every azimuth in this game is referred to the map's north, and this is the
 * same decision applied to the picture. `Az = Hz + θ0` is still on the panel, as
 * the two numbers beside it.
 *
 * The swept ANGLE is unaffected — rotating both rays by θ0 leaves the wedge
 * between them exactly where it was, which is why this costs nothing didactic.
 *
 * Pure geometry, deliberately: the canvas code that renders this cannot be
 * tested, and the claim it makes about angles is worth testing.
 *
 * @param {object} setup
 * @param {object} r  the matching `aimReadout`
 * @returns {{target:number, backsight:number|null, north:number,
 *            sweepFrom:number|null, sweepTo:number|null, sweep:number|null}}
 *          all bearings on the dial, in degrees, clockwise from north
 */
export function circleDial(setup, r) {
  /** A circle reading, as the azimuth it reduces to. */
  const toAzimuth = (hz) => normalize360(hz + setup.theta0);

  // North is the top of the dial, by construction. Kept in the return value
  // rather than left implicit so the renderer draws the tick from the same
  // source of truth as everything else, and so the test can state it.
  const north = 0;

  if (r.backsightReading == null) {
    // A free station has no ré, so there is no angle to sweep and nothing
    // honest to draw between two rays. The target and north still stand.
    return { target: r.azimuth, backsight: null, north, sweepFrom: null, sweepTo: null, sweep: null };
  }

  const backsight = toAzimuth(r.backsightReading);
  return {
    target: r.azimuth,
    backsight,
    north,
    // Clockwise from the ré to the target — the angle to the right, which is
    // the one the field book tabulates. Both ends rotate together, so this is
    // still exactly `fromBacksight`.
    sweepFrom: backsight,
    sweepTo: r.azimuth,
    sweep: r.fromBacksight,
  };
}
