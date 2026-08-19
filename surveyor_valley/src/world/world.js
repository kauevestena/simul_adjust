// Assembling a world from a seed.
//
// Everything below is a pure function of (seed, difficulty). Two calls with the
// same arguments produce byte-identical geometry, which is what makes the
// headless smoke test meaningful and lets a student compare results with a
// classmate by trading a six-character seed.

import { makeRng } from '../core/rng.js';
import { makeTerrain } from './terrain.js';
import { generateParcels, totalArea } from './parcels.js';
import { scatterWorld } from './scatter.js';
import { makeSpatialIndex } from './spatial.js';
import { resetIds, makePlayerMarco, makeResident } from './entities.js';
import { canSetupTripod, lineOfSight } from './los.js';
import { pointInPolygon } from '../core/math2d.js';

/**
 * The valley, in metres.
 *
 * Held in proportion to the gleba inside it (`parcels.js#BLOCK_SIZE`): the
 * block occupies about three quarters of the width, and the rest is the collar
 * of unowned land the player walks in from. Leaving this at 640 when the block
 * came down to 280 would have made the valley four fifths empty scenery, and
 * every metre of it still gets terrain-classified and ground-baked.
 */
export const WORLD_SIZE = 220;

/**
 * How far the shoreline retreats from a boundary corner, in metres.
 *
 * Wide enough for the crew to stand ON the corner rather than beside it:
 * Ligeirinho counts as arrived within 0.9 m (`assistant.js#ARRIVE_RADIUS`) and
 * needs 0.3 m of body around him, so anything under about 1.5 m would leave a
 * corner he can see, reach for and never actually occupy.
 */
export const CORNER_DRY_MARGIN = 2.5;

/**
 * @param {string} seed
 * @param {{obstacleDensity:number, cornerHiding:number}} difficulty
 */
export function buildWorld(seed, difficulty) {
  resetIds(0);

  const bounds = {
    minE: 0,
    minN: 0,
    maxE: WORLD_SIZE,
    maxN: WORLD_SIZE,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
  };

  const terrain = makeTerrain(seed, bounds);
  const { parcels, vertices, edges, block, blockArea, cast } = generateParcels(makeRng(seed, 'parcels'), {
    cx: WORLD_SIZE / 2,
    cy: WORLD_SIZE / 2,
  });

  // Before anything samples the soil: no boundary corner stands in open water.
  // See `terrain.js#dryMargins` for why the water gives way rather than the
  // corner moving — the partition is exact, and an exact partition is what
  // makes the confrontantes and the shared marcos true.
  for (const v of vertices.values()) terrain.addDryMargin(v.e, v.n, CORNER_DRY_MARGIN);

  const entities = scatterWorld(makeRng(seed, 'scatter'), terrain, bounds, parcels, difficulty);

  const spatial = makeSpatialIndex(16);
  spatial.insertAll(entities);

  const byId = new Map(entities.map((e) => [e.id, e]));

  const world = {
    seed,
    difficulty,
    bounds,
    terrain,
    parcels,
    parcelById: new Map(parcels.map((p) => [p.id, p])),
    vertices,
    edges,
    block,
    blockArea,
    cast,
    entities,
    byId,
    spatial,

    /** Add a monument the player just planted. */
    addMarco(e, n, label) {
      const ent = makePlayerMarco(e, n, { id: `marco-${label}`, label });
      entities.push(ent);
      byId.set(ent.id, ent);
      spatial.insert(ent);
      return ent;
    },

    entity: (id) => byId.get(id) || null,

    /** The owner of a parcel, standing on their doorstep. Null if no homestead. */
    residentFor: (parcelId) => byId.get(`morador-${parcelId}`) || null,

    /** Which parcel contains this point, if any. */
    parcelAt(e, n) {
      for (const p of parcels) if (pointInPolygon(e, n, p.ring)) return p;
      return null;
    },

    canSetupTripod: (e, n, opts) => canSetupTripod(world, e, n, opts),

    lineOfSight: (from, to, opts) => lineOfSight(spatial, from, to, opts),

    /**
     * The homestead of a parcel — its "sede" — and the doorstep you meet the
     * owner on.
     *
     * The building has always been there, as scenery. It became load-bearing
     * when the owner started paying you at it, and a single definition of
     * "close enough to the sede" is what stops the waypoint, the toast and the
     * gate that opens the payment from drifting apart. `door` is a spot on
     * walkable ground beside the house; the payment radius is measured to it.
     *
     * Cached on the parcel: the search is a couple of hundred `isPassable`
     * probes and the answer never changes.
     */
    sedeFor(parcelId) {
      const parcel = world.parcelById.get(parcelId);
      if (!parcel) return null;
      if (parcel.sede !== undefined) return parcel.sede;

      const house = byId.get(`casa-${parcelId}`);
      if (!house) {
        parcel.sede = null;
        return null;
      }

      // Walk outward from the house until the ground is standable. Starting
      // just past its own footprint, because inside it is never valid.
      const r0 = (house.r || 4) + 0.8;
      let door = null;
      for (let r = r0; r <= r0 + 14 && !door; r += 0.5) {
        const steps = Math.max(16, Math.round(r * 4));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const e = house.e + Math.cos(a) * r;
          const n = house.n + Math.sin(a) * r;
          if (world.isPassable(e, n)) {
            door = { e, n };
            break;
          }
        }
      }

      parcel.sede = { entity: house, door: door || { e: house.e, n: house.n }, owner: parcel.owner };
      return parcel.sede;
    },

    /** Can the player stand here? Water and solid obstacles say no. */
    isPassable(e, n, radius = 0.35) {
      if (e < bounds.minE || e > bounds.maxE || n < bounds.minN || n > bounds.maxN) return false;
      if (!terrain.soilAt(e, n).walkable) return false;
      for (const ent of spatial.queryCircle(e, n, radius + 5)) {
        if (!ent.blocksWalk) continue;
        if (ent.seg && ent.seg.length > 1) continue; // handled by the slide solver
        if (Math.hypot(ent.e - e, ent.n - n) < radius + ent.r) return false;
      }
      return true;
    },

    /**
     * Where to drop the player at the start: inside the parcel, on ground a
     * tripod could stand on, and clear of the homestead — arriving with your
     * nose against a wall is a poor first impression, and the exclusion also
     * keeps the first tripod out of the farmyard.
     */
    spawnPointFor(parcel) {
      const c = parcel.centroid;
      const rng = makeRng(seed, `spawn:${parcel.id}`);
      const homestead = byId.get(`casa-${parcel.id}`);

      // Both against the parcel, not in fixed metres: a 34 m exclusion disc on
      // a holding only ~110 m across rules out most of it, and the search then
      // drops through to the bare-centroid fallback — which lands the player
      // wherever the centroid happens to be, homestead included.
      const span = Math.min(parcel.bbox.w, parcel.bbox.h);
      const reach = span * 0.31;
      const clearHouse = span * 0.19;

      for (let i = 0; i < 600; i++) {
        const e = c.e + rng.range(-reach, reach);
        const n = c.n + rng.range(-reach, reach);
        if (!pointInPolygon(e, n, parcel.ring)) continue;
        if (homestead && Math.hypot(homestead.e - e, homestead.n - n) < clearHouse) continue;
        if (!world.isPassable(e, n)) continue;
        if (!world.canSetupTripod(e, n).ok) continue;
        return { e, n };
      }
      // Fall back with the homestead clearance relaxed rather than fail.
      for (let i = 0; i < 400; i++) {
        const e = c.e + rng.range(-reach, reach);
        const n = c.n + rng.range(-reach, reach);
        if (!pointInPolygon(e, n, parcel.ring)) continue;
        if (!world.isPassable(e, n)) continue;
        if (!world.canSetupTripod(e, n).ok) continue;
        return { e, n };
      }
      // Last resort. The centroid is not checked for anything, so spiral out
      // from it until the ground is at least walkable — dropping the player
      // into the middle of a lake is a worse first impression than standing
      // them a few metres off centre.
      for (let r = 0; r <= 30; r += 1.5) {
        const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 2));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const e = c.e + Math.cos(a) * r;
          const n = c.n + Math.sin(a) * r;
          if (world.isPassable(e, n)) return { e, n };
        }
      }
      return { e: c.e, n: c.n };
    },

    /**
     * A stable fingerprint of the generated geometry. Two builds from one seed
     * must agree; the smoke test asserts it.
     */
    hash() {
      let h = 2166136261 >>> 0;
      const mix = (v) => {
        h ^= Math.round(v * 1000) & 0xffffffff;
        h = Math.imul(h, 16777619) >>> 0;
      };
      for (const p of parcels) {
        mix(p.area);
        for (const v of p.vertices) {
          mix(v.e);
          mix(v.n);
        }
      }
      mix(entities.length);
      for (const ent of entities) {
        mix(ent.e);
        mix(ent.n);
      }
      return h.toString(16).padStart(8, '0');
    },

    stats: () => ({
      parcels: parcels.length,
      entities: entities.length,
      totalParcelArea: totalArea(parcels),
      blockArea,
    }),
  };

  ensureClosableRing(world);
  placeResidents(world);
  return world;
}

/**
 * Put every owner on their own doorstep.
 *
 * They were a name in a memorial descritivo and a line in a toast, and the job
 * ends with "walk to the sede and get paid" — at a building with nobody in it.
 * So they are people now, standing where the money is handed over, one per
 * parcel rather than only on the job you happen to be doing: the owners either
 * side of a boundary are exactly the confrontantes the memorial names, and
 * meeting them is a cheaper way to learn who they are than reading a document.
 *
 * AFTER `ensureClosableRing`, because that pass deletes obstacles and `sedeFor`
 * picks the doorstep by walking outward until the ground is standable — sited
 * before it, an owner could end up standing where a tree used to be.
 */
function placeResidents(world) {
  world.parcels.forEach((parcel, i) => {
    const sede = world.sedeFor(parcel.id);
    if (!sede) return;
    const ent = makeResident(sede.door.e, sede.door.n, {
      id: `morador-${parcel.id}`,
      label: parcel.owner,
      parcelId: parcel.id,
      look: `owner-${parcel.ownerBody === 'f' ? 'f' : 'm'}${i}`,
    });
    world.entities.push(ent);
    world.byId.set(ent.id, ent);
    world.spatial.insert(ent);
  });
}

/** How many stations the guaranteed ring is built from. */
const RING_STATIONS = 5;
/** Alternative sites per station, so the ring can route around the farmhouse. */
const CANDIDATES_PER_SLOT = 6;

/**
 * Guarantee that every parcel admits at least one closable traverse.
 *
 * `scatter.js#clearSightlinesToCorners` already promises no *corner* can be
 * sealed in. This is the same promise one level up, and it is the one that was
 * missing: on difícil, obstacle density plus overgrown corners could leave a
 * parcel where no ring of stations is mutually visible — so the closure error
 * could not be computed at all, through no fault of the player, with nothing on
 * screen explaining why.
 *
 * It runs HERE rather than inside `scatterWorld` for one reason that matters:
 * only after the spatial index exists can it use `canSetupTripod` and
 * `lineOfSight` — the very predicates the player is judged by. Approximating
 * them during scatter guarantees a ring the game itself does not agree exists.
 *
 * The ring is sited the way a surveyor sites one, and walked in BEARING ORDER
 * around the centroid: that makes the polygon simple by construction, and only
 * a simple polygon's angles obey (n∓2)·180°.
 *
 * It clears the fewest blockers that open this one route. Difícil is meant to
 * make you hunt for a line; it is not meant to be impossible.
 */
function ensureClosableRing(world) {
  // Iterated to a fixed point, because removing a tree can OPEN a station site
  // that was previously too crowded to stand on — so the next pass sites a
  // different ring, which may have its own obstructed leg. One pass leaves the
  // guarantee true only for the ring it happened to pick first.
  for (let pass = 0; pass < 6; pass++) {
    const doomed = new Set();

    for (const parcel of world.parcels) {
      const { ring, blocked } = closableRing(world, parcel);
      if (ring.length < 3) continue; // nowhere to stand at all; nothing to unblock
      for (const id of blocked) {
        const ent = world.entity(id);
        // Buildings and fences stay: they are boundary features and part of the
        // property, not scatter to be quietly deleted.
        if (!ent || ent.seg || ent.kind === 'benfeitoria') continue;
        doomed.add(ent.id);
      }
    }

    if (!doomed.size) return;

    // Mutate in place: `entities` is captured by closures on the world object.
    for (let i = world.entities.length - 1; i >= 0; i--) {
      if (!doomed.has(world.entities[i].id)) continue;
      world.byId.delete(world.entities[i].id);
      world.entities.splice(i, 1);
    }
    world.spatial.clear();
    world.spatial.insertAll(world.entities);
  }
}

/**
 * The guaranteed ring for one parcel, and what is standing in its way.
 *
 * Exported so `tests/world.test.mjs` asserts the property using this same
 * definition rather than a copy of it — a copy would drift, and a drifted copy
 * of a guarantee is worse than no test at all.
 *
 * @returns {{ring:Array<{e,n}>, blocked:string[]}}
 */
export function closableRing(world, parcel) {
  const slots = siteRing(world, parcel);
  if (slots.length < 3) return { ring: slots.map((s) => s[0]).filter(Boolean), blocked: [], hardBlocked: [] };

  /**
   * Scatter can be cleared away; a building or a fence post cannot. So a leg
   * obstructed only by vegetation is acceptable — `ensureClosableRing` will
   * remove it — while one obstructed by something permanent means this pair of
   * sites is simply wrong and the ring must be routed elsewhere.
   */
  const removable = (id) => {
    const ent = world.entity(id);
    return ent && !ent.seg && ent.kind !== 'benfeitoria' && ent.kind !== 'poste';
  };

  const legCost = (a, b) => {
    const los = world.lineOfSight({ e: a.e, n: a.n }, { e: b.e, n: b.n });
    if (los.clear) return { hard: false, ids: [] };
    const ids = los.blockers.map((x) => x.id);
    return { hard: ids.some((id) => !removable(id)), ids: ids.filter(removable) };
  };

  /**
   * Greedy walk from a given starting candidate: for each slot take the site
   * whose leg back to the previous station is not permanently obstructed,
   * preferring one that is completely clear.
   */
  const build = (startIdx) => {
    const ring = [];
    /** Which slot each ring member came from, and what its legs cost. */
    const fromSlot = [];
    const blockedAt = [];
    const hardBlocked = [];

    for (let i = 0; i < slots.length; i++) {
      const prev = ring[ring.length - 1];
      const candidates = i === 0 ? [slots[0][startIdx], ...slots[0]].filter(Boolean) : slots[i];
      let chosen = null;
      let fallback = null;
      let fallbackIds = [];

      // The last station carries two constraints, not one: it has to see the
      // station before it AND the one the ring closes back onto. Judging it by
      // the incoming leg alone is what left rings that walk beautifully for
      // four legs and then cannot close — the one failure mode the greedy walk
      // could not see, because by then the first station is long since fixed.
      const isLast = i === slots.length - 1 && ring.length >= 2;

      for (const cand of candidates) {
        if (!prev) {
          chosen = cand;
          break;
        }
        const { hard, ids } = legCost(prev, cand);
        if (hard) continue;

        let closeIds = [];
        if (isLast) {
          const close = legCost(cand, ring[0]);
          if (close.hard) continue;
          closeIds = close.ids;
        }

        if (!ids.length && !closeIds.length) {
          chosen = cand;
          break;
        }
        if (!fallback) {
          fallback = cand;
          fallbackIds = [...ids, ...closeIds];
        }
      }

      let ids = [];
      if (!chosen && fallback) {
        chosen = fallback;
        ids = fallbackIds;
      }
      // Every candidate for this slot is permanently obstructed from the last
      // station: skip the slot rather than force an impossible leg. A traverse
      // of four good stations beats five with one that cannot be measured.
      if (!chosen) continue;
      ring.push(chosen);
      fromSlot.push(i);
      blockedAt.push(ids);
    }

    if (ring.length >= 3) {
      let close = legCost(ring[ring.length - 1], ring[0]);

      // The closing leg, repaired rather than merely reported.
      //
      // `isLast` above only fires on the FINAL SLOT, and a slot with no usable
      // candidate is skipped — so when the last slot dropped out, the station
      // that actually ends up last was chosen without the closing leg ever
      // being considered. Measured: one parcel in ninety, and it read as "no
      // closable traverse exists" when one plainly did, two metres to the left.
      //
      // Two repairs, cheapest first: take a different candidate from that same
      // slot, or failing that drop the station altogether. A four-station ring
      // that closes is worth more than a five-station ring that cannot.
      if (close.hard) {
        const slot = fromSlot[ring.length - 1];
        const prev = ring[ring.length - 2];
        let swap = null;
        let swapIds = [];
        for (const cand of slots[slot]) {
          const inLeg = legCost(prev, cand);
          if (inLeg.hard) continue;
          const outLeg = legCost(cand, ring[0]);
          if (outLeg.hard) continue;
          swap = cand;
          swapIds = [...inLeg.ids, ...outLeg.ids];
          if (!swapIds.length) break;
        }

        if (swap) {
          ring[ring.length - 1] = swap;
          blockedAt[blockedAt.length - 1] = swapIds;
          close = { hard: false, ids: [] };
        } else if (ring.length > 3) {
          ring.pop();
          fromSlot.pop();
          blockedAt.pop();
          close = legCost(ring[ring.length - 1], ring[0]);
        }
      }

      if (close.hard) hardBlocked.push('closing-leg');
      else blockedAt.push(close.ids);
    }
    return { ring, blocked: blockedAt.flat(), hardBlocked };
  };

  // The closing leg is the one the greedy walk cannot plan for: it is fixed the
  // moment the first station is chosen. So try each candidate for that first
  // station and keep a ring that actually closes.
  let best = null;
  for (let startIdx = 0; startIdx < slots[0].length; startIdx++) {
    const attempt = build(startIdx);
    if (attempt.ring.length >= 3 && !attempt.hardBlocked.length) return attempt;
    if (!best || attempt.ring.length > best.ring.length) best = attempt;
  }
  return best;
}

/**
 * Candidate station sites for one parcel: spread around the centroid, on ground
 * a tripod can actually stand on, inside the boundary, ordered by bearing.
 */
function siteRing(world, parcel) {
  const rx = parcel.bbox.w * 0.5;
  const ry = parcel.bbox.h * 0.5;
  const minSep = Math.max(2.5, Math.min(rx, ry) * 0.07);
  const slots = [];

  for (let k = 0; k < RING_STATIONS; k++) {
    const base = (k / RING_STATIONS) * Math.PI * 2;
    const found = [];

    // Several candidates per slot, not one. A single site per bearing leaves no
    // way to route around the farmhouse — the one thing the clearing pass is
    // not allowed to delete.
    for (let f = 0.72; f >= 0.24 && found.length < CANDIDATES_PER_SLOT; f -= 0.06) {
      for (let da = -0.5; da <= 0.5 && found.length < CANDIDATES_PER_SLOT; da += 0.125) {
        const a = base + da;
        const e = parcel.centroid.e + Math.cos(a) * rx * f;
        const n = parcel.centroid.n + Math.sin(a) * ry * f;
        if (!pointInPolygon(e, n, parcel.ring)) continue;
        if (!world.canSetupTripod(e, n).ok) continue;
        // Spread them out, or the "alternatives" are all the same spot. As a
        // fraction of the parcel, not a fixed 6 m: on a small holding a fixed
        // spacing prunes away the very alternatives this loop exists to find,
        // and the ring then fails for want of anywhere to stand.
        if (found.some((p) => Math.hypot(p.e - e, p.n - n) < minSep)) continue;
        found.push({ e, n });
      }
    }
    if (found.length) slots.push(found);
  }

  // Bearing order by each slot's first candidate, so the ring is a simple
  // polygon by construction — and only a simple polygon's angles obey
  // (n∓2)·180°.
  return slots.sort(
    (p, q) =>
      Math.atan2(p[0].e - parcel.centroid.e, p[0].n - parcel.centroid.n) -
      Math.atan2(q[0].e - parcel.centroid.e, q[0].n - parcel.centroid.n),
  );
}
