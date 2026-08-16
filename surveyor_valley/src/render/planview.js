// The plan view.
//
// Zoomed right out, sprites are noise and what the player actually wants is a
// map: where the parcels are, where their control is, what the traverse looks
// like as a figure. So below `PLAN_MODE_ZOOM` the Pixi world is hidden and this
// draws on the overlay canvas instead.
//
// The soil raster is baked ONCE for the whole valley, at one pixel per metre,
// and blitted thereafter. Phase 1 re-sampled about eight thousand soil points
// and issued eight thousand `fillRect` calls every single frame here — which is
// why the overview, of all things, was the slowest screen in the game.

import { KIND } from '../world/entities.js';

const WATER_ONLY = false;

export function makePlanView({ camera }) {
  let raster = null;
  let rasterFor = null;

  /** One pixel per metre of the whole world. 640x640 is 1.6 MB and instant. */
  function bake(world) {
    const b = world.bounds;
    const w = Math.ceil(b.maxE - b.minE);
    const h = Math.ceil(b.maxN - b.minN);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let j = 0; j < h; j++) {
      // Canvas rows run north to south.
      const n = b.maxN - j - 0.5;
      for (let i = 0; i < w; i++) {
        const soil = world.terrain.soilAt(b.minE + i + 0.5, n);
        if (WATER_ONLY && soil.walkable) continue;
        const hex = parseInt(soil.color.slice(1), 16);
        const p = (j * w + i) * 4;
        data[p] = (hex >> 16) & 255;
        data[p + 1] = (hex >> 8) & 255;
        data[p + 2] = hex & 255;
        data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    raster = canvas;
    rasterFor = world;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx  already transformed to CSS pixels
   */
  function draw(ctx, { world, player, activeParcelId, network = [], setups = [] }) {
    if (!world) return;
    if (rasterFor !== world) bake(world);

    const b = world.bounds;
    const tl = camera.worldToScreen(b.minE, b.maxN);
    const w = (b.maxE - b.minE) * camera.zoom;
    const h = (b.maxN - b.minN) * camera.zoom;

    ctx.save();
    ctx.fillStyle = '#59713f';
    ctx.fillRect(0, 0, camera.vw, camera.vh);

    // Smoothing ON here, unlike the field view: at 4-8 px/m this is a map, and
    // a map wants soft class boundaries, not visible metre squares.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(raster, tl.x, tl.y, w, h);

    // ---- parcels ----------------------------------------------------------
    ctx.lineJoin = 'round';
    for (const parcel of world.parcels) {
      const active = parcel.id === activeParcelId;
      ctx.beginPath();
      parcel.vertices.forEach((v, i) => {
        const p = camera.worldToScreen(v.e, v.n);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      if (active) {
        ctx.fillStyle = 'rgba(242, 193, 78, 0.16)';
        ctx.fill();
      }
      ctx.strokeStyle = active ? '#d9622b' : 'rgba(38, 30, 18, 0.55)';
      ctx.lineWidth = active ? 2.5 : 1.2;
      ctx.setLineDash(active ? [] : [6, 4]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ---- the traverse so far ----------------------------------------------
    if (setups.length >= 2) {
      ctx.beginPath();
      setups.forEach((s, i) => {
        const p = camera.worldToScreen(s.E ?? s.e, s.N ?? s.n);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = '#d9622b';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- monuments --------------------------------------------------------
    const known = new Set(network.filter((cp) => cp.E != null).map((cp) => cp.id));
    for (const ent of world.entities) {
      if (ent.kind !== KIND.MARCO_JOGADOR && ent.kind !== KIND.MARCO_DIVISA) continue;
      const p = camera.worldToScreen(ent.e, ent.n);
      const mine = ent.kind === KIND.MARCO_JOGADOR;
      const surveyed = mine && known.has(ent.label);

      ctx.beginPath();
      ctx.arc(p.x, p.y, mine ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = mine ? (surveyed ? '#f2c14e' : '#d9622b') : '#3f5b7a';
      ctx.fill();
      if (mine) {
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // ---- the player -------------------------------------------------------
    const p = camera.worldToScreen(player.e, player.n);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#23281f';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  return {
    draw,
    invalidate() {
      raster = null;
      rasterFor = null;
    },
  };
}
