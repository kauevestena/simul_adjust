// The surveyor on the ground.
//
// Movement is a compromise the brief asked for explicitly: 3 m/s is roughly
// twice a real walking pace, because crossing a four-hectare parcel at 1.4 m/s
// is tedious in a classroom. The service clock stays honest anyway — fast
// travel debits time at the REAL pace, so the elapsed time shown at the end
// still means something.

export const WALK_SPEED = 3.0;
export const RUN_SPEED = 5.0;
export const REAL_SPEED = 1.4; // what the clock is charged at
export const PLAYER_RADIUS = 0.35;

export function makePlayer({ e = 0, n = 0 } = {}) {
  return {
    e,
    n,
    prevE: e,
    prevN: n,
    facing: 'S',
    frame: 0,
    walkPhase: 0,
    moving: false,
    speed: 0,
  };
}

/** Screen-space facing from a movement vector. Ties resolve to vertical. */
function facingFor(dx, dy, current) {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'N' : 'S';
  return dx > 0 ? 'E' : 'W';
}

/**
 * Advance the player one fixed step.
 *
 * @param {object} player
 * @param {{e:number, n:number, run:boolean}} intent  normalized direction
 * @param {object} world
 * @param {number} dt
 */
export function updatePlayer(player, intent, world, dt) {
  player.prevE = player.e;
  player.prevN = player.n;

  let dx = intent.e;
  let dy = intent.n;
  const len = Math.hypot(dx, dy);

  if (len < 1e-6) {
    player.moving = false;
    player.speed = 0;
    // Settle on the passing pose rather than freezing mid-stride.
    player.walkPhase = 0;
    player.frame = 0;
    return player;
  }

  // Normalize so diagonals are not faster than the cardinals.
  dx /= len;
  dy /= len;

  const base = intent.run ? RUN_SPEED : WALK_SPEED;
  const terrainFactor = world.terrain.soilAt(player.e, player.n).speedFactor || 1;
  const speed = base * terrainFactor;

  const stepE = dx * speed * dt;
  const stepN = dy * speed * dt;

  // Resolve each axis separately: this is what lets the player slide along a
  // fence or a bank instead of sticking to it.
  const tryMove = (tE, tN) => {
    if (canStand(world, tE, tN)) {
      player.e = tE;
      player.n = tN;
      return true;
    }
    return false;
  };

  if (!tryMove(player.e + stepE, player.n + stepN)) {
    const slidX = tryMove(player.e + stepE, player.n);
    if (!slidX) tryMove(player.e, player.n + stepN);
  }

  player.facing = facingFor(dx, dy, player.facing);
  player.moving = true;
  player.speed = speed;

  // One full four-frame cycle per 0.62 m of ground covered.
  player.walkPhase += (speed * dt) / 0.62;
  player.frame = Math.floor(player.walkPhase) % 4;

  return player;
}

/**
 * Can the player's body occupy this spot? Circle obstacles are pushed out of;
 * fences and buildings are tested against their segments.
 */
export function canStand(world, e, n, radius = PLAYER_RADIUS) {
  const b = world.bounds;
  if (e < b.minE + radius || e > b.maxE - radius || n < b.minN + radius || n > b.maxN - radius) return false;
  if (!world.terrain.soilAt(e, n).walkable) return false;

  for (const ent of world.spatial.queryCircle(e, n, radius + 6)) {
    if (!ent.blocksWalk) continue;

    if (ent.seg && ent.seg.length > 1) {
      const closed = ent.kind === 'benfeitoria';
      const count = closed ? ent.seg.length : ent.seg.length - 1;
      for (let i = 0; i < count; i++) {
        const a = ent.seg[i];
        const c = ent.seg[(i + 1) % ent.seg.length];
        if (pointSegmentDistance(e, n, a[0], a[1], c[0], c[1]) < radius + 0.12) return false;
      }
      continue;
    }

    if (Math.hypot(ent.e - e, ent.n - n) < radius + ent.r) return false;
  }
  return true;
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Interpolated position for rendering between fixed steps. */
export function interpolated(player, alpha) {
  return {
    ...player,
    e: player.prevE + (player.e - player.prevE) * alpha,
    n: player.prevN + (player.n - player.prevN) * alpha,
  };
}

/**
 * Teleport to a placed marco, charging the service clock for the walk that
 * did not happen. Keeping the clock honest is the whole point.
 * @returns {{ok:boolean, seconds:number, reason?:string}}
 */
export function fastTravel(player, world, target, store) {
  if (!canStand(world, target.e, target.n)) {
    // Land beside it rather than inside whatever is in the way.
    const spot = nearestStandable(world, target.e, target.n);
    if (!spot) return { ok: false, seconds: 0, reason: 'noRoom' };
    target = spot;
  }
  const metres = Math.hypot(target.e - player.e, target.n - player.n);
  const seconds = store ? store.chargeTravelTime(metres, REAL_SPEED) : metres / REAL_SPEED;
  player.e = target.e;
  player.n = target.n;
  player.prevE = target.e;
  player.prevN = target.n;
  return { ok: true, seconds, metres };
}

function nearestStandable(world, e, n) {
  for (let r = 0.6; r <= 4; r += 0.4) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const te = e + Math.cos(a) * r;
      const tn = n + Math.sin(a) * r;
      if (canStand(world, te, tn)) return { e: te, n: tn };
    }
  }
  return null;
}
