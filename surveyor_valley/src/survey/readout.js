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
 * Everything is in CIRCLE-READING space, with zero at the top and increasing
 * clockwise — which is the instrument's own face, not the map's. That is the
 * point of drawing it: zeroing on the ré visibly puts the ré at twelve
 * o'clock, and north then sits wherever θ0 has pushed it. A student who can
 * see those two facts at once has understood `Az = Hz + θ0`, which is the
 * single hardest idea in a first surveying course.
 *
 * Pure geometry, deliberately: the canvas code that renders this cannot be
 * tested, and the claim it makes about angles is worth testing.
 *
 * @param {object} setup
 * @param {object} r  the matching `aimReadout`
 * @returns {{target:number, backsight:number|null, north:number,
 *            sweepFrom:number|null, sweepTo:number|null, sweep:number|null}}
 *          all bearings on the circle, in degrees
 */
export function circleDial(setup, r) {
  // Where azimuth zero falls on the circle: `Az = Hz + θ0`, so Hz = −θ0.
  const north = normalize360(-setup.theta0);

  if (r.backsightReading == null) {
    // A free station has no ré, so there is no angle to sweep and nothing
    // honest to draw between two rays. The target and north still stand.
    return { target: r.hz, backsight: null, north, sweepFrom: null, sweepTo: null, sweep: null };
  }

  return {
    target: r.hz,
    backsight: r.backsightReading,
    north,
    // Clockwise from the ré to the target — the angle to the right, which is
    // the one the field book tabulates.
    sweepFrom: r.backsightReading,
    sweepTo: r.hz,
    sweep: r.fromBacksight,
  };
}
