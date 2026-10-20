// The plane fitted to the total-station points of the sheet, seen from the instrument (right,
// up): each point coloured by its signed distance to the plane (or by its w), an optional
// inverse-distance surface of those values, a colour bar, and a rose ring around the points
// whose |w| exceeds the critical value. Blue: behind the plane; red: in front (towards the station).
import { theme, toMm } from '../ui.mjs';

const MARGIN = 30;
const hex = s => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim()); if (!m) return [128, 128, 128]; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
const niceStep = raw => { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };

export class PlaneView {
  constructor(canvas, tooltip, bar) {
    this.canvas = canvas; this.tip = tooltip; this.bar = bar; this.ctx = canvas.getContext('2d');
    this.opts = { value: 'd', heat: true, labels: true };
    this.data = null; this.hit = [];
    canvas.addEventListener('mousemove', e => this._hover(e));
    canvas.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    new ResizeObserver(() => this.draw()).observe(canvas.parentElement);
  }

  setData(result, labels, extra = {}) { this.data = { result, labels, flagged: extra.flagged || new Set() }; this.draw(); }
  setOptions(o) { Object.assign(this.opts, o); this.draw(); }

  _value(q) { return this.opts.value === 'w' ? q.w : toMm(q.d, this.data.result.tsUnit); }

  _scale(t, th) {
    const neg = hex(th.neg), mid = hex(th.mid), pos = hex(th.pos), u = Math.max(-1, Math.min(1, t));
    return u < 0 ? mix(mid, neg, -u) : mix(mid, pos, u);
  }

  draw() {
    const c = this.canvas, box = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1, W = Math.max(200, box.width), H = Math.max(220, box.height);
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = theme(); ctx.clearRect(0, 0, W, H);
    this.hit = [];
    const plane = this.data?.result?.plane;
    if (!plane?.ok) {
      ctx.fillStyle = th.muted; ctx.font = '13px Inter, system-ui, sans-serif'; ctx.fillText(this.data?.labels.empty ?? '', MARGIN, H / 2);
      this._drawBar(null, th);
      return;
    }
    const { labels, flagged, result } = this.data, unit = result.tsUnit;
    const pts = plane.points, others = plane.others || [], all = [...pts, ...others];
    const vals = pts.map(q => this._value(q)).filter(Number.isFinite);
    let a = Math.max(...vals.map(Math.abs), 1e-12);
    if (this.opts.value === 'w') a = Math.max(a, plane.crit.w);
    const u0 = Math.min(...all.map(q => q.uv[0])), u1 = Math.max(...all.map(q => q.uv[0])), v0 = Math.min(...all.map(q => q.uv[1])), v1 = Math.max(...all.map(q => q.uv[1]));
    const s = Math.min((W - 2 * MARGIN) / (u1 - u0 || 1), (H - 2 * MARGIN - 14) / (v1 - v0 || 1));
    const ox = (W - s * (u1 - u0)) / 2 - s * u0, oy = (H - 14 + s * (v1 - v0)) / 2 + s * v0;
    const X = u => ox + s * u, Y = v => oy - s * v;

    // inverse-distance (power 2) surface of the values over the extent of the fitted points
    if (this.opts.heat && pts.length >= 3) {
      const pu0 = Math.min(...pts.map(q => q.uv[0])), pu1 = Math.max(...pts.map(q => q.uv[0])), pv0 = Math.min(...pts.map(q => q.uv[1])), pv1 = Math.max(...pts.map(q => q.uv[1]));
      const cell = 4, nx = Math.max(2, Math.ceil(s * (pu1 - pu0) / cell)), ny = Math.max(2, Math.ceil(s * (pv1 - pv0) / cell));
      const off = document.createElement('canvas'); off.width = nx; off.height = ny;
      const octx = off.getContext('2d'), img = octx.createImageData(nx, ny);
      const pv = pts.map(q => [q.uv[0], q.uv[1], this._value(q)]).filter(q => Number.isFinite(q[2]));
      const eps = Math.pow(1e-4 * (pu1 - pu0 + pv1 - pv0), 2);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const u = pu0 + (i + 0.5) / nx * (pu1 - pu0), v = pv1 - (j + 0.5) / ny * (pv1 - pv0);
        let sw = 0, sv = 0;
        for (const [qu, qv, val] of pv) { const d2 = (u - qu) ** 2 + (v - qv) ** 2 + eps, w = 1 / (d2 * d2); sw += w; sv += w * val; }
        const col = this._scale(sv / sw / a, th), k = 4 * (j * nx + i);
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 215;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, X(pu0), Y(pv1), s * (pu1 - pu0), s * (pv1 - pv0));
    }

    // excluded points (not in the fit): hollow, at their distance to the plane
    others.forEach(q => {
      const px = X(q.uv[0]), py = Y(q.uv[1]);
      ctx.strokeStyle = th.excluded; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      this.hit.push({ q, px, py, excluded: true });
      if (this.opts.labels) { ctx.fillStyle = th.muted; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText(q.name, px + 7, py - 6); }
    });
    // fitted points: colour = value, size grows with |value|
    pts.forEach(q => {
      const val = this._value(q), px = X(q.uv[0]), py = Y(q.uv[1]);
      const col = this._scale(val / a, th), r = 3.5 + 5 * Math.min(1, Math.abs(val) / a);
      ctx.fillStyle = `rgb(${col.join(',')})`; ctx.strokeStyle = th.ink; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.stroke();
      if (flagged.has(q.name) || Math.abs(q.w) > plane.crit.w) { ctx.strokeStyle = th.flag; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r + 4, 0, 7); ctx.stroke(); }
      this.hit.push({ q, px, py });
      if (this.opts.labels) { ctx.fillStyle = th.muted; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText(q.name, px + r + 2, py - r); }
    });

    // scale bar of the sheet (in mm or cm)
    const mmPerUnit = toMm(1, unit), lenMm = niceStep(0.25 * (u1 - u0) * mmPerUnit), bar = lenMm / mmPerUnit * s;
    if (bar > 10) {
      const bx = 14, by = H - 12;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(lenMm >= 10 ? `${lenMm / 10} cm` : `${lenMm} mm`, bx + bar + 8, by + 4);
    }
    ctx.fillStyle = th.muted; ctx.font = '11px Inter, system-ui, sans-serif';
    const tag = labels.view; ctx.fillText(tag, W - ctx.measureText(tag).width - 10, H - 8);
    this._drawBar(a, th);
  }

  // horizontal colour bar from −a to a with ticks
  _drawBar(a, th) {
    const b = this.bar; if (!b) return;
    const box = b.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(200, box.width), H = 44;
    b.width = W * dpr; b.height = H * dpr;
    const ctx = b.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!a) return;
    const l = 30, r = W - 30, y = 6, h = 12;
    for (let x = l; x <= r; x++) { const col = this._scale(((x - l) / (r - l)) * 2 - 1, th); ctx.fillStyle = `rgb(${col.join(',')})`; ctx.fillRect(x, y, 1.5, h); }
    ctx.strokeStyle = th.line; ctx.strokeRect(l, y, r - l, h);
    ctx.fillStyle = th.muted; ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
    const step = niceStep(a / 2), dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (let k = -Math.floor(a / step); k <= Math.floor(a / step); k++) {
      const x = l + (k * step / a + 1) / 2 * (r - l), s = (k * step).toFixed(dec);
      ctx.fillRect(x, y + h, 1, 4); ctx.fillText(s, x - 3.3 * s.length, y + h + 16);
    }
    const unitLabel = this.opts.value === 'w' ? 'w' : 'mm';
    ctx.fillText(unitLabel, r + 6, y + 10);
  }

  _hover(e) {
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 12 * 12;
    for (const h of this.hit) { const d = (h.px - x) ** 2 + (h.py - y) ** 2; if (d < bd) { bd = d; best = h; } }
    if (!best) { this.tip.hidden = true; return; }
    const { labels, result, flagged } = this.data, q = best.q, u = result.tsUnit, mm = v => toMm(v, u).toFixed(2);
    const lines = [`<strong>${q.name}</strong>${best.excluded ? ` · ${labels.excluded}` : ''}`, `d = ${mm(q.d)} mm (σ ${mm(q.sigmaD)} mm)`];
    if (!best.excluded) lines.push(`w = ${q.w.toFixed(2)} · r = ${q.r.toFixed(3)}`, `∇₀ = ${mm(q.mdb)} mm`);
    if (flagged.has(q.name)) lines.push(`<span style="color:#fda4af">${labels.flagged}</span>`);
    this.tip.innerHTML = lines.join('<br>');
    this.tip.hidden = false;
    this.tip.style.left = `${Math.min(x + 14, r.width - 180)}px`;
    this.tip.style.top = `${Math.max(y - 10, 4)}px`;
  }
}
