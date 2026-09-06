/**
 * Simulador Didático de Direções Horizontais
 * ──────────────────────────────────────────
 * Ensina o conceito de medição de ângulos horizontais em topografia
 * através de exercícios interativos em Canvas 2D.
 */

// ── Utility: Angle formatting ──

/** Converts decimal degrees to { d, m, s } */
function decToDMS(decDeg) {
  const sign = decDeg < 0 ? -1 : 1;
  let dd = Math.abs(decDeg);
  const d = Math.floor(dd);
  dd = (dd - d) * 60;
  const m = Math.floor(dd);
  const s = (dd - m) * 60;
  return { d: d * sign, m, s };
}

/** Formats decimal degrees as GG°MM'SS.s" */
function formatDMS(decDeg) {
  const { d, m, s } = decToDMS(Math.abs(decDeg));
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`;
}

/** Normalizes angle to [0, 360) */
function normAngle(a) {
  return ((a % 360) + 360) % 360;
}

/** Distance between two points */
function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ── Constants ──
const COLORS = {
  station: '#06b6d4',   // cyan
  re:      '#f59e0b',   // amber
  vante:   '#10b981',   // emerald
  arc:     'rgba(99, 102, 241, 0.55)',
  arcFill: 'rgba(99, 102, 241, 0.08)',
  arrow:   '#a855f7',   // purple
  line:    'rgba(148, 163, 184, 0.35)',
  lineAim: 'rgba(6, 182, 212, 0.6)',
  grid:    'rgba(148, 163, 184, 0.06)',
  bg:      '#0b1120',
};

const POINT_RADIUS = 8;
const LABEL_OFFSET = 22;
const ARC_RADIUS = 50;
const MIN_DIST = 100;

// ── Configurable snap tolerance (degrees) ──
// The user must click within ±SNAP_TOLERANCE_DEG of the Vante direction to register
const SNAP_TOLERANCE_DEG = 3;

// ── State ──
const state = {
  // Config
  zeroedOnRe: true,     // true = leitura de Ré = 0°
  clockwise: true,      // sentido horário
  
  // Exercise
  exerciseCount: 0,
  points: { station: null, re: null, vante: null },
  reLeitura: 0,         // leitura atribuída à Ré (deg)
  zeroMathAngle: null,  // math angle (rad) of the instrument's zero direction (for non-oriented mode)
  
  // Interaction
  aimAngle: null,        // ângulo de pontaria do usuário (rad, math convention)
  isAiming: false,
  solved: false,
  snapMiss: false,       // true when click was outside snap tolerance
  
  // Computed
  angleResult: null,     // ângulo horizontal calculado (deg)
  vanteLeitura: null,    // leitura no vante (deg)
};

// ── DOM Refs ──
let canvas, ctx;
let modalOverlay1, modalOverlay2;
let resultValueEl, resultBoxEl;
let readingReEl, readingVanteEl;
let hintEl, counterEl;

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  canvas  = document.getElementById('simCanvas');
  ctx     = canvas.getContext('2d');
  
  modalOverlay1 = document.getElementById('modal1');
  modalOverlay2 = document.getElementById('modal2');
  
  resultValueEl  = document.getElementById('resultValue');
  resultBoxEl    = document.getElementById('resultBox');
  readingReEl    = document.getElementById('readingRe');
  readingVanteEl = document.getElementById('readingVante');
  hintEl         = document.getElementById('canvasHint');
  counterEl      = document.getElementById('exerciseCount');
  
  // Modal buttons
  document.getElementById('btnModal1Next').addEventListener('click', () => {
    hideModal(modalOverlay1);
    setTimeout(() => {
      showModal(modalOverlay2);
      drawModalDiagram();
    }, 300);
  });
  document.getElementById('btnModal2Start').addEventListener('click', () => {
    hideModal(modalOverlay2);
    setTimeout(() => startExercise(), 350);
  });
  
  // Config buttons
  document.querySelectorAll('[data-cfg-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cfg-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.zeroedOnRe = btn.dataset.cfgMode === 'zeroed';
      if (state.points.station) resetCurrentExercise();
    });
  });
  
  document.querySelectorAll('[data-cfg-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cfg-dir]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.clockwise = btn.dataset.cfgDir === 'cw';
      if (state.points.station) resetCurrentExercise();
    });
  });
  
  document.getElementById('btnNewExercise').addEventListener('click', startExercise);
  
  // Canvas events
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mousedown', onCanvasDown);
  canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
  canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
  
  // Resize
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (state.points.station) drawScene();
  });
  
  // Show first modal
  setTimeout(() => {
    showModal(modalOverlay1);
    drawModal1Diagram();
  }, 500);
});

// ── Canvas sizing ──
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ── Modal Logic ──
function showModal(el) {
  el.classList.add('active');
}

function hideModal(el) {
  el.classList.remove('active');
}

// ── Modal 1 Illustrative Diagram ──
function drawModal1Diagram() {
  const m1Canvas = document.getElementById('modal1DiagramCanvas');
  if (!m1Canvas) return;
  const dctx = m1Canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = m1Canvas.parentElement.clientWidth;
  const h = 260;
  m1Canvas.width = w * dpr;
  m1Canvas.height = h * dpr;
  m1Canvas.style.height = h + 'px';
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  dctx.fillStyle = '#0b1120';
  dctx.fillRect(0, 0, w, h);

  // Soft grid
  dctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
  dctx.lineWidth = 0.5;
  for (let x = 30; x < w; x += 30) {
    dctx.beginPath();
    dctx.moveTo(x, 0);
    dctx.lineTo(x, h);
    dctx.stroke();
  }
  for (let y = 30; y < h; y += 30) {
    dctx.beginPath();
    dctx.moveTo(0, y);
    dctx.lineTo(w, y);
    dctx.stroke();
  }

  // Terrain contour line
  dctx.beginPath();
  dctx.moveTo(0, h * 0.78);
  dctx.bezierCurveTo(w * 0.2, h * 0.72, w * 0.5, h * 0.84, w * 0.8, h * 0.75);
  dctx.lineTo(w, h * 0.77);
  dctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  dctx.lineWidth = 1.5;
  dctx.setLineDash([4, 4]);
  dctx.stroke();
  dctx.setLineDash([]);

  // Positions
  const stationPos = { x: w * 0.48, y: h * 0.55 };
  const rePos      = { x: w * 0.16, y: h * 0.32 };
  const vantePos   = { x: w * 0.84, y: h * 0.28 };

  // Sight lines
  function drawModalLine(from, to, color) {
    dctx.beginPath();
    dctx.moveTo(from.x, from.y);
    dctx.lineTo(to.x, to.y);
    dctx.strokeStyle = color;
    dctx.lineWidth = 2;
    dctx.setLineDash([6, 5]);
    dctx.stroke();
    dctx.setLineDash([]);
  }
  drawModalLine(stationPos, rePos, COLORS.re);
  drawModalLine(stationPos, vantePos, COLORS.vante);

  // Arc between sight lines at station
  const aRe = Math.atan2(-(rePos.y - stationPos.y), rePos.x - stationPos.x);
  const aVa = Math.atan2(-(vantePos.y - stationPos.y), vantePos.x - stationPos.x);
  const m1ArcR = 52;
  dctx.beginPath();
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.arc(stationPos.x, stationPos.y, m1ArcR, -aRe, -aVa, false);
  dctx.closePath();
  dctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
  dctx.fill();
  dctx.beginPath();
  dctx.arc(stationPos.x, stationPos.y, m1ArcR, -aRe, -aVa, false);
  dctx.strokeStyle = '#a855f7';
  dctx.lineWidth = 2.5;
  dctx.stroke();

  // Arrow on arc
  const midA = (-aRe + -aVa) / 2;
  const tipX = stationPos.x + Math.cos(-aVa) * m1ArcR;
  const tipY = stationPos.y + Math.sin(-aVa) * m1ArcR;
  const tang = -aVa - Math.PI / 2;
  dctx.beginPath();
  dctx.moveTo(tipX, tipY);
  dctx.lineTo(tipX - Math.cos(tang - 0.5) * 8, tipY - Math.sin(tang - 0.5) * 8);
  dctx.moveTo(tipX, tipY);
  dctx.lineTo(tipX - Math.cos(tang + 0.5) * 8, tipY - Math.sin(tang + 0.5) * 8);
  dctx.strokeStyle = '#a855f7';
  dctx.lineWidth = 2;
  dctx.stroke();

  // Arc label "Ângulo Hz"
  const lblR = m1ArcR + 20;
  const lx = stationPos.x + Math.cos(midA) * lblR;
  const ly = stationPos.y + Math.sin(midA) * lblR;
  const hzTxt = 'Ângulo Hz';
  dctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  const hzm = dctx.measureText(hzTxt);
  dctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  dctx.beginPath();
  dctx.roundRect(lx - hzm.width / 2 - 8, ly - 10, hzm.width + 16, 20, 5);
  dctx.fill();
  dctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  dctx.lineWidth = 1;
  dctx.stroke();
  dctx.fillStyle = '#a855f7';
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  dctx.fillText(hzTxt, lx, ly);

  // Tripod at station
  const legLen = 42;
  dctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
  dctx.lineWidth = 2;
  dctx.beginPath();
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.lineTo(stationPos.x - 18, stationPos.y + legLen);
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.lineTo(stationPos.x + 18, stationPos.y + legLen);
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.lineTo(stationPos.x, stationPos.y + legLen * 1.08);
  dctx.stroke();

  // Ground markers under tripod legs
  dctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  [-18, 0, 18].forEach(dx => {
    dctx.beginPath();
    dctx.arc(stationPos.x + dx, stationPos.y + legLen, 2, 0, Math.PI * 2);
    dctx.fill();
  });

  // Points (Ré, Vante, Estação)
  function drawModalPoint(pos, label, sublabel, color, align = 'left') {
    // Glow
    const grad = dctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 18);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, 'transparent');
    dctx.beginPath();
    dctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    dctx.fillStyle = grad;
    dctx.fill();

    // Circle
    dctx.beginPath();
    dctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
    dctx.fillStyle = color;
    dctx.fill();
    dctx.strokeStyle = '#fff';
    dctx.lineWidth = 2;
    dctx.stroke();

    // Prism rod under Ré and Vante
    dctx.beginPath();
    dctx.moveTo(pos.x, pos.y + 7);
    dctx.lineTo(pos.x, pos.y + 36);
    dctx.strokeStyle = color + '80';
    dctx.lineWidth = 2;
    dctx.stroke();
    // Prism foot
    dctx.beginPath();
    dctx.arc(pos.x, pos.y + 36, 2.5, 0, Math.PI * 2);
    dctx.fillStyle = color;
    dctx.fill();

    // Card background
    dctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    const lm = dctx.measureText(label);
    const subw = dctx.measureText(sublabel).width;
    const boxW = Math.max(lm.width, subw) + 14;
    const boxH = 38;
    const lbx = align === 'right' ? pos.x - boxW - 12 : pos.x + 12;
    const lby = pos.y - 18;

    dctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
    dctx.beginPath();
    dctx.roundRect(lbx, lby, boxW, boxH, 6);
    dctx.fill();
    dctx.strokeStyle = color + '40';
    dctx.lineWidth = 1;
    dctx.stroke();

    dctx.fillStyle = color;
    dctx.textAlign = 'left';
    dctx.textBaseline = 'top';
    dctx.fillText(label, lbx + 7, lby + 6);
    // Sublabel
    dctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
    dctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    dctx.fillText(sublabel, lbx + 7, lby + 22);
  }

  drawModalPoint(rePos, 'Ré', 'Referência', COLORS.re, 'right');
  drawModalPoint(vantePos, 'Vante', 'Ponto visado', COLORS.vante, 'left');
}

// ── Modal 2 Diagram ──
function drawModalDiagram() {
  const diagCanvas = document.getElementById('modalDiagramCanvas');
  if (!diagCanvas) return;
  const dctx = diagCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = diagCanvas.parentElement.clientWidth;
  const h = 300;
  diagCanvas.width = w * dpr;
  diagCanvas.height = h * dpr;
  diagCanvas.style.height = h + 'px';
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  // Draw diagram showing angle as difference of two readings (Figura 6.15 do livro)
  const cx = w / 2, cy = h / 2 + 10;
  const r = 95;
  
  // Grid background
  dctx.fillStyle = '#0b1120';
  dctx.fillRect(0, 0, w, h);
  
  // Circle (graduated limb)
  dctx.beginPath();
  dctx.arc(cx, cy, r, 0, Math.PI * 2);
  dctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  dctx.lineWidth = 1;
  dctx.stroke();
  
  // Tick marks
  for (let i = 0; i < 36; i++) {
    const a = (i * 10) * Math.PI / 180;
    const inner = i % 9 === 0 ? r - 14 : r - 7;
    dctx.beginPath();
    dctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    dctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    dctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    dctx.lineWidth = i % 9 === 0 ? 2 : 0.8;
    dctx.stroke();
  }

  // Angles (canvas angles in radians, clockwise progression)
  const a0 = -105 * Math.PI / 180; // 0° direction (up-left)
  const aRe = -40 * Math.PI / 180; // Ré direction (up-right)
  const aVa = 35 * Math.PI / 180;  // Vante direction (down-right)

  // 1. Ray 0° (Origem do Limbo)
  const r0Len = r + 26;
  const p0 = { x: cx + Math.cos(a0) * r0Len, y: cy + Math.sin(a0) * r0Len };
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.lineTo(p0.x, p0.y);
  dctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  dctx.lineWidth = 2;
  dctx.setLineDash([5, 4]);
  dctx.stroke();
  dctx.setLineDash([]);

  // Arrowhead on 0°
  drawArrowTip(dctx, p0.x, p0.y, a0, 'rgba(148, 163, 184, 0.9)');

  // Badge: 0° (Origem)
  const b0x = cx + Math.cos(a0) * (r0Len + 18);
  const b0y = cy + Math.sin(a0) * (r0Len + 18);
  drawBadge(dctx, '0° (Origem)', b0x, b0y, '#cbd5e1', 'rgba(148, 163, 184, 0.4)');

  // 2. Direction Ré
  const reLen = r + 26;
  const pRe = { x: cx + Math.cos(aRe) * reLen, y: cy + Math.sin(aRe) * reLen };
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.lineTo(pRe.x, pRe.y);
  dctx.strokeStyle = COLORS.re;
  dctx.lineWidth = 2;
  dctx.setLineDash([6, 4]);
  dctx.stroke();
  dctx.setLineDash([]);

  // Ré point
  dctx.beginPath();
  dctx.arc(pRe.x, pRe.y, 6, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.re;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 1.5;
  dctx.stroke();

  // Label Ré & L1
  drawBadge(dctx, 'Ré: L₁ = 65°15\'', pRe.x + 45, pRe.y - 4, COLORS.re, 'rgba(245, 158, 11, 0.4)');

  // 3. Direction Vante
  const vaLen = r + 26;
  const pVa = { x: cx + Math.cos(aVa) * vaLen, y: cy + Math.sin(aVa) * vaLen };
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.lineTo(pVa.x, pVa.y);
  dctx.strokeStyle = COLORS.vante;
  dctx.lineWidth = 2;
  dctx.setLineDash([6, 4]);
  dctx.stroke();
  dctx.setLineDash([]);

  // Vante point
  dctx.beginPath();
  dctx.arc(pVa.x, pVa.y, 6, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.vante;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 1.5;
  dctx.stroke();

  // Label Vante & L2
  drawBadge(dctx, 'Vante: L₂ = 140°30\'', pVa.x + 55, pVa.y + 4, COLORS.vante, 'rgba(16, 185, 129, 0.4)');

  // ── 3 Arcs matching Figura 6.15 ──
  // Arc 1: L1 (0° → Ré, amber, R = 42)
  drawArcWithLabel(dctx, cx, cy, 42, a0, aRe, COLORS.re, 'rgba(245, 158, 11, 0.1)', 'L₁');

  // Arc 2: L2 (0° → Vante, emerald, R = 64)
  drawArcWithLabel(dctx, cx, cy, 64, a0, aVa, COLORS.vante, 'rgba(16, 185, 129, 0.1)', 'L₂');

  // Arc 3: Hz = L2 - L1 (Ré → Vante, purple, R = 86)
  drawArcWithLabel(dctx, cx, cy, 86, aRe, aVa, '#a855f7', 'rgba(168, 85, 247, 0.12)', 'Hz = L₂ − L₁');

  // Station point at center
  dctx.beginPath();
  dctx.arc(cx, cy, 7, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.station;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 2;
  dctx.stroke();

  // Station label
  dctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  dctx.fillStyle = COLORS.station;
  dctx.textAlign = 'center';
  dctx.textBaseline = 'alphabetic';
  dctx.fillText('Estação', cx, cy + r + 24);
}

function drawBadge(ctx, text, x, y, color, borderColor) {
  ctx.font = '600 11px "JetBrains Mono", monospace';
  const m = ctx.measureText(text);
  const pw = m.width + 12;
  const ph = 22;
  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawArrowTip(c, tipX, tipY, angle, color) {
  const headLen = 8;
  const spread = 0.45;
  c.beginPath();
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(angle - spread) * headLen, tipY - Math.sin(angle - spread) * headLen);
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(angle + spread) * headLen, tipY - Math.sin(angle + spread) * headLen);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();
}

function drawArcWithLabel(c, cx, cy, r, startA, endA, color, fillColor, label) {
  // Fill sector
  if (fillColor) {
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, r, startA, endA, false);
    c.closePath();
    c.fillStyle = fillColor;
    c.fill();
  }
  // Arc stroke
  c.beginPath();
  c.arc(cx, cy, r, startA, endA, false);
  c.strokeStyle = color;
  c.lineWidth = 2.2;
  c.stroke();
  
  // Arrow tip
  const tipX = cx + Math.cos(endA) * r;
  const tipY = cy + Math.sin(endA) * r;
  const tangent = endA + Math.PI / 2;
  const headLen = 7;
  const spread = 0.45;
  c.beginPath();
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(tangent - spread) * headLen, tipY - Math.sin(tangent - spread) * headLen);
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(tangent + spread) * headLen, tipY - Math.sin(tangent + spread) * headLen);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();

  // Label at midpoint
  const midA = (startA + endA) / 2;
  const lx = cx + Math.cos(midA) * r;
  const ly = cy + Math.sin(midA) * r;
  drawBadge(c, label, lx, ly, color, color + '60');
}

function drawArrowOnArc(c, cx, cy, r, startAngle, endAngle, ccw) {
  const tipAngle = endAngle;
  const tipX = cx + Math.cos(tipAngle) * r;
  const tipY = cy + Math.sin(tipAngle) * r;
  
  const tangent = ccw ? tipAngle + Math.PI / 2 : tipAngle - Math.PI / 2;
  const headLen = 8;
  const spread = 0.5;
  
  c.beginPath();
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(tangent - spread) * headLen, tipY - Math.sin(tangent - spread) * headLen);
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.cos(tangent + spread) * headLen, tipY - Math.sin(tangent + spread) * headLen);
  c.strokeStyle = COLORS.arrow;
  c.lineWidth = 2;
  c.stroke();
}

// ── Exercise Logic ──
function startExercise() {
  state.exerciseCount++;
  state.solved = false;
  state.aimAngle = null;
  state.angleResult = null;
  state.vanteLeitura = null;
  state.snapMiss = false;
  
  generatePoints();
  
  // Determine Ré reading and zero direction
  const angleRe = Math.atan2(-(state.points.re.y - state.points.station.y), state.points.re.x - state.points.station.x);
  if (state.zeroedOnRe) {
    state.reLeitura = 0;
    state.zeroMathAngle = null;
  } else {
    state.reLeitura = Math.random() * 360;
    const reLeituraRad = state.reLeitura * Math.PI / 180;
    if (state.clockwise) {
      state.zeroMathAngle = angleRe + reLeituraRad;
    } else {
      state.zeroMathAngle = angleRe - reLeituraRad;
    }
  }
  
  // Update UI
  counterEl.textContent = state.exerciseCount;
  resultValueEl.textContent = '—';
  resultBoxEl.classList.remove('success');
  const subEl = resultBoxEl.querySelector('.result-sub');
  if (subEl) {
    subEl.textContent = state.zeroedOnRe ? 'Hz = Leitura Vante − 0°' : 'Hz = Leitura Vante − Leitura Ré';
  }
  readingReEl.textContent = formatDMS(state.reLeitura);
  readingVanteEl.textContent = '—';
  
  if (hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.textContent = '🎯  Clique na direção do Vante para registrar a pontaria';
  }
  
  resizeCanvas();
  drawScene();
}

function resetCurrentExercise() {
  state.solved = false;
  state.aimAngle = null;
  state.angleResult = null;
  state.vanteLeitura = null;
  state.snapMiss = false;
  
  const angleRe = Math.atan2(-(state.points.re.y - state.points.station.y), state.points.re.x - state.points.station.x);
  if (state.zeroedOnRe) {
    state.reLeitura = 0;
    state.zeroMathAngle = null;
  } else {
    state.reLeitura = Math.random() * 360;
    const reLeituraRad = state.reLeitura * Math.PI / 180;
    if (state.clockwise) {
      state.zeroMathAngle = angleRe + reLeituraRad;
    } else {
      state.zeroMathAngle = angleRe - reLeituraRad;
    }
  }
  
  resultValueEl.textContent = '—';
  resultBoxEl.classList.remove('success');
  const subEl = resultBoxEl.querySelector('.result-sub');
  if (subEl) {
    subEl.textContent = state.zeroedOnRe ? 'Hz = Leitura Vante − 0°' : 'Hz = Leitura Vante − Leitura Ré';
  }
  readingReEl.textContent = formatDMS(state.reLeitura);
  readingVanteEl.textContent = '—';
  
  if (hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.textContent = '🎯  Clique na direção do Vante para registrar a pontaria';
  }
  
  drawScene();
}

function generatePoints() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const margin = 70;
  
  // Station always somewhat centered
  const station = {
    x: w * 0.38 + Math.random() * w * 0.24,
    y: h * 0.38 + Math.random() * h * 0.24
  };
  
  // Generate Ré and Vante at random positions, ensuring minimum distance
  let re, vante;
  let attempts = 0;
  do {
    re = {
      x: margin + Math.random() * (w - margin * 2),
      y: margin + Math.random() * (h - margin * 2)
    };
    attempts++;
  } while (dist(station, re) < MIN_DIST && attempts < 200);
  
  attempts = 0;
  do {
    vante = {
      x: margin + Math.random() * (w - margin * 2),
      y: margin + Math.random() * (h - margin * 2)
    };
    attempts++;
  } while ((dist(station, vante) < MIN_DIST || dist(re, vante) < MIN_DIST * 0.6) && attempts < 200);
  
  // Ensure that the angle between ré and vante (from station) is at least 25° and at most 335°
  const angleRe = Math.atan2(-(re.y - station.y), re.x - station.x);
  const angleVante = Math.atan2(-(vante.y - station.y), vante.x - station.x);
  let angleDiff = normAngle((angleRe - angleVante) * 180 / Math.PI);
  if (angleDiff < 25 || angleDiff > 335) {
    return generatePoints();
  }
  
  state.points = { station, re, vante };
}

// ── Canvas Interaction ──
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function onCanvasMove(e) {
  if (state.solved) return;
  if (!state.points.station) return;
  
  const pos = getCanvasPos(e);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
  state.snapMiss = false;
  updateAimReading();
  drawScene();
}

function isWithinSnap(aimAngle) {
  const trueVanteAngle = Math.atan2(
    -(state.points.vante.y - state.points.station.y),
    state.points.vante.x - state.points.station.x
  );
  let diffDeg = Math.abs(normAngle((aimAngle - trueVanteAngle) * 180 / Math.PI));
  if (diffDeg > 180) diffDeg = 360 - diffDeg;
  return diffDeg <= SNAP_TOLERANCE_DEG;
}

function onCanvasDown(e) {
  if (state.solved) return;
  if (!state.points.station) return;
  
  const pos = getCanvasPos(e);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
  
  if (dist(pos, state.points.vante) <= 25 || isWithinSnap(state.aimAngle)) {
    state.aimAngle = Math.atan2(
      -(state.points.vante.y - state.points.station.y),
      state.points.vante.x - state.points.station.x
    );
    state.snapMiss = false;
    solveExercise();
  } else {
    state.snapMiss = true;
    updateAimReading();
    drawScene();
  }
}

function onCanvasTouchMove(e) {
  e.preventDefault();
  if (state.solved) return;
  if (!state.points.station) return;
  
  const touch = e.touches[0];
  const pos = getCanvasPos(touch);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
  state.snapMiss = false;
  updateAimReading();
  drawScene();
}

function onCanvasTouchStart(e) {
  e.preventDefault();
  if (state.solved) return;
  if (!state.points.station) return;
  
  const touch = e.touches[0];
  const pos = getCanvasPos(touch);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
  
  if (dist(pos, state.points.vante) <= 25 || isWithinSnap(state.aimAngle)) {
    state.aimAngle = Math.atan2(
      -(state.points.vante.y - state.points.station.y),
      state.points.vante.x - state.points.station.x
    );
    state.snapMiss = false;
    solveExercise();
  } else {
    state.snapMiss = true;
    updateAimReading();
    drawScene();
  }
}

function updateAimReading() {
  if (state.aimAngle === null) return;
  
  const angleRe = Math.atan2(-(state.points.re.y - state.points.station.y), state.points.re.x - state.points.station.x);
  let angDiffDeg;
  
  if (state.clockwise) {
    angDiffDeg = normAngle((angleRe - state.aimAngle) * 180 / Math.PI);
  } else {
    angDiffDeg = normAngle((state.aimAngle - angleRe) * 180 / Math.PI);
  }
  
  state.vanteLeitura = normAngle(state.reLeitura + angDiffDeg);
  readingVanteEl.textContent = formatDMS(state.vanteLeitura);
}

function solveExercise() {
  if (state.aimAngle === null) return;
  
  updateAimReading();
  
  const angleRe = Math.atan2(-(state.points.re.y - state.points.station.y), state.points.re.x - state.points.station.x);
  let angDiffDeg;
  
  if (state.clockwise) {
    angDiffDeg = normAngle((angleRe - state.aimAngle) * 180 / Math.PI);
  } else {
    angDiffDeg = normAngle((state.aimAngle - angleRe) * 180 / Math.PI);
  }
  
  state.angleResult = angDiffDeg;
  state.solved = true;
  
  resultValueEl.textContent = formatDMS(state.angleResult);
  resultBoxEl.classList.add('success');
  
  const subEl = resultBoxEl.querySelector('.result-sub');
  if (subEl) {
    if (state.zeroedOnRe) {
      subEl.textContent = `Hz = ${formatDMS(state.vanteLeitura)} − 0° = ${formatDMS(state.angleResult)}`;
    } else {
      subEl.textContent = `Hz = ${formatDMS(state.vanteLeitura)} − ${formatDMS(state.reLeitura)} = ${formatDMS(state.angleResult)}`;
    }
  }
  
  if (hintEl) {
    hintEl.textContent = '✅  Pontaria registrada! Novo exercício em breve...';
  }
  
  drawScene();
  
  setTimeout(() => {
    startExercise();
  }, 3500);
}

// ── Drawing ──
function drawScene() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  
  // Grid
  drawGrid(w, h);
  
  const { station, re, vante } = state.points;
  if (!station) return;
  
  const angleRe = Math.atan2(-(re.y - station.y), re.x - station.x);
  const angleVante = Math.atan2(-(vante.y - station.y), vante.x - station.x);
  
  // Lines from station to Ré and Vante
  drawDashedLine(station, re, COLORS.re, 1.5);
  drawDashedLine(station, vante, COLORS.vante, 1.5);
  
  // Zero direction line (non-oriented mode)
  if (!state.zeroedOnRe && state.zeroMathAngle !== null) {
    drawZeroDirection(station, state.zeroMathAngle);
  }
  
  // Aim line (if aiming)
  if (state.aimAngle !== null && !state.solved) {
    const aimEnd = {
      x: station.x + Math.cos(state.aimAngle) * Math.max(w, h),
      y: station.y - Math.sin(state.aimAngle) * Math.max(w, h)
    };
    ctx.beginPath();
    ctx.moveTo(station.x, station.y);
    ctx.lineTo(aimEnd.x, aimEnd.y);
    ctx.strokeStyle = state.snapMiss ? 'rgba(244, 63, 94, 0.5)' : COLORS.lineAim;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Show snap miss feedback
    if (state.snapMiss) {
      const missEnd = {
        x: station.x + Math.cos(state.aimAngle) * 80,
        y: station.y - Math.sin(state.aimAngle) * 80
      };
      ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕ fora do alvo', missEnd.x, missEnd.y - 14);
    }
  }
  
  // Determine effective aim angle
  const aimA = state.solved ? angleVante : state.aimAngle;
  
  if (state.zeroedOnRe) {
    // ══════════════════════════════════════════════════
    // MODO ZERADO NA RÉ (Figura 6.16)
    // O zero coincide com a Ré. O ângulo parte da Ré até a Vante/Pontaria.
    // ══════════════════════════════════════════════════
    if (aimA !== null) {
      const labelTxt = state.solved ? `Hz = ${formatDMS(state.angleResult)}` :
        (state.vanteLeitura !== null ? formatDMS(state.vanteLeitura) : null);
      
      drawGenericArc({
        center: station,
        startMathAngle: angleRe,
        endMathAngle: aimA,
        radius: 56,
        color: '#a855f7',
        fillColor: 'rgba(99, 102, 241, 0.12)',
        label: labelTxt,
        showArrow: true,
        showSenseIcon: true,
        lineWidth: 2.5
      });
    }
  } else {
    // ══════════════════════════════════════════════════
    // MODO NÃO ORIENTADO (Figura 6.15)
    // 1. Arco L1: parte do 0° até a Ré (leitura inicial da Ré)
    // 2. Arco L2: parte do 0° até a Vante/Pontaria (NÃO parte da Ré!)
    // 3. Quando resolvido: arco Hz = L2 - L1 entre Ré e Vante
    // ══════════════════════════════════════════════════
    
    // 1. Arco L1: 0° → Ré (âmbar)
    if (state.zeroMathAngle !== null) {
      drawGenericArc({
        center: station,
        startMathAngle: state.zeroMathAngle,
        endMathAngle: angleRe,
        radius: 46,
        color: COLORS.re,
        fillColor: 'rgba(245, 158, 11, 0.08)',
        label: `L₁ = ${formatDMS(state.reLeitura)}`,
        showArrow: true,
        showSenseIcon: false,
        lineWidth: 2
      });
    }
    
    // 2. Arco L2: 0° → Pontaria/Vante (esmeralda) — PARTE DO 0°, NUNCA DA RÉ!
    if (aimA !== null && state.zeroMathAngle !== null) {
      const l2Txt = state.vanteLeitura !== null ? `L₂ = ${formatDMS(state.vanteLeitura)}` : 'L₂';
      drawGenericArc({
        center: station,
        startMathAngle: state.zeroMathAngle,
        endMathAngle: aimA,
        radius: 74,
        color: COLORS.vante,
        fillColor: 'rgba(16, 185, 129, 0.08)',
        label: l2Txt,
        showArrow: true,
        showSenseIcon: false,
        lineWidth: 2.5
      });
    }
    
    // 3. Arco Hz = L2 - L1 entre Ré e Vante (roxo) — revelado quando pontaria registrada!
    if (state.solved) {
      drawGenericArc({
        center: station,
        startMathAngle: angleRe,
        endMathAngle: angleVante,
        radius: 104,
        color: '#a855f7',
        fillColor: 'rgba(168, 85, 247, 0.12)',
        label: `Hz = L₂ − L₁ = ${formatDMS(state.angleResult)}`,
        showArrow: true,
        showSenseIcon: true,
        lineWidth: 2.5
      });
    }
  }
  
  // Points
  drawPoint(re, 'Ré', COLORS.re);
  drawPoint(vante, 'Vante', COLORS.vante);
  drawStationPoint(station);
}

function drawGrid(w, h) {
  const step = 40;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawDashedLine(from, to, color, width) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoint(pos, label, color) {
  // Outer glow
  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, POINT_RADIUS * 2.5);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Point
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Label background
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const lx = pos.x - metrics.width / 2 - 6;
  const ly = pos.y - LABEL_OFFSET - 14;
  const lw = metrics.width + 12;
  const lh = 20;
  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, lw, lh, 4);
  ctx.fill();
  
  // Label text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, pos.x, pos.y - LABEL_OFFSET);
}

function drawStationPoint(pos) {
  // Outer glow (larger for station)
  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, POINT_RADIUS * 3);
  gradient.addColorStop(0, COLORS.station + '50');
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS * 3, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Crosshair
  const ch = POINT_RADIUS * 1.8;
  ctx.beginPath();
  ctx.moveTo(pos.x - ch, pos.y);
  ctx.lineTo(pos.x + ch, pos.y);
  ctx.moveTo(pos.x, pos.y - ch);
  ctx.lineTo(pos.x, pos.y + ch);
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Point
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS + 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.station;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Inner dot
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  
  // Label
  const label = 'Estação';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const lx = pos.x - metrics.width / 2 - 6;
  const ly = pos.y + LABEL_OFFSET;
  const lw = metrics.width + 12;
  const lh = 22;
  
  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, lw, lh, 4);
  ctx.fill();
  
  ctx.fillStyle = COLORS.station;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, pos.x, pos.y + LABEL_OFFSET + 3);
}

// ── Ray for 0° Direction (Non-Oriented Instrument) ──
function drawZeroDirection(station, zeroMathAngle) {
  const zeroLen = 115;
  const rayAngle = -zeroMathAngle; // canvas angle
  const rayEnd = {
    x: station.x + Math.cos(zeroMathAngle) * zeroLen,
    y: station.y - Math.sin(zeroMathAngle) * zeroLen
  };
  
  // Dashed ray line
  ctx.beginPath();
  ctx.moveTo(station.x, station.y);
  ctx.lineTo(rayEnd.x, rayEnd.y);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Arrowhead pointing outward at rayEnd
  const headLen = 9;
  const spread = 0.45;
  ctx.beginPath();
  ctx.moveTo(rayEnd.x, rayEnd.y);
  ctx.lineTo(rayEnd.x - Math.cos(rayAngle - spread) * headLen, rayEnd.y - Math.sin(rayAngle - spread) * headLen);
  ctx.moveTo(rayEnd.x, rayEnd.y);
  ctx.lineTo(rayEnd.x - Math.cos(rayAngle + spread) * headLen, rayEnd.y - Math.sin(rayAngle + spread) * headLen);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Badge: "0° (Origem)"
  const badgeR = zeroLen + 20;
  const bx = station.x + Math.cos(rayAngle) * badgeR;
  const by = station.y + Math.sin(rayAngle) * badgeR;
  
  const text = '0° (Origem)';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  const m = ctx.measureText(text);
  const pw = m.width + 10;
  const ph = 18;
  
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.beginPath();
  ctx.roundRect(bx - pw / 2, by - ph / 2, pw, ph, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx, by);
}

// ── Generic Arc Drawer with Arrow and Label ──
function drawGenericArc({
  center,
  startMathAngle,
  endMathAngle,
  radius,
  color,
  fillColor = null,
  label = null,
  showArrow = true,
  lineWidth = 2.5,
  showSenseIcon = false
}) {
  const canvasStart = -startMathAngle;
  const canvasEnd = -endMathAngle;
  const ccw = !state.clockwise; // false = CW on canvas, true = CCW on canvas
  
  let spanDeg;
  let midCanvasAngle;
  if (!ccw) {
    spanDeg = normAngle((canvasEnd - canvasStart) * 180 / Math.PI);
    midCanvasAngle = canvasStart + (spanDeg / 2) * Math.PI / 180;
  } else {
    spanDeg = normAngle((canvasStart - canvasEnd) * 180 / Math.PI);
    midCanvasAngle = canvasStart - (spanDeg / 2) * Math.PI / 180;
  }
  
  if (spanDeg < 0.2) return;
  
  // Filled sector
  if (fillColor && spanDeg > 1) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, radius, canvasStart, canvasEnd, ccw);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  
  // Arc stroke
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, canvasStart, canvasEnd, ccw);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Arrowhead at the tip
  if (showArrow && spanDeg >= 5) {
    const tipX = center.x + Math.cos(canvasEnd) * radius;
    const tipY = center.y + Math.sin(canvasEnd) * radius;
    
    const tangent = ccw ? canvasEnd - Math.PI / 2 : canvasEnd + Math.PI / 2;
    const headLen = 8;
    const spread = 0.45;
    
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(tangent - spread) * headLen, tipY - Math.sin(tangent - spread) * headLen);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(tangent + spread) * headLen, tipY - Math.sin(tangent + spread) * headLen);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, lineWidth);
    ctx.stroke();
  }
  
  // Sense icon (↻ / ↺) inside the arc
  if (showSenseIcon && spanDeg > 25) {
    const iconR = radius - 14;
    const ix = center.x + Math.cos(midCanvasAngle) * iconR;
    const iy = center.y + Math.sin(midCanvasAngle) * iconR;
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.clockwise ? '↻' : '↺', ix, iy);
  }
  
  // Label badge at the midpoint of the arc
  if (label && spanDeg > 4) {
    const lx = center.x + Math.cos(midCanvasAngle) * radius;
    const ly = center.y + Math.sin(midCanvasAngle) * radius;
    
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const m = ctx.measureText(label);
    const pw = m.width + 12;
    const ph = 20;
    
    ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(lx - pw / 2, ly - ph / 2, pw, ph, 5);
    ctx.fill();
    ctx.strokeStyle = color + '60';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  }
}

