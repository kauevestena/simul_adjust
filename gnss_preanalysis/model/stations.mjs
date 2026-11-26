// Imported stations in a project: the catalogue to snap to (project.stations) and/or network points.
import { makePoint, nextId } from './network.mjs';
import { withSuffix } from './importer.mjs';

export const IMPORT_MODES = ['stations', 'fixed', 'stochastic', 'points'];
export const CONFLICT_POLICIES = ['replace', 'rename', 'skip'];

/** Height source of a network point made from a station (bundled stations carry no heightSource). */
export function pointHeightSource(station, kind = 'cors') {
  switch (station.heightSource) {
    case 'dem': return 'terrain';
    case 'constant': return 'manual';
    case 'missing': return 'missing';
    case 'file': return kind === 'cors' ? 'cors' : 'manual';
    default: return 'cors';
  }
}
function placeAt(point, station) {
  Object.assign(point, { lat: station.lat, lon: station.lon, h: station.h, hSource: pointHeightSource(station, point.kind) });
  delete point.H;
  if (station.heightSource === 'dem' && Number.isFinite(station.H)) point.H = station.H; // keeps h = H + N₀ editable
}

/** Network point for a station; an existing point with the same corsId is reused. Returns the point ID. */
export function addStationPoint(project, station, control = 'fixed') {
  const existing = project.points.find(p => p.corsId === station.id);
  if (existing) return existing.id;
  const id = project.points.some(p => p.id === station.id) ? nextId(`${station.id}_`, project.points.map(p => p.id)) : station.id;
  const point = makePoint({ id, label: station.id, lat: 0, lon: 0, kind: 'cors', corsId: station.id, control });
  placeAt(point, station);
  project.points.push(point);
  return id;
}

/**
 * Apply an import to a project (mutates it; the caller validates).
 * mode: 'stations' (catalogue to snap to), 'fixed' / 'stochastic' (catalogue + network control)
 * or 'points' (new network points, the unknowns). conflict, for IDs already in use: 'replace'
 * (the imported record wins; network points tied to it move), 'rename' (ID-2, ID-3…) or 'skip'.
 * bundledIds: IDs of the bundled RBMC list, which an imported station may override.
 */
export function applyImport(project, stations, { mode = 'stations', conflict = 'rename', bundledIds = [] } = {}) {
  if (!IMPORT_MODES.includes(mode) || !CONFLICT_POLICIES.includes(conflict)) throw Error('invalidProject');
  const summary = { count: 0, conflicts: 0, skipped: 0, renamed: 0, replaced: 0, points: 0 };
  if (mode === 'points') {
    const taken = new Set(project.points.map(p => p.id));
    for (const s of stations) {
      let id = s.id;
      if (taken.has(id)) {
        summary.conflicts++;
        const existing = project.points.find(p => p.id === id);
        if (conflict === 'skip') { summary.skipped++; continue; }
        if (conflict === 'replace' && existing.kind === 'new') { placeAt(existing, s); summary.replaced++; summary.count++; continue; }
        id = withSuffix(id, taken); summary.renamed++; // a CORS point keeps its coordinates
      }
      taken.add(id);
      const point = makePoint({ id, lat: 0, lon: 0 });
      placeAt(point, s);
      project.points.push(point);
      summary.count++; summary.points++;
    }
    return summary;
  }
  const current = project.stations ? [...project.stations] : [];
  const taken = new Set([...bundledIds, ...current.map(s => s.id)]), accepted = [];
  for (const s of stations) {
    const station = { ...s };
    if (taken.has(station.id)) {
      summary.conflicts++;
      if (conflict === 'skip') { summary.skipped++; continue; }
      if (conflict === 'rename') { station.id = withSuffix(station.id, taken); summary.renamed++; } else summary.replaced++;
    }
    taken.add(station.id); accepted.push(station);
  }
  const ids = new Set(accepted.map(s => s.id));
  project.stations = [...current.filter(s => !ids.has(s.id)), ...accepted];
  for (const point of project.points) {
    const s = point.kind === 'cors' && accepted.find(x => x.id === point.corsId);
    if (s) placeAt(point, s);
  }
  if (mode !== 'stations') for (const s of accepted) {
    const before = project.points.length;
    addStationPoint(project, s, mode);
    summary.points += project.points.length - before;
  }
  summary.count = accepted.length;
  return summary;
}

/** Imported stations whose DEM height must follow a new N₀ (h = H + N₀), like DEM-sampled points. */
export function applyGeoidToStations(project, n0) {
  for (const s of project.stations || []) if (s.heightSource === 'dem' && Number.isFinite(s.H)) s.h = s.H + n0;
}
