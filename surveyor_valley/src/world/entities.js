// Everything standing on the ground.
//
// Two booleans carry most of the gameplay: `blocksWalk` stops the player,
// `blocksLOS` stops a sight line. They are independent on purpose — tall grass
// blocks neither, a wire fence blocks walking but not seeing, a dense thicket
// blocks seeing but can be pushed through.
//
// `targetable` marks what the instrument may be pointed at. Fence corners,
// building corners and boundary markers are all legitimate survey targets,
// which is what makes a cadastral survey of a real property feel real.

export const KIND = {
  ARVORE: 'arvore',
  ARBUSTO: 'arbusto',
  ROCHA: 'rocha',
  CERCA: 'cerca',
  POSTE: 'poste',
  BENFEITORIA: 'benfeitoria',
  MARCO_DIVISA: 'marco_divisa',
  MARCO_JOGADOR: 'marco_jogador',
  MORADOR: 'morador',
};

const DEFAULTS = {
  [KIND.ARVORE]: { r: 0.55, blocksWalk: true, blocksLOS: true, targetable: false, losR: 2.6 },
  [KIND.ARBUSTO]: { r: 0.35, blocksWalk: false, blocksLOS: true, targetable: false, losR: 1.1 },
  [KIND.ROCHA]: { r: 0.8, blocksWalk: true, blocksLOS: true, targetable: false, losR: 0.8 },
  [KIND.POSTE]: { r: 0.14, blocksWalk: true, blocksLOS: true, targetable: true, losR: 0.14 },
  [KIND.CERCA]: { r: 0.1, blocksWalk: true, blocksLOS: false, targetable: true, losR: 0.1 },
  [KIND.BENFEITORIA]: { r: 4, blocksWalk: true, blocksLOS: true, targetable: true, losR: 4 },
  [KIND.MARCO_DIVISA]: { r: 0.18, blocksWalk: false, blocksLOS: false, targetable: true, losR: 0 },
  [KIND.MARCO_JOGADOR]: { r: 0.18, blocksWalk: false, blocksLOS: false, targetable: true, losR: 0 },
  /**
   * A person. Blocks nothing, on purpose: an owner standing in their own gate
   * would otherwise be a walking obstacle for a crew that has to get past them
   * to be paid, and a body between the instrument and a corner would refuse a
   * sight for a reason no student could learn anything from.
   */
  [KIND.MORADOR]: { r: 0.3, blocksWalk: false, blocksLOS: false, targetable: false, losR: 0 },
};

let nextId = 0;

/** Reset ids. Deterministic worlds need deterministic ids. */
export const resetIds = (v = 0) => {
  nextId = v;
};

/**
 * @param {string} kind
 * @param {number} e @param {number} n  true position in world metres
 */
export function makeEntity(kind, e, n, extra = {}) {
  const d = DEFAULTS[kind] || DEFAULTS[KIND.ARBUSTO];
  return {
    id: extra.id || `${kind}-${++nextId}`,
    kind,
    e,
    n,
    /** Collision radius. */
    r: extra.r ?? d.r,
    /** Sight-blocking radius: a canopy is wider than a trunk. */
    losR: extra.losR ?? d.losR,
    blocksWalk: extra.blocksWalk ?? d.blocksWalk,
    blocksLOS: extra.blocksLOS ?? d.blocksLOS,
    targetable: extra.targetable ?? d.targetable,
    targetKind: extra.targetKind || null,
    /** Polyline vertices for fences and building footprints, in metres. */
    seg: extra.seg || null,
    variant: extra.variant ?? 0,
    /** Atlas key prefix, for entities whose art is chosen per world. */
    look: extra.look || null,
    scale: extra.scale ?? 1,
    rot: extra.rot ?? 0,
    label: extra.label || null,
    /**
     * NOT YET FOUND. An overgrown corner starts buried and is cleared for good
     * by `game/discovery.js` once the crew has been within `revealRadius` — it
     * is a discovery, not a draw distance, which is why nothing sets it back.
     *
     * It used to be read as a pure render rule while every path deciding what
     * the instrument may be pointed at skipped hidden marks outright, so a
     * buried corner could be seen and never measured. That left `parcelProgress`
     * permanently incomplete: 67% of médio and 90% of difícil parcels could not
     * be delivered at all.
     */
    hidden: extra.hidden ?? false,
    revealRadius: extra.revealRadius ?? 15,
    ...(extra.parcelId ? { parcelId: extra.parcelId } : {}),
  };
}

export const makeTree = (e, n, o = {}) => makeEntity(KIND.ARVORE, e, n, o);
export const makeBush = (e, n, o = {}) => makeEntity(KIND.ARBUSTO, e, n, o);
export const makeRock = (e, n, o = {}) => makeEntity(KIND.ROCHA, e, n, o);
export const makePost = (e, n, o = {}) => makeEntity(KIND.POSTE, e, n, o);

/** A boundary marker standing at a parcel corner: the physical evidence. */
export const makeBoundaryMark = (e, n, o = {}) =>
  makeEntity(KIND.MARCO_DIVISA, e, n, { targetKind: 'divisa', ...o });

/** A monument the player materialized. */
export const makePlayerMarco = (e, n, o = {}) =>
  makeEntity(KIND.MARCO_JOGADOR, e, n, { targetKind: 'marco', ...o });

/**
 * Somebody who lives here.
 *
 * `look` is an atlas key prefix — `owner-f2` — rather than a colour, because
 * the sheet is painted once at boot from fixed archetypes and the valley is
 * built per seed. `scene.js` appends the direction and the breath frame.
 */
export const makeResident = (e, n, o = {}) => makeEntity(KIND.MORADOR, e, n, o);

/** A building. `seg` is its footprint ring; corners are targetable. */
export function makeBuilding(ring, o = {}) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const r = Math.max(...ring.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
  return makeEntity(KIND.BENFEITORIA, cx, cy, { seg: ring, r, losR: r, targetKind: 'benfeitoria', ...o });
}

/**
 * A run of fence: a polyline plus a post entity at each vertex.
 *
 * NOTHING IN THE GENERATOR PLANTS ONE TODAY. The paddock that used to ring each
 * farmhouse is gone — see the note in `scatter.js` — and this is kept because
 * the capability is complete and correct (collision, the slide solver, the line
 * renderer and the targetable posts all handle it), and because a fence along a
 * divisa is the obvious next use. It is not called from anywhere; do not read
 * its presence as evidence that fences exist in the valley.
 *
 * `gate` drops the LAST segment of the line while keeping every post, so a ring
 * of points becomes an enclosure you can walk into. Doing it this way rather
 * than by shortening `points` is deliberate: the posts, their auto-generated
 * ids and their positions are all untouched, so `world.hash()` does not move
 * and a save written before the gate existed still lines up with its valley.
 * The two posts either side of the opening stay standing, which is what a farm
 * gate looks like anyway.
 */
export function makeFence(points, o = {}) {
  const { gate = false, ...rest } = o;
  const posts = points.map((p, i) =>
    makePost(p[0], p[1], { targetKind: 'cerca', label: o.label ? `${o.label}-${i + 1}` : null }),
  );
  const line = makeEntity(KIND.CERCA, points[0][0], points[0][1], {
    seg: gate && points.length > 2 ? points.slice(0, -1) : points,
    blocksWalk: true,
    blocksLOS: false,
    targetable: false,
    ...rest,
  });
  return { line, posts };
}
