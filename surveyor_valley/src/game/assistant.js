// Ligeirinho, auxiliar de topografia.
//
// The second half of the crew, and the reason the first half is allowed to stay
// at the instrument. A total station is not a one-person tool: somebody has to
// carry the prism to the point being measured and hold the pole plumb over it.
// Until this module existed the game quietly pretended otherwise — you set the
// tripod up once and then sighted the whole parcel from wherever you had
// wandered off to, which is the one thing a real survey can never do.
//
// So the rule and the character arrived together. `service.sight` now refuses
// unless the player is on the instrument, and this is who does the walking.
//
// He runs at about thirty times a real pace, which is a deliberate lie in the
// same family as the player's own 4.5 m/s: the honest alternative is watching
// somebody amble 60 m every time you want a reading, forty times a job. What
// matters is that the sight lands when he ARRIVES rather than when you click,
// so the two-person crew is something you can see rather than something the
// manual asserts.
//
// DOM-free, so `tests/assistant.test.mjs` can drive him across a real world.

import { slideStep, canStand } from './player.js';

/**
 * Dash pace, in m/s. Fast enough that a corner across the parcel is reached in
 * about a second — the fast-forward button on an emulator, not a teleport.
 * A teleport would remove the very thing this module exists to show.
 */
export const DASH_SPEED = 45;

/** Trailing pace. A shade over the player's walk, so he can actually keep up. */
export const FOLLOW_SPEED = 6.0;

/** Close enough to the point to be standing on it, prism up. */
export const ARRIVE_RADIUS = 0.9;

/**
 * How long he may go WITHOUT GETTING CLOSER before planting the pole where he
 * stands, and the hard ceiling on any one errand.
 *
 * The safety valve, and the reason it exists at all: a boundary corner can sit
 * in a marsh, hard against a building, or on the far side of water —
 * `canStand` refuses all three — and a sight that waited for an arrival that
 * can never happen would softlock the game with no error and nothing on screen
 * to explain it. A real prism man in that spot holds the pole from as close as
 * he can get and calls it, so that is what happens here: `gaveUp`, and the
 * reading is taken anyway.
 *
 * It measures LACK OF PROGRESS rather than elapsed time, which is the actual
 * question. A flat four-second budget also expired on merely LONG errands —
 * measured, a 150 m sight from a batch measure hit it and reported as stuck
 * while he was still running perfectly well — so distant targets silently got
 * their reading from wherever he had got to instead of from the point. The
 * ceiling is what stops a pathological case running forever.
 */
export const STUCK_TIMEOUT = 1.5;
export const ERRAND_CEILING = 12.0;

/** How far behind the player he settles when there is nothing to measure. */
export const FOLLOW_DISTANCE = 3.5;

/** His body is narrower than the player's — he is carrying a pole, not a tripod. */
export const ASSISTANT_RADIUS = 0.3;

/**
 * A dash step is chopped into pieces no longer than this.
 *
 * At 45 m/s a fixed 1/60 s step is 0.75 m, and `canStand` is a test of a
 * POSITION rather than of a swept path — so a single step of that size steps
 * clean over a fence, a fence post and most of a building without ever
 * occupying an illegal spot. Six sub-steps a frame costs nothing measurable and
 * makes him obey the same walls the player does.
 */
const MAX_SUBSTEP = 0.15;

/** Ground covered by one full four-frame cycle. Shorter than the player's: he trots. */
const STRIDE = 0.54;

const BREATH_SLOT = 0.8;
const BREATH_PATTERN = [0, 0, 1];

export const MODE = {
  /** Trailing the player, with nothing to do. */
  FOLLOW: 'follow',
  /** Running to a point that is about to be measured. */
  DASH: 'dash',
  /** Standing on the last point with the pole up. */
  PLANTED: 'planted',
};

export function makeAssistant({ e = 0, n = 0 } = {}) {
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
    idlePhase: 0,
    idleFrame: 0,
    mode: MODE.FOLLOW,
    /** Where he has been sent, in world metres, or null. */
    target: null,
    /** Seconds spent on the current dash, against `ERRAND_CEILING`. */
    dashTime: 0,
    /** The closest he has been to it, and how long since that improved. */
    bestDistance: Infinity,
    stalledFor: 0,
  };
}

/**
 * Send him to a world position. Idempotent for the same point, so a double
 * click does not restart the run he is already making.
 */
export function sendTo(a, e, n) {
  if (a.mode === MODE.DASH && a.target && a.target.e === e && a.target.n === n) return a;
  a.target = { e, n };
  a.mode = MODE.DASH;
  a.dashTime = 0;
  a.bestDistance = Infinity;
  a.stalledFor = 0;
  return a;
}

/** Abandon the current errand and fall back in behind the player. */
export function recall(a) {
  a.target = null;
  a.mode = MODE.FOLLOW;
  a.dashTime = 0;
  a.bestDistance = Infinity;
  a.stalledFor = 0;
  return a;
}

/** Same facing rule as the player's, so the two sprites read alike. */
function facingFor(dx, dy, current) {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'N' : 'S';
  return dx > 0 ? 'E' : 'W';
}

/**
 * Advance him one fixed step.
 *
 * @param {object} a
 * @param {object} world
 * @param {number} dt
 * @param {{player:{e:number,n:number}}} ctx
 * @returns {{arrived:boolean, gaveUp:boolean}}  `arrived` fires exactly once,
 *          on the step he reaches the point; `gaveUp` exactly once, on the step
 *          the timeout expires. The caller takes the reading on either.
 */
export function updateAssistant(a, world, dt, { player } = {}) {
  a.prevE = a.e;
  a.prevN = a.n;

  const startE = a.e;
  const startN = a.n;
  const result = { arrived: false, gaveUp: false };

  if (a.mode === MODE.DASH && a.target) {
    a.dashTime += dt;
    const dE = a.target.e - a.e;
    const dN = a.target.n - a.n;
    const dist = Math.hypot(dE, dN);

    if (dist <= ARRIVE_RADIUS) {
      a.mode = MODE.PLANTED;
      result.arrived = true;
    } else {
      run(world, a, dE / dist, dN / dist, DASH_SPEED * dt);
      // Re-measured AFTER the step: sliding along a fence can carry him inside
      // the arrival radius without the straight-line test above ever seeing it.
      const now = Math.hypot(a.target.e - a.e, a.target.n - a.n);

      // Progress, in the only sense that matters: is he closer than he has ever
      // been? Grinding along a wall covers ground without getting anywhere, and
      // that is exactly the case the timeout is for.
      if (now < a.bestDistance - 0.05) {
        a.bestDistance = now;
        a.stalledFor = 0;
      } else {
        a.stalledFor += dt;
      }

      if (now <= ARRIVE_RADIUS) {
        a.mode = MODE.PLANTED;
        result.arrived = true;
      } else if (a.stalledFor >= STUCK_TIMEOUT || a.dashTime >= ERRAND_CEILING) {
        a.mode = MODE.PLANTED;
        result.gaveUp = true;
      }
    }
  } else if (a.mode === MODE.FOLLOW && player) {
    const dE = player.e - a.e;
    const dN = player.n - a.n;
    const dist = Math.hypot(dE, dN);
    if (dist > FOLLOW_DISTANCE) {
      // Ease off over the last stride rather than stopping dead on the line,
      // which otherwise reads as a sprite being snapped to a leash.
      const ease = Math.min(1, (dist - FOLLOW_DISTANCE) / 1.5);
      run(world, a, dE / dist, dN / dist, FOLLOW_SPEED * ease * dt);
    }
  }

  // ---- animation, from ground actually covered ----------------------------
  // The same rule the player follows: legs driven by displacement, never by
  // intent, so being stopped by a fence stops the walk cycle too.
  const moved = Math.hypot(a.e - startE, a.n - startN);
  a.speed = moved / dt;

  if (moved > 1e-5) {
    a.facing = facingFor(a.e - startE, a.n - startN, a.facing);
    a.walkPhase = (a.walkPhase + moved / STRIDE) % 4;
    a.moving = true;
    a.idlePhase = 0;
    a.idleFrame = 0;
  } else {
    a.moving = false;
    a.walkPhase = 0;
    a.idlePhase += dt;
    a.idleFrame = BREATH_PATTERN[Math.floor(a.idlePhase / BREATH_SLOT) % BREATH_PATTERN.length];
  }
  a.frame = Math.floor(a.walkPhase) % 4;

  return result;
}

/** One move of `distance` metres along a unit heading, chopped fine enough to collide. */
function run(world, a, ux, uy, distance) {
  const steps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const stepLen = distance / steps;
  for (let i = 0; i < steps; i++) {
    const beforeE = a.e;
    const beforeN = a.n;
    slideStep(world, a, ux * stepLen, uy * stepLen, ASSISTANT_RADIUS);
    // Wedged: the remaining sub-steps would only grind against the same wall,
    // and the dash timeout is what resolves it.
    if (Math.abs(a.e - beforeE) < 1e-9 && Math.abs(a.n - beforeN) < 1e-9) return;
  }
}

/**
 * Put him down beside the player at the start of a job.
 *
 * `canStand` can refuse the obvious spot — the player may be standing with
 * their back to a fence — so this spirals out rather than dropping him into it.
 */
export function placeBeside(world, { e, n }) {
  for (let r = 1.2; r <= 6; r += 0.6) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const te = e + Math.cos(a) * r;
      const tn = n + Math.sin(a) * r;
      if (canStand(world, te, tn, ASSISTANT_RADIUS)) return makeAssistant({ e: te, n: tn });
    }
  }
  return makeAssistant({ e, n });
}

/** Interpolated position for rendering between fixed steps. */
export function interpolatedAssistant(a, alpha) {
  return {
    ...a,
    e: a.prevE + (a.e - a.prevE) * alpha,
    n: a.prevN + (a.n - a.prevN) * alpha,
  };
}

/** Bring him to rest where he stands, for the moments the fixed step does not run. */
export function haltAssistant(a) {
  a.moving = false;
  a.speed = 0;
  a.walkPhase = 0;
  a.frame = 0;
  a.idlePhase = 0;
  a.idleFrame = 0;
}
