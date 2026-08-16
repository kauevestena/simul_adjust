// Fixed-timestep game loop with interpolated rendering.
//
// `update(FIXED_DT)` is deterministic and never sees a variable delta, which is
// what keeps movement and the service clock honest regardless of refresh rate.
// `render(alpha)` interpolates between the previous and current fixed states so
// motion stays smooth at 60, 120 or 144 Hz.
//
// The browser globals are read lazily inside start(), so importing this module
// under Node (for tests) is safe.

export const FIXED_DT = 1 / 60;
const MAX_STEPS = 5; // spiral-of-death guard
const MAX_FRAME = 0.25; // tab-switch guard, seconds

/** How many recent frame durations to keep for the percentile readout. */
const HISTORY = 600;

export function makeLoop({ update, render }) {
  let running = false;
  let paused = false;
  let rafId = null;
  let last = 0;
  let acc = 0;
  let fps = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;

  // A rolling window of frame durations. Averages hide exactly the failure that
  // matters here — one 25 ms chunk bake in an otherwise perfect second reads as
  // 60 fps and feels like a stutter — so percentiles and the max are kept.
  const history = new Float32Array(HISTORY);
  let histCount = 0;
  let histAt = 0;

  function frame(now) {
    if (!running) return;
    rafId = globalThis.requestAnimationFrame(frame);

    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > MAX_FRAME) dt = MAX_FRAME;

    history[histAt] = dt * 1000;
    histAt = (histAt + 1) % HISTORY;
    if (histCount < HISTORY) histCount++;

    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = fpsFrames / fpsAcc;
      fpsAcc = 0;
      fpsFrames = 0;
    }

    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= FIXED_DT && steps < MAX_STEPS) {
        update(FIXED_DT);
        acc -= FIXED_DT;
        steps++;
      }
      // Ran out of budget: drop the backlog rather than accumulate debt.
      if (steps === MAX_STEPS) acc = 0;
    }

    render(paused ? 0 : acc / FIXED_DT);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = globalThis.performance?.now?.() ?? Date.now();
      acc = 0;
      rafId = globalThis.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId != null) globalThis.cancelAnimationFrame(rafId);
      rafId = null;
    },
    /** Paused still renders (so modals sit over a live-looking scene) but does not update. */
    setPaused(v) {
      if (paused === v) return;
      paused = v;
      acc = 0;
    },
    get paused() {
      return paused;
    },
    get running() {
      return running;
    },
    get fps() {
      return fps;
    },

    /**
     * Percentiles over the recent window, in milliseconds.
     * `over33` is the one that matters: those are the visible hitches.
     */
    frameStats() {
      if (!histCount) return null;
      const s = Array.from(history.subarray(0, histCount)).sort((a, b) => a - b);
      const at = (q) => s[Math.min(s.length - 1, Math.floor(s.length * q))];
      return {
        n: s.length,
        p50: +at(0.5).toFixed(2),
        p95: +at(0.95).toFixed(2),
        max: +s[s.length - 1].toFixed(2),
        over33: s.filter((d) => d > 33).length,
      };
    },

    resetStats() {
      histCount = 0;
      histAt = 0;
    },
  };
}
