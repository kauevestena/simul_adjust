// Comparison page: any two configurations on the same dataset and the same random draws.
// A ready-made pair is applied and compared at once; edits in the dialogs or in the common
// fields only mark the comparison as out of date until ▶ Comparar A × B.
import { t, plain, bootLanguage, onLanguage } from './i18n.mjs';
import { FIELDS, renderFields, loadState, datasetFrom, fetchText, useSample, SAMPLES, DEFAULT_SAMPLE, fmt, fmtSig, toMm, setPath, getPath, theme, onThemeChange, ROLE_KEYS } from './ui.mjs';
import { run, mergeConfig } from './core/pipeline.mjs';
import { PRESETS, simulateDataset } from './core/simulate.mjs';
import { rotationDifference } from './core/rotations.mjs';
import { SheetView } from './views/view2d.mjs';
import { drawHistogram } from './views/histogram.mjs';
import { UNITS } from './core/units.mjs';
import { COMPARE_PRESETS } from './compare-presets.mjs';

const $ = id => document.getElementById(id);
const KEY = 'transform_lab_compare_v2';
const ARC = 206264.806;

let base, ds, a, b, scenario = null, resA = null, resB = null, stale = false;
const forms = {};

function load() {
  base = loadState();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 2) { a = mergeConfig(raw.a); b = mergeConfig(raw.b); scenario = raw.scenario || null; return; }
  } catch { /* ignore */ }
  a = mergeConfig(base.cfg); b = mergeConfig({ ...base.cfg, method: base.cfg.method === 'combinado' ? 'parametrico' : 'combinado' });
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: 2, a, b, scenario })); } catch { /* ignore */ } };

function dataset() {
  if (scenario) return simulateDataset({ ...base.sim, ...PRESETS[scenario], preset: scenario });
  return datasetFrom(base).dataset;
}

function applyPreset(name) {
  const p = COMPARE_PRESETS[name];
  const merge = (cfg, patch) => mergeConfig({ ...cfg, ...patch, injunctions: { ...cfg.injunctions, ...(patch.injunctions || {}) } });
  const baseCfg = mergeConfig({ ...base.cfg, checkPct: a.checkPct, checkSeed: a.checkSeed, outUnit: a.outUnit, varianceFactor: a.varianceFactor, alpha: a.alpha });
  a = merge(baseCfg, p.a); b = merge(baseCfg, p.b);
  scenario = p.scenario || null;
  save(); update();
}

// ---------------------------------------------------------------- summaries and results
const summary = c => [plain(`o.${c.method}`), plain(`o.${c.rotation}`), plain(`o.${c.scaleMode}`),
  c.injunctions.set === 'none' ? plain('i.none') : `${plain(`o.${c.injunctions.set}`)} · ${plain(`o.${c.injunctions.type}`)}`,
  `${plain('f.tsCovariance')}: ${plain(`o.${c.tsCovariance}`)}`, c.constrainRotation ? '' : plain('m.flag.constraintsOff')].filter(Boolean).join(' · ');

function row(label, va, vb, delta = '') { return `<tr><td>${label}</td><td>${va}</td><td>${vb}</td><td>${delta}</td></tr>`; }

function column(r) {
  if (!r?.ok) return null;
  const res = r.res, c = r.checks, mm = v => fmt(toMm(v, r.tsUnit), 3);
  return {
    lambda: fmtSig(res.lambda, 8), delta: fmt(r.params.deltaPpm, 1), sdLam: res.estimateScale ? fmt(Math.sqrt(res.SigmaXapriori[res.nUnknown - 1][res.nUnknown - 1] * r.s2) / r.lambda0 * 1e6, 1) : '—',
    s0: fmt(res.sigma0sq, 3), omega: fmt(res.Omega, 2), rr: String(res.r), pass: res.test.pass,
    chk: c.joint ? { total: mm(c.rms.total), inPlane: mm(c.rms.inPlane), normal: mm(c.rms.normal), chi2: fmt(c.joint.chi2, 1), dof: c.joint.dof, pass: c.joint.pass } : null,
    cond: Number.isFinite(res.cond) ? res.cond.toExponential(1) : '—', it: String(res.iterations),
    eps: r.params.epsSd.map(v => fmt(v * ARC, 1)).join(' / '),
    flags: res.flags.map(f => t(`m.flag.${f.code}`, { value: fmtSig(f.value, 3), n: f.iterations ?? '' })).join(' ')
  };
}

function renderTable() {
  if (!resA || !resB) { $('cmpTable').innerHTML = `<tbody><tr><td class="waiting">${t('cmp.stale')}</td></tr></tbody>`; return; }
  const A = column(resA), B = column(resB), dash = '—';
  const failMsg = r => (r.ok ? '' : t(`m.err.${r.error.code}`, { n: r.error.count ?? '', rotation: r.error.rotation ? plain(`o.${r.error.rotation}`) : '', message: r.error.message ?? '' }));
  let dRot = dash, dT = dash, dLam = dash;
  if (A && B) {
    dRot = `${fmt(rotationDifference(resA.res.R, resB.res.R) * ARC, 2)}″`;
    dT = `${fmt(Math.hypot(...resA.res.t.map((v, i) => v - resB.res.t[i])) * 1000 * UNITS[resA.tsUnit], 3)} mm`;
    dLam = `${fmt(resB.params.deltaPpm - resA.params.deltaPpm, 1)} ppm`;
  }
  const g = (col, k) => (col ? col[k] : dash);
  const pass = col => (col ? `<span class="${col.pass ? 'pass' : 'fail'}">${col.pass ? t('k.accepted') : t('k.rejected')}</span>` : dash);
  const chk = (col, k) => (col?.chk ? col.chk[k] : dash);
  const chkPass = col => (col?.chk ? `<span class="${col.chk.pass ? 'pass' : 'fail'}">${col.chk.chi2} / ${col.chk.dof}</span>` : dash);
  $('cmpTable').innerHTML = `<thead><tr><th>${t('cmp.quantity')}</th><th>A</th><th>B</th><th>${t('cmp.diff')}</th></tr></thead><tbody>
    ${row(t('cmp.status'), A ? 'OK' : `<span class="diff-up">${failMsg(resA)}</span>`, B ? 'OK' : `<span class="diff-up">${failMsg(resB)}</span>`)}
    ${row(t('k.lambda'), g(A, 'lambda'), g(B, 'lambda'), dLam)}
    ${row(t('k.delta') + ' (ppm)', g(A, 'delta'), g(B, 'delta'))}
    ${row('σ<sub>λ</sub> (ppm)', g(A, 'sdLam'), g(B, 'sdLam'))}
    ${row(t('cmp.rotDiff'), dash, dash, dRot)}
    ${row(t('cmp.tDiff'), dash, dash, dT)}
    ${row(t('r.eps'), g(A, 'eps'), g(B, 'eps'))}
    ${row(t('r.sigma0'), g(A, 's0'), g(B, 's0'))}
    ${row(t('r.omega'), g(A, 'omega'), g(B, 'omega'))}
    ${row(t('r.redundancy').split(' =')[0], g(A, 'rr'), g(B, 'rr'))}
    ${row(t('k.global'), pass(A), pass(B))}
    ${row(t('k.check') + ' · ' + t('cmp.total') + ' (mm)', chk(A, 'total'), chk(B, 'total'))}
    ${row(t('v.inPlane') + ' (mm)', chk(A, 'inPlane'), chk(B, 'inPlane'))}
    ${row(t('v.normal') + ' (mm)', chk(A, 'normal'), chk(B, 'normal'))}
    ${row(t('k.checkTest') + ' (χ² / gl)', chkPass(A), chkPass(B))}
    ${row(t('r.cond'), g(A, 'cond'), g(B, 'cond'))}
    ${row(t('r.iterations'), g(A, 'it'), g(B, 'it'))}
    ${row(t('cmp.flags'), g(A, 'flags') || '—', g(B, 'flags') || '—')}
  </tbody>`;
}

function labels2d() {
  return { scale: t('v.scaleBar', { mm: '{mm}', k: '{k}' }), role: { ...Object.fromEntries(ROLE_KEYS.map(r => [r, t(`role.${r}`)])), collected: t('role.collected') }, inPlane: t('v.inPlane'), normal: t('v.normal'), clickHint: '', waiting: t('cmp.stale'), flagged: t('v.legendFlag') };
}

let viewA, viewB;
function renderPlots() {
  $('titleA2d').textContent = `A · ${summary(a)}`; $('titleB2d').textContent = `B · ${summary(b)}`;
  if (!ds) return;
  [[viewA, resA], [viewB, resB]].forEach(([v, r]) => v.setData(ds, r, labels2d()));
  // same exaggeration for both so the panels are comparable
  const k = Math.max(viewA.currentK || 1, viewB.currentK || 1);
  [viewA, viewB].forEach(v => v.setOptions({ auto: false, vecScale: k }));
  const th = theme();
  for (const [id, r] of [['histA', resA], ['histB', resB]]) {
    const canvas = $(id);
    if (!r?.ok) { drawHistogram(canvas, [], { labels: { empty: r ? t('v.noData') : t('cmp.stale') } }); continue; }
    const m = r.res.m, st = r.res.standardized;
    drawHistogram(canvas, [{ values: st.slice(0, 3 * m), color: th.control }, { values: r.res.comb ? st.slice(3 * m, 6 * m) : [], color: th.uncollected }], { bins: 15, labels: { x: plain('v.stdRes'), y: plain('v.count'), empty: t('v.noData') } });
  }
}

function update() {
  ds = dataset();
  resA = run(ds, a); resB = run(ds, b); stale = false;
  render();
}

function render() {
  $('sumA').textContent = summary(a); $('sumB').textContent = summary(b);
  if (ds) {
    const src = ds.meta?.source === 'import' ? t('cmp.dsImport', { file: ds.meta.file ?? '' }) : t('cmp.dsSim', { scenario: plain(`o.${ds.meta.config.preset}`), seed: ds.meta.config.seed, n: ds.ts.length });
    $('datasetInfo').textContent = `${plain('cmp.dataset')}: ${src} · ${plain('cmp.sameData', { pct: a.checkPct, seed: a.checkSeed })}`;
  }
  $('presetDesc').textContent = plain(`cmp.d.${$('preset').value}`);
  forms.commonRefresh?.();
  renderTable(); renderPlots(); renderMessages();
  $('runCompare').classList.toggle('pending', stale);
}

function markStale() { save(); resA = null; resB = null; stale = true; render(); }

function renderMessages() {
  const msgs = [];
  if (stale) msgs.push(['warn', t('cmp.stale')]);
  if (scenario) msgs.push(['info', t('cmp.scenarioNote', { scenario: plain(`o.${scenario}`) })]);
  $('messages').innerHTML = msgs.map(([k, m]) => `<div class="msg ${k}">${m}</div>`).join('');
}

// ---------------------------------------------------------------- forms
const pick = (list, paths) => list.filter(f => paths.includes(f.path));
function buildForms() {
  const groups = [
    ['s.model', [...pick(FIELDS.workflow, ['method', 'rotation', 'scaleMode']), ...FIELDS.modelAdv]],
    ['s.reference', FIELDS.reference],
    ['s.injunctions', [...pick(FIELDS.workflow, ['injunctions.set', 'injunctions.type']), ...pick(FIELDS.checkInj, ['injunctions.randomPct', 'injunctions.factor', 'injunctions.seed'])]]
  ];
  const dlg = (host, cfg) => {
    host.textContent = '';
    return groups.map(([title, fields]) => {
      const h = document.createElement('span'); h.className = 'subhead'; h.dataset.t = title; host.append(h);
      const box = document.createElement('div'); box.className = 'fields'; host.append(box);
      return renderFields(box, fields, () => cfg(), () => markStale());
    });
  };
  forms.A = dlg($('formA'), () => a); forms.B = dlg($('formB'), () => b);
  // check points, tests and output are common to both configurations
  const shared = [...pick(FIELDS.workflow, ['checkPct']), ...pick(FIELDS.checkInj, ['checkSeed']), ...pick(FIELDS.tests, ['alpha']), ...FIELDS.output];
  const view = {};
  const r = renderFields($('commonForm'), shared, () => view.cfg, path => {
    const v = getPath(view.cfg, path);
    setPath(a, path, v); setPath(b, path, v);
    if (path === 'checkPct' || path === 'checkSeed') { a.checkOverride = {}; b.checkOverride = {}; }
    markStale();
  });
  view.cfg = a;
  forms.commonRefresh = () => { view.cfg = a; r.refresh(); };
  document.querySelectorAll('[data-close]').forEach(bt => bt.addEventListener('click', () => $(bt.dataset.close).close()));
}

function fillPresets() {
  const sel = $('preset'), cur = sel.value; sel.textContent = '';
  Object.keys(COMPARE_PRESETS).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = plain(`cmp.p.${k}`); sel.append(o); });
  if (cur) sel.value = cur;
}

async function init() {
  bootLanguage();
  load();
  // nothing stored yet: the same default data set as the simulator
  if (base.source === 'import' && !base.rawText) {
    try { useSample(base, DEFAULT_SAMPLE, await fetchText(SAMPLES[DEFAULT_SAMPLE].file)); } catch { base.source = 'sim'; }
  }
  fillPresets();
  viewA = new SheetView($('canvasA'), $('tipA')); viewB = new SheetView($('canvasB'), $('tipB'));
  buildForms();
  $('applyPreset').addEventListener('click', () => applyPreset($('preset').value));
  $('preset').addEventListener('change', () => { $('presetDesc').textContent = plain(`cmp.d.${$('preset').value}`); });
  $('useMain').addEventListener('click', () => { scenario = null; a = mergeConfig(base.cfg); b = mergeConfig(base.cfg); save(); forms.A.forEach(f => f.refresh()); forms.B.forEach(f => f.refresh()); update(); });
  $('runCompare').addEventListener('click', () => update());
  $('editA').addEventListener('click', () => { forms.A.forEach(f => f.refresh()); $('dlgA').showModal(); });
  $('editB').addEventListener('click', () => { forms.B.forEach(f => f.refresh()); $('dlgB').showModal(); });
  onLanguage(() => { fillPresets(); render(); });
  onThemeChange(() => renderPlots());
  update();
}
init();

window.__cmp = { get a() { return a; }, get b() { return b; }, get resA() { return resA; }, get resB() { return resB; }, get stale() { return stale; }, applyPreset, run: () => update(), presets: COMPARE_PRESETS };
