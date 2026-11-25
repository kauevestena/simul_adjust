// Serializable GNSS network project (version 1). Geographic degrees, ellipsoidal h in metres,
// standard deviations in mm, session durations in minutes. No UI state is stored here.
import { defaultSettings, validateSettings } from './stochastic.mjs';

export const FORMAT = 'gnss-preanalysis';
export const LIMITS = Object.freeze({ points: 150, baselines: 600, sessions: 60 });
export const SESSION_COLORS = ['#0d8a8b', '#d9480f', '#5f3dc4', '#2b8a3e', '#c2255c', '#1864ab', '#e67700', '#495057'];

export const makePoint = ({ id, label = id, lat, lon, h = 0, hSource = 'manual', kind = 'new', control, corsId = null,
  sigmaControl = [5, 5, 10], setup = null }) => ({
  id, label, lat, lon, h, hSource, kind, corsId,
  control: control ?? (kind === 'cors' ? 'fixed' : 'free'), sigmaControl: [...sigmaControl], setup: setup && { ...setup },
});
export const makeSession = (id, label = id, duration = 60, color = 0) => ({ id, label, duration, color });
export const makeBaseline = (from, to, session, id = `${from}-${to}@${session}`) => ({ id, from, to, session, active: true });
export const emptyProject = () => ({ format: FORMAT, version: 1, title: '', settings: defaultSettings(),
  points: [], sessions: [makeSession('S1', 'S1', 60, 0)], baselines: [] });

const text = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export function validatePoint(p) {
  if (!p || !text(p.id, 40) || (p.label != null && (typeof p.label !== 'string' || p.label.length > 80)) ||
      ![p.lat, p.lon, p.h].every(Number.isFinite) || Math.abs(p.lat) > 85 || Math.abs(p.lon) > 180 || Math.abs(p.h) > 12000 ||
      !['new', 'cors'].includes(p.kind) || !['free', 'fixed', 'stochastic'].includes(p.control) ||
      !['terrain', 'cors', 'manual', 'pending', 'missing'].includes(p.hSource) ||
      (p.corsId != null && !text(p.corsId, 9))) throw Error('invalidPoint');
  if (!Array.isArray(p.sigmaControl) || p.sigmaControl.length !== 3 || !p.sigmaControl.every(x => Number.isFinite(x) && x > 0 && x <= 10000))
    throw Error('invalidSigma');
  if (p.setup != null && (![p.setup.centering, p.setup.height].every(x => Number.isFinite(x) && x >= 0 && x <= 100))) throw Error('invalidSetup');
  return p;
}
export function validateProject(project) {
  const p = project;
  if (!p || p.format !== FORMAT || p.version !== 1 || !Array.isArray(p.points) || !Array.isArray(p.sessions) ||
      !Array.isArray(p.baselines) || p.points.length > LIMITS.points || p.baselines.length > LIMITS.baselines ||
      p.sessions.length > LIMITS.sessions || !p.sessions.length || (p.title != null && (typeof p.title !== 'string' || p.title.length > 120)))
    throw Error('invalidProject');
  validateSettings(p.settings);
  const ids = new Set();
  for (const point of p.points) { validatePoint(point); if (ids.has(point.id)) throw Error('invalidPoint'); ids.add(point.id); }
  const sessions = new Set();
  for (const s of p.sessions) {
    if (!s || !text(s.id, 40) || sessions.has(s.id) || (s.label != null && (typeof s.label !== 'string' || s.label.length > 80)) ||
        !(Number.isFinite(s.duration) && s.duration > 0 && s.duration <= 10080) || !Number.isInteger(s.color) || s.color < 0)
      throw Error('invalidSession');
    sessions.add(s.id);
  }
  const baselineIds = new Set();
  for (const b of p.baselines) {
    if (!b || !text(b.id, 120) || baselineIds.has(b.id) || !ids.has(b.from) || !ids.has(b.to) || b.from === b.to ||
        !sessions.has(b.session) || typeof b.active !== 'boolean') throw Error('invalidBaseline');
    baselineIds.add(b.id);
  }
  return p;
}
export const clone = p => JSON.parse(JSON.stringify(p));
export const serialize = p => JSON.stringify(validateProject(p), null, 2);
export function deserialize(textValue) {
  if (typeof textValue !== 'string' || textValue.length > 3e6) throw Error('invalidProject');
  let p;
  try { p = JSON.parse(textValue); } catch { throw Error('invalidProject'); }
  if (p && p.settings) p.settings = { ...defaultSettings(), ...p.settings,
    statistics: { ...defaultSettings().statistics, ...(p.settings.statistics || {}) } };
  return validateProject(p);
}

export function nextId(prefix, existing) {
  const used = new Set(existing);
  for (let i = 1; i < 10000; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
  throw Error('invalidProject');
}
export function uniqueBaselineId(project, from, to, session) {
  const used = new Set(project.baselines.map(b => b.id));
  let id = `${from}-${to}@${session}`, n = 2;
  while (used.has(id)) id = `${from}-${to}@${session}#${n++}`;
  return id;
}
/** Removing a point also removes its baselines; removing a session moves nothing silently. */
export function removePoint(project, id) {
  project.points = project.points.filter(p => p.id !== id);
  project.baselines = project.baselines.filter(b => b.from !== id && b.to !== id);
}
export function removeSession(project, id) {
  if (project.sessions.length <= 1) throw Error('lastSession');
  project.sessions = project.sessions.filter(s => s.id !== id);
  project.baselines = project.baselines.filter(b => b.session !== id);
}
