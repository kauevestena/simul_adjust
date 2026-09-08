/**
 * Simulador de Pontaria Direta e Inversa (PD/PI)
 * ───────────────────────────────────────────────
 * Teodolito em dupla face: vista superior (limbo horizontal) e vista
 * lateral (círculo vertical), sempre orientado (zerado) na Ré, sentido
 * horário. Sequência: Vante (Hz+V) em PD → tombar a luneta → Ré (Hz+V) em PI.
 */

// ── Utility: Angle formatting ──
function decToDMS(decDeg) {
  const sign = decDeg < 0 ? -1 : 1;
  let dd = Math.abs(decDeg);
  const d = Math.floor(dd);
  dd = (dd - d) * 60;
  const m = Math.floor(dd);
  const s = (dd - m) * 60;
  return { d: d * sign, m, s };
}

function formatDMS(decDeg) {
  const { d, m, s } = decToDMS(Math.abs(decDeg));
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`;
}

function normAngle(a) {
  return ((a % 360) + 360) % 360;
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Constants ──
const COLORS = {
  station: '#06b6d4',
  re: '#f59e0b',
  vante: '#10b981',
  pd: '#06b6d4',
  pi: '#a855f7',
  lineAim: 'rgba(6, 182, 212, 0.6)',
  grid: 'rgba(148, 163, 184, 0.06)',
  bg: '#0b1120',
  horizon: 'rgba(148, 163, 184, 0.55)',
};

const POINT_RADIUS = 8;
const LABEL_OFFSET = 22;
const MIN_DIST = 100;
const SNAP_TOLERANCE_DEG = 3;
const TAP_RADIUS_PX = 30; // generous fallback hit-radius, forgiving for touch
const TOMBAR_DURATION_MS = 800;

// ── Step definitions ──
const STEPS = [
  { key: 'hz_vante_pd', axis: 'hz', target: 'vante', face: 'PD' },
  { key: 'v_vante_pd', axis: 'v', target: 'vante', face: 'PD' },
  { key: 'tombar', axis: null, target: null, face: 'PD' },
  { key: 'hz_re_pi', axis: 'hz', target: 're', face: 'PI' },
  { key: 'v_re_pi', axis: 'v', target: 're', face: 'PI' },
  { key: 'results', axis: null, target: null, face: 'PI' },
];

const STEP_LABELS = {
  hz_vante_pd: 'Pontaria horizontal — Vante (PD)',
  v_vante_pd: 'Pontaria vertical — Vante (PD)',
  tombar: 'Tombar a luneta',
  hz_re_pi: 'Pontaria horizontal — Ré (PI)',
  v_re_pi: 'Pontaria vertical — Ré (PI)',
  results: 'Cálculos e finalização',
};

const HINTS = {
  hz_vante_pd: '🎯 Mire na direção do Vante (vista superior) para registrar a pontaria horizontal',
  v_vante_pd: '🎯 Mire na elevação do Vante (vista lateral) para registrar a pontaria vertical',
  tombar: '🔄 Clique em "Tombar a Luneta" para passar à posição inversa (PI)',
  hz_re_pi: '🎯 Mire na direção da Ré (vista superior) para registrar a pontaria horizontal em PI',
  v_re_pi: '🎯 Mire na elevação da Ré (vista lateral) para registrar a pontaria vertical em PI',
  results: '✅ Pontarias concluídas! Revise os cálculos e finalize.',
};

const READING_IDS = {
  hzVantePd: 'riHzVantePd',
  vVantePd: 'riVVantePd',
  hzRePi: 'riHzRePi',
  vRePi: 'riVRePi',
};

// ── State ──
const state = {
  stepIndex: 0,
  face: 'PD',
  points: { station: null, re: null, vante: null },
  Z: { re: null, vante: null },
  pose: { azimuth: null, elevation: null },
  snapMissTop: false,
  snapMissSide: false,
  readings: { hzVantePd: null, vVantePd: null, hzRePi: null, vRePi: null },
  isTombarAnimating: false,
  finalized: false,
  exerciseCount: 0,
};

// ── DOM Refs ──
let topCanvas, topCtx, sideCanvas, sideCtx;
let modalOverlay1, modalOverlay2;
let hintEl, counterEl, faceBadgeEl, stepChecklistEl;
let topReadoutEl, sideReadoutEl;
let btnTombar, btnNewExercise, btnFinalizar, calcPanelEl;

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  topCanvas = document.getElementById('topCanvas');
  topCtx = topCanvas.getContext('2d');
  sideCanvas = document.getElementById('sideCanvas');
  sideCtx = sideCanvas.getContext('2d');

  modalOverlay1 = document.getElementById('modal1');
  modalOverlay2 = document.getElementById('modal2');

  hintEl = document.getElementById('canvasHint');
  counterEl = document.getElementById('exerciseCount');
  faceBadgeEl = document.getElementById('faceBadge');
  stepChecklistEl = document.getElementById('stepChecklist');
  topReadoutEl = document.getElementById('topReadout');
  sideReadoutEl = document.getElementById('sideReadout');

  btnTombar = document.getElementById('btnTombar');
  btnNewExercise = document.getElementById('btnNewExercise');
  btnFinalizar = document.getElementById('btnFinalizar');
  calcPanelEl = document.getElementById('calcPanel');

  buildStepChecklist();

  document.getElementById('btnModal1Next').addEventListener('click', () => {
    hideModal(modalOverlay1);
    setTimeout(() => showModal(modalOverlay2), 300);
  });
  document.getElementById('btnModal2Start').addEventListener('click', () => {
    hideModal(modalOverlay2);
    setTimeout(() => startExercise(), 350);
  });

  btnTombar.addEventListener('click', onTombarClick);
  btnNewExercise.addEventListener('click', startExercise);
  btnFinalizar.addEventListener('click', onFinalizeClick);

  // Pointer Events unify mouse/touch/pen in a single code path — touch-specific
  // handlers were dropped because relying on touchstart/touchmove alongside
  // mousedown/mousemove is a classic source of unreliable taps on mobile
  // (the browser's own gesture handling can steal the touch before/instead of
  // firing it). CSS `touch-action: none` on the canvases keeps that from happening.
  topCanvas.addEventListener('pointermove', onTopMove);
  topCanvas.addEventListener('pointerdown', onTopDown);

  sideCanvas.addEventListener('pointermove', onSideMove);
  sideCanvas.addEventListener('pointerdown', onSideDown);

  resizeCanvases();
  window.addEventListener('resize', () => {
    resizeCanvases();
    if (state.points.station) drawAll();
  });

  setTimeout(() => {
    showModal(modalOverlay1);
    drawModal1Diagram();
  }, 500);
});

// ── Canvas sizing ──
function resizeCanvases() {
  [[topCanvas, topCtx], [sideCanvas, sideCtx]].forEach(([canvas, ctx]) => {
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
}

// ── Modal logic ──
function showModal(el) { el.classList.add('active'); }
function hideModal(el) { el.classList.remove('active'); }

function drawModal1Diagram() {
  const c = document.getElementById('modal1DiagramCanvas');
  if (!c) return;
  const dctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = c.parentElement.clientWidth;
  const h = 220;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.height = h + 'px';
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  dctx.fillStyle = '#0b1120';
  dctx.fillRect(0, 0, w, h);

  const cy = h / 2 - 10;
  const pdX = w * 0.28;
  const piX = w * 0.72;
  const r = 32;

  function drawScope(cx, cy0, tubeAngleDeg, color, label) {
    dctx.strokeStyle = 'rgba(148,163,184,0.4)';
    dctx.lineWidth = 2;
    dctx.beginPath();
    dctx.moveTo(cx, cy0 + 8);
    dctx.lineTo(cx - 18, cy0 + 42);
    dctx.moveTo(cx, cy0 + 8);
    dctx.lineTo(cx + 18, cy0 + 42);
    dctx.moveTo(cx, cy0 + 8);
    dctx.lineTo(cx, cy0 + 46);
    dctx.stroke();

    const rad = tubeAngleDeg * Math.PI / 180;
    const tx = cx + Math.cos(rad) * r;
    const ty = cy0 - Math.sin(rad) * r * 0.6;
    dctx.beginPath();
    dctx.moveTo(cx, cy0);
    dctx.lineTo(tx, ty);
    dctx.strokeStyle = color;
    dctx.lineWidth = 5;
    dctx.lineCap = 'round';
    dctx.stroke();

    dctx.beginPath();
    dctx.arc(cx, cy0, 11, 0, Math.PI * 2);
    dctx.fillStyle = color;
    dctx.fill();
    dctx.strokeStyle = '#fff';
    dctx.lineWidth = 1.5;
    dctx.stroke();

    dctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    dctx.fillStyle = color;
    dctx.textAlign = 'center';
    dctx.textBaseline = 'top';
    dctx.fillText(label, cx, cy0 + 54);
  }

  drawScope(pdX, cy, 25, COLORS.pd, 'PD');
  drawScope(piX, cy, 155, COLORS.pi, 'PI');

  const midX = w / 2;
  dctx.beginPath();
  dctx.moveTo(pdX + 36, cy - 46);
  dctx.quadraticCurveTo(midX, cy - 82, piX - 36, cy - 46);
  dctx.strokeStyle = 'rgba(255,255,255,0.5)';
  dctx.lineWidth = 2;
  dctx.setLineDash([5, 4]);
  dctx.stroke();
  dctx.setLineDash([]);

  dctx.beginPath();
  dctx.moveTo(piX - 36, cy - 46);
  dctx.lineTo(piX - 49, cy - 56);
  dctx.moveTo(piX - 36, cy - 46);
  dctx.lineTo(piX - 52, cy - 40);
  dctx.strokeStyle = 'rgba(255,255,255,0.5)';
  dctx.lineWidth = 2;
  dctx.stroke();

  dctx.font = '600 12px "JetBrains Mono", monospace';
  dctx.fillStyle = '#cbd5e1';
  dctx.textAlign = 'center';
  dctx.fillText('tombar (180°)', midX, cy - 90);
}

// ── Step checklist ──
function buildStepChecklist() {
  stepChecklistEl.innerHTML = '';
  STEPS.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-item';
    div.innerHTML = `<span class="step-num">${i + 1}</span><span class="step-text">${STEP_LABELS[step.key]}</span>`;
    stepChecklistEl.appendChild(div);
  });
}

function currentStep() {
  return STEPS[state.stepIndex];
}

function updateStepUI() {
  const items = stepChecklistEl.querySelectorAll('.step-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === state.stepIndex);
    el.classList.toggle('done', i < state.stepIndex);
    el.querySelector('.step-num').textContent = i < state.stepIndex ? '✓' : String(i + 1);
  });

  faceBadgeEl.textContent = state.face;
  faceBadgeEl.className = 'face-badge ' + state.face.toLowerCase();

  const step = currentStep();
  hintEl.classList.remove('hidden');
  hintEl.textContent = HINTS[step.key] || '';

  btnTombar.disabled = step.key !== 'tombar';

  if (step.key === 'results') {
    computeAndShowResults();
  }
}

function advanceStep() {
  state.stepIndex++;
  updateStepUI();
  drawAll();
  scrollStepIntoView();
}

// On narrow/mobile layouts the canvases and the controls in <aside> can be far
// apart vertically (interacting with a button scrolls the controls into view,
// which can push the canvas needed for the *next* step off-screen with no
// visual cue). Bring whatever the user needs to act on next into view.
function scrollStepIntoView() {
  const step = currentStep();
  let el = null;
  if (step.key === 'tombar') el = btnTombar;
  else if (step.axis === 'hz') el = topCanvas;
  else if (step.axis === 'v') el = sideCanvas;
  else if (step.key === 'results') el = calcPanelEl;
  if (el && el.scrollIntoView) {
    // Instant, not smooth: the user needs to tap this element right away, and
    // an in-progress scroll animation is a race against that next tap.
    el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }
}

// ── Geometry helpers ──
function trueAngle(name) {
  const p = state.points[name];
  const s = state.points.station;
  return Math.atan2(-(p.y - s.y), p.x - s.x);
}

function zeroRefAngle() {
  const angleRe = trueAngle('re');
  return state.face === 'PD' ? angleRe : angleRe + Math.PI;
}

function hzReading(aimMathAngle) {
  const zeroA = zeroRefAngle();
  return normAngle((zeroA - aimMathAngle) * 180 / Math.PI);
}

function vReading(zTrue) {
  return state.face === 'PD' ? normAngle(zTrue) : normAngle(360 - zTrue);
}

// Math angle (same convention as trueAngle/atan2) of the direction that is
// `zDeg` away from the zenith on the side-view protractor. Z=0 -> 90° (up),
// Z=90 -> 0° (horizontal), Z=180 -> -90° (down); see sideZPoint for the
// matching screen-space parametrization.
function zToMathAngle(zDeg) {
  return (90 - zDeg) * Math.PI / 180;
}

// ── Random generation ──
function generatePoints() {
  const w = topCanvas.width / (window.devicePixelRatio || 1);
  const h = topCanvas.height / (window.devicePixelRatio || 1);
  const margin = 60;

  const station = {
    x: w * 0.36 + Math.random() * w * 0.24,
    y: h * 0.38 + Math.random() * h * 0.24,
  };

  let re, vante;
  let attempts = 0;
  do {
    re = { x: margin + Math.random() * (w - margin * 2), y: margin + Math.random() * (h - margin * 2) };
    attempts++;
  } while (dist(station, re) < MIN_DIST && attempts < 200);

  attempts = 0;
  do {
    vante = { x: margin + Math.random() * (w - margin * 2), y: margin + Math.random() * (h - margin * 2) };
    attempts++;
  } while ((dist(station, vante) < MIN_DIST || dist(re, vante) < MIN_DIST * 0.6) && attempts < 200);

  const angleRe = Math.atan2(-(re.y - station.y), re.x - station.x);
  const angleVante = Math.atan2(-(vante.y - station.y), vante.x - station.x);
  const angleDiff = normAngle((angleRe - angleVante) * 180 / Math.PI);
  if (angleDiff < 25 || angleDiff > 335) {
    return generatePoints();
  }

  state.points = { station, re, vante };
}

function generateZ() {
  function randomZ() {
    const sign = Math.random() < 0.5 ? -1 : 1;
    const mag = 6 + Math.random() * 14; // 6..20 deg away from horizon
    return 90 + sign * mag;
  }
  state.Z = { re: randomZ(), vante: randomZ() };
}

// ── Exercise flow ──
function startExercise() {
  state.exerciseCount++;
  state.stepIndex = 0;
  state.face = 'PD';
  state.snapMissTop = false;
  state.snapMissSide = false;
  state.readings = { hzVantePd: null, vVantePd: null, hzRePi: null, vRePi: null };
  state.isTombarAnimating = false;
  state.finalized = false;

  resizeCanvases();
  generatePoints();
  generateZ();

  state.pose.azimuth = trueAngle('re');
  state.pose.elevation = state.Z.re;

  counterEl.textContent = state.exerciseCount;
  calcPanelEl.classList.remove('visible');
  calcPanelEl.style.borderColor = '';
  btnFinalizar.disabled = true;
  btnFinalizar.innerHTML = '✅ Finalizar';

  resetReadingDisplays();
  updateTopReadout();
  updateSideReadout();
  updateStepUI();
  drawAll();
  scrollStepIntoView();
}

function setReading(key, text) {
  const item = document.getElementById(READING_IDS[key]);
  if (!item) return;
  item.querySelector('.reading-val').textContent = text;
  item.classList.add('filled');
}

function resetReadingDisplays() {
  Object.values(READING_IDS).forEach((id) => {
    const item = document.getElementById(id);
    item.querySelector('.reading-val').textContent = '—';
    item.classList.remove('filled');
  });
}

// ── Top canvas (horizontal pointing) ──
function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isWithinSnapTop(aimAngle, targetName) {
  const trueA = trueAngle(targetName);
  let diffDeg = Math.abs(normAngle((aimAngle - trueA) * 180 / Math.PI));
  if (diffDeg > 180) diffDeg = 360 - diffDeg;
  return diffDeg <= SNAP_TOLERANCE_DEG;
}

function onTopMove(e) {
  const step = currentStep();
  if (step.axis !== 'hz' || state.isTombarAnimating) return;
  const pos = getCanvasPos(topCanvas, e);
  const station = state.points.station;
  state.pose.azimuth = Math.atan2(-(pos.y - station.y), pos.x - station.x);
  state.snapMissTop = false;
  updateTopReadout();
  drawAll();
}

function onTopDown(e) {
  const step = currentStep();
  if (step.axis !== 'hz' || state.isTombarAnimating) return;
  e.preventDefault();
  const pos = getCanvasPos(topCanvas, e);
  const station = state.points.station;
  const aim = Math.atan2(-(pos.y - station.y), pos.x - station.x);
  const targetPoint = state.points[step.target];

  if (dist(pos, targetPoint) <= TAP_RADIUS_PX || isWithinSnapTop(aim, step.target)) {
    state.pose.azimuth = trueAngle(step.target);
    state.snapMissTop = false;
    confirmHzReading();
  } else {
    state.pose.azimuth = aim;
    state.snapMissTop = true;
    updateTopReadout();
    drawAll();
  }
}

function updateTopReadout() {
  topReadoutEl.textContent = state.pose.azimuth === null ? '—' : formatDMS(hzReading(state.pose.azimuth));
}

function confirmHzReading() {
  const step = currentStep();
  const reading = hzReading(state.pose.azimuth);
  if (step.key === 'hz_vante_pd') {
    state.readings.hzVantePd = reading;
    setReading('hzVantePd', formatDMS(reading));
  } else if (step.key === 'hz_re_pi') {
    state.readings.hzRePi = reading;
    setReading('hzRePi', formatDMS(reading));
  }
  updateTopReadout();
  advanceStep();
}

// ── Side canvas (vertical pointing) ──
function sideTrunnion() {
  const w = sideCanvas.width / (window.devicePixelRatio || 1);
  const h = sideCanvas.height / (window.devicePixelRatio || 1);
  return { x: w * 0.26, y: h * 0.52 };
}

function zFromSidePos(pos, trunnion) {
  const dx = pos.x - trunnion.x;
  const dy = pos.y - trunnion.y;
  return Math.atan2(dx, -dy) * 180 / Math.PI;
}

function sideGuideRadius() {
  const w = sideCanvas.width / (window.devicePixelRatio || 1);
  const h = sideCanvas.height / (window.devicePixelRatio || 1);
  return Math.min(w, h) * 0.34;
}

function isWithinSnapSide(zAim, targetName) {
  return Math.abs(zAim - state.Z[targetName]) <= SNAP_TOLERANCE_DEG;
}

function onSideMove(e) {
  const step = currentStep();
  if (step.axis !== 'v' || state.isTombarAnimating) return;
  const pos = getCanvasPos(sideCanvas, e);
  state.pose.elevation = zFromSidePos(pos, sideTrunnion());
  state.snapMissSide = false;
  updateSideReadout();
  drawAll();
}

function onSideDown(e) {
  const step = currentStep();
  if (step.axis !== 'v' || state.isTombarAnimating) return;
  e.preventDefault();
  const pos = getCanvasPos(sideCanvas, e);
  const trunnion = sideTrunnion();
  const zAim = zFromSidePos(pos, trunnion);
  const guideR = sideGuideRadius();
  const flagPos = sideZPoint(trunnion, state.Z[step.target], guideR);

  if (dist(pos, flagPos) <= TAP_RADIUS_PX || isWithinSnapSide(zAim, step.target)) {
    state.pose.elevation = state.Z[step.target];
    state.snapMissSide = false;
    confirmVReading();
  } else {
    state.pose.elevation = zAim;
    state.snapMissSide = true;
    updateSideReadout();
    drawAll();
  }
}

function updateSideReadout() {
  sideReadoutEl.textContent = state.pose.elevation === null ? '—' : formatDMS(vReading(state.pose.elevation));
}

function confirmVReading() {
  const step = currentStep();
  const reading = vReading(state.pose.elevation);
  if (step.key === 'v_vante_pd') {
    state.readings.vVantePd = reading;
    setReading('vVantePd', formatDMS(reading));
  } else if (step.key === 'v_re_pi') {
    state.readings.vRePi = reading;
    setReading('vRePi', formatDMS(reading));
  }
  updateSideReadout();
  advanceStep();
}

// ── Tombar a Luneta ──
function onTombarClick() {
  if (state.isTombarAnimating) return;
  state.isTombarAnimating = true;
  btnTombar.disabled = true;
  hintEl.textContent = '🔄 Tombando a luneta...';

  const startElevation = state.pose.elevation;
  const startTime = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - startTime) / TOMBAR_DURATION_MS);
    const eased = easeInOutCubic(t);
    state.pose.elevation = startElevation + eased * 180;
    sideReadoutEl.textContent = formatDMS(normAngle(state.pose.elevation));
    drawSide();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      state.isTombarAnimating = false;
      state.face = 'PI';
      advanceStep();
    }
  }
  requestAnimationFrame(frame);
}

// ── Results & Finalize ──
function computeAndShowResults() {
  const { hzVantePd, vVantePd, hzRePi, vRePi } = state.readings;
  if (hzVantePd == null || vVantePd == null || hzRePi == null || vRePi == null) return;

  const zRe = normAngle(360 - vRePi);
  const checkOk = Math.abs(normAngle(hzRePi - 180)) < 0.05 || Math.abs(normAngle(hzRePi - 180) - 360) < 0.05;

  document.getElementById('calcHz').innerHTML =
    `Hz = Vante (PD) − Ré (PD)<br>Hz = ${formatDMS(hzVantePd)} − ${formatDMS(0)}<br><span class="eq">Hz = ${formatDMS(hzVantePd)}</span>`;

  document.getElementById('calcHzCheck').innerHTML =
    `Ré (PI) = Ré (PD) + 180°<br>Ré (PI) = ${formatDMS(0)} + 180°<br><span class="eq">Ré (PI) = ${formatDMS(hzRePi)}</span> ${checkOk ? '<span class="calc-check">✓</span>' : ''}`;

  document.getElementById('calcZVante').innerHTML =
    `Lido diretamente em PD<br><span class="eq">Z = ${formatDMS(vVantePd)}</span>`;

  document.getElementById('calcZRe').innerHTML =
    `Z = 360° − V Ré (PI)<br>Z = 360° − ${formatDMS(vRePi)}<br><span class="eq">Z = ${formatDMS(zRe)}</span>`;

  calcPanelEl.classList.add('visible');
  btnFinalizar.disabled = false;
}

function onFinalizeClick() {
  state.finalized = true;
  btnFinalizar.disabled = true;
  btnFinalizar.innerHTML = '✓ Concluído';
  calcPanelEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  hintEl.textContent = '🎉 Exercício concluído! Clique em "Novo Exercício" para tentar outro.';
}

// ── Drawing: shared helpers ──
function drawBadge(ctx, text, x, y, color, borderColor) {
  ctx.font = '600 11px "JetBrains Mono", monospace';
  const m = ctx.measureText(text);
  const pw = m.width + 12;
  const ph = 20;
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

function drawGrid(ctx, w, h) {
  const step = 40;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = step; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawDashedLine(ctx, from, to, color, width) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGenericArc(ctx, { center, startMathAngle, endMathAngle, radius, color, fillColor = null, label = null, showArrow = true, showSenseIcon = false, ccw = false, lineWidth = 2.5 }) {
  const canvasStart = -startMathAngle;
  const canvasEnd = -endMathAngle;

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

  if (fillColor && spanDeg > 1) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, radius, canvasStart, canvasEnd, ccw);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, canvasStart, canvasEnd, ccw);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

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

  if (showSenseIcon && spanDeg > 25) {
    const iconR = radius - 14;
    const ix = center.x + Math.cos(midCanvasAngle) * iconR;
    const iy = center.y + Math.sin(midCanvasAngle) * iconR;
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ccw ? '↺' : '↻', ix, iy);
  }

  if (label && spanDeg > 4) {
    const lx = center.x + Math.cos(midCanvasAngle) * radius;
    const ly = center.y + Math.sin(midCanvasAngle) * radius;
    drawBadge(ctx, label, lx, ly, color, color + '60');
  }
}

function drawPoint(ctx, pos, label, color) {
  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, POINT_RADIUS * 2.5);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const lx = pos.x - metrics.width / 2 - 6;
  const ly = pos.y - LABEL_OFFSET - 14;
  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, metrics.width + 12, 20, 4);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, pos.x, pos.y - LABEL_OFFSET);
}

function drawStationPoint(ctx, pos) {
  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, POINT_RADIUS * 3);
  gradient.addColorStop(0, COLORS.station + '50');
  gradient.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS * 3, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  const ch = POINT_RADIUS * 1.8;
  ctx.beginPath();
  ctx.moveTo(pos.x - ch, pos.y); ctx.lineTo(pos.x + ch, pos.y);
  ctx.moveTo(pos.x, pos.y - ch); ctx.lineTo(pos.x, pos.y + ch);
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, POINT_RADIUS + 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.station;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  const label = 'Estação';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const lx = pos.x - metrics.width / 2 - 6;
  const ly = pos.y + LABEL_OFFSET;

  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, metrics.width + 12, 22, 4);
  ctx.fill();

  ctx.fillStyle = COLORS.station;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, pos.x, pos.y + LABEL_OFFSET + 3);
}

function drawReferenceRay(ctx, station, zeroMathAngle, label = 'Zero PI (Ré+180°)', len = 115, labelDx = 0, labelDy = 0) {
  const zeroLen = len;
  const rayAngle = -zeroMathAngle;
  const rayEnd = {
    x: station.x + Math.cos(zeroMathAngle) * zeroLen,
    y: station.y - Math.sin(zeroMathAngle) * zeroLen,
  };

  ctx.beginPath();
  ctx.moveTo(station.x, station.y);
  ctx.lineTo(rayEnd.x, rayEnd.y);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

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

  const badgeR = zeroLen + 20;
  const bx = station.x + Math.cos(rayAngle) * badgeR + labelDx;
  const by = station.y + Math.sin(rayAngle) * badgeR + labelDy;
  drawBadge(ctx, label, bx, by, '#cbd5e1', 'rgba(148, 163, 184, 0.4)');
}

// ── Drawing: top view ──
function drawTop() {
  const w = topCanvas.width / (window.devicePixelRatio || 1);
  const h = topCanvas.height / (window.devicePixelRatio || 1);
  topCtx.fillStyle = COLORS.bg;
  topCtx.fillRect(0, 0, w, h);
  drawGrid(topCtx, w, h);

  const { station, re, vante } = state.points;
  if (!station) return;

  drawDashedLine(topCtx, station, re, COLORS.re, 1.5);
  drawDashedLine(topCtx, station, vante, COLORS.vante, 1.5);

  const zeroA = zeroRefAngle();

  if (state.face === 'PI') {
    drawReferenceRay(topCtx, station, zeroA);
  }

  if (state.pose.azimuth !== null && currentStep().axis === 'hz') {
    const maxLen = Math.max(w, h);
    const aimEnd = {
      x: station.x + Math.cos(state.pose.azimuth) * maxLen,
      y: station.y - Math.sin(state.pose.azimuth) * maxLen,
    };
    topCtx.beginPath();
    topCtx.moveTo(station.x, station.y);
    topCtx.lineTo(aimEnd.x, aimEnd.y);
    topCtx.strokeStyle = state.snapMissTop ? 'rgba(244, 63, 94, 0.5)' : COLORS.lineAim;
    topCtx.lineWidth = 1.5;
    topCtx.setLineDash([4, 6]);
    topCtx.stroke();
    topCtx.setLineDash([]);
  }

  if (state.pose.azimuth !== null) {
    drawGenericArc(topCtx, {
      center: station,
      startMathAngle: zeroA,
      endMathAngle: state.pose.azimuth,
      radius: 56,
      color: state.face === 'PD' ? COLORS.pd : COLORS.pi,
      fillColor: state.face === 'PD' ? 'rgba(6,182,212,0.10)' : 'rgba(168,85,247,0.10)',
      label: formatDMS(hzReading(state.pose.azimuth)),
      showArrow: true,
      lineWidth: 2.5,
    });
  }

  drawPoint(topCtx, re, 'Ré', COLORS.re);
  drawPoint(topCtx, vante, 'Vante', COLORS.vante);
  drawStationPoint(topCtx, station);
}

// ── Drawing: side view ──
function sideZPoint(trunnion, zDeg, r) {
  const rad = zDeg * Math.PI / 180;
  return { x: trunnion.x + Math.sin(rad) * r, y: trunnion.y - Math.cos(rad) * r };
}

function drawSideFlag(trunnion, zDeg, r, color, label) {
  const p = sideZPoint(trunnion, zDeg, r);
  sideCtx.beginPath();
  sideCtx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  sideCtx.fillStyle = color;
  sideCtx.fill();
  sideCtx.strokeStyle = '#fff';
  sideCtx.lineWidth = 1.5;
  sideCtx.stroke();

  const dx = p.x - trunnion.x;
  const dy = p.y - trunnion.y;
  const len = Math.hypot(dx, dy) || 1;
  const lx = p.x + (dx / len) * 26;
  const ly = p.y + (dy / len) * 26;
  drawBadge(sideCtx, label, lx, ly, color, color + '60');
}

function drawTripod(trunnion) {
  const legLen = 40;
  sideCtx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
  sideCtx.lineWidth = 2;
  sideCtx.beginPath();
  sideCtx.moveTo(trunnion.x, trunnion.y);
  sideCtx.lineTo(trunnion.x - 20, trunnion.y + legLen);
  sideCtx.moveTo(trunnion.x, trunnion.y);
  sideCtx.lineTo(trunnion.x + 20, trunnion.y + legLen);
  sideCtx.stroke();

  sideCtx.beginPath();
  sideCtx.arc(trunnion.x, trunnion.y, POINT_RADIUS, 0, Math.PI * 2);
  sideCtx.fillStyle = COLORS.station;
  sideCtx.fill();
  sideCtx.strokeStyle = '#fff';
  sideCtx.lineWidth = 2;
  sideCtx.stroke();

  const label = 'Estação';
  sideCtx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  sideCtx.textAlign = 'center';
  sideCtx.textBaseline = 'top';
  const metrics = sideCtx.measureText(label);
  const lx = trunnion.x - metrics.width / 2 - 6;
  const ly = trunnion.y + legLen + 6;
  sideCtx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  sideCtx.beginPath();
  sideCtx.roundRect(lx, ly, metrics.width + 12, 20, 4);
  sideCtx.fill();
  sideCtx.fillStyle = COLORS.station;
  sideCtx.fillText(label, trunnion.x, ly + 3);
}

function drawSide() {
  const w = sideCanvas.width / (window.devicePixelRatio || 1);
  const h = sideCanvas.height / (window.devicePixelRatio || 1);
  sideCtx.fillStyle = COLORS.bg;
  sideCtx.fillRect(0, 0, w, h);
  drawGrid(sideCtx, w, h);

  if (!state.points.station) return;

  const trunnion = sideTrunnion();
  const guideR = sideGuideRadius();

  sideCtx.beginPath();
  sideCtx.moveTo(0, trunnion.y);
  sideCtx.lineTo(w, trunnion.y);
  sideCtx.strokeStyle = COLORS.horizon;
  sideCtx.lineWidth = 1.2;
  sideCtx.setLineDash([6, 5]);
  sideCtx.stroke();
  sideCtx.setLineDash([]);
  drawBadge(sideCtx, 'Horizonte Z=90°', w - 76, trunnion.y - 16, '#cbd5e1', 'rgba(148,163,184,0.3)');

  sideCtx.beginPath();
  for (let z = 60; z <= 120; z += 2) {
    const p = sideZPoint(trunnion, z, guideR);
    if (z === 60) sideCtx.moveTo(p.x, p.y); else sideCtx.lineTo(p.x, p.y);
  }
  sideCtx.strokeStyle = 'rgba(148,163,184,0.25)';
  sideCtx.lineWidth = 1;
  sideCtx.stroke();

  for (let z = 60; z <= 120; z += 10) {
    const inner = sideZPoint(trunnion, z, guideR - 6);
    const outer = sideZPoint(trunnion, z, guideR + 6);
    sideCtx.beginPath();
    sideCtx.moveTo(inner.x, inner.y);
    sideCtx.lineTo(outer.x, outer.y);
    sideCtx.strokeStyle = z === 90 ? 'rgba(148,163,184,0.7)' : 'rgba(148,163,184,0.3)';
    sideCtx.lineWidth = z === 90 ? 2 : 1;
    sideCtx.stroke();
  }

  // Zênite: referência fixa (Z=0) para a leitura vertical, análoga à Ré no Hz.
  const zenithMathAngle = Math.PI / 2;
  // O rótulo é desenhado 20px além da ponta do raio; limitar o comprimento a
  // (trunnion.y − 34) garante que ele nunca encoste no topo em canvas curto.
  // O rótulo sai deslocado para a direita e um pouco abaixo da ponta do raio,
  // para não cair sob o título "Vista Lateral" sobreposto ao canto do canvas.
  drawReferenceRay(sideCtx, trunnion, zenithMathAngle, 'Zênite (Z=0°)',
    Math.min(guideR + 30, trunnion.y - 34), 58, 52);

  // Raios tracejados até Ré/Vante, análogos às linhas estação→Ré/Vante da vista superior.
  drawDashedLine(sideCtx, trunnion, sideZPoint(trunnion, state.Z.re, guideR), COLORS.re, 1.2);
  drawDashedLine(sideCtx, trunnion, sideZPoint(trunnion, state.Z.vante, guideR), COLORS.vante, 1.2);

  // O tripé vem antes do arco: em PI o arco varre quase 360°, e seu rótulo de
  // leitura cai perto da base — desenhado depois, fica legível por cima dela.
  drawTripod(trunnion);

  // Arco varrido do Zênite até a pontaria atual: horário em PD, anti-horário em PI
  // (mesma convenção do círculo vertical real — daí V_PI = 360° − V_PD).
  if (state.pose.elevation !== null) {
    const isPI = state.face === 'PI';
    drawGenericArc(sideCtx, {
      center: trunnion,
      startMathAngle: zenithMathAngle,
      endMathAngle: zToMathAngle(state.pose.elevation),
      radius: guideR * 0.6,
      color: isPI ? COLORS.pi : COLORS.pd,
      fillColor: isPI ? 'rgba(168,85,247,0.10)' : 'rgba(6,182,212,0.10)',
      label: formatDMS(vReading(state.pose.elevation)),
      showArrow: true,
      showSenseIcon: true,
      ccw: isPI,
      lineWidth: 2.5,
    });
  }

  drawSideFlag(trunnion, state.Z.re, guideR, COLORS.re, 'Ré');
  drawSideFlag(trunnion, state.Z.vante, guideR, COLORS.vante, 'Vante');

  if (state.pose.elevation !== null) {
    const tubeColor = state.face === 'PD' ? COLORS.pd : COLORS.pi;
    const tip = sideZPoint(trunnion, state.pose.elevation, guideR - 4);
    sideCtx.beginPath();
    sideCtx.moveTo(trunnion.x, trunnion.y);
    sideCtx.lineTo(tip.x, tip.y);
    sideCtx.strokeStyle = state.snapMissSide ? 'rgba(244,63,94,0.7)' : tubeColor;
    sideCtx.lineWidth = 5;
    sideCtx.lineCap = 'round';
    sideCtx.stroke();

    sideCtx.beginPath();
    sideCtx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    sideCtx.fillStyle = tubeColor;
    sideCtx.fill();
  }
}

function drawAll() {
  drawTop();
  drawSide();
}
