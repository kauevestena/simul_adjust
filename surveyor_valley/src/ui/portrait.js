// Painting a person into the DOM.
//
// Straight from `sprites/character.js` rather than through the atlas: the
// painter returns a plain pixel buffer, the atlas may not exist yet — the
// intro runs before any world is built — and a canvas in a panel needs no GPU.
// Nearest-neighbour at a whole-number scale, because the whole game's art
// depends on never scaling pixel art by a fraction.
//
// Shared by the character chooser and by the payment screen, so the crops are
// defined once. Two copies of "where is the head in this sprite" would drift
// the moment the sprite changed, and the second copy would be the one nobody
// remembered to move.

import { surveyor } from '../render/sprites/character.js';

/**
 * The crops, in sprite pixels, measured off the frame rather than guessed: the
 * hat crown starts at row 0, the brim spans rows 2-4 and x 5-19, the face runs
 * to row 11 and the shoulders begin at row 13.
 *
 * HEAD is what skin, hair and hat are choices about, and it takes two rows of
 * shoulder so the head has something to sit on instead of floating. BUST
 * reaches the hips, because the body choice is a silhouette — the reversed
 * shoulder-to-hip taper and the long hair under the brim — and neither of those
 * reads in a crop that stops at the chin.
 *
 * `y: -1` buys a row of margin above the tallest crown. A source rectangle
 * reaching outside the image is transparent, which is exactly what is wanted:
 * without it the cap sits flush against the frame and looks cropped.
 */
export const HEAD = { x: 4, y: -1, w: 16, h: 16 };
export const BUST = { x: 3, y: -1, w: 18, h: 23 };

/** Whole-number scale, or the pixel art stops being pixel art. */
export const MINI = 3;

/**
 * Paint a standing figure into a canvas, optionally cropped to a portrait.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} look  a resolved look, or a plain {body, skin, hair, hat}
 * @param {{x:number,y:number,w:number,h:number}} [crop]
 */
export function paintSurveyor(canvas, look, crop = null) {
  const { pix } = surveyor({ dir: 'S', pose: 'idle', look });
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const off = document.createElement('canvas');
  off.width = pix.w;
  off.height = pix.h;
  off.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.data), pix.w, pix.h), 0, 0);

  const c = crop || { x: 0, y: 0, w: pix.w, h: pix.h };
  ctx.drawImage(off, c.x, c.y, c.w, c.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}
