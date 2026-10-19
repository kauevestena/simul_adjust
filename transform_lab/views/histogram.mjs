// Histogram of standardized residuals with the N(0, 1) curve scaled to the bar counts.
import { theme } from '../ui.mjs';
import { histogram, normPdf } from '../core/stats.mjs';

export function drawHistogram(canvas, series, { bins = 15, labels }) {
  const box = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1, W = Math.max(240, box.width), H = Math.max(220, box.height);
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const th = theme(); ctx.clearRect(0, 0, W, H);
  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  const m = { l: 44, r: 16, t: 14, b: 38 };
  if (!all.length) { ctx.fillStyle = th.muted; ctx.font = '13px system-ui'; ctx.fillText(labels.empty, m.l, H / 2); return; }
  const lim = Math.max(3, Math.ceil(Math.max(...all.map(Math.abs)) * 1.05));
  const hs = series.map(s => ({ ...s, h: histogram(s.values, { bins, min: -lim, max: lim }) }));
  const total = hs.reduce((a, s) => a + s.h.n, 0), bw = hs[0].h.width;
  const stacked = new Array(bins).fill(0);
  hs.forEach(s => s.h.counts.forEach((c, i) => { stacked[i] += c; }));
  const curveMax = total * bw * normPdf(0);
  const ymax = Math.max(...stacked, curveMax) * 1.12 || 1;
  const X = x => m.l + (x + lim) / (2 * lim) * (W - m.l - m.r), Y = y => H - m.b - y / ymax * (H - m.t - m.b);

  // grid and axes
  ctx.strokeStyle = th.grid; ctx.fillStyle = th.muted; ctx.font = '11px system-ui, sans-serif'; ctx.lineWidth = 1;
  const ystep = niceStep(ymax / 5);
  for (let y = 0; y <= ymax; y += ystep) { ctx.beginPath(); ctx.moveTo(m.l, Y(y)); ctx.lineTo(W - m.r, Y(y)); ctx.stroke(); ctx.fillText(String(Math.round(y * 100) / 100), 8, Y(y) + 4); }
  for (let x = -lim; x <= lim; x += 1) { ctx.fillText(String(x), X(x) - 4, H - m.b + 15); }
  ctx.fillStyle = th.ink; ctx.fillText(labels.x, m.l + (W - m.l - m.r) / 2 - 60, H - 6);
  ctx.save(); ctx.translate(12, m.t + 70); ctx.rotate(-Math.PI / 2); ctx.fillText(labels.y, 0, 0); ctx.restore();

  // stacked bars with a 2px surface gap
  const base = new Array(bins).fill(0);
  hs.forEach(s => {
    ctx.fillStyle = s.color;
    s.h.counts.forEach((c, i) => {
      if (!c) return;
      const x0 = X(-lim + i * bw) + 1, x1 = X(-lim + (i + 1) * bw) - 1, y1 = Y(base[i]), y0 = Y(base[i] + c);
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(0, y1 - y0 - 1));
      base[i] += c;
    });
  });

  // N(0, 1) scaled: expected count in a bin = total · bw · φ(x)
  ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const x = -lim + 2 * lim * i / 120, y = total * bw * normPdf(x); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
  ctx.stroke();
  ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.l, H - m.b); ctx.lineTo(W - m.r, H - m.b); ctx.stroke();
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
