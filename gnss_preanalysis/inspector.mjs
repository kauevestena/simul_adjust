// Property panel and session list. Every user-provided string is escaped before insertion.
import { t, num } from './i18n.mjs';
import { SESSION_COLORS } from './model/network.mjs';
import { CONFIDENCE_2D } from './geometry.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mm = x => (Number.isFinite(x) ? `${num(x * 1000, 1)} mm` : '—');
const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
const INFO = new Set(['isolatedPoints', 'heightAssumed', 'longBaselinePrecise', 'trivialExcluded']);

export function diagnosticText(d) {
  const values = { ...d };
  if (Number.isFinite(d.km)) values.km = num(d.km, 1);
  if (d.reason) values.reason = t(d.reason);
  return t(d.code, values);
}
export function diagnosticsHtml(diagnostics) {
  if (!diagnostics.length) return `<p class="note">${esc(t('noWarnings'))}</p>`;
  return `<ul class="warnings">${diagnostics.map(d => `<li class="${INFO.has(d.code) ? 'info' : ''}" data-code="${esc(d.code)}">${esc(diagnosticText(d))}</li>`).join('')}</ul>`;
}

export function summaryHtml(project, result) {
  const sessions = project.sessions.length, used = Object.values(result.points).filter(p => p.used).length;
  return `<h3>${esc(t('summary'))}</h3><p class="note">${esc(t('emptySelection'))}</p><dl>
    ${row(t('points'), `${project.points.length} (${used} ${esc(t('lines'))})`)}
    ${row(t('baselines'), `${project.baselines.length} · ${result.trivialCount} ${esc(t('trivialCount'))}`)}
    ${row(t('sessions'), sessions)}</dl><h4>${esc(t('warnings'))}</h4>${diagnosticsHtml(result.diagnostics)}`;
}

export function pointHtml(point, project, result, view) {
  const r = result.precision[point.id], conf = CONFIDENCE_2D[view.confidence], used = result.points[point.id]?.used;
  const lines = project.baselines.filter(b => b.from === point.id || b.to === point.id);
  const control = ['free', 'fixed', 'stochastic'].map(c => `<option value="${c}" ${point.control === c ? 'selected' : ''}>${esc(t(c))}</option>`).join('');
  const setup = point.setup || {};
  const precision = point.control === 'fixed' ? `<p class="note">${esc(t('fixedNote'))}</p>`
    : r ? `<dl>${row('σE / σN / σU', `${mm(r.sigma[0])} / ${mm(r.sigma[1])} / ${mm(r.sigma[2])}`)}
      ${row(`${t('major')} (${view.confidence === '95' ? '95%' : '1σ'})`, mm(r.ellipse.major * conf))}
      ${row(`${t('minor')} (${view.confidence === '95' ? '95%' : '1σ'})`, mm(r.ellipse.minor * conf))}
      ${row(t('azimuth'), `${num(r.ellipse.azimuth * 180 / Math.PI, 1)}°`)}</dl>`
      : `<p class="note">${esc(t('notDetermined'))}</p>`;
  return `<span class="badge ${point.kind === 'cors' ? '' : 'warn'}">${esc(t(point.kind === 'cors' ? 'kindCors' : 'kindNew'))}${point.corsId ? ` · ${esc(point.corsId)}` : ''}</span>
  <h3>${esc(point.label || point.id)}</h3>
  <label><span>${esc(t('label'))}</span><input id="p-label" value="${esc(point.label)}" maxlength="80"></label>
  <label><span>${esc(t('control'))}</span><select id="p-control">${control}</select></label>
  <div class="fields three" id="p-sigma" ${point.control === 'stochastic' ? '' : 'hidden'}>${point.sigmaControl.map((s, i) => `<label><span>${['σE', 'σN', 'σU'][i]} (mm)</span><input id="p-sigma-${i}" type="number" min="0.01" step="0.1" value="${s}"></label>`).join('')}</div>
  <div class="fields two"><label><span>${esc(t('latitude'))}</span><input id="p-lat" type="number" step="0.000001" value="${point.lat.toFixed(8)}" ${point.kind === 'cors' ? 'disabled' : ''}></label>
  <label><span>${esc(t('longitude'))}</span><input id="p-lon" type="number" step="0.000001" value="${point.lon.toFixed(8)}" ${point.kind === 'cors' ? 'disabled' : ''}></label></div>
  <label><span>${esc(t('height'))} · ${esc(t(point.hSource))}</span><input id="p-h" type="number" step="0.01" value="${point.h.toFixed(3)}" ${point.kind === 'cors' ? 'disabled' : ''}></label>
  <div class="fields two"><label><span>${esc(t('setupOverride'))}</span><input id="p-setup-c" type="number" min="0" max="100" step="0.1" placeholder="${esc(t('useDefault'))}" value="${setup.centering ?? ''}"></label>
  <label><span>&nbsp;</span><input id="p-setup-h" type="number" min="0" max="100" step="0.1" placeholder="${esc(t('useDefault'))}" value="${setup.height ?? ''}"></label></div>
  <div class="small-buttons"><button id="apply-point">${esc(t('apply'))}</button><button id="delete-point" class="danger">${esc(t('deletePoint'))}</button></div>
  <h4>${esc(t('predicted'))}</h4>${used ? precision : `<p class="note">${esc(t('notDetermined'))}</p>`}
  <p class="note">${esc(t('baselines'))}: ${lines.map(b => `<a href="#" data-baseline="${esc(b.id)}">${esc(b.from)}–${esc(b.to)} (${esc(b.session)})</a>`).join(', ') || '—'}</p>`;
}

export function baselineHtml(baseline, project, result, view) {
  const info = result.baselines[baseline.id], session = project.sessions.find(s => s.id === baseline.session);
  const sessions = project.sessions.map(s => `<option value="${esc(s.id)}" ${s.id === baseline.session ? 'selected' : ''}>${esc(s.label || s.id)}</option>`).join('');
  let details = '';
  if (info && !info.invalid) {
    const c = info.covXYZ ?? info.apriori.xyz, sx = [0, 1, 2].map(i => Math.sqrt(c[i][i]));
    const rho = (i, j) => num(c[i][j] / (sx[i] * sx[j]), 2);
    const mdb = info.mdb ? info.mdb.map(x => Number.isFinite(x) ? mm(x) : esc(t('undetectable'))).join(' / ') : '—';
    details = `<dl>${row(t('length'), `${num(info.km, 3)} km`)}
      ${row(t('aprioriSigma'), info.sigmaENU.map(mm).join(' / '))}
      ${row(t('sigmaXYZ'), sx.map(mm).join(' / '))}
      ${row(t('correlations'), `${rho(0, 1)} / ${rho(0, 2)} / ${rho(1, 2)}`)}
      ${row(t('adjustedSigma'), info.adjusted ? info.adjusted.sigma.map(mm).join(' / ') : '—')}
      ${row(t('redundancy'), Number.isFinite(info.redundancyMean) ? num(info.redundancyMean, 3) : '—')}
      ${row(t('mdb'), mdb)}
      ${row(t('ibgeGuide'), `${info.guideMinutes} ${esc(t('min'))} ${info.shortSession ? '⚠' : '✓'} (${num(session?.duration ?? 0, 0)} ${esc(t('min'))})`)}</dl>
      ${info.trivial ? `<p class="note danger">${esc(t('trivialYes'))}${info.included ? '' : ' ' + esc(t('trivialExcludedNote'))}</p>` : ''}
      ${info.mdb ? `<div class="small-buttons">${['effectE', 'effectN', 'effectU'].map((k, i) => `<button data-effect="${i}" ${Number.isFinite(info.mdb[i]) && result.solvable ? '' : 'disabled'}>${esc(t(k))}</button>`).join('')}</div>` : ''}`;
  } else if (info?.invalid) details = `<p class="note danger">${esc(t(info.invalid))}</p>`;
  return `<span class="badge">${esc(t('baseline'))}</span><h3>${esc(baseline.from)} → ${esc(baseline.to)}</h3>
    <label><span>${esc(t('session'))}</span><select id="b-session">${sessions}</select></label>
    <div class="checks"><label><input id="b-active" type="checkbox" ${baseline.active ? 'checked' : ''}><span>${esc(t('activeLine'))}</span></label></div>
    ${details}<div class="panel-actions"><button id="delete-baseline" class="danger">${esc(t('deleteBaseline'))}</button></div>
    <p class="note" id="effect-note"></p>`;
}

export function stationHtml(station, project) {
  const inNetwork = project.points.some(p => p.corsId === station.id);
  const source = { ngl: 'srcNgl', site_log: 'srcLog', ibge_report: 'srcIbge', import: 'srcImport' }[station.coordSource] || 'srcImport';
  const status = { active: 'stActive', inactive: 'stInactive', unverified: 'stUnverified' }[station.status] || 'stActive';
  const link = /^https?:\/\//.test(station.reference || '') ? `<a href="${esc(station.reference)}" target="_blank" rel="noopener">${esc(t('reference'))}</a>` : '';
  const heightSource = { file: 'hFile', dem: 'terrain', constant: 'hConstant', missing: 'missing' }[station.heightSource];
  return `<span class="badge ${station.coordSource === 'import' ? 'imported' : ''}">${esc(t(station.coordSource === 'import' ? 'importedStation' : 'station'))}</span><h3>${esc(station.id)}${station.city ? ` · ${esc(station.city)}` : ''}</h3><dl>
    ${row(t('status'), esc(t(status)))}${row(t('networks'), esc((station.networks || []).join(', ')))}
    ${row(t('agencies'), esc((station.agencies || []).join(', ')) || '—')}
    ${row(t('latitude'), station.lat.toFixed(6))}${row(t('longitude'), station.lon.toFixed(6))}${row(t('height'), `${num(station.h, 3)} m`)}
    ${heightSource ? row(t('heightSource'), esc(t(heightSource))) : ''}
    ${row(t('coordSource'), esc(t(source)))}</dl><p class="note">${link}</p>
    <div class="panel-actions">${inNetwork ? `<p class="note">${esc(t('inNetwork'))}</p>` : `<button id="add-station" data-id="${esc(station.id)}">${esc(t('addToNetwork'))}</button>`}</div>`;
}

export function sessionsHtml(project, result, active) {
  return project.sessions.map(s => {
    const info = result.sessions[s.id] || { receivers: [], baselines: 0, dependent: [] };
    return `<div class="session-card ${s.id === active ? 'active' : ''}" data-session="${esc(s.id)}"><header>
      <span class="swatch" style="background:${SESSION_COLORS[s.color % SESSION_COLORS.length]}"></span><b>${esc(s.label || s.id)}</b>
      <span class="meta">${info.baselines} ${esc(t('lines'))} · ${info.receivers.length} ${esc(t('receivers'))}${info.dependent.length ? ` · ${info.dependent.length} ${esc(t('dependentShort'))}` : ''}</span></header>
      <div class="fields"><label><span>${esc(t('sessionLabel'))}</span><input data-field="label" value="${esc(s.label)}" maxlength="80"></label>
      <label><span>${esc(t('duration'))}</span><input data-field="duration" type="number" min="1" max="10080" step="1" value="${s.duration}"></label></div>
      <div class="small-buttons"><button data-action="activate" ${s.id === active ? 'disabled' : ''}>${esc(t('makeActive'))}</button>
      <button data-action="remove" class="danger" ${project.sessions.length < 2 ? 'disabled' : ''}>${esc(t('removeSession'))}</button></div></div>`;
  }).join('');
}
