// The simulator page. As in ajusta_planos, nothing is adjusted until ▶ Executar ajustamento is
// pressed: changing data or settings only clears the previous result ("Aguardando
// ajustamento…"), the views keep showing the data, and step 1 of the workflow turns amber.
import { t, plain, bootLanguage, onLanguage } from './i18n.mjs';
import {
  FIELDS, renderFields, loadState, saveState, defaultState, datasetFrom, fetchText, useSample, SAMPLES, DEFAULT_SAMPLE,
  fmt, fmtSig, toMm, download, readFile, setPath, theme, onThemeChange, ROLE_KEYS, ARCSEC_PER_RAD
} from './ui.mjs';
import { run } from './core/pipeline.mjs';
import { detectOutliers } from './core/outliers.mjs';
import { PRESETS } from './core/simulate.mjs';
import { referencePoints, referenceCovariance, distanceTable, distancesCsv } from './core/reference.mjs';
import { builtinReference, observationsCsv, referenceCsv, resultsCsv, toCsv } from './core/io.mjs';
import { UNITS } from './core/units.mjs';
import { SheetView } from './views/view2d.mjs';
import { StationView } from './views/view3d.mjs';
import { PlaneView } from './views/planeview.mjs';
import { drawHistogram } from './views/histogram.mjs';

const $ = id => document.getElementById(id);
let state = loadState(), dataset = null, parseErrors = [], result = null, detection = null;
let activeTab = 'view2d', busy = 0, note = null;              // note: [kind, html] from the last action
let view2d, view3d, viewPlane;
const forms = {};
const nextFrame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
const flaggedSet = () => new Set(detection?.flagged || []);

// ---------------------------------------------------------------- state transitions
// Data or settings changed: the result no longer matches them
function invalidate() {
  result = null; detection = null;
  saveState(state);
  renderAll();
}

// Rebuild the dataset from the state (file text or simulation, then the injected gross errors)
function setData() {
  try { ({ dataset, errors: parseErrors } = datasetFrom(state)); }
  catch (err) { dataset = null; parseErrors = []; note = ['error', t('i.importFail', { message: String(err.message || err) })]; }
  invalidate();
}

async function withBusy(text, fn) {
  busy++; note = ['info', text]; renderAll();
  await nextFrame();
  try { return await fn(); } finally { busy--; }
}

async function runAdjustment() {
  if (!dataset || busy) return result;
  await withBusy(t('m.busyRun'), async () => {
    try { result = run(dataset, state.cfg); }
    catch (err) { console.error(err); result = { ok: false, error: { code: 'internal', message: String(err.message || err) }, cfg: state.cfg }; }
    detection = null; note = null;
  });
  saveState(state); renderAll();
  return result;
}

async function runDetection(method = state.cfg.outliers.method) {
  if (!result?.ok || busy) return detection;
  state.cfg.outliers.method = method; $('outlierMethod').value = method;
  await withBusy(t('m.busyDetect'), async () => {
    detection = await detectOutliers(dataset, state.cfg, method, {
      tick: async info => { note = ['info', info.name ? t('m.busyRound', { round: info.round, name: info.name }) : t('m.busyRansac', { it: info.iteration, c: info.consensus })]; renderMessages(); await nextFrame(); }
    });
    const d = detection;
    note = d.detail?.error ? ['warn', t('m.detectFail', { code: d.detail.error })]
      : d.flagged.length ? ['warn', t('m.detectFound', { n: d.flagged.length, method: plain(`o.${method}`), names: d.flagged.join(', ') })]
        : ['ok', t('m.detectNone', { method: plain(`o.${method}`) })];
  });
  saveState(state);
  activeTab = 'points';
  renderAll();
  return detection;
}

function deactivateFlagged() {
  if (!detection?.flagged.length) return;
  const n = detection.flagged.length;
  state.cfg.excluded = { ...state.cfg.excluded, ...Object.fromEntries(detection.flagged.map(name => [name, true])) };
  note = ['info', t('m.deactivated', { n })];
  invalidate();
}

function reactivateAll() {
  state.cfg.excluded = {}; note = null;
  invalidate();
}

function toggleActive(name, active) {
  const ex = { ...state.cfg.excluded };
  if (active) delete ex[name]; else ex[name] = true;
  state.cfg.excluded = ex;
  invalidate();
}

// ---------------------------------------------------------------- data actions
async function loadSample(key) {
  try {
    const text = await fetchText(SAMPLES[key].file);
    useSample(state, key, text);
    refreshForms(); syncImportUi(); note = null;
    setData();
    return true;
  } catch {
    note = ['error', t('i.sampleFail')];
    if (!dataset) { state.source = 'sim'; setData(); }
    renderAll();
    return false;
  }
}

async function onImport(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    state.rawText = await readFile(file); state.rawName = file.name; state.source = 'import'; state.sample = null;
    state.blunders = []; state.cfg.excluded = {}; state.cfg.checkOverride = {};
    note = null; setData();
    if (dataset && !dataset.ts.length) note = ['error', t('i.importEmpty')];
    renderAll();
  } catch (err) { note = ['error', t('i.importFail', { message: String(err.message || err) })]; renderAll(); }
  ev.target.value = '';
}

function generate() {
  state.source = 'sim'; state.sample = null; state.blunders = []; state.cfg.excluded = {}; state.cfg.checkOverride = {};
  note = null; setData();
}

// ---------------------------------------------------------------- forms
function refreshForms() { Object.values(forms).forEach(f => f.refresh()); }
const dataCtx = () => ({ source: state.source, format: state.importOpts.format });

function buildForms() {
  const onCfg = () => invalidate();
  forms.units = renderFields($('unitsForm'), FIELDS.units, () => state.sim, () => setData());
  forms.sim = renderFields($('simForm'), FIELDS.sim, () => state.sim, path => {
    if (path === 'preset') { Object.assign(state.sim, PRESETS[state.sim.preset]); forms.sim.refresh(); }
    saveState(state);                                        // applied by ↻ Gerar observações
  });
  forms.instrument = renderFields($('instrumentForm'), FIELDS.instrument, () => state.sim, () => setData(), dataCtx);
  forms.workflow = renderFields($('workflowForm'), FIELDS.workflow, () => state.cfg, path => { if (path === 'checkPct') state.cfg.checkOverride = {}; refreshForms(); invalidate(); });
  forms.ref = renderFields($('refForm'), FIELDS.reference, () => state.cfg, onCfg);
  forms.model = renderFields($('modelForm'), FIELDS.modelAdv, () => state.cfg, onCfg);
  forms.checkInj = renderFields($('checkInjForm'), FIELDS.checkInj, () => state.cfg, path => { if (path === 'checkSeed') state.cfg.checkOverride = {}; invalidate(); });
  forms.tests = renderFields($('testsForm'), FIELDS.tests, () => state.cfg, onCfg);
  forms.out = renderFields($('outForm'), FIELDS.output, () => state.cfg, onCfg);
}

function syncImportUi() {
  $('importFormat').value = state.importOpts.format; $('angleFormat').value = state.importOpts.angleFormat; $('renumber').checked = state.importOpts.renumber;
  $('angleRow').hidden = state.importOpts.format !== 'raw';
  $('outlierMethod').value = state.cfg.outliers.method;
  forms.instrument?.refresh();
}

// ---------------------------------------------------------------- rendering
function renderAll() {
  renderStatus(); renderSteps(); renderGlobalTest(); renderSummary(); renderMessages(); renderInjInfo();
  renderLegends(); renderParams(); renderReliability(); renderCritHint(); renderOutlierHint();
  renderActiveTab();
}

function renderStatus() {
  const el = $('dataStatus');
  if (!dataset) { el.textContent = t('i.noData'); return; }
  const parts = [state.source === 'import'
    ? t('i.statusFile', { file: state.rawName || '—', n: dataset.ts.length, bad: parseErrors.length })
    : t('i.statusSim', { scenario: plain(`o.${state.sim.preset}`), seed: state.sim.seed, n: dataset.ts.length })];
  const ex = Object.keys(state.cfg.excluded || {}).length;
  if (ex) parts.push(t('i.statusExcluded', { n: ex }));
  if (state.blunders.length) parts.push(t('i.statusBlunders', { n: state.blunders.length }));
  el.innerHTML = parts.join(' · ');
  $('btnClearBlunders').hidden = !state.blunders.length;
}

function renderSteps() {
  const has = !!dataset && dataset.ts.length >= 4, adjusted = !!result?.ok, flagged = (detection?.flagged.length || 0) > 0;
  const steps = {
    step1: has ? (adjusted ? 'done' : 'active') : '',
    step2: adjusted ? (detection ? 'done' : 'active') : '',
    step3: flagged ? 'active' : (detection ? 'done' : ''),
    step4: adjusted ? 'done' : '',
    step5: adjusted ? 'active' : ''
  };
  for (const [id, s] of Object.entries(steps)) { const el = $(id); el.classList.remove('step-done', 'step-active'); if (s) el.classList.add(`step-${s}`); }
  $('btnRun').disabled = !has || busy > 0;
  $('btnRun').classList.toggle('pending', has && !result);
  $('btnOutliers').disabled = !adjusted || busy > 0;
  $('btnDeactivate').disabled = !flagged || busy > 0;
  $('btnReactivate').disabled = (!Object.keys(state.cfg.excluded || {}).length && !detection) || busy > 0;
  $('dlResults').disabled = !adjusted; $('dlParams').disabled = !adjusted;
  $('btnBlunder').disabled = !dataset?.ts.length || busy > 0;
  $('pendingNote').hidden = !(has && !result);
}

const waiting = () => `<p class="waiting">${t('i.waiting')}</p>`;

function renderGlobalTest() {
  const head = `<h2 class="card-title"><span>${t('gt.title')}</span></h2>`, box = $('panelGlobalTest');
  if (!result) { box.innerHTML = head + waiting(); return; }
  if (!result.ok) { box.innerHTML = head + `<p class="waiting">${t('gt.noResult')}</p>`; return; }
  const r = result.res, pass = r.test.pass, a = r.alpha * 50;
  const side = r.Omega > r.test.high ? t('gt.above') : t('gt.below');
  box.innerHTML = head + `
    <div class="gt-box ${pass ? 'ok' : 'bad'}">${pass ? `✓ ${t('gt.pass')}` : `✗ ${t('gt.fail', { side })}`}</div>
    <div class="kv">
      <div><span>${t('gt.omega')}</span><b>${fmt(r.Omega, 3)}</b></div>
      <div><span>${t('gt.low', { p: fmtSig(a, 3) })}</span><span>${fmt(r.test.low, 3)}</span></div>
      <div><span>${t('gt.high', { p: fmtSig(100 - a, 4) })}</span><span>${fmt(r.test.high, 3)}</span></div>
      <div><span>σ̂₀²</span><span>${fmt(r.sigma0sq, 4)}</span></div>
      <div><span>${t('gt.dof')}</span><span>${r.r}</span></div>
      <div><span>${t('gt.m')}</span><span>${result.counts.control}</span></div>
      <div><span>${t('gt.iter')}</span><span>${r.iterations}${r.converged ? '' : ' ⚠'}</span></div>
    </div>
    ${!pass && r.Omega > r.test.high ? `<p class="gt-hint bad">${t('gt.hintHigh')}</p>` : ''}
    ${!pass && r.Omega < r.test.low ? `<p class="gt-hint warn">${t('gt.hintLow')}</p>` : ''}`;
}

function tile(k, v, s = '', cls = '') { return `<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }

function renderSummary() {
  const box = $('summary');
  const ok = !!result?.ok, wait = t('i.waitingShort');
  if (!ok) {
    box.innerHTML = [tile(t('k.lambda'), '—', wait), tile(t('k.sigma0'), '—', wait), tile(t('k.check'), '—', wait), tile(t('k.plane'), '—', wait), tile(t('k.outliers'), '—', wait)].join('');
    return;
  }
  const r = result.res, p = result.params, c = result.checks, mm = v => toMm(v, result.tsUnit);
  const tiles = [
    tile(t('k.lambda'), fmtSig(r.lambda, 7), `${t('k.delta')} ${fmt(p.deltaPpm, 0)} ppm · ${r.estimateScale ? t('k.estimated') : t('k.fixed')}`),
    tile(t('k.sigma0'), fmt(r.sigma0sq, 3), `${t('k.redundancy')} r = ${r.r} · <span class="${r.test.pass ? 'pass' : 'fail'}">${r.test.pass ? t('k.accepted') : t('k.rejected')}</span>`)
  ];
  tiles.push(c.joint
    ? tile(t('k.check'), `${fmt(mm(c.rms.total), 2)} mm`, `<span class="${c.joint.pass ? 'pass' : 'fail'}">${t('k.checkTest')}</span> · χ² ${fmt(c.joint.chi2, 1)}/${c.joint.dof}`)
    : tile(t('k.check'), '—', t('k.noChecks')));
  const pl = result.plane;
  tiles.push(pl?.ok ? tile(t('k.plane'), `${fmt(mm(pl.rms), 2)} mm`, t('k.planeSub', { nom: fmt(mm(pl.nominal), 2), s0: fmt(pl.sigma0sq, 2) })) : tile(t('k.plane'), '—', t('pl.fail')));
  const nf = detection?.flagged.length ?? 0, ne = result.counts.excluded;
  tiles.push(tile(t('k.outliers'), detection ? String(nf) : '—', detection ? t('k.outliersSub', { excluded: ne, method: plain(`o.${detection.method}`) }) : t('k.excludedOnly', { excluded: ne }), nf ? 'alert' : ''));
  box.innerHTML = tiles.join('');
}

function resultMessages() {
  const msgs = [];
  if (!result) return msgs;
  if (!result.ok) {
    const e = result.error;
    msgs.push(['error', t(`m.err.${e.code}`, { n: e.count ?? '', rotation: e.rotation ? plain(`o.${e.rotation}`) : '', message: e.message ?? '' })]);
    if (e.code === 'singular') {
      if (!e.constrained && e.rotation !== 'euler') msgs.push(['info', t('m.hint.constraints')]);
      if (e.rotation === 'euler' || e.rotation === 'axisAngle') msgs.push(['info', t('m.hint.degenerate')]);
    }
    if (e.code === 'fewControl' && result.counts?.excluded) msgs.push(['info', t('m.hint.reactivate')]);
    return msgs;
  }
  for (const f of result.res.flags) msgs.push([f.code === 'constraintsOff' ? 'info' : 'warn', t(`m.flag.${f.code}`, { value: fmtSig(f.value, 3), n: f.iterations ?? '' })]);
  const inj = result.cfg.injunctions;
  if (inj.set !== 'none') {
    if (result.res.parametricAbsolute) msgs.push(['info', t(result.cfg.scaleMode === 'rigid' ? 'm.info.paramAbsRigid' : 'm.info.paramAbsScale')]);
    else if (result.cfg.method === 'parametrico' && result.cfg.scaleMode === 'rigid') msgs.push(['info', t('m.info.paramRelRigid')]);
    if (inj.type === 'absolute' && dataset.meta?.config && (dataset.truth.printScalePpm.some(v => v !== 0))) msgs.push(['warn', t('m.warn.absScale')]);
  }
  if (result.cfg.method === 'parametrico' && result.res.test.pass === false) msgs.push(['info', t('m.info.paramFails')]);
  const inc = result.plane?.ok ? result.plane.incidenceDeg : 0;
  if (inc > 70) msgs.push(['warn', t('m.warn.incidence', { value: fmt(inc, 0) })]);
  if (!result.plane?.ok && result.plane?.error) msgs.push(['warn', t(`m.err.${result.plane.error.code}`, { n: result.plane.error.count ?? '' })]);
  return msgs;
}

function renderMessages() {
  const msgs = [...(note ? [note] : []), ...resultMessages()];
  $('messages').innerHTML = msgs.map(([k, m]) => `<div class="msg ${k}">${m}</div>`).join('');
}

function renderInjInfo() {
  const el = $('injInfo');
  if (!result?.ok || !result.injInfo) { el.textContent = ''; return; }
  const i = result.injInfo;
  el.textContent = i.set === 'none' ? '' : plain('i.counts', { pairs: i.pairs, ind: i.independent, used: i.used });
}

function renderCritHint() {
  const o = state.cfg.outliers;
  $('critHint').innerHTML = result?.ok
    ? t('h.crit', { w: fmt(result.tests.crit.w, 2), tau: fmt(result.tests.crit.tau, 2), d0: fmt(result.tests.crit.delta0, 2), T: fmt(result.tests.crit.T, 2), a0: fmtSig(o.alpha0 * 100, 3) })
    : t('h.critWaiting');
}

function renderOutlierHint() { $('outlierHint').innerHTML = t(`h.o.${state.cfg.outliers.method}`); }

function renderLegends() {
  const roles = ROLE_KEYS.map(r => `<span><i class="sw ${r}"></i>${t(`role.${r}`)}</span>`).join('') + `<span><i class="sw flag"></i>${t('v.legendFlag')}</span>`;
  $('legend2d').innerHTML = roles;
  $('legend3d').innerHTML = `<span><i class="sw pos"></i>${t('v.legendPos')}</span><span><i class="sw neg"></i>${t('v.legendNeg')}</span><span><i class="sw plane"></i>${t('v.plane')}</span><span><i class="sw flag"></i>${t('v.legendFlag')}</span>`;
  $('legendPlane').innerHTML = `<span><i class="sw neg"></i>${t('v.legendNeg')}</span><span><i class="sw pos"></i>${t('v.legendPos')}</span><span><i class="sw flag"></i>${t('v.legendCrit')}</span>`;
}

function renderActiveTab() {
  document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.id !== `tab-${activeTab}`; });
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === activeTab)));
  if (!dataset) return;
  const extra = { flagged: flaggedSet(), excluded: state.cfg.excluded || {} };
  if (activeTab === 'view2d') { view2d.setData(dataset, result, labels2d(), extra); $('vecScaleOut').textContent = `×${view2d.currentK}`; }
  else if (activeTab === 'view3d') view3d.setData(dataset, result, extra);
  else if (activeTab === 'plane') { viewPlane.setData(result, { empty: result ? t('pl.fail') : t('i.waiting'), view: t('v.seenFrom'), excluded: t('role.excluded'), flagged: t('v.legendFlag') }, extra); renderPlaneInfo(); }
  else if (activeTab === 'hist') renderHistogram();
  else if (activeTab === 'points') renderPoints();
  else if (activeTab === 'results') renderResults();
}

const labels2d = () => ({
  scale: t('v.scaleBar', { mm: '{mm}', k: '{k}' }), role: { ...Object.fromEntries(ROLE_KEYS.map(r => [r, t(`role.${r}`)])), collected: t('role.collected') },
  inPlane: t('v.inPlane'), normal: t('v.normal'), clickHint: t('v.clickHint'), waiting: t('v.waiting2d'), flagged: t('v.legendFlag')
});

function renderPlaneInfo() {
  const el = $('planeInfo'), pl = result?.plane;
  if (!pl?.ok) { el.textContent = ''; return; }
  const mm = v => fmt(toMm(v, result.tsUnit), 2);
  el.innerHTML = t('pl.info', {
    m: pl.m, rms: mm(pl.rms), nom: mm(pl.nominal), s0: fmt(pl.sigma0sq, 3), test: `<span class="${pl.test.pass ? 'pass' : 'fail'}">${pl.test.pass ? t('k.accepted') : t('k.rejected')}</span>`,
    inc: fmt(pl.incidenceDeg, 1), ang: Number.isFinite(pl.normalAngleDeg) ? fmt(pl.normalAngleDeg, 3) : '—',
    n: pl.points.filter(q => Math.abs(q.w) > pl.crit.w).length, crit: fmt(pl.crit.w, 2)
  });
}

// observation value conversions: angles to arc seconds, lengths to millimetres
const obsConv = o => (o.unit === 'rad' ? { f: ARCSEC_PER_RAD, u: '″', d: 1 } : { f: o.unit === 'm' ? 1000 : UNITS[o.unit] * 1000, u: 'mm', d: 2 });

function renderHistogram() {
  const canvas = $('canvasHist'), th = theme(), q = $('histQuantity').value, bins = Number($('bins').value), crit = $('histCrit').checked;
  const empty = () => { drawHistogram(canvas, [], { labels: { empty: result ? t('v.noData') : t('i.waiting') } }); $('histStats').textContent = ''; };
  $('helpHist').textContent = plain(`v.helpHist.${q}`);
  if (!result?.ok) return empty();
  const stats = values => { const v = values.filter(Number.isFinite), n = v.length, mean = v.reduce((a, b) => a + b, 0) / Math.max(n, 1); return { n, mean, sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)) }; };
  let series, opts, info;
  if (q === 'std') {
    const r = result.res, m = r.m, ts = r.standardized.slice(0, 3 * m), ref = r.comb ? r.standardized.slice(3 * m, 6 * m) : [];
    series = [{ values: ts, color: th.control }, { values: ref, color: th.uncollected }];
    opts = { sd: 1, labels: { x: plain('v.stdRes'), y: plain('v.count') } };
    const s = stats([...ts, ...ref]);
    info = t('v.histStats', { n: s.n, mean: fmt(s.mean, 2), sd: fmt(s.sd, 2), ts: ts.filter(Number.isFinite).length, ref: ref.filter(Number.isFinite).length });
    $('legendHist').innerHTML = `<span><i class="sw ts"></i>${t('v.seriesTs')}</span><span><i class="sw ref"></i>${t('v.seriesRef')}</span><span>— N(0, 1)</span>`;
  } else if (q === 'w') {
    const c = result.tests.crit.w, all = result.points.filter(p => p.role === 'control').flatMap(p => p.obs.map(o => o.w)).filter(Number.isFinite);
    series = [{ values: all.filter(w => Math.abs(w) <= c), color: th.control }, { values: all.filter(w => Math.abs(w) > c), color: th.flag }];
    opts = { sd: 1, crit: crit ? c : null, labels: { x: plain('v.wRes'), y: plain('v.count') } };
    const s = stats(all);
    info = t('v.histW', { n: s.n, mean: fmt(s.mean, 2), sd: fmt(s.sd, 2), hot: all.filter(w => Math.abs(w) > c).length, crit: fmt(c, 2) });
    $('legendHist').innerHTML = `<span><i class="sw ts"></i>|w| ≤ ${fmt(c, 2)}</span><span><i class="sw flag" style="background:var(--c-flag)"></i>|w| > ${fmt(c, 2)}</span><span>— N(0, 1)</span>`;
  } else {
    const pl = result.plane;
    if (!pl?.ok) return empty();
    const c = pl.crit.w;
    if (q === 'planeW') {
      const all = pl.points.map(p => p.w).filter(Number.isFinite);
      series = [{ values: all.filter(w => Math.abs(w) <= c), color: th.plane }, { values: all.filter(w => Math.abs(w) > c), color: th.flag }];
      opts = { sd: 1, crit: crit ? c : null, labels: { x: plain('v.planeW'), y: plain('v.count') } };
      const s = stats(all);
      info = t('v.histW', { n: s.n, mean: fmt(s.mean, 2), sd: fmt(s.sd, 2), hot: all.filter(w => Math.abs(w) > c).length, crit: fmt(c, 2) });
      $('legendHist').innerHTML = `<span><i class="sw plane"></i>|w| ≤ ${fmt(c, 2)}</span><span><i class="sw flag" style="background:var(--c-flag)"></i>|w| > ${fmt(c, 2)}</span><span>— N(0, 1)</span>`;
    } else {
      const mm = v => toMm(v, result.tsUnit), all = pl.points.map(p => mm(p.d)), nom = mm(pl.nominal);
      series = [{ values: all.filter(v => v < 0), color: th.neg }, { values: all.filter(v => v >= 0), color: th.pos }];
      opts = { sd: nom, minLim: 2.5, labels: { x: plain('v.planeD'), y: plain('v.count') } };
      const s = stats(all);
      info = t('v.histD', { n: s.n, mean: fmt(s.mean, 2), sd: fmt(s.sd, 2), nom: fmt(nom, 2) });
      $('legendHist').innerHTML = `<span><i class="sw neg"></i>${t('v.legendNeg')}</span><span><i class="sw pos"></i>${t('v.legendPos')}</span><span>— N(0, σ²<sub>nominal</sub>)</span>`;
    }
  }
  drawHistogram(canvas, series, { bins, ...opts, labels: { ...opts.labels, empty: t('v.noData') } });
  $('histStats').innerHTML = info;
}

// ---------------------------------------------------------------- tables
const nc = v => `<span class="nc">${v}</span>`;
const tbl = (head, rows, cls = '') => `<div class="table-container ${cls}"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function paramRows() {
  const r = result.res, P = r.layout.P, o = result.cfg.outUnit, f = result.outFactor, rows = [];
  result.params.sigma.forEach((s, i) => {
    if (i < 3) rows.push([s.label, `${fmt(s.value * f, 5)} ${o}`, `± ${fmt(toMm(s.sd, result.tsUnit), 3)} mm`]);
    else if (i < 3 + r.layout.s) {
      const kind = P.kinds[i - 3];
      rows.push(kind === 'angle' ? [s.label, `${fmt(s.value * 180 / Math.PI, 6)}°`, `± ${fmt(s.sd * ARCSEC_PER_RAD, 1)}″`] : [s.label, fmt(s.value, 8), `± ${fmtSig(s.sd, 3)}`]);
    } else rows.push([s.label, fmt(s.value, 9), `± ${fmt(s.sd / result.lambda0 * 1e6, 1)} ppm`]);
  });
  return rows;
}

function renderParams() {
  const box = $('paramsPanel');
  if (!result?.ok) { box.innerHTML = result ? `<p class="waiting">${t('gt.noResult')}</p>` : waiting(); return; }
  const p = result.params, D = 180 / Math.PI, forms = p.forms;
  const rot = [
    [t('o.euler'), `ω ${fmt(forms.euler[0] * D, 5)}°, φ ${fmt(forms.euler[1] * D, 5)}°, κ ${fmt(forms.euler[2] * D, 5)}°`],
    [t('o.quaternion'), `(${forms.quaternion.map(v => fmt(v, 7)).join(', ')})`],
    [t('o.axisAngle'), `n = (${forms.axisAngle.slice(0, 3).map(v => fmt(v, 6)).join(', ')}), θ = ${fmt(forms.axisAngle[3] * D, 5)}°`],
    [t('o.matrix'), p.R.map(row => row.map(v => fmt(v, 7)).join('  ')).join('<br>')]
  ];
  const r = result.res, labs = r.layout.labels;
  const corr = r.SigmaXapriori.map((row, i) => row.map((v, j) => v / Math.sqrt(Math.max(r.SigmaXapriori[i][i] * r.SigmaXapriori[j][j], 1e-300))));
  box.innerHTML = `
    <div class="grid2">
      <div><h3>${t('r.params')}</h3>${tbl([t('r.param'), t('r.value'), nc('σ')], paramRows())}</div>
      <div><h3>${t('r.rotation')}</h3>${tbl([t('r.form'), t('r.value')], rot, 'wrap')}</div>
    </div>
    <details class="sub" style="margin-top:12px"><summary>${t('r.corr')}</summary>${tbl([''].concat(labs.map(nc)), corr.map((row, i) => [nc(labs[i]), ...row.map(v => fmt(v, 3))]))}</details>`;
}

function renderReliability() {
  const box = $('reliabilityPanel');
  if (!result?.ok) { box.innerHTML = result ? `<p class="waiting">${t('gt.noResult')}</p>` : waiting(); return; }
  const c = result.tests.crit, flagged = flaggedSet();
  const cells = (o, conv) => [o.key, `${fmt(o.v * conv.f, conv.d)} ${conv.u}`, hot(o.w, c.w, 2), hot(o.tau, c.tau, 2), fmt(o.r, 3), `${fmt(o.mdb * conv.f, conv.d)} ${conv.u}`];
  const rows = result.points.filter(p => p.role === 'control').flatMap(p => p.obs.map(o => ({ p, o })))
    .filter(x => Number.isFinite(x.o.w)).sort((a, b) => Math.abs(b.o.w) - Math.abs(a.o.w)).slice(0, 8)
    .map(({ p, o }) => [p.name + (flagged.has(p.name) ? ' <span class="badge badge-out">OUTLIER</span>' : ''), ...cells(o, obsConv(o))]);
  let html = `<p class="note">${t('rel.crit', { w: fmt(c.w, 2), a0: fmtSig(c.alpha0 * 100, 3), tau: fmt(c.tau, 2), r: c.r, d0: fmt(c.delta0, 2), p: fmtSig(c.power * 100, 3), T: fmt(c.T, 2) })}</p>`;
  html += `<h3 class="subhead" style="margin-top:12px">${t('rel.worst')}</h3>` + tbl([t('p.name'), t('rel.obs'), ...['v', 'w', 'τ', 'r', '∇₀'].map(nc)], rows);
  if (detection) {
    const d = detection, m = plain(`o.${d.method}`);
    const detail = d.method === 'ransac' && !d.detail.error ? t('rel.ransac', { c: d.detail.consensus, n: d.detail.total, k: d.detail.ransacK ?? d.detail.k, it: d.detail.iterations, out: d.detail.outside.length, crit: fmt(d.detail.crit, 2) })
      : d.method === 'snooping' ? t('rel.snoop', { rounds: d.detail.rounds, crit: fmt(d.detail.crit, 2) })
        : d.method === 'tau' ? t('rel.tau', { crit: fmt(d.detail.crit, 2), s0: fmt(d.detail.sigma0sq, 2) })
          : d.method === 'ksigma' ? t('rel.ksigma', { k: d.detail.k }) : '';
    html += `<h3 class="subhead" style="margin-top:14px">${t('rel.detection', { method: m })}</h3><p class="note">${detail}</p>`;
    if (d.comps.length) html += tbl([t('p.name'), t('rel.obs'), t('rel.value'), t('rel.critical')], d.comps.slice(0, 40).map(x => [x.name, x.obs, `<span class="hot">${fmt(x.value, 2)}</span>`, fmt(x.crit, 2)]));
    if (d.history?.length) html += `<details class="sub" style="margin-top:8px" open><summary>${t('rel.history')}</summary>${tbl(['#', t('rel.removed'), nc('w'), nc('σ̂₀²'), nc('r')], d.history.map(h => [h.round, h.name ? `${h.name} (${h.obs})${h.essential ? ' ⚠' : ''}` : t(`rel.stop.${h.stop}`), Number.isFinite(h.w) ? fmt(h.w, 2) : '—', fmt(h.sigma0sq, 3), h.r]))}</details>`;
  }
  box.innerHTML = html;
}

const hot = (v, crit, d = 2) => (Number.isFinite(v) ? (Math.abs(v) > crit ? `<span class="hot">${fmt(v, d)}</span>` : fmt(v, d)) : '—');

function renderPoints() {
  const tb = $('pointsTable');
  if (!dataset) { tb.innerHTML = ''; return; }
  const flagged = flaggedSet(), ex = state.cfg.excluded || {}, u = dataset.tsUnit;
  const mm = v => (Number.isFinite(v) ? fmt(toMm(v, u), 2) : '—');
  const activeBox = (name, on) => `<input type="checkbox" data-active="${name}" ${on ? 'checked' : ''} aria-label="${plain('p.active')}">`;
  const badge = (role, name) => (ex[name] ? `<span class="badge badge-off">${t('b.inactive')}</span>` : flagged.has(name) ? '<span class="badge badge-out">OUTLIER</span>'
    : role === 'check' ? `<span class="badge badge-chk">${t('role.check')}</span>` : role === 'tsOnly' ? `<span class="badge badge-ts">${t('role.tsOnly')}</span>`
      : role === 'uncollected' ? `<span class="badge badge-off">${t('role.uncollected')}</span>` : '<span class="badge badge-ok">OK</span>');
  if (!result?.ok) {
    // before an adjustment: the observations themselves
    const head = [t('p.active'), t('p.name'), ...['Hz (°)', 'Z (°)', 'S (m)', 'σ Hz / Z (″)', 'σ S (mm)'].map(nc), t('p.state')];
    const rows = dataset.ts.map(q => {
      const pl = q.polar, cls = ex[q.name] ? 'row-inactive' : '';
      const cells = pl ? [fmt(pl.hzDeg, 5), fmt(pl.zenDeg, 5), fmt(pl.dist, 4), `${fmt(pl.sigmas[0] * ARCSEC_PER_RAD, 1)} / ${fmt(pl.sigmas[1] * ARCSEC_PER_RAD, 1)}`, fmt(pl.sigmas[2] * 1000, 2)] : ['—', '—', '—', '—', '—'];
      const bl = q.blunder ? ` <span class="hot" title="${plain('p.blunder')}">⚠</span>` : '';
      return `<tr class="${cls}"><td>${activeBox(q.name, !ex[q.name])}</td><td>${q.name}${bl}</td>${cells.map(c => `<td class="num">${c}</td>`).join('')}<td>${ex[q.name] ? `<span class="badge badge-off">${t('b.inactive')}</span>` : '—'}</td></tr>`;
    });
    tb.innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
    return;
  }
  const c = result.tests.crit, pl = result.plane, planeBy = new Map(pl?.ok ? [...pl.points, ...(pl.others || [])].map(q => [q.name, q]) : []);
  const tip = k => `class="nc" data-tooltip="${plain(`tt.${k}`)}"`;
  const head = [t('p.active'), t('p.name'), t('p.state'), `<span ${tip('d')}>Δx, Δy, Δz (mm)</span>`, `<span ${tip('normal')}>${t('v.normal')}</span>`, `<span ${tip('inPlane')}>${t('v.inPlane')}</span>`,
    `<span ${tip('v')}>v (Hz, Z, S)</span>`, `<span ${tip('w')}>w</span>`, `<span ${tip('r')}>r</span>`, `<span ${tip('mdb')}>∇₀</span>`, `<span ${tip('T')}>T, χ²</span>`, `<span ${tip('planeD')}>d ${t('p.plane')} (mm)</span>`, `<span ${tip('planeW')}>w ${t('p.plane')}</span>`];
  const order = { control: 0, check: 1, excluded: 2, tsOnly: 3, uncollected: 4 };
  const rows = [...result.points].sort((a, b) => order[a.role] - order[b.role]).map(p => {
    const d = p.vT || p.d, inactive = !!ex[p.name], isTs = p.role !== 'uncollected';
    const trio = (key, fn) => (p.obs ? p.obs.map(o => fn(o, obsConv(o))).join(' / ') : '—');
    const v = trio('v', (o, k) => fmt(o.v * k.f, k.d)), w = trio('w', o => hot(o.w, c.w)), r = trio('r', o => fmt(o.r, 2)), mdb = trio('mdb', (o, k) => fmt(o.mdb * k.f, 1));
    const stat = p.chi2 ?? p.T, statCrit = p.role === 'control' ? c.T : null;
    const q = planeBy.get(p.name);
    const normal = p.normal !== undefined ? mm(p.normal) : p.role === 'tsOnly' ? `z<sub>S</sub> ${fmt(toMm(p.sheet[2], result.refUnit), 2)}` : '';
    const cls = [inactive ? 'row-inactive' : '', flagged.has(p.name) ? 'row-outlier' : ''].join(' ');
    const bl = p.blunder ? ` <span class="hot" title="${plain('p.blunder')}">⚠</span>` : '';
    return `<tr class="${cls}"><td>${isTs ? activeBox(p.name, !inactive) : ''}</td><td>${p.name}${bl}</td><td>${badge(p.role, p.name)}</td>
      <td class="trio">${d ? d.map(mm).join(', ') : '—'}</td><td class="num">${normal}</td><td class="num">${p.inPlane !== undefined ? mm(p.inPlane) : ''}</td>
      <td class="trio">${v}</td><td class="trio">${w}</td><td class="trio">${r}</td><td class="trio">${mdb}</td>
      <td class="num">${Number.isFinite(stat) ? (statCrit ? hot(stat, statCrit, 1) : fmt(stat, 1)) : '—'}</td>
      <td class="num">${q ? mm(q.d) : '—'}</td><td class="num">${q && Number.isFinite(q.w) ? hot(q.w, pl.crit.w) : '—'}</td></tr>`;
  });
  tb.innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
}

function renderResults() {
  const box = $('resultsBox');
  if (!result?.ok) { box.innerHTML = result ? `<p class="waiting">${t('gt.noResult')}</p>` : waiting(); return; }
  const r = result.res, p = result.params;
  const stats = [
    [t('r.sigma0'), fmt(r.sigma0sq, 4)], [t('r.omega'), fmt(r.Omega, 3)], [t('r.redundancy'), `${r.r} = ${r.nEq} − ${r.nUnknown} + ${r.nConstraints}`],
    [t('r.chi2'), `[${fmt(r.test.low, 2)}, ${fmt(r.test.high, 2)}] (α = ${r.alpha})`], [t('r.iterations'), `${r.iterations}${r.converged ? '' : ' ⚠'}`],
    [t('r.cond'), Number.isFinite(r.cond) ? r.cond.toExponential(2) : '—'], [t('r.eps'), p.epsSd.map(v => `${fmt(v * ARCSEC_PER_RAD, 1)}″`).join(', ')],
    [t('r.counts'), t('r.countsTxt', result.counts)]
  ];
  const pl = result.plane;
  const mm = v => fmt(toMm(v, result.tsUnit), 3);
  const plane = pl?.ok ? [
    ['n = (n<sub>x</sub>, n<sub>y</sub>, n<sub>z</sub>)', pl.n.map(v => fmt(v, 7)).join(', ')], ['d', `${fmt(pl.d * result.outFactor, 5)} ${result.cfg.outUnit}`],
    [t('r.planeSd'), `σ<sub>d</sub> = ${mm(Math.sqrt(Math.max(pl.SigmaXapriori[3][3] * (result.cfg.varianceFactor === 'aposteriori' ? pl.sigma0sq : 1), 0)))} mm`],
    ['σ̂₀² · r', `${fmt(pl.sigma0sq, 4)} · ${pl.r}`], [t('r.chi2'), `[${fmt(pl.test.low, 2)}, ${fmt(pl.test.high, 2)}] → <span class="${pl.test.pass ? 'pass' : 'fail'}">${pl.test.pass ? t('k.accepted') : t('k.rejected')}</span>`],
    [t('r.planeRms'), `${mm(pl.rms)} mm · ${t('r.planeNominal')} ${mm(pl.nominal)} mm`], [t('r.iterations'), `${pl.iterations}${pl.converged ? '' : ' ⚠'}`]
  ] : [[t('pl.fail'), '']];
  box.innerHTML = `
    <div class="grid2">
      <div><h3>${t('r.stats')}</h3>${tbl([t('r.quantity'), t('r.value')], stats)}</div>
      <div><h3>${t('r.planeTitle')}</h3>${tbl([t('r.quantity'), t('r.value')], plane)}</div>
      <div><h3>${t('r.history')}</h3>${tbl(['#', t('r.step'), 'Ω'], r.history.map(h => [h.iter, h.step.toExponential(2), fmt(h.Omega, 4)]))}</div>
    </div>`;
}

// ---------------------------------------------------------------- blunder dialog
function openBlunder() {
  if (!dataset) return;
  const list = $('blunderList'), names = dataset.ts.map(q => q.name), have = new Set(state.blunders.map(b => b.name));
  const pick = names.filter(n => !have.has(n));
  const pre = pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
  list.innerHTML = names.map(n => `<label><input type="checkbox" value="${n}" ${n === pre ? 'checked' : ''}>${n}${have.has(n) ? ' ⚠' : ''}</label>`).join('');
  $('blunderObs').disabled = !dataset.ts.some(q => q.polar);
  if ($('blunderObs').disabled) $('blunderObs').value = 'S';
  $('blunderKOut').textContent = `${$('blunderK').value} σ`;
  $('dlgBlunder').showModal();
}

function injectBlunder() {
  const sel = [...$('blunderList').querySelectorAll('input:checked')].map(i => i.value);
  if (!sel.length) return;
  const k = Number($('blunderK').value) * (Math.random() < 0.5 ? -1 : 1), obs = $('blunderObs').value;
  state.blunders = [...state.blunders.filter(b => !sel.includes(b.name)), ...sel.map(name => ({ name, obs, k }))];
  $('dlgBlunder').close();
  setData();
  const sizes = dataset.ts.filter(q => sel.includes(q.name) && q.blunder).map(q => `${q.name}: ${q.blunder.obs} ${q.blunder.size >= 0 ? '+' : ''}${q.blunder.obs === 'S' ? `${fmt(q.blunder.size * 1000, 2)} mm` : `${fmt(q.blunder.size * ARCSEC_PER_RAD, 1)}″`}`);
  note = ['warn', t('m.blunders', { n: sel.length, k: Math.abs(k), list: sizes.join(', ') })];
  renderAll();
}

// ---------------------------------------------------------------- downloads
function paramsCsv() {
  const r = result.res, labs = r.layout.labels, s2 = result.s2;
  const lines = result.params.sigma.map(s => [s.label, s.value.toPrecision(15), s.sd.toPrecision(8)]);
  const cov = r.SigmaXapriori.map((row, i) => [labs[i], ...row.map(v => (v * s2).toPrecision(10))]);
  return toCsv(['parameter', 'value', 'sigma'], lines) + '\r\n' + toCsv(['covariance', ...labs], cov);
}

// ---------------------------------------------------------------- wiring
function wire() {
  document.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', () => loadSample(b.dataset.sample)));
  $('importFile').addEventListener('change', onImport);
  const reopts = () => { state.importOpts = { format: $('importFormat').value, angleFormat: $('angleFormat').value, renumber: $('renumber').checked }; syncImportUi(); if (state.source === 'import') setData(); else saveState(state); };
  ['importFormat', 'angleFormat', 'renumber'].forEach(id => $(id).addEventListener('change', reopts));
  $('btnGenerate').addEventListener('click', generate);
  $('btnBlunder').addEventListener('click', openBlunder);
  $('btnClearBlunders').addEventListener('click', () => { state.blunders = []; note = null; setData(); });
  $('blunderK').addEventListener('input', e => { $('blunderKOut').textContent = `${e.target.value} σ`; });
  $('btnInject').addEventListener('click', injectBlunder);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  $('btnRun').addEventListener('click', () => runAdjustment());
  $('outlierMethod').addEventListener('change', e => { state.cfg.outliers.method = e.target.value; saveState(state); renderOutlierHint(); });
  $('btnOutliers').addEventListener('click', () => runDetection($('outlierMethod').value));
  $('btnDeactivate').addEventListener('click', deactivateFlagged);
  $('btnReactivate').addEventListener('click', reactivateAll);
  $('resetBtn').addEventListener('click', async () => { state = defaultState(); detection = null; note = null; refreshForms(); syncImportUi(); await loadSample(DEFAULT_SAMPLE); });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderActiveTab(); }));
  $('pointsTable').addEventListener('change', e => { const n = e.target.dataset?.active; if (n) toggleActive(n, e.target.checked); });
  $('vecScale').addEventListener('input', e => { const k = Math.max(1, Math.round(Math.pow(10, Number(e.target.value) / 1000 * 3.5))); $('vecScaleOut').textContent = `×${k}`; view2d.setOptions({ vecScale: k, auto: false }); $('optVecAuto').checked = false; });
  $('optVecAuto').addEventListener('change', e => { view2d.setOptions({ auto: e.target.checked }); $('vecScaleOut').textContent = `×${view2d.currentK}`; });
  $('optLabels').addEventListener('change', e => view2d.setOptions({ labels: e.target.checked }));
  $('optEdges').addEventListener('change', e => view2d.setOptions({ edges: e.target.checked }));
  $('opt3dEllipsoids').addEventListener('change', e => view3d.setOptions({ ellipsoids: e.target.checked }));
  $('opt3dLines').addEventListener('change', e => view3d.setOptions({ lines: e.target.checked }));
  $('opt3dPlane').addEventListener('change', e => view3d.setOptions({ plane: e.target.checked }));
  $('opt3dDev').addEventListener('change', e => view3d.setOptions({ deviations: e.target.checked }));
  $('ellScale').addEventListener('input', e => { $('ellScaleOut').textContent = `×${e.target.value}`; view3d.setOptions({ scale: Number(e.target.value) }); });
  $('devScale').addEventListener('input', e => { $('devScaleOut').textContent = `×${e.target.value}`; view3d.setOptions({ devScale: Number(e.target.value) }); });
  $('fitSheet').addEventListener('click', () => view3d.fit('sheet')); $('fitScene').addEventListener('click', () => view3d.fit('scene'));
  $('planeValue').addEventListener('change', e => viewPlane.setOptions({ value: e.target.value }));
  $('planeHeat').addEventListener('change', e => viewPlane.setOptions({ heat: e.target.checked }));
  $('planeLabels').addEventListener('change', e => viewPlane.setOptions({ labels: e.target.checked }));
  $('histQuantity').addEventListener('change', renderHistogram);
  $('histCrit').addEventListener('change', renderHistogram);
  $('bins').addEventListener('input', e => { $('binsOut').textContent = e.target.value; renderHistogram(); });
  $('dlObs').addEventListener('click', () => { if (dataset) download('transform_lab_observations.csv', observationsCsv(dataset)); });
  $('dlRef').addEventListener('click', () => download('transform_lab_reference.csv', referenceCsv(builtinReference(state.sim.refUnit), state.sim.refUnit)));
  $('dlDist').addEventListener('click', () => {
    const pts = referencePoints(), s = state.cfg.refSigma, S = referenceCovariance(pts, { sxy: s.xyMm / 10, sz: s.zMm / 10, ppmX: s.ppmX, ppmY: s.ppmY });
    download('transform_lab_distances.csv', distancesCsv(distanceTable(pts, S)));
  });
  $('dlResults').addEventListener('click', () => { if (result?.ok) download('transform_lab_results.csv', resultsCsv(result, ['name', 'role', 'x', 'y', 'z', 'sx', 'sy', 'sz', 'dx', 'dy', 'dz', 'stat'])); });
  $('dlParams').addEventListener('click', () => { if (result?.ok) download('transform_lab_parameters.csv', paramsCsv()); });
  new ResizeObserver(() => { if (activeTab === 'hist') renderHistogram(); }).observe($('canvasHist').parentElement);
  onThemeChange(() => renderActiveTab());
  $('ellScaleOut').textContent = '×20'; $('devScaleOut').textContent = '×40'; $('binsOut').textContent = '15';
}

async function init() {
  view2d = new SheetView($('canvas2d'), $('tip2d'));
  view2d.onToggle = (name, makeCheck) => { state.cfg.checkOverride = { ...state.cfg.checkOverride, [name]: makeCheck }; invalidate(); };
  view3d = new StationView($('host3d'), () => { $('msg3d').textContent = t('v.noWebgl'); });
  viewPlane = new PlaneView($('canvasPlane'), $('tipPlane'), $('planeBar'));
  bootLanguage();
  buildForms(); wire(); syncImportUi();
  onLanguage(() => renderAll());
  busy++;
  try {
    // the last data set comes back from storage; the first visit preloads ATV-AJ (56 points)
    if (state.source === 'sim' || state.rawText) setData();
    else await loadSample(state.sample && SAMPLES[state.sample] ? state.sample : DEFAULT_SAMPLE);
  } finally { busy--; }
  renderAll();
}

init();

// Hooks for the browser tests
window.__lab = {
  get state() { return state; }, get result() { return result; }, get dataset() { return dataset; }, get detection() { return detection; }, get busy() { return busy; },
  set(path, value) { setPath(state.cfg, path, value); refreshForms(); invalidate(); },
  setSim(path, value) { setPath(state.sim, path, value); refreshForms(); saveState(state); },
  run: () => runAdjustment(),
  detect: method => runDetection(method),
  sample: key => loadSample(key),
  ready: () => new Promise(res => { const tick = () => (busy || !dataset ? setTimeout(tick, 20) : res(result)); tick(); })
};
