/**
 * Medida Eletrônica de Distâncias (EDM) — Apresentação Didática Interativa
 * ────────────────────────────────────────────────────────────────────────
 * Um tópico por parágrafo de med/teoria.md, cada um com resumo, pontos-chave,
 * o texto original e um diagrama animado em Canvas 2D. Três tópicos abrem
 * laboratórios interativos: ambiguidade de fase, erros sistemáticos e
 * correção atmosférica.
 */

// ══════════════════════════════════════════════════════════════
// Constantes e utilidades
// ══════════════════════════════════════════════════════════════

const C_LIGHT = 299792458; // m/s

const C = {
  bg: '#0b1120',
  grid: 'rgba(148, 163, 184, 0.06)',
  emit: '#14b8a6',
  emitSoft: '#5eead4',
  recv: '#f59e0b',
  ref: '#94a3b8',
  err: '#f43f5e',
  carrier: '#6366f1',
  ok: '#10b981',
  text: '#cbd5e1',
  muted: '#64748b',
  panel: 'rgba(8, 12, 20, 0.88)',
};

/** Formata número no padrão pt-BR (vírgula decimal). */
function fmt(v, dec = 3) {
  if (!isFinite(v)) return '—';
  return v.toFixed(dec).replace('.', ',');
}

/** Lê um número digitado em pt-BR ou en-US. */
function parseNum(str) {
  return parseFloat(String(str).trim().replace(/\s/g, '').replace(',', '.'));
}

/** Trunca (não arredonda) na casa decimal pedida, com folga para erro de ponto flutuante. */
function truncTo(v, dec) {
  const f = Math.pow(10, dec);
  return Math.floor(v * f + 1e-6) / f;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ══════════════════════════════════════════════════════════════
// Física do EDM
// ══════════════════════════════════════════════════════════════

/**
 * Escalas de medida. O sinal percorre ida e volta (2D), então o comprimento
 * unitário de medida é U = λ/2 — é por isso que instrumentos reais usam
 * λ = 20 m (f ≈ 15 MHz) para obter uma escala redonda de 10 m.
 */
const SCALES = [
  { U: 10, label: '10 m', dec: 3 },
  { U: 100, label: '100 m', dec: 2 },
  { U: 1000, label: '1 km', dec: 1 },
  { U: 10000, label: '10 km', dec: 0 },
];

const lambdaOf = (U) => 2 * U;
const freqOf = (U) => C_LIGHT / lambdaOf(U);

/**
 * Leitura de uma escala para uma distância D.
 * 2D = N·λ + Δλ ; Δλ = (Δφ/360°)·λ ; leitura = Δλ/2 = D mod U
 */
function scaleReading(D, U, dec) {
  const n = D / U; // = 2D/λ, número de ciclos de modulação no percurso
  const N = Math.floor(n);
  const frac = n - N;
  return {
    n,
    N,
    frac,
    dphi: frac * 360,
    dLambda: frac * lambdaOf(U),
    exact: frac * U,
    reading: truncTo(frac * U, dec),
  };
}

/**
 * Primeira correção de velocidade (fórmula IUGG/Leica), em ppm.
 * t: °C, p: hPa, h: umidade relativa %.
 * Vale ≈ 0 ppm nas condições padrão (12 °C, 1013,25 hPa, 60 %) e varia
 * aproximadamente 1 ppm por °C — exatamente como afirma a teoria.
 */
function atmPpm(t, p, h) {
  const x = (7.5 * t) / (237.3 + t) + 0.7857;
  const den = 1 + 0.003661 * t;
  return 286.34 - (0.29525 * p) / den - (4.126e-4 * h * Math.pow(10, x)) / den;
}

// ══════════════════════════════════════════════════════════════
// Canvas: dimensionamento e primitivas de desenho
// ══════════════════════════════════════════════════════════════

/** Ajusta o buffer do canvas ao tamanho CSS (só quando muda) e devolve ctx/w/h. */
function ensureSize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const ctx = canvas.getContext('2d');
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function clearBg(ctx, w, h, withGrid = true) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  if (!withGrid) return;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  for (let x = 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function setFont(ctx, size = 11, weight = 600, mono = false) {
  ctx.font = `${weight} ${size}px ${mono ? '"JetBrains Mono", monospace' : '"Plus Jakarta Sans", sans-serif'}`;
}

/** Etiqueta com fundo (chip). */
function chip(ctx, text, x, y, color, opts = {}) {
  const { size = 11, mono = true, align = 'center' } = opts;
  setFont(ctx, size, 600, mono);
  const tw = ctx.measureText(text).width;
  const pw = tw + 12;
  const ph = size + 9;
  let bx = x - pw / 2;
  if (align === 'left') bx = x;
  if (align === 'right') bx = x - pw;
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.roundRect(bx, y - ph / 2, pw, ph, 4);
  ctx.fill();
  ctx.strokeStyle = color + '55';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pw / 2, y);
  return { x: bx, y: y - ph / 2, w: pw, h: ph };
}

/** Texto simples, sem fundo. */
function text(ctx, str, x, y, color, opts = {}) {
  const { size = 11, weight = 600, mono = false, align = 'left', baseline = 'middle' } = opts;
  setFont(ctx, size, weight, mono);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

function line(ctx, x1, y1, x2, y2, color, opts = {}) {
  const { width = 1.5, dash = null } = opts;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

function arrowHead(ctx, x, y, angle, color, size = 8) {
  const spread = 0.42;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle - spread) * size, y - Math.sin(angle - spread) * size);
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle + spread) * size, y - Math.sin(angle + spread) * size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function arrow(ctx, x1, y1, x2, y2, color, opts = {}) {
  line(ctx, x1, y1, x2, y2, color, opts);
  arrowHead(ctx, x2, y2, Math.atan2(y2 - y1, x2 - x1), color, opts.head || 8);
}

/** Seta de cota (dupla ponta) com rótulo, usada para marcar λ e distâncias. */
function dimArrow(ctx, x1, x2, y, color, label) {
  line(ctx, x1, y, x2, y, color, { width: 1.5 });
  arrowHead(ctx, x1, y, Math.PI, color, 6);
  arrowHead(ctx, x2, y, 0, color, 6);
  line(ctx, x1, y - 6, x1, y + 6, color, { width: 1 });
  line(ctx, x2, y - 6, x2, y + 6, color, { width: 1 });
  if (label) chip(ctx, label, (x1 + x2) / 2, y, color);
}

/** Caixa de bloco (diagramas esquemáticos). */
function box(ctx, x, y, w, h, label, color, opts = {}) {
  const { sub = null, fill = 'rgba(15,23,42,0.75)' } = opts;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = color + '99';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, label, x + w / 2, y + (sub ? h / 2 - 7 : h / 2), color, { align: 'center', size: 10.5 });
  if (sub) text(ctx, sub, x + w / 2, y + h / 2 + 8, C.muted, { align: 'center', size: 9, weight: 500 });
  return { cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
}

/** Estação total / EDM sobre tripé. */
function drawEDM(ctx, x, y, s = 1, label = 'EDM') {
  const bw = 26 * s, bh = 18 * s;
  // tripé
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + bh / 2); ctx.lineTo(x - 13 * s, y + 34 * s);
  ctx.moveTo(x, y + bh / 2); ctx.lineTo(x + 13 * s, y + 34 * s);
  ctx.moveTo(x, y + bh / 2); ctx.lineTo(x, y + 36 * s);
  ctx.stroke();
  // corpo
  ctx.fillStyle = 'rgba(15,23,42,0.95)';
  ctx.beginPath();
  ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4 * s);
  ctx.fill();
  ctx.strokeStyle = C.emit;
  ctx.lineWidth = 1.8 * s;
  ctx.stroke();
  // lente
  ctx.beginPath();
  ctx.arc(x + bw / 2 - 1, y, 5.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,184,166,0.35)';
  ctx.fill();
  ctx.strokeStyle = C.emitSoft;
  ctx.lineWidth = 1.4 * s;
  ctx.stroke();
  if (label) text(ctx, label, x, y + 46 * s, C.emitSoft, { align: 'center', size: 10 });
}

/** Prisma de canto de cubo (três espelhos ortogonais) sobre bastão. */
function drawPrism(ctx, x, y, s = 1, label = 'Prisma') {
  const r = 15 * s;
  // bastão
  line(ctx, x, y + r, x, y + 36 * s, 'rgba(148,163,184,0.45)', { width: 2 * s });
  // hexágono
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(245,158,11,0.14)';
  ctx.fill();
  ctx.strokeStyle = C.recv;
  ctx.lineWidth = 1.8 * s;
  ctx.stroke();
  // três arestas internas = três espelhos ortogonais
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.strokeStyle = 'rgba(245,158,11,0.75)';
  ctx.lineWidth = 1.2 * s;
  ctx.stroke();
  if (label) text(ctx, label, x, y + 46 * s, C.recv, { align: 'center', size: 10 });
}

/** Senoide genérica: y = yc - amp·sin(2π·(x−x0)/wl + phase) */
function sine(ctx, x0, x1, yc, amp, wl, phase, color, opts = {}) {
  const { width = 1.6, dash = null, step = 1.5 } = opts;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    const y = yc - amp * Math.sin((2 * Math.PI * (x - x0)) / wl + phase);
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

// ══════════════════════════════════════════════════════════════
// Diagramas dos tópicos (canvas único, animados)
// ══════════════════════════════════════════════════════════════

const pingPong = (t, period) => {
  const p = (t % period) / period;
  return p < 0.5 ? p * 2 : 2 - p * 2;
};

// § 1 — O que é um EDM
const ERAS = [
  ['Geodímetro (1947)', 'luz visível'],
  ['Telurômetro (1957)', 'micro-ondas — opera de dia'],
  ['Infravermelho', 'padrão nos EDM modernos'],
];
function diagWhatIsEDM(ctx, w, h, t) {
  const y = h * 0.42;
  const xa = w * 0.16, xb = w * 0.84;
  drawEDM(ctx, xa, y, 1, 'EDM');
  drawPrism(ctx, xb, y, 1, 'Refletor');
  line(ctx, xa + 18, y, xb - 18, y, 'rgba(148,163,184,0.28)', { width: 1.5, dash: [6, 5] });

  // pulso viajando (ida e volta)
  const p = pingPong(t, 2.6);
  const px = xa + 18 + (xb - 18 - (xa + 18)) * p;
  const going = (t % 2.6) / 2.6 < 0.5;
  ctx.beginPath();
  ctx.arc(px, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = going ? C.emit : C.recv;
  ctx.shadowColor = going ? C.emit : C.recv;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  text(ctx, going ? 'ida' : 'volta', px, y - 18, going ? C.emitSoft : C.recv, { align: 'center', size: 9.5 });

  dimArrow(ctx, xa + 18, xb - 18, y + 58, 'rgba(148,163,184,0.7)', 'D');
  chip(ctx, '2D = c · Δt', w / 2, y - 52, C.emitSoft);
  text(ctx, 'o tempo (ou a fase) vira distância', w / 2, y - 30, C.muted, { align: 'center', size: 9.5, weight: 500 });

  const era = ERAS[Math.floor(t / 2.4) % ERAS.length];
  chip(ctx, era[0], w / 2, h - 34, C.recv);
  text(ctx, era[1], w / 2, h - 14, C.muted, { align: 'center', size: 9.5, weight: 500 });
}

// § 2 — Estrutura interna
function diagInternals(ctx, w, h, t) {
  const s = Math.min(1, w / 640);
  const bw = 92 * s, bh = 34 * s;
  const yTop = h * 0.34, yBot = h * 0.72;
  const x0 = w * 0.04;

  const osc = box(ctx, x0, yTop - bh / 2, bw, bh, 'Cristal', C.ref, { sub: 'oscilador' });
  const emi = box(ctx, x0 + bw + 26 * s, yTop - bh / 2, bw, bh, 'Diodo emissor', C.emit, { sub: 'portadora + AM' });
  const splitX = emi.r + 30 * s;
  const rec = box(ctx, x0 + bw + 26 * s, yBot - bh / 2, bw, bh, 'Fotodetector', C.recv, { sub: 'sinal de retorno' });
  const cmp = box(ctx, x0, yBot - bh / 2, bw, bh, 'Comparador', C.emitSoft, { sub: 'de fase → Δφ' });

  arrow(ctx, osc.r, yTop, emi.cx - bw / 2 - 3, yTop, C.ref, { width: 1.6 });
  arrow(ctx, rec.cx - bw / 2 - 3, yBot, cmp.r + 3, yBot, C.recv, { width: 1.6 });

  // divisor de feixe
  const bs = splitX + 12 * s;
  ctx.save();
  ctx.translate(bs, yTop);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = 'rgba(94,234,212,0.22)';
  ctx.fillRect(-16 * s, -2.5 * s, 32 * s, 5 * s);
  ctx.strokeStyle = C.emitSoft;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-16 * s, -2.5 * s, 32 * s, 5 * s);
  ctx.restore();
  arrow(ctx, emi.r, yTop, bs - 10 * s, yTop, C.emit, { width: 1.6 });
  text(ctx, 'divisor de feixe', bs, yTop - 26 * s, C.emitSoft, { align: 'center', size: 9.5 });

  // caminho interno de referência (curto)
  line(ctx, bs, yTop + 8 * s, bs, yBot, C.emitSoft, { width: 1.4, dash: [4, 4] });
  arrow(ctx, bs, yBot, rec.r - 2, yBot, C.emitSoft, { width: 1.4 });
  text(ctx, 'referência interna', bs + 8 * s, (yTop + yBot) / 2, C.emitSoft, { size: 9, align: 'left' });

  // caminho externo (longo, até o prisma)
  const lensX = w - 78 * s;
  arrow(ctx, bs + 12 * s, yTop, lensX - 22 * s, yTop, C.emit, { width: 1.8 });
  drawPrism(ctx, w - 30 * s, yTop, 0.8 * s, null);
  text(ctx, 'prisma', w - 30 * s, yTop + 30 * s, C.recv, { align: 'center', size: 9 });
  line(ctx, w - 30 * s, yTop + 16 * s, w - 30 * s, yBot, C.recv, { width: 1.4, dash: [4, 4] });
  arrow(ctx, w - 30 * s, yBot, rec.r + 6, yBot, C.recv, { width: 1.8 });
  text(ctx, 'caminho externo — 2D', (bs + lensX) / 2, yTop - 14 * s, C.emit, { align: 'center', size: 9.5 });

  // pacotes animados
  const pRef = (t * 1.6) % 1;
  const cyRef = yTop + 8 * s + (yBot - yTop - 8 * s) * Math.min(1, pRef * 2);
  ctx.beginPath(); ctx.arc(bs, cyRef, 3.5, 0, Math.PI * 2); ctx.fillStyle = C.emitSoft; ctx.fill();
  const pExt = (t * 0.55) % 1;
  const ex = bs + 12 * s + (w - 30 * s - bs - 12 * s) * Math.min(1, pExt * 2);
  ctx.beginPath(); ctx.arc(ex, yTop, 4.5, 0, Math.PI * 2); ctx.fillStyle = C.emit; ctx.fill();
}

// § 4 — Sistemas refletores
function diagReflectors(ctx, w, h, t) {
  const midX = w / 2;
  line(ctx, midX, 24, midX, h - 24, 'rgba(148,163,184,0.15)', { width: 1, dash: [4, 6] });
  const p = (t % 3) / 3;
  const cy = h * 0.46;

  // ── Prisma: canto de cubo, retorno paralelo ──
  const lx = w * 0.26;
  text(ctx, 'Prisma de canto de cubo', lx, 26, C.recv, { align: 'center', size: 11 });
  text(ctx, '3 espelhos ortogonais → retorno íntegro', lx, 42, C.muted, { align: 'center', size: 9, weight: 500 });
  drawPrism(ctx, lx, cy, 1.25, null);

  const inA = { x: lx - 76, y: cy - 30 }, hit = { x: lx - 4, y: cy - 6 };
  const out = { x: lx - 76, y: cy + 26 };
  const seg = clamp(p * 2.2, 0, 2);
  if (seg <= 1) {
    line(ctx, inA.x, inA.y, inA.x + (hit.x - inA.x) * seg, inA.y + (hit.y - inA.y) * seg, C.emit, { width: 2.4 });
  } else {
    line(ctx, inA.x, inA.y, hit.x, hit.y, 'rgba(20,184,166,0.35)', { width: 2 });
    const q = seg - 1;
    line(ctx, hit.x, hit.y, hit.x + (out.x - hit.x) * q, hit.y + (out.y - hit.y) * q, C.recv, { width: 2.4 });
  }
  text(ctx, 'entrada', inA.x + 4, inA.y - 12, C.emit, { size: 9 });
  text(ctx, 'retorno paralelo', out.x + 4, out.y + 14, C.recv, { size: 9 });

  // ── Difusa: espalhamento ──
  const rx = w * 0.74;
  text(ctx, 'Reflexão difusa (sem prisma)', rx, 26, C.err, { align: 'center', size: 11 });
  text(ctx, 'exige portadora LASER colimada', rx, 42, C.muted, { align: 'center', size: 9, weight: 500 });
  ctx.fillStyle = 'rgba(148,163,184,0.18)';
  ctx.fillRect(rx + 14, cy - 34, 12, 68);
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(rx + 14, cy - 34, 12, 68);
  const dIn = { x: rx - 74, y: cy - 26 }, dHit = { x: rx + 14, y: cy };
  if (seg <= 1) {
    line(ctx, dIn.x, dIn.y, dIn.x + (dHit.x - dIn.x) * seg, dIn.y + (dHit.y - dIn.y) * seg, C.emit, { width: 2.4 });
  } else {
    line(ctx, dIn.x, dIn.y, dHit.x, dHit.y, 'rgba(20,184,166,0.35)', { width: 2 });
    const q = seg - 1;
    [-52, -30, -8, 14, 36].forEach((deg, i) => {
      const a = Math.PI + (deg * Math.PI) / 180;
      const len = 70 * q;
      const strong = i === 1;
      line(ctx, dHit.x, dHit.y, dHit.x + Math.cos(a) * len, dHit.y + Math.sin(a) * len,
        strong ? C.recv : 'rgba(245,158,11,0.16)', { width: strong ? 2.2 : 1 });
    });
  }
  text(ctx, 'só uma fração volta', rx - 46, cy + 44, C.err, { align: 'center', size: 9 });
}

// § 6 — Calibração
function diagCalibration(ctx, w, h, t) {
  const s = Math.min(1, w / 620);
  // Campo
  text(ctx, 'Campo — base de calibração', w * 0.27, 26, C.emitSoft, { align: 'center', size: 11 });
  const bx0 = w * 0.06, bx1 = w * 0.48, by = h * 0.42;
  line(ctx, bx0, by, bx1, by, 'rgba(148,163,184,0.4)', { width: 2 });
  const nP = 4;
  const px = [];
  for (let i = 0; i < nP; i++) {
    const x = bx0 + ((bx1 - bx0) * i) / (nP - 1);
    px.push(x);
    ctx.fillStyle = 'rgba(20,184,166,0.25)';
    ctx.fillRect(x - 4 * s, by - 22 * s, 8 * s, 22 * s);
    ctx.strokeStyle = C.emit;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(x - 4 * s, by - 22 * s, 8 * s, 22 * s);
    text(ctx, String.fromCharCode(65 + i), x, by + 12, C.emitSoft, { align: 'center', size: 9.5 });
  }
  text(ctx, 'pilares com centragem forçada', (bx0 + bx1) / 2, by - 34 * s, C.muted, { align: 'center', size: 9, weight: 500 });

  // todas as combinações (redundância) — destaca uma por vez
  const pairs = [];
  for (let i = 0; i < nP; i++) for (let j = i + 1; j < nP; j++) pairs.push([i, j]);
  const active = Math.floor(t * 1.1) % pairs.length;
  pairs.forEach(([i, j], k) => {
    const yy = by + 24 + k * 9;
    const on = k === active;
    line(ctx, px[i], yy, px[j], yy, on ? C.emit : 'rgba(20,184,166,0.16)', { width: on ? 2 : 1 });
  });
  chip(ctx, `${pairs.length} distâncias → MMQ`, (bx0 + bx1) / 2, h - 22, C.emitSoft);

  // Laboratório
  text(ctx, 'Laboratório — condições controladas', w * 0.77, 26, C.recv, { align: 'center', size: 11 });
  const lx0 = w * 0.56, lx1 = w * 0.96, ly = h * 0.45;
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(lx0, ly - 34, lx1 - lx0, 68);
  sine(ctx, lx0 + 8, lx1 - 8, ly, 18, 52, t * 3.4, C.recv, { width: 2 });
  text(ctx, 'frequencímetro / osciloscópio', (lx0 + lx1) / 2, ly + 48, C.muted, { align: 'center', size: 9, weight: 500 });
  chip(ctx, 'fator de escala direto', (lx0 + lx1) / 2, h - 22, C.recv);
}

// § 8 — A segunda correção
function diagSecondCorrection(ctx, w, h, t) {
  const xa = w * 0.12, xb = w * 0.88, y = h * 0.55;
  // camadas de atmosfera com índices diferentes
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const frac = i / (bands - 1);
    const yy = y - 78 + (i * 150) / bands;
    ctx.fillStyle = `rgba(168,85,247,${0.04 + frac * 0.07})`;
    ctx.fillRect(xa - 20, yy, xb - xa + 40, 150 / bands);
    const amp = 2 + frac * 5;
    sine(ctx, xa - 20, xb + 20, yy + 75 / bands, amp, 40 + frac * 40, t * (1 + frac), 'rgba(168,85,247,0.32)', { width: 1 });
  }
  text(ctx, 'n₁', xa - 6, y - 66, '#c4b5fd', { size: 9.5, align: 'center' });
  text(ctx, 'n₂', xa - 6, y - 24, '#c4b5fd', { size: 9.5, align: 'center' });
  text(ctx, 'n₃', xa - 6, y + 18, '#c4b5fd', { size: 9.5, align: 'center' });
  text(ctx, 'índice de refração varia ao longo do percurso', w / 2, 24, '#c4b5fd', { align: 'center', size: 10.5 });

  drawEDM(ctx, xa, y, 0.85, null);
  drawPrism(ctx, xb, y - 20, 0.85, null);

  // trajeto assumido (reto) × real (curvo)
  line(ctx, xa + 16, y, xb - 14, y - 20, 'rgba(148,163,184,0.5)', { width: 1.4, dash: [5, 5] });
  ctx.beginPath();
  ctx.moveTo(xa + 16, y);
  ctx.quadraticCurveTo((xa + xb) / 2, y + 22 + Math.sin(t * 1.4) * 3, xb - 14, y - 20);
  ctx.strokeStyle = C.emit;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  chip(ctx, 'assumido: reto', w * 0.36, y - 26, 'rgba(148,163,184,0.9)');
  chip(ctx, 'real: encurvado', w * 0.62, y + 34, C.emitSoft);

  // rede de termômetros
  for (let i = 1; i <= 4; i++) {
    const f = i / 5;
    const tx = xa + 16 + (xb - 14 - xa - 16) * f;
    const ty = y + 22 * (1 - Math.abs(2 * f - 1)) * 0.9 - 20 * f;
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = C.recv;
    ctx.fill();
  }
  text(ctx, 'rede de termômetros (Carvalhal, 2018)', w / 2, h - 16, C.recv, { align: 'center', size: 9.5 });
}

// § 9 — Estações Totais
const TS_PARTS = [
  ['DI — distância inclinada', C.emit],
  ['Z — ângulo zenital', C.recv],
  ['DH = DI · sen Z', C.emitSoft],
  ['ΔN = DI · cos Z', '#c4b5fd'],
];
function diagTotalStation(ctx, w, h, t) {
  const ox = w * 0.2, oy = h * 0.78;
  const tx = w * 0.76, ty = h * 0.25;
  const active = Math.floor(t / 1.6) % TS_PARTS.length;

  line(ctx, w * 0.06, oy, w * 0.94, oy, 'rgba(148,163,184,0.25)', { width: 1.2, dash: [6, 5] });
  drawEDM(ctx, ox, oy - 24, 0.9, null);
  text(ctx, 'Estação Total', ox, oy + 22, C.emitSoft, { align: 'center', size: 10 });
  drawPrism(ctx, tx, ty, 0.85, null);

  // distância inclinada
  line(ctx, ox, oy - 24, tx, ty, active === 0 ? C.emit : 'rgba(20,184,166,0.3)', { width: active === 0 ? 3 : 1.6 });
  // horizontal e vertical
  line(ctx, ox, oy - 24, tx, oy - 24, active === 2 ? C.emitSoft : 'rgba(94,234,212,0.25)', { width: active === 2 ? 3 : 1.4, dash: [6, 4] });
  line(ctx, tx, oy - 24, tx, ty, active === 3 ? '#c4b5fd' : 'rgba(196,181,253,0.25)', { width: active === 3 ? 3 : 1.4, dash: [6, 4] });

  // arco zenital
  const zr = 46;
  ctx.beginPath();
  ctx.arc(ox, oy - 24, zr, -Math.PI / 2, Math.atan2(ty - (oy - 24), tx - ox));
  ctx.strokeStyle = active === 1 ? C.recv : 'rgba(245,158,11,0.3)';
  ctx.lineWidth = active === 1 ? 3 : 1.6;
  ctx.stroke();
  line(ctx, ox, oy - 24, ox, oy - 24 - zr - 14, 'rgba(148,163,184,0.5)', { width: 1.2, dash: [4, 4] });
  text(ctx, 'zênite', ox, oy - 24 - zr - 24, C.muted, { align: 'center', size: 9 });

  // alturas
  line(ctx, ox - 34, oy, ox - 34, oy - 24, C.ref, { width: 1.2 });
  text(ctx, 'hi', ox - 42, oy - 12, C.ref, { size: 9, align: 'right' });
  line(ctx, tx + 26, ty + 30, tx + 26, oy, C.ref, { width: 1.2 });
  text(ctx, 'ht', tx + 34, (ty + 30 + oy) / 2, C.ref, { size: 9 });

  const [lab, col] = TS_PARTS[active];
  chip(ctx, lab, w / 2, h - 18, col);
}

// § 10 — Legado
const LEGACY = [
  { emoji: '🌙', ang: -145, label: 'LLR — Lua' },
  { emoji: '🛰️', ang: -80, label: 'SLR — satélites' },
  { emoji: '📡', ang: -20, label: 'Laser Scanner' },
  { emoji: '🌐', ang: 45, label: 'GNSS (inspiração)' },
];
function diagLegacy(ctx, w, h, t) {
  const cx = w / 2, cy = h * 0.56;
  const R = Math.min(w, h) * 0.33;
  LEGACY.forEach((item, i) => {
    const a = (item.ang * Math.PI) / 180;
    const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
    const p = pingPong(t + i * 0.55, 2.4);
    line(ctx, cx, cy, cx + (ex - cx) * p, cy + (ey - cy) * p, 'rgba(20,184,166,0.45)', { width: 1.4, dash: [4, 4] });
    setFont(ctx, 24, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, ex, ey);
    text(ctx, item.label, ex, ey + 24, C.emitSoft, { align: 'center', size: 9 });
  });
  drawEDM(ctx, cx, cy, 1, null);
  chip(ctx, 'princípios do EDM', cx, cy + 44, C.emitSoft);
}

// ══════════════════════════════════════════════════════════════
// Conteúdo dos tópicos (resumo, pontos-chave e texto original)
// ══════════════════════════════════════════════════════════════

const TOPICS = [
  {
    title: 'O que é um EDM?',
    summary: 'A Medida Eletrônica de Distâncias mede comprimentos pela propagação de ondas eletromagnéticas, convertendo tempo ou fase em distância. O distanciômetro substituiu a trena, cujo uso moroso em campo favorecia as redes de triangulação. A linhagem histórica vai do Geodímetro (luz visível) ao Telurômetro (micro-ondas, com a vantagem de operar também de dia), até o infravermelho, hoje padrão.',
    keyPoints: [
      'O sinal percorre <strong>ida e volta</strong>: o que se observa corresponde a <code>2D</code>.',
      'Por pulso: <code>2D = c · Δt</code>.',
      'A lentidão da trena favorecia a <strong>triangulação</strong>; o EDM viabilizou a <strong>trilateração</strong>.',
    ],
    render: diagWhatIsEDM,
  },
  {
    title: 'Estrutura Interna',
    summary: 'A estrutura varia entre fabricantes, mas há sempre um emissor de radiação e um receptor do sinal devolvido por um refletor externo. O emissor é um diodo cujo cristal oscilador modula — em geral <strong>por amplitude</strong> — uma ou mais frequências, que são as efetivamente medidas. Antes de seguir para as lentes, o sinal passa por um divisor de feixe que guarda uma cópia interna; o fotodetector compara essa referência com o sinal que voltou.',
    keyPoints: [
      'A portadora não é medida diretamente: mede-se a <strong>modulação</strong> imposta sobre ela.',
      'O <strong>divisor de feixe</strong> cria a referência interna contra a qual a fase é comparada.',
      'Cristal oscilador → diodo emissor → divisor de feixe → prisma → fotodetector → comparador de fase.',
    ],
    render: diagInternals,
  },
  {
    title: 'Princípios de Medição e a Ambiguidade de Fase',
    summary: 'São quatro os princípios usuais: pulso, interferometria, efeito Doppler e diferença de fase. O último domina por medir uma grandeza mais viável de obter com precisão, mas traz consigo a ambiguidade do número inteiro de ciclos — a fase fornece somente a parte fracionária. A solução clássica é medir com vários comprimentos de onda modulada, tipicamente quatro em progressão decimal, de modo que cada retorno revele um grupo de dígitos da distância.',
    keyPoints: [
      'Como o percurso é <code>2D</code>, o comprimento unitário de medida é <code>U = λ/2</code> — por isso λ = 20 m gera a escala redonda de 10 m.',
      '<code>2D = N·λ + Δλ</code>, com <code>Δλ = (Δφ/360°)·λ</code>. A fase entrega Δλ; <strong>N é a ambiguidade</strong>.',
      'Quatro escalas em cascata (10 m → 10 km) resolvem N: <code>3123,456 m ⇐ 3,456 / 23,45 / 123,4 / 3123</code>.',
    ],
    lab: 'ambiguity',
  },
  {
    title: 'Sistemas Refletores',
    summary: 'Há dois princípios de alvo. Na reflexão total usam-se prismas de canto de cubo — a interseção de três espelhos planos ortogonais — que devolvem a onda íntegra e paralela ao feixe incidente, maximizando o alcance. Na reflexão difusa, como nas trenas digitais, dispensa-se o prisma, mas apenas uma parcela do sinal retorna: isso exige portadora LASER altamente colimada, ainda assim falha em alguns casos, e resulta em precisão menor.',
    keyPoints: [
      'Prisma de canto de cubo = <strong>três espelhos planos ortogonais</strong>; o retorno sai paralelo à entrada.',
      'Cada prisma tem uma <strong>constante</strong> própria (mm), fornecida pelo fabricante.',
      'Reflexão difusa exige <strong>portadora LASER colimada</strong> e é menos precisa.',
    ],
    render: diagReflectors,
  },
  {
    title: 'Erros Sistemáticos',
    summary: 'Três erros sistemáticos de origem instrumental afetam o EDM: o erro de zero, deslocamento entre a referência geométrica do equipamento (o ponto cardã, nas Estações Totais) e o emissor; o fator de escala, decorrente de variações na frequência da portadora; e o erro cíclico, originado em diafonias entre emissor e receptor. Soma-se a constante do prisma nos sistemas retrorrefletores. A precisão nominal é expressa como um termo fixo A, em mm, mais um termo B em ppm proporcional à distância.',
    keyPoints: [
      'Precisão nominal: <code>σ = ±(A mm + B ppm)</code> — A absorve o resíduo sistemático, B cresce com a distância.',
      'Erro de zero: constante, medido a partir do <strong>ponto cardã</strong>.',
      'Fator de escala: proporcional à distância. Erro cíclico: oscila com o período da escala de medida.',
    ],
    lab: 'errors',
  },
  {
    title: 'Calibração',
    summary: 'A calibração periódica é imprescindível, pois os erros sistemáticos variam com o envelhecimento do cristal oscilador, com as variações de temperatura e com o manuseio. Em campo, reproduzindo as condições de operação, usam-se pilares estáveis com centragem forçada, em distâncias planejadas, colineares e redundantes, cujos parâmetros se modelam de forma conjunta ou sequencial por mínimos quadrados. Em laboratório ganha-se atmosfera controlada e a determinação direta do fator de escala com frequencímetros e osciloscópios.',
    keyPoints: [
      'Os erros <strong>derivam com o tempo</strong>: envelhecimento do cristal, temperatura e manuseio.',
      'Campo: pilares com centragem forçada, distâncias <strong>colineares e redundantes</strong> → ajustamento por <strong>MMQ</strong>.',
      'Laboratório: atmosfera controlada e <strong>determinação direta</strong> do fator de escala.',
    ],
    render: diagCalibration,
  },
  {
    title: 'Correção Atmosférica',
    summary: 'O sinal propaga-se na atmosfera, cujo índice de refração — e portanto a velocidade de propagação — difere do vácuo. A modelagem local parte de medições de temperatura, umidade relativa e pressão, aplicadas na equação homologada pela IUGG. A correção resulta em ppm, isto é, proporcional à distância: não calculá-la equivale a adotar 0 ppm, o que não corresponde à correção para 0 °C. Em média, 1 °C de erro na temperatura implica 1 ppm de variação.',
    keyPoints: [
      'A correção é <strong>proporcional à distância</strong> (ppm): 10 ppm valem 10 mm em 1 km.',
      '<strong>Não corrigir = 0 ppm</strong>, e não a correção correspondente a 0 °C.',
      'Sensibilidade prática: <code>≈ 1 ppm por °C</code> (verificável nos controles ao lado).',
    ],
    lab: 'atmosphere',
  },
  {
    title: 'A Segunda Correção',
    summary: 'Assumir atmosfera constante ao longo de todo o percurso é uma simplificação conveniente, nem sempre suficiente. Em grandes extensões ou sob fortes gradientes térmicos o índice de refração varia de maneira diferencial ao longo do caminho — trata-se de um campo contínuo — o que afeta também a direção do feixe: é a chamada segunda correção. Modelá-la é um dos maiores desafios para medidas de alta precisão em ambientes não controlados; Carvalhal (2018), por exemplo, propôs uma rede de termômetros de baixo custo para aproximá-la melhor.',
    keyPoints: [
      'O índice de refração é um <strong>campo contínuo</strong>, não um valor único do percurso.',
      'Além do módulo da distância, afeta a <strong>direção do feixe</strong> (encurvamento).',
      'Crítica em percursos longos e com forte gradiente térmico.',
    ],
    render: diagSecondCorrection,
  },
  {
    title: 'Integração em Estações Totais',
    summary: 'Historicamente empregados em redes de trilateração, os EDM hoje são componente essencial das Estações Totais: integrados a teodolitos digitais e unidades computacionais, permitem decompor a distância espacial em componentes horizontal e vertical e, por consequência, obter coordenadas no referencial instrumental. Nesse arranjo tornam-se relevantes erros operacionais de centragem, nivelamento, pontaria e determinação das alturas de instrumento e alvo. A redundância observacional permite estimativas realistas de precisão, podendo indicar reclassificação instrumental conforme a NBR 13133.',
    keyPoints: [
      'Decomposição: <code>DH = DI·sen Z</code> e <code>ΔN = DI·cos Z</code> (+ hi − ht).',
      'Erros operacionais: centragem, nivelamento, pontaria, alturas de instrumento e alvo.',
      'Aplicações: trilateração, poligonais, levantamentos 3D, monitoramento estrutural, topografia industrial e locação de obras.',
    ],
    render: diagTotalStation,
  },
  {
    title: 'Conclusão e Legado',
    summary: 'Os EDM são elemento basilar da Topografia e da Geodésia modernas, sustentados documentalmente pelos certificados de calibração e classificação. Viabilizaram um ganho de produtividade sem precedentes e seus princípios se estendem do LLR e do SLR — medição de distâncias à Lua e a satélites — aos sistemas de Laser Scanner terrestres e dinâmicos, tendo ainda inspirado a constituição dos modernos sistemas de posicionamento por satélite.',
    keyPoints: [
      'Certificados de <strong>calibração e classificação</strong> são os pilares documentais da qualidade.',
      'Mesmos princípios em <strong>LLR/SLR</strong> e em <strong>Laser Scanners</strong> terrestres e móveis.',
      'A medida de tempo/fase de propagação é também a base conceitual do <strong>GNSS</strong>.',
    ],
    render: diagLegacy,
  },
];

// Texto original de med/teoria.md (parágrafos 1–10), exibido em <details>.
const SOURCE = [
  'A Medida Eletrônica de Distâncias se trata da técnica que realiza a medida de comprimentos por meio do uso da propagação de ondas eletromagnéticas, convertendo tempo ou fase em distâncias. O equipamento denomina-se Medidor Eletrônico de Distâncias (EDM) ou distanciômetro, que tem sido o substituto moderno ao uso das trenas, que tornavam os procedimentos de campo morosos, levando a uma preferência generalizada pelas redes de triangulação (Wolf, Ghillani 2012). Historicamente, o primeiro EDM foi o Geodímetro, baseado em luz no comprimento visível e posteriormente o Telurômetro, baseado em microondas, tendo a vantagem de operar também de dia, contudo nos sistemas modernos o infravermelho se tornou a parte do espectro mais utilizada (Rueguer, 1990).',
  'A exata estrutura interna de um EDM é diferente para cada fabricante, porém invariavelmente haverá um elemento emissor de radiação eletromagnética e um elemento receptor da radiação refletida por um elemento refletor - externo ao equipamento - que completa o sistema de medição (Rueguer, 1990). O emissor (diodo) de uma onda denominada portadora, geralmente possui um cristal oscilador que modula (geralmente por amplitude) uma ou mais frequências que são efetivamente mensuradas. O Elemento receptor, um sensor fotoelétrico, recebe uma cópia do sinal original - que passou por um divisor de feixe antes de ser conduzido ao sistema de lentes - a ser comparado com o sinal refletido.',
  'Quanto aos princípios de funcionamento de um EDM, de acordo com Rueguer (1990) há quatro mais utilizados: Pulso, onde a diferença entre o tempo de emissão e recepção, multiplicada pela velocidade da luz resultará no dobro da distância; Interferometria; Efeito Doppler; e Diferença de Fase. Este último é o mais utilizado, por mensurar uma grandeza mais viável de ser obtida com precisão, que contudo carrega consigo a ambiguidade no número de ciclos completos, fornecendo apenas a parte fracional. A resolução da ambiguidade geralmente é resolvida pelo uso de diferentes comprimentos de onda modulada, comumente quatro, indo exponencialmente de 10m a 10km, de modo que o cada retorno indicará uma parte (em dígitos) da distância viajada, exemplo: 3123,456m surgirá de leituras como (3,456;23,45;123,4; e 3123).',
  'Já quanto aos citados elementos refletores (sistemas de alvos) de um EDM há basicamente dois princípios que são levados em consideração: reflexão total e reflexão difusa (Wolf, Ghillani, 2012). Nos primeiros, são usados os chamados prismas cúbicos (interseção de três espelhos planos de maneira ortogonal), que permitem que a onda (geralmente infravermelha) retorne íntegra ao equipamento, maximizando o alcance do mesmo. Por outro lado, nos sistemas de reflexão difusa, como nas populares trenas digitais, não há necessidade de prisma, contudo, apenas uma parcela do sinal é devolvido, o que demanda o uso de portadora LASER (feixe altamente colimado) e ainda assim em alguns casos ocorre falha, tais sistemas são menos precisos que os primeiros.',
  'Com relação à modelagem de erros sistemáticos que têm como fonte o equipamento, há três tipos principais que afetam os EDM: o erro de zero, que corresponde ao deslocamento entre a referência geométrica do EDM (ponto cardã em Estações Totais) e o emissor do EDM; o fator de escala, decorrente de variações de frequência da onda portadora; e o erro cíclico, com origem em possíveis diafonias (crosstalk) entre elementos emissores e receptores (Rueguer, 1991). Para sistemas com retrorefletores prismáticos há também a chamada constante do Prisma, que consiste em uma compensação em milímetros pela diferença entre o centro geométrico e o ponto teórico de efetivo retorno do sinal, fornecida pelo fabricante. A precisão nominal de um EDM é dada pela resultante de um fator A (remanescente dos erros sistemáticos) em mm e um fator B em ppm (proporcional à distância, também considerando a componente aleatória).',
  'Desse modo, se faz imprescindível a calibração periódica dos EDM para uso em levantamentos geodésicos, dado que a magnitude de seus erros sistemáticos pode variar em função do envelhecimento do cristal oscilador, constantes variações de temperatura e manuseio (Faggion, 2001). Há duas formas de realizar a calibração: em campo e em laboratório. No primeiro caso, similar às condições de operação, utilizam-se pilares estáveis (geralmente com centragem forçada) com distâncias planejadas bem determinadas, colineares e redundantes para modelagem conjunta ou sequencial dos parâmetros via ajustamento por mínimos quadrados. No laboratório há a vantagem de ter as condições atmosféricas controladas e possibilidade da determinação direta do fator de escala utilizando frequencímetros e osciloscópios (Faggion, 2001).',
  'Considerando o caminho percorrido pelo sinal emitido pelo EDM, é importante notar que o mesmo se propaga na atmosfera terrestre, que possui índice de refração, logo também velocidade de propagação, diferentes daquelas experienciadas no vácuo. Para medição mais acurada, se faz necessária a modelagem da atmosfera local, baseada em medições de temperatura (termômetro), umidade relativa (higrômetro) e pressão (barômetro), com a modelagem usual decorrendo da aplicação de tais medidas na equação homologada pela União Internacional de Geodésia e Geofísica - IUGG (Rueguer, 1991), sendo a correção dada em ppm (partes por milhão), isto é, proporcional à distância, ou seja, o não cálculo equivale a uma correção de 0 ppm, que não corresponde à correção para 0 C. Em média, o erro de 1 C na temperatura implica em 1 ppm de variação.',
  'Contudo, cabe lembrar que a assumpção de uma atmosfera constante ao longo de todo o percurso é uma simplificação prática conveniente, porém nem sempre suficiente para todas as aplicações. Especialmente em situações de grande extensão ou presença de fortes gradientes térmicos, o índice de refração variará de maneira diferencial ao longo do percurso, pois trata-se de um campo contínuo, provocando efeitos também na direção do feixe, objeto da chamada "segunda correção" (Rueguer, 1991). Tal modelagem trata-se de um dos maiores desafios de pesquisa para obtenção de medidas de maior precisão em ambientes não controlados, Carvahal (2018), por exemplo, propôs o emprego de uma rede de termômetros de baixo custo para uma aproximação mais acurada.',
  'No contexto histórico das Ciências Geodésicas, os EDM foram amplamente empregados em redes de trilateração (Wolf; Ghillani, 2012), sendo atualmente incorporados como componente essencial das Estações Totais, nas quais, integrados a teodolitos digitais e unidades computacionais, permitem a decomposição das distâncias espaciais em componentes horizontais, verticais e por consequência coordenadas no referencial instrumental. Nesse âmbito, tornam-se relevantes erros operacionais como centragem, nivelamento, pontaria e determinação das alturas de instrumento e alvo. Como parte das ET, os EDM são aplicados em trilateração, poligonais, levantamentos tridimensionais, monitoramento estrutural, topografia industrial e locação de obras. A adequada calibração, modelagem atmosférica e controle operacional validam o modelo estocástico nominal (erros aleatórios), enquanto a redundância observacional permite estimativas mais realistas da precisão, podendo indicar a necessidade de reclassificação instrumental conforme a NBR 13133 (2021).',
  'Conclui-se que os EDM constituem elemento basilar da Topografia e Geodésia na modernidade. Tendo como pilares documentais os certificados de calibração e classificação e os cuidados já descritos, como garantidores de uma qualidade que sustentará pontos e redes geodésicas. Seu emprego viabilizou produtividade em uma escala nunca antes vista, incluso em aplicações como as técnicas de LLR e SLR (medição de distâncias à Lua e Satélites, respectivamente), também nos sistemas Laser Scanner, terrestres ou dinâmicos, por fim, seus princípios básicos também foram utilizados para inspirar a constituição dos modernos sistemas de posicionamento por satélite.',
];

// ══════════════════════════════════════════════════════════════
// LAB 1 — Ambiguidade de fase
// ══════════════════════════════════════════════════════════════

const amb = {
  mode: 'explore',
  D: 3123.456,
  scaleIdx: 0,
  layers: { carrier: true, envelope: true, am: true },
  revealed: false,
};

const ambHidden = () => amb.mode === 'challenge' && !amb.revealed;

/** Painel 1 — modulação de amplitude sobre a portadora. */
function drawAmbCarrier(canvas, t) {
  const { ctx, w, h } = ensureSize(canvas);
  clearBg(ctx, w, h);
  const yc = h * 0.52;
  const A = h * 0.26;
  const m = 0.62;
  const wlMod = w / 2.4;           // comprimento de onda da modulação, em px
  const wlCar = Math.max(9, w / 46); // portadora (fora de escala, só ilustrativa)
  const ph = -t * 1.1;

  const envUp = (x) => A * (1 + m * Math.sin((2 * Math.PI * x) / wlMod + ph)) / (1 + m);

  // eixo
  line(ctx, 0, yc, w, yc, 'rgba(148,163,184,0.22)', { width: 1, dash: [4, 5] });

  if (amb.layers.carrier && !amb.layers.am) {
    sine(ctx, 8, w - 8, yc, A * 0.75, wlCar, 0, 'rgba(99,102,241,0.75)', { width: 1, step: 1 });
  } else if (amb.layers.carrier) {
    sine(ctx, 8, w - 8, yc, A * 0.75, wlCar, 0, 'rgba(99,102,241,0.28)', { width: 1, step: 1 });
  }

  if (amb.layers.am) {
    ctx.beginPath();
    for (let x = 8; x <= w - 8; x += 1) {
      const y = yc - envUp(x) * Math.cos((2 * Math.PI * x) / wlCar);
      x === 8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = C.recv;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (amb.layers.envelope) {
    [1, -1].forEach((sgn) => {
      ctx.beginPath();
      for (let x = 8; x <= w - 8; x += 1.5) {
        const y = yc - sgn * envUp(x);
        x === 8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.emit;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    });
    // marca λ entre dois máximos consecutivos da envoltória
    const xPeak = ((Math.PI / 2 - ph) / (2 * Math.PI)) * wlMod;
    let x1 = xPeak % wlMod;
    while (x1 < 20) x1 += wlMod;
    const x2 = x1 + wlMod;
    if (x2 < w - 12) dimArrow(ctx, x1, x2, h - 18, C.emitSoft, `λ = ${SCALES[amb.scaleIdx].U * 2} m`);
  }

  const U = SCALES[amb.scaleIdx].U;
  chip(ctx, `f_mod ≈ ${fmt(freqOf(U) / 1e6, 3)} MHz`, 8, 16, C.emitSoft, { align: 'left' });
  chip(ctx, 'portadora ~3×10¹⁴ Hz (fora de escala)', w - 8, 16, 'rgba(129,140,248,0.95)', { align: 'right' });
}

/** Painel 2 — percurso de ida e volta, com quebra de escala quando N é grande. */
function drawAmbPath(canvas, t) {
  const { ctx, w, h } = ensureSize(canvas);
  clearBg(ctx, w, h);
  const sc = SCALES[amb.scaleIdx];
  const r = scaleReading(amb.D, sc.U, sc.dec);
  const hide = ambHidden();

  // ── cena: EDM → prisma → EDM ──
  const yScene = 42;
  drawEDM(ctx, 46, yScene, 0.62, null);
  drawPrism(ctx, w - 46, yScene, 0.62, null);
  arrow(ctx, 66, yScene - 7, w - 66, yScene - 7, C.emit, { width: 1.5 });
  arrow(ctx, w - 66, yScene + 9, 66, yScene + 9, C.recv, { width: 1.5 });
  chip(ctx, hide ? 'D = ?' : `D = ${fmt(amb.D, 3)} m`, w / 2, 14, hide ? C.muted : C.emitSoft);

  // ── eixo desenrolado: 0 → 2D ──
  const ax0 = 26, ax1 = w - 26;
  const yAxis = 148;
  const amp = 24;
  const boxTop = yAxis - amp - 6, boxBot = yAxis + amp + 6;

  line(ctx, ax0, yAxis, ax1, yAxis, 'rgba(148,163,184,0.4)', { width: 1.4 });
  text(ctx, '0', ax0 - 8, yAxis, C.muted, { size: 9, align: 'right' });

  const N = r.N;
  const showAll = N <= 5;
  // Cada célula é um ciclo λ. Com N grande, mostramos 3 ciclos, uma quebra de
  // escala e a fração final — desenhar 312 ciclos seria sub-pixel e inútil.
  const cells = showAll ? N + 1 : 4;
  const gapForBreak = showAll ? 0 : 44;
  const cellW = (ax1 - ax0 - gapForBreak) / Math.max(0.3, cells - 1 + r.frac);

  const drawCycle = (xs, width, color, wid) => {
    ctx.beginPath();
    for (let px = 0; px <= width; px += 1.2) {
      const y = yAxis - amp * Math.sin((2 * Math.PI * px) / width);
      px === 0 ? ctx.moveTo(xs + px, y) : ctx.lineTo(xs + px, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = wid;
    ctx.stroke();
    line(ctx, xs, yAxis - 5, xs, yAxis + 5, 'rgba(148,163,184,0.5)', { width: 1 });
  };

  let x = ax0;
  const fullCycles = showAll ? N : 3;
  for (let i = 0; i < fullCycles; i++) {
    if (!showAll && i === 2) {
      // quebra de escala: duas barras inclinadas cortando o eixo
      const bx = x + gapForBreak / 2;
      [-5, 5].forEach((off) =>
        line(ctx, bx + off - 5, yAxis + 9, bx + off + 5, yAxis - 9, 'rgba(148,163,184,0.75)', { width: 1.6 }));
      if (!hide) text(ctx, `+${N - 3} ciclos`, bx, yAxis - 26, C.muted, { size: 8.5, align: 'center' });
      x += gapForBreak;
    }
    drawCycle(x, cellW, 'rgba(20,184,166,0.6)', 1.7);
    if (i === 0 && cellW < ax1 - ax0) {
      dimArrow(ctx, x, x + cellW, boxBot + 14, 'rgba(94,234,212,0.85)', `λ = ${lambdaOf(sc.U)} m`);
    }
    x += cellW;
  }
  if (fullCycles === 0) {
    text(ctx, `λ = ${lambdaOf(sc.U)} m — menos de um ciclo cabe no percurso`,
      ax1, boxBot + 16, 'rgba(94,234,212,0.85)', { align: 'right', size: 9.5 });
  }

  // ── fração final: o único trecho que a fase realmente mede ──
  const fw = Math.max(cellW * r.frac, 1.5);
  ctx.fillStyle = 'rgba(245,158,11,0.12)';
  ctx.fillRect(x, boxTop, fw, boxBot - boxTop);
  ctx.beginPath();
  for (let px = 0; px <= fw; px += 1) {
    const y = yAxis - amp * Math.sin((2 * Math.PI * px) / cellW);
    px === 0 ? ctx.moveTo(x + px, y) : ctx.lineTo(x + px, y);
  }
  ctx.strokeStyle = C.recv;
  ctx.lineWidth = 3;
  ctx.stroke();
  line(ctx, x, boxTop, x, boxBot, 'rgba(245,158,11,0.6)', { width: 1, dash: [3, 3] });

  // rótulos, todos fora da faixa vertical da caixa destacada
  const nChip = chip(ctx, hide ? 'N = ? ciclos inteiros' : `N = ${N} ciclos inteiros`,
    ax0, boxTop - 14, hide ? C.muted : 'rgba(20,184,166,0.95)', { align: 'left' });
  // só cabe à esquerda da fração se ela não começar logo após o chip de N
  if (x - 8 > nChip.x + nChip.w + 150) {
    text(ctx, 'a fase mede apenas Δλ →', x - 8, boxTop - 14, C.recv, { align: 'right', size: 9 });
  } else {
    text(ctx, 'a fase mede apenas Δλ', ax1, boxTop - 14, C.recv, { align: 'right', size: 9 });
  }
  chip(ctx, `Δλ = ${fmt(r.dLambda, 3)} m`, clamp(x + fw / 2, 70, w - 70), boxBot + 36, C.recv);
  text(ctx, hide ? '2D = N·λ + Δλ' : `2D = ${N}·${lambdaOf(sc.U)} + ${fmt(r.dLambda, 3)} = ${fmt(2 * amb.D, 3)} m`,
    w / 2, h - 10, C.text, { align: 'center', size: 10.5, mono: true, baseline: 'bottom' });
}

/** Painel 3 — comparação de fase entre referência interna e sinal recebido. */
function drawAmbPhase(canvas, t) {
  const { ctx, w, h } = ensureSize(canvas);
  clearBg(ctx, w, h);
  const sc = SCALES[amb.scaleIdx];
  const r = scaleReading(amb.D, sc.U, sc.dec);

  const dialR = Math.min(52, h * 0.3);
  const dialCx = w - dialR - 26;
  const plotW = dialCx - dialR - 34;
  const x0 = 14, x1 = Math.max(x0 + 60, plotW);
  const wl = (x1 - x0) / 1.9;
  const amp = 22;
  const y1 = h * 0.3, y2 = h * 0.68;
  const ph = -t * 1.4;
  const dphiRad = (r.dphi * Math.PI) / 180;

  [[y1, 'Referência interna', C.emit, 0], [y2, 'Sinal recebido (após 2D)', C.recv, -dphiRad]].forEach(([y, lbl, col, extra]) => {
    line(ctx, x0, y, x1, y, 'rgba(148,163,184,0.18)', { width: 1, dash: [4, 5] });
    sine(ctx, x0, x1, y, amp, wl, ph + extra, col, { width: 2.2 });
    text(ctx, lbl, x0, y - amp - 12, col, { size: 9.5 });
  });

  // marca a defasagem entre cristas correspondentes
  const peakOf = (extra) => {
    let px = ((Math.PI / 2 - (ph + extra)) / (2 * Math.PI)) * wl;
    px = ((px % wl) + wl) % wl;
    while (px < 30) px += wl;
    return x0 + px;
  };
  const pRef = peakOf(0);
  let pRec = peakOf(-dphiRad);
  if (pRec < pRef) pRec += wl;
  if (pRec < x1 - 8) {
    line(ctx, pRef, y1 - amp, pRef, y2 + amp + 12, 'rgba(20,184,166,0.5)', { width: 1, dash: [3, 3] });
    line(ctx, pRec, y2 - amp, pRec, y2 + amp + 12, 'rgba(245,158,11,0.6)', { width: 1, dash: [3, 3] });
    const yb = y2 + amp + 14;
    dimArrow(ctx, pRef, pRec, yb, C.emitSoft, `Δφ = ${fmt(r.dphi, 2)}°`);
  }

  // disco de fase
  const dialCy = h * 0.5;
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, dialR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15,23,42,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (let a = 0; a < 360; a += 30) {
    const rad = ((a - 90) * Math.PI) / 180;
    const inner = dialR - (a % 90 === 0 ? 10 : 5);
    line(ctx, dialCx + Math.cos(rad) * inner, dialCy + Math.sin(rad) * inner,
      dialCx + Math.cos(rad) * dialR, dialCy + Math.sin(rad) * dialR,
      a % 90 === 0 ? 'rgba(148,163,184,0.7)' : 'rgba(148,163,184,0.3)', { width: a % 90 === 0 ? 1.6 : 1 });
  }
  // setor varrido
  ctx.beginPath();
  ctx.moveTo(dialCx, dialCy);
  ctx.arc(dialCx, dialCy, dialR - 12, -Math.PI / 2, -Math.PI / 2 + dphiRad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245,158,11,0.18)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, dialR - 12, -Math.PI / 2, -Math.PI / 2 + dphiRad);
  ctx.strokeStyle = C.recv;
  ctx.lineWidth = 2;
  ctx.stroke();
  // ponteiro
  const nr = ((r.dphi - 90) * Math.PI) / 180;
  line(ctx, dialCx, dialCy, dialCx + Math.cos(nr) * (dialR - 8), dialCy + Math.sin(nr) * (dialR - 8), C.recv, { width: 2.4 });
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = C.recv;
  ctx.fill();
  text(ctx, '0°', dialCx, dialCy - dialR - 10, C.muted, { size: 8.5, align: 'center' });
  chip(ctx, `${fmt(r.dphi, 1)}°`, dialCx, dialCy + dialR + 14, C.recv);

  text(ctx, `Δλ = (Δφ/360°)·λ = ${fmt(r.dLambda, 3)} m   →   leitura = Δλ/2 = ${fmt(r.exact, 3)} m`,
    x0, h - 10, C.text, { size: 10, mono: true, baseline: 'bottom' });
}

// ── UI do laboratório de ambiguidade ──

function ambReadings() {
  return SCALES.map((s) => ({ s, r: scaleReading(amb.D, s.U, s.dec) }));
}

function renderAmbScaleButtons() {
  const host = document.getElementById('ambScaleBtns');
  host.innerHTML = '';
  SCALES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'scale-btn' + (i === amb.scaleIdx ? ' active' : '');
    b.textContent = s.label;
    b.title = `λ = ${lambdaOf(s.U)} m · f ≈ ${fmt(freqOf(s.U) / 1e6, 3)} MHz`;
    b.addEventListener('click', () => { amb.scaleIdx = i; renderAmbScaleButtons(); renderAmbTable(); });
    host.appendChild(b);
  });
}

function renderAmbTable() {
  const tbody = document.querySelector('#ambScaleTable tbody');
  tbody.innerHTML = '';
  const hide = ambHidden();
  ambReadings().forEach(({ s, r }, i) => {
    const tr = document.createElement('tr');
    if (i === amb.scaleIdx) tr.className = 'active-scale';
    tr.innerHTML =
      `<td>${s.label}</td>` +
      `<td>${lambdaOf(s.U)} m</td>` +
      `<td>${fmt(freqOf(s.U) / 1e6, 3)} MHz</td>` +
      `<td>${hide ? '?' : r.N}</td>` +
      `<td>${fmt(r.dphi, 2)}°</td>` +
      `<td class="reading">${fmt(r.reading, s.dec)}</td>`;
    tbody.appendChild(tr);
  });
  renderAmbCompose();
}

function renderAmbCompose() {
  const host = document.getElementById('ambComposeBox');
  const hide = ambHidden();
  const rows = ambReadings().slice().reverse(); // da escala mais grosseira para a mais fina
  const width = 9; // largura do campo antes da vírgula decimal
  let html = '';
  rows.forEach(({ s, r }) => {
    const str = fmt(r.reading, s.dec);
    const pad = '&nbsp;'.repeat(Math.max(0, width - str.split(',')[0].length));
    html += `<div><span class="cl">${s.label.padEnd(6, ' ').replace(/ /g, '&nbsp;')}</span> ${pad}<span class="known">${str}</span></div>`;
  });
  html += '<div class="rule"></div>';
  html += hide
    ? `<div><span class="cl">total&nbsp;</span> ${'&nbsp;'.repeat(width - 1)}<span class="unknown">? ? ? ?,? ? ?</span></div>`
    : `<div><span class="cl">total&nbsp;</span> ${'&nbsp;'.repeat(Math.max(0, width - fmt(amb.D, 3).split(',')[0].length))}<span class="total">${fmt(amb.D, 3)} m</span></div>`;
  host.innerHTML = html;
}

function setAmbDistance(D, fromInput = false) {
  amb.D = clamp(D, 0, 10000);
  const slider = document.getElementById('ambDistance');
  const num = document.getElementById('ambDistanceNum');
  if (!fromInput) num.value = fmt(amb.D, 3);
  slider.value = String(amb.D);
  renderAmbTable();
}

function newAmbChallenge() {
  amb.D = 1000 + Math.random() * 8999.999;
  amb.revealed = false;
  document.getElementById('ambInput').value = '';
  const box = document.getElementById('ambResultBox');
  box.style.display = 'none';
  box.classList.remove('success');
  setAmbDistance(amb.D);
}

function checkAmbAnswer() {
  const guess = parseNum(document.getElementById('ambInput').value);
  const box = document.getElementById('ambResultBox');
  const val = document.getElementById('ambResultValue');
  const sub = document.getElementById('ambResultSub');
  const ok = isFinite(guess) && Math.abs(guess - amb.D) <= 0.005;
  amb.revealed = true;
  box.style.display = 'block';
  box.classList.toggle('success', ok);
  val.textContent = `${ok ? '✅ ' : ''}${fmt(amb.D, 3)} m`;
  const parts = ambReadings().slice().reverse().map(({ s, r }) => fmt(r.reading, s.dec)).join('  /  ');
  sub.textContent = ok
    ? 'Distância reconstruída corretamente a partir das quatro leituras.'
    : `Combinando as leituras: ${parts} → ${fmt(amb.D, 3)} m`;
  renderAmbTable();
}

function setAmbMode(mode) {
  amb.mode = mode;
  amb.revealed = false;
  document.querySelectorAll('[data-amb-mode]').forEach((b) =>
    b.classList.toggle('active', b.dataset.ambMode === mode));
  document.getElementById('ambDistanceRow').hidden = mode === 'challenge';
  document.getElementById('ambChallengeArea').hidden = mode !== 'challenge';
  if (mode === 'challenge') newAmbChallenge();
  else renderAmbTable();
}

function initAmbiguityLab() {
  renderAmbScaleButtons();
  renderAmbTable();

  document.getElementById('ambDistance').addEventListener('input', (e) => setAmbDistance(parseFloat(e.target.value)));
  document.getElementById('ambDistanceNum').addEventListener('input', (e) => {
    const v = parseNum(e.target.value);
    if (isFinite(v)) setAmbDistance(v, true);
  });
  document.querySelectorAll('#ambLayerToggles .layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.layer;
      amb.layers[k] = !amb.layers[k];
      btn.classList.toggle('active', amb.layers[k]);
    });
  });
  document.querySelectorAll('[data-amb-mode]').forEach((b) =>
    b.addEventListener('click', () => setAmbMode(b.dataset.ambMode)));
  document.getElementById('btnAmbCheck').addEventListener('click', checkAmbAnswer);
  document.getElementById('btnAmbNew').addEventListener('click', newAmbChallenge);
  document.getElementById('ambInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAmbAnswer();
  });
}

// ══════════════════════════════════════════════════════════════
// LAB 2 — Erros sistemáticos
// ══════════════════════════════════════════════════════════════

const errState = {
  zero: 4, scale: 6, cyclic: 3, A: 2, B: 2,
  show: { zero: true, scale: true, cyclic: true, nominal: true },
};
const CYCLIC_PERIOD = 10; // m — período do erro cíclico = escala fina U

function errComponents(d) {
  const z = errState.show.zero ? errState.zero : 0;
  const s = errState.show.scale ? (errState.scale * d) / 1000 : 0;
  const c = errState.show.cyclic ? errState.cyclic * Math.sin((2 * Math.PI * d) / CYCLIC_PERIOD) : 0;
  return { z, s, c, total: z + s + c };
}

function drawErrPlot(canvas) {
  const { ctx, w, h } = ensureSize(canvas);
  clearBg(ctx, w, h, false);

  const gap = 26;
  const ph = (h - gap - 26) / 2;
  drawErrPanel(ctx, w, 18, ph, 0, 5000, 'Visão geral — 0 a 5 km', false);
  drawErrPanel(ctx, w, 18 + ph + gap, ph, 0, 40, 'Zoom — 0 a 40 m (erro cíclico resolvido)', true);
}

function drawErrPanel(ctx, w, top, ph, d0, d1, title, zoom) {
  const padL = 46, padR = 16;
  const x0 = padL, x1 = w - padR;
  const yMid = top + ph / 2;

  // escala vertical: acomoda o pior caso do intervalo
  let maxAbs = 1;
  for (let i = 0; i <= 60; i++) {
    const d = d0 + ((d1 - d0) * i) / 60;
    const { total } = errComponents(d);
    maxAbs = Math.max(maxAbs, Math.abs(total));
  }
  if (errState.show.nominal) maxAbs = Math.max(maxAbs, errState.A + (errState.B * d1) / 1000);
  maxAbs *= 1.25;
  const yOf = (mm) => yMid - (mm / maxAbs) * (ph / 2 - 6);
  const xOf = (d) => x0 + ((d - d0) / (d1 - d0)) * (x1 - x0);

  // moldura
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, top, x1 - x0, ph);
  text(ctx, title, x0, top - 7, C.muted, { size: 9.5, baseline: 'bottom' });

  // faixa de precisão nominal ±(A + B ppm)
  if (errState.show.nominal) {
    ctx.beginPath();
    ctx.moveTo(x0, yOf(errState.A + (errState.B * d0) / 1000));
    ctx.lineTo(x1, yOf(errState.A + (errState.B * d1) / 1000));
    ctx.lineTo(x1, yOf(-(errState.A + (errState.B * d1) / 1000)));
    ctx.lineTo(x0, yOf(-(errState.A + (errState.B * d0) / 1000)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(148,163,184,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // eixo zero
  line(ctx, x0, yMid, x1, yMid, 'rgba(148,163,184,0.35)', { width: 1 });
  text(ctx, '0', x0 - 6, yMid, C.muted, { size: 9, align: 'right' });
  text(ctx, `+${fmt(maxAbs, 0)}`, x0 - 6, top + 8, C.muted, { size: 9, align: 'right' });
  text(ctx, `−${fmt(maxAbs, 0)}`, x0 - 6, top + ph - 8, C.muted, { size: 9, align: 'right' });
  text(ctx, 'mm', x0 - 6, top - 6, C.muted, { size: 8.5, align: 'right', baseline: 'bottom' });
  text(ctx, zoom ? `${d1} m` : `${d1 / 1000} km`, x1, top + ph + 12, C.muted, { size: 9, align: 'right' });

  // componentes individuais
  const comps = [
    { on: errState.show.zero, col: 'rgba(20,184,166,0.55)', f: (d) => errComponents(d).z },
    { on: errState.show.scale, col: 'rgba(99,102,241,0.6)', f: (d) => errComponents(d).s },
    { on: errState.show.cyclic && zoom, col: 'rgba(245,158,11,0.55)', f: (d) => errComponents(d).c },
  ];
  comps.forEach(({ on, col, f }) => {
    if (!on) return;
    ctx.beginPath();
    for (let px = x0; px <= x1; px += 1.5) {
      const d = d0 + ((px - x0) / (x1 - x0)) * (d1 - d0);
      const y = yOf(f(d));
      px === x0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Total. No painel macro o termo cíclico (período de 10 m) não é resolvível
  // — amostrá-lo aqui só produziria serrilhado, então ele vira envelope abaixo.
  ctx.beginPath();
  for (let px = x0; px <= x1; px += 1) {
    const d = d0 + ((px - x0) / (x1 - x0)) * (d1 - d0);
    const { z, s, c } = errComponents(d);
    const y = yOf(zoom ? z + s + c : z + s);
    px === x0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
  }
  ctx.strokeStyle = C.err;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // no painel macro o erro cíclico vira uma faixa (não é resolvível na escala)
  if (!zoom && errState.show.cyclic && errState.cyclic > 0) {
    [1, -1].forEach((sgn) => {
      ctx.beginPath();
      for (let px = x0; px <= x1; px += 2) {
        const d = d0 + ((px - x0) / (x1 - x0)) * (d1 - d0);
        const { z, s } = errComponents(d);
        const y = yOf(z + s + sgn * errState.cyclic);
        px === x0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.strokeStyle = 'rgba(245,158,11,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    text(ctx, 'envelope cíclico (período de 10 m, não resolvível nesta escala)',
      x1 - 4, top + ph - 8, 'rgba(245,158,11,0.7)', { size: 8.5, align: 'right' });
  }
}

function renderErrReadout() {
  const host = document.getElementById('errReadout');
  const dists = [100, 1000, 5000];
  host.innerHTML = dists.map((d) => {
    const { total } = errComponents(d);
    const nominal = errState.A + (errState.B * d) / 1000;
    const bad = Math.abs(total) > nominal;
    return `<div class="readout-item ${bad ? 'bad' : ''}">
      <div class="ro-label">erro em ${d >= 1000 ? d / 1000 + ' km' : d + ' m'}</div>
      <div class="ro-value">${total >= 0 ? '+' : '−'}${fmt(Math.abs(total), 1)} mm</div>
      <div class="ro-sub">nominal ±${fmt(nominal, 1)} mm</div>
    </div>`;
  }).join('');
}

function initErrorsLab() {
  const bind = (id, key, outId, suffix, dec) => {
    const el = document.getElementById(id);
    const out = document.getElementById(outId);
    const upd = () => {
      errState[key] = parseFloat(el.value);
      const v = errState[key];
      out.textContent = `${v > 0 && (key === 'zero' || key === 'scale') ? '+' : ''}${fmt(v, dec)} ${suffix}`;
      renderErrReadout();
    };
    el.addEventListener('input', upd);
    upd();
  };
  bind('errZero', 'zero', 'errZeroOut', 'mm', 1);
  bind('errScale', 'scale', 'errScaleOut', 'ppm', 1);
  bind('errCyclic', 'cyclic', 'errCyclicOut', 'mm', 1);

  ['errA', 'errB'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      errState[id === 'errA' ? 'A' : 'B'] = parseFloat(el.value) || 0;
      renderErrReadout();
    });
  });

  document.querySelectorAll('[data-err]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.err;
      errState.show[k] = !errState.show[k];
      btn.classList.toggle('active', errState.show[k]);
      renderErrReadout();
    });
  });
  renderErrReadout();
}

// ══════════════════════════════════════════════════════════════
// LAB 3 — Correção atmosférica
// ══════════════════════════════════════════════════════════════

const atmState = { t: 12, p: 1013.25, h: 60, d: 2000 };
const ATM_STANDARD = { t: 12, p: 1013.25, h: 60 };

function drawAtm(canvas, time) {
  const { ctx, w, h } = ensureSize(canvas);
  clearBg(ctx, w, h);
  const ppm = atmPpm(atmState.t, atmState.p, atmState.h);

  // cena com a atmosfera tingida conforme o sinal da correção
  const y = h * 0.32;
  const warm = clamp(ppm / 40, -1, 1);
  const tint = warm >= 0
    ? `rgba(245,158,11,${0.05 + warm * 0.14})`
    : `rgba(56,189,248,${0.05 + Math.abs(warm) * 0.14})`;
  ctx.fillStyle = tint;
  ctx.fillRect(0, y - 52, w, 104);
  for (let i = 0; i < 3; i++) {
    sine(ctx, 0, w, y - 34 + i * 34, 3 + i, 70 + i * 26, time * (0.9 + i * 0.35),
      warm >= 0 ? 'rgba(245,158,11,0.22)' : 'rgba(56,189,248,0.22)', { width: 1 });
  }
  drawEDM(ctx, 44, y, 0.6, null);
  drawPrism(ctx, w - 44, y, 0.6, null);
  const pulse = (time * 0.5) % 1;
  line(ctx, 62, y, w - 62, y, 'rgba(148,163,184,0.35)', { width: 1.2, dash: [5, 5] });
  ctx.beginPath();
  ctx.arc(62 + (w - 124) * pulse, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = C.emit;
  ctx.fill();
  text(ctx, `${fmt(atmState.t, 1)} °C · ${fmt(atmState.p, 1)} hPa · ${atmState.h} %`,
    w / 2, y - 66, C.text, { align: 'center', size: 10, mono: true });

  // escala de ppm
  const gx0 = 42, gx1 = w - 42, gy = h * 0.76;
  const PMIN = -40, PMAX = 60;
  const xOf = (v) => gx0 + ((clamp(v, PMIN, PMAX) - PMIN) / (PMAX - PMIN)) * (gx1 - gx0);
  const grad = ctx.createLinearGradient(gx0, 0, gx1, 0);
  grad.addColorStop(0, 'rgba(56,189,248,0.35)');
  grad.addColorStop((0 - PMIN) / (PMAX - PMIN), 'rgba(148,163,184,0.3)');
  grad.addColorStop(1, 'rgba(245,158,11,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(gx0, gy - 9, gx1 - gx0, 18);
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx0, gy - 9, gx1 - gx0, 18);

  for (let v = PMIN; v <= PMAX; v += 20) {
    const x = xOf(v);
    line(ctx, x, gy + 9, x, gy + 14, 'rgba(148,163,184,0.5)', { width: 1 });
    text(ctx, String(v), x, gy + 24, C.muted, { size: 8.5, align: 'center' });
  }
  // marca do zero = "sem correção"
  const zx = xOf(0);
  line(ctx, zx, gy - 16, zx, gy + 16, 'rgba(148,163,184,0.9)', { width: 1.5 });
  text(ctx, '0 ppm = sem correção', zx, gy - 22, C.ref, { size: 9, align: 'center' });

  // ponteiro
  const px = xOf(ppm);
  ctx.beginPath();
  ctx.moveTo(px, gy - 13);
  ctx.lineTo(px - 6, gy - 24);
  ctx.lineTo(px + 6, gy - 24);
  ctx.closePath();
  ctx.fillStyle = C.emitSoft;
  ctx.fill();
  chip(ctx, `${ppm >= 0 ? '+' : '−'}${fmt(Math.abs(ppm), 2)} ppm`, clamp(px, 60, w - 60), gy + 40, C.emitSoft);
  text(ctx, 'ppm', gx1, gy - 20, C.muted, { size: 9, align: 'right' });
}

function renderAtmReadout() {
  const ppm = atmPpm(atmState.t, atmState.p, atmState.h);
  const corrMm = (ppm * atmState.d) / 1000;
  const sens = atmPpm(atmState.t + 1, atmState.p, atmState.h) - ppm;
  document.getElementById('atmReadout').innerHTML = `
    <div class="readout-item">
      <div class="ro-label">correção</div>
      <div class="ro-value">${ppm >= 0 ? '+' : '−'}${fmt(Math.abs(ppm), 2)}</div>
      <div class="ro-sub">ppm</div>
    </div>
    <div class="readout-item ${Math.abs(corrMm) > 10 ? 'warn' : ''}">
      <div class="ro-label">em ${atmState.d} m</div>
      <div class="ro-value">${corrMm >= 0 ? '+' : '−'}${fmt(Math.abs(corrMm), 1)}</div>
      <div class="ro-sub">mm</div>
    </div>
    <div class="readout-item">
      <div class="ro-label">distância corrigida</div>
      <div class="ro-value">${fmt(atmState.d * (1 + ppm * 1e-6), 3)}</div>
      <div class="ro-sub">m (medida: ${atmState.d} m)</div>
    </div>
    <div class="readout-item">
      <div class="ro-label">sensibilidade</div>
      <div class="ro-value">${sens >= 0 ? '+' : '−'}${fmt(Math.abs(sens), 2)}</div>
      <div class="ro-sub">ppm por °C</div>
    </div>`;
}

function initAtmosphereLab() {
  const bind = (id, key, outId, suffix, dec) => {
    const el = document.getElementById(id);
    const out = document.getElementById(outId);
    const upd = () => {
      atmState[key] = parseFloat(el.value);
      out.textContent = `${fmt(atmState[key], dec)} ${suffix}`;
      renderAtmReadout();
    };
    el.addEventListener('input', upd);
    upd();
    return el;
  };
  const tEl = bind('atmTemp', 't', 'atmTempOut', '°C', 1);
  const pEl = bind('atmPress', 'p', 'atmPressOut', 'hPa', 1);
  const hEl = bind('atmHum', 'h', 'atmHumOut', '%', 0);
  bind('atmDist', 'd', 'atmDistOut', 'm', 0);

  document.getElementById('btnAtmStandard').addEventListener('click', () => {
    tEl.value = ATM_STANDARD.t; pEl.value = ATM_STANDARD.p; hEl.value = ATM_STANDARD.h;
    [tEl, pEl, hEl].forEach((el) => el.dispatchEvent(new Event('input')));
  });
  renderAtmReadout();
}

// ══════════════════════════════════════════════════════════════
// Navegação e loop de animação
// ══════════════════════════════════════════════════════════════

let currentIndex = 0;
let startTime = null;
const LABS = { ambiguity: 'labAmbiguity', errors: 'labErrors', atmosphere: 'labAtmosphere' };

function buildNav() {
  const nav = document.getElementById('topicNav');
  nav.innerHTML = '';
  TOPICS.forEach((topic, i) => {
    const item = document.createElement('div');
    item.className = 'topic-nav-item';
    item.innerHTML =
      `<span class="topic-num">${i + 1}</span><span class="topic-label">${topic.title}</span>` +
      (topic.lab ? '<span class="badge-interactive">lab</span>' : '');
    item.addEventListener('click', () => selectTopic(i));
    nav.appendChild(item);
  });
}

function updateStepDots() {
  const host = document.getElementById('stepIndicator');
  host.innerHTML = '';
  TOPICS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i === currentIndex ? ' active' : '');
    host.appendChild(d);
  });
}

function selectTopic(i) {
  currentIndex = i;
  const topic = TOPICS[i];

  document.querySelectorAll('.topic-nav-item').forEach((el, idx) =>
    el.classList.toggle('active', idx === i));

  document.getElementById('topicBreadcrumb').textContent = `Tópico ${i + 1} de ${TOPICS.length}`;
  document.getElementById('topicTitle').textContent = topic.title;
  document.getElementById('topicSummary').innerHTML = topic.summary;
  document.getElementById('topicKeyPoints').innerHTML =
    topic.keyPoints.map((k) => `<li><span>${k}</span></li>`).join('');
  document.getElementById('topicSource').textContent = SOURCE[i];
  updateStepDots();

  document.getElementById('animCanvasWrap').hidden = !!topic.lab;
  Object.entries(LABS).forEach(([key, id]) => {
    document.getElementById(id).hidden = topic.lab !== key;
  });

  document.getElementById('btnPrev').disabled = i === 0;
  document.getElementById('btnNext').disabled = i === TOPICS.length - 1;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function animLoop(now) {
  if (startTime === null) startTime = now;
  const t = (now - startTime) / 1000;
  const topic = TOPICS[currentIndex];

  if (topic.lab === 'ambiguity') {
    drawAmbCarrier(document.getElementById('ambCarrierCanvas'), t);
    drawAmbPath(document.getElementById('ambPathCanvas'), t);
    drawAmbPhase(document.getElementById('ambPhaseCanvas'), t);
  } else if (topic.lab === 'errors') {
    drawErrPlot(document.getElementById('errCanvas'));
  } else if (topic.lab === 'atmosphere') {
    drawAtm(document.getElementById('atmCanvas'), t);
  } else if (topic.render) {
    const canvas = document.getElementById('animCanvas');
    const { ctx, w, h } = ensureSize(canvas);
    clearBg(ctx, w, h);
    topic.render(ctx, w, h, t);
  }
  requestAnimationFrame(animLoop);
}

document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  initAmbiguityLab();
  initErrorsLab();
  initAtmosphereLab();

  document.getElementById('btnPrev').addEventListener('click', () => {
    if (currentIndex > 0) selectTopic(currentIndex - 1);
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    if (currentIndex < TOPICS.length - 1) selectTopic(currentIndex + 1);
  });

  selectTopic(0);
  requestAnimationFrame(animLoop);
});
