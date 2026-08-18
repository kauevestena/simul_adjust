// Finding the boundary evidence.
//
// This file exists because its absence let a blocker live from the first
// commit. A share of corners are generated buried in scrub — the didactic lever
// of the harder settings — and every path deciding what the instrument may be
// pointed at skipped them outright, for good. `parcelProgress` needs every
// corner, so ENTREGA never unlocked: measured over five seeds, 67% of médio and
// 90% of difícil parcels could not be delivered at all.
//
// So the assertions here are about the whole chain, not just the radius: found
// means found, it survives a reload, and no parcel is impossible.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { revealMarksNear, applyRevealed, REVEAL_RADIUS } from '../src/game/discovery.js';
import { buildWorld } from '../src/world/world.js';
import { DIFFICULTY } from '../src/core/state.js';

const world = buildWorld('sv-discovery', DIFFICULTY.dificil);

/** Any corner this world buried. */
function buriedMark(w = world) {
  return w.entities.find((e) => e.targetKind === 'divisa' && e.hidden);
}

/** Walk the perimeter of a parcel, the way the owner walks it with you. */
function perimeter(parcel, stride = 8) {
  const out = [];
  const vs = parcel.vertices;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.e - a.e, b.n - a.n) / stride));
    for (let k = 0; k < steps; k++) {
      out.push({ e: a.e + ((b.e - a.e) * k) / steps, n: a.n + ((b.n - a.n) * k) / steps });
    }
  }
  return out;
}

test('walking up to a buried corner finds it', () => {
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);
  assert.ok(mark, 'difícil buries some corners — that is the whole setting');

  const found = revealMarksNear(w, [{ e: mark.e + 3, n: mark.n }]);
  assert.ok(found.includes(mark.id), 'standing 3 m away should turn it up');
  assert.equal(mark.hidden, false);
});

test('a corner out of reach stays buried', () => {
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);
  const away = (mark.revealRadius ?? REVEAL_RADIUS) + 12;

  const found = revealMarksNear(w, [{ e: mark.e + away, n: mark.n }]);
  assert.ok(!found.includes(mark.id), `revealed a corner ${away} m away`);
  assert.equal(mark.hidden, true, 'the lever only works if it can still hide things');
});

test('found stays found when the crew walks away', () => {
  // The reason discovery is permanent rather than a draw distance: a reading is
  // taken from the eyepiece, so a corner targetable only while you stood beside
  // it would need the player in two places at once.
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);

  revealMarksNear(w, [{ e: mark.e, n: mark.n }]);
  revealMarksNear(w, [{ e: mark.e + 400, n: mark.n + 400 }]);
  assert.equal(mark.hidden, false, 'walking off re-buried it');
});

test('a corner is announced exactly once', () => {
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);
  const at = [{ e: mark.e, n: mark.n }];

  const first = revealMarksNear(w, at);
  assert.ok(first.includes(mark.id));
  const second = revealMarksNear(w, at);
  assert.ok(!second.includes(mark.id), 'a second pass must not re-announce it');
});

test('Ligeirinho turns them up as well as the player does', () => {
  // He beats a path through the same scrub at 45 m/s, and both crew positions
  // are passed together — so this is really asserting that the second position
  // in the list counts at all.
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);
  const found = revealMarksNear(w, [{ e: mark.e + 900, n: mark.n + 900 }, { e: mark.e + 1, n: mark.n }]);
  assert.ok(found.includes(mark.id), 'only the first crew member was looking');
});

test('nothing but a boundary mark is disturbed', () => {
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const mark = buriedMark(w);
  const near = w.spatial.queryCircle(mark.e, mark.n, 10).filter((e) => e.targetKind !== 'divisa');
  const before = near.map((e) => e.hidden);
  revealMarksNear(w, [{ e: mark.e, n: mark.n }]);
  assert.deepEqual(near.map((e) => e.hidden), before, 'scrub and posts are not evidence');
});

test('the discoveries survive a reload', () => {
  // A save stores the seed, not the valley, so the world comes back with every
  // corner buried again. Without this the player walks the whole perimeter
  // twice — and on difícil pays for it on the clock.
  const first = buildWorld('sv-discovery', DIFFICULTY.dificil);
  const parcel = first.parcels[0];
  const saved = revealMarksNear(first, perimeter(parcel));
  assert.ok(saved.length, 'this parcel had something to find');

  const reloaded = buildWorld('sv-discovery', DIFFICULTY.dificil);
  assert.ok(saved.every((id) => reloaded.entity(id).hidden), 'a fresh world starts buried');

  const back = applyRevealed(reloaded, saved);
  assert.equal(back, saved.length);
  for (const id of saved) assert.equal(reloaded.entity(id).hidden, false, `${id} came back buried`);
});

test('applying a stale id list is harmless', () => {
  // Ids come out of a save file, and a save can name a corner this build's
  // generator no longer produces.
  const w = buildWorld('sv-discovery', DIFFICULTY.dificil);
  assert.equal(applyRevealed(w, ['divisa-nonesuch', undefined]), 0);
  assert.equal(applyRevealed(w, undefined), 0);
});

test('no parcel is impossible to deliver', () => {
  // THE regression test of this round. Every corner of every parcel must be
  // findable on the walk around it, because `parcelProgress` demands all of
  // them and ENTREGA is locked until it is complete. Before discovery existed
  // this failed on 67% of médio parcels and 90% of difícil ones.
  for (const seed of ['sv-d1', 'sv-d2', 'sv-d3', 'sv-d4', 'sv-d5']) {
    for (const level of ['facil', 'medio', 'dificil']) {
      const w = buildWorld(seed, DIFFICULTY[level]);
      for (const parcel of w.parcels) {
        revealMarksNear(w, perimeter(parcel));
        const buried = parcel.markIds.filter((id) => w.entity(id)?.hidden);
        assert.equal(
          buried.length,
          0,
          `${seed}/${level}/${parcel.id}: ${buried.length} corner(s) unmeasurable, so the job cannot be delivered`,
        );
      }
    }
  }
});
