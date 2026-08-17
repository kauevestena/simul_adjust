// Everything drawn on top of the world to explain the survey.
//
// This layer is where the game teaches. The tripod disc turns red before you
// waste a setup, the sight line flashes at the branch that blocked it, and the
// traverse you have built so far is always visible as a figure rather than a
// list of numbers in a panel.

import { formatAngle, fmtMetres, DEG } from '../survey/units.js';
import { aimReadout, circleDial } from '../survey/readout.js';
import { t, angleFormat } from '../ui/i18n.js';

const COL = {
  ok: '#3f9d52',
  marginal: '#e0a52e',
  bad: '#cf3f34',
  sight: '#2f6fb5',
  blocked: '#cf3f34',
  traverse: '#d9622b',
  label: '#1f2a33',
  labelBg: 'rgba(255,255,255,0.86)',
  panel: 'rgba(247,234,208,0.94)',
  panelEdge: '#5c3a1a',
  ink: '#3b2a16',
  inkSoft: '#6b5334',
};

/** Angles here honour the player's unit choice, exactly like every panel does. */
const fmtAngle = (deg) => formatAngle(deg, angleFormat());

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

  /**
   * Where a thing is on the MAP.
   *
   * The camera works in world metres, but every surveyed coordinate — a
   * setup's `E/N`, an observation's reduced position — lives in the surveyed
   * datum, which is born at an arbitrary (1000, 1000) and therefore sits about
   * a kilometre from the valley. Feeding surveyed coordinates straight to
   * `worldToScreen` draws them far off the edge of the screen, which is exactly
   * what the traverse, the recorded sights and the aim line all used to do:
   * they were never wrong, they were never visible.
   *
   * Anything drawn on this canvas goes through here first.
   */
  const onMap = (o) => camera.worldToScreen(o.trueE ?? o.e, o.trueN ?? o.n);

  /** The traverse built so far, drawn as the closed figure it is trying to be. */
  function drawTraverse(ctx, setups) {
    if (setups.length < 2) return;
    ctx.save();
    ctx.strokeStyle = COL.traverse;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    setups.forEach((s, i) => {
      const p = onMap(s);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    for (const s of setups) {
      const p = onMap(s);
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

  /**
   * The line to the ré.
   *
   * Every angle taken from this setup is measured FROM this direction, and
   * until now it was the only part of the geometry the game never showed — the
   * student could see the sights fanning out but not the thing they fan out
   * from. Dashed to say "this is a reference, not a measurement", and in the
   * same blue as the sights because it is the same instrument pointing.
   *
   * A free station is oriented by resection and has no ré at all, so there is
   * deliberately nothing to draw.
   */
  function drawBacksight(ctx, station, world, network) {
    if (!station || station.backsightId == null) return;

    const cp = network.find((p) => p.id === station.backsightId);
    const ent = world.entity(`marco-${station.backsightId}`);
    const be = ent ? ent.e : cp?.trueE;
    const bn = ent ? ent.n : cp?.trueN;
    if (be == null || bn == null) return;

    const a = onMap(station);
    const b = camera.worldToScreen(be, bn);

    ctx.save();
    ctx.strokeStyle = COL.sight;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    label(ctx, `${t('readout.re')} ${station.backsightId}`, mid.x, mid.y, { size: 11, bold: true });
  }

  /**
   * Sight lines already recorded from the current setup.
   *
   * Drawn to the target that was actually sighted rather than to the
   * observation's reduced `E/N`, which is a surveyed coordinate and so belongs
   * to the other datum. The reduced value is the right number for the field
   * book; it is not a place on this map.
   */
  function drawSights(ctx, station, observations, world) {
    if (!station) return;
    const from = onMap(station);
    ctx.save();
    ctx.strokeStyle = COL.sight;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    for (const o of observations) {
      const ent = world.entity(o.targetId);
      if (!ent) continue;
      const p = camera.worldToScreen(ent.e, ent.n);
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
    const a = onMap(station);
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
    // Through `formatAngle` and `fmtMetres`, not their raw equivalents — this
    // line used to call `formatDMS` and `toFixed(2)` directly, which left it
    // the one place in the game that ignored the gon toggle and printed a
    // decimal point at a pt-BR reader.
    const r = aimReadout(station, target.e, target.n);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    label(ctx, `${fmtMetres(r.distance, lang)} · ${fmtAngle(r.azimuth)}`, mid.x, mid.y - 14, { size: 12, bold: true });
    if (target.label) label(ctx, target.label, b.x, b.y - 26, { size: 12 });
  }

  /**
   * The instrument face, lower right.
   *
   * Shown only while actually aiming, which is the point: swinging the
   * telescope and watching the circle move is what turns `Az = Hz + θ0` from a
   * formula into one thing you can see. The angle from the ré is the row that
   * matters most — it is the number a student tabulates by hand, and it is
   * measured from the dashed line on screen.
   */
  function drawAimPanel(ctx, station, target, los, lang) {
    if (!station || !target) return;
    const r = aimReadout(station, target.e, target.n);
    const blocked = los?.clear === false;

    const rows = [];
    if (r.backsightId) rows.push([t('readout.backsight'), `${r.backsightId} · ${fmtAngle(r.backsightReading)}`]);
    rows.push([t('readout.target'), target.label || target.id]);
    rows.push([t('readout.hz'), fmtAngle(r.hz)]);
    if (r.fromBacksight != null) rows.push([t('readout.fromBacksight'), fmtAngle(r.fromBacksight)]);
    rows.push([t('readout.azimuth'), fmtAngle(r.azimuth)]);
    rows.push([t('readout.distance'), fmtMetres(r.distance, lang)]);

    const padX = 11;
    const padY = 9;
    const rowH = 17;
    const titleH = 19;
    const noteH = blocked ? 17 : 0;

    ctx.save();
    ctx.font = '600 11px "Inter", system-ui, sans-serif';
    let textW = 0;
    for (const [k, v] of rows) textW = Math.max(textW, ctx.measureText(k).width + ctx.measureText(v).width + 26);
    if (blocked) textW = Math.max(textW, ctx.measureText(t('readout.blocked')).width);

    const w = Math.min(Math.max(textW + padX * 2, 190), Math.max(160, camera.vw - 28));
    // The dial grows the panel UPWARD, because the panel is anchored by its
    // bottom edge — so it can never push down into the batch bar. On a short
    // window it is dropped rather than allowed to reach the checklist.
    const dial = circleDial(station, r);
    const dialR = Math.min(46, (w - padX * 2) / 2 - 16);
    const dialH = camera.vh > 470 ? dialR * 2 + 22 : 0;
    const h = titleH + dialH + rows.length * rowH + noteH + padY * 2;
    // Anchored to the corner. Bottom-centre already holds the batch bar and the
    // toasts, and bottom-left the scale bar; this corner is the free one — on a
    // wide screen. The batch bar is centred and roughly 420 px across, so on a
    // narrow one the panel has to step up over it rather than sit on top of it.
    const x = camera.vw - 14 - w;
    const barHalfWidth = 215;
    const clearsBar = x > camera.vw / 2 + barHalfWidth;
    const y = camera.vh - 14 - h - (clearsBar ? 0 : 58);

    ctx.fillStyle = COL.panel;
    ctx.strokeStyle = COL.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = blocked ? COL.blocked : COL.sight;
    ctx.font = '700 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t('readout.title'), x + padX, y + padY + titleH / 2);

    let ry = y + padY + titleH;
    if (dialH) {
      drawDial(ctx, x + w / 2, ry + dialH / 2 - 4, dialR, dial, blocked);
      ry += dialH;
    }
    for (const [k, v] of rows) {
      ctx.font = '600 11px "Inter", system-ui, sans-serif';
      ctx.fillStyle = COL.inkSoft;
      ctx.textAlign = 'left';
      ctx.fillText(k, x + padX, ry + rowH / 2);

      ctx.font = '700 12px ui-monospace, "SFMono-Regular", Menlo, monospace';
      ctx.fillStyle = COL.ink;
      ctx.textAlign = 'right';
      ctx.fillText(v, x + w - padX, ry + rowH / 2);
      ry += rowH;
    }

    if (blocked) {
      ctx.font = '700 11px "Inter", system-ui, sans-serif';
      ctx.fillStyle = COL.blocked;
      ctx.textAlign = 'left';
      ctx.fillText(t('readout.blocked'), x + padX, ry + noteH / 2);
    }
    ctx.restore();
  }

  /**
   * The horizontal circle, drawn.
   *
   * Zero at the top, clockwise — the instrument's own face rather than the map,
   * which is the whole reason it is worth drawing. The ré sits where the circle
   * actually reads it, so zeroing on the ré visibly puts it at twelve o'clock;
   * north sits wherever θ0 has pushed it. Seeing those two at once is seeing
   * `Az = Hz + θ0`.
   *
   * `circleDial` in `survey/readout.js` decides every bearing here; this
   * function only turns degrees into pixels.
   */
  function drawDial(ctx, cx, cy, r, dial, blocked) {
    // Bearing to canvas radians. Screen-up is always north because the camera
    // never rotates, so a dial drawn this way turns the same way as the map.
    const rad = (deg) => (deg - 90) * DEG;
    const ray = (deg, len) => ({ x: cx + Math.cos(rad(deg)) * len, y: cy + Math.sin(rad(deg)) * len });

    ctx.save();

    // The swept angle, shaded — the number the field book tabulates.
    if (dial.sweep != null) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, rad(dial.sweepFrom), rad(dial.sweepFrom + dial.sweep));
      ctx.closePath();
      ctx.fillStyle = blocked ? 'rgba(207,63,52,0.16)' : 'rgba(47,111,181,0.18)';
      ctx.fill();
    }

    // The circle, with a graduation every 30 degrees.
    ctx.strokeStyle = COL.inkSoft;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let a = 0; a < 360; a += 30) {
      const p0 = ray(a, r - (a % 90 === 0 ? 6 : 3));
      const p1 = ray(a, r);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // North, as the same arrowhead the map uses, just smaller.
    const nOut = ray(dial.north, r);
    const nIn = ray(dial.north, r - 9);
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nIn.x, nIn.y);
    ctx.lineTo(nOut.x, nOut.y);
    ctx.stroke();
    const nLabel = ray(dial.north, r + 9);
    ctx.fillStyle = COL.ink;
    ctx.font = '700 10px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nLabel.x, nLabel.y);

    // The ré: dashed, like the line to it on the map.
    if (dial.backsight != null) {
      const b = ray(dial.backsight, r);
      ctx.strokeStyle = COL.sight;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The target: solid, and red when the sight is obstructed, exactly as the
    // line on the map behaves.
    const tp = ray(dial.target, r);
    ctx.strokeStyle = blocked ? COL.blocked : COL.sight;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tp.x, tp.y);
    ctx.stroke();

    ctx.fillStyle = COL.panelEdge;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    // Before the sights, so recorded measurements layer over the reference.
    drawBacksight(ctx, station, world, network);
    drawSights(ctx, station, observations, world);
    drawFlashes(ctx);
    if (aim) drawAim(ctx, station, aim.target, aim.los, lang);
    drawPointLabels(ctx, world, network, showCornerLabels);
    drawCompassAndScale(ctx);
    if (aim) drawAimPanel(ctx, station, aim.target, aim.los, lang);
    void player;
  }

  return { draw, flashBlocked };
}
