// World-generation tests. Same contract as math.test.mjs: plain Node, no deps.
//
// The parcel topology gets the most attention here, because confrontantes,
// network reuse and the memorial descritivo all quietly assume the six parcels
// tile the block exactly. A sliver would not crash anything — it would just
// make the legal description wrong, which is worse.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../src/core/rng.js';
import { makeNoise } from '../src/core/noise.js';
import { pointInPolygon, signedArea, isSelfIntersecting, convexHull } from '../src/core/math2d.js';
import { generateParcels, totalArea } from '../src/world/parcels.js';
import { buildWorld, closableRing, WORLD_SIZE } from '../src/world/world.js';
import { makeSpatialIndex } from '../src/world/spatial.js';
import { lineOfSight } from '../src/world/los.js';
import { makeTree, makeEntity, KIND } from '../src/world/entities.js';
import { DIFFICULTY } from '../src/core/state.js';

const SEEDS = ['sv-000001', 'sv-a1b2c3', 'sv-ffffff', 'sv-teste', 'sv-42'];

// ------------------------------------------------------------------ hull ---

test('convex hull returns a counter-clockwise convex ring', () => {
  const pts = [[0, 0], [10, 0], [10, 10], [0, 10], [5, 5], [3, 2]];
  const hull = convexHull(pts);
  assert.equal(hull.length, 4, 'interior points are dropped');
  assert.ok(signedArea(hull) > 0, 'counter-clockwise');
});

// --------------------------------------------------------------- parcels ---

test('six parcels are generated for every seed, none degenerate', () => {
  for (const seed of SEEDS) {
    const { parcels } = generateParcels(makeRng(seed, 'parcels'));
    assert.equal(parcels.length, 6, `${seed}: six parcels`);
    for (const p of parcels) {
      assert.ok(p.vertices.length >= 4, `${seed}/${p.id}: enough vertices`);
      assert.ok(!isSelfIntersecting(p.ring), `${seed}/${p.id}: ring does not cross itself`);
      assert.ok(p.area > 3000, `${seed}/${p.id}: not a sliver (${p.area} m²)`);
      assert.ok(signedArea(p.ring) > 0, `${seed}/${p.id}: counter-clockwise`);
    }
  }
});

test('parcels tile the block: every interior point belongs to exactly one', () => {
  // The real invariant. Immune to millimetre snapping, unlike an area sum, and
  // it is what "no slivers, no overlaps" actually means.
  for (const seed of SEEDS) {
    const { parcels, block } = generateParcels(makeRng(seed, 'parcels'));
    const rng = makeRng(seed, 'probe');
    let tested = 0;
    for (let i = 0; i < 3000 && tested < 800; i++) {
      const e = rng.range(0, WORLD_SIZE);
      const n = rng.range(0, WORLD_SIZE);
      if (!pointInPolygon(e, n, block)) continue;
      tested++;
      const owners = parcels.filter((p) => pointInPolygon(e, n, p.ring));
      assert.equal(owners.length, 1, `${seed}: point (${e.toFixed(2)}, ${n.toFixed(2)}) claimed by ${owners.length} parcels`);
    }
    assert.ok(tested > 300, `${seed}: enough interior samples (${tested})`);
  }
});

test('parcel areas sum to the block area', () => {
  for (const seed of SEEDS) {
    const { parcels, blockArea } = generateParcels(makeRng(seed, 'parcels'));
    const diff = Math.abs(totalArea(parcels) - blockArea);
    // The residual is millimetre snapping of boundary vertices, ~1e-6 relative.
    // A genuine topological gap would be orders of magnitude larger.
    assert.ok(diff < 1, `${seed}: area residual ${diff.toFixed(4)} m² on ${blockArea.toFixed(0)} m²`);
    assert.ok(diff / blockArea < 1e-5, `${seed}: relative residual ${(diff / blockArea).toExponential(2)}`);
  }
});

test('every shared boundary is one object, so neighbours agree exactly', () => {
  for (const seed of SEEDS) {
    const { parcels, edges } = generateParcels(makeRng(seed, 'parcels'));

    for (const edge of edges.values()) {
      if (edge.exterior) continue;
      assert.equal(edge.parcels.length, 2, `${seed}: interior edge ${edge.id} must join exactly two parcels`);
    }

    // Both neighbours must run through every vertex of the shared chain — that
    // is precisely what rules out a sliver between them. (A ring omits the last
    // vertex of each chain, because it is the first vertex of the next side, so
    // the per-side slices differ by one endpoint by construction; the union is
    // what has to match.)
    for (const edge of edges.values()) {
      if (edge.exterior) continue;
      const [i, j] = edge.parcels;
      const keysOf = (parcel) => new Set(parcel.vertices.map((v) => v.key));
      const ka = keysOf(parcels[i]);
      const kb = keysOf(parcels[j]);
      for (const v of edge.chain) {
        assert.ok(ka.has(v.key), `${seed}: ${parcels[i].id} misses vertex of shared edge ${edge.id}`);
        assert.ok(kb.has(v.key), `${seed}: ${parcels[j].id} misses vertex of shared edge ${edge.id}`);
      }

      // And the displaced interior vertices belong to those two parcels only.
      for (const v of edge.chain.slice(1, -1)) {
        const owners = parcels.filter((p) => p.vertices.some((w) => w.key === v.key));
        assert.equal(owners.length, 2, `${seed}: interior vertex of ${edge.id} shared by ${owners.length} parcels`);
      }
    }
  }
});

test('parcel sizes differ meaningfully and land in a plausible rural range', () => {
  for (const seed of SEEDS) {
    const { parcels } = generateParcels(makeRng(seed, 'parcels'));
    const ha = parcels.map((p) => p.hectares).sort((a, b) => a - b);
    // The floor came down from 0.4 ha when the block shrank to a third of its
    // area, so a job is a job rather than an afternoon. 0.25 ha is a 50 m
    // square: small for a rural holding, still a real one, and still far more
    // than the ~1 m of tripod room and ~5 m of sight length the survey needs.
    assert.ok(ha[0] > 0.25, `${seed}: smallest parcel ${ha[0].toFixed(2)} ha is workable`);
    assert.ok(ha[5] < 8, `${seed}: largest parcel ${ha[5].toFixed(2)} ha is not the whole valley`);
    assert.ok(ha[5] / ha[0] > 1.8, `${seed}: sizes should genuinely differ (ratio ${(ha[5] / ha[0]).toFixed(2)})`);
  }
});

test('a job is short enough to finish in a class', () => {
  // The corner count, not the area, is what makes a service long:
  // `estimateTimeLimit` charges 3.5 min a vertex against about 1.3 min per
  // 60 m walked. Shrinking the block without also cutting corners barely moves
  // this number, which is the trap this test exists to hold shut.
  for (const seed of SEEDS) {
    const { parcels } = generateParcels(makeRng(seed, 'parcels'));
    for (const p of parcels) {
      assert.ok(
        p.vertices.length >= 4 && p.vertices.length <= 10,
        `${seed}/${p.id}: ${p.vertices.length} corners is outside the 4-10 band`,
      );
      const minutes = (1.35 * (p.perimeter / 45 + p.vertices.length * 3.5 + 6)) / 1;
      assert.ok(minutes < 75, `${seed}/${p.id}: ~${minutes.toFixed(0)} min is too long for one sitting`);
    }
  }
});

test('every side of every parcel knows what lies beyond it', () => {
  for (const seed of SEEDS) {
    const { parcels } = generateParcels(makeRng(seed, 'parcels'));
    for (const p of parcels) {
      assert.equal(p.confrontantes.length, p.vertices.length, `${p.id}: one confrontante per side`);
      for (let i = 0; i < p.vertices.length; i++) {
        const label = p.confrontanteFor(i, 'pt');
        assert.ok(label && label.length > 3, `${seed}/${p.id} side ${i}: has a confrontante label`);
        const c = p.confrontantes[i];
        if (c.kind === 'parcel') assert.notEqual(c.parcelId, p.id, 'a parcel never borders itself');
      }
      // English must work too, since the memorial is bilingual.
      assert.ok(p.confrontanteFor(0, 'en').length > 3, 'English confrontante');
    }
  }
});

// ---------------------------------------------------------- determinism ----

test('the same seed rebuilds an identical world', () => {
  for (const seed of ['sv-determ', 'sv-000009']) {
    const a = buildWorld(seed, DIFFICULTY.medio);
    const b = buildWorld(seed, DIFFICULTY.medio);
    assert.equal(a.hash(), b.hash(), `${seed}: identical hash`);
    assert.equal(a.entities.length, b.entities.length, 'same entity count');
    assert.deepEqual(
      a.parcels.map((p) => [p.owner, p.propertyName, Math.round(p.area)]),
      b.parcels.map((p) => [p.owner, p.propertyName, Math.round(p.area)]),
      'same cast and same areas',
    );
  }
});

test('different seeds build different worlds', () => {
  const a = buildWorld('sv-aaa', DIFFICULTY.medio);
  const b = buildWorld('sv-bbb', DIFFICULTY.medio);
  assert.notEqual(a.hash(), b.hash());
});

test('soil classification is deterministic and always a known class', () => {
  const w = buildWorld('sv-soil', DIFFICULTY.facil);
  const rng = makeRng('soil-probe', 'x');
  for (let i = 0; i < 2000; i++) {
    const e = rng.range(0, WORLD_SIZE);
    const n = rng.range(0, WORLD_SIZE);
    const s1 = w.terrain.soilAt(e, n);
    const s2 = w.terrain.soilAt(e, n);
    assert.equal(s1.id, s2.id, 'memoised lookup agrees with itself');
    assert.equal(typeof s1.walkable, 'boolean');
    assert.equal(typeof s1.tripodOk, 'boolean');
  }
});

test('noise is continuous: neighbouring samples do not jump', () => {
  const noise = makeNoise('sv-noise', 'moisture');
  const rng = makeRng('noise-probe', 'x');
  for (let i = 0; i < 500; i++) {
    const e = rng.range(0, 600);
    const n = rng.range(0, 600);
    const a = noise.fbm(e, n, { scale: 140 });
    const b = noise.fbm(e + 0.1, n, { scale: 140 });
    assert.ok(Math.abs(a - b) < 0.05, `continuity: ${a} vs ${b}`);
    assert.ok(a >= -1.01 && a <= 1.01, `in range: ${a}`);
  }
});

// -------------------------------------------------------------- difficulty --

test('harder difficulties really do put more in the way', () => {
  const easy = buildWorld('sv-diff', DIFFICULTY.facil);
  const hard = buildWorld('sv-diff', DIFFICULTY.dificil);
  assert.ok(
    hard.entities.length > easy.entities.length * 1.5,
    `hard (${hard.entities.length}) should carry far more than easy (${easy.entities.length})`,
  );
  const hidden = (w) => w.entities.filter((e) => e.hidden).length;
  assert.equal(hidden(easy), 0, 'nothing is hidden on fácil');
  assert.ok(hidden(hard) > 0, 'some corners are overgrown on difícil');
});

// ------------------------------------------------------------------- LOS ---

test('line of sight is clear across open ground and blocked by a tree', () => {
  const spatial = makeSpatialIndex(16);
  const from = { e: 0, n: 0 };
  const to = { e: 100, n: 0 };

  assert.equal(lineOfSight(spatial, from, to).clear, true, 'nothing in the way');

  const tree = makeTree(50, 0, { id: 'tree-mid', losR: 2 });
  spatial.insert(tree);
  const blocked = lineOfSight(spatial, from, to);
  assert.equal(blocked.clear, false, 'the tree blocks it');
  assert.equal(blocked.blockers[0].id, 'tree-mid');
  assert.ok(Math.abs(blocked.blockers[0].at[0] - 50) < 2.1, 'blocked near the tree');
});

test('a tree beside the instrument or the target does not block the sight', () => {
  const spatial = makeSpatialIndex(16);
  // Standing right next to a tree must not make every sight impossible.
  spatial.insert(makeTree(0.05, 0, { id: 'at-station', losR: 2 }));
  spatial.insert(makeTree(99.98, 0, { id: 'at-target', losR: 2 }));
  const r = lineOfSight(spatial, { e: 0, n: 0 }, { e: 100, n: 0 });
  assert.equal(r.clear, true, 'endpoint obstacles are skipped');
});

test('line of sight ignores explicitly listed entities and the target itself', () => {
  const spatial = makeSpatialIndex(16);
  spatial.insert(makeTree(50, 0, { id: 'tree-mid', losR: 2 }));
  assert.equal(lineOfSight(spatial, { e: 0, n: 0 }, { e: 100, n: 0 }, { ignoreIds: ['tree-mid'] }).clear, true);
  assert.equal(lineOfSight(spatial, { e: 0, n: 0 }, { e: 100, n: 0 }, { targetId: 'tree-mid' }).clear, true);
});

test('a building wall blocks a sight that passes through it', () => {
  const spatial = makeSpatialIndex(16);
  const shed = makeEntity(KIND.BENFEITORIA, 50, 0, {
    id: 'shed',
    r: 5,
    losR: 5,
    seg: [[46, -4], [54, -4], [54, 4], [46, 4]],
  });
  spatial.insert(shed);
  assert.equal(lineOfSight(spatial, { e: 0, n: 0 }, { e: 100, n: 0 }).clear, false, 'through the shed');
  assert.equal(lineOfSight(spatial, { e: 0, n: 40 }, { e: 100, n: 40 }).clear, true, 'well clear of it');
});

test('blockers come back ordered from the instrument outward', () => {
  const spatial = makeSpatialIndex(16);
  spatial.insert(makeTree(30, 0, { id: 'near', losR: 2 }));
  spatial.insert(makeTree(70, 0, { id: 'far', losR: 2 }));
  const r = lineOfSight(spatial, { e: 0, n: 0 }, { e: 100, n: 0 });
  assert.deepEqual(r.blockers.map((b) => b.id), ['near', 'far']);
});

// --------------------------------------------------------------- tripod ----

test('the tripod rule rejects water and accepts open pasture', () => {
  const w = buildWorld('sv-tripod', DIFFICULTY.facil);

  let water = null;
  let pasture = null;
  const rng = makeRng('tripod-probe', 'x');
  for (let i = 0; i < 20000 && (!water || !pasture); i++) {
    const e = rng.range(20, WORLD_SIZE - 20);
    const n = rng.range(20, WORLD_SIZE - 20);
    const soil = w.terrain.soilAt(e, n);
    if (!water && soil.id === 'AGUA') water = { e, n };
    if (!pasture && soil.id === 'PASTO' && w.canSetupTripod(e, n).ok) pasture = { e, n };
  }

  assert.ok(pasture, 'somewhere in the valley a tripod can stand');
  assert.equal(w.canSetupTripod(pasture.e, pasture.n).ok, true);

  if (water) {
    const r = w.canSetupTripod(water.e, water.n);
    assert.equal(r.ok, false, 'not in the stream');
    assert.equal(r.reason, 'badSoil');
  }
});

test('the tripod rule refuses a spot with a tree inside the one-metre disc', () => {
  const w = buildWorld('sv-tripod2', DIFFICULTY.facil);
  const spot = w.spawnPointFor(w.parcels[0]);
  assert.equal(w.canSetupTripod(spot.e, spot.n).ok, true, 'the spawn point is usable');

  w.entities.push(makeTree(spot.e + 0.5, spot.n, { id: 'blocker', r: 0.4 }));
  w.spatial.insert(w.byId.set('blocker', w.entities[w.entities.length - 1]).get('blocker'));

  const r = w.canSetupTripod(spot.e, spot.n);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'obstacle');
});

test('the tripod rule samples a ring, not just the centre', () => {
  const w = buildWorld('sv-tripod3', DIFFICULTY.facil);
  const spot = w.spawnPointFor(w.parcels[1]);
  const r = w.canSetupTripod(spot.e, spot.n);
  assert.equal(r.ring.length, 17, 'centre plus two rings of eight');
  assert.ok(r.ring.every((s) => typeof s.ok === 'boolean'), 'each sample is judged');
});

test('the tripod rule refuses to stand outside the world', () => {
  const w = buildWorld('sv-tripod4', DIFFICULTY.facil);
  assert.equal(w.canSetupTripod(-50, 300).reason, 'outOfBounds');
  assert.equal(w.canSetupTripod(300, WORLD_SIZE + 50).reason, 'outOfBounds');
});

// ------------------------------------------------------------- the world ---

test('a built world is playable: spawn points work and parcels are findable', () => {
  const w = buildWorld('sv-play', DIFFICULTY.medio);
  assert.equal(w.parcels.length, 6);
  for (const p of w.parcels) {
    const spot = w.spawnPointFor(p);
    assert.ok(pointInPolygon(spot.e, spot.n, p.ring), `${p.id}: spawn is inside the parcel`);
    assert.ok(w.isPassable(spot.e, spot.n), `${p.id}: spawn is walkable`);
    assert.equal(w.parcelAt(spot.e, spot.n)?.id, p.id, `${p.id}: parcelAt agrees`);
  }
});

test('every parcel corner carries physical evidence to sight on', () => {
  const w = buildWorld('sv-marks', DIFFICULTY.facil);
  for (const p of w.parcels) {
    assert.equal(p.markIds.length, p.vertices.length, `${p.id}: a mark per corner`);
    for (let i = 0; i < p.vertices.length; i++) {
      const mark = w.entity(p.markIds[i]);
      assert.ok(mark, `${p.id}: mark ${p.markIds[i]} exists`);
      assert.equal(mark.targetable, true, 'and can be sighted');
      assert.ok(
        Math.hypot(mark.e - p.vertices[i].e, mark.n - p.vertices[i].n) < 1e-6,
        'and sits exactly on the corner',
      );
    }
  }
});

test('a marco planted by the player joins the world and the spatial index', () => {
  const w = buildWorld('sv-marco', DIFFICULTY.facil);
  const spot = w.spawnPointFor(w.parcels[0]);
  const before = w.entities.length;
  const m = w.addMarco(spot.e, spot.n, 'M1');
  assert.equal(w.entities.length, before + 1);
  assert.equal(w.entity('marco-M1').id, m.id);
  assert.ok(w.spatial.queryCircle(spot.e, spot.n, 2).some((x) => x.id === m.id), 'indexed for hit-testing');
  assert.equal(m.targetable, true);
});

// ------------------------------------------------------------- spatial -----

test('the spatial index finds what a ray crosses and skips what it does not', () => {
  const spatial = makeSpatialIndex(16);
  const onPath = makeTree(120, 0, { id: 'on-path' });
  const wayOff = makeTree(120, 300, { id: 'way-off' });
  spatial.insert(onPath);
  spatial.insert(wayOff);

  const hits = spatial.queryRay(0, 0, 240, 0, 6).map((e) => e.id);
  assert.ok(hits.includes('on-path'), 'the ray finds what it crosses');
  assert.ok(!hits.includes('way-off'), 'and does not drag in the whole valley');
});

test('circle queries return each entity once, however many cells it spans', () => {
  const spatial = makeSpatialIndex(16);
  spatial.insert(makeTree(100, 100, { id: 'big', r: 30, losR: 30 }));
  const hits = spatial.queryCircle(100, 100, 40).filter((e) => e.id === 'big');
  assert.equal(hits.length, 1, 'no duplicates');
});

/**
 * Every parcel must admit at least one closable traverse.
 *
 * This is the assertion whose absence let a real problem ship. On difícil,
 * obstacle density plus overgrown corners could leave a parcel where no ring of
 * stations is mutually visible — so the closure error could not be computed at
 * all, through no fault of the player and with nothing on screen explaining
 * why. `scatterWorld` now clears the fewest blockers that open one route, and
 * this is what holds it to that.
 *
 * The ring is checked in BEARING ORDER around the centroid, which is what makes
 * it a simple polygon; a crossing loop can satisfy every visibility test and
 * still close at something absurd, because only a simple polygon's angles obey
 * (n∓2)·180°.
 */
test('every parcel, on every difficulty, admits a closable ring of stations', () => {
  const seeds = ['sv-ring-1', 'sv-ring-2', 'sv-ring-3', 'sv-ring-4', 'sv-ring-5'];
  const failures = [];

  for (const seed of seeds) {
    for (const [name, difficulty] of Object.entries(DIFFICULTY)) {
      const world = buildWorld(seed, difficulty);
      for (const parcel of world.parcels) {
        // Asked of the game's own definition, not a copy of it: a copy would
        // drift, and a drifted copy of a guarantee is worse than no test.
        const { ring, blocked, hardBlocked } = closableRing(world, parcel);
        if (ring.length < 3) {
          failures.push(`${seed}/${name}/${parcel.id}: only ${ring.length} usable station sites`);
        } else if (hardBlocked.length) {
          failures.push(`${seed}/${name}/${parcel.id}: permanently obstructed (${hardBlocked.join(', ')})`);
        } else if (blocked.length) {
          // Anything left here is vegetation the clearing pass should have
          // removed, so it means the fixed-point loop did not converge.
          failures.push(`${seed}/${name}/${parcel.id}: ${blocked.length} clearable obstruction(s) survived`);
        }
      }
    }
  }

  assert.deepEqual(failures, [], `parcels with no closable traverse:\n  ${failures.join('\n  ')}`);
});
