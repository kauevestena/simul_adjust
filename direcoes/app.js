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

// ── State ──
const state = {
  // Config
  zeroedOnRe: true,     // true = leitura de Ré = 0°
  clockwise: true,      // sentido horário
  
  // Exercise
  exerciseCount: 0,
  points: { station: null, re: null, vante: null },
  reLeitura: 0,         // leitura atribuída à Ré (deg)
  
  // Interaction
  aimAngle: null,        // ângulo de pontaria do usuário (rad, math convention)
  isAiming: false,
  solved: false,
  
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
      if (!state.solved && state.points.station) resetCurrentExercise();
    });
  });
  
  document.querySelectorAll('[data-cfg-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cfg-dir]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.clockwise = btn.dataset.cfgDir === 'cw';
      if (!state.solved && state.points.station) resetCurrentExercise();
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
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = Math.max(400, Math.min(600, window.innerHeight * 0.55));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ── Modal helpers ──
function showModal(overlay) {
  overlay.classList.add('active');
}
function hideModal(overlay) {
  overlay.classList.remove('active');
}

// ── Modal 1 Diagram: Illustrative Ré / Estação / Vante ──
function drawModal1Diagram() {
  const diagCanvas = document.getElementById('modal1DiagramCanvas');
  if (!diagCanvas) return;
  const dctx = diagCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = diagCanvas.parentElement.clientWidth;
  const h = 260;
  diagCanvas.width = w * dpr;
  diagCanvas.height = h * dpr;
  diagCanvas.style.height = h + 'px';
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  dctx.fillStyle = '#0b1120';
  dctx.fillRect(0, 0, w, h);

  // Subtle terrain line
  dctx.beginPath();
  dctx.moveTo(0, h - 30);
  for (let x = 0; x <= w; x += 5) {
    dctx.lineTo(x, h - 30 + Math.sin(x * 0.02) * 4 + Math.sin(x * 0.05) * 2);
  }
  dctx.lineTo(w, h);
  dctx.lineTo(0, h);
  dctx.closePath();
  dctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
  dctx.fill();
  dctx.beginPath();
  dctx.moveTo(0, h - 30);
  for (let x = 0; x <= w; x += 5) {
    dctx.lineTo(x, h - 30 + Math.sin(x * 0.02) * 4 + Math.sin(x * 0.05) * 2);
  }
  dctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
  dctx.lineWidth = 1;
  dctx.stroke();

  // Positions
  const stationPos = { x: w * 0.5, y: h * 0.55 };
  const rePos      = { x: w * 0.12, y: h * 0.32 };
  const vantePos   = { x: w * 0.88, y: h * 0.38 };

  // Dashed lines from station to Ré and Vante
  dctx.setLineDash([8, 5]);
  dctx.lineWidth = 1.8;
  // Line to Ré
  dctx.beginPath();
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.lineTo(rePos.x, rePos.y);
  dctx.strokeStyle = COLORS.re;
  dctx.stroke();
  // Line to Vante
  dctx.beginPath();
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.lineTo(vantePos.x, vantePos.y);
  dctx.strokeStyle = COLORS.vante;
  dctx.stroke();
  dctx.setLineDash([]);

  // Angle arc at station
  const angRe = Math.atan2(-(rePos.y - stationPos.y), rePos.x - stationPos.x);
  const angVa = Math.atan2(-(vantePos.y - stationPos.y), vantePos.x - stationPos.x);
  const arcR = 40;
  dctx.beginPath();
  dctx.moveTo(stationPos.x, stationPos.y);
  dctx.arc(stationPos.x, stationPos.y, arcR, -angRe, -angVa, false);
  dctx.closePath();
  dctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
  dctx.fill();
  dctx.beginPath();
  dctx.arc(stationPos.x, stationPos.y, arcR, -angRe, -angVa, false);
  dctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
  dctx.lineWidth = 2;
  dctx.stroke();

  // "Hz" label on arc
  const midArcAngle = (-angRe + (-angVa)) / 2;
  dctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  dctx.fillStyle = '#a855f7';
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  dctx.fillText('Hz', stationPos.x + Math.cos(midArcAngle) * (arcR + 16), stationPos.y + Math.sin(midArcAngle) * (arcR + 16));

  // Draw tripod / instrument at station
  const tripodTop = stationPos.y - 8;
  // Tripod legs
  dctx.beginPath();
  dctx.moveTo(stationPos.x, tripodTop);
  dctx.lineTo(stationPos.x - 16, stationPos.y + 26);
  dctx.moveTo(stationPos.x, tripodTop);
  dctx.lineTo(stationPos.x + 16, stationPos.y + 26);
  dctx.moveTo(stationPos.x, tripodTop);
  dctx.lineTo(stationPos.x, stationPos.y + 28);
  dctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  dctx.lineWidth = 2;
  dctx.stroke();
  // Instrument body
  dctx.fillStyle = COLORS.station;
  dctx.beginPath();
  dctx.roundRect(stationPos.x - 10, tripodTop - 14, 20, 16, 3);
  dctx.fill();
  // Lens
  dctx.fillStyle = '#fff';
  dctx.beginPath();
  dctx.arc(stationPos.x + 10, tripodTop - 6, 3, 0, Math.PI * 2);
  dctx.fill();

  // Helper: draw labeled point with glow
  function drawModalPoint(pos, label, sublabel, color, align) {
    // Glow
    const grad = dctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 22);
    grad.addColorStop(0, color + '50');
    grad.addColorStop(1, 'transparent');
    dctx.beginPath();
    dctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
    dctx.fillStyle = grad;
    dctx.fill();
    // Point
    dctx.beginPath();
    dctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
    dctx.fillStyle = color;
    dctx.fill();
    dctx.strokeStyle = '#fff';
    dctx.lineWidth = 2;
    dctx.stroke();
    // Label bg
    dctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    const m = dctx.measureText(label);
    const lbw = m.width + 14;
    const lbh = 42;
    const lbx = align === 'right' ? pos.x + 14 : pos.x - lbw - 14;
    const lby = pos.y - lbh / 2 - 4;
    dctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
    dctx.beginPath();
    dctx.roundRect(lbx, lby, lbw + 4, lbh, 6);
    dctx.fill();
    dctx.strokeStyle = color + '40';
    dctx.lineWidth = 1;
    dctx.stroke();
    // Label text
    dctx.fillStyle = color;
    dctx.textAlign = 'left';
    dctx.textBaseline = 'top';
    dctx.fillText(label, lbx + 7, lby + 6);
    // Sublabel
    dctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
    dctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    dctx.fillText(sublabel, lbx + 7, lby + 24);
  }

  drawModalPoint(rePos, 'Ré', 'Referência', COLORS.re, 'right');
  drawModalPoint(vantePos, 'Vante', 'Ponto visado', COLORS.vante, 'left');

  // Station label below tripod
  dctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  const stLabel = 'Estação';
  const stSub = 'Instrumento';
  const stm = dctx.measureText(stLabel);
  const stlbw = Math.max(stm.width, dctx.measureText(stSub).width) + 14;
  const stlbx = stationPos.x - stlbw / 2;
  const stlby = stationPos.y + 34;
  dctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
  dctx.beginPath();
  dctx.roundRect(stlbx, stlby, stlbw, 42, 6);
  dctx.fill();
  dctx.strokeStyle = COLORS.station + '40';
  dctx.lineWidth = 1;
  dctx.stroke();
  dctx.fillStyle = COLORS.station;
  dctx.textAlign = 'center';
  dctx.textBaseline = 'top';
  dctx.fillText(stLabel, stationPos.x, stlby + 6);
  dctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
  dctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  dctx.fillText(stSub, stationPos.x, stlby + 24);
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
  
  // Draw diagram showing angle as difference of two readings
  const cx = w / 2, cy = h / 2 + 10;
  const r = 95;
  
  // Grid background
  dctx.fillStyle = '#0b1120';
  dctx.fillRect(0, 0, w, h);
  
  // Circle (protractor)
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
    dctx.moveTo(cx + Math.cos(a) * inner, cy - Math.sin(a) * inner);
    dctx.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r);
    dctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    dctx.lineWidth = i % 9 === 0 ? 2 : 0.8;
    dctx.stroke();
  }

  // Cardinal labels
  dctx.font = '500 11px "JetBrains Mono", monospace';
  dctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  dctx.fillText('0°', cx + r + 14, cy);
  dctx.fillText('90°', cx, cy - r - 12);
  dctx.fillText('180°', cx - r - 18, cy);
  dctx.fillText('270°', cx, cy + r + 14);
  
  // Station point at center
  dctx.beginPath();
  dctx.arc(cx, cy, 7, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.station;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 2;
  dctx.stroke();
  
  // Direction 1 (Ré)
  const reAngle = 40 * Math.PI / 180;
  const reEnd = { x: cx + Math.cos(reAngle) * (r + 28), y: cy - Math.sin(reAngle) * (r + 28) };
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.lineTo(reEnd.x, reEnd.y);
  dctx.strokeStyle = COLORS.re;
  dctx.lineWidth = 2.5;
  dctx.setLineDash([6, 4]);
  dctx.stroke();
  dctx.setLineDash([]);
  
  // Ré point
  dctx.beginPath();
  dctx.arc(reEnd.x, reEnd.y, 6, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.re;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 1.5;
  dctx.stroke();
  
  // Label "Ré" with background
  dctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const reLabel = 'Ré';
  const rem = dctx.measureText(reLabel);
  dctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
  dctx.beginPath();
  dctx.roundRect(reEnd.x + 10, reEnd.y - 12, rem.width + 12, 22, 4);
  dctx.fill();
  dctx.fillStyle = COLORS.re;
  dctx.textAlign = 'left';
  dctx.fillText(reLabel, reEnd.x + 16, reEnd.y + 4);
  
  // Leitura Ré label
  dctx.font = '600 12px "JetBrains Mono", monospace';
  dctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
  dctx.fillText('L₁ = 30°15\'20"', reEnd.x + 10, reEnd.y + 22);
  
  // Direction 2 (Vante)
  const vanteAngle = -40 * Math.PI / 180;
  const vanteEnd = { x: cx + Math.cos(vanteAngle) * (r + 28), y: cy - Math.sin(vanteAngle) * (r + 28) };
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.lineTo(vanteEnd.x, vanteEnd.y);
  dctx.strokeStyle = COLORS.vante;
  dctx.lineWidth = 2.5;
  dctx.setLineDash([6, 4]);
  dctx.stroke();
  dctx.setLineDash([]);
  
  // Vante point
  dctx.beginPath();
  dctx.arc(vanteEnd.x, vanteEnd.y, 6, 0, Math.PI * 2);
  dctx.fillStyle = COLORS.vante;
  dctx.fill();
  dctx.strokeStyle = '#fff';
  dctx.lineWidth = 1.5;
  dctx.stroke();
  
  // Label "Vante" with background
  dctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const vanteLabel = 'Vante';
  const vam = dctx.measureText(vanteLabel);
  dctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
  dctx.beginPath();
  dctx.roundRect(vanteEnd.x + 10, vanteEnd.y - 12, vam.width + 12, 22, 4);
  dctx.fill();
  dctx.fillStyle = COLORS.vante;
  dctx.textAlign = 'left';
  dctx.fillText(vanteLabel, vanteEnd.x + 16, vanteEnd.y + 4);
  
  // Leitura Vante label
  dctx.font = '600 12px "JetBrains Mono", monospace';
  dctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
  dctx.fillText('L₂ = 110°30\'45"', vanteEnd.x + 10, vanteEnd.y + 22);
  
  // Arc between the two directions (clockwise)
  const arcR = 50;
  dctx.beginPath();
  dctx.arc(cx, cy, arcR, -reAngle, -vanteAngle, false);
  dctx.strokeStyle = COLORS.arc;
  dctx.lineWidth = 3;
  dctx.stroke();
  
  // Fill arc
  dctx.beginPath();
  dctx.moveTo(cx, cy);
  dctx.arc(cx, cy, arcR, -reAngle, -vanteAngle, false);
  dctx.closePath();
  dctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
  dctx.fill();
  
  // Arrow on arc
  drawArrowOnArc(dctx, cx, cy, arcR, -reAngle, -vanteAngle, false);
  
  // Angle label
  dctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  dctx.fillStyle = '#a855f7';
  dctx.textAlign = 'center';
  const labelAngle = (-reAngle + (-vanteAngle)) / 2;
  const labelR = 72;
  const lx = cx + Math.cos(labelAngle) * labelR;
  const ly = cy + Math.sin(labelAngle) * labelR;
  // Background pill
  const hzLabel = 'Hz = L₂ − L₁';
  const hzm = dctx.measureText(hzLabel);
  dctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  dctx.beginPath();
  dctx.roundRect(lx - hzm.width / 2 - 10, ly - 12, hzm.width + 20, 26, 8);
  dctx.fill();
  dctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
  dctx.lineWidth = 1;
  dctx.stroke();
  dctx.fillStyle = '#a855f7';
  dctx.textBaseline = 'middle';
  dctx.fillText(hzLabel, lx, ly);
  
  // Station label
  dctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  dctx.fillStyle = COLORS.station;
  dctx.textAlign = 'center';
  dctx.textBaseline = 'alphabetic';
  dctx.fillText('Estação', cx, cy + r + 28);
}

function drawArrowOnArc(c, cx, cy, r, startAngle, endAngle, ccw) {
  // Draw a small arrowhead at the end of the arc
  const tipAngle = endAngle;
  const tipX = cx + Math.cos(tipAngle) * r;
  const tipY = cy + Math.sin(tipAngle) * r;
  
  // Tangent direction (perpendicular to radius, in direction of arc travel)
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
  
  generatePoints();
  
  // Determine Ré reading
  if (state.zeroedOnRe) {
    state.reLeitura = 0;
  } else {
    state.reLeitura = Math.random() * 360;
  }
  
  // Update UI
  counterEl.textContent = state.exerciseCount;
  resultValueEl.textContent = '—';
  resultBoxEl.classList.remove('success');
  readingReEl.textContent = formatDMS(state.reLeitura);
  readingVanteEl.textContent = '—';
  
  if (hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.textContent = '🎯  Clique para apontar a luneta na direção do Vante';
  }
  
  resizeCanvas();
  drawScene();
}

function resetCurrentExercise() {
  state.solved = false;
  state.aimAngle = null;
  state.angleResult = null;
  state.vanteLeitura = null;
  
  if (state.zeroedOnRe) {
    state.reLeitura = 0;
  } else {
    state.reLeitura = Math.random() * 360;
  }
  
  resultValueEl.textContent = '—';
  resultBoxEl.classList.remove('success');
  readingReEl.textContent = formatDMS(state.reLeitura);
  readingVanteEl.textContent = '—';
  
  if (hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.textContent = '🎯  Clique para apontar a luneta na direção do Vante';
  }
  
  drawScene();
}

function generatePoints() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const margin = 60;
  
  // Station always somewhat centered
  const station = {
    x: w * 0.35 + Math.random() * w * 0.3,
    y: h * 0.35 + Math.random() * h * 0.3
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
  
  // Ensure that the angle between ré and vante (from station) is at least 20° and at most 340°
  const angleRe = Math.atan2(-(re.y - station.y), re.x - station.x);
  const angleVante = Math.atan2(-(vante.y - station.y), vante.x - station.x);
  let angleDiff = normAngle((angleRe - angleVante) * 180 / Math.PI);
  if (angleDiff < 20 || angleDiff > 340) {
    // Retry
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
  updateAimReading();
  drawScene();
}

function onCanvasDown(e) {
  if (state.solved) return;
  if (!state.points.station) return;
  
  const pos = getCanvasPos(e);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
  solveExercise();
}

function onCanvasTouchMove(e) {
  e.preventDefault();
  if (state.solved) return;
  if (!state.points.station) return;
  
  const touch = e.touches[0];
  const pos = getCanvasPos(touch);
  state.aimAngle = Math.atan2(-(pos.y - state.points.station.y), pos.x - state.points.station.x);
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
  solveExercise();
}

function updateAimReading() {
  if (state.aimAngle === null) return;
  
  // Calculate the angle from Ré to the aim direction
  const angleRe = Math.atan2(-(state.points.re.y - state.points.station.y), state.points.re.x - state.points.station.x);
  let angDiffDeg;
  
  if (state.clockwise) {
    // Clockwise: angles increase clockwise (subtract in math convention)
    angDiffDeg = normAngle((angleRe - state.aimAngle) * 180 / Math.PI);
  } else {
    // Anti-clockwise: angles increase counter-clockwise (add in math convention)
    angDiffDeg = normAngle((state.aimAngle - angleRe) * 180 / Math.PI);
  }
  
  state.vanteLeitura = normAngle(state.reLeitura + angDiffDeg);
  readingVanteEl.textContent = formatDMS(state.vanteLeitura);
}

function solveExercise() {
  if (state.aimAngle === null) return;
  
  updateAimReading();
  
  // The horizontal angle is the difference between vante reading and ré reading
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
  
  if (hintEl) {
    hintEl.textContent = '✅  Pontaria registrada! Clique "Novo Exercício" para continuar';
  }
  
  drawScene();
  
  // Auto-generate new exercise after a delay
  setTimeout(() => {
    startExercise();
  }, 2500);
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
  
  // Aim line (if aiming)
  if (state.aimAngle !== null && !state.solved) {
    const aimEnd = {
      x: station.x + Math.cos(state.aimAngle) * Math.max(w, h),
      y: station.y - Math.sin(state.aimAngle) * Math.max(w, h)
    };
    ctx.beginPath();
    ctx.moveTo(station.x, station.y);
    ctx.lineTo(aimEnd.x, aimEnd.y);
    ctx.strokeStyle = COLORS.lineAim;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Arc showing the angle
  if (state.aimAngle !== null || state.solved) {
    const aimA = state.solved ? 
      Math.atan2(-(vante.y - station.y), vante.x - station.x) : 
      state.aimAngle;
    drawAngleArc(station, angleRe, aimA);
  }
  
  // Direction arrow (sentido)
  if (state.aimAngle !== null || state.solved) {
    const aimA = state.solved ? angleVante : state.aimAngle;
    drawDirectionArrow(station, angleRe, aimA);
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
  
  // Label
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, pos.x, pos.y - LABEL_OFFSET);
  
  // Label background
  const metrics = ctx.measureText(label);
  const lx = pos.x - metrics.width / 2 - 6;
  const ly = pos.y - LABEL_OFFSET - 14;
  const lw = metrics.width + 12;
  const lh = 20;
  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, lw, lh, 4);
  ctx.fill();
  
  // Re-draw label on top of background
  ctx.fillStyle = color;
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

function drawAngleArc(center, angleStart, angleEnd) {
  // Convert from math convention (CCW from east) to canvas convention (CW from east)
  const canvasStart = -angleStart;
  const canvasEnd = -angleEnd;
  
  // Determine arc direction based on setting
  let ccw;
  if (state.clockwise) {
    // Topographic clockwise: canvas arc goes clockwise (ccw=false)
    ccw = false;
  } else {
    ccw = true;
  }
  
  // Draw filled arc
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.arc(center.x, center.y, ARC_RADIUS, canvasStart, canvasEnd, ccw);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
  ctx.fill();
  
  // Draw arc line
  ctx.beginPath();
  ctx.arc(center.x, center.y, ARC_RADIUS, canvasStart, canvasEnd, ccw);
  ctx.strokeStyle = COLORS.arc;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Angle label at the midpoint of the arc
  let midAngle;
  if (state.clockwise) {
    // Clockwise: canvasStart to canvasEnd going clockwise
    let diff = normAngle((canvasEnd - canvasStart) * 180 / Math.PI);
    midAngle = canvasStart + (diff / 2) * Math.PI / 180;
  } else {
    let diff = normAngle((canvasStart - canvasEnd) * 180 / Math.PI);
    midAngle = canvasEnd + (diff / 2) * Math.PI / 180;
  }
  
  if (state.angleResult !== null || state.vanteLeitura !== null) {
    const labelR = ARC_RADIUS + 20;
    const lx = center.x + Math.cos(midAngle) * labelR;
    const ly = center.y + Math.sin(midAngle) * labelR;
    
    const angleTxt = state.angleResult !== null ? formatDMS(state.angleResult) : 
                     (state.vanteLeitura !== null ? formatDMS(normAngle(state.vanteLeitura - state.reLeitura)) : '');
    
    if (angleTxt) {
      // Background pill
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const m = ctx.measureText(angleTxt);
      ctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
      ctx.beginPath();
      ctx.roundRect(lx - m.width / 2 - 6, ly - 9, m.width + 12, 20, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#a855f7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(angleTxt, lx, ly);
    }
  }
}

function drawDirectionArrow(center, angleRe, angleAim) {
  // Draw a curved arrow showing the direction of angle measurement
  const canvasStart = -angleRe;
  const canvasEnd = -angleAim;
  const arrowR = ARC_RADIUS - 12;
  
  const ccw = !state.clockwise;
  
  // Small arrowhead at the end of the arc
  ctx.beginPath();
  ctx.arc(center.x, center.y, arrowR, canvasStart, canvasEnd, ccw);
  ctx.strokeStyle = COLORS.arrow + '80';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Arrowhead
  const tipAngle = canvasEnd;
  const tipX = center.x + Math.cos(tipAngle) * arrowR;
  const tipY = center.y + Math.sin(tipAngle) * arrowR;
  
  // Tangent direction
  const tangent = ccw ? tipAngle + Math.PI / 2 : tipAngle - Math.PI / 2;
  const headLen = 10;
  const spread = 0.5;
  
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(tangent - spread) * headLen, tipY - Math.sin(tangent - spread) * headLen);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(tangent + spread) * headLen, tipY - Math.sin(tangent + spread) * headLen);
  ctx.strokeStyle = COLORS.arrow;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Small "sentido" label near the arrow
  const labelAngle = ccw ? tipAngle + 0.3 : tipAngle - 0.3;
  const labelR = arrowR - 16;
  const lx = center.x + Math.cos(labelAngle) * labelR;
  const ly = center.y + Math.sin(labelAngle) * labelR;
  
  ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = COLORS.arrow;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.clockwise ? '↻' : '↺', lx, ly);
}
