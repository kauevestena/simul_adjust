// Walking.
//
// `updatePlayer` had no tests at all, which is how it kept a walk cycle driven
// by the speed the player ASKED for rather than the ground they covered. These
// pin the things that make the motion read as a person rather than a sprite
// being dragged: the ramps, the turn, the slide along a fence, and the fact
// that being stopped by something stops the legs too.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makePlayer,
  updatePlayer,
  fastTravel,
  halt,
  WALK_SPEED,
  RUN_SPEED,
} from '../src/game/player.js';

const DT = 1 / 60;

/** A featureless 100 x 100 m field, with optional entities and wet ground. */
function makeWorld({ entities = [], soil = () => ({ walkable: true, speedFactor: 1 }) } = {}) {
  return {
    bounds: { minE: 0, maxE: 100, minN: 0, maxN: 100 },
    terrain: { soilAt: (e, n) => soil(e, n) },
    spatial: { queryCircle: () => entities },
  };
}

/** Hold `intent` for `seconds` of fixed steps. */
function walk(player, world, intent, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) updatePlayer(player, intent, world, DT);
  return player;
}

const still = { e: 0, n: 0, run: false };

test('speed ramps up instead of snapping to full pace', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });

  updatePlayer(p, { e: 0, n: 1, run: false }, world, DT);
  assert.ok(p.speed > 0, 'the first step moves the player');
  assert.ok(p.speed < WALK_SPEED * 0.5, `one step should not be full pace, got ${p.speed.toFixed(2)}`);

  walk(p, world, { e: 0, n: 1, run: false }, 0.25);
  assert.ok(Math.abs(p.speed - WALK_SPEED) < 0.02, `settles at walking pace, got ${p.speed.toFixed(3)}`);

  // And stays there: the ramp must not overshoot into a sprint.
  walk(p, world, { e: 0, n: 1, run: false }, 1);
  assert.ok(p.speed <= WALK_SPEED + 1e-6, 'never exceeds the target speed');
});

test('releasing the key glides to a stop, then stops dead', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });
  walk(p, world, { e: 0, n: 1, run: false }, 1);

  const at = p.n;
  updatePlayer(p, still, world, DT);
  assert.ok(p.n > at, 'one more step of momentum rather than an instant halt');

  walk(p, world, still, 0.5);
  assert.equal(p.speed, 0, 'and it does reach zero — no exponential creep');
  assert.equal(p.moving, false);

  const rest = p.n;
  walk(p, world, still, 1);
  assert.equal(p.n, rest, 'a standing player does not drift');
});

test('the walk cycle settles on the passing pose rather than freezing mid-stride', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });

  // Stop at a moment that is deliberately NOT a passing pose.
  walk(p, world, { e: 0, n: 1, run: false }, 1);
  p.walkPhase = 1.4;
  walk(p, world, still, 1);

  assert.equal(p.moving, false);
  assert.equal(p.frame, 0, 'frames 0 and 2 are the passing pose; it lands on one');
});

test('a standing player breathes, and a walking one does not', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });

  // Walking: no idle clock at all, or the breath would fight the walk cycle.
  walk(p, world, { e: 0, n: 1, run: false }, 1);
  assert.equal(p.idlePhase, 0, 'the idle clock does not run while walking');
  assert.equal(p.idleFrame, 0);

  // Stop, then stand. The breath must reach BOTH poses over a full cycle —
  // a clock that ticks but always resolves to the same frame is still static.
  walk(p, world, still, 0.5);
  const seen = new Set();
  for (let i = 0; i < Math.round(3 / DT); i++) {
    updatePlayer(p, still, world, DT);
    seen.add(p.idleFrame);
  }
  assert.deepEqual([...seen].sort(), [0, 1], 'both breath frames are used');
  assert.ok(p.idlePhase > 2.5, `the idle clock advances while standing (${p.idlePhase.toFixed(2)}s)`);

  // And none of it disturbs what the walk cycle and the footstep audio read.
  assert.equal(p.moving, false);
  assert.equal(p.frame, 0);
  assert.equal(p.walkPhase, 0);
});

test('the breath rests longer than it peaks', () => {
  // Lopsided on purpose: an even alternation reads as a mechanical flicker.
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });
  walk(p, world, still, 0.2);

  let raised = 0;
  const steps = Math.round(4.8 / DT); // two full cycles
  for (let i = 0; i < steps; i++) {
    updatePlayer(p, still, world, DT);
    if (p.idleFrame === 1) raised++;
  }
  const share = raised / steps;
  assert.ok(share > 0.2 && share < 0.45, `chest raised ${(share * 100).toFixed(0)}% of the time`);
});

test('halting and fast travel stop the breath too', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });
  walk(p, world, still, 2);
  assert.ok(p.idlePhase > 1);

  halt(p);
  assert.equal(p.idlePhase, 0, 'a modal freezes the surveyor completely');
  assert.equal(p.idleFrame, 0);

  walk(p, world, still, 2);
  fastTravel(p, world, { e: 20, n: 20 }, null);
  assert.equal(p.idlePhase, 0, 'and so does arriving somewhere new');
  assert.equal(p.idleFrame, 0);
});

test('diagonals are no faster than cardinals', () => {
  const world = makeWorld();
  const straight = walk(makePlayer({ e: 50, n: 50 }), world, { e: 0, n: 1, run: false }, 2);
  const diagonal = walk(makePlayer({ e: 50, n: 50 }), world, { e: 1, n: 1, run: false }, 2);

  const dStraight = straight.n - 50;
  const dDiagonal = Math.hypot(diagonal.e - 50, diagonal.n - 50);
  assert.ok(Math.abs(dStraight - dDiagonal) < 0.01, `${dStraight.toFixed(3)} vs ${dDiagonal.toFixed(3)}`);
});

test('running is faster, and shift is a ramp not a switch', () => {
  const world = makeWorld();
  const p = walk(makePlayer({ e: 50, n: 20 }), world, { e: 0, n: 1, run: false }, 1);

  // Still a ramp, just a short one. The rate was tripled deliberately — a
  // survey is dozens of five-metre hops and the old ramp cost a beat on every
  // one — so "the first step is near walking pace" is no longer the right
  // statement of it. What must stay true is that shift is not a switch.
  updatePlayer(p, { e: 0, n: 1, run: true }, world, DT);
  assert.ok(p.speed < RUN_SPEED, `the first running step is not already full pace (${p.speed.toFixed(2)})`);
  assert.ok(p.speed > WALK_SPEED, 'but it is already faster than walking');

  walk(p, world, { e: 0, n: 1, run: true }, 0.4);
  assert.ok(Math.abs(p.speed - RUN_SPEED) < 0.02, `reaches running pace, got ${p.speed.toFixed(3)}`);
});

test('soft ground slows the player down', () => {
  const marsh = makeWorld({ soil: () => ({ walkable: true, speedFactor: 0.45 }) });
  const p = walk(makePlayer({ e: 50, n: 50 }), marsh, { e: 0, n: 1, run: false }, 1);
  assert.ok(Math.abs(p.speed - WALK_SPEED * 0.45) < 0.02, `wades, got ${p.speed.toFixed(3)}`);
});

test('turning around brakes rather than coasting through zero', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });
  walk(p, world, { e: 1, n: 0, run: false }, 1);

  const turned = p.e;
  let reversedAfter = null;
  for (let i = 0; i < 60; i++) {
    updatePlayer(p, { e: -1, n: 0, run: false }, world, DT);
    if (reversedAfter === null && p.e < turned) reversedAfter = (i + 1) * DT;
  }

  assert.ok(reversedAfter !== null && reversedAfter < 0.2, `heads back within 0.2 s, took ${reversedAfter}`);
  assert.ok(p.e - turned < 0.15, 'and overshoots by well under a stride');
  assert.equal(p.facing, 'W', 'the sprite turns immediately even though the body does not');
});

test('facing holds when a pressed direction is still pressed', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });

  walk(p, world, { e: 1, n: 0, run: false }, 0.3);
  assert.equal(p.facing, 'E');

  // Adding north to an eastward walk should not snap the sprite round.
  updatePlayer(p, { e: 1, n: 1, run: false }, world, DT);
  assert.equal(p.facing, 'E');

  // Dropping east does.
  updatePlayer(p, { e: 0, n: 1, run: false }, world, DT);
  assert.equal(p.facing, 'N');
});

test('a blocked player stops walking on the spot', () => {
  // A wall straight across the path.
  const wall = { blocksWalk: true, kind: 'cerca', seg: [[0, 20], [100, 20]] };
  const world = makeWorld({ entities: [wall] });
  const p = walk(makePlayer({ e: 50, n: 15 }), world, { e: 0, n: 1, run: false }, 3);

  assert.ok(p.n < 20, 'the wall holds');
  assert.ok(p.n > 19, 'and the player gets right up to it');

  // The bug this pins: the legs used to keep churning at full pace against it.
  const phase = p.walkPhase;
  walk(p, world, { e: 0, n: 1, run: false }, 1);
  assert.equal(p.walkPhase, phase, 'the walk cycle does not advance while stuck');
  assert.equal(p.speed, 0);
  assert.equal(p.moving, false);
});

test('a diagonal fence is slid along, not stuck to', () => {
  // A fence at 45 degrees, walked into head-on from below.
  const fence = { blocksWalk: true, kind: 'cerca', seg: [[10, 10], [40, 40]] };
  const world = makeWorld({ entities: [fence] });
  const p = walk(makePlayer({ e: 18, n: 14 }), world, { e: 0, n: 1, run: false }, 3);

  assert.ok(p.n > 16, 'reaches the fence');
  assert.ok(p.e > 20, `and travels along it rather than sticking, e = ${p.e.toFixed(2)}`);
  assert.ok(p.moving, 'still walking, because it is still covering ground');
});

test('a tree is brushed past rather than walked into', () => {
  const tree = { blocksWalk: true, e: 50, n: 20, r: 0.9 };
  const world = makeWorld({ entities: [tree] });
  // Aimed a hair off centre — the direction a player nudges past an obstacle.
  const p = walk(makePlayer({ e: 50.3, n: 15 }), world, { e: 0, n: 1, run: false }, 4);

  assert.ok(p.n > 21, `gets past the trunk, n = ${p.n.toFixed(2)}`);
  assert.ok(p.e > 50.3, 'by going round the near side');
});

test('the water line is walked along, not bounced off', () => {
  // Terrain is a field, not a polygon, so this normal is probed rather than
  // computed — the case that used to leave the bank sticky.
  const world = makeWorld({
    soil: (e, n) => (n > 30 ? { walkable: false, speedFactor: 0 } : { walkable: true, speedFactor: 1 }),
  });
  const p = walk(makePlayer({ e: 20, n: 25 }), world, { e: 0.4, n: 1, run: false }, 3);

  assert.ok(p.n <= 30, 'stays out of the water');
  assert.ok(p.e > 22, `and keeps making way along the bank, e = ${p.e.toFixed(2)}`);
});

test('fast travel arrives standing still', () => {
  const world = makeWorld();
  const p = makePlayer({ e: 50, n: 50 });
  walk(p, world, { e: 1, n: 0, run: false }, 1);

  const r = fastTravel(p, world, { e: 20, n: 20 }, null);
  assert.equal(r.ok, true);

  // Carrying momentum through a teleport would walk the player straight back
  // off the marco they just travelled to.
  updatePlayer(p, still, world, DT);
  assert.equal(p.e, 20);
  assert.equal(p.n, 20);
  assert.equal(p.speed, 0);
  assert.equal(p.moving, false);
});
