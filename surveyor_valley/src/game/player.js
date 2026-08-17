// The surveyor on the ground.
//
// Movement is a compromise the brief asked for explicitly: 3 m/s is roughly
// twice a real walking pace, because crossing a four-hectare parcel at 1.4 m/s
// is tedious in a classroom. The service clock stays honest anyway — fast
// travel debits time at the REAL pace, so the elapsed time shown at the end
// still means something.
//
// Everything else here exists to stop that speed reading as a sprite being
// dragged around a map. Three things do the work, and all three are about the
// difference between what the player ASKED for and what actually happened:
//
//   * velocity ramps instead of teleporting between 0 and full pace, and a turn
//     brakes sideways rather than swinging the vector round in an arc;
//   * a blocked step slides along the real contact normal, so a diagonal fence
//     is brushed past rather than zigzagged along in axis-aligned steps;
//   * the walk cycle is driven by ground COVERED, so walking into a tree stops
//     the legs too instead of moonwalking against it.

export const WALK_SPEED = 3.0;
export const RUN_SPEED = 5.0;
export const REAL_SPEED = 1.4; // what the clock is charged at
export const PLAYER_RADIUS = 0.35;

/**
 * Ramp rates, written as the time to reach walking pace so they can be read as
 * feel rather than as m/s². Getting up to speed takes about a third of a stride
 * (~0.20 m); stopping is deliberately quicker than starting, because a walker
 * who coasts to a halt reads as ice, not as weight.
 */
const ACCEL = WALK_SPEED / 0.13;
const BRAKE = WALK_SPEED / 0.09;
/** Sideways velocity is shed faster still, so a change of direction is crisp. */
const TURN_BRAKE = WALK_SPEED / 0.07;

/** Below this the player is standing, not creeping. Exponential tails never reach zero. */
const STOP_SPEED = 0.06;

/** How far a slide is nudged off a surface so a tangent does not graze it. */
const SURFACE_BIAS = 0.003;

/** Ground covered by one full four-frame cycle. */
const STRIDE = 0.62;
/** Walk-cycle phase per second while finishing the last step into a standstill. */
const SETTLE_RATE = 8;

/**
 * Breathing, while standing still.
 *
 * Deliberately lopsided: the chest is at rest for two thirds of the cycle and
 * raised for one. An even alternation reads as a mechanical flicker, which is a
 * worse kind of wrong than being static — the lungs are meant to look like
 * lungs, not like a two-frame loop. `SLOT` seconds per step through `PATTERN`,
 * so a full breath is 2.4 s.
 */
const BREATH_SLOT = 0.8;
const BREATH_PATTERN = [0, 0, 1];

export function makePlayer({ e = 0, n = 0 } = {}) {
  return {
    e,
    n,
    prevE: e,
    prevN: n,
    /** Carried between steps: this is what makes the motion have any weight. */
    vE: 0,
    vN: 0,
    facing: 'S',
    frame: 0,
    walkPhase: 0,
    moving: false,
    speed: 0,
    /**
     * Seconds spent standing, and the breath frame that follows from it. Kept
     * apart from `walkPhase` on purpose: that one drives the footstep audio and
     * is asserted on by the movement tests, and an idle has no business
     * touching either.
     */
    idlePhase: 0,
    idleFrame: 0,
  };
}

/**
 * Screen-space facing from a movement vector.
 *
 * A direction already being pressed wins, so turning north-east while facing
 * east does not snap the sprite round to north for no reason. Only a genuinely
 * new direction reorients, and ties then resolve to vertical.
 */
function facingFor(dx, dy, current) {
  if (dx === 0 && dy === 0) return current;
  if (current === 'N' && dy > 0) return 'N';
  if (current === 'S' && dy < 0) return 'S';
  if (current === 'E' && dx > 0) return 'E';
  if (current === 'W' && dx < 0) return 'W';
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'N' : 'S';
  return dx > 0 ? 'E' : 'W';
}

/** Move `v` toward `target` by at most `maxStep`. */
const approach = (v, target, maxStep) =>
  v < target ? Math.min(target, v + maxStep) : Math.max(target, v - maxStep);

/**
 * Advance the player one fixed step.
 *
 * @param {object} player
 * @param {{e:number, n:number, run:boolean}} intent  direction, not normalized
 * @param {object} world
 * @param {number} dt
 */
export function updatePlayer(player, intent, world, dt) {
  player.prevE = player.e;
  player.prevN = player.n;

  const startE = player.e;
  const startN = player.n;

  let dx = intent.e;
  let dy = intent.n;
  const len = Math.hypot(dx, dy);
  const wants = len > 1e-6;

  if (wants) {
    // Normalize so diagonals are not faster than the cardinals.
    dx /= len;
    dy /= len;
    player.facing = facingFor(dx, dy, player.facing);
  }

  // ---- velocity ------------------------------------------------------------
  const base = intent.run ? RUN_SPEED : WALK_SPEED;
  const terrainFactor = world.terrain.soilAt(player.e, player.n).speedFactor || 1;
  const wantSpeed = wants ? base * terrainFactor : 0;

  if (wants) {
    // Split the current velocity into the part ALONG the wanted direction and
    // the part ACROSS it. The along part ramps toward the target speed; the
    // across part is braked away. Braking sideways rather than rotating the
    // whole vector is what makes a turn feel like a turn instead of a skid.
    const along = player.vE * dx + player.vN * dy;
    const acrE = player.vE - along * dx;
    const acrN = player.vN - along * dy;

    // Reversing is braking, not accelerating: a person plants a foot and pivots
    // rather than coasting through zero and out the other side.
    const rate = along > wantSpeed ? BRAKE : along < 0 ? TURN_BRAKE : ACCEL;
    const nextAlong = approach(along, wantSpeed, rate * dt);

    const acr = Math.hypot(acrE, acrN);
    const keep = acr > 1e-9 ? Math.max(0, acr - TURN_BRAKE * dt) / acr : 0;

    player.vE = nextAlong * dx + acrE * keep;
    player.vN = nextAlong * dy + acrN * keep;
  } else {
    const v = Math.hypot(player.vE, player.vN);
    const keep = v > 1e-9 ? Math.max(0, v - BRAKE * dt) / v : 0;
    player.vE *= keep;
    player.vN *= keep;
  }

  if (Math.hypot(player.vE, player.vN) < STOP_SPEED) {
    player.vE = 0;
    player.vN = 0;
  }

  // ---- move ----------------------------------------------------------------
  if (player.vE !== 0 || player.vN !== 0) {
    stepWithSliding(world, player, player.vE * dt, player.vN * dt);
  }

  // ---- animation -----------------------------------------------------------
  // From ground actually covered, never from the intent. This is what keeps the
  // legs honest when a fence, a marsh or the ramp itself means the player is
  // moving slower than they asked to.
  const moved = Math.hypot(player.e - startE, player.n - startN);
  player.speed = moved / dt;

  if (moved > 1e-5) {
    player.walkPhase = (player.walkPhase + moved / STRIDE) % 4;
    player.moving = true;
    player.idlePhase = 0;
    player.idleFrame = 0;
  } else if (player.moving) {
    // Finish the step being taken instead of snapping to the passing pose:
    // freezing mid-stride is the most obviously wrong thing a walk cycle can
    // do. Frames 0 and 2 are both the passing pose, so the nearest one ahead is
    // never more than half a stride away.
    const settle = Math.ceil(player.walkPhase / 2) * 2;
    player.walkPhase = Math.min(settle, player.walkPhase + SETTLE_RATE * dt);
    if (player.walkPhase >= settle - 1e-6) {
      player.walkPhase = 0;
      player.moving = false;
    }
  } else {
    // Standing. Someone standing still is still breathing, and a sprite that
    // holds one pixel-identical frame for a minute reads as the game having
    // stopped rather than as the surveyor waiting.
    player.idlePhase += dt;
    player.idleFrame = BREATH_PATTERN[Math.floor(player.idlePhase / BREATH_SLOT) % BREATH_PATTERN.length];
  }
  player.frame = Math.floor(player.walkPhase) % 4;

  return player;
}

/**
 * Apply one step, sliding along whatever is in the way.
 *
 * Contact displaces the player and deliberately does NOT touch the velocity.
 * Velocity is what the player is asking for; where they end up is geometry. Two
 * things fall out of keeping those separate: a slide is re-derived from the full
 * velocity every step, so it does not decay while the key is still held — the
 * turn brake would otherwise shed the tangential component the instant it
 * appeared and stall the player against the fence — and walking off the end of
 * a wall resumes the original heading immediately, with no re-acceleration.
 * There is nothing to accumulate, because the ramp already caps the speed.
 */
function stepWithSliding(world, player, stepE, stepN) {
  if (place(world, player, player.e + stepE, player.n + stepN)) return;

  const nrm = contactNormal(world, player.e + stepE, player.n + stepN);
  if (nrm) {
    const into = stepE * nrm.x + stepN * nrm.y;
    if (into < 0) {
      const slideE = stepE - into * nrm.x;
      const slideN = stepN - into * nrm.y;
      // A straight tangent to a curved surface cuts back inside it, so the
      // slide is nudged out by a hair. Worst case is a running step around the
      // smallest obstacle in the world, which sags about 2 mm; 3 mm clears it,
      // and is a twentieth of an art pixel. Without this the player slides
      // around a tree until the geometry grazes and is then held there.
      //
      // Only when the slide actually goes somewhere: walking straight into a
      // wall has no tangential component, and biasing THAT would jog the player
      // 3 mm off the wall every step and set the legs walking on the spot.
      if (
        Math.hypot(slideE, slideN) > 1e-6 &&
        place(world, player, player.e + slideE + nrm.x * SURFACE_BIAS, player.n + slideN + nrm.y * SURFACE_BIAS)
      ) {
        return;
      }
    }
  }

  // Wedged, or stopped by something with no usable normal. Fall back to one
  // axis at a time, which still gets the player out of a corner.
  if (stepE !== 0 && place(world, player, player.e + stepE, player.n)) return;
  if (stepN !== 0) place(world, player, player.e, player.n + stepN);
}

function place(world, player, e, n) {
  if (!canStand(world, e, n)) return false;
  player.e = e;
  player.n = n;
  return true;
}

/**
 * The outward surface normal at a blocked position, or null if there is nothing
 * to take one from.
 *
 * Contributions are summed, so a corner between two fences gives the diagonal
 * that actually points out of it rather than whichever segment happened to be
 * tested first.
 */
function contactNormal(world, e, n, radius = PLAYER_RADIUS) {
  let nx = 0;
  let ny = 0;

  const b = world.bounds;
  if (e < b.minE + radius) nx += 1;
  else if (e > b.maxE - radius) nx -= 1;
  if (n < b.minN + radius) ny += 1;
  else if (n > b.maxN - radius) ny -= 1;

  for (const ent of world.spatial.queryCircle(e, n, radius + 6)) {
    if (!ent.blocksWalk) continue;

    if (ent.seg && ent.seg.length > 1) {
      const closed = ent.kind === 'benfeitoria';
      const count = closed ? ent.seg.length : ent.seg.length - 1;
      for (let i = 0; i < count; i++) {
        const a = ent.seg[i];
        const c = ent.seg[(i + 1) % ent.seg.length];
        const p = closestOnSegment(e, n, a[0], a[1], c[0], c[1]);
        const d = Math.hypot(e - p.x, n - p.y);
        // Dead on the line there is no side to be on, so there is no normal
        // either; the axis fallback deals with that case.
        if (d >= radius + 0.12 || d < 1e-6) continue;
        nx += (e - p.x) / d;
        ny += (n - p.y) / d;
      }
      continue;
    }

    const d = Math.hypot(e - ent.e, n - ent.n);
    if (d >= radius + ent.r || d < 1e-6) continue;
    nx += (e - ent.e) / d;
    ny += (n - ent.n) / d;
  }

  // Terrain has no edges to take a normal from — water is a field, not a
  // polygon — so probe around the blocked spot and push back toward whatever is
  // walkable. This is what lets a river bank be walked ALONG rather than being
  // a series of little steps into it and back out.
  if (nx === 0 && ny === 0 && !world.terrain.soilAt(e, n).walkable) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      if (world.terrain.soilAt(e + cos * radius * 2, n + sin * radius * 2).walkable) {
        nx += cos;
        ny += sin;
      }
    }
  }

  const len = Math.hypot(nx, ny);
  return len > 1e-6 ? { x: nx / len, y: ny / len } : null;
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

function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { x: ax + dx * t, y: ay + dy * t };
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const p = closestOnSegment(px, py, ax, ay, bx, by);
  return Math.hypot(px - p.x, py - p.y);
}

/**
 * Bring the player to rest where they stand, without moving them.
 *
 * For the moments the fixed step does not run — a modal is up, the loop is
 * paused. Velocity would otherwise sit frozen and be spent the instant play
 * resumes, walking the player somewhere they are no longer asking to go.
 */
export function halt(player) {
  player.vE = 0;
  player.vN = 0;
  player.speed = 0;
  player.moving = false;
  player.walkPhase = 0;
  player.frame = 0;
  // The breath stops too. This runs every step a modal is open, so leaving it
  // to accumulate would have the surveyor gasping behind the dialog.
  player.idlePhase = 0;
  player.idleFrame = 0;
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
  // Arrive standing still. Carrying momentum through a teleport would walk the
  // player straight back off the marco they just travelled to.
  player.vE = 0;
  player.vN = 0;
  player.walkPhase = 0;
  player.frame = 0;
  player.moving = false;
  player.speed = 0;
  player.idlePhase = 0;
  player.idleFrame = 0;
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
