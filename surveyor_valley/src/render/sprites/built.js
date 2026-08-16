// What people put on the land.
//
// Buildings are the one sprite whose size is not known until the world is
// generated, so this painter is called at world-build time with the real
// footprint and registered with the atlas as a one-off. There are six of them,
// so the cost is nothing and the alternative — a fixed sprite stretched to fit
// — would put the roof pitch at a different angle on every farm.
//
// The view is three-quarter from the south, matching everything else: you see
// the roof, and a strip of the front wall below it.

import { makePix, contactShadow, P, shadeOf } from './shared.js';
import { PX_PER_M } from '../pixbuf.js';

/**
 * A farmhouse or shed.
 * @param {object} rng
 * @param {{wm:number, hm:number, variant?:number}} p  footprint in metres
 * @returns {{pix:object, anchorX:number, anchorY:number}}  anchored on the
 *          footprint CENTRE, so it lands exactly on the entity's coordinates.
 */
export function building(rng, { wm, hm, variant = 0 }) {
  const fw = Math.max(24, Math.round(wm * PX_PER_M));
  const fh = Math.max(20, Math.round(hm * PX_PER_M));
  const wallPx = Math.round(1.35 * PX_PER_M); // the front wall we can see
  const eave = 4;

  const W = fw + eave * 2;
  const H = fh + wallPx + eave;
  const pix = makePix(W, H);

  const left = eave;
  const right = eave + fw - 1;
  const roofTop = eave;
  const roofBot = eave + fh - 1;
  const wallTop = roofBot + 1;
  const wallBot = wallTop + wallPx - 1;

  // A house gets terracotta, a shed gets zinc. Reaching for the neutral rock
  // ramp for the second one made every barn look like a concrete bunker.
  const roof = variant % 2 === 0 ? P.roof : P.roofZinc;

  contactShadow(pix, W / 2, wallBot + 1, fw * 0.5, 4);

  // ---- front wall ---------------------------------------------------------
  pix.fill(left + 2, wallTop, fw - 4, wallPx, P.wall[1]);
  pix.hline(left + 2, right - 2, wallBot, P.wallShade[0]);
  pix.vline(right - 2, wallTop, wallBot, P.wallShade[1]);

  // Door, centred, and a window either side if there is room.
  const dx = Math.round(W / 2);
  const doorW = 7;
  pix.fill(dx - Math.floor(doorW / 2), wallBot - wallPx + 4, doorW, wallPx - 4, P.woodDark[1]);
  pix.vline(dx - Math.floor(doorW / 2), wallBot - wallPx + 4, wallBot, P.woodDark[2]);
  pix.px(dx + 1, wallBot - Math.round(wallPx / 2), P.instrumentTrim[1]);

  if (fw > 70) {
    for (const wx of [left + Math.round(fw * 0.2), left + Math.round(fw * 0.78)]) {
      pix.fill(wx - 4, wallTop + 4, 8, 7, P.lens[0]);
      pix.fill(wx - 3, wallTop + 5, 6, 5, P.lens[1]);
      pix.hline(wx - 3, wx + 2, wallTop + 5, P.lens[2]);
      pix.rect(wx - 4, wallTop + 4, 8, 7, P.wood[0]);
    }
  }

  // ---- roof ---------------------------------------------------------------
  // The ridge runs along the LONGER axis, the way a real roof does.
  const ridgeHorizontal = fw >= fh;
  const shadeRoof = shadeOf(roof[1], 0.3);

  if (ridgeHorizontal) {
    const ridgeY = roofTop + Math.round(fh / 2);
    // The far slope tips away from the light and the near slope catches it, so
    // the ridge reads as a fold rather than as a drawn line.
    pix.fill(0, roofTop, W, ridgeY - roofTop + 1, roof[0]);
    pix.fill(0, ridgeY, W, roofBot - ridgeY + 1, roof[1]);
    pix.hline(0, W - 1, ridgeY - 1, roof[2]);
    pix.hline(0, W - 1, ridgeY, roof[2]);
    // Tile courses, and a rafter line every few courses.
    for (let y = roofTop + 3; y < roofBot; y += 4) {
      if (y === ridgeY || y === ridgeY - 1) continue;
      pix.hline(0, W - 1, y, shadeRoof, 0.42);
    }
    for (let x = 5; x < W; x += 9) pix.vline(x, roofTop, roofBot, shadeRoof, 0.18);
  } else {
    const ridgeX = left + Math.round(fw / 2);
    pix.fill(0, roofTop, ridgeX, roofBot - roofTop + 1, roof[0]);
    pix.fill(ridgeX, roofTop, W - ridgeX, roofBot - roofTop + 1, roof[1]);
    pix.vline(ridgeX - 1, roofTop, roofBot, roof[2]);
    pix.vline(ridgeX, roofTop, roofBot, roof[2]);
    for (let x = 3; x < W; x += 4) {
      if (x === ridgeX || x === ridgeX - 1) continue;
      pix.vline(x, roofTop, roofBot, shadeRoof, 0.42);
    }
    for (let y = roofTop + 5; y < roofBot; y += 9) pix.hline(0, W - 1, y, shadeRoof, 0.18);
  }

  // Eaves: a darker lip all round, which is what makes the roof overhang.
  pix.hline(0, W - 1, roofTop, shadeRoof);
  pix.hline(0, W - 1, roofBot, shadeRoof);
  pix.vline(0, roofTop, roofBot, shadeRoof);
  pix.vline(W - 1, roofTop, roofBot, shadeRoof);

  // Eave shadow on the wall, which is what makes the roof sit ON the building.
  pix.fill(left + 2, wallTop, fw - 4, 2, P.wallShade[0], 0.55);

  // Chimney, on the houses.
  if (variant % 2 === 0) {
    const chx = left + Math.round(fw * 0.72);
    pix.fill(chx, roofTop - 3, 6, 9, P.rock[1]);
    pix.hline(chx, chx + 5, roofTop - 3, P.rock[2]);
    pix.hline(chx, chx + 5, roofTop - 1, P.rock[0]);
  }

  pix.outline('auto', { amount: 0.45 });
  void rng;

  return {
    pix,
    anchorX: 0.5,
    // Land the FOOTPRINT centre on the entity coordinate.
    anchorY: (roofTop + fh / 2) / H,
  };
}
