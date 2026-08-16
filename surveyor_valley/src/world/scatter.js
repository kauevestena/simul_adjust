// Populating the valley.
//
// Jittered-grid placement rather than true Poisson-disc: it gives the same
// "natural but not clumped" look for a fraction of the work, and it is trivially
// deterministic, which matters because the same seed must always grow the same
// trees in the same places.
//
// The `cornerHiding` knob is the didactic lever. Biasing vegetation toward
// parcel corners is what breaks the direct corner-to-corner sight and forces a
// traverse or a free station — the whole reason the harder difficulties are
// harder in an interesting way rather than just a fiddlier way.

import { makeTree, makeBush, makeRock, makeBoundaryMark, makeFence, makeBuilding } from './entities.js';
import { pointInPolygon } from '../core/math2d.js';

/** Base plants per hectare, before the difficulty multiplier. */
const DENSITY = {
  arvore: 11,
  arbusto: 16,
  rocha: 4,
};

/** Which soils each thing likes. */
const PREFERS = {
  arvore: { PASTO: 0.7, CAMPO_SUJO: 1.4, LAVOURA: 0.15, SOLO_EXPOSTO: 0.3, AREIA: 0.2, ROCHA: 0.35, BREJO: 0.9, AGUA: 0 },
  arbusto: { PASTO: 0.8, CAMPO_SUJO: 1.6, LAVOURA: 0.2, SOLO_EXPOSTO: 0.5, AREIA: 0.6, ROCHA: 0.7, BREJO: 1.2, AGUA: 0 },
  rocha: { PASTO: 0.3, CAMPO_SUJO: 0.5, LAVOURA: 0.05, SOLO_EXPOSTO: 1.0, AREIA: 0.6, ROCHA: 2.5, BREJO: 0.1, AGUA: 0 },
};

/**
 * @param {object} rng      the 'scatter' stream
 * @param {object} terrain
 * @param {{minE:number,minN:number,maxE:number,maxN:number}} bounds
 * @param {Array} parcels
 * @param {{obstacleDensity:number, cornerHiding:number}} difficulty
 */
export function scatterWorld(rng, terrain, bounds, parcels, difficulty) {
  const entities = [];
  const width = bounds.maxE - bounds.minE;
  const height = bounds.maxN - bounds.minN;
  const hectares = (width * height) / 10000;

  // ---- vegetation, on a jittered grid ------------------------------------
  for (const [kind, perHa] of Object.entries(DENSITY)) {
    const count = Math.round(perHa * hectares * difficulty.obstacleDensity);
    const cols = Math.ceil(Math.sqrt((count * width) / height));
    const rows = Math.ceil(count / cols);
    const cw = width / cols;
    const ch = height / rows;

    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const e = bounds.minE + (cx + rng.range(0.1, 0.9)) * cw;
        const n = bounds.minN + (cy + rng.range(0.1, 0.9)) * ch;
        const soil = terrain.soilAt(e, n);
        const like = PREFERS[kind][soil.id] ?? 0.5;
        if (like <= 0 || !rng.chance(like)) continue;
        entities.push(makePlant(kind, e, n, rng));
      }
    }
  }

  // ---- boundary evidence at every parcel corner --------------------------
  // The owner shows you the corners; this is what makes "click the target"
  // meaningful rather than clicking an invisible mathematical vertex.
  const cornerSeen = new Set();
  for (const parcel of parcels) {
    parcel.markIds = [];
    parcel.vertices.forEach((v, i) => {
      if (!cornerSeen.has(v.key)) {
        cornerSeen.add(v.key);
        const variant = rng.int(0, 2);
        const hidden = rng.chance(difficulty.cornerHiding);
        const mark = makeBoundaryMark(v.e, v.n, {
          id: `divisa-${v.id}`,
          label: v.id,
          variant,
          hidden,
          parcelId: parcel.id,
        });
        entities.push(mark);
      }
      parcel.markIds.push(`divisa-${v.id}`);

      // On the harder settings, plant cover right where it will hurt most.
      if (difficulty.cornerHiding > 0) {
        const bushes = Math.round(rng.range(0, 5) * difficulty.cornerHiding * 2);
        for (let k = 0; k < bushes; k++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(2.5, 9);
          const be = v.e + Math.cos(a) * d;
          const bn = v.n + Math.sin(a) * d;
          if (!terrain.soilAt(be, bn).walkable) continue;
          entities.push(makePlant(rng.chance(0.4) ? 'arvore' : 'arbusto', be, bn, rng));
        }
      }
      void i;
    });
  }

  // ---- one homestead per parcel, plus a paddock fence ---------------------
  for (const parcel of parcels) {
    const c = parcel.centroid;
    const spot = findBuildableSpot(rng, terrain, parcel, c);
    if (spot) {
      const w = rng.range(7, 12);
      const h = rng.range(6, 10);
      const ring = [
        [spot.e - w / 2, spot.n - h / 2],
        [spot.e + w / 2, spot.n - h / 2],
        [spot.e + w / 2, spot.n + h / 2],
        [spot.e - w / 2, spot.n + h / 2],
      ];
      entities.push(makeBuilding(ring, { id: `casa-${parcel.id}`, label: `Sede ${parcel.id}`, parcelId: parcel.id }));

      const fenceR = rng.range(16, 24);
      const pts = [];
      const sides = rng.int(4, 6);
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + rng.range(-0.15, 0.15);
        pts.push([spot.e + Math.cos(a) * fenceR, spot.n + Math.sin(a) * fenceR * 0.8]);
      }
      pts.push(pts[0]);
      const { line, posts } = makeFence(pts, { id: `cerca-${parcel.id}`, label: `C${parcel.index + 1}`, parcelId: parcel.id });
      entities.push(line, ...posts);
    }
  }

  return clearSightlinesToCorners(entities, parcels, difficulty);
}

/**
 * Guarantee every boundary corner can be sighted from *some* direction.
 *
 * Obstacles that force the player to move the instrument are the point of the
 * game. An obstacle ring that closes completely around a corner is not — it
 * makes the parcel undeliverable through no fault of the player, with no
 * feedback explaining why. So a clearance is swept around each corner, wide on
 * fácil and barely there on difícil, where hunting for a line is the challenge.
 *
 * The matching guarantee one level up — that a closable RING of stations exists
 * — lives in `world.js#ensureClosableRing`, because it needs the real tripod and
 * line-of-sight predicates and those only exist once the spatial index is built.
 */
export function clearSightlinesToCorners(entities, parcels, difficulty) {
  const clearance = difficulty.cornerHiding >= 0.3 ? 1.4 : difficulty.cornerHiding > 0 ? 2.6 : 4.0;

  const corners = [];
  for (const parcel of parcels) {
    for (const v of parcel.vertices) corners.push(v);
  }

  return entities.filter((ent) => {
    if (!ent.blocksLOS) return true;
    if (ent.kind === KIND_BENFEITORIA) return true; // a building stays put
    for (const c of corners) {
      if (Math.hypot(ent.e - c.e, ent.n - c.n) < clearance + (ent.losR || 0)) return false;
    }
    return true;
  });
}

const KIND_BENFEITORIA = 'benfeitoria';

function makePlant(kind, e, n, rng) {
  const opts = {
    variant: rng.int(0, 3),
    scale: rng.range(0.75, 1.35),
    rot: rng.range(0, Math.PI * 2),
  };
  if (kind === 'arvore') {
    const s = rng.range(0.8, 1.4);
    return makeTree(e, n, { ...opts, scale: s, r: 0.35 * s, losR: rng.range(2.0, 3.4) * s });
  }
  if (kind === 'rocha') {
    const s = rng.range(0.6, 1.5);
    return makeRock(e, n, { ...opts, scale: s, r: 0.6 * s, losR: 0.6 * s });
  }
  const s = rng.range(0.7, 1.3);
  // Only the taller scrub actually stops a sight line.
  const tall = s > 1.05;
  return makeBush(e, n, { ...opts, scale: s, blocksLOS: tall, losR: tall ? 0.9 * s : 0 });
}

/** Somewhere inside the parcel, on firm ground, not on top of a boundary. */
function findBuildableSpot(rng, terrain, parcel, near) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const e = near.e + rng.range(-40, 40);
    const n = near.n + rng.range(-40, 40);
    if (!pointInPolygon(e, n, parcel.ring)) continue;
    const soil = terrain.soilAt(e, n);
    if (!soil.walkable || !soil.tripodOk) continue;
    return { e, n };
  }
  return null;
}
