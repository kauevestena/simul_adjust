import { t, bootLanguage, onLanguage } from './i18n.mjs';
import { FIELDS, renderFields, loadState, saveState, defaultState, buildDataset, fmt, fmtSig, toMm, download, readFile, setPath } from './ui.mjs';
import { run } from './core/pipeline.mjs';
import { PRESETS } from './core/simulate.mjs';
import { referencePoints, referenceCovariance, distanceTable, distancesCsv } from './core/reference.mjs';
import { parseTsRaw, parseJob, parseXyz, tsFromRaw, tsFromXyz, renumberByOrder, builtinReference, observationsCsv, referenceCsv, resultsCsv } from './core/io.mjs';
import { UNITS } from './core/units.mjs';
import { SheetView } from './views/view2d.mjs';
import { StationView } from './views/view3d.mjs';
import { drawHistogram } from './views/histogram.mjs';
import { theme, onThemeChange, ROLE_KEYS } from './ui.mjs';

const $ = id => document.getElementById(id);
let state = loadState(), dataset = null, result = null, activeTab = 'view2d', pending = false;
let view2d, view3d;
const forms = {};

// ---------------------------------------------------------------- computation
function recompute() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    saveState(state);
    try {
      dataset = buildDataset(state);
      result = run(dataset, state.cfg);
    } catch (err) {
      console.error(err);
      result = { ok: false, error: { code: 'internal', message: String(err.message || err) }, cfg: state.cfg };
    }
    renderAll();
  });
}

// ---------------------------------------------------------------- rendering
function renderAll() {
  renderSummary(); renderMessages(); renderInjInfo(); renderLegends();
  renderActiveTab();
}

function renderActiveTab() {
  document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.id !== `tab-${activeTab}`; });
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === activeTab)));
  if (!result) return;
  if (activeTab === 'view2d') { view2d.setData(dataset, result, labels2d()); $('vecScaleOut').textContent = `×${view2d.currentK}`; }
  else if (activeTab === 'view3d') { view3d.setData(dataset, result); }
  else if (activeTab === 'hist') renderHistogram();
  else if (activeTab === 'results') renderResults();
  else if (activeTab === 'points') renderPoints();
}

const labels2d = () => ({
  scale: t('v.scaleBar', { mm: '{mm}', k: '{k}' }), role: Object.fromEntries(ROLE_KEYS.map(r => [r, t(`role.${r}`)])),
  inPlane: t('v.inPlane'), normal: t('v.normal'), clickHint: t('v.clickHint')
});

function tile(k, v, s = '', cls = '') { return `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="s">${s}</div></div>`; }

function renderSummary() {
  const box = $('summary');
  if (!result || !result.ok) { box.innerHTML = ''; return; }
  const r = result.res, p = result.params, c = result.checks;
  const toMmTs = v => toMm(v, result.tsUnit);
  const pass = r.test.pass;
  const tiles = [
    tile(t('k.lambda'), fmtSig(r.lambda, 7), `${t('k.delta')} ${fmt(p.deltaPpm, 0)} ppm · ${r.estimateScale ? t('k.estimated') : t('k.fixed')}`),
    tile(t('k.sigma0'), fmt(r.sigma0sq, 3), `${t('k.redundancy')} r = ${r.r}`),
    tile(t('k.global'), `<span class="${pass === null ? '' : pass ? 'pass' : 'fail'}">${pass === null ? '—' : pass ? t('k.accepted') : t('k.rejected')}</span>`, `Ω = ${fmt(r.Omega, 2)} ∈ [${fmt(r.test.low, 1)}, ${fmt(r.test.high, 1)}]`)
  ];
  if (c.joint) {
    tiles.push(tile(t('k.check'), `${fmt(toMmTs(c.rms.total), 2)} mm`, `${t('v.inPlane')} ${fmt(toMmTs(c.rms.inPlane), 2)} · ${t('v.normal')} ${fmt(toMmTs(c.rms.normal), 2)} mm`));
    tiles.push(tile(t('k.checkTest'), `<span class="${c.joint.pass ? 'pass' : 'fail'}">${c.joint.pass ? t('k.accepted') : t('k.rejected')}</span>`, `χ² = ${fmt(c.joint.chi2, 1)} / ${c.joint.dof}`));
  } else tiles.push(tile(t('k.check'), '—', t('k.noChecks')));
  box.innerHTML = tiles.join('');
}

function renderMessages() {
  const box = $('messages'); const msgs = [];
  if (!result) { box.textContent = ''; return; }
  if (!result.ok) {
    const e = result.error;
    msgs.push(['error', t(`m.err.${e.code}`, { n: e.count ?? '', rotation: e.rotation ? t(`o.${e.rotation}`) : '', message: e.message ?? '' })]);
    if (e.code === 'singular') {
      if (!e.constrained && e.rotation !== 'euler') msgs.push(['info', t('m.hint.constraints')]);
      if (e.rotation === 'euler' || e.rotation === 'axisAngle') msgs.push(['info', t('m.hint.degenerate')]);
    }
  } else {
    for (const f of result.res.flags) msgs.push([f.code === 'constraintsOff' ? 'info' : 'warn', t(`m.flag.${f.code}`, { value: fmtSig(f.value, 3), n: f.iterations ?? '' })]);
    const inj = result.cfg.injunctions;
    if (inj.set !== 'none') {
      if (result.res.parametricAbsolute) msgs.push(['info', t(result.cfg.scaleMode === 'rigid' ? 'm.info.paramAbsRigid' : 'm.info.paramAbsScale')]);
      else if (result.cfg.method === 'parametrico' && result.cfg.scaleMode === 'rigid') msgs.push(['info', t('m.info.paramRelRigid')]);
      if (inj.type === 'absolute' && dataset.meta?.config && (dataset.truth.printScalePpm.some(v => v !== 0))) msgs.push(['warn', t('m.warn.absScale')]);
    }
    if (result.cfg.method === 'parametrico' && result.res.test.pass === false) msgs.push(['info', t('m.info.paramFails')]);
    const inc = incidenceDeg();
    if (inc > 70) msgs.push(['warn', t('m.warn.incidence', { value: fmt(inc, 0) })]);
  }
  box.innerHTML = msgs.map(([k, m]) => `<div class="msg ${k}">${m}</div>`).join('');
}

// angle between the line of sight to the sheet centre and the sheet normal (0° = face-on)
function incidenceDeg() {
  const pts = result.points.filter(p => p.tsObs);
  if (!pts.length) return 0;
  const c = [0, 1, 2].map(i => pts.reduce((a, p) => a + p.tsObs[i], 0) / pts.length), n = result.res.R.map(r => r[2]);
  const cosA = Math.abs(c[0] * n[0] + c[1] * n[1] + c[2] * n[2]) / Math.hypot(...c);
  return Math.acos(Math.min(1, cosA)) * 180 / Math.PI;
}

function renderInjInfo() {
  const el = $('injInfo');
  if (!result || !result.ok) { el.textContent = ''; return; }
  const i = result.injInfo;
  el.textContent = i.set === 'none' ? t('i.none') : t('i.counts', { pairs: i.pairs, ind: i.independent, used: i.used });
}

function renderLegends() {
  const roles = ROLE_KEYS.map(r => `<span><i class="sw ${r}"></i>${t(`role.${r}`)}</span>`).join('');
  $('legend2d').innerHTML = roles; $('legend3d').innerHTML = roles;
  $('legendHist').innerHTML = `<span><i class="sw ts"></i>${t('v.seriesTs')}</span><span><i class="sw ref"></i>${t('v.seriesRef')}</span><span>— N(0, 1)</span>`;
}

function renderHistogram() {
  const canvas = $('canvasHist');
  if (!result || !result.ok) { drawHistogram(canvas, [], { labels: { empty: t('v.noData') } }); $('histStats').textContent = ''; return; }
  const r = result.res, m = r.m, th = theme();
  const ts = r.standardized.slice(0, 3 * m), ref = r.comb ? r.standardized.slice(3 * m, 6 * m) : [];
  drawHistogram(canvas, [{ values: ts, color: th.control }, { values: ref, color: th.uncollected }], { bins: Number($('bins').value), labels: { x: t('v.stdRes'), y: t('v.count'), empty: t('v.noData') } });
  const all = [...ts, ...ref].filter(Number.isFinite), n = all.length, mean = all.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  $('histStats').textContent = t('v.histStats', { n, mean: fmt(mean, 2), sd: fmt(sd, 2), ts: ts.filter(Number.isFinite).length, ref: ref.filter(Number.isFinite).length });
}

function paramRows() {
  const r = result.res, P = r.layout.P, o = result.cfg.outUnit;
  const f = result.outFactor, rows = [];
  result.params.sigma.forEach((s, i) => {
    if (i < 3) rows.push([s.label, `${fmt(s.value * f, 5)} ${o}`, `± ${fmt(s.sd * f * (o === 'm' ? 1000 : o === 'cm' ? 10 : 1), 3)} mm`]);
    else if (i < 3 + r.layout.s) {
      const kind = P.kinds[i - 3];
      rows.push(kind === 'angle' ? [s.label, `${fmt(s.value * 180 / Math.PI, 6)}°`, `± ${fmt(s.sd * 206264.806, 1)}″`] : [s.label, fmt(s.value, 8), `± ${fmtSig(s.sd, 3)}`]);
    } else rows.push([s.label, fmt(s.value, 9), `± ${fmt(s.sd / result.lambda0 * 1e6, 1)} ppm`]);
  });
  return rows;
}

function renderResults() {
  const box = $('resultsBox');
  if (!result || !result.ok) { box.innerHTML = `<p class="note">${t('v.noData')}</p>`; return; }
  const r = result.res, p = result.params, f = result.outFactor, tbl = (head, rows) => `<div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const D = 180 / Math.PI, forms = p.forms;
  const rot = [
    [t('o.euler'), `ω ${fmt(forms.euler[0] * D, 5)}°, φ ${fmt(forms.euler[1] * D, 5)}°, κ ${fmt(forms.euler[2] * D, 5)}°`],
    [t('o.quaternion'), `(${forms.quaternion.map(v => fmt(v, 7)).join(', ')})`],
    [t('o.axisAngle'), `n = (${forms.axisAngle.slice(0, 3).map(v => fmt(v, 6)).join(', ')}), θ = ${fmt(forms.axisAngle[3] * D, 5)}°`],
    [t('o.matrix'), p.R.map(row => row.map(v => fmt(v, 7)).join('  ')).join('<br>')]
  ];
  const stats = [
    [t('r.sigma0'), fmt(r.sigma0sq, 4)], [t('r.omega'), fmt(r.Omega, 3)], [t('r.redundancy'), `${r.r} = ${r.nEq} − ${r.nUnknown} + ${r.nConstraints}`],
    [t('r.chi2'), `[${fmt(r.test.low, 2)}, ${fmt(r.test.high, 2)}] (α = ${result.cfg.alpha})`], [t('r.iterations'), `${r.iterations}${r.converged ? '' : ' ⚠'}`],
    [t('r.cond'), Number.isFinite(r.cond) ? r.cond.toExponential(2) : '—'], [t('r.eps'), p.epsSd.map(v => `${fmt(v * 206264.806, 1)}″`).join(', ')],
    [t('r.counts'), t('r.countsTxt', result.counts)]
  ];
  const corr = r.SigmaXapriori.map((row, i) => row.map((v, j) => v / Math.sqrt(Math.max(r.SigmaXapriori[i][i] * r.SigmaXapriori[j][j], 1e-300))));
  const labs = r.layout.labels;
  box.innerHTML = `
    <div class="grid2">
      <div><h3>${t('r.params')}</h3>${tbl([t('r.param'), t('r.value'), 'σ'], paramRows())}</div>
      <div><h3>${t('r.rotation')}</h3>${tbl([t('r.form'), t('r.value')], rot)}</div>
      <div><h3>${t('r.stats')}</h3>${tbl([t('r.quantity'), t('r.value')], stats)}</div>
      <div><h3>${t('r.history')}</h3>${tbl(['#', t('r.step'), 'Ω'], r.history.map(h => [h.iter, h.step.toExponential(2), fmt(h.Omega, 4)]))}</div>
    </div>
    <details class="card" style="margin-top:12px"><summary>${t('r.corr')}</summary><div class="body">${tbl([''].concat(labs), corr.map((row, i) => [labs[i], ...row.map(v => fmt(v, 3))]))}</div></details>`;
}

function renderPoints() {
  const tb = $('pointsTable');
  if (!result || !result.ok) { tb.innerHTML = ''; return; }
  const u = result.tsUnit, mm = v => (Number.isFinite(v) ? fmt(toMm(v, u), 3) : '—');
  const head = [t('p.name'), t('p.role'), 'Δx', 'Δy', 'Δz', t('v.normal'), t('v.inPlane'), 'σ', 'χ²'];
  const row = p => {
    const d = p.vT || p.d;
    const sd = p.sigma ? Math.max(...p.sigma) : p.sheetSigma ? Math.max(...p.sheetSigma) * UNITS[result.refUnit] / UNITS[u] : NaN;
    const normal = p.normal !== undefined ? mm(p.normal) : p.role === 'tsOnly' ? `z<sub>S</sub> = ${fmt(toMm(p.sheet[2], result.refUnit), 3)}` : '';
    const stat = p.chi2 ?? p.T;
    return [p.name, t(`role.${p.role}`), ...(d ? d.map(mm) : ['', '', '']), normal, p.inPlane !== undefined ? mm(p.inPlane) : '', Number.isFinite(sd) ? mm(sd) : '', Number.isFinite(stat) ? fmt(stat, 2) : '—'];
  };
  tb.innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${result.points.map(p => `<tr>${row(p).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

// ---------------------------------------------------------------- forms and wiring
function onCfg() { recompute(); }

function buildForms() {
  forms.sim = renderFields($('simForm'), FIELDS.sim, () => state.sim, path => {
    if (path === 'preset') { Object.assign(state.sim, PRESETS[state.sim.preset]); forms.sim.refresh(); }
    else if (['refUnit', 'tsUnit'].includes(path)) state.imported = null, state.source = 'sim', $('source').value = 'sim', toggleImport();
    recompute();
  });
  forms.ref = renderFields($('refForm'), FIELDS.reference, () => state.cfg, onCfg);
  forms.model = renderFields($('modelForm'), FIELDS.model, () => state.cfg, onCfg);
  forms.checks = renderFields($('checkForm'), FIELDS.checks, () => state.cfg, path => { if (path === 'checkPct' || path === 'checkSeed') state.cfg.checkOverride = {}; recompute(); });
  forms.inj = renderFields($('injForm'), FIELDS.injunctions, () => state.cfg, onCfg);
  forms.out = renderFields($('outForm'), FIELDS.output, () => state.cfg, onCfg);
}

function toggleImport() {
  const imp = $('source').value === 'import';
  $('importBox').hidden = !imp; $('simForm').hidden = imp && false;
  $('angleRow').hidden = $('importFormat').value !== 'raw';
}

async function onImport(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const status = $('importStatus');
  try {
    const text = await readFile(file), fmtSel = $('importFormat').value;
    const refUnit = state.sim.refUnit, tsUnit = state.sim.tsUnit, ref = builtinReference(refUnit);
    let rows, errors, ts;
    if (fmtSel === 'xyz') { ({ rows, errors } = parseXyz(text)); ts = tsFromXyz(rows); }
    else {
      ({ rows, errors } = fmtSel === 'job' ? parseJob(text) : parseTsRaw(text, { angleFormat: $('angleFormat').value }));
      ts = tsFromRaw(rows, { tsUnit, instrument: state.sim.instrument });
    }
    if ($('renumber').checked) ts = renumberByOrder(ts, ref);
    if (!ts.length) { status.textContent = t('i.importEmpty'); return; }
    state.imported = { version: 1, refUnit, tsUnit, ref, ts, truth: null, meta: { source: 'import', file: file.name } };
    state.source = 'import'; state.cfg.checkOverride = {};
    status.textContent = t('i.importOk', { n: ts.length, bad: errors.length, file: file.name });
    recompute();
  } catch (err) { status.textContent = t('i.importFail', { message: String(err.message || err) }); }
  ev.target.value = '';
}

function wire() {
  $('source').addEventListener('change', () => { toggleImport(); if ($('source').value === 'sim') { state.source = 'sim'; recompute(); } else if (state.imported) { state.source = 'import'; recompute(); } });
  $('importFormat').addEventListener('change', toggleImport);
  $('importFile').addEventListener('change', onImport);
  $('resetBtn').addEventListener('click', () => { state = defaultState(); $('source').value = 'sim'; Object.values(forms).forEach(f => f.refresh()); toggleImport(); recompute(); });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderActiveTab(); }));
  $('vecScale').addEventListener('input', e => { const k = Math.max(1, Math.round(Math.pow(10, Number(e.target.value) / 1000 * 3.5))); $('vecScaleOut').textContent = `×${k}`; view2d.setOptions({ vecScale: k, auto: false }); $('optVecAuto').checked = false; });
  $('optVecAuto').addEventListener('change', e => { view2d.setOptions({ auto: e.target.checked }); $('vecScaleOut').textContent = `×${view2d.currentK}`; });
  $('optLabels').addEventListener('change', e => view2d.setOptions({ labels: e.target.checked }));
  $('optEdges').addEventListener('change', e => view2d.setOptions({ edges: e.target.checked }));
  $('opt3dEllipsoids').addEventListener('change', e => view3d.setOptions({ ellipsoids: e.target.checked }));
  $('opt3dLines').addEventListener('change', e => view3d.setOptions({ lines: e.target.checked }));
  $('ellScale').addEventListener('input', e => { $('ellScaleOut').textContent = `×${e.target.value}`; view3d.setOptions({ scale: Number(e.target.value) }); });
  $('fitSheet').addEventListener('click', () => view3d.fit('sheet')); $('fitScene').addEventListener('click', () => view3d.fit('scene'));
  $('bins').addEventListener('input', e => { $('binsOut').textContent = e.target.value; renderHistogram(); });
  $('dlObs').addEventListener('click', () => { if (dataset) download('transform_lab_observations.csv', observationsCsv(dataset)); });
  $('dlRef').addEventListener('click', () => download('transform_lab_reference.csv', referenceCsv(builtinReference(state.sim.refUnit), state.sim.refUnit)));
  $('dlDist').addEventListener('click', () => {
    const pts = referencePoints(), s = state.cfg.refSigma, S = referenceCovariance(pts, { sxy: s.xyMm / 10, sz: s.zMm / 10, ppmX: s.ppmX, ppmY: s.ppmY });
    download('transform_lab_distances.csv', distancesCsv(distanceTable(pts, S)));
  });
  $('dlResults').addEventListener('click', () => { if (result?.ok) download('transform_lab_results.csv', resultsCsv(result, ['name', 'role', 'x', 'y', 'z', 'sx', 'sy', 'sz', 'dx', 'dy', 'dz', 'stat'])); });
  new ResizeObserver(() => { if (activeTab === 'hist') renderHistogram(); }).observe($('canvasHist').parentElement);
  onThemeChange(() => renderActiveTab());
  $('ellScaleOut').textContent = '×20'; $('binsOut').textContent = '15';
}

function init() {
  const canvas = $('canvas2d');
  view2d = new SheetView(canvas, $('tip2d'));
  view2d.onToggle = (name, makeCheck) => {
    state.cfg.checkOverride = { ...state.cfg.checkOverride, [name]: makeCheck };
    recompute();
  };
  view3d = new StationView($('host3d'), () => { $('msg3d').textContent = t('v.noWebgl'); });
  bootLanguage();
  buildForms(); wire(); toggleImport();
  onLanguage(() => { renderAll(); });
  recompute();
}

init();

// Hooks for the browser tests
window.__lab = {
  get state() { return state; }, get result() { return result; }, get dataset() { return dataset; },
  set(path, value) { setPath(state.cfg, path, value); Object.values(forms).forEach(f => f.refresh()); recompute(); },
  setSim(path, value) { setPath(state.sim, path, value); forms.sim.refresh(); recompute(); },
  ready: () => new Promise(res => { const tick = () => (pending || !result ? setTimeout(tick, 20) : res(result)); tick(); })
};
