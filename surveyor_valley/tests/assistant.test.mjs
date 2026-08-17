// Ligeirinho.
//
// He is worth testing rather than eyeballing for one reason: a sight now waits
// for him. Anything that can leave him short of the point forever leaves the
// player holding a telescope aimed at a reading that never lands, with no error
// and nothing on screen to explain it. So the assertions here are mostly about
// the ways an errand can fail rather than the way it succeeds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeAssistant,
  updateAssistant,
  sendTo,
  recall,
  placeBeside,
  interpolatedAssistant,
  ARRIVE_RADIUS,
  STUCK_TIMEOUT,
  ERRAND_CEILING,
  FOLLOW_DISTANCE,
  DASH_SPEED,
  MODE,
} from '../src/game/assistant.js';
import { buildWorld } from '../src/world/world.js';
import { DIFFICULTY } from '../src/core/state.js';
import { canStand } from '../src/game/player.js';

const DT = 1 / 60;
const world = buildWorld('sv-ligeirinho', DIFFICULTY.facil);

/** Somewhere in this world he could legitimately stand. */
function openSpot(near = { e: 110, n: 110 }) {
  for (let r = 0; r <= 60; r += 1) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 2));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const e = near.e + Math.cos(a) * r;
      const n = near.n + Math.sin(a) * r;
      if (canStand(world, e, n)) return { e, n };
    }
  }
  throw new Error('no open ground in this world');
}

/** Run him until something happens, or the clock runs out. */
function runUntil(a, ctx, seconds = 10) {
  const events = { arrived: 0, gaveUp: 0 };
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    const r = updateAssistant(a, world, DT, ctx);
    if (r.arrived) events.arrived++;
    if (r.gaveUp) events.gaveUp++;
    if (events.arrived || events.gaveUp) {
      // Keep going a little, to prove the event does not repeat.
      for (let k = 0; k < 30; k++) {
        const again = updateAssistant(a, world, DT, ctx);
        if (again.arrived) events.arrived++;
        if (again.gaveUp) events.gaveUp++;
      }
      return { ...events, seconds: i * DT };
    }
  }
  return { ...events, seconds };
}

test('he reaches the point, and reports it exactly once', () => {
  const from = openSpot();
  const to = openSpot({ e: from.e + 40, n: from.n });

  const a = makeAssistant(from);
  sendTo(a, to.e, to.n);
  const ev = runUntil(a, { player: from });

  assert.equal(ev.arrived, 1, `arrived should fire once, fired ${ev.arrived}`);
  assert.equal(ev.gaveUp, 0, 'and not also give up');
  assert.ok(
    Math.hypot(a.e - to.e, a.n - to.n) <= ARRIVE_RADIUS,
    `he should be on the point, is ${Math.hypot(a.e - to.e, a.n - to.n).toFixed(2)} m off`,
  );
  assert.equal(a.mode, MODE.PLANTED, 'and standing on it with the pole up');
});

test('the run is quick enough to read as instant', () => {
  const from = openSpot();
  const to = openSpot({ e: from.e + 45, n: from.n });
  const straight = Math.hypot(to.e - from.e, to.n - from.n);

  const a = makeAssistant(from);
  sendTo(a, to.e, to.n);
  const ev = runUntil(a, { player: from });

  // Generous: sliding around scenery costs him distance. The claim is only that
  // a sight is not a wait — the whole point of the fast-forward pace.
  assert.ok(ev.seconds < 2.0, `took ${ev.seconds.toFixed(2)} s for ${straight.toFixed(0)} m`);
  assert.ok(DASH_SPEED > 20, 'the pace constant is what makes that true');
});

test('a point he cannot reach gives up rather than never arriving', () => {
  // The failure that would softlock a sight. Water is the honest version of it:
  // `canStand` refuses every position in a lake, so no amount of running gets
  // him there and only the timeout ends the errand.
  const from = openSpot();
  let lake = null;
  for (let e = 5; e < 215 && !lake; e += 1.5) {
    for (let n = 5; n < 215; n += 1.5) {
      if (world.terrain.soilAt(e, n).id !== 'AGUA') continue;
      // Well inside it, so the shoreline cannot be mistaken for the target.
      if (!world.terrain.soilAt(e + 2, n).walkable && !world.terrain.soilAt(e - 2, n).walkable) {
        lake = { e, n };
        break;
      }
    }
  }
  assert.ok(lake, 'this world has open water to test against');

  const a = makeAssistant(from);
  sendTo(a, lake.e, lake.n);
  const ev = runUntil(a, { player: from }, ERRAND_CEILING + 2);

  assert.equal(ev.arrived, 0, 'he cannot have stood in the lake');
  assert.equal(ev.gaveUp, 1, 'so he must give up, exactly once');
  assert.ok(ev.seconds <= ERRAND_CEILING + 0.2, `gave up at ${ev.seconds.toFixed(2)} s`);
  assert.equal(a.mode, MODE.PLANTED, 'and holds the pole where he got to');
});

test('a long errand is not mistaken for a stuck one', () => {
  // The distinction the timeout exists to make. Measured on a flat four-second
  // budget, a 150 m sight from a batch measure expired while he was still
  // running perfectly well, and the reading was silently taken from wherever he
  // had got to instead of from the point. Giving up is about not GETTING
  // CLOSER, never about the errand being long.
  const from = openSpot({ e: 30, n: 30 });
  const to = openSpot({ e: 190, n: 190 });
  const straight = Math.hypot(to.e - from.e, to.n - from.n);
  assert.ok(straight > 120, `this is meant to be a long run, got ${straight.toFixed(0)} m`);

  const a = makeAssistant(from);
  sendTo(a, to.e, to.n);
  const ev = runUntil(a, { player: from }, ERRAND_CEILING + 2);

  assert.equal(ev.gaveUp, 0, `gave up on a ${straight.toFixed(0)} m run he was completing`);
  assert.equal(ev.arrived, 1, 'he got there');
});

test('the dash does not step over a fence', () => {
  // 45 m/s is 0.75 m in a fixed step, and `canStand` tests a position rather
  // than a swept path — so without sub-stepping he would clear a fence, a post
  // and most of a building without ever occupying an illegal spot.
  const fence = world.entities.find((ent) => ent.kind === 'cerca' && ent.seg && ent.seg.length > 2);
  assert.ok(fence, 'this world has a fence');

  // Straddle the middle of one segment: start a few metres one side, aim the
  // same distance the other.
  const [ax, ay] = fence.seg[0];
  const [bx, by] = fence.seg[1];
  const mid = { e: (ax + bx) / 2, n: (ay + by) / 2 };
  const len = Math.hypot(bx - ax, by - ay);
  const nx = (by - ay) / len;
  const ny = -(bx - ax) / len;

  const from = { e: mid.e + nx * 4, n: mid.n + ny * 4 };
  const to = { e: mid.e - nx * 4, n: mid.n - ny * 4 };
  if (!canStand(world, from.e, from.n)) return; // scenery in the way; nothing to prove here

  const a = makeAssistant(from);
  sendTo(a, to.e, to.n);
  runUntil(a, { player: from }, STUCK_TIMEOUT + 1);

  // Signed distance along the fence normal keeps its sign if he never crossed.
  const side = (p) => (p.e - mid.e) * nx + (p.n - mid.n) * ny;
  assert.ok(side(a) > -0.5, `he ended up ${side(a).toFixed(2)} m through the fence`);
});

test('with nothing to do he trails the player and then stops', () => {
  const spot = openSpot();
  const a = makeAssistant({ e: spot.e - 20, n: spot.n });
  for (let i = 0; i < 600; i++) updateAssistant(a, world, DT, { player: spot });

  const d = Math.hypot(a.e - spot.e, a.n - spot.n);
  assert.ok(d <= FOLLOW_DISTANCE + 0.6, `should close to about ${FOLLOW_DISTANCE} m, sat at ${d.toFixed(2)}`);
  assert.equal(a.moving, false, 'and settle rather than jittering on the spot');
  assert.equal(a.walkPhase, 0, 'legs at rest');
});

test('recall abandons the errand', () => {
  const from = openSpot();
  const a = makeAssistant(from);
  sendTo(a, from.e + 60, from.n);
  updateAssistant(a, world, DT, { player: from });
  assert.equal(a.mode, MODE.DASH);

  recall(a);
  assert.equal(a.mode, MODE.FOLLOW);
  assert.equal(a.target, null, 'and forgets where he was going');

  const ev = runUntil(a, { player: from }, 3);
  assert.equal(ev.arrived, 0, 'a recalled errand must never land a reading');
});

test('sending him where he is already going does not restart the run', () => {
  const from = openSpot();
  const a = makeAssistant(from);
  sendTo(a, from.e + 60, from.n);
  for (let i = 0; i < 20; i++) updateAssistant(a, world, DT, { player: from });
  const spent = a.dashTime;

  sendTo(a, from.e + 60, from.n);
  assert.equal(a.dashTime, spent, 'a double click must not reset the timeout he is racing');
});

test('the legs are driven by ground covered, not by intent', () => {
  const spot = openSpot();
  const a = makeAssistant(spot);
  // Nothing to do and nobody to follow: he must not scrub in place.
  for (let i = 0; i < 60; i++) updateAssistant(a, world, DT, { player: spot });
  assert.equal(a.moving, false);
  assert.equal(a.speed, 0);
});

test('he is put down beside the player, never inside something', () => {
  const spot = openSpot();
  const a = placeBeside(world, spot);
  assert.ok(canStand(world, a.e, a.n, 0.3), 'placed somewhere he could stand');
  assert.ok(Math.hypot(a.e - spot.e, a.n - spot.n) <= 6.1, 'and beside the player, not across the valley');
});

test('the render position interpolates between fixed steps', () => {
  const a = makeAssistant({ e: 10, n: 10 });
  a.prevE = 10;
  a.prevN = 10;
  a.e = 11;
  a.n = 12;
  const half = interpolatedAssistant(a, 0.5);
  assert.equal(half.e, 10.5);
  assert.equal(half.n, 11);
  assert.equal(a.e, 11, 'and does not disturb the simulation state');
});
