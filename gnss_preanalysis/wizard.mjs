// Three-step import wizard (file → columns → import) in a floating, non-modal panel: the map stays
// visible and previews the valid stations while the mapping changes.
import { t, num } from './i18n.mjs';
import { parseSource, parseDelimited, guessMapping, buildStations, sanitizeId } from './model/importer.mjs';
import { esc } from './inspector.mjs';

const FIELDS = ['id', 'name', 'lat', 'lon', 'h', 'status'];
export const DELIMITERS = [['auto', 'delimAuto'], [',', 'delimComma'], [';', 'delimSemicolon'], ['\t', 'delimTab'], ['|', 'delimPipe'], ['space', 'delimSpace']];
const MAX_FILE = 5e6;

export function createImportWizard(host) {
  const $ = id => document.getElementById(id), dialog = $('import-dialog');
  const w = { step: 1, text: '', fileName: '', source: null, mapping: null, result: null, plan: null, delimiter: 'auto', header: 'auto', busy: false, bbox: '' };

  function error(code, values) { const el = $('import-error'); el.hidden = !code; el.textContent = code ? t(code, values) : ''; }
  function setStep(step) {
    w.step = step;
    dialog.querySelectorAll('[data-panel]').forEach(p => { p.hidden = Number(p.dataset.panel) !== step; });
    dialog.querySelectorAll('[data-step]').forEach(li => {
      const n = Number(li.dataset.step);
      li.classList.toggle('current', n === step); li.classList.toggle('done', n < step);
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('import-back').hidden = step === 1; $('import-read').hidden = step !== 1; $('import-next').hidden = step !== 2; $('import-run').hidden = step !== 3;
    error(null);
    refresh();
  }
  function refresh() {
    if (w.step === 1) renderCurrent();
    if (w.step === 2 && w.source) renderMapping();
    if (w.step === 3 && w.result) renderFinal();
  }
  function renderCurrent() {
    const count = host.importedCount();
    $('import-current').innerHTML = count ? `<p class="note">${esc(t('importCurrent', { count }))}</p><button id="import-remove" class="danger">${esc(t('importRemove'))}</button>` : '';
    $('import-remove')?.addEventListener('click', () => { host.removeImported(); renderCurrent(); });
  }

  function load(text, fileName = '') {
    w.text = text; w.fileName = fileName; w.delimiter = 'auto'; w.header = 'auto'; w.bbox = '';
    try { w.source = parseSource(text, fileName); } catch (e) { error(e.message); return false; }
    w.mapping = guessMapping(w.source);
    const base = fileName.replace(/\.[^.]+$/, '');
    $('import-network').value = (base || t('importDefaultNetwork')).slice(0, 40);
    $('import-prefix').value = sanitizeId(base).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'IMP';
    $('import-height-mode').value = 'file'; $('import-swap').checked = false;
    setStep(2);
    return true;
  }
  async function loadFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE) { error('importTooLarge'); return; }
    load(await file.text(), file.name);
  }
  function reparse() {
    try { w.source = parseDelimited(w.text, { delimiter: w.delimiter, header: w.header }); w.mapping = guessMapping(w.source); }
    catch (e) { error(e.message); }
    renderMapping();
  }
  const options = () => ({ swap: $('import-swap').checked, idPrefix: $('import-prefix').value, heightMode: $('import-height-mode').value,
    constantHeight: Number($('import-constant').value) || 0, defaultStatus: $('import-status').value,
    network: $('import-network').value.trim() || t('importDefaultNetwork') });

  function renderMapping() {
    const s = w.source, m = w.mapping, json = s.kind === 'json';
    const detected = json ? t('detectedJson', { count: s.records.length, skipped: s.skipped }) : t('detectedTable', { rows: s.rows.length, columns: s.columns.length });
    $('import-detected').textContent = `${w.fileName ? `${w.fileName} · ` : ''}${detected}`;
    $('import-table-options').hidden = json;
    if (!json) {
      const found = t(DELIMITERS.find(d => d[0] === s.delimiter)?.[1] || 'delimComma');
      $('import-delimiter').innerHTML = DELIMITERS.map(([v, k]) => `<option value="${esc(v)}">${esc(t(k))}${v === 'auto' ? ` (${esc(found)})` : ''}</option>`).join('');
      $('import-delimiter').value = w.delimiter; $('import-header').checked = s.hasHeader;
    }
    const canGeometry = json && s.records.some(r => Array.isArray(r.coords)), canProperties = json && s.keys.length > 1;
    $('import-coords-wrap').hidden = !json || !(canGeometry && canProperties);
    $('import-coords').value = m.coords || 'geometry';
    const names = json ? s.keys : s.columns, value = f => (json ? m[f] ?? '' : String(m[f] ?? -1));
    const opts = (f, none) => [`<option value="${json ? '' : '-1'}">${esc(t(none))}</option>`,
      ...(f === 'h' && json && s.hasZ ? [`<option value="@z">${esc(t('zCoordinate'))}</option>`] : []),
      ...names.map((n, i) => `<option value="${esc(json ? n : String(i))}">${esc(n)}</option>`)].join('');
    for (const f of FIELDS) {
      const select = $(`map-${f}`), coordinate = f === 'lat' || f === 'lon';
      select.innerHTML = opts(f, f === 'id' ? 'automaticId' : coordinate ? 'chooseColumn' : 'noneColumn');
      select.value = value(f);
      select.closest('label').hidden = coordinate && json && m.coords === 'geometry';
    }
    $('import-constant-wrap').hidden = $('import-height-mode').value !== 'constant';
    update();
  }
  function update() {
    if (!w.source) return;
    w.result = buildStations(w.source, w.mapping, options());
    const r = w.result;
    $('import-swap-hint').hidden = !r.swapSuggested;
    const parts = [`<b>${esc(t('importValid', { valid: r.valid, total: r.rows.length }))}</b>`];
    if (r.invalid) parts.push(`<span class="danger">${esc(t('importInvalid', { count: r.invalid }))}</span>`);
    if (r.autoIds) parts.push(esc(t('importAutoIds', { count: r.autoIds })));
    if (r.renamed) parts.push(esc(t('importRenamed', { count: r.renamed })));
    if (r.needsDem) parts.push(esc(t('importDemCount', { count: r.needsDem })));
    const bbox = r.bbox ? t('importBbox', { lat0: num(r.bbox[1], 4), lat1: num(r.bbox[3], 4), lon0: num(r.bbox[0], 4), lon1: num(r.bbox[2], 4) }) : '';
    $('import-summary').innerHTML = parts.join(' · ') + (bbox ? `<br>${esc(bbox)}` : '');
    const head = ['#', 'ID', 'lat', 'lon', 'h (m)', t('importName'), t('status')];
    const bad = r.rows.filter(x => x.error).slice(0, 4), shown = [...bad, ...r.rows.filter(x => !x.error).slice(0, 12 - bad.length)].sort((a, b) => a.index - b.index);
    const deg = x => (Number.isFinite(x) ? x.toFixed(6) : '—');
    const status = x => t({ active: 'stActive', inactive: 'stInactive', unverified: 'stUnverified' }[x.status]);
    $('import-preview').innerHTML = `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${shown.map(x => (x.error
      ? `<tr class="bad"><td>${x.index + 1}</td><td colspan="6">${esc(t(x.error))}${Number.isFinite(x.lat) && Number.isFinite(x.lon) ? ` (${deg(x.lat)}, ${deg(x.lon)})` : ''}</td></tr>`
      : `<tr><td>${x.index + 1}</td><td>${esc(x.id)}${x.autoId ? ' *' : ''}</td><td>${deg(x.lat)}</td><td>${deg(x.lon)}</td><td>${x.h === null ? esc(t('importFromDem')) : num(x.h, 2)}</td><td>${esc(x.city)}</td><td>${esc(status(x))}</td></tr>`)).join('')}</tbody>`;
    $('import-next').disabled = !r.valid;
    const key = r.bbox ? r.bbox.map(v => v.toFixed(5)).join() : '';
    host.preview(r.stations, { fit: key !== w.bbox && Boolean(key) }); // refit only when the coordinates change
    w.bbox = key;
    if (w.step === 3) renderFinal();
  }
  function renderFinal() {
    const mode = $('import-add').value, conflict = $('import-conflict').value;
    w.plan = host.plan(w.result.stations, { mode, conflict });
    const p = w.plan;
    $('import-catalogue').hidden = mode === 'points';
    $('import-conflict-wrap').hidden = !p.conflicts;
    const lines = [t(mode === 'points' ? 'planPoints' : 'planStations', { count: p.count })];
    if (p.conflicts) lines.push(t('importConflicts', { count: p.conflicts }));
    if (mode !== 'stations' && mode !== 'points') lines.push(t('planControl', { count: p.points }));
    if (w.result.needsDem) lines.push(t('importDemCount', { count: w.result.needsDem }));
    if (!p.pointsFit) lines.push(t('importTooManyPoints', { total: p.total, max: p.max }));
    if (!p.stationsFit) lines.push(t('importTooManyStations', { max: p.maxStations }));
    $('import-final').textContent = lines.join(' · ');
    $('import-final').classList.toggle('danger', !p.fits);
    $('import-run').disabled = w.busy || !p.fits || !p.count;
  }
  async function run() {
    if (w.busy || !w.result?.valid || !w.plan?.fits) return;
    w.busy = true; $('import-run').disabled = true; $('import-back').disabled = true;
    try {
      const done = await host.import(w.result.stations.map(s => ({ ...s, networks: [...s.networks] })), {
        mode: $('import-add').value, conflict: $('import-conflict').value,
        progress: (k, n) => { $('import-progress').textContent = t('importSampling', { done: k, total: n }); } });
      if (done) close();
    } catch (e) { error(e.message); }
    finally { w.busy = false; $('import-back').disabled = false; $('import-progress').textContent = ''; if (dialog.open && w.step === 3) renderFinal(); }
  }
  function reset() { w.source = null; w.result = null; w.plan = null; $('import-text').value = ''; error(null); }
  function open() {
    reset(); setStep(1);
    if (!dialog.open) dialog.show();
    $('import-choose').focus();
  }
  /** Open directly on the columns step with this content; false (and closed) if it cannot be read. */
  function openWith(text, fileName = '') {
    reset();
    if (!load(text, fileName)) return false;
    if (!dialog.open) dialog.show();
    $('import-next').focus();
    return true;
  }
  function close() { if (dialog.open) dialog.close(); }

  // ---------- events ----------
  $('import-choose').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; loadFile(file); });
  const zone = $('drop-zone');
  ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('over'); }));
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('over'); loadFile(e.dataTransfer?.files?.[0]); });
  zone.addEventListener('click', () => $('import-file').click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('import-file').click(); } });
  $('import-read').addEventListener('click', () => { const text = $('import-text').value; if (text.trim()) load(text, ''); else error('importEmpty'); });
  $('import-delimiter').addEventListener('change', e => { w.delimiter = e.target.value; reparse(); });
  $('import-header').addEventListener('change', e => { w.header = e.target.checked; reparse(); });
  $('import-coords').addEventListener('change', e => { w.mapping.coords = e.target.value; renderMapping(); });
  for (const f of FIELDS) $(`map-${f}`).addEventListener('change', e => {
    const v = e.target.value;
    w.mapping[f] = w.source.kind === 'json' ? (v || null) : Number(v);
    update();
  });
  ['import-swap', 'import-prefix', 'import-constant', 'import-status', 'import-network'].forEach(id => $(id).addEventListener('input', update));
  $('import-height-mode').addEventListener('change', () => { $('import-constant-wrap').hidden = $('import-height-mode').value !== 'constant'; update(); });
  ['import-add', 'import-conflict'].forEach(id => $(id).addEventListener('change', renderFinal));
  $('import-back').addEventListener('click', () => setStep(Math.max(1, w.step - 1)));
  $('import-next').addEventListener('click', () => { if (w.result?.valid) setStep(3); });
  $('import-run').addEventListener('click', run);
  dialog.querySelector('[data-close="import-dialog"]').addEventListener('click', close);
  dialog.addEventListener('close', () => host.preview(null)); // however it closes
  dialog.addEventListener('keydown', e => { if (e.key === 'Escape' && !w.busy) { e.stopPropagation(); close(); } });
  return { open, openWith, close, refresh, get isOpen() { return dialog.open; }, get state() { return w; } };
}
