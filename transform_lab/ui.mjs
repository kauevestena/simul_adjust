// Shared by the pages: persisted state, the data sets, schema-driven forms, formatting, downloads.
import { t, L, applyLanguage } from './i18n.mjs';
import { mergeConfig } from './core/pipeline.mjs';
import { simulateDataset, DEFAULT_SIM } from './core/simulate.mjs';
import { buildImported, applyBlunders } from './core/io.mjs';
import { UNITS } from './core/units.mjs';

export const STORE_KEY = 'transform_lab_state_v2';

// The sample files. The real ATV-AJ survey needs a pointing (targeting) error: 2″ at 8 m is only
// 0.08 mm across the line of sight, while a printed cross is pointed to about 0.4 mm.
const INSTRUMENT = { angleSec: 2, mm: 2, ppm: 2 };
export const SAMPLES = {
  atv56: { file: 'data/ATV-AJ_56.csv', instrument: { ...INSTRUMENT, pointingMm: 0.4 } },
  atv70: { file: 'data/ATV-AJ.csv', instrument: { ...INSTRUMENT, pointingMm: 0.4 } },
  sim66: { file: 'data/sample_ts_raw.csv', instrument: { ...INSTRUMENT, pointingMm: 0 } }
};
export const DEFAULT_SAMPLE = 'atv56';
const RAW_OPTS = { format: 'raw', angleFormat: 'deg', renumber: false };

export const defaultState = () => ({
  source: 'import', sample: DEFAULT_SAMPLE, rawText: null, rawName: '', importOpts: { ...RAW_OPTS },
  sim: { ...structuredClone(DEFAULT_SIM), instrument: { ...DEFAULT_SIM.instrument, ...SAMPLES[DEFAULT_SAMPLE].instrument } },
  cfg: mergeConfig({}), blunders: []
});

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && raw.v === 2) {
      const s = defaultState();
      return {
        source: raw.source === 'sim' ? 'sim' : 'import', sample: raw.sample || null, rawText: raw.rawText || null, rawName: raw.rawName || '',
        importOpts: { ...s.importOpts, ...raw.importOpts },
        sim: { ...s.sim, ...raw.sim, instrument: { ...s.sim.instrument, ...raw.sim?.instrument }, reference: { ...s.sim.reference, ...raw.sim?.reference } },
        cfg: mergeConfig(raw.cfg), blunders: Array.isArray(raw.blunders) ? raw.blunders : []
      };
    }
  } catch { /* corrupted or blocked storage */ }
  return defaultState();
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 2, ...state })); } catch { /* quota or blocked */ }
}

// The dataset of a state: the parsed file (or the simulation), then the injected gross errors
export function datasetFrom(state) {
  let dataset, errors = [];
  if (state.source === 'import' && state.rawText) {
    ({ dataset, errors } = buildImported(state.rawText, { ...state.importOpts, refUnit: state.sim.refUnit, tsUnit: state.sim.tsUnit, instrument: state.sim.instrument, name: state.rawName }));
  } else dataset = simulateDataset(state.sim);
  return { dataset: applyBlunders(dataset, state.blunders), errors };
}

export async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// Put a sample file in the state (text, name, import options and its instrument σ)
export function useSample(state, key, text) {
  const s = SAMPLES[key];
  state.source = 'import'; state.sample = key; state.rawText = text; state.rawName = s.file.split('/').pop();
  state.importOpts = { ...RAW_OPTS }; state.sim.refUnit = 'cm'; state.sim.tsUnit = 'm';
  state.sim.instrument = { ...state.sim.instrument, ...s.instrument };
  state.blunders = []; state.cfg.excluded = {}; state.cfg.checkOverride = {};
}

// ---------------------------------------------------------------- paths
export const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, path, v) {
  const ks = path.split('.'); const last = ks.pop();
  const host = ks.reduce((a, k) => (a[k] ??= {}), o);
  host[last] = v;
}

// ---------------------------------------------------------------- forms
// field: { path, type: 'select'|'number'|'range'|'check', label, hint, options, min, max, step, show(cfg, ctx), wide }
const usesInstrument = (c, x) => x.source === 'sim' || x.format !== 'xyz';
export const FIELDS = {
  units: [
    { path: 'refUnit', type: 'select', label: L('f.refUnit'), hint: L('h.units'), options: ['mm', 'cm', 'm'], optionLabel: v => v },
    { path: 'tsUnit', type: 'select', label: L('f.tsUnit'), options: ['mm', 'cm', 'm'], optionLabel: v => v }
  ],
  sim: [
    { path: 'preset', type: 'select', label: L('f.preset'), hint: L('h.preset'), options: ['wall', 'frontal', 'oblique', 'landscape', 'table', 'tableAligned', 'easel'], wide: true },
    { path: 'seed', type: 'number', label: L('f.seed'), min: 1, step: 1 },
    { path: 'distance', type: 'number', label: L('f.distance'), min: 1, max: 100, step: 0.5 },
    { path: 'obliquity', type: 'number', label: L('f.obliquity'), hint: L('h.obliquity'), min: -80, max: 80, step: 5 },
    { path: 'extraPoints', type: 'number', label: L('f.extraPoints'), hint: L('h.extraPoints'), min: 0, max: 10, step: 1 },
    { path: 'collectedPct', type: 'range', label: L('f.collectedPct'), min: 20, max: 100, step: 5, suffix: '%' },
    { path: 'reference.trueSigmaMm', type: 'number', label: L('f.trueSigma'), hint: L('h.trueSigma'), min: 0, step: 0.01, wide: true },
    { path: 'reference.printScalePpmX', type: 'number', label: L('f.truePpmX'), hint: L('h.truePpm'), step: 50 },
    { path: 'reference.printScalePpmY', type: 'number', label: L('f.truePpmY'), step: 50 }
  ],
  instrument: [
    { path: 'instrument.angleSec', type: 'number', label: L('f.angleSec'), min: 0.1, step: 0.1, wide: true, show: usesInstrument },
    { path: 'instrument.mm', type: 'number', label: L('f.edmMm'), min: 0, step: 0.5, show: usesInstrument },
    { path: 'instrument.ppm', type: 'number', label: L('f.edmPpm'), min: 0, step: 0.5, show: usesInstrument },
    { path: 'instrument.pointingMm', type: 'number', label: L('f.pointingMm'), hint: L('h.pointing'), min: 0, step: 0.05, wide: true, show: usesInstrument }
  ],
  workflow: [
    { path: 'method', type: 'select', label: L('f.method'), hint: L('h.method'), options: ['combinado', 'parametrico'], wide: true },
    { path: 'rotation', type: 'select', label: L('f.rotation'), hint: L('h.rotation'), options: ['euler', 'quaternion', 'matrix', 'axisAngle'], wide: true },
    { path: 'scaleMode', type: 'select', label: L('f.scaleMode'), hint: L('h.scaleMode'), options: ['estimate', 'rigid'], wide: true },
    { path: 'checkPct', type: 'range', label: L('f.checkPct'), hint: L('h.checkPct'), min: 0, max: 90, step: 5, suffix: '%' },
    { path: 'injunctions.set', type: 'select', label: L('f.injSet'), hint: L('h.injSet'), options: ['none', 'n8', 'n4', 'all', 'random'], wide: true },
    { path: 'injunctions.type', type: 'select', label: L('f.injType'), hint: L('h.injType'), options: ['relative', 'absolute'], wide: true, show: c => c.injunctions.set !== 'none' }
  ],
  reference: [
    { path: 'refSigma.xyMm', type: 'number', label: L('f.refSigmaXY'), hint: L('h.refSigma'), min: 0, step: 0.01 },
    { path: 'refSigma.zMm', type: 'number', label: L('f.refSigmaZ'), min: 0, step: 0.01 },
    { path: 'refSigma.ppmX', type: 'number', label: L('f.refPpmX'), hint: L('h.refPpm'), min: 0, step: 10 },
    { path: 'refSigma.ppmY', type: 'number', label: L('f.refPpmY'), min: 0, step: 10 }
  ],
  modelAdv: [
    { path: 'tsCovariance', type: 'select', label: L('f.tsCovariance'), hint: L('h.tsCovariance'), options: ['full', 'diagonal'], wide: true },
    { path: 'constrainRotation', type: 'check', label: L('f.constrainRotation'), hint: L('h.constrainRotation') },
    { path: 'preConvert', type: 'check', label: L('f.preConvert'), hint: L('h.preConvert'), show: c => c.scaleMode === 'estimate' }
  ],
  checkInj: [
    { path: 'checkSeed', type: 'number', label: L('f.checkSeed'), min: 1, step: 1 },
    { path: 'injunctions.seed', type: 'number', label: L('f.injSeed'), min: 1, step: 1, show: c => c.injunctions.set === 'random' },
    { path: 'injunctions.randomPct', type: 'range', label: L('f.injPct'), min: 5, max: 100, step: 5, suffix: '%', show: c => c.injunctions.set === 'random' },
    { path: 'injunctions.factor', type: 'number', label: L('f.injFactor'), hint: L('h.injFactor'), min: 0.01, step: 0.1, wide: true, show: c => c.injunctions.set !== 'none' && c.injunctions.type === 'relative' }
  ],
  tests: [
    { path: 'alpha', type: 'select', label: L('f.alpha'), hint: L('h.alpha'), options: [0.01, 0.05, 0.1], optionLabel: v => `${v * 100}%`, numeric: true },
    { path: 'outliers.alpha0', type: 'select', label: L('f.alpha0'), hint: L('h.alpha0'), options: [0.0001, 0.001, 0.01, 0.05], optionLabel: v => `${+(v * 100).toPrecision(3)}%`, numeric: true },
    { path: 'outliers.power', type: 'select', label: L('f.power'), hint: L('h.power'), options: [0.8, 0.9, 0.95], optionLabel: v => `${v * 100}%`, numeric: true },
    { path: 'outliers.k', type: 'number', label: L('f.kSigma'), hint: L('h.kSigma'), min: 1, max: 10, step: 0.1 },
    { path: 'outliers.ransacIters', type: 'number', label: L('f.ransacIters'), min: 50, max: 20000, step: 50 },
    { path: 'outliers.ransacK', type: 'number', label: L('f.ransacK'), hint: L('h.ransacK'), min: 1, max: 100, step: 0.5 },
    { path: 'outliers.ransacSeed', type: 'number', label: L('f.ransacSeed'), min: 1, step: 1 }
  ],
  output: [
    { path: 'outUnit', type: 'select', label: L('f.outUnit'), options: ['mm', 'cm', 'm'], optionLabel: v => v },
    { path: 'varianceFactor', type: 'select', label: L('f.varianceFactor'), hint: L('h.varianceFactor'), options: ['aposteriori', 'apriori'], wide: true }
  ]
};

// Builds the fields into `host`. Changing one writes it into getCfg() and calls onChange(path):
// nothing is computed here, the pages decide what a change means.
export function renderFields(host, fields, getCfg, onChange, getCtx = () => ({})) {
  host.textContent = '';
  const rows = [];
  for (const f of fields) {
    const row = document.createElement(f.type === 'check' ? 'label' : 'label');
    row.className = `fld fld-${f.type}${f.wide ? ' wide' : ''}`;
    if (f.hint) row.dataset.label = f.hint;
    const span = document.createElement('span'); span.className = 'field-label'; span.dataset.tHtml = f.label;
    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      f.options.forEach(o => { const op = document.createElement('option'); op.value = String(o); if (f.optionLabel) op.textContent = f.optionLabel(o); else op.dataset.t = `o.${o}`; input.append(op); });
    } else {
      input = document.createElement('input');
      input.type = f.type === 'check' ? 'checkbox' : f.type === 'range' ? 'range' : 'number';
      for (const k of ['min', 'max', 'step']) if (f[k] !== undefined) input.setAttribute(k, f[k]);
    }
    if (f.type !== 'check' && f.type !== 'range') input.className = 'field';
    input.dataset.path = f.path;
    // the label and, when the field has a hint (tooltip), an ⓘ beside it
    const head = document.createElement('span'); head.className = 'fld-head'; head.append(span);
    if (f.hint) { const i = document.createElement('span'); i.className = 'info'; i.textContent = 'ⓘ'; i.setAttribute('aria-hidden', 'true'); head.append(i); }
    let out = null;
    if (f.type === 'check') row.append(input, head);
    else if (f.type === 'range') {
      const top = document.createElement('span'); top.className = 'range-head';
      out = document.createElement('output');
      top.append(head, out); row.append(top, input);
    } else row.append(head, input);
    const commit = () => {
      const cfg = getCfg();
      let v;
      if (f.type === 'check') v = input.checked;
      else if (f.type === 'select') v = f.numeric ? Number(input.value) : input.value;
      else v = Number(input.value);
      if (f.type === 'number' && !Number.isFinite(v)) return;
      setPath(cfg, f.path, v);
      if (out) out.textContent = `${v}${f.suffix || ''}`;
      onChange(f.path, v);
      refresh();
    };
    input.addEventListener('change', commit);
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
export const ARCSEC_PER_RAD = 206264.806;

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
    surface: g('--panel'), panel: g('--panel'), ink: g('--ink'), muted: g('--muted'), faint: g('--faint'), grid: g('--grid'), axis: g('--axis'), line: g('--line'),
    control: g('--c-control'), check: g('--c-check'), uncollected: g('--c-uncollected'), tsOnly: g('--c-tsonly'), excluded: g('--c-excluded'), flag: g('--c-flag'),
    neg: g('--c-neg'), pos: g('--c-pos'), mid: g('--c-mid'), plane: g('--c-plane'), ellipsoid: g('--c-ellipsoid'), accent: g('--accent'), warn: g('--warn'), amber: g('--amber')
  };
}

export const ROLE_KEYS = ['control', 'check', 'excluded', 'uncollected', 'tsOnly'];

// Re-draw callback when the OS colour scheme changes
export function onThemeChange(fn) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn); } catch { /* old browsers */ } }

export { t };
