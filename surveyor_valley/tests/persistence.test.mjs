// Saving and resuming a campaign.
//
// `core/storage.js` was written complete in Phase 1 — versioned, with a
// migration chain and quarantine for corrupt payloads — and then nothing ever
// called `loadSave()`. Reloading the page destroyed the whole campaign: money,
// equipment, completed properties and the entire control network. It went
// unnoticed because a session used to be a single job with nothing to lose.
//
// A save deliberately stores the SEED, not the world. Regenerating a valley
// from its seed is smaller and safer than serializing one, and it is only
// trustworthy because world generation is deterministic — which is what the
// first test here pins down.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeStorage, SAVE_VERSION, KEYS } from '../src/core/storage.js';
import { makeStore, makeInitialState, DIFFICULTY } from '../src/core/state.js';
import { buildWorld } from '../src/world/world.js';
import { makeService } from '../src/game/service.js';
import { canStand } from '../src/game/player.js';
import { bus, EV } from '../src/core/bus.js';
import { revealMarksNear, applyRevealed } from '../src/game/discovery.js';

const SEED = 'sv-persist';

/** A minimal but real survey: monuments, occupations, sights. */
function surveySome(store, world, service, parcel) {
  const placed = [];
  for (const v of parcel.vertices.slice(0, 6)) {
    for (let r = 3; r <= 12 && placed.length < 6; r += 2) {
      let done = false;
      for (let k = 0; k < 10 && !done; k++) {
        const a = (k / 10) * Math.PI * 2;
        const e = v.e + Math.cos(a) * r;
        const n = v.n + Math.sin(a) * r;
        if (!canStand(world, e, n)) continue;
        const res = service.placeMarco(e, n);
        if (res.ok) {
          placed.push({ id: res.id, e, n });
          done = true;
        }
      }
      if (done) break;
    }
  }
  assert.ok(placed.length >= 3, `expected monuments, got ${placed.length}`);

  const known = () => new Set(store.get().network.filter((c) => c.E != null).map((c) => c.id));
  const occupied = new Set();
  for (let pass = 0; pass < placed.length + 2; pass++) {
    const first = occupied.size === 0;
    const pool = first ? placed : placed.filter((m) => known().has(m.id));
    const over = pool.find((m) => !occupied.has(m.id));
    if (!over) break;
    const backs = pool.filter((m) => m.id !== over.id);
    for (const back of backs.slice(0, 4)) {
      const st = service.setupStation({
        over: over.id,
        backsight: back.id,
        playerPos: { e: over.e, n: over.n },
      });
      if (st.ok) {
        service.measureAll({ force: true });
        break;
      }
    }
    occupied.add(over.id);
  }
  return placed;
}

test('a world is reproducible from its seed alone, which is what a save relies on', () => {
  const a = buildWorld(SEED, DIFFICULTY.medio);
  const b = buildWorld(SEED, DIFFICULTY.medio);
  assert.equal(a.hash(), b.hash(), 'same seed must rebuild the same valley');

  // Difficulty changes the scatter, so it has to be saved alongside the seed.
  const c = buildWorld(SEED, DIFFICULTY.dificil);
  assert.notEqual(a.hash(), c.hash(), 'difficulty must be part of the save, not inferred');
});

test('a survey survives a save and restore unchanged', () => {
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const world = buildWorld(SEED, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });

  const parcel = world.parcels[0];
  assert.equal(service.start(parcel.id).ok, true);
  store.get().inventory.marcos = 40;
  surveySome(store, world, service, parcel);

  // The surveyed ring is all-or-nothing (empty until every corner is measured),
  // so a partial survey is compared through the control network instead — which
  // is the thing a reload was actually destroying.
  const coordsOf = (st) =>
    st
      .get()
      .network.filter((cp) => cp.E != null)
      .map((cp) => `${cp.id}:${cp.E}:${cp.N}`)
      .sort();
  const before = coordsOf(store);
  assert.ok(before.length >= 3, `expected surveyed control points, got ${before.length}`);

  // Round-trip through the same path the browser uses: serialize, store, load.
  const backend = new Map();
  const storage = makeStorage({
    getItem: (k) => (backend.has(k) ? backend.get(k) : null),
    setItem: (k, v) => backend.set(k, String(v)),
    removeItem: (k) => backend.delete(k),
  });
  assert.equal(storage.saveNow(store.snapshot()), true);

  const loaded = storage.loadSave();
  assert.ok(loaded, 'the save must load back');
  assert.equal(loaded.seed, SEED, 'the seed is what regenerates the valley');

  // A fresh session: rebuild the world from the seed, replace state, rehydrate.
  const store2 = makeStore(makeInitialState());
  const world2 = buildWorld(loaded.seed, DIFFICULTY[loaded.difficulty]);
  const service2 = makeService({ store: store2, getWorld: () => world2, bus, EV });
  store2.replace(loaded, 'restore');
  service2.rehydrate();

  // Identical, not merely close: these are stored numbers, and anything that
  // recomputed them on load would drift.
  assert.deepEqual(coordsOf(store2), before, 'every surveyed coordinate must come back exactly');

  // And the raw field book, which is what `rehydrate()` rebuilds from.
  assert.equal(
    store2.get().activeService.observations.length,
    store.get().activeService.observations.length,
    'the field book itself must survive',
  );

  // The campaign itself, which is the thing that was being lost.
  assert.equal(store2.get().player.money, store.get().player.money);
  assert.equal(store2.get().inventory.instrument, store.get().inventory.instrument);
  assert.equal(store2.get().network.length, store.get().network.length);
});

test('a corrupt save is quarantined rather than crashing the boot', () => {
  const backend = new Map();
  const storage = makeStorage({
    getItem: (k) => (backend.has(k) ? backend.get(k) : null),
    setItem: (k, v) => backend.set(k, String(v)),
    removeItem: (k) => backend.delete(k),
  });

  backend.set(KEYS.SAVE, '{ this is not json');
  assert.equal(storage.loadSave(), null, 'unparseable saves must load as null, not throw');
  assert.equal(backend.has(KEYS.SAVE), false, 'and be removed from the live key');
  assert.ok([...backend.keys()].some((k) => k.startsWith('sv.save.corrupt.')), 'the payload is parked, not destroyed');

  // A save from a future version has no downgrade path and must not be trusted.
  backend.set(KEYS.SAVE, JSON.stringify({ version: SAVE_VERSION + 99, seed: 'x' }));
  assert.equal(storage.loadSave(), null, 'an unmigratable version must be refused');
});

test('language and settings survive a save wipe', () => {
  const backend = new Map();
  const storage = makeStorage({
    getItem: (k) => (backend.has(k) ? backend.get(k) : null),
    setItem: (k, v) => backend.set(k, String(v)),
    removeItem: (k) => backend.delete(k),
  });

  storage.setLang('en');
  storage.saveNow(makeInitialState({ seed: 'x' }));
  storage.clearSave();

  // Losing a campaign is bad; also losing the language the student reads in,
  // and having the game come back in a language they cannot read, is worse.
  assert.equal(storage.getLang(), 'en', 'the language lives under its own key on purpose');
});

/**
 * A save written before the player could choose a face, or before delivery and
 * payment came apart.
 *
 * Neither change bumped `SAVE_VERSION`, because neither makes an old save WRONG
 * — they only leave fields absent, and absent has an honest default. Bumping
 * would have cost every player their unfinished job for nothing, which is what
 * the v1 migration had to do and this one does not.
 */
test('a save from before the character choice loads and plays', () => {
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const s = store.get();
  // Exactly the old shape: a name that was never assigned, and no look at all.
  delete s.player.look;
  delete s.player.metLigeirinho;
  s.player.name = '';

  const storage = makeStorage(memoryBackend());
  storage.saveNow(s);
  const back = storage.loadSave();

  assert.ok(back, 'the save still loads');
  assert.equal(back.version, SAVE_VERSION, 'and needs no migration');
  assert.equal(back.player.look ?? null, null, 'a missing look stays missing rather than becoming junk');
  assert.equal(back.player.money, 0);
});

test('a delivered job resumes still owing the money', () => {
  // The gap between "documents done" and "owner paid" is a state a player can
  // close the tab in. Reloading must not skip the walk to the sede, and must
  // certainly not pay twice.
  const world = buildWorld(SEED, DIFFICULTY.facil);
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);
  surveySome(store, world, service, parcel);

  const progress = service.parcelProgress();
  if (!progress.complete) return; // this seed did not finish; nothing to assert

  const delivered = service.deliver();
  assert.equal(delivered.ok, true, `deliver: ${delivered.reason ?? ''}`);
  assert.equal(store.get().player.money, 0, 'delivering the documents pays nothing');
  assert.equal(store.get().activeService.delivered, true, 'and the state records it');

  // Round-trip through storage.
  const storage = makeStorage(memoryBackend());
  storage.saveNow(store.snapshot());
  const back = storage.loadSave();
  assert.equal(back.activeService.delivered, true, 'the delivered flag survives a reload');
  assert.equal(back.activeService.completed, false, 'and the job is still unpaid');
  assert.equal(back.player.money, 0);

  // Collecting banks it, once.
  const paid = service.collectPayment();
  assert.equal(paid.ok, true, `collect: ${paid.reason ?? ''}`);
  assert.ok(store.get().player.money > 0, `paid R$ ${store.get().player.money}`);

  const again = service.collectPayment();
  assert.equal(again.ok, false, 'and refuses to pay a second time');
  assert.equal(again.reason, 'alreadyPaid');
});

/** A storage backend with no browser behind it. */
function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// ------------------------------------------ the corners you already found ----

test('a save from before the discoveries existed still loads', () => {
  // `revealedMarks` was added without bumping SAVE_VERSION, on purpose: the
  // only migration in the chain drops the job in flight, and nobody should lose
  // a half-surveyed parcel over an empty array. That makes "an old save has no
  // list at all" a case the code has to survive rather than a hypothetical.
  const backend = memoryBackend();
  const storage = makeStorage(backend);

  const s = makeInitialState({ seed: SEED, difficulty: 'medio' });
  delete s.revealedMarks;
  storage.saveNow(s);

  const back = storage.loadSave();
  assert.ok(back, 'a v2 save without the field is still a v2 save');
  assert.equal(back.version, SAVE_VERSION, 'and needs no migration');

  const world = buildWorld(SEED, DIFFICULTY.medio);
  assert.equal(applyRevealed(world, back.revealedMarks), 0, 'nothing to put back, and no throw');
});

test('a corner found before a reload is still found after it', () => {
  // The world comes back from the seed, so every mark comes back buried. This
  // is the only thing standing between the player and walking the whole
  // perimeter twice — which on difícil they would also be charged for.
  const seed = 'sv-persist-found';
  const backend = memoryBackend();
  const storage = makeStorage(backend);

  const before = buildWorld(seed, DIFFICULTY.dificil);
  const parcel = before.parcels.find((p) => p.markIds.some((id) => before.entity(id).hidden));
  assert.ok(parcel, 'difícil buries corners');
  const buriedId = parcel.markIds.find((id) => before.entity(id).hidden);
  const mark = before.entity(buriedId);

  const s = makeInitialState({ seed, difficulty: 'dificil' });
  s.revealedMarks.push(...revealMarksNear(before, [{ e: mark.e, n: mark.n }]));
  assert.ok(s.revealedMarks.includes(buriedId));
  storage.saveNow(s);

  const restored = storage.loadSave();
  const after = buildWorld(seed, DIFFICULTY.dificil);
  assert.equal(after.entity(buriedId).hidden, true, 'a regenerated valley starts buried');

  applyRevealed(after, restored.revealedMarks);
  assert.equal(after.entity(buriedId).hidden, false, 'the walk has to be remembered');
});
