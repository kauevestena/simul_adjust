import { t } from './i18n.mjs';
import { errorEllipse } from './network/reliability.mjs';
import { ARCSECOND, sightGeometry } from './network/observations.mjs';
import { validatePointPlacement } from './network/constraints.mjs';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = (v, digits = 3) => Number.isFinite(v) ? v.toFixed(digits) : '—';
export const mm = v => Number.isFinite(v) ? `${(v * 1000).toFixed(2)} mm` : '—';
export const pair = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
export const field = (id, label, value, disabled = false) => `<label>${esc(label)}<input id="${esc(id)}" inputmode="decimal" value="${esc(value)}" ${disabled ? 'disabled' : ''}></label>`;
const select = (id, label, values, value) => `<label>${esc(label)}<select id="${id}">${values.map(v => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label>`;
const check = (id, key, checked) => `<label><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>${esc(t(key))}</label>`;
const sightButton = s => `<button data-select-sight="${esc(s.id)}">${esc(s.from)} → ${esc(s.to)}</button>`;
export const componentValue = (v, component) => Number.isFinite(v) ? (component === 'distance' ? mm(v) : `${fmt(v / ARCSECOND, 2)}″`) : t('undetectable');

export function renderContext(container, { network, constraints, result, selected, visibility, view, effect }) {
  const p = selected?.kind === 'point' ? network.points.find(p => p.id === selected.id) : null;
  const s = selected?.kind === 'sight' ? network.sights.find(s => s.id === selected.id) : null;
  if (p) {
    const pr = result?.precision[p.id], ellipse = pr ? errorEllipse(pr.covariance, view.confidence) : null;
    const omega = result?.parameters.findIndex(x => x.id === p.id && x.axis === 'omega');
    const placement = network.level === 2 ? validatePointPlacement(p, constraints) : null;
    container.innerHTML = `<h3>${esc(p.label || p.id)}</h3><span class="badge">${esc(t(p.type))} · ${esc(p.id)}</span>
      <label>${esc(t('label'))}<input id="p-label" value="${esc(p.label || p.id)}" maxlength="100"></label>
      ${select('p-type', t('type'), ['station', 'sighted_only'], p.type)}
      <div class="fields three">${['E','N','U'].map(k => field(`p-${k}`, `${k} (m)`, fmt(p[k], 3), k === 'U')).join('')}</div>
      ${placement ? `<p class="note">${esc(t('placementDistance',{distance:fmt(placement.distance,2)}))}<br>${esc(constraints.streetFeatures[placement.streetIndex]?.name)}</p>` : ''}
      ${select('p-control', t('control'), ['unknown','fixed','stochastic'], p.control)}
      <div class="fields two">${field('p-HI', t('HI'), fmt(p.HI), p.type !== 'station')}${field('p-HT', t('HT'), fmt(p.HT))}</div>
      <div class="checks">${check('p-active','active',p.active !== false)}</div>
      ${p.control === 'stochastic' ? `<label>${esc(t('sigmaControl'))}</label><div class="fields three">${['E','N','U'].map((k, i) => field(`p-sigma-${i}`, `σ${k}`, fmt(1000 * (p.controlCovariance ? Math.sqrt(p.controlCovariance[i][i]) : p.controlSigma[i])))).join('')}</div>${p.controlCovariance ? `<p class="note">${esc(t('covarianceNote'))}</p>` : ''}` : ''}
      <button id="apply-point">${esc(t('apply'))}</button>
      <div class="small-buttons"><button data-role="gnssStart">${esc(t('setStart'))}</button><button data-role="gnssFinish">${esc(t('setFinish'))}</button></div>
      ${p.role ? `<p class="note">${esc(t(p.role))}</p>` : ''}
      <details open><summary>${esc(t('precision'))}</summary><dl>${['E','N','U'].map((k,i) => pair(`σ${k}`,pr?mm(pr.sigma[i]):p.control==='fixed'?'0.00 mm':t('noValue'))).join('')}
      ${ellipse ? pair(t('major'),mm(ellipse.major))+pair(t('minor'),mm(ellipse.minor))+pair(t('azimuth'),`${fmt(ellipse.azimuth*180/Math.PI,2)}°`) : ''}
      ${omega >= 0 && result?.solvable ? pair(t('orientation'),fmt(Math.sqrt(result.covariance[omega][omega])/ARCSECOND,2)) : ''}
      ${effect?.points[p.id] ? pair(t('displacement'),mm(Math.hypot(...effect.points[p.id]))) : ''}</dl></details>
      <p class="note">${esc(t('outgoing'))}</p><div class="point-list">${network.sights.filter(s=>s.from===p.id).map(sightButton).join('')}</div>
      <p class="note">${esc(t('incoming'))}</p><div class="point-list">${network.sights.filter(s=>s.to===p.id).map(sightButton).join('')}</div>
      <button id="delete-selected" class="danger">${esc(t('delete'))}</button>`;
  } else if (s) {
    let g = null; try { g = sightGeometry(network.points.find(p=>p.id===s.from), network.points.find(p=>p.id===s.to), s); } catch {}
    const invalid = result?.invalidSights.find(x=>x.id===s.id);
    const target = network.points.find(p=>p.id===s.to);
    container.innerHTML = `<h3>${esc(s.from)} → ${esc(s.to)}</h3>
      <div class="checks">${check('s-active','active',s.active!==false)}${['direction','zenith','distance'].map(c=>check(`s-${c}`,c,s.components[c])).join('')}${check('s-override','htOverride',s.HT!=null)}</div>
      ${s.HT!=null ? field('s-HT',t('HT'),fmt(s.HT)) : `<p class="note">${esc(t('HT'))}: ${fmt(target.HT)} m</p>`}
      ${g ? `<dl>${pair(t('distance'),`${fmt(g.distance)} m`)}${pair(t('horizontal'),`${fmt(g.horizontal)} m`)}${pair(t('deltaU'),`${fmt(g.delta[2])} m`)}${pair(t('zenith'),`${fmt(g.zenith*180/Math.PI)}°`)}</dl>` : ''}
      ${network.level ? `<p class="badge">${esc(t(visibility[s.id]?.status??'missing'))}</p><dl>${pair(t('clearance'),`${fmt(visibility[s.id]?.minimumClearance)} m`)}</dl>` : ''}
      ${invalid ? `<ul class="warnings"><li>${esc(t(invalid.code))}</li></ul>` : ''}
      ${(result?.rows??[]).map((r,i)=>r.sightId!==s.id?'':`<div class="component-card"><h4>${esc(t(r.component))}</h4><dl>${pair('σ',componentValue(r.sigma,r.component))}${pair(t('redundancy'),fmt(r.redundancy,4))}${pair('MDB',componentValue(r.mdb,r.component))}</dl><button data-effect="${i}" ${!result.solvable||!Number.isFinite(r.mdb)?'disabled':''}>${esc(t('effect'))}</button></div>`).join('')}
      <button id="delete-selected" class="danger">${esc(t('delete'))}</button>`;
  } else {
    container.innerHTML = `<h3>${esc(t('network'))}</h3><p class="note">${esc(t('emptySelection'))}</p><dl>
      ${pair(t('points'),network.points.length)}${pair(t('stations'),network.points.filter(p=>p.type==='station').length)}${pair(t('targets'),network.points.filter(p=>p.type==='sighted_only').length)}
      ${pair(t('components'),result?.observationCount??'—')}${pair(t('controls'),result?.controlCount??'—')}${pair(t('unknowns'),result?.parameters.length??'—')}
      ${pair(t('rank'),result?.rank??'—')}${pair(t('dof'),result?.dof??'—')}${pair(t('invalidSights'),result?.invalidSights.length??'—')}
      ${pair(t('lowestR'),fmt(result?.minimumRedundancy,4))}</dl>
      <div class="point-list">${network.points.map(p=>`<button data-select-point="${esc(p.id)}">${esc(p.label||p.id)}</button>`).join('')}</div>
      <ul class="warnings">${(result?.diagnostics??[]).map(d=>`<li>${esc(t(d.code,d))}</li>`).join('')}${(result?.invalidSights??[]).map(s=>`<li>${esc(s.id)}: ${esc(t(s.code))}</li>`).join('')}</ul>`;
  }
}
