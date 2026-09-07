/**
 * Apresentação Didática Interativa — Medida Eletrônica de Distâncias (EDM)
 * ─────────────────────────────────────────────────────────────────────
 * Um item de painel lateral por parágrafo de med/teoria.md, com resumo,
 * animação em Canvas 2D e um simulador interativo da resolução da
 * ambiguidade de fase (parágrafo 3).
 */

// ── Small drawing primitives (shared across topic animations) ──
function iconText(ctx, emoji, x, y, size) {
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}

function drawDashedLine(ctx, x1, y1, x2, y2, color, width = 1.5, dash = [6, 5]) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

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

function drawRayPartial(ctx, from, to, progress, color, width = 2.5) {
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function pingPong(t, period) {
  const phase = (t % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

function drawGridBg(ctx, w, h) {
  const step = 40;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 0.5;
  for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// ── Topic animations ──
function renderTopic0(ctx, w, h, t) {
  const y = h * 0.55;
  const x1 = w * 0.22, x2 = w * 0.78;
  drawDashedLine(ctx, x1, y, x2, y, 'rgba(20,184,166,0.4)', 2);
  iconText(ctx, '📡', x1, y, 40);
  iconText(ctx, '🪞', x2, y, 36);
  const p = pingPong(t, 2.4);
  const px = x1 + (x2 - x1) * p;
  ctx.beginPath();
  ctx.arc(px, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#14b8a6';
  ctx.shadowColor = '#14b8a6';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  drawBadge(ctx, 'onda eletromagnética', (x1 + x2) / 2, y - 44, '#5eead4', 'rgba(20,184,166,0.4)');
}

function renderTopic1(ctx, w, h, t) {
  const cy = h * 0.5;
  const emitPos = { x: w * 0.18, y: cy - 24 };
  const recPos = { x: w * 0.18, y: cy + 34 };
  const splitPos = { x: w * 0.4, y: cy };
  const refPos = { x: w * 0.86, y: cy };

  iconText(ctx, '📤', emitPos.x, emitPos.y, 26);
  iconText(ctx, '📥', recPos.x, recPos.y, 26);
  iconText(ctx, '🔀', splitPos.x, splitPos.y, 24);
  iconText(ctx, '🪞', refPos.x, refPos.y, 30);

  drawDashedLine(ctx, emitPos.x + 16, emitPos.y + 4, splitPos.x - 14, splitPos.y - 8, 'rgba(20,184,166,0.35)');
  drawDashedLine(ctx, splitPos.x - 4, splitPos.y + 8, recPos.x + 16, recPos.y - 4, 'rgba(20,184,166,0.25)');
  drawDashedLine(ctx, splitPos.x + 14, splitPos.y, refPos.x - 18, refPos.y, 'rgba(20,184,166,0.4)');

  const p1 = pingPong(t, 1.1);
  const ix = splitPos.x + (recPos.x - splitPos.x) * p1;
  const iy = splitPos.y + (recPos.y - splitPos.y) * p1;
  ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.fillStyle = '#5eead4'; ctx.fill();

  const p2 = pingPong(t, 2.6);
  const ex = splitPos.x + (refPos.x - splitPos.x) * p2;
  ctx.beginPath(); ctx.arc(ex, splitPos.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#14b8a6'; ctx.fill();

  drawBadge(ctx, 'sinal de referência', (splitPos.x + recPos.x) / 2, (splitPos.y + recPos.y) / 2 + 20, '#5eead4', 'rgba(20,184,166,0.3)');
  drawBadge(ctx, 'sinal externo (refletido)', (splitPos.x + refPos.x) / 2, splitPos.y - 26, '#14b8a6', 'rgba(20,184,166,0.4)');
}

function renderTopic3(ctx, w, h, t) {
  const cy = h * 0.52;
  const lx = w * 0.27, rx = w * 0.73;
  const p = pingPong(t, 2.2);

  iconText(ctx, '🔺', lx, cy, 30);
  drawBadge(ctx, 'Prisma — reflexão total', lx, cy + 56, '#5eead4', 'rgba(20,184,166,0.35)');
  const pin = { x: lx - 75, y: cy - 38 }, pmid = { x: lx, y: cy }, pout = { x: lx - 75, y: cy + 38 };
  if (p < 0.5) {
    drawRayPartial(ctx, pin, pmid, p * 2, '#14b8a6');
  } else {
    drawRayPartial(ctx, pin, pmid, 1, 'rgba(20,184,166,0.4)');
    drawRayPartial(ctx, pmid, pout, (p - 0.5) * 2, '#14b8a6');
  }

  iconText(ctx, '◻️', rx, cy, 28);
  drawBadge(ctx, 'Difusa — sem prisma', rx, cy + 56, '#fbbf24', 'rgba(245,158,11,0.35)');
  const din = { x: rx - 75, y: cy - 38 }, dmid = { x: rx, y: cy };
  if (p < 0.5) {
    drawRayPartial(ctx, din, dmid, p * 2, '#fbbf24');
  } else {
    drawRayPartial(ctx, din, dmid, 1, 'rgba(245,158,11,0.35)');
    const spreadDeg = [-25, -8, 10, 28];
    const len = 60 * ((p - 0.5) * 2);
    spreadDeg.forEach((deg, i) => {
      const rad = deg * Math.PI / 180;
      const ex = dmid.x + Math.sin(rad) * len;
      const ey = dmid.y - Math.cos(rad) * len;
      ctx.beginPath();
      ctx.moveTo(dmid.x, dmid.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = i === 1 ? '#fbbf24' : 'rgba(245,158,11,0.18)';
      ctx.lineWidth = i === 1 ? 2 : 1;
      ctx.stroke();
    });
  }
}

const ERROR_LABELS = ['Erro de Zero', 'Fator de Escala', 'Erro Cíclico', 'Constante do Prisma'];
function renderTopic4(ctx, w, h, t) {
  const y = h * 0.55;
  const x1 = w * 0.16, x2 = w * 0.84;
  drawDashedLine(ctx, x1, y, x2, y, 'rgba(148,163,184,0.4)', 2);
  iconText(ctx, '📡', x1, y, 32);
  iconText(ctx, '🎯', x2, y, 32);
  const idx = Math.floor(t / 1.6) % ERROR_LABELS.length;
  drawBadge(ctx, ERROR_LABELS[idx], (x1 + x2) / 2, y - 42, '#f43f5e', 'rgba(244,63,94,0.4)');
  const marks = [0.15, 0.4, 0.65, 0.9];
  const mx = x1 + (x2 - x1) * marks[idx];
  ctx.beginPath(); ctx.arc(mx, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#f43f5e'; ctx.fill();
}

function renderTopic5(ctx, w, h, t) {
  const cy = h * 0.55;
  const baseX = w * 0.1, baseX2 = w * 0.46, baseY = cy + 30;
  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(baseX2, baseY); ctx.stroke();
  [0, 0.33, 0.66, 1].forEach((f) => {
    const x = baseX + (baseX2 - baseX) * f;
    iconText(ctx, '⛰️', x, baseY - 14, 20);
  });
  drawBadge(ctx, 'Campo: baseline com pilares', (baseX + baseX2) / 2, baseY + 28, '#5eead4', 'rgba(20,184,166,0.3)');

  const lx0 = w * 0.56, lx1 = w * 0.92, ly = cy;
  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(lx0 - 10, ly - 30, (lx1 - lx0) + 20, 60);
  const amp = 12, freq = 0.15;
  ctx.beginPath();
  for (let x = lx0; x <= lx1; x += 3) {
    const yy = ly + Math.sin((x - lx0) * freq + t * 3) * amp;
    if (x === lx0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawBadge(ctx, 'Laboratório: osciloscópio', (lx0 + lx1) / 2, ly + 46, '#14b8a6', 'rgba(20,184,166,0.35)');
}

function renderTopic6(ctx, w, h, t) {
  const y = h * 0.55;
  const x1 = w * 0.18, x2 = w * 0.82;
  ctx.beginPath();
  for (let x = x1; x <= x2; x += 3) {
    const yy = y + Math.sin((x - x1) * 0.06 + t * 2) * 6;
    if (x === x1) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = 'rgba(20,184,166,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  iconText(ctx, '📡', x1, y, 30);
  iconText(ctx, '🪞', x2, y, 28);
  iconText(ctx, '🌡️', w * 0.4, y - 48, 22);
  iconText(ctx, '💧', w * 0.5, y - 48, 22);
  iconText(ctx, '📊', w * 0.6, y - 48, 22);
  const ppm = (5 * Math.sin(t * 1.2)).toFixed(1);
  drawBadge(ctx, `correção ≈ ${ppm} ppm`, (x1 + x2) / 2, y + 42, '#5eead4', 'rgba(20,184,166,0.35)');
}

function renderTopic7(ctx, w, h, t) {
  const y = h * 0.55;
  const x1 = w * 0.18, x2 = w * 0.82;
  ctx.beginPath();
  for (let x = x1; x <= x2; x += 3) {
    const frac = (x - x1) / (x2 - x1);
    const amp = 4 + frac * 14;
    const freq = 0.04 + frac * 0.1;
    const yy = y - 20 + Math.sin((x - x1) * freq + t * 2) * amp;
    if (x === x1) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = 'rgba(168,85,247,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.quadraticCurveTo((x1 + x2) / 2, y + 18, x2, y - 14);
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  iconText(ctx, '📡', x1, y, 28);
  iconText(ctx, '🪞', x2, y - 14, 26);
  drawBadge(ctx, 'gradiente térmico não-uniforme', (x1 + x2) / 2, y + 42, '#a855f7', 'rgba(168,85,247,0.35)');
}

function renderTopic8(ctx, w, h, t) {
  const cx = w / 2, cy = h * 0.55;
  iconText(ctx, '📡', cx, cy, 44);
  const r = 56;
  const phase = Math.floor(t / 1.5) % 3;
  const labels = ['Hz — ângulo horizontal', 'V — ângulo vertical', 'SD — distância inclinada'];
  const colors = ['#14b8a6', '#f59e0b', '#a855f7'];
  labels.forEach((lab, i) => {
    const active = i === phase;
    ctx.beginPath();
    ctx.arc(cx, cy, r + i * 14, -Math.PI / 2, -Math.PI / 2 + (active ? Math.PI * 1.4 : Math.PI * 0.5));
    ctx.strokeStyle = active ? colors[i] : colors[i] + '40';
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();
  });
  drawBadge(ctx, labels[phase], cx, cy + r + 42, colors[phase], colors[phase] + '50');
}

function renderTopic9(ctx, w, h, t) {
  const cx = w / 2, cy = h * 0.55;
  iconText(ctx, '📡', cx, cy, 40);
  const targets = [
    { emoji: '🌙', angle: -140, label: 'LLR / SLR' },
    { emoji: '🖥️', angle: -20, label: 'Laser Scanning' },
    { emoji: '🛰️', angle: 100, label: 'GNSS' },
  ];
  targets.forEach((tg, i) => {
    const rad = tg.angle * Math.PI / 180;
    const distR = 110;
    const tx = cx + Math.cos(rad) * distR, ty = cy + Math.sin(rad) * distR;
    const p = pingPong(t + i * 0.6, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (tx - cx) * Math.min(1, p * 1.3), cy + (ty - cy) * Math.min(1, p * 1.3));
    ctx.strokeStyle = 'rgba(20,184,166,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    iconText(ctx, tg.emoji, tx, ty, 30);
    drawBadge(ctx, tg.label, tx, ty + 26, '#5eead4', 'rgba(20,184,166,0.3)');
  });
}

// ── Topic data (titles, authored summaries, animations) ──
const TOPICS = [
  {
    title: 'O que é um EDM?',
    summary: 'A Medida Eletrônica de Distâncias (EDM) usa a propagação de ondas eletromagnéticas para medir comprimentos, convertendo tempo ou fase em distância. O equipamento — o Medidor Eletrônico de Distâncias, ou distanciômetro — substituiu as antigas trenas, tornando os levantamentos mais rápidos. Historicamente, o Geodímetro (luz visível) veio primeiro, seguido do Telurômetro (micro-ondas); hoje o infravermelho é o mais usado.',
    render: renderTopic0,
    interactive: false,
  },
  {
    title: 'Estrutura Interna',
    summary: 'Todo EDM tem um emissor que gera uma onda portadora modulada e um receptor que compara o sinal refletido com uma cópia do sinal original. O emissor é um diodo com cristal oscilador; o receptor é um sensor fotoelétrico que recebe o sinal de retorno após ele viajar até um refletor externo e voltar.',
    render: renderTopic1,
    interactive: false,
  },
  {
    title: 'Princípios de Medição e a Ambiguidade de Fase',
    summary: 'Existem quatro princípios de medição: Pulso, Interferometria, Efeito Doppler e Diferença de Fase — o mais usado, por ser mais preciso, mas que só fornece a parte fracionária do número de ciclos percorridos. Essa ambiguidade é resolvida usando várias ondas moduladas de comprimentos diferentes (de 10 m a 10 km): cada uma revela um grupo de dígitos da distância total. Experimente reconstruir a distância combinando as leituras abaixo.',
    render: null,
    interactive: true,
  },
  {
    title: 'Sistemas Refletores',
    summary: 'Os refletores externos usam dois princípios: reflexão total, com prismas cúbicos que devolvem o sinal infravermelho quase integralmente e maximizam o alcance; e reflexão difusa, usada em trenas a laser sem prisma, que dispensa alvo mas devolve só uma fração do sinal, exigindo laser e sendo menos precisa.',
    render: renderTopic3,
    interactive: false,
  },
  {
    title: 'Erros Sistemáticos',
    summary: 'Três erros sistemáticos afetam o equipamento: o erro de zero (deslocamento entre o ponto de referência do EDM e o emissor), o fator de escala (variação da frequência da onda portadora) e o erro cíclico (diafonia entre emissor e receptor). Refletores prismáticos ainda têm uma constante de prisma própria, fornecida pelo fabricante.',
    render: renderTopic4,
    interactive: false,
  },
  {
    title: 'Calibração',
    summary: 'A calibração periódica é essencial, pois os erros sistemáticos variam com o envelhecimento do cristal oscilador, a temperatura e o manuseio. Pode ser feita em campo, com pilares de centragem forçada e distâncias conhecidas ajustadas por mínimos quadrados, ou em laboratório, com condições atmosféricas controladas e frequencímetros/osciloscópios.',
    render: renderTopic5,
    interactive: false,
  },
  {
    title: 'Correção Atmosférica',
    summary: 'O sinal do EDM viaja pela atmosfera, cujo índice de refração — e portanto a velocidade de propagação — depende de temperatura, umidade e pressão. A correção, dada pela fórmula da IUGG, é expressa em ppm: não aplicá-la equivale a uma correção de 0 ppm, e não a 0°C. Em média, 1°C de erro na temperatura gera cerca de 1 ppm de desvio.',
    render: renderTopic6,
    interactive: false,
  },
  {
    title: 'A Segunda Correção',
    summary: 'Assumir uma atmosfera constante ao longo do percurso é uma simplificação prática, mas nem sempre suficiente — especialmente em distâncias longas ou com fortes gradientes térmicos, quando o índice de refração varia de forma contínua e desvia também a direção do feixe. Essa "segunda correção" é um dos maiores desafios para medições de alta precisão em ambientes não controlados.',
    render: renderTopic7,
    interactive: false,
  },
  {
    title: 'Integração em Estações Totais',
    summary: 'Historicamente usados em redes de trilateração, os EDM hoje são parte essencial das Estações Totais, integrados a teodolitos digitais para decompor distâncias em componentes horizontais e verticais. Erros de centragem, nivelamento, pontaria e altura de instrumento/alvo tornam-se relevantes, e a calibração periódica (conforme a NBR 13133) garante a confiabilidade do modelo estocástico.',
    render: renderTopic8,
    interactive: false,
  },
  {
    title: 'Conclusão e Legado',
    summary: 'Os EDM são um elemento fundamental da Topografia e Geodésia modernas, sustentados por certificados de calibração e cuidados operacionais. Viabilizaram ganhos de produtividade sem precedentes — de aplicações como LLR e SLR (medição de distância à Lua e a satélites) ao Laser Scanning — e seus princípios ajudaram a inspirar os sistemas modernos de posicionamento por satélite.',
    render: renderTopic9,
    interactive: false,
  },
];

// ── State ──
let currentIndex = 0;
let canvas, ctx;
let startTime = null;
let ambTrueDistance = null;

// ── Navigation ──
function buildNav() {
  const nav = document.getElementById('topicNav');
  nav.innerHTML = '';
  TOPICS.forEach((topic, i) => {
    const item = document.createElement('div');
    item.className = 'topic-nav-item';
    item.innerHTML = `<span class="topic-num">${i + 1}</span><span class="topic-label">${topic.title}</span>` +
      (topic.interactive ? '<span class="badge-interactive">interativo</span>' : '');
    item.addEventListener('click', () => selectTopic(i));
    nav.appendChild(item);
  });
}

function selectTopic(i) {
  currentIndex = i;
  document.querySelectorAll('.topic-nav-item').forEach((el, idx) => el.classList.toggle('active', idx === i));
  updateContentPanel();
}

function updateStepDots() {
  const container = document.getElementById('stepIndicator');
  container.innerHTML = '';
  TOPICS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'step-dot' + (i === currentIndex ? ' active' : '');
    container.appendChild(dot);
  });
}

function updateContentPanel() {
  const topic = TOPICS[currentIndex];
  document.getElementById('topicBreadcrumb').textContent = `Tópico ${currentIndex + 1} de ${TOPICS.length}`;
  document.getElementById('topicTitle').textContent = topic.title;
  document.getElementById('topicSummary').textContent = topic.summary;
  updateStepDots();

  const canvasWrap = document.getElementById('animCanvasWrap');
  const ambBlock = document.getElementById('ambiguityBlock');

  if (topic.interactive) {
    canvasWrap.hidden = true;
    ambBlock.hidden = false;
    newAmbiguityDistance();
  } else {
    canvasWrap.hidden = false;
    ambBlock.hidden = true;
  }

  document.getElementById('btnPrev').disabled = currentIndex === 0;
  document.getElementById('btnNext').disabled = currentIndex === TOPICS.length - 1;
}

// ── Animation loop ──
function resizeAnimCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function animLoop(now) {
  if (startTime === null) startTime = now;
  const t = (now - startTime) / 1000;
  const topic = TOPICS[currentIndex];
  if (topic && !topic.interactive && topic.render) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);
    drawGridBg(ctx, w, h);
    topic.render(ctx, w, h, t);
  }
  requestAnimationFrame(animLoop);
}

// ── Ambiguity-resolution interactive simulator ──
function newAmbiguityDistance() {
  ambTrueDistance = 1000 + Math.random() * 8999.999;
  const r10 = (ambTrueDistance % 10).toFixed(3);
  const r100 = (ambTrueDistance % 100).toFixed(2);
  const r1000 = (ambTrueDistance % 1000).toFixed(1);
  const r10000 = Math.round(ambTrueDistance % 10000);

  document.getElementById('ambR10').textContent = r10.replace('.', ',');
  document.getElementById('ambR100').textContent = r100.replace('.', ',');
  document.getElementById('ambR1000').textContent = r1000.replace('.', ',');
  document.getElementById('ambR10000').textContent = String(r10000);
  document.getElementById('ambInput').value = '';
  const box = document.getElementById('ambResultBox');
  box.style.display = 'none';
  box.classList.remove('success');
}

function checkAmbiguityAnswer() {
  const raw = document.getElementById('ambInput').value.trim().replace(',', '.');
  const guess = parseFloat(raw);
  const box = document.getElementById('ambResultBox');
  const valueEl = document.getElementById('ambResultValue');
  const subEl = document.getElementById('ambResultSub');
  box.style.display = 'block';

  const d = ambTrueDistance;
  const r10 = (d % 10).toFixed(3).replace('.', ',');
  const r100 = (d % 100).toFixed(2).replace('.', ',');
  const r1000 = (d % 1000).toFixed(1).replace('.', ',');
  const r10000 = Math.round(d % 10000);

  if (!isNaN(guess) && Math.abs(guess - d) <= 0.005) {
    box.classList.add('success');
    valueEl.textContent = `✅ ${d.toFixed(3)} m`;
    subEl.textContent = 'Distância reconstruída corretamente!';
  } else {
    box.classList.remove('success');
    valueEl.textContent = `${d.toFixed(3)} m`;
    subEl.innerHTML = `Combinando as leituras: <span class="font-mono">${r10000} / ${r1000} / ${r100} / ${r10}</span> → ${d.toFixed(3)} m`;
  }
}

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('animCanvas');
  ctx = canvas.getContext('2d');

  buildNav();

  document.getElementById('btnPrev').addEventListener('click', () => { if (currentIndex > 0) selectTopic(currentIndex - 1); });
  document.getElementById('btnNext').addEventListener('click', () => { if (currentIndex < TOPICS.length - 1) selectTopic(currentIndex + 1); });
  document.getElementById('btnAmbCheck').addEventListener('click', checkAmbiguityAnswer);
  document.getElementById('btnAmbNew').addEventListener('click', newAmbiguityDistance);
  document.getElementById('ambInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAmbiguityAnswer(); });

  resizeAnimCanvas();
  window.addEventListener('resize', resizeAnimCanvas);

  selectTopic(0);
  requestAnimationFrame(animLoop);
});
