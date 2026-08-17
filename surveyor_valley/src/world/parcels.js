// Six adjacent rural parcels carved out of one block of land.
//
// This is the load-bearing generation step. Network reuse and `confrontantes`
// both depend on the boundaries being topologically EXACT: if two neighbours
// were generated independently they would leave slivers, a marco planted on the
// line would serve only one of them, and "bounded by the Santa Gertrudes farm"
// would be a decorative lie rather than a fact about the geometry.
//
// So the parcels are cut, not drawn. A weighted Voronoi partition of the block
// gives cells that tile it exactly; the shared edges are then irregularized
// ONCE, on the shared edge object, so both neighbours receive the identical
// vertex chain by construction.

import {
  clipHalfPlane,
  closestOnSegment,
  convexHull,
  dedupeRing,
  signedArea,
  centroid,
  bbox,
  snapMm,
  ringPerimeter,
  isSelfIntersecting,
} from '../core/math2d.js';
import { dealCast, confrontanteLabel, exteriorLabel } from './names.js';

export const EXTERIOR = '__exterior__';

/** Relative sizes; scaled to the block, they land roughly between 0.4 and 1.5 ha. */
const AREA_WEIGHTS = [0.55, 0.75, 1.0, 1.15, 1.5, 2.05];

/**
 * The width of the whole gleba, in metres, and the two knobs that decide how
 * many corners a parcel ends up with.
 *
 * These belong together because they are one decision: how long a job is. Area
 * scales as `BLOCK_SIZE²` and perimeter as `BLOCK_SIZE`, but the time a service
 * takes is dominated by the CORNER COUNT — `estimateTimeLimit` charges 3.5 min
 * a vertex against about 1.3 min per 60 m walked. So shrinking the block alone
 * barely shortens a job: the cut thresholds below are in absolute metres, and
 * on shorter edges they simply keep producing the same number of vertices.
 *
 * `EDGE_CUTS` reads as [longThreshold, shortThreshold] in metres. An edge
 * longer than the first is broken into 2–3 pieces, one longer than the second
 * into 2, and anything shorter is left alone — so raising them is what actually
 * removes corners. Only the longest boundaries wander now, which is also the
 * truer picture: a rural boundary runs straight from one marco to the next
 * unless it is following a river or a road.
 *
 * Measured over eight seeds, these give 0.35–1.50 ha and 4–9 corners, against
 * 1.05–4.68 ha and 7–16 before — and take the worst job from about 109 minutes
 * of estimated field time down to 65.
 */
const BLOCK_SIZE = 280;
const HULL_POINTS = [7, 10];
const EDGE_CUTS = [140, 75];

/**
 * The outer boundary of the whole gleba.
 *
 * Built as a CONVEX hull of jittered points on an ellipse, and convex for a
 * reason: half-plane clipping below is Sutherland-Hodgman, which is only well
 * behaved on convex input. A non-convex block silently produces cells with
 * spurious connecting edges. The parcels get their irregular, un-geometric look
 * later, from the shared-edge displacement.
 */
function makeBlockPolygon(rng, { cx, cy, size, hullPoints = HULL_POINTS }) {
  const pts = [];
  const n = rng.int(hullPoints[0], hullPoints[1]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.12, 0.12);
    const rx = (size / 2) * rng.range(0.86, 1.0);
    const ry = (size / 2) * rng.range(0.86, 1.0);
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return convexHull(pts).map(([e, n2]) => [snapMm(e), snapMm(n2)]);
}

/**
 * Power-diagram cell for site i: the block clipped by one half-plane per rival.
 *
 * The weight is the only difference from a plain Voronoi diagram: it slides the
 * bisector along the line joining the two sites by (w_i - w_j) / (2·d), so a
 * heavier site keeps more land. Note that offset is a DISTANCE, already divided
 * by d — multiplying by d again collapses every cell.
 */
function powerCell(block, sites, i) {
  let cell = block;
  const p = sites[i];
  for (let j = 0; j < sites.length; j++) {
    if (j === i) continue;
    const q = sites[j];
    const dx = q.e - p.e;
    const dy = q.n - p.n;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) continue;
    const nx = dx / d;
    const ny = dy / d;
    const offset = (p.w - q.w) / (2 * d);
    const mx = (p.e + q.e) / 2 + nx * offset;
    const my = (p.n + q.n) / 2 + ny * offset;
    cell = clipHalfPlane(cell, nx, ny, nx * mx + ny * my);
    if (cell.length < 3) return [];
  }
  return cell;
}

/**
 * Weighted Lloyd relaxation: move each site toward its cell centroid, then
 * nudge its weight toward the area it is supposed to end up with.
 *
 * Weights carry units of area, and the resulting boundary shift is Δw / 2d, so
 * the gain is expressed relative to the block to keep the step around a metre
 * per round. Weights are re-centred each round so they cannot drift as a group,
 * and clamped so one parcel can never starve another to nothing.
 */
function relax(block, sites, targetFractions, rounds) {
  const blockArea = Math.abs(signedArea(block));
  const span = Math.sqrt(blockArea);
  const gain = span * span * 0.05;
  const maxW = span * span * 0.35;

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < sites.length; i++) {
      const cell = powerCell(block, sites, i);
      if (cell.length < 3) {
        // Starved: give the weight back and let the next round re-seat it.
        sites[i].w = 0;
        continue;
      }
      const c = centroid(cell);
      sites[i].e += (c.e - sites[i].e) * 0.6;
      sites[i].n += (c.n - sites[i].n) * 0.6;

      const relErr = (targetFractions[i] * blockArea - Math.abs(signedArea(cell))) / blockArea;
      sites[i].w += relErr * gain;
    }

    const wMean = sites.reduce((s, x) => s + x.w, 0) / sites.length;
    for (const s of sites) {
      s.w = Math.max(-maxW, Math.min(maxW, s.w - wMean));
    }
  }
  return sites;
}

/** Ensure a ring runs counter-clockwise. */
const asCCW = (ring) => (signedArea(ring) < 0 ? [...ring].reverse() : ring);

/**
 * Key a vertex by its millimetre-snapped coordinates so that two cells meeting
 * along a boundary resolve to the *same* vertex object, not two coincident ones.
 */
const vkey = (e, n) => `${Math.round(e * 1000)}|${Math.round(n * 1000)}`;
const ekey = (a, b) => (a < b ? `${a}::${b}` : `${b}::${a}`);

/**
 * @param {object} rng   the 'parcels' stream
 * @param {object} opts  {cx, cy, size, count}
 * @returns {{parcels:Array, vertices:Map, edges:Map, block:Array, cast:object}}
 */
export function generateParcels(
  rng,
  { cx = 320, cy = 320, size = BLOCK_SIZE, count = 6, hullPoints = HULL_POINTS, edgeCuts = EDGE_CUTS } = {},
) {
  const block = asCCW(makeBlockPolygon(rng, { cx, cy, size, hullPoints }));
  const blockArea = Math.abs(signedArea(block));

  // --- 1. Sites, stratified so they never clump into a corner ---------------
  const weights = rng.shuffle([...AREA_WEIGHTS]).slice(0, count);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const targetFractions = weights.map((w) => w / wSum);

  const cols = 3;
  const rows = Math.ceil(count / cols);
  const bb = bbox(block);
  const sites = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    sites.push({
      e: bb.minE + ((col + rng.range(0.25, 0.75)) * bb.w) / cols,
      n: bb.minN + ((row + rng.range(0.25, 0.75)) * bb.h) / rows,
      w: 0,
      index: i,
    });
  }

  relax(block, sites, targetFractions, 40);

  // --- 2. Cells, then shared topology --------------------------------------
  const cells = sites.map((_, i) => dedupeRing(powerCell(block, sites, i), 0.01));
  if (cells.some((c) => c.length < 3)) {
    // A degenerate partition is a generator bug, not a playable world.
    throw new Error('parcel generation produced a degenerate cell');
  }

  /** @type {Map<string, {id:string, e:number, n:number}>} */
  const vertices = new Map();
  const vertexAt = (e, n) => {
    const se = snapMm(e);
    const sn = snapMm(n);
    const k = vkey(se, sn);
    if (!vertices.has(k)) vertices.set(k, { id: `V${vertices.size + 1}`, key: k, e: se, n: sn });
    return vertices.get(k);
  };

  /** @type {Map<string, object>} */
  const edges = new Map();
  const rings = cells.map((cell, ci) => {
    const ccw = asCCW(cell);
    const ringVerts = ccw.map(([e, n]) => vertexAt(e, n));
    const ringEdges = [];
    for (let i = 0; i < ringVerts.length; i++) {
      const a = ringVerts[i];
      const b = ringVerts[(i + 1) % ringVerts.length];
      if (a.key === b.key) continue;
      const k = ekey(a.key, b.key);
      if (!edges.has(k)) {
        edges.set(k, { id: `E${edges.size + 1}`, key: k, a, b, parcels: [], chain: null });
      }
      const edge = edges.get(k);
      if (!edge.parcels.includes(ci)) edge.parcels.push(ci);
      ringEdges.push({ edge, forward: a.key === edge.a.key });
    }
    return { ringVerts, ringEdges };
  });

  // --- 3. Classify edges, then irregularize the shared ones ----------------
  // An edge is exterior when it lies on the block outline. Deciding that by
  // geometry rather than by "only one parcel claimed it" is what keeps the
  // confrontantes honest even if the clipper ever splits a boundary unevenly.
  for (const edge of edges.values()) {
    const mid = { e: (edge.a.e + edge.b.e) / 2, n: (edge.a.n + edge.b.n) / 2 };
    edge.exterior = distanceToRing(mid, block) < 0.05;
    if (!edge.exterior && edge.parcels.length !== 2) {
      throw new Error(`interior edge ${edge.id} is claimed by ${edge.parcels.length} parcel(s)`);
    }
  }

  // Only SHARED edges are displaced. Applied to the shared edge object, both
  // neighbours inherit the identical vertex chain, so the boundary matches to
  // the millimetre and what one parcel gains the other loses exactly — which is
  // why the parcels still tile the block to float precision afterwards.
  for (const edge of edges.values()) {
    const { a, b } = edge;
    if (edge.exterior) {
      edge.chain = [a, b];
      continue;
    }
    const dx = b.e - a.e;
    const dy = b.n - a.n;
    const len = Math.hypot(dx, dy);
    const nx = dy / len;
    const ny = -dx / len;

    const cuts = len > edgeCuts[0] ? rng.int(2, 4) : len > edgeCuts[1] ? 2 : 1;
    const interior = [];
    for (let k = 1; k < cuts; k++) {
      const t = k / cuts;
      const amp = Math.min(8, len * 0.12);
      const off = rng.range(-amp, amp);
      interior.push(vertexAt(a.e + dx * t + nx * off, a.n + dy * t + ny * off));
    }
    edge.chain = [a, ...interior, b];
  }

  // --- 4. Rebuild each ring from the shared chains -------------------------
  const cast = dealCast(rng, count);
  const parcels = rings.map(({ ringEdges }, ci) => {
    const ringVertices = [];
    const sideEdges = [];
    for (const { edge, forward } of ringEdges) {
      const chain = forward ? edge.chain : [...edge.chain].reverse();
      // Drop the last vertex: it is the next edge's first.
      for (let i = 0; i < chain.length - 1; i++) {
        ringVertices.push(chain[i]);
        sideEdges.push(edge);
      }
    }

    const ring = ringVertices.map((v) => [v.e, v.n]);
    const area = Math.abs(signedArea(ring));
    const c = centroid(ring);

    return {
      id: `P${ci + 1}`,
      index: ci,
      owner: cast.owners[ci],
      propertyName: cast.properties[ci],
      municipio: cast.municipio,
      uf: cast.uf,
      /** Ring vertices in CCW order, shared objects. */
      vertices: ringVertices,
      /** The edge each side belongs to, parallel to `vertices`. */
      sideEdges,
      ring,
      area,
      hectares: area / 10000,
      perimeter: ringPerimeter(ring),
      centroid: c,
      bbox: bbox(ring),
    };
  });

  // --- 5. Confrontantes ----------------------------------------------------
  // Every side knows what lies beyond it, which is exactly what the memorial
  // descritivo needs and costs nothing extra now that the topology is shared.
  const exteriorByEdge = new Map();
  let exteriorPick = 0;
  for (const edge of edges.values()) {
    if (edge.exterior) {
      exteriorByEdge.set(edge.key, cast.exteriors[exteriorPick % cast.exteriors.length]);
      exteriorPick++;
    }
  }

  for (const parcel of parcels) {
    parcel.confrontantes = parcel.sideEdges.map((edge) => {
      if (edge.exterior) {
        return { kind: 'exterior', feature: exteriorByEdge.get(edge.key), parcelId: null };
      }
      const other = edge.parcels.find((i) => i !== parcel.index);
      return { kind: 'parcel', feature: null, parcelId: parcels[other].id };
    });

    parcel.confrontanteFor = (sideIndex, lang = 'pt') => {
      const c = parcel.confrontantes[sideIndex];
      if (!c) return '';
      if (c.kind === 'exterior') return exteriorLabel(c.feature, lang);
      return confrontanteLabel(parcels.find((p) => p.id === c.parcelId), lang);
    };
  }

  // --- 6. Sanity, enforced rather than hoped for --------------------------
  for (const p of parcels) {
    if (isSelfIntersecting(p.ring)) throw new Error(`parcel ${p.id} ring self-intersects`);
    if (p.vertices.length < 3) throw new Error(`parcel ${p.id} has too few vertices`);
  }

  return { parcels, vertices, edges, block, blockArea, cast };
}

/** Shortest distance from a point to a closed ring's boundary. */
function distanceToRing(p, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = closestOnSegment(p.e, p.n, ring[j][0], ring[j][1], ring[i][0], ring[i][1]).d;
    if (d < best) best = d;
  }
  return best;
}

/** Total area of all parcels; equals the block area to float precision. */
export const totalArea = (parcels) => parcels.reduce((s, p) => s + p.area, 0);
