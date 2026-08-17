// The live aim readout.
//
// The panel claims something didactic — that the circle reading, the
// orientation constant and the azimuth are one relationship — so the claim is
// asserted here rather than eyeballed on a canvas.
//
// The frame is the part worth guarding. Surveyed coordinates are born at an
// arbitrary (1000, 1000) while the world is a 640 m valley around the origin,
// so a readout that mixes the two produces a believable distance that is wrong
// by about a kilometre. That is exactly the bug these tests exist to catch.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aimReadout } from '../src/survey/readout.js';
import { setupOverKnownPoint, setupFreeStation, sightTarget, ORIENT } from '../src/survey/station.js';
import { resolveKit } from '../src/survey/instrument.js';
import { makeRng } from '../src/core/rng.js';
import { normalize360 } from '../src/survey/units.js';

const kit = () => resolveKit({});

/**
 * A station standing in the WORLD at (200, 200) but surveyed as (1000, 1000) —
 * the offset the real game actually has. The backsight is 100 m due east in
 * both frames, so the datum here is a pure translation and the expected angles
 * stay easy to state by hand.
 */
function twoPoints() {
  return {
    over: { id: 'M1', E: 1000, N: 1000, trueE: 200, trueN: 200 },
    backsight: { id: 'M2', E: 1100, N: 1000, trueE: 300, trueN: 200 },
  };
}

function station(orientMode = ORIENT.ZERO_BACKSIGHT, tag = 'x') {
  const { over, backsight } = twoPoints();
  return setupOverKnownPoint({ over, backsight, kit: kit(), rng: makeRng('readout', tag), orientMode });
}

test('the readout measures in the world frame, not the surveyed one', () => {
  const setup = station();
  // 100 m due north of where the instrument physically stands.
  const r = aimReadout(setup, 200, 300);

  // Mixing the frames here would give ~1100 m, which is the bug.
  assert.ok(Math.abs(r.distance - 100) < 0.02, `expected ~100 m, got ${r.distance.toFixed(2)}`);
});

test('Hz + theta0 recovers the azimuth', () => {
  const setup = station();
  const r = aimReadout(setup, 260, 340);
  assert.ok(Math.abs(normalize360(r.hz + setup.theta0) - r.azimuth) < 1e-9);
});

test('aimed at the ré, the circle reads zero and so does the angle from it', () => {
  const setup = station();
  const { backsight } = twoPoints();
  const r = aimReadout(setup, backsight.trueE, backsight.trueN);

  assert.ok(Math.abs(setup.backsightReading) < 1e-9, 'zeroBacksight puts 0 on the ré');
  // Within the pointing error the setup itself drew.
  const off = Math.min(r.fromBacksight, 360 - r.fromBacksight);
  assert.ok(off < 0.01, `angle from the ré should be ~0, got ${r.fromBacksight}`);
});

test('the angle from the ré is measured to the right, whatever the circle reads', () => {
  // ARBITRARY leaves the circle wherever it sits, so backsightReading is not 0
  // and a readout that merely echoed Hz would be wrong.
  const setup = station(ORIENT.ARBITRARY, 'arb');
  assert.ok(setup.backsightReading > 0, 'an arbitrary circle does not read zero on the ré');

  const { backsight } = twoPoints();
  const atRe = aimReadout(setup, backsight.trueE, backsight.trueN);
  const off = Math.min(atRe.fromBacksight, 360 - atRe.fromBacksight);
  assert.ok(off < 0.01, `still zero at the ré, got ${atRe.fromBacksight}`);

  // M2 is due east; due north is a quarter turn left of it, so 270 to the right.
  const north = aimReadout(setup, 200, 300);
  assert.ok(Math.abs(north.fromBacksight - 270) < 0.02, `expected ~270, got ${north.fromBacksight}`);
});

test('the readout is what a sight would record, without the noise', () => {
  // The strongest statement available: point the live readout and a real
  // observation at the same target and check they agree to within the
  // instrument's own precision. If the readout ever drifts from `sightTarget`,
  // the panel starts teaching something the game does not do.
  const setup = station(ORIENT.ZERO_BACKSIGHT, 'agree');
  const target = { id: 'V1', trueE: 268, trueN: 331, label: 'V1' };

  const live = aimReadout(setup, target.trueE, target.trueN);
  const obs = sightTarget({ setup, target, kit: kit(), rng: makeRng('readout', 'sight') });

  const dHz = Math.abs(normalize360(live.hz - obs.hz + 180) - 180);
  assert.ok(dHz < 0.02, `Hz differs by ${(dHz * 3600).toFixed(0)}", more than pointing noise`);
  assert.ok(Math.abs(live.distance - obs.distance) < 0.05, `distance differs by ${live.distance - obs.distance}`);
});

test('a free station reports no ré at all', () => {
  const solution = { E: 1000, N: 1000, trueE: 200, trueN: 200, theta0: 137.5 };
  const setup = setupFreeStation({ solution, kit: kit(), rng: makeRng('readout', 'free'), circleOffset: 42 });

  const r = aimReadout(setup, 250, 250);
  assert.equal(r.backsightId, null);
  assert.equal(r.fromBacksight, null, 'inventing an angle from a ré that does not exist would be a lie');
  assert.ok(Number.isFinite(r.hz) && Number.isFinite(r.azimuth), 'but the reading and azimuth still work');
});
