// 2D view in the sheet frame (x right, y up): the reference grid, residual vectors of the
// control points, discrepancies of the check and excluded points, TS-only points, injunction
// edges, and a rose ring around the points that the outlier detection flagged. Before the
// adjustment (result = null) it shows which reference points the total station collected.
import { theme, toMm } from '../ui.mjs';

const MARGIN = 34;

export class SheetView {
  constructor(canvas, tooltip) {
    this.canvas = canvas; this.tip = tooltip; this.ctx = canvas.getContext('2d');
    this.opts = { vecScale: 200, auto: true, labels: true, edges: true };
    this.currentK = 1;
    this.data = null; this.hit = []; this.onToggle = null;
    canvas.addEventListener('mousemove', e => this._hover(e));
    canvas.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    canvas.addEventListener('click', e => { const h = this._nearest(e); if (h && this.onToggle && (h.p.role === 'control' || h.p.role === 'check')) this.onToggle(h.p.name, h.p.role === 'control'); });
    new ResizeObserver(() => this.draw()).observe(canvas.parentElement);
  }

  // extra: { flagged: Set of names, excluded: { name: true } } (the second one before an adjustment)
  setData(dataset, result, labels, extra = {}) { this.data = { dataset, result, labels, flagged: extra.flagged || new Set(), excluded: extra.excluded || {} }; this.draw(); }
  setOptions(o) { Object.assign(this.opts, o); this.draw(); }

  _pos(p) {
    if (p.role === 'tsOnly') return [p.sheet[0], p.sheet[1]];
    const r = this.data.dataset.ref[p.e];
    return [r.x, r.y];
  }

  // points to draw: the result's, or (before an adjustment) the reference marked collected / not
  _points() {
    const { dataset, result, excluded } = this.data;
    if (result?.ok) return result.points.map(p => ({ p, xy: this._pos(p) }));
    const seen = new Set(dataset.ts.map(q => q.name));
    return dataset.ref.map((r, e) => ({ p: { name: r.name, e, role: !seen.has(r.name) ? 'uncollected' : excluded[r.name] ? 'excluded' : 'collected' }, xy: [r.x, r.y] }));
  }

  draw() {
    const c = this.canvas, box = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1, W = Math.max(200, box.width), H = Math.max(240, box.height);
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = theme(); ctx.clearRect(0, 0, W, H);
    this.hit = [];
    if (!this.data) return;
    const { dataset, result, labels, flagged } = this.data;
    const refs = dataset.ref, xs = refs.map(p => p.x), ys = refs.map(p => p.y);
    const pts = this._points();
    const allx = [...xs, ...pts.map(q => q.xy[0])], ally = [...ys, ...pts.map(q => q.xy[1])];
    const x0 = Math.min(...allx), x1 = Math.max(...allx), y0 = Math.min(...ally), y1 = Math.max(...ally);
    const s = Math.min((W - 2 * MARGIN) / (x1 - x0 || 1), (H - 2 * MARGIN) / (y1 - y0 || 1));
    const ox = (W - s * (x1 - x0)) / 2 - s * x0, oy = (H + s * (y1 - y0)) / 2 + s * y0;
    const X = x => ox + s * x, Y = y => oy - s * y;

    // sheet frame and grid lines
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    ctx.strokeRect(X(x0), Y(y1), s * (x1 - x0), s * (y1 - y0));
    const cols = new Set(refs.map(p => p.x)), rows = new Set(refs.map(p => p.y));
    if (cols.size < 30 && rows.size < 30) {
      ctx.beginPath();
      cols.forEach(x => { ctx.moveTo(X(x), Y(y0)); ctx.lineTo(X(x), Y(y1)); });
      rows.forEach(y => { ctx.moveTo(X(x0), Y(y)); ctx.lineTo(X(x1), Y(y)); });
      ctx.stroke();
    }

    // injunction edges
    if (result?.ok && this.opts.edges && result.injInfo.rows?.length) {
      const pos = new Map(pts.map(q => [q.p.name, q.xy]));
      ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
      ctx.beginPath();
      result.injInfo.rows.forEach(r => { const a = pos.get(r.a), b = pos.get(r.b); if (a && b) { ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); } });
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // residual vectors (in-plane part of the sheet-frame difference, exaggerated)
    const k = result?.ok ? (this.opts.auto ? this._autoK(pts, xs) : this.opts.vecScale) : 1;
    this.currentK = k;
    if (result?.ok) {
      pts.forEach(({ p, xy }) => {
        if (!p.sheetDiff || !['control', 'check', 'excluded'].includes(p.role)) return;
        const dx = p.sheetDiff[0] * k, dy = p.sheetDiff[1] * k;
        ctx.strokeStyle = th[p.role]; ctx.lineWidth = 1.8;
        if (p.role === 'excluded') ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(X(xy[0]), Y(xy[1])); ctx.lineTo(X(xy[0] + dx), Y(xy[1] + dy)); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // points
    pts.forEach(({ p, xy }) => {
      const px = X(xy[0]), py = Y(xy[1]);
      ctx.lineWidth = 2;
      if (p.role === 'control') { ctx.fillStyle = th.control; ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill(); }
      else if (p.role === 'collected') { ctx.fillStyle = th.muted; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill(); }
      else if (p.role === 'check') { ctx.fillStyle = th.check; ctx.beginPath(); ctx.moveTo(px, py - 5.5); ctx.lineTo(px + 5.5, py); ctx.lineTo(px, py + 5.5); ctx.lineTo(px - 5.5, py); ctx.closePath(); ctx.fill(); }
      else if (p.role === 'excluded') { ctx.strokeStyle = th.excluded; ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4); ctx.stroke(); }
      else if (p.role === 'uncollected') { ctx.strokeStyle = th.uncollected; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.stroke(); }
      else { ctx.fillStyle = th.tsOnly; ctx.globalAlpha = p.inactive ? 0.4 : 1; ctx.fillRect(px - 4.5, py - 4.5, 9, 9); ctx.globalAlpha = 1; }
      if (flagged.has(p.name)) { ctx.strokeStyle = th.flag; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.stroke(); }
      this.hit.push({ p, px, py });
      if (this.opts.labels && (refs.length <= 80 || p.role === 'tsOnly')) {
        ctx.fillStyle = th.muted; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText(p.name, px + 6, py - 6);
      }
    });

    // scale bar of the residual vectors: 0.1 mm of residual drawn at the exaggeration
    if (result?.ok) {
      const mmInRef = 1e-3 / (result.refUnitM ?? 0.01);
      const bar = 0.1 * mmInRef * k * s;
      if (bar > 6 && bar < W * 0.6) {
        const bx = 14, by = H - 16;
        ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.stroke();
        ctx.fillStyle = th.ink; ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText(labels.scale.replace('{mm}', '0.1').replace('{k}', String(k)), bx + bar + 8, by + 4);
      }
    } else if (labels.waiting) {
      ctx.fillStyle = th.muted; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillText(labels.waiting, 14, H - 12);
    }
  }

  // exaggeration that makes the typical in-plane vector about 40 % of the grid spacing (1-2-5 steps)
  _autoK(pts, xs) {
    const mags = pts.filter(q => q.p.sheetDiff && (q.p.role === 'control' || q.p.role === 'check')).map(q => Math.hypot(q.p.sheetDiff[0], q.p.sheetDiff[1])).sort((a, b) => a - b);
    const u = [...new Set(xs)].sort((a, b) => a - b);
    let gap = Infinity; for (let i = 1; i < u.length; i++) gap = Math.min(gap, u[i] - u[i - 1]);
    const med = mags[Math.floor(mags.length / 2)];
    if (!(med > 0) || !Number.isFinite(gap)) return 1;
    const raw = 0.4 * gap / med, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return Math.max(1, (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p);
  }

  _nearest(e) {
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 12 * 12;
    for (const h of this.hit) { const d = (h.px - x) ** 2 + (h.py - y) ** 2; if (d < bd) { bd = d; best = h; } }
    return best;
  }

  _hover(e) {
    const h = this._nearest(e);
    if (!h) { this.tip.hidden = true; return; }
    const { dataset, labels, flagged } = this.data, p = h.p, u = dataset.refUnit;
    const lines = [`<strong>${p.name}</strong> · ${labels.role[p.role] ?? ''}`];
    if (p.sheetDiff) lines.push(`${labels.inPlane}: ${toMm(Math.hypot(p.sheetDiff[0], p.sheetDiff[1]), u).toFixed(3)} mm`, `${labels.normal}: ${toMm(p.sheetDiff[2], u).toFixed(3)} mm`);
    if (p.role === 'tsOnly') lines.push(`z<sub>S</sub> = ${toMm(p.sheet[2], u).toFixed(3)} ± ${toMm(p.sheetSigma[2], u).toFixed(3)} mm`);
    if (flagged.has(p.name)) lines.push(`<span style="color:#fda4af">${labels.flagged}</span>`);
    if (p.role === 'control' || p.role === 'check') lines.push(labels.clickHint);
    this.tip.innerHTML = lines.join('<br>');
    this.tip.hidden = false;
    const r = this.canvas.getBoundingClientRect();
    this.tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 180)}px`;
    this.tip.style.top = `${Math.max(e.clientY - r.top - 10, 4)}px`;
  }
}
