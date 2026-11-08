// 2D distortion map (canvas): heatmap on the (e, n) grid at terrain level, marching-squares
// isolines, building footprints, the central meridian, optional displacement arrows, a
// colourbar and a hover readout. Text uses text tokens; colour only encodes the metric.
import { niceTicks } from './colors.mjs';

const INK = { primary: '#f0efec', secondary: '#c3c2b7', muted: '#8f8e86', grid: 'rgba(240,239,236,0.14)', iso: 'rgba(250,250,245,0.5)' };
const FONT = '12px system-ui, -apple-system, "Segoe UI", sans-serif';

export const metricValue = (fields, metric, i) => fields[metric][i];

function fmt(v, digits = 2) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? Math.min(1, digits) : digits;
  return v.toFixed(d).replace('-', '−');
}
export const formatValue = fmt;

/** Vertical colourbar into a canvas; ticks in display units. */
export function drawColorbar(canvas, scale, { factor = 1, unit = '', ticks, levels = [], format = fmt } = {}) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 70, h = canvas.clientHeight || 200;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const top = 16, bottom = h - 8, barW = 12, x0 = 4;
  const lo = scale.min * factor, hi = scale.max * factor;
  for (let y = top; y < bottom; y++) {
    const v = hi - (y - top) / (bottom - top) * (hi - lo);
    const [r, gg, b] = scale.color(v / factor);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(x0, y, barW, 1.5);
  }
  g.font = FONT; g.textBaseline = 'middle';
  g.fillStyle = INK.secondary;
  g.fillText(unit, x0, 7);
  const yOf = v => top + (hi - v) / (hi - lo || 1) * (bottom - top);
  g.strokeStyle = INK.iso; g.lineWidth = 1;
  for (const v of levels) { const y = yOf(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + barW, y); g.stroke(); }
  g.fillStyle = INK.primary;
  for (const v of ticks || niceTicks(lo, hi, 4)) {
    const y = yOf(v);
    if (y < top - 1 || y > bottom + 1) continue;
    g.fillRect(x0 + barW, y - 0.5, 4, 1);
    g.fillText(format(v), x0 + barW + 7, y);
  }
}

/** Marching squares: segments [x1,y1,x2,y2] in grid index space for one level. */
export function isoSegments(values, nx, ny, level) {
  const segs = [];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = values[j * nx + i], v1 = values[j * nx + i + 1], v2 = values[(j + 1) * nx + i + 1], v3 = values[(j + 1) * nx + i];
    if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
    const c = (v0 > level) | ((v1 > level) << 1) | ((v2 > level) << 2) | ((v3 > level) << 3);
    if (c === 0 || c === 15) continue;
    const pts = {
      b: [i + lerp(v0, v1), j], r: [i + 1, j + lerp(v1, v2)],
      t: [i + lerp(v3, v2), j + 1], l: [i, j + lerp(v0, v3)],
    };
    const T = {
      1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['r', 't'], 5: ['l', 't', 'b', 'r'], 6: ['b', 't'], 7: ['l', 't'],
      8: ['t', 'l'], 9: ['t', 'b'], 10: ['b', 'l', 't', 'r'], 11: ['t', 'r'], 12: ['r', 'l'], 13: ['r', 'b'], 14: ['b', 'l'],
    }[c];
    for (let k = 0; k < T.length; k += 2) segs.push([...pts[T[k]], ...pts[T[k + 1]]]);
  }
  return segs;
}

export class DistortionChart {
  constructor(canvas, { readout, onHover, t = k => k, format = fmt } = {}) {
    this.canvas = canvas;
    this.format = (...a) => format(...a);
    this.readout = readout;
    this.onHover = onHover;
    this.t = t;
    this.hover = null;
    canvas.addEventListener('pointermove', e => this.pointer(e));
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.draw(); this.renderReadout(); });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  setData({ grid, buildings, context, params }) {
    Object.assign(this, { grid, buildings, context, params });
    this.cache = null;
    this.draw();
    this.renderReadout();
  }

  setScale(metric, scale, unit) {
    Object.assign(this, { metric, scale, unit });
    this.cache = null;
    this.draw();
    this.renderReadout();
  }

  layout() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const m = { l: 54, r: 92, t: 14, b: 40 };
    const aw = w - m.l - m.r, ah = h - m.t - m.b;
    const { spanWE, spanNS } = this.grid;
    const s = Math.min(aw / spanWE, ah / spanNS);
    const pw = spanWE * s, ph = spanNS * s;
    const x0 = m.l + (aw - pw) / 2, y0 = m.t + (ah - ph) / 2;
    return { w, h, x0, y0, pw, ph, s, cb: { x: x0 + pw + 14, y: m.t, h: ah } };
  }

  toPx(L, e, n) { return [L.x0 + (e + this.grid.spanWE / 2) * L.s, L.y0 + (this.grid.spanNS / 2 - n) * L.s]; }

  buildCache() {
    const { grid, metric, scale, unit } = this;
    const { nx, ny, fields } = grid;
    const img = makeCanvas(nx, ny);
    const g = img.getContext('2d');
    const data = g.createImageData(nx, ny);
    const values = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, v = metricValue(fields, metric, k);
      values[k] = v * unit.factor;
      const [r, gg, b] = scale.color(v);
      const p = 4 * ((ny - 1 - j) * nx + i);
      data.data[p] = r; data.data[p + 1] = gg; data.data[p + 2] = b; data.data[p + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    let lo = Infinity, hi = -Infinity;
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const levels = hi > lo ? niceTicks(lo, hi, 7).filter(v => v > lo && v < hi) : [];
    const iso = levels.map(level => ({ level, segs: isoSegments(values, nx, ny, level) }));
    // central meridian crossing (lon - cm changes sign along a row)
    const cm = [];
    if (this.context) for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) {
      const a = fields.lon[j * nx + i] - this.context.cm, b = fields.lon[j * nx + i + 1] - this.context.cm;
      if (a <= 0 && b > 0) cm.push([i + a / (a - b), j]);
    }
    this.cache = { img, levels, iso, cm, values };
  }

  draw() {
    const c = this.canvas;
    if (!this.grid || !this.scale || !c.clientWidth) return;
    if (!this.cache) this.buildCache();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const L = this.layout();
    c.width = Math.round(L.w * dpr); c.height = Math.round(L.h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    const { nx, ny, spanWE, spanNS } = this.grid;
    g.imageSmoothingEnabled = true;
    g.drawImage(this.cache.img, L.x0, L.y0, L.pw, L.ph);
    const gx = i => L.x0 + i / (nx - 1) * L.pw, gy = j => L.y0 + L.ph - j / (ny - 1) * L.ph;
    // isolines
    g.strokeStyle = INK.iso; g.lineWidth = 1;
    g.beginPath();
    for (const { segs } of this.cache.iso) for (const [a, b, cc, d] of segs) { g.moveTo(gx(a), gy(b)); g.lineTo(gx(cc), gy(d)); }
    g.stroke();
    // building footprints (true size)
    g.strokeStyle = 'rgba(17,21,23,0.85)'; g.lineWidth = 1.5;
    for (const b of this.buildings || []) {
      const [x, y] = this.toPx(L, b.e - b.size / 2, b.n + b.size / 2);
      g.strokeRect(x, y, Math.max(1, b.size * L.s), Math.max(1, b.size * L.s));
    }
    // central meridian
    if (this.cache.cm.length > 1) {
      g.save(); g.setLineDash([6, 4]); g.strokeStyle = INK.primary; g.lineWidth = 1.5;
      g.beginPath();
      this.cache.cm.forEach(([i, j], k) => (k ? g.lineTo(gx(i), gy(j)) : g.moveTo(gx(i), gy(j))));
      g.stroke(); g.restore();
      const [i, j] = this.cache.cm[this.cache.cm.length - 1];
      g.font = FONT; g.fillStyle = INK.primary; g.textBaseline = 'top';
      g.fillText(this.t('cmShort'), gx(i) + 4, gy(j) + 2);
    }
    // displacement arrows (horizontal metric)
    if (this.metric === 'dh') this.drawArrows(g, L);
    // frame + axes
    g.strokeStyle = INK.grid; g.lineWidth = 1; g.strokeRect(L.x0, L.y0, L.pw, L.ph);
    const km = Math.max(spanWE, spanNS) >= 2000, f = km ? 1e-3 : 1;
    g.font = FONT; g.fillStyle = INK.secondary;
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const v of niceTicks(-spanWE / 2 * f, spanWE / 2 * f, Math.max(2, Math.round(L.pw / 80)))) {
      const x = L.x0 + (v / f + spanWE / 2) * L.s;
      g.fillRect(x, L.y0 + L.ph, 1, 4);
      g.fillText(this.format(v, 1), x, L.y0 + L.ph + 6);
    }
    g.fillText(`${this.t('axisE')} (${km ? 'km' : 'm'})`, L.x0 + L.pw / 2, L.y0 + L.ph + 22);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of niceTicks(-spanNS / 2 * f, spanNS / 2 * f, Math.max(2, Math.round(L.ph / 60)))) {
      const y = L.y0 + (spanNS / 2 - v / f) * L.s;
      g.fillRect(L.x0 - 4, y, 4, 1);
      g.fillText(this.format(v, 1), L.x0 - 7, y);
    }
    g.save(); g.translate(14, L.y0 + L.ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.fillText(`${this.t('axisN')} (${km ? 'km' : 'm'})`, 0, 0); g.restore();
    g.textAlign = 'left';
    // colourbar
    this.drawBar(g, L);
    // hover crosshair
    if (this.hover) {
      const [x, y] = [gx(this.hover.i), gy(this.hover.j)];
      g.strokeStyle = INK.primary; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, L.y0); g.lineTo(x, L.y0 + L.ph); g.moveTo(L.x0, y); g.lineTo(L.x0 + L.pw, y); g.stroke();
      g.fillStyle = '#111517'; g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = INK.primary; g.lineWidth = 2; g.stroke();
    }
  }

  drawArrows(g, L) {
    const { nx, ny, fields } = this.grid;
    const n = 9, cell = Math.min(L.pw, L.ph) / n;
    let max = 0;
    for (let k = 0; k < fields.dh.length; k++) max = Math.max(max, fields.dh[k]);
    if (!(max > 0)) return;
    g.strokeStyle = INK.primary; g.fillStyle = INK.primary; g.lineWidth = 1.25;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const i = Math.round((a + 0.5) / n * (nx - 1)), j = Math.round((b + 0.5) / n * (ny - 1)), k = j * nx + i;
      const len = fields.dh[k] / max * cell * 0.8;
      if (len < 6) continue;
      const ang = Math.atan2(fields.dy[k], fields.dx[k]);
      const x = L.x0 + i / (nx - 1) * L.pw, y = L.y0 + L.ph - j / (ny - 1) * L.ph;
      const x2 = x + len * Math.cos(ang), y2 = y - len * Math.sin(ang);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.beginPath(); g.moveTo(x2, y2);
      g.lineTo(x2 - 5 * Math.cos(ang - 0.45), y2 + 5 * Math.sin(ang - 0.45));
      g.lineTo(x2 - 5 * Math.cos(ang + 0.45), y2 + 5 * Math.sin(ang + 0.45));
      g.closePath(); g.fill();
    }
  }

  drawBar(g, L) {
    const { scale, unit } = this, x0 = L.cb.x, top = L.cb.y + 18, bottom = L.cb.y + L.cb.h, barW = 12;
    const lo = scale.min * unit.factor, hi = scale.max * unit.factor;
    for (let y = top; y < bottom; y++) {
      const v = hi - (y - top) / (bottom - top) * (hi - lo);
      const [r, gg, b] = scale.color(v / unit.factor);
      g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(x0, y, barW, 1.5);
    }
    g.font = FONT; g.textBaseline = 'middle'; g.fillStyle = INK.secondary; g.textAlign = 'left';
    g.fillText(unit.unit, x0, L.cb.y + 6);
    const yOf = v => top + (hi - v) / (hi - lo || 1) * (bottom - top);
    g.strokeStyle = INK.iso;
    for (const v of this.cache.levels) { const y = yOf(v); if (y >= top && y <= bottom) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + barW, y); g.stroke(); } }
    g.fillStyle = INK.primary;
    for (const v of niceTicks(lo, hi, Math.max(3, Math.round((bottom - top) / 45)))) {
      const y = yOf(v);
      if (y < top - 1 || y > bottom + 1) continue;
      g.fillRect(x0 + barW, y - 0.5, 4, 1);
      g.fillText(this.format(v), x0 + barW + 7, y);
    }
  }

  pointer(e) {
    if (!this.grid) return;
    const r = this.canvas.getBoundingClientRect(), L = this.layout();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < L.x0 || x > L.x0 + L.pw || y < L.y0 || y > L.y0 + L.ph) {
      if (this.hover) { this.hover = null; this.draw(); this.renderReadout(); }
      return;
    }
    const { nx, ny } = this.grid;
    const i = Math.round((x - L.x0) / L.pw * (nx - 1)), j = Math.round((L.y0 + L.ph - y) / L.ph * (ny - 1));
    this.hover = { i, j, k: j * nx + i };
    this.draw();
    this.renderReadout();
  }

  /** Readout for the hovered node, or for the centre when nothing is hovered. */
  renderReadout() {
    if (!this.readout || !this.grid || !this.unit) return;
    const { nx, ny, fields, spanWE, spanNS } = this.grid;
    const k = this.hover ? this.hover.k : Math.floor(ny / 2) * nx + Math.floor(nx / 2);
    const i = k % nx, j = Math.floor(k / nx);
    const e = -spanWE / 2 + i * spanWE / (nx - 1), n = -spanNS / 2 + j * spanNS / (ny - 1);
    const v = metricValue(fields, this.metric, k) * this.unit.factor;
    this.onHover?.({ k, e, n, value: v });
    const t = this.t, f = this.format, fx = (x, d) => f(x, d, d);
    const rows = [
      [this.hover ? t('readHere') : t('readCentre'), `e = ${fx(e, 1)} m, n = ${fx(n, 1)} m`],
      [t(`metric_${this.metric}`), `${f(v)} ${this.unit.unit}`],
      ['φ, λ', `${fx(fields.lat[k], 5)}°, ${fx(fields.lon[k], 5)}°`],
      ['k', fx(fields.k[k], 8)],
      [t('efShort'), fx(fields.ef[k], 8)],
      ['γ', `${fx(fields.gamma[k], 4)}°`],
      [t('geoidN'), Number.isFinite(fields.geoidN[k]) ? `${fx(fields.geoidN[k], 3)} m` : t('geoidOff')],
    ];
    this.readout.innerHTML = rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  }
}

// OffscreenCanvas when available (workers, modern browsers), else a detached <canvas>
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
