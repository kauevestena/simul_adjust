// The working day, and running out of it.
//
// Only *difícil* runs a clock the player can lose to. `estimateTimeLimit()` has
// existed in `core/state.js` since Phase 1 and was never called, so the hardest
// difficulty had no time pressure at all — which left obstacle density as the
// only thing separating it from médio.
//
// The central design decision: **running out ends the job, it does not void
// it.** Forty minutes of careful work destroyed by a timer punishes without
// teaching anything, and a student who is being careful is doing the thing the
// course wants. Overtime instead costs money, on its own line in the payment
// breakdown, so the trade-off is visible and the work is never wasted.

import { estimateTimeLimit } from '../core/state.js';

/** Fractions of the budget at which the clock changes character. */
export const WARN_AT = 0.75;
export const URGENT_AT = 0.9;

/**
 * The time budget for a parcel, in milliseconds, or null when untimed.
 *
 * @param {{perimeter:number, vertices:Array}} parcel
 * @param {{timeLimit:boolean}} difficulty
 */
export function budgetFor(parcel, difficulty) {
  if (!difficulty?.timeLimit) return null;
  const perimeter = parcel.perimeter ?? perimeterOf(parcel.vertices);
  return estimateTimeLimit({ perimeter, nVertices: parcel.vertices.length }) * 1000;
}

/** Fallback when a parcel does not carry its own perimeter. */
function perimeterOf(vertices = []) {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += Math.hypot(b.e - a.e, b.n - a.n);
  }
  return sum;
}

/**
 * Where the job stands against its budget.
 *
 * @returns {{timed:boolean, budgetMs:number|null, remainingMs:number,
 *            fraction:number, level:'ok'|'warn'|'urgent'|'over', overtimeMs:number}}
 */
export function clockState(elapsedMs, budgetMs) {
  if (!budgetMs) {
    return { timed: false, budgetMs: null, remainingMs: Infinity, fraction: 0, level: 'ok', overtimeMs: 0 };
  }
  const fraction = elapsedMs / budgetMs;
  const remainingMs = budgetMs - elapsedMs;
  const level = fraction >= 1 ? 'over' : fraction >= URGENT_AT ? 'urgent' : fraction >= WARN_AT ? 'warn' : 'ok';
  return {
    timed: true,
    budgetMs,
    remainingMs,
    fraction,
    level,
    overtimeMs: Math.max(0, -remainingMs),
  };
}

/**
 * What overtime costs, as a multiplier on the payment.
 *
 * Deliberately gentle at first and never ruinous: half an hour over is a fifth
 * off, and it bottoms out at 40% of the fee however long the job runs. A player
 * who is over time is already behind; the point is to make speed worth
 * something, not to make a slow job pointless.
 */
export function overtimePenalty(overtimeMs) {
  if (overtimeMs <= 0) return 1;
  const hours = overtimeMs / 3600000;
  return Math.max(0.4, 1 - hours * 0.4);
}
