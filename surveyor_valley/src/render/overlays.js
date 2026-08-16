// Everything drawn on top of the world to explain the survey.
//
// This layer is where the game teaches. The tripod disc turns red before you
// waste a setup, the sight line flashes at the branch that blocked it, and the
// traverse you have built so far is always visible as a figure rather than a
// list of numbers in a panel.

import { formatDMS } from '../survey/units.js';
import { azimuth, distance } from '../survey/geometry.js';

const COL = {
  ok: '#3f9d52',
  marginal: '#e0a52e',
  bad: '#cf3f34',
  sight: '#2f6fb5',
  blocked: '#cf3f34',
  traverse: '#d9622b',
  label: '#1f2a33',
  labelBg: 'rgba(255,255,255,0.86)',
};

export function makeOverlays({ camera }) {
  /** Transient red flashes for blocked sights: {from, to, at, until}. */
  let flashes = [];

  function flashBlocked(from, to, at) {
    flashes.push({ from, to, at, until: performance.now() + 2000 });
  }

  function label(ctx, text, x, y, { anchor = 'center', size = 12, bold = false } = {}) {
    ctx.save();
    ctx.font = `${bold ? '700 ' : ''}${size}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = anchor;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    const padX = 5;
    const left = anchor === 'center' ? x - w / 2 : anchor === 'right' ? x - w : x;
    ctx.fillStyle = COL.labelBg;
    ctx.beginPath();
    ctx.roundRect(left - padX, y - size * 0.72, w + padX * 2, size * 1.45, 4);
    ctx.fill();
    ctx.fillStyle = COL.label;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * The one-metre tripod disc, shown continuously while the setup tool is live
   * so the answer arrives before the click, not after it.
   */
  function drawTripodDisc(ctx, check, e, n) {
    const c = camera.worldToScreen(e, n);
    const r = 1.0 * camera.zoom;
    const colour = !check.ok ? COL.bad : check.marginal ? COL.marginal : COL.ok;

    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();

    // The individual ring samples, so a failure points at where the ground is bad.
    for (const s of check.ring || []) {
      if (s.ring === 0) continue;
      const p = camera.worldToScreen(s.e, s.n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = s.ok ? COL.ok : COL.bad;
      ctx.fill();
    }
    ctx.restore();
  }

  /** The traverse built so far, drawn as the closed figure it is trying to be. */
  function drawTraverse(ctx, setups) {
    if (setups.length < 2) return;
    ctx.save();
    ctx.strokeStyle = COL.traverse;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    setups.forEach((s, i) => {
      const p = camera.worldToScreen(s.E ?? s.e, s.N ?? s.n);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    for (const s of setups) {
      const p = camera.worldToScreen(s.E ?? s.e, s.N ?? s.n);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 7);
      ctx.lineTo(p.x + 6, p.y + 5);
      ctx.lineTo(p.x - 6, p.y + 5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = COL.traverse;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Sight lines already recorded from the current setup. */
  function drawSights(ctx, station, observations) {
    if (!station) return;
    const from = camera.worldToScreen(station.E, station.N);
    ctx.save();
    ctx.strokeStyle = COL.sight;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    for (const o of observations) {
      const p = camera.worldToScreen(o.E, o.N);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The live sight to whatever the cursor is over, with its numbers. */
  function drawAim(ctx, station, target, los, lang) {
    if (!station || !target) return;
    const a = camera.worldToScreen(station.E, station.N);
    const b = camera.worldToScreen(target.e, target.n);
    const clear = los?.clear !== false;

    ctx.save();
    ctx.strokeStyle = clear ? COL.sight : COL.blocked;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(clear ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reticle on the target.
    ctx.strokeStyle = clear ? COL.sight : COL.blocked;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
    ctx.moveTo(b.x - 16, b.y);
    ctx.lineTo(b.x - 5, b.y);
    ctx.moveTo(b.x + 5, b.y);
    ctx.lineTo(b.x + 16, b.y);
    ctx.moveTo(b.x, b.y - 16);
    ctx.lineTo(b.x, b.y - 5);
    ctx.moveTo(b.x, b.y + 5);
    ctx.lineTo(b.x, b.y + 16);
    ctx.stroke();

    if (!clear && los.blockers.length) {
      const hit = camera.worldToScreen(los.blockers[0].at[0], los.blockers[0].at[1]);
      ctx.fillStyle = COL.blocked;
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Live readout: the numbers the instrument would give, before committing.
    const d = distance(station.E, station.N, target.e, target.n);
    const az = azimuth(station.E, station.N, target.e, target.n);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const txt = `${d.toFixed(2)} m · ${formatDMS(az)}`;
    label(ctx, txt, mid.x, mid.y - 14, { size: 12, bold: true });
    if (target.label) label(ctx, target.label, b.x, b.y - 26, { size: 12 });
    void lang;
  }

  /** Marks worth naming on screen: player monuments and surveyed corners. */
  function drawPointLabels(ctx, world, network, showAll) {
    if (camera.zoom < 8) return;
    ctx.save();
    for (const cp of network) {
      const ent = world.entity(`marco-${cp.id}`);
      const e = ent ? ent.e : cp.trueE;
      const n = ent ? ent.n : cp.trueN;
      const p = camera.worldToScreen(e, n);
      label(ctx, cp.label, p.x, p.y - 26, { size: 12, bold: true });
    }
    if (showAll) {
      for (const ent of world.entities) {
        if (ent.targetKind !== 'divisa' || ent.hidden) continue;
        const p = camera.worldToScreen(ent.e, ent.n);
        label(ctx, ent.label || '', p.x, p.y - 22, { size: 11 });
      }
    }
    ctx.restore();
  }

  function drawFlashes(ctx) {
    const now = performance.now();
    flashes = flashes.filter((f) => f.until > now);
    ctx.save();
    for (const f of flashes) {
      const alpha = Math.min(1, (f.until - now) / 600);
      ctx.globalAlpha = alpha;
      const a = camera.worldToScreen(f.from.e ?? f.from.E, f.from.n ?? f.from.N);
      const b = camera.worldToScreen(f.to.e ?? f.to.E, f.to.n ?? f.to.N);
      ctx.strokeStyle = COL.blocked;
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (f.at) {
        const h = camera.worldToScreen(f.at[0], f.at[1]);
        ctx.fillStyle = COL.blocked;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** North arrow and a scale bar, bottom-left, so the view is always readable. */
  function drawCompassAndScale(ctx) {
    const x = 26;
    const y = camera.vh - 30;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = 'rgba(31,42,51,0.5)';
    ctx.lineWidth = 1;

    // North arrow.
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(x + 7, y - 30);
    ctx.lineTo(x, y - 34);
    ctx.lineTo(x - 7, y - 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1f2a33';
    ctx.font = '700 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y - 52);

    // Scale bar: a round number of metres, sized to the current zoom.
    const targets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    const wanted = 110 / camera.zoom;
    const metres = targets.find((t) => t >= wanted) || 500;
    const px = metres * camera.zoom;

    ctx.strokeStyle = '#1f2a33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.moveTo(x + px, y - 5);
    ctx.lineTo(x + px, y + 5);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Inter", system-ui, sans-serif';
    ctx.fillText(`${metres} m`, x + px / 2, y + 15);
    ctx.restore();
  }

  function draw(ctx, view) {
    const { world, station, observations = [], setups = [], aim, tripodCheck, player, network = [], lang, showCornerLabels } = view;
    if (!world) return;

    if (tripodCheck) drawTripodDisc(ctx, tripodCheck.check, tripodCheck.e, tripodCheck.n);
    drawTraverse(ctx, setups);
    drawSights(ctx, station, observations);
    drawFlashes(ctx);
    if (aim) drawAim(ctx, station, aim.target, aim.los, lang);
    drawPointLabels(ctx, world, network, showCornerLabels);
    drawCompassAndScale(ctx);
    void player;
  }

  return { draw, flashBlocked };
}
