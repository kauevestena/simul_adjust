// Project ⇄ GeoJSON (RFC 7946). One FeatureCollection: network points as Point features and
// baselines as LineString features (QGIS and other GIS software show them as two layers), with
// the pre-analysis results as attributes. Settings, sessions and imported stations travel in the
// foreign member "gnss_preanalysis" (RFC 7946 §6.1), which GIS software ignores.
// Positions are [longitude, latitude, ellipsoidal height h] (RFC 7946 §3.1.1).
// Reading: the features are the source of truth for points and baselines, so a file edited in a
// GIS still opens; without the foreign member, sessions come from the baseline attributes.
import { FORMAT, makePoint, makeSession, validateProject, deserialize, nextId, uniqueBaselineId, SESSION_COLORS } from './network.mjs';
import { defaultSettings } from './stochastic.mjs';

export const GEOJSON_FORMAT = 'gnss-preanalysis-geojson';
export const MEMBER = 'gnss_preanalysis';
export const MAX_PROJECT_TEXT = 8e6;
const H_SOURCES = ['terrain', 'cors', 'manual', 'pending', 'missing'];
const round = (x, digits) => (Number.isFinite(x) ? Number(x.toFixed(digits)) : null);
const mm = x => round(x * 1000, 3); // metres → millimetres, null when not finite
const finite = x => typeof x === 'number' && Number.isFinite(x);
const text = v => (typeof v === 'string' ? v.trim() || null : finite(v) ? String(v) : null);

function pointFeature(p, result) {
  const r = result?.precision?.[p.id], used = result ? Boolean(result.points?.[p.id]?.used) : null;
  const fixed = Boolean(used && result.solvable && p.control === 'fixed'); // eliminated from the adjustment: σ = 0
  const sigma = r ? r.sigma.map(mm) : fixed ? [0, 0, 0] : [null, null, null];
  return { type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: [p.lon, p.lat, p.h] },
    properties: { id: p.id, label: p.label ?? p.id, kind: p.kind, control: p.control, cors_id: p.corsId ?? null,
      h_m: p.h, h_source: p.hSource, dem_H_m: finite(p.H) ? p.H : null,
      ctrl_e_mm: p.sigmaControl[0], ctrl_n_mm: p.sigmaControl[1], ctrl_u_mm: p.sigmaControl[2],
      setup_c_mm: p.setup?.centering ?? null, setup_h_mm: p.setup?.height ?? null,
      used, sigma_e_mm: sigma[0], sigma_n_mm: sigma[1], sigma_u_mm: sigma[2],
      ell_major_mm: r ? mm(r.ellipse.major) : fixed ? 0 : null, ell_minor_mm: r ? mm(r.ellipse.minor) : fixed ? 0 : null,
      ell_azim_deg: r ? round(r.ellipse.azimuth * 180 / Math.PI, 3) : null } };
}

function baselineFeature(b, project, result, byId) {
  const a = byId.get(b.from), c = byId.get(b.to), session = project.sessions.find(s => s.id === b.session);
  const info = result?.baselines?.[b.id], ok = Boolean(info && !info.invalid);
  const triple = values => (values ? values.map(x => (finite(x) ? mm(x) : null)) : [null, null, null]);
  const apriori = triple(ok ? info.sigmaENU : null), adjusted = triple(ok ? info.adjusted?.sigma : null), mdb = triple(ok ? info.mdb : null);
  return { type: 'Feature', id: b.id, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat, a.h], [c.lon, c.lat, c.h]] },
    properties: { id: b.id, from: b.from, to: b.to, session: b.session, session_label: session?.label ?? b.session,
      duration_min: session?.duration ?? null, active: b.active,
      length_km: ok ? round(info.km, 4) : null, included: ok ? info.included : null, trivial: ok ? info.trivial : null,
      apriori_e_mm: apriori[0], apriori_n_mm: apriori[1], apriori_u_mm: apriori[2],
      sigma_e_mm: adjusted[0], sigma_n_mm: adjusted[1], sigma_u_mm: adjusted[2],
      redundancy: ok ? round(info.redundancyMean, 4) : null, mdb_e_mm: mdb[0], mdb_n_mm: mdb[1], mdb_u_mm: mdb[2],
      ibge_min: ok ? info.guideMinutes : null, short_session: ok ? info.shortSession : null } };
}

/** FeatureCollection of the project; `result` (from analyze) fills the result attributes, null when absent. */
export function projectToGeoJSON(project, result = null) {
  validateProject(project);
  const byId = new Map(project.points.map(p => [p.id, p]));
  const member = { format: GEOJSON_FORMAT, version: 1, title: project.title ?? '', settings: project.settings, sessions: project.sessions };
  if (result) member.summary = { solvable: result.solvable, dof: result.dof, observations: result.rows?.length ?? 0,
    unknowns: result.parameters?.length ?? 0, worst_major_mm: result.solvable ? mm(result.worstHorizontal) : null,
    worst_u_mm: result.solvable ? mm(result.worstVertical) : null, min_redundancy: round(result.minimumRedundancy, 4) };
  if (project.stations?.length) member.stations = project.stations;
  return { type: 'FeatureCollection', name: project.title || 'gnss-preanalysis', [MEMBER]: member,
    features: [...project.points.map(p => pointFeature(p, result)), ...project.baselines.map(b => baselineFeature(b, project, result, byId))] };
}

/** Readable text: one feature (and one station or session) per line. */
export function stringifyGeoJSON(collection) {
  const list = (items, pad) => (items.length ? `[\n${items.map(x => `${pad}  ${JSON.stringify(x)}`).join(',\n')}\n${pad}]` : '[]');
  const value = (v, pad) => (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object') ? list(v, pad) : JSON.stringify(v));
  const { [MEMBER]: member, features, ...head } = collection;
  const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  if (member) lines.push(`  ${JSON.stringify(MEMBER)}: {\n${Object.entries(member).map(([k, v]) => `    ${JSON.stringify(k)}: ${value(v, '    ')}`).join(',\n')}\n  }`);
  lines.push(`  "features": ${list(features, '  ')}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

// Single-part Multi* geometries (some GIS software writes them) count as their only part.
function geometryOf(feature) {
  const g = feature?.type === 'Feature' ? feature.geometry : null;
  if (!g || !Array.isArray(g.coordinates)) return null;
  if (g.type === 'MultiPoint' && g.coordinates.length === 1) return { type: 'Point', coordinates: g.coordinates[0] };
  if (g.type === 'MultiLineString' && g.coordinates.length === 1) return { type: 'LineString', coordinates: g.coordinates[0] };
  return g;
}
const position = c => (Array.isArray(c) && finite(c[0]) && finite(c[1]) ? c : null);

/** Project from a FeatureCollection written by projectToGeoJSON (or edited in a GIS). */
export function projectFromGeoJSON(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw Error('notProject');
  const member = data[MEMBER] && typeof data[MEMBER] === 'object' ? data[MEMBER] : null;
  const tagged = member?.format === GEOJSON_FORMAT;
  if (tagged && member.version !== 1) throw Error('invalidProject');
  const items = data.features.map(f => ({ f, g: geometryOf(f), q: f?.properties && typeof f.properties === 'object' ? f.properties : {} }));
  const pointItems = items.filter(x => x.g?.type === 'Point' && position(x.g.coordinates));
  const lineItems = items.filter(x => x.g?.type === 'LineString' && x.g.coordinates.length >= 2 && x.g.coordinates.every(position));
  // Without our member, the attributes must still identify a saved network (plain point files go to the import wizard).
  if (!tagged && !lineItems.some(x => x.q.from != null && x.q.to != null) && !pointItems.some(x => ['new', 'cors'].includes(x.q.kind)))
    throw Error('notProject');

  const saved = tagged && member.settings && typeof member.settings === 'object' ? member.settings : {};
  const settings = { ...defaultSettings(), ...saved, statistics: { ...defaultSettings().statistics, ...(saved.statistics || {}) } };
  let sessions = tagged && Array.isArray(member.sessions) && member.sessions.length ? member.sessions.map(s => ({ ...s })) : null;
  if (!sessions) {
    const found = new Map();
    for (const { q } of lineItems) {
      const id = text(q.session);
      if (id && !found.has(id)) found.set(id, makeSession(id, text(q.session_label) ?? id,
        finite(q.duration_min) && q.duration_min > 0 ? q.duration_min : 60, found.size % SESSION_COLORS.length));
    }
    sessions = found.size ? [...found.values()] : [makeSession('S1', 'S1', 60, 0)];
  }

  const points = [], ids = pointItems.map(({ f, q }) => text(q.id) ?? text(f.id)).filter(Boolean);
  for (const { f, g, q } of pointItems) {
    const [lon, lat, z] = g.coordinates, kind = q.kind === 'cors' ? 'cors' : 'new';
    let id = text(q.id) ?? text(f.id);
    if (!id) { id = nextId('P', ids); ids.push(id); } // a point added in a GIS without an ID
    // h_m is authoritative: emptied (e.g. after moving the point in a GIS) means "sample the DEM again".
    // The Z coordinate is used only by files without that attribute.
    const h = finite(q.h_m) ? q.h_m : !('h_m' in q) && finite(z) ? z : null;
    const sigma = [q.ctrl_e_mm, q.ctrl_n_mm, q.ctrl_u_mm], setupDefault = settings[kind === 'cors' ? 'setupCors' : 'setupNew'];
    const point = makePoint({ id, label: text(q.label) ?? id, lat, lon, h: h ?? 0, kind, corsId: text(q.cors_id),
      // No height in the file: the app samples the DEM, as for a point clicked on the map.
      hSource: h === null ? 'pending' : H_SOURCES.includes(q.h_source) ? q.h_source : 'manual',
      control: ['free', 'fixed', 'stochastic'].includes(q.control) ? q.control : undefined,
      sigmaControl: sigma.every(x => finite(x) && x > 0) ? sigma : undefined,
      setup: finite(q.setup_c_mm) || finite(q.setup_h_mm) ? { centering: finite(q.setup_c_mm) ? q.setup_c_mm : setupDefault.centering,
        height: finite(q.setup_h_mm) ? q.setup_h_mm : setupDefault.height } : null });
    if (finite(q.dem_H_m) && point.hSource === 'terrain') point.H = q.dem_H_m;
    points.push(point);
  }

  // Baselines: endpoints by ID, or (for lines drawn in a GIS with snapping) by coincident coordinates.
  const near = c => points.find(p => Math.abs(p.lon - c[0]) < 1e-6 && Math.abs(p.lat - c[1]) < 1e-6)?.id ?? null;
  const sessionIds = new Set(sessions.map(s => s.id)), project = { baselines: [] };
  for (const { f, g, q } of lineItems) {
    const from = text(q.from) ?? near(g.coordinates[0]), to = text(q.to) ?? near(g.coordinates.at(-1));
    if (!from || !to) continue; // a line that does not join two network points is not a baseline
    const session = sessionIds.has(text(q.session)) ? text(q.session) : sessions[0].id;
    let id = text(q.id) ?? text(f.id);
    if (!id || project.baselines.some(b => b.id === id)) id = uniqueBaselineId(project, from, to, session);
    project.baselines.push({ id, from, to, session, active: q.active !== false && q.active !== 0 });
  }

  const out = { format: FORMAT, version: 1, title: tagged ? text(member.title) ?? '' : '', settings, points, sessions, baselines: project.baselines };
  if (tagged && Array.isArray(member.stations) && member.stations.length) out.stations = member.stations;
  return validateProject(out);
}

/** A saved project from text: GeoJSON (current) or the version-1 project JSON (older saves). */
export function readProject(textValue) {
  if (typeof textValue !== 'string' || textValue.length > MAX_PROJECT_TEXT) throw Error('invalidProject');
  let data;
  try { data = JSON.parse(textValue.replace(/^﻿/, '')); } catch { throw Error('notProject'); }
  if (data?.type === 'FeatureCollection') return projectFromGeoJSON(data);
  if (data?.format === FORMAT) return deserialize(textValue.replace(/^﻿/, ''));
  throw Error('notProject');
}
