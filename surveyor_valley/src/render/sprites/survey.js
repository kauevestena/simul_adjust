// The kit: monuments, the total station, the prism, fence posts.
//
// These are the objects the game is actually about, so they are drawn a little
// larger than strict scale — a 15 cm concrete marco would be two pixels across
// and unclickable. Everything here is exaggerated to roughly 1.5x its real
// width while keeping its real height, which is the same licence Stardew takes
// with tools and reads as correct rather than cartoonish.

import { makePix, contactShadow, P } from './shared.js';

/**
 * A monument the player planted. Deliberately the brightest thing in the kit:
 * you need to spot your own control from across a paddock.
 */
export function playerMarco() {
  const W = 14;
  const H = 24;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 3;
  const top = baseY - 15;

  contactShadow(pix, cx, baseY, 5, 2);

  // Tapered concrete post.
  for (let y = top; y <= baseY; y++) {
    const k = (y - top) / (baseY - top);
    const hw = 2.4 + k * 1.1;
    pix.hline(Math.round(cx - hw), Math.round(cx + hw), y, P.concrete[1]);
    pix.px(Math.round(cx - hw), y, P.concrete[2]);
    pix.px(Math.round(cx + hw), y, P.concrete[0]);
  }

  // The top plate with its cross — the actual point the coordinates refer to.
  pix.ellipse(cx, top, 3.4, 1.6, P.instrumentTrim[1]);
  pix.px(cx, top, P.instrumentTrim[0]);
  pix.hline(cx - 1, cx + 1, top, P.instrumentTrim[0]);

  // A painted band, so it is unmistakably yours.
  pix.hline(cx - 3, cx + 3, baseY - 7, P.roof[1]);
  pix.hline(cx - 3, cx + 3, baseY - 6, P.roof[0]);

  pix.outline('auto', { amount: 0.42 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

/**
 * Existing boundary evidence at a parcel corner: concrete marker, wooden
 * piquete, or an iron pin. Three variants because a real perimeter is never
 * monumented the same way twice, and because telling them apart is a small
 * observational skill worth rewarding.
 */
export function boundaryMark(variant = 0) {
  const W = 14;
  const H = 22;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 3;
  const v = variant % 3;

  contactShadow(pix, cx, baseY, 4.5, 1.8);

  if (v === 0) {
    const top = baseY - 12;
    for (let y = top; y <= baseY; y++) {
      const k = (y - top) / (baseY - top);
      const hw = 2.2 + k * 0.9;
      pix.hline(Math.round(cx - hw), Math.round(cx + hw), y, P.concrete[0]);
      pix.px(Math.round(cx - hw), y, P.concrete[1]);
    }
    pix.ellipse(cx, top, 3, 1.4, P.concrete[2]);
    pix.px(cx, top, P.iron[1]);
    // Weathering: a few darker pixels down one face.
    pix.px(cx + 2, baseY - 4, P.rockMoss[0]);
    pix.px(cx + 2, baseY - 7, P.rockMoss[0]);
  } else if (v === 1) {
    const top = baseY - 14;
    pix.fill(cx - 2, top, 4, baseY - top + 1, P.wood[1]);
    pix.vline(cx - 2, top, baseY, P.wood[2]);
    pix.vline(cx + 1, top, baseY, P.woodDark[0]);
    // Painted head, faded.
    pix.fill(cx - 2, top, 4, 3, P.roof[1]);
    pix.px(cx - 1, top + 1, P.roof[2]);
  } else {
    const top = baseY - 11;
    pix.fill(cx - 1, top, 2, baseY - top + 1, P.iron[1]);
    pix.vline(cx - 1, top, baseY, P.iron[2]);
    pix.ellipse(cx, top, 3, 1.3, P.metal[1]);
    pix.px(cx, top, P.iron[0]);
  }

  pix.outline('auto', { amount: 0.4 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

/** The total station, set up and levelled. The hero prop. */
export function totalStation() {
  const W = 28;
  const H = 36;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 2;
  const headY = 14;

  contactShadow(pix, cx, baseY - 1, 11, 3);

  // Three legs: two splayed toward us, one going back.
  const leg = (x1, y1, x2, y2, colour) => {
    pix.line(x1, y1, x2, y2, colour);
    pix.line(x1 + 1, y1, x2 + 1, y2, colour);
  };
  leg(cx - 1, headY + 4, cx - 9, baseY, P.woodDark[0]);
  leg(cx, headY + 4, cx + 8, baseY, P.wood[1]);
  leg(cx, headY + 3, cx + 1, baseY - 4, P.woodDark[1]);
  // Shoe plates.
  pix.hline(cx - 10, cx - 7, baseY, P.iron[1]);
  pix.hline(cx + 7, cx + 10, baseY, P.iron[1]);

  // Tribrach.
  pix.fill(cx - 6, headY + 1, 12, 4, P.metal[1]);
  pix.hline(cx - 6, cx + 5, headY + 1, P.metal[2]);
  pix.hline(cx - 6, cx + 5, headY + 4, P.iron[0]);

  // Alidade: two standards with the telescope between them.
  pix.fill(cx - 5, headY - 7, 10, 8, P.instrument[1]);
  pix.hline(cx - 5, cx + 4, headY - 7, P.instrument[2]);
  pix.vline(cx - 5, headY - 7, headY, P.instrument[2]);
  // Keypad / display panel, the yellow that says "instrument".
  pix.fill(cx - 4, headY - 4, 8, 3, P.instrumentTrim[1]);
  pix.hline(cx - 4, cx + 3, headY - 4, P.instrumentTrim[2]);

  // Telescope.
  pix.fill(cx - 2, headY - 13, 4, 7, P.instrument[1]);
  pix.vline(cx - 2, headY - 13, headY - 7, P.instrument[2]);
  pix.ellipse(cx, headY - 13, 2.6, 1.8, P.instrument[0]);
  pix.ellipse(cx, headY - 13, 1.5, 1.1, P.lens[1]);
  pix.px(cx - 1, headY - 14, P.lens[2]);

  pix.outline('auto', { amount: 0.44 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

/** The reflector the player sights on, on its bastão. */
export function prism() {
  const W = 12;
  const H = 26;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 2;
  const headY = 5;

  contactShadow(pix, cx, baseY, 3.5, 1.6);

  // Pole with its levelling bubble.
  pix.fill(cx - 1, headY + 3, 2, baseY - headY - 3, P.metal[1]);
  pix.vline(cx - 1, headY + 3, baseY, P.metal[2]);
  // Alternating metre bands.
  for (let y = headY + 6; y < baseY; y += 5) pix.hline(cx - 1, cx, y, P.roof[1]);

  // Prism head.
  pix.ellipse(cx, headY, 4.4, 4, P.metal[0]);
  pix.ellipse(cx, headY, 3.2, 2.9, P.prism[1]);
  pix.ellipse(cx - 1, headY - 1, 1.6, 1.4, P.prism[2]);
  pix.hline(cx - 3, cx + 2, headY, P.prism[0]);
  pix.vline(cx, headY - 3, headY + 2, P.prism[0]);

  pix.outline('auto', { amount: 0.42 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

/** A fence post. Sighting one is legitimate — it is boundary evidence too. */
export function fencePost() {
  const W = 8;
  const H = 22;
  const pix = makePix(W, H);
  const cx = W / 2;
  const baseY = H - 2;
  const top = baseY - 15;

  contactShadow(pix, cx, baseY, 3, 1.4);
  pix.fill(cx - 2, top, 4, baseY - top + 1, P.wood[1]);
  pix.vline(cx - 2, top, baseY, P.wood[2]);
  pix.vline(cx + 1, top, baseY, P.woodDark[0]);
  pix.ellipse(cx, top, 2.4, 1.1, P.wood[2]);
  // Grain.
  pix.px(cx, top + 5, P.woodDark[0]);
  pix.px(cx - 1, top + 9, P.woodDark[0]);

  pix.outline('auto', { amount: 0.42 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}
