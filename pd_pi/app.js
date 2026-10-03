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
const TOMBAR_DURATION_MS = 800;

// ── Bilingual Dictionary ──
const pdpiI18n = {
  'pt-BR': {
    docTitle: 'Pontaria Direta e Inversa (PD/PI) — Simulador Didático de Topografia',
    headerTitle: 'Pontaria Direta e Inversa',
    headerSub: 'Simulador Didático de Topografia — PD / PI',
    portalLink: 'Portal',
    faceTitle: 'Face Atual',
    stepsTitle: 'Etapas',
    readingsTitle: 'Leituras Coletadas',
    labelHzRePd: 'Hz Ré (PD)',
    labelHzVantePd: 'Hz Vante (PD)',
    labelVVantePd: 'V Vante (PD)',
    labelHzRePi: 'Hz Vante (PI)',
    labelVRePi: 'V Vante (PI)',
    btnTombarText: 'Tombar a Luneta',
    btnNewText: 'Novo Exercício',
    exerciseCounterLabel: 'Exercício nº',
    topPaneLabel: 'Vista Superior — Limbo Horizontal',
    sidePaneLabel: 'Vista Lateral — Círculo Vertical',
    calcPanelTitle: '📐 Cálculos e Verificação de Face',
    calcHzLabel: 'Ângulo Horizontal (Hz)',
    calcHzCheckLabel: 'Verificação de Face (Hz)',
    calcZVanteLabel: 'Ângulo Zenital do Vante (Z)',
    calcZReLabel: 'Ângulo Zenital do Vante em PI (Z)',
    btnFinalizar: '✅ Finalizar',
    btnFinalizado: '✓ Concluído',
    modal1Title: 'Pontaria Direta (PD) e Inversa (PI)',
    modal1P1: 'Para eliminar erros sistemáticos do teodolito, cada direção pode ser observada em <strong>duas posições</strong> da luneta:',
    modal1P2: '<strong>PD (Posição Direta)</strong> — posição normal da luneta.<br><strong>PI (Posição Inversa)</strong> — após "tombar" (girar 180° em torno do eixo horizontal) a luneta.',
    modal1P3: 'Assim como no simulador de Direções, três pontos são gerados aleatoriamente: <strong>Estação</strong>, <strong>Ré</strong> e <strong>Vante</strong>. O equipamento está sempre orientado (zerado) na Ré, em sentido horário.',
    btnModal1Next: 'Próximo →',
    modal2Title: 'A Relação Entre as Faces',
    modal2P1: 'Ao tombar a luneta, duas relações clássicas aparecem entre as leituras da PD e da PI, para o mesmo alvo:',
    modal2P2: 'Você fará a pontaria no <strong>Vante</strong> (horizontal e vertical) em PD, tombará a luneta, e então fará a pontaria no <strong>Vante</strong> (horizontal e vertical) em PI. Ao final, os cálculos mostrarão essas relações na prática.',
    btnModal2Start: '🎯 Começar Simulação',
    stepLabels: {
      hz_vante_pd: 'Pontaria horizontal — Vante (PD)',
      v_vante_pd: 'Pontaria vertical — Vante (PD)',
      tombar: 'Tombar a luneta',
      hz_re_pi: 'Pontaria horizontal — Vante (PI)',
      v_re_pi: 'Pontaria vertical — Vante (PI)',
      results: 'Cálculos e finalização',
    },
    hints: {
      hz_vante_pd: '🎯 Mire na direção do Vante (vista superior) para registrar a pontaria horizontal',
      v_vante_pd: '🎯 Mire na elevação do Vante (vista lateral) para registrar a pontaria vertical',
      tombar: '🔄 Clique em "Tombar a Luneta" para passar à posição inversa (PI)',
      hz_re_pi: '🎯 Mire na direção do Vante (vista superior) para registrar a pontaria horizontal em PI',
      v_re_pi: '🎯 Mire na elevação do Vante (vista lateral) para registrar a pontaria vertical em PI',
      results: '✅ Pontarias concluídas! Revise os cálculos e finalize.',
      tombando: '🔄 Tombando a luneta...',
      exerciseDone: '🎉 Exercício concluído! Clique em "Novo Exercício" para tentar outro.',
    },
    canvas: {
      station: 'Estação',
      re: 'Ré',
      vante: 'Vante',
      zeroPi: 'Zero PI (Ré+180°)',
      horizon: 'Horizonte Z=90°',
      zenith: 'Zênite Z=0°',
      tombarDiag: 'tombar (180°)',
    },
    calcs: {
      hzFormula: 'Hz = Vante (PD) − Ré (PD)',
      hzCheckFormula: 'Vante (PI) = Vante (PD) + 180°',
      zDirect: 'Lido diretamente em PD',
      zPiFormula: 'Z = 360° − V Vante (PI)',
    }
  },
  'en': {
    docTitle: 'Direct and Reverse Pointing (D/R) — Topography Educational Simulator',
    headerTitle: 'Direct & Reverse Pointing',
    headerSub: 'Topography Educational Simulator — PD / PI (Face Left / Face Right)',
    portalLink: 'Portal',
    faceTitle: 'Current Face',
    stepsTitle: 'Steps',
    readingsTitle: 'Recorded Readings',
    labelHzRePd: 'Hz BS (Direct)',
    labelHzVantePd: 'Hz FS (Direct)',
    labelVVantePd: 'V FS (Direct)',
    labelHzRePi: 'Hz FS (Reverse)',
    labelVRePi: 'V FS (Reverse)',
    btnTombarText: 'Plunge Telescope',
    btnNewText: 'New Exercise',
    exerciseCounterLabel: 'Exercise #',
    topPaneLabel: 'Top View — Horizontal Circle',
    sidePaneLabel: 'Side View — Vertical Circle',
    calcPanelTitle: '📐 Calculations & Face Verification',
    calcHzLabel: 'Horizontal Angle (Hz)',
    calcHzCheckLabel: 'Face Check (Hz)',
    calcZVanteLabel: 'Zenith Angle of FS (Z)',
    calcZReLabel: 'Zenith Angle of FS in Reverse (Z)',
    btnFinalizar: '✅ Finalize',
    btnFinalizado: '✓ Completed',
    modal1Title: 'Direct (PD) and Reverse (PI) Sighting',
    modal1P1: 'To eliminate systematic errors in theodolites and total stations, each direction can be measured in <strong>two telescope faces</strong>:',
    modal1P2: '<strong>PD (Direct / Face Left)</strong> — regular telescope position.<br><strong>PI (Reverse / Face Right)</strong> — after "plunging / transiting" (rotating 180° around horizontal axis) the telescope.',
    modal1P3: 'Just like in the Directions simulator, three points are generated randomly: <strong>Station</strong>, <strong>Backsight (BS)</strong>, and <strong>Foresight (FS)</strong>. The instrument is always zero-indexed on Backsight, clockwise.',
    btnModal1Next: 'Next →',
    modal2Title: 'The Relationship Between Faces',
    modal2P1: 'When plunging the telescope, two fundamental relationships arise between Direct and Reverse readings for the same target:',
    modal2P2: 'You will aim at <strong>Foresight</strong> (horizontal and vertical) in Direct, plunge the telescope, and then aim at <strong>Foresight</strong> (horizontal and vertical) in Reverse. At the end, the calculations will verify these relationships in practice.',
    btnModal2Start: '🎯 Start Simulation',
    stepLabels: {
      hz_vante_pd: 'Horizontal sighting — Foresight (Direct)',
      v_vante_pd: 'Vertical sighting — Foresight (Direct)',
      tombar: 'Plunge telescope',
      hz_re_pi: 'Horizontal sighting — Foresight (Reverse)',
      v_re_pi: 'Vertical sighting — Foresight (Reverse)',
      results: 'Calculations & review',
    },
    hints: {
      hz_vante_pd: '🎯 Aim towards Foresight (top view) to record horizontal reading',
      v_vante_pd: '🎯 Aim at Foresight elevation (side view) to record vertical reading',
      tombar: '🔄 Click "Plunge Telescope" to switch to Reverse (PI) position',
      hz_re_pi: '🎯 Aim towards Foresight (top view) to record horizontal reading in Reverse',
      v_re_pi: '🎯 Aim at Foresight elevation (side view) to record vertical reading in Reverse',
      results: '✅ Sightings completed! Review calculations and finalize.',
      tombando: '🔄 Plunging telescope...',
      exerciseDone: '🎉 Exercise complete! Click "New Exercise" to try another.',
    },
    canvas: {
      station: 'Station',
      re: 'Backsight',
      vante: 'Foresight',
      zeroPi: 'Zero Rev (BS+180°)',
      horizon: 'Horizon Z=90°',
      zenith: 'Zenith Z=0°',
      tombarDiag: 'plunge (180°)',
    },
    calcs: {
      hzFormula: 'Hz = FS (Direct) − BS (Direct)',
      hzCheckFormula: 'FS (Reverse) = FS (Direct) + 180°',
      zDirect: 'Directly read in Direct',
      zPiFormula: 'Z = 360° − V FS (Reverse)',
    }
  }
};

let currentLang = 'pt-BR';

function t(keyPath) {
  const parts = keyPath.split('.');
  let cur = pdpiI18n[currentLang];
  for (const part of parts) {
    if (cur && cur[part] !== undefined) {
      cur = cur[part];
    } else {
      return keyPath;
    }
  }
  return cur;
}

// ── Step definitions ──
const STEPS = [
  { key: 'hz_vante_pd', axis: 'hz', target: 'vante', face: 'PD' },
  { key: 'v_vante_pd', axis: 'v', target: 'vante', face: 'PD' },
  { key: 'tombar', axis: null, target: null, face: 'PD' },
  { key: 'hz_re_pi', axis: 'hz', target: 'vante', face: 'PI' },
  { key: 'v_re_pi', axis: 'v', target: 'vante', face: 'PI' },
  { key: 'results', axis: null, target: null, face: 'PI' },
];

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

// ── Bilingual Language Switcher ──
function setLanguage(lang) {
  if (!pdpiI18n[lang]) lang = 'pt-BR';
  currentLang = lang;
  try {
    localStorage.setItem('monorepo_lang', lang);
  } catch (e) {}

  document.documentElement.lang = lang;
  document.title = t('docTitle');

  const setText = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  };
  const setHtml = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = t(key);
  };

  setText('headerTitle', 'headerTitle');
  setText('headerSub', 'headerSub');
  setText('portalLinkText', 'portalLink');
  setText('faceTitle', 'faceTitle');
  setText('stepsTitle', 'stepsTitle');
  setText('readingsTitle', 'readingsTitle');
  setText('labelHzRePd', 'labelHzRePd');
  setText('labelHzVantePd', 'labelHzVantePd');
  setText('labelVVantePd', 'labelVVantePd');
  setText('labelHzRePi', 'labelHzRePi');
  setText('labelVRePi', 'labelVRePi');
  setText('btnTombarText', 'btnTombarText');
  setText('btnNewText', 'btnNewText');
  setText('exerciseCounterLabel', 'exerciseCounterLabel');
  setText('topPaneLabel', 'topPaneLabel');
  setText('sidePaneLabel', 'sidePaneLabel');
  setText('calcPanelTitle', 'calcPanelTitle');
  setText('calcHzLabel', 'calcHzLabel');
  setText('calcHzCheckLabel', 'calcHzCheckLabel');
  setText('calcZVanteLabel', 'calcZVanteLabel');
  setText('calcZReLabel', 'calcZReLabel');

  setText('modal1Title', 'modal1Title');
  setHtml('modal1P1', 'modal1P1');
  setHtml('modal1P2', 'modal1P2');
  setHtml('modal1P3', 'modal1P3');
  setText('btnModal1Next', 'btnModal1Next');

  setText('modal2Title', 'modal2Title');
  setHtml('modal2P1', 'modal2P1');
  setHtml('modal2P2', 'modal2P2');
  setText('btnModal2Start', 'btnModal2Start');

  const portalLink = document.getElementById('portalLink');
  if (portalLink) {
    portalLink.href = '../index.html?lang=' + (lang === 'en' ? 'en' : 'pt');
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  if (state.finalized) {
    if (btnFinalizar) btnFinalizar.innerHTML = t('btnFinalizado');
    if (hintEl) hintEl.textContent = t('hints.exerciseDone');
  } else {
    if (btnFinalizar) btnFinalizar.innerHTML = t('btnFinalizar');
    const step = currentStep();
    if (hintEl && step) hintEl.textContent = t('hints.' + step.key) || '';
  }

  buildStepChecklist();
  updateStepUI();
  drawModal1Diagram();
  if (state.points && state.points.station) {
    drawAll();
  }
  if (state.stepIndex === STEPS.length - 1 && calcPanelEl && calcPanelEl.classList.contains('visible')) {
    computeAndShowResults();
  }
}

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

  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get('lang');
  let initLang = 'pt-BR';
  if (paramLang === 'en' || paramLang === 'pt-BR') {
    initLang = paramLang;
  } else if (paramLang === 'pt') {
    initLang = 'pt-BR';
  } else {
    try {
      const stored = localStorage.getItem('monorepo_lang');
      if (stored === 'en' || stored === 'pt-BR') {
        initLang = stored;
      }
    } catch (e) {}
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetLang = e.currentTarget.getAttribute('data-lang');
      setLanguage(targetLang);
    });
  });

  setLanguage(initLang);

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

  topCanvas.addEventListener('mousemove', onTopMove);
  topCanvas.addEventListener('mousedown', onTopDown);
  topCanvas.addEventListener('touchmove', onTopTouchMove, { passive: false });
  topCanvas.addEventListener('touchstart', onTopTouchStart, { passive: false });

  sideCanvas.addEventListener('mousemove', onSideMove);
  sideCanvas.addEventListener('mousedown', onSideDown);
  sideCanvas.addEventListener('touchmove', onSideTouchMove, { passive: false });
  sideCanvas.addEventListener('touchstart', onSideTouchStart, { passive: false });

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
  dctx.fillText(t('canvas.tombarDiag'), midX, cy - 90);
}

// ── Step checklist ──
function buildStepChecklist() {
  if (!stepChecklistEl) return;
  stepChecklistEl.innerHTML = '';
  STEPS.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-item';
    div.innerHTML = `<span class="step-num">${i + 1}</span><span class="step-text">${t('stepLabels.' + step.key)}</span>`;
    stepChecklistEl.appendChild(div);
  });
}

function currentStep() {
  return STEPS[state.stepIndex];
}

function updateStepUI() {
  if (!stepChecklistEl) return;
  const items = stepChecklistEl.querySelectorAll('.step-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === state.stepIndex);
    el.classList.toggle('done', i < state.stepIndex);
    el.querySelector('.step-num').textContent = i < state.stepIndex ? '✓' : String(i + 1);
  });

  if (faceBadgeEl) {
    faceBadgeEl.textContent = state.face;
    faceBadgeEl.className = 'face-badge ' + state.face.toLowerCase();
  }

  const step = currentStep();
  if (hintEl) {
    hintEl.classList.remove('hidden');
    hintEl.textContent = state.finalized ? t('hints.exerciseDone') : (t('hints.' + step.key) || '');
  }

  btnTombar.disabled = step.key !== 'tombar';

  if (step.key === 'results') {
    computeAndShowResults();
  }
}

function advanceStep() {
  state.stepIndex++;
  updateStepUI();
  drawAll();
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
  btnFinalizar.innerHTML = t('btnFinalizar');

  resetReadingDisplays();
  updateTopReadout();
  updateSideReadout();
  updateStepUI();
  drawAll();
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
  const pos = getCanvasPos(topCanvas, e);
  const station = state.points.station;
  const aim = Math.atan2(-(pos.y - station.y), pos.x - station.x);
  const targetPoint = state.points[step.target];

  if (dist(pos, targetPoint) <= 25 || isWithinSnapTop(aim, step.target)) {
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

function onTopTouchMove(e) {
  e.preventDefault();
  const step = currentStep();
  if (step.axis !== 'hz' || state.isTombarAnimating) return;
  const pos = getCanvasPos(topCanvas, e.touches[0]);
  const station = state.points.station;
  state.pose.azimuth = Math.atan2(-(pos.y - station.y), pos.x - station.x);
  state.snapMissTop = false;
  updateTopReadout();
  drawAll();
}

function onTopTouchStart(e) {
  e.preventDefault();
  const step = currentStep();
  if (step.axis !== 'hz' || state.isTombarAnimating) return;
  const pos = getCanvasPos(topCanvas, e.touches[0]);
  const station = state.points.station;
  const aim = Math.atan2(-(pos.y - station.y), pos.x - station.x);
  const targetPoint = state.points[step.target];

  if (dist(pos, targetPoint) <= 25 || isWithinSnapTop(aim, step.target)) {
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
  const pos = getCanvasPos(sideCanvas, e);
  const zAim = zFromSidePos(pos, sideTrunnion());

  if (isWithinSnapSide(zAim, step.target)) {
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

function onSideTouchMove(e) {
  e.preventDefault();
  const step = currentStep();
  if (step.axis !== 'v' || state.isTombarAnimating) return;
  const pos = getCanvasPos(sideCanvas, e.touches[0]);
  state.pose.elevation = zFromSidePos(pos, sideTrunnion());
  state.snapMissSide = false;
  updateSideReadout();
  drawAll();
}

function onSideTouchStart(e) {
  e.preventDefault();
  const step = currentStep();
  if (step.axis !== 'v' || state.isTombarAnimating) return;
  const pos = getCanvasPos(sideCanvas, e.touches[0]);
  const zAim = zFromSidePos(pos, sideTrunnion());

  if (isWithinSnapSide(zAim, step.target)) {
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
  hintEl.textContent = t('hints.tombando');

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

  const zVantePi = normAngle(360 - vRePi);
  const expectedHz = normAngle(hzVantePd + 180);
  const checkOk = Math.abs(normAngle(hzRePi - expectedHz)) < 0.05 || Math.abs(normAngle(hzRePi - expectedHz) - 360) < 0.05;

  const hzFormula = t('calcs.hzFormula');
  const hzCheckFormula = t('calcs.hzCheckFormula');
  const zDirect = t('calcs.zDirect');
  const zPiFormula = t('calcs.zPiFormula');
  const fsLabel = currentLang === 'en' ? 'FS (Reverse)' : 'Vante (PI)';

  document.getElementById('calcHz').innerHTML =
    `${hzFormula}<br>Hz = ${formatDMS(hzVantePd)} − ${formatDMS(0)}<br><span class="eq">Hz = ${formatDMS(hzVantePd)}</span>`;

  document.getElementById('calcHzCheck').innerHTML =
    `${hzCheckFormula}<br>${fsLabel} = ${formatDMS(hzVantePd)} + 180°<br><span class="eq">${fsLabel} = ${formatDMS(hzRePi)}</span> ${checkOk ? '<span class="calc-check">✓</span>' : ''}`;

  document.getElementById('calcZVante').innerHTML =
    `${zDirect}<br><span class="eq">Z = ${formatDMS(vVantePd)}</span>`;

  document.getElementById('calcZRe').innerHTML =
    `${zPiFormula}<br>Z = 360° − ${formatDMS(vRePi)}<br><span class="eq">Z = ${formatDMS(zVantePi)}</span>`;

  calcPanelEl.classList.add('visible');
  btnFinalizar.disabled = false;
}

function onFinalizeClick() {
  state.finalized = true;
  btnFinalizar.disabled = true;
  btnFinalizar.innerHTML = t('btnFinalizado');
  calcPanelEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  hintEl.textContent = t('hints.exerciseDone');
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

function drawGenericArc(ctx, { center, startMathAngle, endMathAngle, radius, color, fillColor = null, label = null, showArrow = true, lineWidth = 2.5, ccw = false }) {
  const canvasStart = -startMathAngle;
  const canvasEnd = -endMathAngle;
  const sweepSign = ccw ? -1 : 1;

  const spanDeg = ccw
    ? normAngle((canvasStart - canvasEnd) * 180 / Math.PI)
    : normAngle((canvasEnd - canvasStart) * 180 / Math.PI);
  const midCanvasAngle = canvasStart + sweepSign * (spanDeg / 2) * Math.PI / 180;

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
    const tangent = canvasEnd + sweepSign * Math.PI / 2;
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

  const label = t('canvas.station');
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

function drawZeroDirection(ctx, station, zeroMathAngle) {
  const zeroLen = 115;
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
  const bx = station.x + Math.cos(rayAngle) * badgeR;
  const by = station.y + Math.sin(rayAngle) * badgeR;
  drawBadge(ctx, t('canvas.zeroPi'), bx, by, '#cbd5e1', 'rgba(148, 163, 184, 0.4)');
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
    drawZeroDirection(topCtx, station, zeroA);
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

  drawPoint(topCtx, re, t('canvas.re'), COLORS.re);
  drawPoint(topCtx, vante, t('canvas.vante'), COLORS.vante);
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

  const label = t('canvas.station');
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
  const guideR = Math.min(w, h) * 0.34;

  sideCtx.beginPath();
  sideCtx.moveTo(0, trunnion.y);
  sideCtx.lineTo(w, trunnion.y);
  sideCtx.strokeStyle = COLORS.horizon;
  sideCtx.lineWidth = 1.2;
  sideCtx.setLineDash([6, 5]);
  sideCtx.stroke();
  sideCtx.setLineDash([]);
  drawBadge(sideCtx, t('canvas.horizon'), w - 76, trunnion.y - 16, '#cbd5e1', 'rgba(148,163,184,0.3)');

  const zenithPoint = sideZPoint(trunnion, 0, guideR);
  sideCtx.beginPath();
  sideCtx.moveTo(trunnion.x, trunnion.y);
  sideCtx.lineTo(zenithPoint.x, zenithPoint.y);
  sideCtx.strokeStyle = 'rgba(148,163,184,0.55)';
  sideCtx.lineWidth = 1.2;
  sideCtx.setLineDash([6, 5]);
  sideCtx.stroke();
  sideCtx.setLineDash([]);
  drawBadge(sideCtx, t('canvas.zenith'), zenithPoint.x, zenithPoint.y - 18, '#cbd5e1', 'rgba(148,163,184,0.3)');

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

  drawSideFlag(trunnion, state.Z.vante, guideR, COLORS.vante, t('canvas.vante'));

  if (state.pose.elevation !== null) {
    const tubeColor = state.face === 'PD' ? COLORS.pd : COLORS.pi;
    const zArcCcw = state.face === 'PI';
    drawGenericArc(sideCtx, {
      center: trunnion,
      startMathAngle: Math.PI / 2,
      endMathAngle: (90 - state.pose.elevation) * Math.PI / 180,
      radius: guideR * 0.55,
      color: tubeColor,
      fillColor: (state.face === 'PD' ? 'rgba(6,182,212,0.10)' : 'rgba(168,85,247,0.10)'),
      label: formatDMS(vReading(state.pose.elevation)),
      showArrow: true,
      lineWidth: 2.5,
      ccw: zArcCcw,
    });

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

  drawTripod(trunnion);
}

function drawAll() {
  drawTop();
  drawSide();
}
