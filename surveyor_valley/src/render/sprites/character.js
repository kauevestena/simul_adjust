// The surveyor, and the auxiliar.
//
// The one sprite the player looks at for an hour, so it gets the most care per
// pixel. Sixteen frames (four directions x four walk phases) are *computed*
// from a limb-swing parameter rather than drawn sixteen times; west is east
// mirrored, which is both cheaper and guarantees the two agree.
//
// Wardrobe is not decoration. A hi-vis vest is what a field surveyor actually
// wears, and it makes the player the most saturated thing on a green screen —
// so you never lose yourself in a pasture full of scrub.
//
// Everything below is driven by a `look`: skin, hair, hat and clothing ramps
// plus two booleans. That is what lets the player choose a face and lets
// Ligeirinho be a second character rather than a second painter — the limb
// code, the walk cycle and the anchor are shared, so his stride and the
// player's cannot drift apart the way two copies would.

import { makePix, contactShadow, P } from './shared.js';
import { resolveLook } from '../palette.js';

const W = 24;
const H = 34;

/**
 * @param {object} opts
 * @param {'S'|'N'|'E'} [opts.dir]  West is produced by mirroring East in the roster.
 * @param {number} [opts.frame]
 * @param {'walk'|'kneel'|'kneel-idle'|'idle'} [opts.pose]
 *
 *        `idle` is the top of a breath: the pose a standing surveyor alternates
 *        with walk frame 0. A person at rest is never a photograph, and one
 *        drawn as a photograph reads as a bug in the game rather than as
 *        stillness.
 * @param {object} [opts.look]  a resolved look, or a plain `{body, skin, hair,
 *        hat}` of indices — anything unresolved is run through `resolveLook`.
 */
export function surveyor({ dir = 'S', frame = 0, pose = 'walk', look = null } = {}) {
  const L = normalizeLook(look);
  const pix = makePix(W, H);
  const cx = W / 2;

  if (pose === 'kneel') return kneeling(pix, cx, false, L);
  if (pose === 'kneel-idle') return kneeling(pix, cx, true, L);

  const idle = pose === 'idle';

  // Frames 0 and 2 are the passing pose, 1 and 3 the strides.
  const phase = [0, 1, 0, -1][frame % 4];
  const bob = frame % 2 === 1 ? -1 : 0;
  const swing = phase * 3;

  const baseY = 32;
  // The breath lifts the chest and head but NOT the hips, so the torso
  // lengthens by a pixel instead of the whole body hopping. `bob` moves all
  // three together, which is right for a stride and wrong for breathing.
  const lift = idle ? 1 : 0;
  const hipY = 23 + bob;
  const shoulderY = 14 + bob - lift;
  const headCy = 8 + bob - lift;
  const side = dir === 'E';
  const fem = L.body === 'f';

  // Hands drift a little away from the body at the top of the breath. `drawArm`
  // travels 70% of what it is given, so this is well under a pixel at the
  // shoulder and about one at the hand — a settle, not a swing.
  const armIdle = idle ? 1.4 : 0;

  contactShadow(pix, cx, baseY + 1, 7, 2.5);

  // The pole is planted BEFORE the body so the hand ends up in front of it.
  if (L.carriesPole) drawPole(pix, cx + (side ? 5 : 7), baseY, headCy - 4);

  // ---- legs: the far one first, so the near one overlaps it ---------------
  const legDx = side ? 1.5 : 2.6;
  drawLeg(pix, cx - legDx, hipY, baseY, -swing, L.trousers[0], L.boots[0]);
  drawLeg(pix, cx + legDx, hipY, baseY, swing, L.trousers[1], L.boots[1]);

  // ---- far arm -----------------------------------------------------------
  // Outside the torso silhouette, or it simply vanishes behind it.
  const armDx = side ? 2 : 6.5;
  drawArm(pix, cx - armDx, shoulderY, -swing - armIdle, L.shirt[0], L.skin);

  // ---- torso -------------------------------------------------------------
  // The female silhouette is a narrower shoulder over a slightly wider hip —
  // the taper reversed, and nothing else. At 24 pixels across, that is the only
  // difference that reads; anything more becomes caricature rather than a body.
  const halfTop = (side ? 3.5 : 5) - (fem ? 0.6 : 0);
  const halfBot = (side ? 3 : 4.2) + (fem ? 0.5 : 0);
  for (let y = shoulderY; y <= hipY; y++) {
    const k = (y - shoulderY) / (hipY - shoulderY);
    // Waisted rather than straight-tapered: the midpoint pulls in a little.
    const waist = fem ? Math.sin(k * Math.PI) * 0.55 : 0;
    const hw = halfTop + (halfBot - halfTop) * k - waist;
    pix.hline(Math.round(cx - hw), Math.round(cx + hw), y, L.shirt[1]);
    pix.px(Math.round(cx - hw), y, L.shirt[2]);
    pix.px(Math.round(cx + hw), y, L.shirt[0]);
  }

  if (L.wearsVest) {
    // Hi-vis vest: two panels with the shirt showing between them, and one
    // reflective band. A solid yellow slab reads as a sandwich board.
    const vestTop = shoulderY + 1;
    const vestBot = hipY - 1;
    const vw = side ? 2 : 3;
    for (let y = vestTop; y <= vestBot; y++) {
      if (side) {
        pix.hline(cx - vw + 1, cx + vw - 1, y, L.vest[1]);
        pix.px(cx - vw + 1, y, L.vest[2]);
      } else {
        pix.vline(cx - vw, vestTop, vestBot, L.vest[1]);
        pix.vline(cx - vw + 1, vestTop, vestBot, L.vest[2]);
        pix.vline(cx + vw - 1, vestTop, vestBot, L.vest[1]);
        pix.vline(cx + vw, vestTop, vestBot, L.vest[0]);
      }
    }
    const bandY = vestTop + 4;
    pix.hline(cx - vw, cx + vw, bandY, L.vest[2]);
    pix.hline(cx - vw, cx + vw, bandY + 1, L.vest[0]);
  } else {
    // A check, not a vest. Two sparse crossing lines is all that survives at
    // this size — a real tartan turns to noise.
    for (let y = shoulderY + 2; y <= hipY - 1; y += 3) {
      pix.hline(Math.round(cx - halfTop + 1), Math.round(cx + halfTop - 1), y, L.vest[1]);
    }
    pix.vline(cx - 1, shoulderY + 1, hipY - 1, L.vest[1]);
    pix.vline(cx + 2, shoulderY + 1, hipY - 1, L.vest[0]);
  }

  // ---- near arm ----------------------------------------------------------
  drawArm(pix, cx + armDx, shoulderY, swing + armIdle, L.shirt[2], L.skin);

  // ---- head --------------------------------------------------------------
  const headX = side ? cx + 1 : cx;
  pix.disc(headX, headCy, 4.6, L.skin[1]);
  pix.disc(headX - 1.4, headCy - 1.4, 2.6, L.skin[2]);
  pix.ellipse(headX + 2, headCy + 1.8, 1.8, 1.6, L.skin[0]);

  // Longer hair reaches below the brim, which is what actually distinguishes
  // the two bodies from behind — where there is no face to go on at all.
  if (fem) drawLongHair(pix, headX, headCy, side, dir, L.hair);

  if (dir === 'N') {
    // Away from us: all hair, no face.
    pix.ellipse(headX, headCy - 0.5, 4.6, 4.2, L.hair[1]);
    pix.ellipse(headX - 1.4, headCy - 2, 2.6, 1.8, L.hair[2]);
  } else if (side) {
    pix.px(headX + 2, headCy, '#2b2b2b');
    pix.ellipse(headX - 2.8, headCy - 1, 2.2, 2.6, L.hair[1]);
    // A hint of a jaw line.
    pix.px(headX + 4, headCy + 2, L.skin[0]);
  } else {
    pix.px(headX - 2, headCy, '#2b2b2b');
    pix.px(headX + 2, headCy, '#2b2b2b');
    pix.hline(headX - 1, headX + 1, headCy + 3, L.skin[0]);
    pix.ellipse(headX, headCy - 3.2, 4.4, 1.8, L.hair[1]);
  }

  // Hair at the temples, low enough to clear the brim.
  //
  // Not a detail: the fringe above is painted over by the hat a moment later,
  // completely, so without this the hair colour a player picks would be
  // invisible on every view but the one from behind — a choice on the menu that
  // changes nothing on screen. A hat covers the crown, not the sides.
  drawTemples(pix, headX, headCy, side, dir, L.hair);

  // Half a pixel higher than it used to sit, which is what opens the fringe
  // line above. Any more and the hat floats off the head.
  drawHat(pix, headX, headCy - 4, side, L.hat);

  pix.outline('auto', { amount: 0.46 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

/** Accept a resolved look, a plain index look, or nothing at all. */
function normalizeLook(look) {
  if (look && Array.isArray(look.skin)) return look;
  return resolveLook(look || {});
}

function drawLeg(pix, x, hipY, baseY, dx, trouser, boot) {
  for (let y = hipY; y <= baseY - 2; y++) {
    const k = (y - hipY) / (baseY - 2 - hipY);
    const px0 = x + dx * k;
    pix.hline(Math.round(px0 - 1), Math.round(px0 + 1), y, trouser);
  }
  pix.ellipse(x + dx, baseY - 1, 2, 1.4, boot);
}

function drawArm(pix, x, shoulderY, dx, colour, skin) {
  const endY = shoulderY + 9;
  for (let y = shoulderY + 1; y <= endY; y++) {
    const k = (y - shoulderY - 1) / (endY - shoulderY - 1);
    const px0 = x + dx * 0.7 * k;
    pix.hline(Math.round(px0 - 1), Math.round(px0 + 1), y, colour);
  }
  pix.disc(x + dx * 0.7, endY + 1, 1.4, skin[1]);
}

/**
 * The hair a hat cannot hide: a fringe under the brim and a band down each
 * temple to the jaw.
 *
 * Sized to be SEEN. The first attempt put two pixels at each temple, which was
 * anatomically about right and visually useless — the five hair colours were
 * indistinguishable on every view but the one from behind, so a menu offered a
 * choice that changed nothing. A brim sits at about `cy - 2.5` with a vertical
 * radius of 1.9, so `cy - 0.5` downward is what survives it; the hat is also
 * raised half a pixel in `drawHat` to open the fringe line.
 */
function drawTemples(pix, cx, cy, side, dir, hair) {
  const x = Math.round(cx);
  const y = Math.round(cy);

  if (dir === 'N') {
    // From behind the whole back of the head is hair; this is the part of it
    // below the brim, so it wants to be generous.
    pix.hline(x - 4, x + 4, y - 1, hair[1]);
    pix.hline(x - 4, x + 4, y, hair[1]);
    pix.hline(x - 3, x + 3, y + 1, hair[0]);
    return;
  }

  if (side) {
    // Sideburn down the cheek, plus the nape behind the ear.
    pix.vline(x - 4, y - 1, y + 2, hair[1]);
    pix.vline(x - 3, y - 1, y + 1, hair[2]);
    pix.px(x - 2, y - 1, hair[1]);
    return;
  }

  // Fringe across the forehead, then down both temples.
  pix.hline(x - 3, x + 3, y - 1, hair[1]);
  pix.vline(x - 4, y - 1, y + 1, hair[1]);
  pix.vline(x + 4, y - 1, y + 1, hair[0]);
  pix.px(x - 3, y, hair[2]);
  pix.px(x + 3, y, hair[0]);
}

/**
 * Hair below the brim.
 *
 * Drawn before the face so the features sit on top of it, and kept off the
 * cheeks from the side — hair over the eye at this scale just reads as a smudge.
 */
function drawLongHair(pix, cx, cy, side, dir, hair) {
  if (dir === 'N') {
    // From behind it is the whole back of the head, so it can be generous.
    pix.ellipse(cx, cy + 3.4, 4.2, 3.6, hair[1]);
    pix.ellipse(cx - 1, cy + 2.6, 2.4, 2.4, hair[2]);
    return;
  }
  if (side) {
    pix.ellipse(cx - 3.4, cy + 2.2, 2.0, 3.0, hair[1]);
    pix.px(cx - 4, cy + 4, hair[0]);
    return;
  }
  pix.ellipse(cx - 4.2, cy + 1.4, 1.5, 3.0, hair[1]);
  pix.ellipse(cx + 4.2, cy + 1.4, 1.5, 3.0, hair[0]);
}

/**
 * A field hat. Nobody surveys a pasture bare-headed — but the brim has to stay
 * narrower than the shoulders, or the sprite reads as a sombrero on legs and
 * the face disappears under it.
 *
 * `style` carries the shape (`brim`, `crown`, `cap`) and the two ramps, so a
 * boné and a chapéu de palha are the same eight calls with different numbers
 * rather than four near-identical painters.
 */
function drawHat(pix, cx, brimY, side, style) {
  const R = style.ramp;
  const band = style.band;
  const brimR = side ? style.brim - 1.2 : style.brim;
  const dx = side ? 0.5 : 0;

  if (style.cap) {
    // A peak instead of a brim: forward only, and nothing behind.
    pix.ellipse(cx + dx, brimY - 1.2, 3.4, style.crown, R[1]);
    pix.ellipse(cx - 1, brimY - 2, 1.9, 1.3, R[2]);
    pix.ellipse(cx + dx, brimY + 0.8, brimR, 1.3, R[0]);
    pix.hline(Math.round(cx - 3), Math.round(cx + 3), brimY - 0.4, band[1]);
    return;
  }

  pix.ellipse(cx + dx, brimY + 1, brimR, 1.9, R[1]);
  pix.ellipse(cx - 1, brimY + 0.6, brimR - 1.6, 1.2, R[2]);
  pix.ellipse(cx + dx, brimY - 1.4, 3.2, style.crown, R[1]);
  pix.ellipse(cx - 1, brimY - 2.2, 1.8, 1.3, R[2]);
  pix.ellipse(cx + dx, brimY - 0.2, 3.2, 1, band[1]);
}

/** The bastão with the prism on top, carried at the side. */
function drawPole(pix, x, baseY, topY) {
  pix.vline(Math.round(x), topY + 3, baseY - 1, P.metal[1]);
  pix.vline(Math.round(x) + 1, topY + 3, baseY - 1, P.metal[0]);
  pix.ellipse(x, topY + 1.5, 2.2, 2.0, P.metal[0]);
  pix.ellipse(x, topY + 1.5, 1.4, 1.3, P.prism[1]);
  pix.px(Math.round(x), Math.round(topY), P.prism[2]);
}

/**
 * Crouched at the tribrach. Shown while a station is being set up, because a
 * surveyor standing bolt upright next to a levelled instrument looks wrong to
 * anyone who has ever done it.
 *
 * @param {boolean} idle  the top of a breath. This is the pose the player looks
 *        at for most of a job — every sight is taken from it — so it is the one
 *        that most needed to stop being a photograph. The folded legs and the
 *        hand on the screws stay put; only the back and head rise.
 */
function kneeling(pix, cx, idle = false, L = resolveLook({})) {
  const baseY = 32;
  const lift = idle ? 1 : 0;
  contactShadow(pix, cx, baseY + 1, 8, 2.5);

  // Folded legs. Planted: a breath does not move the knees.
  pix.fill(cx - 6, baseY - 6, 12, 5, L.trousers[1]);
  pix.hline(cx - 6, cx + 5, baseY - 6, L.trousers[2]);
  pix.ellipse(cx - 5, baseY - 1, 2.6, 1.8, L.boots[1]);
  pix.ellipse(cx + 4, baseY - 1, 2.6, 1.8, L.boots[0]);

  // Leaning forward over the instrument. The top of the back rises with the
  // breath while the hips stay folded, so the spine straightens a little.
  for (let y = baseY - 16 - lift; y <= baseY - 6; y++) {
    const k = (y - (baseY - 16 - lift)) / (10 + lift);
    const hw = 4.5 + k * 1.5;
    pix.hline(Math.round(cx - hw + 1), Math.round(cx + hw + 1), y, L.shirt[1]);
    pix.px(Math.round(cx - hw + 1), y, L.shirt[2]);
  }
  pix.fill(cx - 2, baseY - 15 - lift, 6, 7 + lift, L.vest[1]);
  pix.hline(cx - 2, cx + 3, baseY - 12, L.vest[2]);

  // Arm reaching to the tribrach screws. The hand stays ON the screws — it is
  // holding something — so only the shoulder end travels.
  pix.line(cx + 3, baseY - 14 - lift, cx + 8, baseY - 9, L.shirt[2]);
  pix.disc(cx + 8, baseY - 9, 1.4, L.skin[1]);

  const headCy = baseY - 20 - lift;
  pix.disc(cx + 1, headCy, 4.6, L.skin[1]);
  pix.disc(cx, headCy - 1, 2.6, L.skin[2]);
  if (L.body === 'f') drawLongHair(pix, cx + 1, headCy, true, 'E', L.hair);
  pix.px(cx + 3, headCy + 1, '#2b2b2b');
  drawHat(pix, cx + 1, headCy - 3.5, true, L.hat);

  pix.outline('auto', { amount: 0.46 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}
