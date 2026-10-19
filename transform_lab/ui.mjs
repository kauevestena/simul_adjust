// Shared by the three pages: persisted state, schema-driven forms, formatting, downloads.
import { t, L, applyLanguage } from './i18n.mjs';
import { mergeConfig } from './core/pipeline.mjs';
import { simulateDataset, DEFAULT_SIM } from './core/simulate.mjs';
import { UNITS } from './core/units.mjs';

export const STORE_KEY = 'transform_lab_state_v1';

export const defaultState = () => ({ source: 'import', sim: structuredClone(DEFAULT_SIM), imported: null, rawText: null, rawName: '', importOpts: { format: 'raw', angleFormat: 'deg', renumber: false }, cfg: mergeConfig({}) });

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && raw.v === 1) {
      const s = defaultState();
      return { source: raw.source === 'sim' ? 'sim' : 'import', rawText: raw.rawText || null, rawName: raw.rawName || '', importOpts: { ...s.importOpts, ...raw.importOpts }, sim: { ...s.sim, ...raw.sim, instrument: { ...s.sim.instrument, ...raw.sim?.instrument }, reference: { ...s.sim.reference, ...raw.sim?.reference } }, imported: raw.imported || null, cfg: mergeConfig(raw.cfg) };
    }
  } catch { /* corrupted or blocked storage */ }
  return defaultState();
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, ...state })); } catch { /* quota or blocked */ }
}

export const buildDataset = state => (state.source === 'import' && state.imported ? state.imported : simulateDataset(state.sim));

// Visibility predicates of the data form: ctx = { source, format }
const simOnly = (c, x) => x.source === 'sim';
const instrumentShown = (c, x) => x.source === 'sim' || x.format !== 'xyz';

// ---------------------------------------------------------------- paths
export const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, path, v) {
  const ks = path.split('.'); const last = ks.pop();
  const host = ks.reduce((a, k) => (a[k] ??= {}), o);
  host[last] = v;
}

// ---------------------------------------------------------------- forms
// field: { path, type: 'select'|'number'|'range'|'check', label (key), hint (key), options, min, max, step, show(cfg) }
export const FIELDS = {
  sim: [
    { path: 'refUnit', type: 'select', label: L('f.refUnit'), hint: L('h.units'), options: ['mm', 'cm', 'm'], optionLabel: v => v },
    { path: 'tsUnit', type: 'select', label: L('f.tsUnit'), options: ['mm', 'cm', 'm'], optionLabel: v => v },
    { path: 'preset', type: 'select', label: L('f.preset'), hint: L('h.preset'), options: ['wall', 'frontal', 'oblique', 'landscape', 'table', 'tableAligned', 'easel'], show: simOnly },
    { path: 'seed', type: 'number', label: L('f.seed'), min: 1, step: 1, show: simOnly },
    { path: 'distance', type: 'number', label: L('f.distance'), min: 1, max: 100, step: 0.5, show: simOnly },
    { path: 'obliquity', type: 'number', label: L('f.obliquity'), hint: L('h.obliquity'), min: -80, max: 80, step: 5, show: simOnly },
    { path: 'collectedPct', type: 'range', label: L('f.collectedPct'), min: 20, max: 100, step: 5, suffix: '%', show: simOnly },
    { path: 'extraPoints', type: 'number', label: L('f.extraPoints'), hint: L('h.extraPoints'), min: 0, max: 10, step: 1, show: simOnly },
    { path: 'instrument.angleSec', type: 'number', label: L('f.angleSec'), min: 0.1, step: 0.1, show: instrumentShown },
    { path: 'instrument.mm', type: 'number', label: L('f.edmMm'), min: 0, step: 0.5, show: instrumentShown },
    { path: 'instrument.ppm', type: 'number', label: L('f.edmPpm'), min: 0, step: 0.5, show: instrumentShown },
    { path: 'reference.trueSigmaMm', type: 'number', label: L('f.trueSigma'), hint: L('h.trueSigma'), min: 0, step: 0.01, show: simOnly },
    { path: 'reference.printScalePpmX', type: 'number', label: L('f.truePpmX'), hint: L('h.truePpm'), step: 50, show: simOnly },
    { path: 'reference.printScalePpmY', type: 'number', label: L('f.truePpmY'), step: 50, show: simOnly }
  ],
  model: [
    { path: 'method', type: 'select', label: L('f.method'), hint: L('h.method'), options: ['combinado', 'parametrico'] },
    { path: 'rotation', type: 'select', label: L('f.rotation'), hint: L('h.rotation'), options: ['euler', 'quaternion', 'matrix', 'axisAngle'] },
    { path: 'scaleMode', type: 'select', label: L('f.scaleMode'), hint: L('h.scaleMode'), options: ['estimate', 'rigid'] },
    { path: 'preConvert', type: 'check', label: L('f.preConvert'), hint: L('h.preConvert'), show: c => c.scaleMode === 'estimate' },
    { path: 'tsCovariance', type: 'select', label: L('f.tsCovariance'), hint: L('h.tsCovariance'), options: ['full', 'diagonal'] },
    { path: 'constrainRotation', type: 'check', label: L('f.constrainRotation'), hint: L('h.constrainRotation') }
  ],
  reference: [
    { path: 'refSigma.xyMm', type: 'number', label: L('f.refSigmaXY'), hint: L('h.refSigma'), min: 0, step: 0.01 },
    { path: 'refSigma.zMm', type: 'number', label: L('f.refSigmaZ'), min: 0, step: 0.01 },
    { path: 'refSigma.ppmX', type: 'number', label: L('f.refPpmX'), hint: L('h.refPpm'), min: 0, step: 10 },
    { path: 'refSigma.ppmY', type: 'number', label: L('f.refPpmY'), min: 0, step: 10 }
  ],
  checks: [
    { path: 'checkPct', type: 'range', label: L('f.checkPct'), hint: L('h.checkPct'), min: 0, max: 90, step: 5, suffix: '%' },
    { path: 'checkSeed', type: 'number', label: L('f.checkSeed'), min: 1, step: 1 }
  ],
  injunctions: [
    { path: 'injunctions.set', type: 'select', label: L('f.injSet'), hint: L('h.injSet'), options: ['none', 'n8', 'n4', 'all', 'random'] },
    { path: 'injunctions.randomPct', type: 'range', label: L('f.injPct'), min: 5, max: 100, step: 5, suffix: '%', show: c => c.injunctions.set === 'random' },
    { path: 'injunctions.type', type: 'select', label: L('f.injType'), hint: L('h.injType'), options: ['relative', 'absolute'], show: c => c.injunctions.set !== 'none' },
    { path: 'injunctions.factor', type: 'number', label: L('f.injFactor'), hint: L('h.injFactor'), min: 0.01, step: 0.1, show: c => c.injunctions.set !== 'none' && c.injunctions.type === 'relative' },
    { path: 'injunctions.seed', type: 'number', label: L('f.injSeed'), min: 1, step: 1, show: c => c.injunctions.set === 'random' }
  ],
  output: [
    { path: 'outUnit', type: 'select', label: L('f.outUnit'), options: ['mm', 'cm', 'm'], optionLabel: v => v },
    { path: 'varianceFactor', type: 'select', label: L('f.varianceFactor'), hint: L('h.varianceFactor'), options: ['aposteriori', 'apriori'] },
    { path: 'alpha', type: 'select', label: L('f.alpha'), options: [0.01, 0.05, 0.1], optionLabel: v => `${v * 100}%`, numeric: true }
  ]
};

export function renderFields(host, fields, getCfg, onChange, getCtx = () => ({})) {
  host.textContent = '';
  const rows = [];
  for (const f of fields) {
    const row = document.createElement('label'); row.className = `field field-${f.type}`;
    if (f.hint) { row.dataset.label = f.hint; }
    const span = document.createElement('span'); span.dataset.t = f.label; row.append(span);
    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      f.options.forEach(o => { const op = document.createElement('option'); op.value = String(o); if (f.optionLabel) op.textContent = f.optionLabel(o); else op.dataset.t = `o.${o}`; input.append(op); });
    } else {
      input = document.createElement('input');
      input.type = f.type === 'check' ? 'checkbox' : f.type === 'range' ? 'range' : 'number';
      for (const k of ['min', 'max', 'step']) if (f[k] !== undefined) input.setAttribute(k, f[k]);
    }
    input.dataset.path = f.path;
    row.append(input);
    let out = null;
    if (f.type === 'range') { out = document.createElement('output'); row.append(out); }
    const commit = () => {
      const cfg = getCfg();
      let v;
      if (f.type === 'check') v = input.checked;
      else if (f.type === 'select') v = f.numeric ? Number(input.value) : input.value;
      else v = Number(input.value);
      if (f.type === 'number' && !Number.isFinite(v)) return;
      setPath(cfg, f.path, v);
      if (out) out.textContent = `${v}${f.suffix || ''}`;
      onChange(f.path);
      refresh();
    };
    input.addEventListener(f.type === 'range' || f.type === 'select' || f.type === 'check' ? 'change' : 'change', commit);
    if (f.type === 'range') input.addEventListener('input', () => { out.textContent = `${input.value}${f.suffix || ''}`; });
    host.append(row);
    rows.push({ f, row, input, out });
  }
  function refresh() {
    const cfg = getCfg();
    rows.forEach(({ f, row, input, out }) => {
      const v = getPath(cfg, f.path);
      if (f.type === 'check') input.checked = !!v; else input.value = String(v);
      if (out) out.textContent = `${v}${f.suffix || ''}`;
      row.hidden = f.show ? !f.show(cfg, getCtx()) : false;
    });
  }
  applyLanguage(host);
  refresh();
  return { refresh };
}

// ---------------------------------------------------------------- formatting and downloads
export const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
export const fmtSig = (v, s = 4) => (Number.isFinite(v) ? (v === 0 ? '0' : Number(v.toPrecision(s)).toString()) : '—');
export const toMm = (v, unit) => v * UNITS[unit] * 1000;
export const mmFromUnit = toMm;

export function download(name, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const readFile = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file, 'utf-8'); });

// Colours for canvas drawing, read from the CSS tokens so light and dark follow the page
export function theme() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return {
    surface: g('--surface'), ink: g('--ink'), muted: g('--muted'), grid: g('--grid'), line: g('--line'),
    control: g('--c-control'), check: g('--c-check'), uncollected: g('--c-uncollected'), tsOnly: g('--c-tsonly'), accent: g('--accent'), warn: g('--warn')
  };
}

export const ROLE_KEYS = ['control', 'check', 'uncollected', 'tsOnly'];

// Re-draw callback when the OS colour scheme changes
export function onThemeChange(fn) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn); } catch { /* old browsers */ } }

export { t };
