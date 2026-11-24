// Controller: project state, undo/redo, terrain heights, map events and panels.
import { t, num, setLanguage, initialLanguage } from './i18n.mjs';
import { analyze, externalEffect } from './model/analysis.mjs';
import { emptyProject, makePoint, makeSession, makeBaseline, serialize, deserialize, nextId, uniqueBaselineId, removePoint,
  removeSession, clone, SESSION_COLORS, validateProject, LIMITS } from './model/network.mjs';
import { PRESETS, validateSettings } from './model/stochastic.mjs';
import { loadDataset, parseCorsCsv, parseCorsGeoJson } from './model/cors.mjs';
import { buildExample, EXAMPLE_IDS } from './model/examples.mjs';
import { createTerrarium } from '../shared/terrarium.mjs';
import { createMapView } from './map.mjs';
import { ellipseRing, offset, CONFIDENCE_2D, redundancyColor } from './geometry.mjs';
import { esc, summaryHtml, pointHtml, baselineHtml, stationHtml, sessionsHtml } from './inspector.mjs';

const $ = id => document.getElementById(id);
const state = {
  project: emptyProject(), stations: [], dataset: null, tool: 'select', activeSession: 'S1', selection: null, pendingFrom: null,
  view: { labels: true, ellipses: true, precisionLabels: false, redundancyColor: false, cors: true, corsInactive: false,
    hillshade: true, snap: true, snapPx: 16, confidence: '1sigma', exaggeration: 100000, autoExaggeration: true },
  effect: null, comparison: null, busy: 0,
};
let result = analyze(state.project), view = null, readyResolve;
const undoStack = [], redoStack = [], terrain = createTerrarium();
export const ready = new Promise(r => { readyResolve = r; });
export const getState = () => state;
export const getResult = () => result;
export const getProject = () => state.project;
export const isBusy = () => state.busy > 0;
export const getView = () => view;

function showError(code, values = {}) {
  const el = $('error');
  if (!code) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false; el.textContent = t(code, values); el.dataset.code = code; el.classList.toggle('info', code === 'imported');
}

// ---------- project edits ----------
function commit(mutate, { history = true } = {}) {
  const draft = clone(state.project);
  try { mutate(draft); validateProject(draft); } catch (error) { showError(error.message); return false; }
  if (history) { undoStack.push(state.project); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
  state.project = draft; showError(null);
  if (!draft.sessions.some(s => s.id === state.activeSession)) state.activeSession = draft.sessions[0].id;
  if (state.selection?.type === 'point' && !draft.points.some(p => p.id === state.selection.id)) state.selection = null;
  if (state.selection?.type === 'baseline' && !draft.baselines.some(b => b.id === state.selection.id)) state.selection = null;
  recompute();
  return true;
}
function undo() { if (!undoStack.length) return; redoStack.push(state.project); state.project = undoStack.pop(); afterReplace(); }
function redo() { if (!redoStack.length) return; undoStack.push(state.project); state.project = redoStack.pop(); afterReplace(); }
function afterReplace() {
  if (!state.project.sessions.some(s => s.id === state.activeSession)) state.activeSession = state.project.sessions[0].id;
  state.selection = null; state.pendingFrom = null; state.effect = null; recompute(); fillHeights();
}
function replaceProject(project, { fit = true } = {}) {
  state.project = project; undoStack.length = 0; redoStack.length = 0;
  state.activeSession = project.sessions[0].id; state.selection = null; state.pendingFrom = null; state.effect = null; state.comparison = null;
  syncSettingsForm(); recompute(); if (fit) view?.fit?.(project.points); fillHeights();
}
const fallbackHeight = p => { const hs = p.points.filter(x => ['cors', 'terrain', 'manual'].includes(x.hSource)).map(x => x.h); return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0; };

async function fillHeights() {
  const pending = state.project.points.filter(p => p.hSource === 'pending');
  if (!pending.length) return;
  state.busy++; renderBusy();
  const n0 = state.project.settings.geoidUndulation;
  const samples = await Promise.all(pending.map(p => terrain.sample(p.lon, p.lat).then(H => ({ id: p.id, lat: p.lat, lon: p.lon, H }), () => ({ id: p.id, lat: p.lat, lon: p.lon, H: null }))));
  state.busy--; renderBusy();
  let failed = false;
  const patch = project => {
    for (const s of samples) {
      const p = project.points.find(x => x.id === s.id && x.lat === s.lat && x.lon === s.lon && x.hSource === 'pending');
      if (!p) continue;
      if (s.H === null) { p.hSource = 'missing'; failed = true; } else { p.H = s.H; p.h = s.H + n0; p.hSource = 'terrain'; }
    }
  };
  // Heights complete the edit that created the point; points moved again meanwhile are left pending.
  patch(state.project);
  if (failed) showError('terrainMissing');
  recompute();
}

function sessionColor(id) { const s = state.project.sessions.find(x => x.id === id); return SESSION_COLORS[(s?.color ?? 0) % SESSION_COLORS.length]; }
function stationById(id) { return state.stations.find(s => s.id === id); }
function visibleStations() {
  const inNetwork = new Set(state.project.points.map(p => p.corsId).filter(Boolean));
  return state.stations.filter(s => !inNetwork.has(s.id) && (s.status !== 'inactive' || state.view.corsInactive));
}
function addStation(id) {
  const existing = state.project.points.find(p => p.corsId === id);
  if (existing) return existing.id;
  const s = stationById(id);
  if (!s) return null;
  let pid = s.id;
  if (state.project.points.some(p => p.id === pid)) pid = nextId(`${s.id}_`, state.project.points.map(p => p.id));
  const ok = commit(p => { p.points.push(makePoint({ id: pid, label: s.id, lat: s.lat, lon: s.lon, h: s.h, hSource: 'cors', kind: 'cors', corsId: s.id })); });
  return ok ? pid : null;
}
function snapStation(lngLat) {
  if (!state.view.snap || !view?.available) return null;
  let best = null, distance = Infinity;
  for (const s of visibleStations()) {
    const d = view.screenDistance([s.lon, s.lat], [lngLat.lng, lngLat.lat]);
    if (d < distance) { distance = d; best = s; }
  }
  return best && distance <= state.view.snapPx ? best : null;
}
function addPointAt(lngLat) {
  if (state.project.points.length >= LIMITS.points) { showError('invalidProject'); return; }
  const station = snapStation(lngLat);
  if (station) { const id = addStation(station.id); if (id) select({ type: 'point', id }); return; }
  let id;
  const ok = commit(p => {
    id = nextId('P', p.points.map(x => x.id));
    p.points.push(makePoint({ id, lat: +lngLat.lat.toFixed(8), lon: +lngLat.lng.toFixed(8), h: fallbackHeight(p), hSource: 'pending' }));
  });
  if (ok) { state.selection = { type: 'point', id }; render(); fillHeights(); }
}
function createBaseline(a, b) {
  if (a === b) { showError('sameEndpoint'); return; }
  const session = state.activeSession;
  if (state.project.baselines.some(x => x.session === session && ((x.from === a && x.to === b) || (x.from === b && x.to === a)))) { showError('duplicateBaseline'); return; }
  let id;
  const ok = commit(p => { id = uniqueBaselineId(p, a, b, session); p.baselines.push(makeBaseline(a, b, session, id)); });
  if (ok) { state.pendingFrom = null; state.selection = { type: 'baseline', id }; render(); }
}
function pickForBaseline(id) {
  if (!state.pendingFrom) { state.pendingFrom = id; render(); return; }
  createBaseline(state.pendingFrom, id);
}
function deletePoint(id) { commit(p => removePoint(p, id)); }
function deleteBaseline(id) { commit(p => { p.baselines = p.baselines.filter(b => b.id !== id); }); }
function select(selection) {
  state.selection = selection; state.effect = null;
  if (selection && innerWidth <= 700 && $('workspace').classList.contains('panel-hidden')) {
    $('workspace').classList.remove('panel-hidden'); $('toggle-panel').setAttribute('aria-expanded', 'true');
  }
  render();
  $('inspector').scrollTop = 0;
}

// ---------- map callbacks ----------
const callbacks = {
  onReady() { view.setHillshade(state.view.hillshade); renderMap(); view.fit(state.project.points); readyResolve?.(); },
  onStyle() { view.setHillshade(state.view.hillshade); renderMap(); },
  onUnavailable() { $('map-fallback').hidden = false; readyResolve?.(); },
  onTerrainError() {},
  onMarkerClick(id) {
    if (state.tool === 'baseline') pickForBaseline(id);
    else if (state.tool === 'delete') deletePoint(id);
    else select({ type: 'point', id });
  },
  onMarkerDragEnd(id, ll) {
    const ok = commit(p => { const x = p.points.find(q => q.id === id); x.lat = +ll.lat.toFixed(8); x.lon = +ll.lng.toFixed(8); x.hSource = 'pending'; delete x.H; });
    if (ok) fillHeights();
  },
  onMapClick({ lngLat, stationId, baselineId }) {
    if (state.tool === 'point') return addPointAt(lngLat);
    if (state.tool === 'baseline') {
      const station = stationId || snapStation(lngLat)?.id;
      if (station) { const id = addStation(station); if (id) pickForBaseline(id); }
      return;
    }
    if (state.tool === 'delete') { if (baselineId) deleteBaseline(baselineId); return; }
    if (baselineId) select({ type: 'baseline', id: baselineId });
    else if (stationId) select({ type: 'station', id: stationId });
    else select(null);
  },
  onMouseMove(lngLat) {
    if (state.tool !== 'baseline' || !state.pendingFrom) return;
    const a = state.project.points.find(p => p.id === state.pendingFrom);
    if (a) view.setSource('rubber', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [lngLat.lng, lngLat.lat]] } }] });
  },
};

// ---------- rendering ----------
function recompute() { result = analyze(state.project); autoExaggeration(); render(); }
/** 1-2-5 exaggeration so that the largest (scaled) ellipse is about 10% of the network extent. */
export function niceExaggeration(extentMetres, largest) {
  if (!(extentMetres > 0 && largest > 0)) return null;
  const raw = 0.1 * extentMetres / largest, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return Math.min(1e7, Math.max(1, (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p));
}
function autoExaggeration() {
  if (!state.view.autoExaggeration || !result.solvable) return;
  const pts = state.project.points.filter(p => result.points[p.id]?.used);
  if (pts.length < 2) return;
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const dx = (Math.max(...pts.map(p => p.lon)) - Math.min(...pts.map(p => p.lon))) * 111320 * k;
  const dy = (Math.max(...pts.map(p => p.lat)) - Math.min(...pts.map(p => p.lat))) * 110570;
  const scale = CONFIDENCE_2D[state.view.confidence], value = niceExaggeration(Math.hypot(dx, dy), result.worstHorizontal * scale);
  if (value) { state.view.exaggeration = value; const input = document.getElementById('exaggeration'); if (input) input.value = value; }
}
function render() { renderMap(); renderPanels(); renderFooter(); renderCaption(); renderTools(); }
function renderBusy() { $('busy').hidden = state.busy === 0; }
function renderTools() {
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool)));
  $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length;
  const select = $('active-session');
  select.innerHTML = state.project.sessions.map(s => `<option value="${esc(s.id)}">${esc(s.label || s.id)}</option>`).join('');
  select.value = state.activeSession;
}
function renderCaption() {
  const titles = { select: 'select', point: 'point', baseline: 'baseline', delete: 'delete' };
  $('mode-title').textContent = t(titles[state.tool]);
  const hints = { select: 'selectHint', point: 'pointHint', delete: 'deleteHint', baseline: state.pendingFrom ? 'baselineTargetHint' : 'baselineHint' };
  const session = state.project.sessions.find(s => s.id === state.activeSession);
  $('hint').textContent = t(hints[state.tool], { session: session?.label || state.activeSession });
}
function renderMap() {
  if (!view?.available) return;
  const p = state.project, used = id => result.points[id]?.used;
  view.setMarkers(p.points.map(pt => {
    const r = result.precision[pt.id], conf = CONFIDENCE_2D[state.view.confidence];
    const sub = state.view.precisionLabels && r ? `${num(r.ellipse.major * conf * 1000, 1)} / ${num(r.sigma[2] * 1000, 1)} mm` : '';
    const classes = [pt.kind === 'cors' || pt.control === 'fixed' ? 'cors' : '', pt.control === 'stochastic' ? 'stochastic' : '',
      state.selection?.type === 'point' && state.selection.id === pt.id ? 'selected' : '', state.pendingFrom === pt.id ? 'pending-from' : '',
      used(pt.id) ? '' : 'isolated'].filter(Boolean).join(' ');
    return { id: pt.id, lat: pt.lat, lon: pt.lon, classes, tag: state.view.labels ? (pt.label || pt.id) : '', sub,
      aria: `${pt.label || pt.id} · ${t(pt.kind === 'cors' ? 'kindCors' : 'kindNew')}`, draggable: pt.kind === 'new' };
  }), { draggable: state.tool === 'select' });
  const corsFeatures = state.view.cors ? visibleStations().map(s => ({ type: 'Feature', properties: { id: s.id, status: s.status },
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })) : [];
  view.setSource('cors', { type: 'FeatureCollection', features: corsFeatures });
  const byId = new Map(p.points.map(x => [x.id, x]));
  view.setSource('baselines', { type: 'FeatureCollection', features: p.baselines.filter(b => b.active).map(b => {
    const info = result.baselines[b.id] || {}, a = byId.get(b.from), c = byId.get(b.to);
    const color = state.view.redundancyColor ? redundancyColor(info.redundancyMean) : sessionColor(b.session);
    return { type: 'Feature', properties: { id: b.id, color, trivial: Boolean(info.trivial), included: info.included !== false,
      selected: state.selection?.type === 'baseline' && state.selection.id === b.id }, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [c.lon, c.lat]] } };
  }) });
  const scale = CONFIDENCE_2D[state.view.confidence] * state.view.exaggeration;
  view.setSource('ellipses', { type: 'FeatureCollection', features: state.view.ellipses && result.solvable ? Object.entries(result.precision).map(([id, r]) => {
    const pt = byId.get(id);
    return { type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [ellipseRing(pt.lat, pt.lon, r.ellipse.major * scale, r.ellipse.minor * scale, r.ellipse.azimuth)] } };
  }) : [] });
  let effectFeatures = [];
  if (state.effect) {
    const e = externalEffect(result, p, state.effect.baselineId, state.effect.axis);
    if (e) effectFeatures = Object.entries(e.points).map(([id, d]) => {
      const pt = byId.get(id);
      return { type: 'Feature', properties: { id }, geometry: { type: 'LineString', coordinates: [[pt.lon, pt.lat], offset(pt.lat, pt.lon, d[0] * state.view.exaggeration, d[1] * state.view.exaggeration)] } };
    });
  }
  view.setSource('effect', { type: 'FeatureCollection', features: effectFeatures });
  if (state.tool !== 'baseline' || !state.pendingFrom) view.setSource('rubber', { type: 'FeatureCollection', features: [] });
  const legend = [`<div><i class="lg-new"></i>${esc(t('legendNew'))}</div>`, `<div><i class="lg-fixed"></i>${esc(t('legendFixed'))}</div>`,
    `<div><i class="lg-stoch"></i>${esc(t('legendStochastic'))}</div>`, `<div><i class="lg-cors"></i>${esc(t('legendCors'))}</div>`,
    `<div><i class="lg-trivial"></i>${esc(t('legendTrivial'))}</div>`,
    `<div>${esc(t('legendEllipse', { x: num(state.view.exaggeration, 0), conf: state.view.confidence === '95' ? '95%' : '1σ' }))}</div>`];
  if (state.view.redundancyColor) legend.push(`<div>${esc(t('legendRedundancy'))}</div>`);
  $('map-legend').innerHTML = legend.join('');
}
function metric(label, value) { return `<span>${esc(label)}<b>${value}</b></span>`; }
function metrics() {
  return { h: result.worstHorizontal, u: result.worstVertical, dof: result.dof, r: result.minimumRedundancy };
}
function renderFooter() {
  const status = $('status'), empty = !result.includedCount;
  status.textContent = empty ? t('empty') : result.solvable ? t('solved') : t('unsolved');
  status.className = result.solvable ? '' : 'bad';
  const mm = x => Number.isFinite(x) ? `${num(x * 1000, 1)} mm` : '—';
  $('metrics').innerHTML = [metric(t('points'), state.project.points.length),
    metric(t('baselines'), `${state.project.baselines.length}${result.trivialCount ? ` (${result.trivialCount} ${esc(t('trivialCount'))})` : ''}`),
    metric(t('sessions'), state.project.sessions.length), metric(t('observations'), result.rows.length),
    metric(t('unknowns'), result.parameters.length), metric(t('dof'), result.dof), metric(t('worstH'), mm(result.worstHorizontal)),
    metric(t('worstU'), mm(result.worstVertical)), metric(t('lowestR'), Number.isFinite(result.minimumRedundancy) ? num(result.minimumRedundancy, 2) : '—')].join('');
  const cmp = $('comparison');
  if (state.comparison) {
    const now = metrics(), was = state.comparison, mmv = x => Number.isFinite(x) ? num(x * 1000, 1) : '—';
    cmp.hidden = false;
    cmp.textContent = `${t('comparison')}: ${t('worstH')} ${mmv(was.h)} → ${mmv(now.h)} mm · ${t('worstU')} ${mmv(was.u)} → ${mmv(now.u)} mm · ${t('dof')} ${was.dof} → ${now.dof}`;
  } else cmp.hidden = true;
}
function renderPanels() {
  const sel = state.selection, p = state.project, ctx = $('context');
  if (sel?.type === 'point' && p.points.some(x => x.id === sel.id)) ctx.innerHTML = pointHtml(p.points.find(x => x.id === sel.id), p, result, state.view);
  else if (sel?.type === 'baseline' && p.baselines.some(x => x.id === sel.id)) ctx.innerHTML = baselineHtml(p.baselines.find(x => x.id === sel.id), p, result, state.view);
  else if (sel?.type === 'station' && stationById(sel.id)) ctx.innerHTML = stationHtml(stationById(sel.id), p);
  else ctx.innerHTML = summaryHtml(p, result);
  bindContext();
  $('session-list').innerHTML = sessionsHtml(p, result, state.activeSession);
  if (state.effect) {
    const e = externalEffect(result, p, state.effect.baselineId, state.effect.axis), note = $('effect-note');
    if (e && note) note.textContent = t('effectShown', { value: `${num(Math.max(...Object.values(e.points).map(d => Math.hypot(d[0], d[1], d[2]))) * 1000, 1)} mm` });
  }
}
const numberOf = id => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
function bindContext() {
  const sel = state.selection;
  $('apply-point')?.addEventListener('click', () => {
    const id = sel.id, sigma = [0, 1, 2].map(i => Number($(`p-sigma-${i}`).value));
    const lat = Number($('p-lat').value), lon = Number($('p-lon').value), h = Number($('p-h').value);
    const sc = numberOf('p-setup-c'), sh = numberOf('p-setup-h');
    if (![lat, lon, h].every(Number.isFinite) || [sc, sh].some(x => x !== null && !Number.isFinite(x))) { showError('invalidNumber'); return; }
    commit(project => {
      const pt = project.points.find(x => x.id === id), moved = pt.lat !== lat || pt.lon !== lon;
      pt.label = $('p-label').value.trim() || pt.id; pt.control = $('p-control').value; pt.sigmaControl = sigma;
      pt.setup = sc === null && sh === null ? null : { centering: sc ?? project.settings[pt.kind === 'cors' ? 'setupCors' : 'setupNew'].centering, height: sh ?? project.settings[pt.kind === 'cors' ? 'setupCors' : 'setupNew'].height };
      if (pt.kind === 'new') {
        if (moved) { pt.lat = lat; pt.lon = lon; pt.hSource = 'pending'; delete pt.H; }
        else if (Math.abs(pt.h - h) > 5e-4) { pt.h = h; pt.hSource = 'manual'; delete pt.H; }
      }
    }) && fillHeights();
  });
  $('p-control')?.addEventListener('change', e => { $('p-sigma').hidden = e.target.value !== 'stochastic'; });
  $('delete-point')?.addEventListener('click', () => deletePoint(sel.id));
  $('delete-baseline')?.addEventListener('click', () => deleteBaseline(sel.id));
  $('b-session')?.addEventListener('change', e => commit(p => { p.baselines.find(b => b.id === sel.id).session = e.target.value; }));
  $('b-active')?.addEventListener('change', e => commit(p => { p.baselines.find(b => b.id === sel.id).active = e.target.checked; }));
  document.querySelectorAll('#context [data-effect]').forEach(b => b.addEventListener('click', () => { state.effect = { baselineId: sel.id, axis: Number(b.dataset.effect) }; render(); }));
  document.querySelectorAll('#context [data-baseline]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); select({ type: 'baseline', id: a.dataset.baseline }); }));
  $('add-station')?.addEventListener('click', e => { const id = addStation(e.target.dataset.id); if (id) select({ type: 'point', id }); });
}

// ---------- settings form ----------
function syncSettingsForm() {
  const s = state.project.settings;
  $('preset').value = s.preset;
  for (const k of ['aH', 'bH', 'aV', 'bV']) $(k).value = s[k];
  $('combination').value = s.combination; $('horizontal').value = s.horizontal; $('frequency').value = s.frequency;
  $('new-c').value = s.setupNew.centering; $('new-h').value = s.setupNew.height; $('cors-c').value = s.setupCors.centering; $('cors-h').value = s.setupCors.height;
  $('session-correlation').checked = s.sessionCorrelation; $('trivial').value = s.trivial;
  $('alpha').value = s.statistics.alpha; $('power').value = s.statistics.power; $('geoid').value = s.geoidUndulation;
  renderPresetNote();
}
function renderPresetNote() {
  const keys = { static: 'presetStatic', hpStatic: 'presetHpStatic', rtk: 'presetRtk', ibge2008: 'presetIbge', custom: 'presetCustom' };
  $('preset-note').textContent = `${t(keys[state.project.settings.preset])} ${t('formula')}`;
}
function settingsEdit(mutate) {
  const ok = commit(p => { mutate(p.settings, p); validateSettings(p.settings); });
  if (!ok) syncSettingsForm(); else renderPresetNote();
}
function bindSettings() {
  $('preset').addEventListener('change', e => settingsEdit(s => { s.preset = e.target.value; if (PRESETS[s.preset]) { const { aH, bH, aV, bV } = PRESETS[s.preset]; Object.assign(s, { aH, bH, aV, bV }); } }) || syncSettingsForm());
  for (const k of ['aH', 'bH', 'aV', 'bV']) $(k).addEventListener('change', e => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || e.target.value === '') { showError('invalidNumber'); syncSettingsForm(); return; }
    settingsEdit(s => { s[k] = value; s.preset = 'custom'; });
    syncSettingsForm();
  });
  const pick = (id, key) => $(id).addEventListener('change', e => settingsEdit(s => { s[key] = e.target.value; }));
  pick('combination', 'combination'); pick('horizontal', 'horizontal'); pick('frequency', 'frequency'); pick('trivial', 'trivial');
  $('session-correlation').addEventListener('change', e => settingsEdit(s => { s.sessionCorrelation = e.target.checked; }));
  const setup = (id, group, key) => $(id).addEventListener('change', e => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || e.target.value === '') { showError('invalidNumber'); syncSettingsForm(); return; }
    settingsEdit(s => { s[group] = { ...s[group], [key]: value }; });
  });
  setup('new-c', 'setupNew', 'centering'); setup('new-h', 'setupNew', 'height'); setup('cors-c', 'setupCors', 'centering'); setup('cors-h', 'setupCors', 'height');
  const stat = (id, key) => $(id).addEventListener('change', e => settingsEdit(s => { s.statistics = { ...s.statistics, [key]: Number(e.target.value) }; }));
  stat('alpha', 'alpha'); stat('power', 'power');
  $('geoid').addEventListener('change', e => {
    const n0 = Number(e.target.value);
    settingsEdit((s, p) => { s.geoidUndulation = n0; p.points.forEach(x => { if (x.hSource === 'terrain' && Number.isFinite(x.H)) x.h = x.H + n0; }); });
  });
  const viewToggle = (id, key, after) => $(id).addEventListener('change', e => { state.view[key] = e.target.checked; after?.(); render(); });
  viewToggle('labels', 'labels'); viewToggle('ellipses', 'ellipses'); viewToggle('precision-labels', 'precisionLabels');
  viewToggle('redundancy-color', 'redundancyColor'); viewToggle('cors-layer', 'cors'); viewToggle('cors-inactive', 'corsInactive');
  viewToggle('hillshade', 'hillshade', () => view?.setHillshade?.(state.view.hillshade)); viewToggle('snap', 'snap');
  $('confidence').addEventListener('change', e => { state.view.confidence = e.target.value; autoExaggeration(); render(); });
  $('exaggeration').addEventListener('change', e => {
    const v = Number(e.target.value);
    if (v >= 1 && v <= 1e7) { state.view.exaggeration = v; state.view.autoExaggeration = false; $('auto-exaggeration').checked = false; render(); }
    else e.target.value = state.view.exaggeration;
  });
  $('auto-exaggeration').addEventListener('change', e => { state.view.autoExaggeration = e.target.checked; autoExaggeration(); render(); });
  $('snap-px').addEventListener('change', e => { const v = Number(e.target.value); if (v >= 2 && v <= 60) state.view.snapPx = v; else e.target.value = state.view.snapPx; });
  $('session-list').addEventListener('change', e => {
    const card = e.target.closest('[data-session]'), field = e.target.dataset.field;
    if (!card || !field) return;
    const id = card.dataset.session, value = field === 'duration' ? Number(e.target.value) : e.target.value.trim();
    commit(p => { const s = p.sessions.find(x => x.id === id); s[field] = field === 'label' ? (value || id) : value; });
  });
  $('session-list').addEventListener('click', e => {
    const button = e.target.closest('[data-action]'), card = e.target.closest('[data-session]');
    if (!button || !card) return;
    if (button.dataset.action === 'activate') { state.activeSession = card.dataset.session; render(); }
    if (button.dataset.action === 'remove') commit(p => removeSession(p, card.dataset.session));
  });
}
function addSession() {
  commit(p => {
    const id = nextId('S', p.sessions.map(s => s.id));
    p.sessions.push(makeSession(id, id, p.sessions.at(-1)?.duration ?? 60, p.sessions.length % SESSION_COLORS.length));
    state.activeSession = id;
  });
}

// ---------- files ----------
function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
function fullMatrix(blocks, m) {
  const out = Array.from({ length: m }, () => Array(m).fill(0));
  for (const b of blocks) for (let i = 0; i < b.size; i++) for (let j = 0; j < b.size; j++) out[b.start + i][b.start + j] = b.q[i][j];
  return out;
}
function matrices() {
  const m = result.rows.length, Q = result.blocks ? fullMatrix(result.blocks, m) : [];
  const P = result.blocks ? fullMatrix(result.blocks.map(b => ({ ...b, q: b.p })), m) : [];
  return { parameters: result.parameters.map(p => `${p.id}.${p.axis}`), observations: result.rows.map(r => r.source === 'control' ? `${r.pointId}.${r.axis} (control)` : `${r.from}→${r.to}@${r.session}.Δ${r.axis}`),
    A: result.A ?? [], Q, P, N: result.N ?? [], S: result.covariance ?? [] };
}
function renderMatrix() {
  const all = matrices(), key = $('matrix-choice').value, M = all[key] || [];
  const fmt = x => (Math.abs(x) < 1e-15 ? '0' : Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3 ? x.toExponential(3) : x.toFixed(4)).padStart(11);
  $('matrix-content').textContent = M.length ? M.slice(0, 40).map(r => r.slice(0, 40).map(fmt).join(' ')).join('\n') : '—';
  $('matrix-order').textContent = `${t('unknowns')}: ${all.parameters.join(', ')}\n${t('observations')}: ${all.observations.join(', ')}`;
}

// ---------- startup ----------
function setTool(tool) { state.tool = tool; state.pendingFrom = null; render(); }
function bindUi() {
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang, () => { syncSettingsForm(); render(); })));
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);
  $('fit').addEventListener('click', () => view?.fit?.(state.project.points));
  $('add-session').addEventListener('click', addSession);
  $('active-session').addEventListener('change', e => { state.activeSession = e.target.value; render(); });
  $('clear-selection').addEventListener('click', () => select(null));
  $('toggle-panel').addEventListener('click', () => {
    const hidden = $('workspace').classList.toggle('panel-hidden');
    $('toggle-panel').setAttribute('aria-expanded', String(!hidden)); setTimeout(() => view?.map?.resize(), 0);
  });
  $('example').addEventListener('change', e => loadExample(e.target.value));
  $('basemap').addEventListener('change', e => view?.setBasemap?.(e.target.value));
  $('save').addEventListener('click', () => download('gnss-preanalysis.json', serialize(state.project)));
  $('load').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try { replaceProject(deserialize(await file.text())); } catch (error) { showError(error.message); }
  });
  $('import-cors').addEventListener('click', () => $('cors-file').click());
  $('cors-file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text(), list = /\.(geo)?json$/i.test(file.name) || text.trim().startsWith('{') ? parseCorsGeoJson(text) : parseCorsCsv(text);
      const ids = new Set(list.map(s => s.id));
      state.stations = [...state.stations.filter(s => !ids.has(s.id)), ...list];
      showError('imported', { count: list.length }); render();
      if (list.length && view?.available) view.fit(list);
    } catch { showError('invalidCors'); }
  });
  $('pin').addEventListener('click', () => { state.comparison = metrics(); renderFooter(); });
  $('matrices').addEventListener('click', () => { renderMatrix(); $('matrix-dialog').showModal(); });
  $('matrix-choice').addEventListener('change', renderMatrix);
  $('matrix-save').addEventListener('click', () => download('gnss-preanalysis-matrices.json', JSON.stringify(matrices())));
  $('clear-effect').addEventListener('click', () => { state.effect = null; render(); });
  $('help').addEventListener('click', () => $('help-dialog').showModal());
  $('theory').addEventListener('click', () => $('theory-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === 'Escape' && state.pendingFrom) { state.pendingFrom = null; render(); }
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection) {
      if (state.selection.type === 'point') deletePoint(state.selection.id); else if (state.selection.type === 'baseline') deleteBaseline(state.selection.id);
    }
  });
  bindSettings();
}
function loadExample(name) {
  $('example').value = name;
  if (name === 'empty' || !state.stations.length) { replaceProject(emptyProject(), { fit: false }); if (name === 'empty') view?.fit?.(state.stations); return; }
  try { replaceProject(buildExample(name, state.stations)); } catch (error) { showError(error.message); replaceProject(emptyProject(), { fit: false }); }
}

async function main() {
  setLanguage(initialLanguage());
  bindUi(); syncSettingsForm();
  if (innerWidth <= 700) { $('workspace').classList.add('panel-hidden'); $('toggle-panel').setAttribute('aria-expanded', 'false'); }
  try { const data = await loadDataset(); state.dataset = data.metadata; state.stations = data.stations; } catch { showError('corsMissing'); }
  view = createMapView($('map'), callbacks);
  const requested = new URLSearchParams(location.search).get('example');
  loadExample(EXAMPLE_IDS.includes(requested) || requested === 'empty' ? requested : 'network');
  if (!view.available) { $('map-fallback').hidden = false; readyResolve?.(); }
  window.__gnss = { getState, getResult, getProject, isBusy, getView, ready, setTool, addPointAt, createBaseline, addStation, loadExample, undo, redo };
}
main();
