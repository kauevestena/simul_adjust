// One texture, one batch.
//
// Every sprite in the game is packed into a single canvas and uploaded once.
// That is the actual reason to be on a GPU renderer: Pixi can draw ten thousand
// sprites in one draw call as long as they all share a texture, and the moment
// they do not, it silently breaks the batch and the win evaporates.
//
// Filtering is nearest everywhere, and the zoom ladder is integer-only, so a
// 16-pixel-per-metre sprite lands on exact pixel boundaries at every rung. That
// is what keeps the art crisp instead of the soft mush that comes from scaling
// pixel art by 1.37.

import { PX_PER_M } from './pixbuf.js';
import { buildSprites } from './sprites/index.js';
import { pixi } from './pixi.js';

const SHEET_W = 1024;
const GAP = 1;

/** Copy a pixel buffer into a bigger RGBA array at (dx, dy). */
function blitInto(dst, dstW, pix, dx, dy) {
  for (let y = 0; y < pix.h; y++) {
    const so = y * pix.w * 4;
    const doff = ((dy + y) * dstW + dx) * 4;
    dst.set(pix.data.subarray(so, so + pix.w * 4), doff);
  }
}

export function makeAtlas() {
  /** key -> {texture, w, h, ax, ay, wm, hm} — sizes in BASE pixels. */
  const frames = new Map();
  /** Textures created outside the sheet (buildings), so they can be freed. */
  const dynamic = new Map();

  let sheetSource = null;
  let sheetCanvas = null;
  let built = false;

  /**
   * Paint every sprite, shelf-pack it, and upload.
   *
   * Synchronous apart from the texture upload — no data-URI round trip, no
   * image decode, nothing to await. Phase 1 waited on 75 `<img>` loads at boot.
   *
   * Callable more than once, which it had to become the moment the player got
   * to choose a face: the sheet is baked with that choice in it, so a second
   * campaign started with a different look would otherwise keep the first one's
   * sprites forever. The old sheet is destroyed first — leaving it uploaded
   * would leak a texture per new game.
   *
   * @param {object} [look]  the player's appearance.
   */
  function build(look = null) {
    const PIXI = pixi();
    if (built) {
      sheetSource?.destroy();
      sheetSource = null;
      // Dynamic entries live outside the sheet and are re-added by the world
      // build that follows, so they go too.
      for (const { source } of dynamic.values()) source.destroy();
      dynamic.clear();
      frames.clear();
      built = false;
    }
    const sprites = buildSprites(look);

    // Tallest first, so shelves pack tightly.
    const order = [...sprites].sort((a, b) => b.pix.h - a.pix.h);

    let x = GAP;
    let y = GAP;
    let shelfH = 0;
    const placed = [];

    for (const s of order) {
      if (x + s.pix.w + GAP > SHEET_W) {
        x = GAP;
        y += shelfH + GAP;
        shelfH = 0;
      }
      placed.push({ ...s, x, y });
      x += s.pix.w + GAP;
      if (s.pix.h > shelfH) shelfH = s.pix.h;
    }
    const sheetH = y + shelfH + GAP;

    const data = new Uint8ClampedArray(SHEET_W * sheetH * 4);
    for (const p of placed) blitInto(data, SHEET_W, p.pix, p.x, p.y);

    sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = SHEET_W;
    sheetCanvas.height = sheetH;
    const ctx = sheetCanvas.getContext('2d');
    ctx.putImageData(new ImageData(data, SHEET_W, sheetH), 0, 0);

    sheetSource = new PIXI.CanvasSource({
      resource: sheetCanvas,
      scaleMode: 'nearest',
      autoGenerateMipmaps: false,
      alphaMode: 'premultiply-alpha-on-upload',
    });

    for (const p of placed) {
      frames.set(p.key, {
        texture: new PIXI.Texture({
          source: sheetSource,
          frame: new PIXI.Rectangle(p.x, p.y, p.pix.w, p.pix.h),
        }),
        w: p.pix.w,
        h: p.pix.h,
        ax: p.anchorX,
        ay: p.anchorY,
        wm: p.pix.w / PX_PER_M,
        hm: p.pix.h / PX_PER_M,
      });
    }

    built = true;
    return { count: frames.size, sheet: [SHEET_W, sheetH] };
  }

  /**
   * A one-off texture outside the sheet.
   *
   * Buildings only: their footprint is not known until the world is generated,
   * and there are six of them. Each one breaks the batch, which is precisely
   * why this is not the general path.
   */
  function addDynamic(key, pix, anchorX = 0.5, anchorY = 1) {
    const PIXI = pixi();
    if (dynamic.has(key)) dynamic.get(key).source.destroy();

    const canvas = document.createElement('canvas');
    canvas.width = pix.w;
    canvas.height = pix.h;
    canvas
      .getContext('2d')
      .putImageData(new ImageData(new Uint8ClampedArray(pix.data), pix.w, pix.h), 0, 0);

    const source = new PIXI.CanvasSource({
      resource: canvas,
      scaleMode: 'nearest',
      autoGenerateMipmaps: false,
      alphaMode: 'premultiply-alpha-on-upload',
    });
    const texture = new PIXI.Texture({ source });
    dynamic.set(key, { source, texture });

    frames.set(key, {
      texture,
      w: pix.w,
      h: pix.h,
      ax: anchorX,
      ay: anchorY,
      wm: pix.w / PX_PER_M,
      hm: pix.h / PX_PER_M,
    });
    return frames.get(key);
  }

  return {
    build,
    addDynamic,
    get: (key) => frames.get(key) || null,
    has: (key) => frames.has(key),
    /** The packed sheet, for a debug view. */
    get canvas() {
      return sheetCanvas;
    },
    get ready() {
      return built;
    },
    get count() {
      return frames.size;
    },
    destroy() {
      for (const { source } of dynamic.values()) source.destroy();
      dynamic.clear();
      sheetSource?.destroy();
      frames.clear();
      built = false;
    },
  };
}
