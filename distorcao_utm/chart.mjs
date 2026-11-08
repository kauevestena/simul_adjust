// 2D systematic-error map (canvas): one or two synchronized panels (small multiples) on the (e, n)
// grid. Panel 1 is the selected metric; optional panel 2 is the scalar 3D error |d| of the whole
// cloud (terrain, walls and roofs). Each panel has a heatmap, marching-squares isolines, building
// footprints, the central meridian and its own colourbar; hover shows a crosshair in both panels.
// Text uses text tokens; colour only encodes the data.
import { niceTicks } from './colors.mjs';

const INK = { primary: '#f0efec', secondary: '#c3c2b7', muted: '#8f8e86', grid: 'rgba(240,239,236,0.14)', iso: 'rgba(250,250,245,0.5)' };
const FONT = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
const BOLD = '600 12px system-ui, -apple-system, "Segoe UI", sans-serif';

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
  barInto(g, scale, { x: 4, top: 16, bottom: h - 8, factor, unit, ticks, levels, format, unitY: 7 });
}

function barInto(g, scale, { x, top, bottom, factor, unit, ticks, levels = [], format = fmt, unitY }) {
  const barW = 12, lo = scale.min * factor, hi = scale.max * factor;
  for (let y = top; y < bottom; y++) {
    const v = hi - (y - top) / (bottom - top) * (hi - lo);
    const [r, gg, b] = scale.color(v / factor);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(x, y, barW, 1.5);
  }
  g.font = FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = INK.secondary;
  g.fillText(unit, x, unitY);
  const yOf = v => top + (hi - v) / (hi - lo || 1) * (bottom - top);
  g.strokeStyle = INK.iso; g.lineWidth = 1;
  for (const v of levels) { const y = yOf(v); if (y >= top && y <= bottom) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + barW, y); g.stroke(); } }
  g.fillStyle = INK.primary;
  for (const v of ticks || niceTicks(lo, hi, Math.max(3, Math.round((bottom - top) / 45)))) {
    const y = yOf(v);
    if (y < top - 1 || y > bottom + 1) continue;
    g.fillRect(x + barW, y - 0.5, 4, 1);
    g.fillText(format(v), x + barW + 7, y);
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
    this.readout = readout;
    this.onHover = onHover;
    this.t = t;
    this.format = (...a) => format(...a);
    this.hover = null;
    this.panels = [null, null];   // { field, scale, unit, title, cache }
    canvas.addEventListener('pointermove', e => this.pointer(e));
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.draw(); this.renderReadout(); });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  setData({ grid, buildings, context, params }) {
    Object.assign(this, { grid, buildings, context, params });
    this.panels.forEach(p => { if (p) p.cache = null; });
    this.cmLine = null;
    this.draw();
    this.renderReadout();
  }

  /** Panel 1: the selected metric. */
  setScale(metric, scale, unit) {
    this.metric = metric;
    this.panels[0] = { field: metric, scale, unit, title: this.t(`metric_${metric}`) };
    this.draw();
    this.renderReadout();
  }

  /** Panel 2: scalar 3D error of the whole cloud ({ scale, unit }), or null to hide it. */
  setSecond(spec) {
    this.panels[1] = spec ? { field: 'd3cloud', ...spec, title: this.t('panel3dTitle') } : null;
    this.canvas.classList.toggle('two', Boolean(spec));
    this.draw();
    this.renderReadout();
  }

  get active() { return this.panels.filter(Boolean); }
  /** Isoline levels of panel 1 (shared with the 3D-view colourbar). */
  get cache() { return this.panels[0]?.cache; }

  /** Panel rectangles (CSS px): side by side when wide enough, stacked otherwise. */
  layout() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, n = this.active.length;
    const side = n === 2 && w >= 760;
    const cells = n === 2
      ? (side ? [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]] : [[0, 0, w, h / 2], [0, h / 2, w, h / 2]])
      : [[0, 0, w, h]];
    const { spanWE, spanNS } = this.grid;
    const rects = cells.map(([cx, cy, cw, chh]) => {
      const m = { l: 54, r: 92, t: n === 2 ? 26 : 14, b: 40 };
      const aw = cw - m.l - m.r, ah = chh - m.t - m.b;
      const s = Math.max(1e-9, Math.min(aw / spanWE, ah / spanNS));
      const pw = spanWE * s, ph = spanNS * s;
      const x0 = cx + m.l + (aw - pw) / 2, y0 = cy + m.t + (ah - ph) / 2;
      return { cx, cy, x0, y0, pw, ph, s, cb: { x: x0 + pw + 14, top: cy + m.t + 18, bottom: cy + m.t + ah, unitY: cy + m.t + 6 } };
    });
    return { w, h, side, rects };
  }

  buildCache(panel) {
    const { nx, ny, fields } = this.grid;
    const src = fields[panel.field];
    const img = makeCanvas(nx, ny);
    const g = img.getContext('2d');
    const data = g.createImageData(nx, ny);
    const values = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, v = src[k];
      values[k] = v * panel.unit.factor;
      const [r, gg, b] = panel.scale.color(v);
      const p = 4 * ((ny - 1 - j) * nx + i);
      data.data[p] = r; data.data[p + 1] = gg; data.data[p + 2] = b; data.data[p + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    let lo = Infinity, hi = -Infinity;
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const levels = hi > lo ? niceTicks(lo, hi, 7).filter(v => v > lo && v < hi) : [];
    panel.cache = { img, levels, iso: levels.map(level => isoSegments(values, nx, ny, level)) };
  }

  /** Central meridian crossing (lon − cm changes sign along a row), in grid index space. */
  centralMeridian() {
    if (this.cmLine) return this.cmLine;
    const { nx, ny, fields } = this.grid, cm = [];
    if (this.context) for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) {
      const a = fields.lon[j * nx + i] - this.context.cm, b = fields.lon[j * nx + i + 1] - this.context.cm;
      if (a <= 0 && b > 0) cm.push([i + a / (a - b), j]);
    }
    return (this.cmLine = cm);
  }

  draw() {
    const c = this.canvas;
    if (!this.grid || !this.panels[0] || !c.clientWidth) return;
    // two panels: side by side on wide canvases (shorter), stacked on narrow ones (taller)
    const want = this.active.length === 2 ? (c.clientWidth >= 760 ? '420px' : '700px') : '';
    if (c.style.height !== want) c.style.height = want;
    for (const p of this.active) if (!p.cache) this.buildCache(p);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const L = this.layout();
    c.width = Math.round(L.w * dpr); c.height = Math.round(L.h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    this.active.forEach((p, idx) => this.drawPanel(g, p, L.rects[idx], idx));
    this.layoutInfo = { side: L.side, panels: this.active.length };
  }

  drawPanel(g, panel, R, idx) {
    const { nx, ny, spanWE, spanNS } = this.grid;
    const gx = i => R.x0 + i / (nx - 1) * R.pw, gy = j => R.y0 + R.ph - j / (ny - 1) * R.ph;
    if (this.active.length > 1) {
      g.font = BOLD; g.fillStyle = INK.primary; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`${panel.title} (${panel.unit.unit})`, R.x0, R.cy + 4);
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(panel.cache.img, R.x0, R.y0, R.pw, R.ph);
    g.strokeStyle = INK.iso; g.lineWidth = 1;
    g.beginPath();
    for (const segs of panel.cache.iso) for (const [a, b, cc, d] of segs) { g.moveTo(gx(a), gy(b)); g.lineTo(gx(cc), gy(d)); }
    g.stroke();
    // building footprints (true size)
    g.strokeStyle = 'rgba(17,21,23,0.85)'; g.lineWidth = 1.5;
    for (const b of this.buildings || []) {
      const x = R.x0 + (b.e - b.size / 2 + spanWE / 2) * R.s, y = R.y0 + (spanNS / 2 - b.n - b.size / 2) * R.s;
      g.strokeRect(x, y, Math.max(1, b.size * R.s), Math.max(1, b.size * R.s));
    }
    const cm = this.centralMeridian();
    if (cm.length > 1) {
      g.save(); g.setLineDash([6, 4]); g.strokeStyle = INK.primary; g.lineWidth = 1.5;
      g.beginPath();
      cm.forEach(([i, j], k) => (k ? g.lineTo(gx(i), gy(j)) : g.moveTo(gx(i), gy(j))));
      g.stroke(); g.restore();
      const [i, j] = cm[cm.length - 1];
      g.font = FONT; g.fillStyle = INK.primary; g.textBaseline = 'top'; g.textAlign = 'left';
      g.fillText(this.t('cmShort'), gx(i) + 4, gy(j) + 2);
    }
    if (idx === 0 && panel.field === 'dh') this.drawArrows(g, R);
    // frame and axes
    g.strokeStyle = INK.grid; g.lineWidth = 1; g.strokeRect(R.x0, R.y0, R.pw, R.ph);
    const km = Math.max(spanWE, spanNS) >= 2000, f = km ? 1e-3 : 1;
    g.font = FONT; g.fillStyle = INK.secondary;
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const v of niceTicks(-spanWE / 2 * f, spanWE / 2 * f, Math.max(2, Math.round(R.pw / 80)))) {
      const x = R.x0 + (v / f + spanWE / 2) * R.s;
      g.fillRect(x, R.y0 + R.ph, 1, 4);
      g.fillText(this.format(v, 1), x, R.y0 + R.ph + 6);
    }
    g.fillText(`${this.t('axisE')} (${km ? 'km' : 'm'})`, R.x0 + R.pw / 2, R.y0 + R.ph + 22);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of niceTicks(-spanNS / 2 * f, spanNS / 2 * f, Math.max(2, Math.round(R.ph / 60)))) {
      const y = R.y0 + (spanNS / 2 - v / f) * R.s;
      g.fillRect(R.x0 - 4, y, 4, 1);
      g.fillText(this.format(v, 1), R.x0 - 7, y);
    }
    g.save(); g.translate(R.cx + 14, R.y0 + R.ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.fillText(`${this.t('axisN')} (${km ? 'km' : 'm'})`, 0, 0); g.restore();
    barInto(g, panel.scale, { x: R.cb.x, top: R.cb.top, bottom: R.cb.bottom, factor: panel.unit.factor, unit: panel.unit.unit, levels: panel.cache.levels, format: this.format, unitY: R.cb.unitY });
    if (this.hover) {
      const x = gx(this.hover.i), y = gy(this.hover.j);
      g.strokeStyle = INK.primary; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, R.y0); g.lineTo(x, R.y0 + R.ph); g.moveTo(R.x0, y); g.lineTo(R.x0 + R.pw, y); g.stroke();
      g.fillStyle = '#111517'; g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = INK.primary; g.lineWidth = 2; g.stroke();
    }
  }

  drawArrows(g, R) {
    const { nx, ny, fields } = this.grid;
    const n = 9, cell = Math.min(R.pw, R.ph) / n;
    let max = 0;
    for (let k = 0; k < fields.dh.length; k++) max = Math.max(max, fields.dh[k]);
    if (!(max > 0)) return;
    g.strokeStyle = INK.primary; g.fillStyle = INK.primary; g.lineWidth = 1.25;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const i = Math.round((a + 0.5) / n * (nx - 1)), j = Math.round((b + 0.5) / n * (ny - 1)), k = j * nx + i;
      const len = fields.dh[k] / max * cell * 0.8;
      if (len < 6) continue;
      const ang = Math.atan2(fields.dy[k], fields.dx[k]);
      const x = R.x0 + i / (nx - 1) * R.pw, y = R.y0 + R.ph - j / (ny - 1) * R.ph;
      const x2 = x + len * Math.cos(ang), y2 = y - len * Math.sin(ang);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.beginPath(); g.moveTo(x2, y2);
      g.lineTo(x2 - 5 * Math.cos(ang - 0.45), y2 + 5 * Math.sin(ang - 0.45));
      g.lineTo(x2 - 5 * Math.cos(ang + 0.45), y2 + 5 * Math.sin(ang + 0.45));
      g.closePath(); g.fill();
    }
  }

  pointer(e) {
    if (!this.grid || !this.panels[0]) return;
    const r = this.canvas.getBoundingClientRect(), L = this.layout();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const R = L.rects.find(q => x >= q.x0 && x <= q.x0 + q.pw && y >= q.y0 && y <= q.y0 + q.ph);
    if (!R) {
      if (this.hover) { this.hover = null; this.draw(); this.renderReadout(); }
      return;
    }
    const { nx, ny } = this.grid;
    const i = Math.round((x - R.x0) / R.pw * (nx - 1)), j = Math.round((R.y0 + R.ph - y) / R.ph * (ny - 1));
    this.hover = { i, j, k: j * nx + i };
    this.draw();
    this.renderReadout();
  }

  /** Readout for the hovered node, or for the centre when nothing is hovered. */
  renderReadout() {
    const p0 = this.panels[0];
    if (!this.readout || !this.grid || !p0) return;
    const { nx, ny, fields, spanWE, spanNS } = this.grid;
    const k = this.hover ? this.hover.k : Math.floor(ny / 2) * nx + Math.floor(nx / 2);
    const i = k % nx, j = Math.floor(k / nx);
    const e = -spanWE / 2 + i * spanWE / (nx - 1), n = -spanNS / 2 + j * spanNS / (ny - 1);
    const v = fields[p0.field][k] * p0.unit.factor;
    this.onHover?.({ k, e, n, value: v });
    const t = this.t, f = this.format, fx = (x, d) => f(x, d, d);
    const rows = [
      [this.hover ? t('readHere') : t('readCentre'), `e = ${fx(e, 1)} m, n = ${fx(n, 1)} m`],
      [p0.title, `${f(v)} ${p0.unit.unit}`],
    ];
    const p1 = this.panels[1];
    if (p1) rows.push([t('panel3dTitle'), `${f(fields.d3cloud[k] * p1.unit.factor)} ${p1.unit.unit}`]);
    rows.push(
      ['φ, λ', `${fx(fields.lat[k], 5)}°, ${fx(fields.lon[k], 5)}°`],
      ['k', fx(fields.k[k], 8)],
      [t('efShort'), fx(fields.ef[k], 8)],
      ['γ', `${fx(fields.gamma[k], 4)}°`],
      [t('geoidN'), Number.isFinite(fields.geoidN[k]) ? `${fx(fields.geoidN[k], 3)} m` : t('geoidOff')],
    );
    this.readout.innerHTML = rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  }
}

// OffscreenCanvas when available, else a detached <canvas>
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
