// Ground cover.
//
// These are the small things — blades, pebbles, flowers, reeds — that get baked
// straight into the terrain chunks rather than drawn as entities. That is the
// whole trick behind the density: a screen can carry ten thousand tufts of
// grass because none of them costs a draw call, only the twenty chunk blits do.
//
// They are mostly drawn WITHOUT an outline. An outline on a 6-pixel tuft turns
// a field into visual static; outlines are for things that stand up.

import { makePix, P } from './shared.js';

/** A clump of grass blades. The single most repeated shape in the game. */
export function grassTuft(rng, { tall = false, dry = false } = {}) {
  const W = 12;
  const H = tall ? 13 : 9;
  const pix = makePix(W, H);
  const ramp = dry ? P.grassDry : P.grass;
  const baseY = H - 1;
  const cx = W / 2;

  const blades = rng.int(4, 6);
  for (let i = 0; i < blades; i++) {
    const lean = rng.range(-3, 3);
    const len = rng.range(tall ? 6 : 4, tall ? 11 : 7);
    const x0 = cx + rng.range(-2.5, 2.5);
    const shade = i % 2 === 0 ? ramp[2] : ramp[0];
    // A blade curves: it leaves the ground upright and falls away at the tip.
    for (let s = 0; s <= len; s++) {
      const k = s / len;
      pix.px(Math.round(x0 + lean * k * k), Math.round(baseY - s), shade);
    }
  }
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A denser hummock, for the rough grazing. */
export function tussock(rng) {
  const W = 14;
  const H = 12;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 1;

  pix.blob(cx, baseY - 3, 6, 3.2, P.grassDry[0], rng, { wobble: 0.3 });
  for (let i = 0; i < 9; i++) {
    const x0 = cx + rng.range(-5, 5);
    const len = rng.range(4, 9);
    const lean = rng.range(-3, 3);
    const shade = i % 3 === 0 ? P.grassDry[2] : i % 3 === 1 ? P.grassDry[1] : P.grass[0];
    for (let s = 0; s <= len; s++) {
      const k = s / len;
      pix.px(Math.round(x0 + lean * k * k), Math.round(baseY - 2 - s), shade);
    }
  }
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A wildflower. Rare enough to be a small event when you walk past one. */
export function flower(rng, variant = 0) {
  const W = 7;
  const H = 9;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 1;
  const petal = P.flower[variant % P.flower.length];

  const h = rng.int(4, 6);
  for (let s = 0; s <= h; s++) pix.px(cx, baseY - s, P.grassDeep[1]);
  // A leaf on the stem.
  pix.px(cx - 1, baseY - 2, P.grassDeep[2]);

  const cy = baseY - h - 1;
  pix.px(cx, cy, petal[2]);
  pix.px(cx - 1, cy, petal[1]);
  pix.px(cx + 1, cy, petal[1]);
  pix.px(cx, cy - 1, petal[1]);
  pix.px(cx, cy + 1, petal[0]);
  if (rng.chance(0.5)) {
    pix.px(cx - 1, cy - 1, petal[0]);
    pix.px(cx + 1, cy + 1, petal[0]);
  }
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A pebble. Three pixels of nothing that stop bare soil looking like paper. */
export function pebble(rng) {
  const W = 5;
  const H = 4;
  const pix = makePix(W, H);
  const ramp = rng.chance(0.5) ? P.rock : P.soil;
  pix.ellipse(W / 2, H - 1.5, rng.range(1.2, 2.2), rng.range(0.9, 1.4), ramp[1]);
  pix.px(Math.round(W / 2 - 1), H - 2, ramp[2]);
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A loose stone on rocky ground — bigger than a pebble, gets an outline. */
export function stone(rng) {
  const W = 10;
  const H = 8;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 1;

  const n = rng.int(5, 7);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = rng.range(0.7, 1);
    pts.push([cx + Math.cos(a) * 4 * r, baseY - 2.5 + Math.sin(a) * 2.5 * r]);
  }
  pix.poly(pts, P.rock[1]);
  pix.poly(
    pts.map(([x, y]) => [x - 1, y - 1]),
    P.rock[2],
  );
  pix.poly(pts.map(([x, y]) => [x + 1.5, y + 1.5]).slice(0, 3).concat([[cx, baseY - 1]]), P.rock[0]);
  pix.outline('auto', { amount: 0.38 });
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** Marsh reeds. Tall, thin, and unmistakably "do not put a tripod here". */
export function reed(rng) {
  const W = 9;
  const H = 18;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 1;

  for (let i = 0; i < rng.int(3, 5); i++) {
    const x0 = cx + rng.range(-3, 3);
    const len = rng.range(9, 16);
    const lean = rng.range(-2.5, 2.5);
    const shade = i % 2 ? P.grassDeep[1] : P.grassDeep[2];
    let tipX = x0;
    let tipY = baseY;
    for (let s = 0; s <= len; s++) {
      const k = s / len;
      tipX = x0 + lean * k * k;
      tipY = baseY - s;
      pix.px(Math.round(tipX), Math.round(tipY), shade);
    }
    // Seed head.
    if (rng.chance(0.6)) {
      pix.px(Math.round(tipX), Math.round(tipY - 1), P.soil[1]);
      pix.px(Math.round(tipX), Math.round(tipY - 2), P.soil[0]);
    }
  }
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A clod of turned earth. */
export function clod(rng) {
  const W = 6;
  const H = 5;
  const pix = makePix(W, H);
  pix.ellipse(W / 2, H - 2, rng.range(1.4, 2.4), rng.range(1, 1.6), P.soil[0]);
  pix.px(Math.round(W / 2 - 1), H - 3, P.soil[2]);
  return { pix, anchorX: 0.5, anchorY: 1 };
}

/** A crop plant, for the tilled fields. Rows of these are what read as lavoura. */
export function crop(rng) {
  const W = 9;
  const H = 11;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 1;

  for (let i = 0; i < rng.int(4, 6); i++) {
    const lean = rng.range(-3.2, 3.2);
    const len = rng.range(5, 9);
    const shade = i % 2 ? P.grassDeep[1] : P.grass[1];
    for (let s = 0; s <= len; s++) {
      const k = s / len;
      pix.px(Math.round(cx + lean * k), Math.round(baseY - s * 0.9), shade);
      if (s > len * 0.5) pix.px(Math.round(cx + lean * k) + 1, Math.round(baseY - s * 0.9), shade);
    }
  }
  return { pix, anchorX: 0.5, anchorY: 1 };
}
