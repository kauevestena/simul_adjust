// distorcao_utm controller: controls, worker orchestration, colouring, stats.
import * as M from './model.mjs';
import { createGeoidLoader } from './geoid.mjs';
import { makeScale, unitFor, CLASS_COLORS } from './colors.mjs';
import { SplitViewer } from './viewer.mjs';
import { DistortionChart, drawColorbar } from './chart.mjs';
import { t, bootLanguage, onLanguage, getLanguage } from './i18n.mjs';
import { SCENARIOS, scenarioById, DEFAULT_SCENARIO } from './scenarios.mjs';
import { assessSystematic } from './systematic.mjs';

const $ = id => document.getElementById(id);
const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || matchMedia('(pointer: coarse)').matches;
const maxPoints = lowEnd ? M.MAX_POINTS_LOW : M.MAX_POINTS;
const DISPLAY_LIMITS = { exaggeration: [1, 10000], pointSize: [1, 8] };

let params = M.normalizeParams({});
const display = { metric: 'ppm', range: 'data', exaggeration: 100, pointSize: 2, outline: true, tolerance: 0.02 };
const geoid = createGeoidLoader();
const state = { job: 0, busy: false, result: null, scale: null, unit: null, geoidStatus: 'idle', geoidError: '', workerUsed: false, error: '', lastSpan: null, scenario: DEFAULT_SCENARIO, baseScenario: DEFAULT_SCENARIO, assessment: null };

// ---------------------------------------------------------------- formatting (locale aware)
function format(v, digits = 2, fixed) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const d = fixed ?? (a >= 100 ? 0 : a >= 10 ? Math.min(1, digits) : digits);
  const text = new Intl.NumberFormat(getLanguage(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  return /^-0([.,]0+)?$/.test(text) ? text.slice(1) : text.replace('-', '−');
}
const compact = n => new Intl.NumberFormat(getLanguage(), { notation: 'compact', maximumFractionDigits: 2 }).format(n);
const integer = n => new Intl.NumberFormat(getLanguage()).format(Math.round(n));
const sig = v => Number(v.toPrecision(3));

// ---------------------------------------------------------------- controls
const limitsOf = key => M.LIMITS[key] || DISPLAY_LIMITS[key];
const valueOf = key => (key in display ? display[key] : params[key]);
function sliderToValue(field, s) {
  const [lo, hi] = limitsOf(field.dataset.key);
  return field.dataset.log ? sig(lo * (hi / lo) ** (s / 1000)) : s;
}
function valueToSlider(field, v) {
  const [lo, hi] = limitsOf(field.dataset.key);
  return field.dataset.log ? Math.round(1000 * Math.log(v / lo) / Math.log(hi / lo)) : v;
}
function showValue(field) {
  const key = field.dataset.key, v = valueOf(key);
  field.querySelector('input[type=range]').value = String(valueToSlider(field, v));
  field.querySelector('input[type=number]').value = String(v);
}
function setValue(key, raw) {
  const [lo, hi] = limitsOf(key);
  let v = Math.min(hi, Math.max(lo, Number(raw)));
  if (!Number.isFinite(v)) return;
  if (key === 'grid') v = Math.round(v);
  if (key in display) {
    display[key] = v;
    if (key === 'exaggeration') { viewer.setExaggeration(v); renderCaptions(); }
    if (key === 'pointSize') viewer.setPointSize(v);
    return;
  }
  params = { ...params, [key]: v };
  // keep min <= max on the size pair by moving the other bound
  if (key === 'sizeMin' && params.sizeMax < v) params.sizeMax = v;
  if (key === 'sizeMax' && params.sizeMin > v) params.sizeMin = v;
  params = M.normalizeParams(params);
  document.querySelectorAll('.field[data-key]').forEach(showValue);
  markCustom();
  updateEstimate();
  schedule();
}
function bindFields() {
  document.querySelectorAll('.field[data-key]').forEach(field => {
    const key = field.dataset.key, range = field.querySelector('input[type=range]'), num = field.querySelector('input[type=number]');
    range.setAttribute('aria-label', field.querySelector('label').textContent);
    range.addEventListener('input', () => {
      const v = sliderToValue(field, Number(range.value));
      num.value = String(v);
      setValue(key, v);
    });
    num.addEventListener('change', () => { setValue(key, num.value); showValue(field); });
    showValue(field);
  });
  $('reseed').addEventListener('click', () => { params = { ...params, seed: 1 + Math.floor(Math.random() * 2 ** 31) }; markCustom(); schedule(0); });
  $('zone').addEventListener('change', e => { params = { ...params, zone: e.target.value }; markCustom(); schedule(0); });
  $('geoid').addEventListener('change', e => {
    params = { ...params, geoid: e.target.checked };
    syncMetricOptions();
    markCustom();
    schedule(0);
  });
  $('scenario').addEventListener('change', e => { if (e.target.value !== 'custom') applyScenario(e.target.value); });
  $('tolerance').addEventListener('change', e => {
    const cm = Math.min(100, Math.max(0.1, Number(e.target.value) || 2));
    display.tolerance = cm / 100;
    e.target.value = String(cm);
    renderSystematic();
  });
  $('metric').addEventListener('change', e => { display.metric = e.target.value; recolor(); });
  $('range').addEventListener('change', e => { display.range = e.target.value; recolor(); });
  $('outline').addEventListener('change', e => { display.outline = e.target.checked; viewer.setOutline(e.target.checked); });
  $('reset-view').addEventListener('click', () => viewer.frame(params.spanWE, params.spanNS));
}

// ---------------------------------------------------------------- scenarios
function scenarioOptions() {
  const sel = $('scenario'), lang = getLanguage() === 'en' ? 1 : 0;
  sel.innerHTML = '';
  for (const group of ['tolerable', 'critical']) {
    const og = document.createElement('optgroup');
    og.label = t(group === 'tolerable' ? 'groupTolerable' : 'groupCritical');
    for (const sc of SCENARIOS.filter(x => x.group === group)) {
      const o = document.createElement('option');
      o.value = sc.id; o.textContent = sc.title[lang];
      og.append(o);
    }
    sel.append(og);
  }
  const custom = document.createElement('option');
  custom.value = 'custom'; custom.textContent = t('custom');
  sel.append(custom);
  sel.value = state.scenario;
}

/** Load a scenario: parameters (others back to defaults), display settings and tolerance. */
function applyScenario(id) {
  const sc = scenarioById(id);
  if (!sc) return;
  state.scenario = state.baseScenario = id;
  params = M.normalizeParams({ ...M.DEFAULTS, ...sc.params });
  Object.assign(display, { metric: 'ppm', range: 'data', exaggeration: 100, ...sc.display, tolerance: sc.tolerance });
  $('zone').value = params.zone;
  $('geoid').checked = params.geoid;
  $('metric').value = display.metric;
  $('range').value = display.range;
  $('tolerance').value = String(+(display.tolerance * 100).toFixed(2));
  $('scenario').value = id;
  syncMetricOptions();
  document.querySelectorAll('.field[data-key]').forEach(showValue);
  viewer.setExaggeration(display.exaggeration);
  state.lastSpan = null; // reframe the views
  const url = new URL(location.href); url.searchParams.set('scenario', id); history.replaceState(null, '', url);
  updateEstimate(); renderScenario(); renderCaptions(); recolor();
  schedule(0);
}

function markCustom() {
  if (state.scenario === 'custom') return;
  state.scenario = 'custom';
  $('scenario').value = 'custom';
  const url = new URL(location.href); url.searchParams.delete('scenario'); history.replaceState(null, '', url);
  renderScenario();
}

function renderScenario() {
  const lang = getLanguage() === 'en' ? 1 : 0;
  const base = scenarioById(state.baseScenario);
  if (state.scenario === 'custom') {
    $('scenario-title').textContent = t('customTitle');
    $('scenario-text').textContent = t('customText', { base: base ? base.title[lang] : '—' });
  } else {
    $('scenario-title').textContent = base.title[lang];
    $('scenario-text').textContent = base.text[lang];
  }
}

const ICON = { negligible: '✓', tolerable: '!', exceeds: '✕' };
const chip = (lvl, label) => `<span class="chip ${lvl}"><span class="ico" aria-hidden="true">${ICON[lvl]}</span>${label}</span>`;
function renderSystematic() {
  const out = state.result;
  if (!out) return;
  const a = assessSystematic(out, display.tolerance);
  state.assessment = a;
  const len = v => { const u = unitFor('d', Math.abs(v)); return `${format(v * u.factor)} ${u.unit}`; };
  $('verdict').innerHTML = chip(a.overall, `${t('verdictLabel')}: ${t(`overall_${a.overall}`)}`);
  const which = { WE: t('edgeWE'), SN: t('edgeSN'), H: t('edgeH') }[a.edge.which];
  const vSub = a.vertical.geoid != null ? t('tileVerticalGeoid', { g: len(a.vertical.geoid) }) : t('tileVerticalSub');
  const tiles = [
    [t('tileScale'), `${format(a.scale.ppm, 1, 1)} ppm`, t('tileScaleSub', { mm: format(a.scale.per100m * 1000, 1, 1) }), null],
    [t('tileEdge'), len(a.edge.value), t('tileEdgeSub', { id: a.edge.id + 1, size: format(a.edge.size, 1, 1), which }), a.edge.level],
    [t('tileHorizontal'), len(a.horizontal.value), t('tileHorizontalSub'), a.horizontal.level],
    [t('tileVertical'), len(a.vertical.value), vSub, a.vertical.level],
  ];
  $('tiles').innerHTML = tiles.map(([label, value, sub, lvl]) =>
    `<div class="tile"><span class="t-label">${label}</span><span class="t-value">${value}</span><span class="t-sub">${sub}</span>${lvl ? chip(lvl, t(`level_${lvl}`)) : ''}</div>`).join('');
}

/** The geoid-only metric exists only with the geoid on. */
function syncMetricOptions() {
  const opt = $('metric').querySelector('option[value="dg"]');
  opt.disabled = !params.geoid;
  if (!params.geoid && display.metric === 'dg') { display.metric = 'dz'; $('metric').value = 'dz'; }
}

function updateEstimate() {
  const layout = M.buildingLayout(params);
  const b = M.applyBudget(params, maxPoints, layout);
  const meter = $('budget-meter');
  meter.value = Math.min(1, b.want.total / maxPoints);
  $('budget-text').textContent = t('estimate', { n: compact(b.counts.total), max: compact(maxPoints) });
  const note = $('budget-note');
  note.hidden = !b.reduced;
  if (b.reduced) note.textContent = `${t('budgetReduced', { t: sig(b.terrainDensity), b: sig(b.buildingDensity) })} ${t('budgetWhy')}`;
  const cap = 0.8 * Math.min(layout.cellWE, layout.cellNS);
  $('size-note').hidden = !layout.capped;
  if (layout.capped) $('size-note').textContent = t('sizeCapped', { c: format(cap, 1) });
}

// ---------------------------------------------------------------- worker orchestration
let worker = null;
function makeWorker() {
  try {
    const w = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => onResult(data);
    w.onerror = e => { e.preventDefault?.(); worker = null; state.workerUsed = 'failed'; run(); };
    return w;
  } catch {
    return null;
  }
}
let timer = 0;
function schedule(delay = 250) {
  clearTimeout(timer);
  timer = setTimeout(run, delay);
}

async function run() {
  const job = ++state.job;
  setBusy(true);
  let patch = null;
  if (params.geoid) {
    state.geoidStatus = 'loading'; renderGeoidStatus();
    try {
      patch = await geoid.patch(M.areaBounds(params));
      state.geoidStatus = 'loaded'; state.geoidError = '';
    } catch (error) {
      state.geoidStatus = 'failed'; state.geoidError = String(error?.message || error);
    }
    renderGeoidStatus();
  } else {
    state.geoidStatus = 'idle'; renderGeoidStatus();
  }
  if (job !== state.job) return;
  const message = { job, params, geoidPatch: patch, maxPoints };
  if (state.inFlight && worker) { worker.terminate(); worker = makeWorker(); } // cancel stale work
  if (!worker && state.workerUsed !== 'failed') worker = makeWorker();
  state.inFlight = true;
  if (worker) {
    state.workerUsed = true;
    worker.postMessage(message);
  } else {
    state.workerUsed = 'failed';
    setTimeout(() => {
      try { onResult({ job, out: M.simulate(params, { geoidPatch: patch, maxPoints }) }); } catch (error) { onResult({ job, error: String(error) }); }
    }, 30);
  }
}

function onResult({ job, out, error }) {
  if (job !== state.job) return;
  state.inFlight = false;
  setBusy(false);
  if (error) { state.error = error; renderError(); return; }
  state.error = ''; renderError();
  state.result = out;
  const n = out.cls.length;
  const leftColors = new Uint8Array(3 * n);
  for (let i = 0; i < n; i++) leftColors.set(CLASS_COLORS[out.cls[i]], 3 * i);
  const spanKey = `${out.params.spanWE}x${out.params.spanNS}`;
  viewer.setData({
    enu: out.enu, disp: out.disp, leftColors, rightColors: new Uint8Array(3 * n), theta: out.context.theta,
    spanWE: out.params.spanWE, spanNS: out.params.spanNS, outlines: outlines(out.buildings), frame: state.lastSpan !== spanKey,
  });
  state.lastSpan = spanKey;
  chart.setData({ grid: out.grid, buildings: out.buildings, context: out.context, params: out.params });
  recolor();
  renderCaptions();
  renderStats();
  renderSystematic();
  state.ready = true;
}

const EDGES = [[0, 1], [2, 3], [0, 2], [1, 3], [4, 5], [6, 7], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
function outlines(buildings) {
  const a = new Float32Array(buildings.length * EDGES.length * 6);
  let k = 0;
  for (const b of buildings) for (const [i, j] of EDGES) { a.set(b.cornersEnu[i], k); a.set(b.cornersEnu[j], k + 3); k += 6; }
  return a;
}

// ---------------------------------------------------------------- colouring
function cloudValue(out, metric) {
  const { ppm, disp } = out;
  switch (metric) {
    case 'ppm': return i => ppm[i];
    case 'dh': return i => Math.hypot(disp[3 * i], disp[3 * i + 1]);
    case 'dz': return i => disp[3 * i + 2];
    case 'dg': return out.dg ? i => out.dg[i] : () => 0;
    default: return i => Math.hypot(disp[3 * i], disp[3 * i + 1], disp[3 * i + 2]);
  }
}
function recolor() {
  const out = state.result;
  $('metric-help').textContent = t(`metricHelp_${display.metric}`);
  $('arrows-note').hidden = display.metric !== 'dh';
  if (!out) return;
  const metric = display.metric, value = cloudValue(out, metric), n = out.cls.length;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = value(i); if (v < lo) lo = v; if (v > hi) hi = v; }
  for (const v of out.grid.fields[metric]) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const scale = makeScale(metric, lo, hi, display.range);
  const unit = unitFor(metric, Math.max(Math.abs(lo), Math.abs(hi)));
  state.scale = scale; state.unit = unit; state.range = [lo, hi];
  const colors = new Uint8Array(3 * n);
  for (let i = 0; i < n; i++) { const c = scale.color(value(i)); colors[3 * i] = c[0]; colors[3 * i + 1] = c[1]; colors[3 * i + 2] = c[2]; }
  viewer.updateRightColors(colors);
  chart.setScale(metric, scale, unit);
  $('chart-metric').textContent = `${t(`metric_${metric}`)} (${unit.unit})`;
  drawColorbar($('bar3d'), scale, { factor: unit.factor, unit: unit.unit, levels: chart.cache?.levels || [], format });
  renderStats();
}

// ---------------------------------------------------------------- rendering of text panels
function setBusy(on) { state.busy = on; $('busy').hidden = !on; }
function renderError() { const el = $('error'); el.hidden = !state.error; el.textContent = state.error ? t('error', { e: state.error }) : ''; }
function renderGeoidStatus() {
  const el = $('geoid-status');
  el.textContent = state.geoidStatus === 'loading' ? t('geoidLoading')
    : state.geoidStatus === 'loaded' ? t('geoidLoaded', { n: geoid.requested.length })
      : state.geoidStatus === 'failed' ? t('geoidFailed', { e: state.geoidError }) : t('geoidIdle');
}
function renderCaptions() {
  const useGeoid = Boolean(state.result?.context.useGeoid);
  $('cap-right').textContent = t('viewRight', { h: useGeoid ? t('hOrt') : t('hEll'), f: integer(display.exaggeration) });
  $('axis-h').textContent = useGeoid ? 'H' : 'h';
}
function renderStats() {
  const out = state.result;
  if (!out) return;
  const c = out.context, s = out.stats;
  const len = v => { const u = unitFor('d', Math.abs(v)); return `${format(v * u.factor)} ${u.unit}`; };
  const rows = [
    ['stZone', `${c.zone}${c.south ? t('south') : t('north')} / ${format(c.cm, 0)}°${params.zone !== 'auto' ? ` (${t(params.zone === 'west' ? 'zoneWest' : 'zoneEast')})` : ''}`],
    ['stCentre', `${format(c.E0, 3, 3)} m, ${format(c.N0utm, 3, 3)} m`],
    ['stK', format(c.k0, 8, 8)],
    ['stEf', format(c.ef, 8, 8)],
    ['stCombined', `${format(c.combined, 8, 8)} (${format(c.ppm0, 1, 1)} ppm)`],
    ['stGamma', M.toDms(c.gamma0)],
    ['stN', Number.isFinite(c.geoidN0) ? `${format(c.geoidN0, 3, 3)} m` : t('geoidOff')],
    ['stPoints', `${integer(out.counts.terrain)} + ${integer(out.counts.buildings)} = ${integer(out.counts.total)}`],
    ['stTime', `${integer(out.timing.total)} ms`],
    ['stRange', state.unit ? `${format(state.range[0] * state.unit.factor)} … ${format(state.range[1] * state.unit.factor)} ${state.unit.unit}` : '—'],
    ['stMaxDisp', `${len(s.dhMax)} / ${len(Math.abs(s.dzMax) > Math.abs(s.dzMin) ? s.dzMax : s.dzMin)}`],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<div><dt>${t(k)}</dt><dd>${v}</dd></div>`).join('');
  // cubes: most and least distorted (mean horizontal edge), plus the largest
  const by = [...out.buildings].sort((a, b) => Math.abs(b.ppmBase) - Math.abs(a.ppmBase));
  const largest = out.buildings.reduce((a, b) => (b.size > a.size ? b : a));
  const picks = [[by[0], t('cubeMost')], [by[by.length - 1], t('cubeLeast')]];
  if (!picks.some(([b]) => b === largest)) picks.push([largest, t('cubeLargest')]);
  const cell = (v, d) => `${format(v, 3, 3)} m<br><small>${d >= 0 ? '+' : ''}${format(d * 1000, 1, 1)} mm</small>`;
  $('cubes').querySelector('tbody').innerHTML = picks.map(([b, tag]) =>
    `<tr><td>#${b.id + 1}${tag ? `<br><small>${tag}</small>` : ''}</td><td>${format(b.size, 3, 3)} m</td><td>${cell(b.utmWE, b.dWE)}</td><td>${cell(b.utmSN, b.dSN)}</td><td>${cell(b.utmH, b.dH)}</td></tr>`).join('');
}

// ---------------------------------------------------------------- boot
const viewer = new SplitViewer($('split'), { onFail: () => { $('webgl-fail').hidden = false; } });
if (!viewer.ok) {
  $('webgl-fail').hidden = false;
  Object.assign(viewer, { setData() {}, updateRightColors() {}, setExaggeration() {}, setPointSize() {}, setOutline() {}, frame() {} });
}
const chart = new DistortionChart($('chart'), { readout: $('readout'), t: k => t(k), format });
bootLanguage();
scenarioOptions();
bindFields();
applyScenario(scenarioById(new URLSearchParams(location.search).get('scenario')) ? new URLSearchParams(location.search).get('scenario') : DEFAULT_SCENARIO);
onLanguage(() => {
  document.querySelectorAll('.field[data-key]').forEach(f => f.querySelector('input[type=range]').setAttribute('aria-label', f.querySelector('label').textContent));
  scenarioOptions(); renderScenario();
  updateEstimate(); renderGeoidStatus(); renderCaptions(); renderError();
  if (state.result) { chart.draw(); chart.renderReadout(); recolor(); renderSystematic(); }
});
renderGeoidStatus();

/** Test hook: a snapshot of the app state (no large arrays). */
export function getState() {
  const out = state.result;
  return {
    ready: Boolean(state.ready), busy: state.busy, job: state.job, lang: getLanguage(), params: { ...params }, display: { ...display },
    maxPoints, workerUsed: state.workerUsed, geoidStatus: state.geoidStatus, geoidTiles: [...geoid.requested],
    counts: out?.counts, budget: out && { reduced: out.budget.reduced, terrainDensity: out.budget.terrainDensity, buildingDensity: out.budget.buildingDensity },
    context: out?.context, stats: out?.stats, timing: out?.timing,
    scale: state.scale && { kind: state.scale.kind, min: state.scale.min, max: state.scale.max }, unit: state.unit,
    exaggerationUniform: viewer.rightMat?.uniforms.uExag.value, drawCount: viewer.drawCount || 0, webgl: viewer.ok,
    camera: viewer.cameraState?.(),
    scenario: state.scenario, baseScenario: state.baseScenario, tolerance: display.tolerance,
    assessment: state.assessment && { overall: state.assessment.overall, edge: state.assessment.edge.level, horizontal: state.assessment.horizontal.level, vertical: state.assessment.vertical.level, ppm: state.assessment.scale.ppm },
  };
}
