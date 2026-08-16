// Line of sight.
//
// This is the rule that turns a walking simulator into a surveying problem: if
// you cannot see the corner, you cannot measure it, and you must move the
// instrument or run a traverse. On the harder difficulties the generator
// deliberately plants vegetation near parcel corners so that the direct
// corner-to-corner sight fails and the student has to think.

import { segmentHitsCircle, segmentIntersection, closestOnSegment } from '../core/math2d.js';

/** Ignore obstacles hugging either end: you can sight past the tree beside you. */
const END_SKIP = 0.15;

/**
 * @param {object} spatial
 * @param {{e:number, n:number}} from
 * @param {{e:number, n:number}} to
 * @param {{ignoreIds?:Set<string>|Array<string>, targetId?:string}} opts
 * @returns {{clear:boolean, blockers:Array<{id:string, kind:string, at:[number,number], t:number}>}}
 */
export function lineOfSight(spatial, from, to, opts = {}) {
  const ignore = opts.ignoreIds instanceof Set ? opts.ignoreIds : new Set(opts.ignoreIds || []);
  if (opts.targetId) ignore.add(opts.targetId);

  const total = Math.hypot(to.e - from.e, to.n - from.n);
  if (total < 1e-6) return { clear: true, blockers: [] };

  const candidates = spatial.queryRay(from.e, from.n, to.e, to.n, 6);
  const blockers = [];

  for (const ent of candidates) {
    if (!ent.blocksLOS) continue;
    if (ignore.has(ent.id)) continue;

    if (ent.seg && ent.seg.length > 1) {
      // Buildings and any other polyline obstacle: test each edge.
      const closed = ent.kind === 'benfeitoria';
      const count = closed ? ent.seg.length : ent.seg.length - 1;
      for (let i = 0; i < count; i++) {
        const a = ent.seg[i];
        const b = ent.seg[(i + 1) % ent.seg.length];
        const hit = segmentIntersection(from.e, from.n, to.e, to.n, a[0], a[1], b[0], b[1]);
        if (!hit) continue;
        const dFrom = Math.hypot(hit.e - from.e, hit.n - from.n);
        const dTo = Math.hypot(hit.e - to.e, hit.n - to.n);
        if (dFrom < END_SKIP || dTo < END_SKIP) continue;
        blockers.push({ id: ent.id, kind: ent.kind, at: [hit.e, hit.n], t: dFrom / total, entity: ent });
        break;
      }
      continue;
    }

    const radius = ent.losR ?? ent.r;
    if (!radius) continue;
    const hit = segmentHitsCircle(from.e, from.n, to.e, to.n, ent.e, ent.n, radius, END_SKIP);
    if (!hit) continue;
    blockers.push({
      id: ent.id,
      kind: ent.kind,
      at: [hit.e, hit.n],
      t: hit.t,
      entity: ent,
    });
  }

  blockers.sort((a, b) => a.t - b.t);
  return { clear: blockers.length === 0, blockers };
}

/** The obstacle a blocked sight ran into first — what the toast should name. */
export const firstBlocker = (result) => (result.blockers.length ? result.blockers[0] : null);

/**
 * Can a tripod stand here?
 *
 * The rule from the brief: a clear one-metre radius on ground that will hold
 * the legs. Sampled on two rings rather than at the centre alone, because a
 * tripod straddling the edge of a marsh is exactly the case a single centre
 * sample would wave through.
 *
 * @returns {{ok:boolean, reason:string|null, detail:object, ring:Array}}
 */
export function canSetupTripod(world, e, n, opts = {}) {
  const { radius = 1.0, ignoreIds = [] } = opts;
  const ignore = new Set(ignoreIds);
  const ring = [];

  const inBounds =
    e >= world.bounds.minE && e <= world.bounds.maxE && n >= world.bounds.minN && n <= world.bounds.maxN;
  if (!inBounds) {
    return { ok: false, reason: 'outOfBounds', detail: {}, ring };
  }

  // Centre, then eight points on each of two rings.
  const samples = [{ e, n, ring: 0 }];
  for (const rr of [radius * 0.55, radius]) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      samples.push({ e: e + Math.cos(a) * rr, n: n + Math.sin(a) * rr, ring: rr });
    }
  }

  let badSoil = null;
  let marginal = false;
  for (const s of samples) {
    const soil = world.terrain.soilAt(s.e, s.n);
    const ok = soil.tripodOk;
    if (!ok && !badSoil) badSoil = soil;
    if (soil.id === 'CAMPO_SUJO') marginal = true;
    ring.push({ ...s, soil: soil.id, ok });
  }

  if (badSoil) {
    return { ok: false, reason: 'badSoil', detail: { soil: badSoil.id }, ring };
  }

  // Nothing solid may sit inside the disc — except a marco, which is the whole
  // point of standing there.
  for (const ent of world.spatial.queryCircle(e, n, radius + 2)) {
    if (!ent.blocksWalk) continue;
    if (ignore.has(ent.id)) continue;

    if (ent.seg && ent.seg.length > 1) {
      const closed = ent.kind === 'benfeitoria';
      const count = closed ? ent.seg.length : ent.seg.length - 1;
      for (let i = 0; i < count; i++) {
        const a = ent.seg[i];
        const b = ent.seg[(i + 1) % ent.seg.length];
        if (closestOnSegment(e, n, a[0], a[1], b[0], b[1]).d < radius) {
          return { ok: false, reason: 'obstacle', detail: { kind: ent.kind, id: ent.id }, ring };
        }
      }
      continue;
    }

    if (Math.hypot(ent.e - e, ent.n - n) < radius + ent.r) {
      return { ok: false, reason: 'obstacle', detail: { kind: ent.kind, id: ent.id }, ring };
    }
  }

  return { ok: true, reason: null, detail: { marginal }, ring, marginal };
}
