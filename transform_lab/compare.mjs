// Comparison page: any two configurations on the same dataset and the same random draws.
import { t, bootLanguage, onLanguage } from './i18n.mjs';
import { FIELDS, renderFields, loadState, buildDataset, fmt, fmtSig, toMm, setPath, getPath } from './ui.mjs';
import { run, mergeConfig } from './core/pipeline.mjs';
import { PRESETS, simulateDataset } from './core/simulate.mjs';
import { rotationDifference } from './core/rotations.mjs';
import { SheetView } from './views/view2d.mjs';
import { drawHistogram } from './views/histogram.mjs';
import { theme, onThemeChange, ROLE_KEYS } from './ui.mjs';
import { UNITS } from './core/units.mjs';
import { COMPARE_PRESETS } from './compare-presets.mjs';

const $ = id => document.getElementById(id);
const KEY = 'transform_lab_compare_v1';
const ARC = 206264.806;
const clone = o => structuredClone(o);

let base, ds, a, b, scenario = null, resA = null, resB = null;
const forms = {};

function load() {
  base = loadState();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) { a = mergeConfig(raw.a); b = mergeConfig(raw.b); scenario = raw.scenario || null; return; }
  } catch { /* ignore */ }
  a = mergeConfig(base.cfg); b = mergeConfig({ ...base.cfg, method: base.cfg.method === 'combinado' ? 'parametrico' : 'combinado' });
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, a, b, scenario })); } catch { /* ignore */ } };

function dataset() {
  if (scenario) return simulateDataset({ ...base.sim, ...PRESETS[scenario], preset: scenario });
  return buildDataset(base);
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
const summary = c => [t(`o.${c.method}`), t(`o.${c.rotation}`), t(`o.${c.scaleMode}`),
  c.injunctions.set === 'none' ? t('i.none') : `${t(`o.${c.injunctions.set}`)} · ${t(`o.${c.injunctions.type}`)}`,
  `${t('f.tsCovariance')}: ${t(`o.${c.tsCovariance}`)}`, c.constrainRotation ? '' : t('m.flag.constraintsOff')].filter(Boolean).join(' · ');

function row(label, va, vb, delta = '') { return `<tr><td>${label}</td><td>${va}</td><td>${vb}</td><td>${delta}</td></tr>`; }

function column(r) {
  if (!r.ok) return null;
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
  const A = column(resA), B = column(resB), dash = '—';
  const failMsg = r => (r.ok ? '' : t(`m.err.${r.error.code}`, { n: r.error.count ?? '', rotation: r.error.rotation ? t(`o.${r.error.rotation}`) : '', message: r.error.message ?? '' }));
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
  return { scale: t('v.scaleBar', { mm: '{mm}', k: '{k}' }), role: Object.fromEntries(ROLE_KEYS.map(r => [r, t(`role.${r}`)])), inPlane: t('v.inPlane'), normal: t('v.normal'), clickHint: '' };
}

let viewA, viewB;
function renderPlots() {
  $('titleA2d').textContent = `A · ${summary(a)}`; $('titleB2d').textContent = `B · ${summary(b)}`;
  [[viewA, resA], [viewB, resB]].forEach(([v, r]) => v.setData(ds, r, labels2d()));
  // same exaggeration for both so the panels are comparable
  const k = Math.max(viewA.currentK || 1, viewB.currentK || 1);
  [viewA, viewB].forEach(v => v.setOptions({ auto: false, vecScale: k }));
  const th = theme();
  for (const [id, r] of [['histA', resA], ['histB', resB]]) {
    const canvas = $(id);
    if (!r.ok) { drawHistogram(canvas, [], { labels: { empty: t('v.noData') } }); continue; }
    const m = r.res.m, st = r.res.standardized;
    drawHistogram(canvas, [{ values: st.slice(0, 3 * m), color: th.control }, { values: r.res.comb ? st.slice(3 * m, 6 * m) : [], color: th.uncollected }], { bins: 15, labels: { x: t('v.stdRes'), y: t('v.count'), empty: t('v.noData') } });
  }
}

function update() {
  ds = dataset();
  resA = run(ds, a); resB = run(ds, b);
  $('sumA').textContent = summary(a); $('sumB').textContent = summary(b);
  const src = ds.meta?.source === 'import' ? t('cmp.dsImport', { file: ds.meta.file ?? '' }) : t('cmp.dsSim', { scenario: t(`o.${ds.meta.config.preset}`), seed: ds.meta.config.seed, n: ds.ts.length });
  $('datasetInfo').textContent = `${t('cmp.dataset')}: ${src} · ${t('cmp.sameData', { pct: a.checkPct, seed: a.checkSeed })}`;
  $('presetDesc').textContent = t(`cmp.d.${$('preset').value}`);
  forms.commonRefresh?.();
  renderTable(); renderPlots(); renderMessages();
}

function renderMessages() {
  const msgs = [];
  if (scenario) msgs.push(['info', t('cmp.scenarioNote', { scenario: t(`o.${scenario}`) })]);
  $('messages').innerHTML = msgs.map(([k, m]) => `<div class="msg ${k}">${m}</div>`).join('');
}

// ---------------------------------------------------------------- forms
function buildForms() {
  const onChange = () => { save(); update(); };
  const dlg = (host, cfg) => {
    host.textContent = '';
    const groups = [['s.model', FIELDS.model], ['s.reference', FIELDS.reference], ['s.injunctions', FIELDS.injunctions]];
    return groups.map(([title, fields]) => {
      const h = document.createElement('strong'); h.dataset.t = title; host.append(h);
      const box = document.createElement('div'); box.className = 'body'; box.style.padding = '0'; host.append(box);
      return renderFields(box, fields, () => cfg(), onChange);
    });
  };
  forms.A = dlg($('formA'), () => a); forms.B = dlg($('formB'), () => b);
  // checks and output are common to both configurations (same check points, same statistics)
  const shared = [...FIELDS.checks, ...FIELDS.output];
  const view = {};
  const r = renderFields($('commonForm'), shared, () => view.cfg, path => {
    const v = getPath(view.cfg, path);
    setPath(a, path, v); setPath(b, path, v);
    if (path === 'checkPct' || path === 'checkSeed') { a.checkOverride = {}; b.checkOverride = {}; }
    save(); update();
  });
  view.cfg = a;
  forms.commonRefresh = () => { view.cfg = a; r.refresh(); };
  document.querySelectorAll('[data-close]').forEach(bt => bt.addEventListener('click', () => $(bt.dataset.close).close()));
}

function fillPresets() {
  const sel = $('preset'); sel.textContent = '';
  Object.keys(COMPARE_PRESETS).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = t(`cmp.p.${k}`); sel.append(o); });
}

function init() {
  bootLanguage();
  load();
  fillPresets();
  viewA = new SheetView($('canvasA'), $('tipA')); viewB = new SheetView($('canvasB'), $('tipB'));
  buildForms();
  $('applyPreset').addEventListener('click', () => applyPreset($('preset').value));
  $('preset').addEventListener('change', () => { $('presetDesc').textContent = t(`cmp.d.${$('preset').value}`); });
  $('useMain').addEventListener('click', () => { scenario = null; a = mergeConfig(base.cfg); b = mergeConfig(base.cfg); save(); forms.A.forEach(f => f.refresh()); forms.B.forEach(f => f.refresh()); update(); });
  $('editA').addEventListener('click', () => { forms.A.forEach(f => f.refresh()); $('dlgA').showModal(); });
  $('editB').addEventListener('click', () => { forms.B.forEach(f => f.refresh()); $('dlgB').showModal(); });
  onLanguage(() => { fillPresets(); update(); });
  onThemeChange(() => renderPlots());
  update();
}
init();

window.__cmp = { get a() { return a; }, get b() { return b; }, get resA() { return resA; }, get resB() { return resB; }, applyPreset, presets: COMPARE_PRESETS };
