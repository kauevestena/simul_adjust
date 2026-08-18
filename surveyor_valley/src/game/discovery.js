// Finding the boundary evidence.
//
// A share of the corner marks are generated `hidden` — 15% on médio, 40% on
// difícil — buried in scrub the generator plants right on top of them. That is
// the didactic lever of the harder settings: the owner walks the perimeter with
// you and you find the evidence on foot, rather than reading every corner off
// the screen from the first tripod.
//
// The lever was built and never connected. `hidden` was written as "you cannot
// see this from far away", the renderer honoured it, and every path that
// decides what the instrument may be POINTED at simply skipped hidden marks
// outright — for good. A corner you can see and can never measure keeps
// `parcelProgress` incomplete forever, which keeps ENTREGA locked forever:
// measured over five seeds, 67% of médio parcels and 90% of difícil parcels
// could not be delivered at all. Both settings have been unfinishable since the
// first commit.
//
// So `hidden` means NOT YET FOUND here, and this is what finds it. The flag is
// cleared for good once the crew has been close enough — the discovery is
// permanent because it has to be: a reading is taken from the eyepiece, and a
// corner that were only targetable while you stood beside it would need you to
// be in two places at once.
//
// DOM-free, so `tests/discovery.test.mjs` can walk a crew across a real world.

/** How close the crew must get. Overridden per entity by `revealRadius`. */
export const REVEAL_RADIUS = 15;

/**
 * Reveal every boundary mark within reach of anybody in the crew.
 *
 * Both members count. Ligeirinho beating a path through the scrub at 45 m/s is
 * exactly as good a way of turning up a buried marker as walking there
 * yourself, and it costs nothing to say so.
 *
 * @param {object} world
 * @param {Array<{e:number, n:number}>} positions  where the crew is standing
 * @param {number} [radius]  fallback for a mark with no `revealRadius`
 * @returns {string[]} ids revealed BY THIS CALL — never ones already found, so
 *          the caller can announce each one exactly once.
 */
export function revealMarksNear(world, positions, radius = REVEAL_RADIUS) {
  if (!world) return [];
  const found = [];
  for (const pos of positions) {
    if (!pos) continue;
    for (const ent of world.spatial.queryCircle(pos.e, pos.n, radius)) {
      if (!ent.hidden || ent.targetKind !== 'divisa') continue;
      const reach = ent.revealRadius ?? radius;
      if (Math.hypot(ent.e - pos.e, ent.n - pos.n) > reach) continue;
      ent.hidden = false;
      found.push(ent.id);
    }
  }
  return found;
}

/**
 * Put the saved discoveries back after a reload.
 *
 * A save stores the seed rather than the valley, so the world is regenerated
 * from scratch and every mark comes back buried. Without this, a reload would
 * make the player walk the whole perimeter again — and on difícil, where the
 * clock is running, charge them for it.
 */
export function applyRevealed(world, ids = []) {
  if (!world) return 0;
  let n = 0;
  for (const id of ids) {
    const ent = world.entity(id);
    if (!ent || !ent.hidden) continue;
    ent.hidden = false;
    n++;
  }
  return n;
}
