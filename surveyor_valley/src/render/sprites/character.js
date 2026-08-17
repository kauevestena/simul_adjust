// The surveyor.
//
// The one sprite the player looks at for an hour, so it gets the most care per
// pixel. Sixteen frames (four directions x four walk phases) are *computed*
// from a limb-swing parameter rather than drawn sixteen times; west is east
// mirrored, which is both cheaper and guarantees the two agree.
//
// Wardrobe is not decoration. A hi-vis vest is what a field surveyor actually
// wears, and it makes the player the most saturated thing on a green screen —
// so you never lose yourself in a pasture full of scrub.

import { makePix, contactShadow, P } from './shared.js';

const W = 24;
const H = 34;

/**
 * @param {{dir?:'S'|'N'|'E', frame?:number, pose?:'walk'|'kneel'|'idle'}} opts
 *        West is produced by mirroring East in the roster.
 *
 *        `idle` is the top of a breath: the pose a standing surveyor alternates
 *        with walk frame 0. A person at rest is never a photograph, and one
 *        drawn as a photograph reads as a bug in the game rather than as
 *        stillness.
 */
export function surveyor({ dir = 'S', frame = 0, pose = 'walk' } = {}) {
  const pix = makePix(W, H);
  const cx = W / 2;

  if (pose === 'kneel') return kneeling(pix, cx, false);
  if (pose === 'kneel-idle') return kneeling(pix, cx, true);

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

  // Hands drift a little away from the body at the top of the breath. `drawArm`
  // travels 70% of what it is given, so this is well under a pixel at the
  // shoulder and about one at the hand — a settle, not a swing.
  const armIdle = idle ? 1.4 : 0;

  contactShadow(pix, cx, baseY + 1, 7, 2.5);

  // ---- legs: the far one first, so the near one overlaps it ---------------
  const legDx = side ? 1.5 : 2.6;
  drawLeg(pix, cx - legDx, hipY, baseY, -swing, P.trousers[0], P.boots[0]);
  drawLeg(pix, cx + legDx, hipY, baseY, swing, P.trousers[1], P.boots[1]);

  // ---- far arm -----------------------------------------------------------
  // Outside the torso silhouette, or it simply vanishes behind it.
  const armDx = side ? 2 : 6.5;
  drawArm(pix, cx - armDx, shoulderY, -swing - armIdle, P.shirt[0]);

  // ---- torso -------------------------------------------------------------
  const halfTop = side ? 3.5 : 5;
  const halfBot = side ? 3 : 4.2;
  for (let y = shoulderY; y <= hipY; y++) {
    const k = (y - shoulderY) / (hipY - shoulderY);
    const hw = halfTop + (halfBot - halfTop) * k;
    pix.hline(Math.round(cx - hw), Math.round(cx + hw), y, P.shirt[1]);
    pix.px(Math.round(cx - hw), y, P.shirt[2]);
    pix.px(Math.round(cx + hw), y, P.shirt[0]);
  }

  // Hi-vis vest: two panels with the shirt showing between them, and one
  // reflective band. A solid yellow slab reads as a sandwich board.
  const vestTop = shoulderY + 1;
  const vestBot = hipY - 1;
  const vw = side ? 2 : 3;
  for (let y = vestTop; y <= vestBot; y++) {
    if (side) {
      pix.hline(cx - vw + 1, cx + vw - 1, y, P.vest[1]);
      pix.px(cx - vw + 1, y, P.vest[2]);
    } else {
      pix.vline(cx - vw, vestTop, vestBot, P.vest[1]);
      pix.vline(cx - vw + 1, vestTop, vestBot, P.vest[2]);
      pix.vline(cx + vw - 1, vestTop, vestBot, P.vest[1]);
      pix.vline(cx + vw, vestTop, vestBot, P.vest[0]);
    }
  }
  const bandY = vestTop + 4;
  pix.hline(cx - vw, cx + vw, bandY, P.vest[2]);
  pix.hline(cx - vw, cx + vw, bandY + 1, P.vest[0]);

  // ---- near arm ----------------------------------------------------------
  drawArm(pix, cx + armDx, shoulderY, swing + armIdle, P.shirt[2]);

  // ---- head --------------------------------------------------------------
  const headX = side ? cx + 1 : cx;
  pix.disc(headX, headCy, 4.6, P.skin[1]);
  pix.disc(headX - 1.4, headCy - 1.4, 2.6, P.skin[2]);
  pix.ellipse(headX + 2, headCy + 1.8, 1.8, 1.6, P.skin[0]);

  if (dir === 'N') {
    // Away from us: all hair, no face.
    pix.ellipse(headX, headCy - 0.5, 4.6, 4.2, P.hair[1]);
    pix.ellipse(headX - 1.4, headCy - 2, 2.6, 1.8, P.hair[2]);
  } else if (side) {
    pix.px(headX + 2, headCy, '#2b2b2b');
    pix.ellipse(headX - 2.8, headCy - 1, 2.2, 2.6, P.hair[1]);
    // A hint of a jaw line.
    pix.px(headX + 4, headCy + 2, P.skin[0]);
  } else {
    pix.px(headX - 2, headCy, '#2b2b2b');
    pix.px(headX + 2, headCy, '#2b2b2b');
    pix.hline(headX - 1, headX + 1, headCy + 3, P.skin[0]);
    pix.ellipse(headX, headCy - 3.2, 4.4, 1.8, P.hair[1]);
  }

  drawHat(pix, headX, headCy - 3.5, side);

  pix.outline('auto', { amount: 0.46 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}

function drawLeg(pix, x, hipY, baseY, dx, trouser, boot) {
  for (let y = hipY; y <= baseY - 2; y++) {
    const k = (y - hipY) / (baseY - 2 - hipY);
    const px0 = x + dx * k;
    pix.hline(Math.round(px0 - 1), Math.round(px0 + 1), y, trouser);
  }
  pix.ellipse(x + dx, baseY - 1, 2, 1.4, boot);
}

function drawArm(pix, x, shoulderY, dx, colour) {
  const endY = shoulderY + 9;
  for (let y = shoulderY + 1; y <= endY; y++) {
    const k = (y - shoulderY - 1) / (endY - shoulderY - 1);
    const px0 = x + dx * 0.7 * k;
    pix.hline(Math.round(px0 - 1), Math.round(px0 + 1), y, colour);
  }
  pix.disc(x + dx * 0.7, endY + 1, 1.4, P.skin[1]);
}

/**
 * A field hat. Nobody surveys a pasture bare-headed — but the brim has to stay
 * narrower than the shoulders, or the sprite reads as a sombrero on legs and
 * the face disappears under it.
 */
function drawHat(pix, cx, brimY, side) {
  const brimR = side ? 5 : 6.2;
  pix.ellipse(cx + (side ? 0.5 : 0), brimY + 1, brimR, 1.9, P.hat[1]);
  pix.ellipse(cx - 1, brimY + 0.6, brimR - 1.6, 1.2, P.hat[2]);
  pix.ellipse(cx + (side ? 0.5 : 0), brimY - 1.4, 3.2, 2.3, P.hat[1]);
  pix.ellipse(cx - 1, brimY - 2.2, 1.8, 1.3, P.hat[2]);
  pix.ellipse(cx + (side ? 0.5 : 0), brimY - 0.2, 3.2, 1, P.hatBand[1]);
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
function kneeling(pix, cx, idle = false) {
  const baseY = 32;
  const lift = idle ? 1 : 0;
  contactShadow(pix, cx, baseY + 1, 8, 2.5);

  // Folded legs. Planted: a breath does not move the knees.
  pix.fill(cx - 6, baseY - 6, 12, 5, P.trousers[1]);
  pix.hline(cx - 6, cx + 5, baseY - 6, P.trousers[2]);
  pix.ellipse(cx - 5, baseY - 1, 2.6, 1.8, P.boots[1]);
  pix.ellipse(cx + 4, baseY - 1, 2.6, 1.8, P.boots[0]);

  // Leaning forward over the instrument. The top of the back rises with the
  // breath while the hips stay folded, so the spine straightens a little.
  for (let y = baseY - 16 - lift; y <= baseY - 6; y++) {
    const k = (y - (baseY - 16 - lift)) / (10 + lift);
    const hw = 4.5 + k * 1.5;
    pix.hline(Math.round(cx - hw + 1), Math.round(cx + hw + 1), y, P.shirt[1]);
    pix.px(Math.round(cx - hw + 1), y, P.shirt[2]);
  }
  pix.fill(cx - 2, baseY - 15 - lift, 6, 7 + lift, P.vest[1]);
  pix.hline(cx - 2, cx + 3, baseY - 12, P.vest[2]);

  // Arm reaching to the tribrach screws. The hand stays ON the screws — it is
  // holding something — so only the shoulder end travels.
  pix.line(cx + 3, baseY - 14 - lift, cx + 8, baseY - 9, P.shirt[2]);
  pix.disc(cx + 8, baseY - 9, 1.4, P.skin[1]);

  const headCy = baseY - 20 - lift;
  pix.disc(cx + 1, headCy, 4.6, P.skin[1]);
  pix.disc(cx, headCy - 1, 2.6, P.skin[2]);
  pix.px(cx + 3, headCy + 1, '#2b2b2b');
  drawHat(pix, cx + 1, headCy - 3.5, true);

  pix.outline('auto', { amount: 0.46 });
  return { pix, anchorX: 0.5, anchorY: (baseY + 1) / H };
}
