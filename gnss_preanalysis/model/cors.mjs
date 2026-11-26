// Continuously operating reference stations: bundled RBMC snapshot and user-imported lists.
import { IMPORTED_ID, IMPORT_LIMIT } from './importer.mjs';

export const DATASET_URL = new URL('../data/rbmc-stations.json', import.meta.url).href;
const R_EARTH = 6371008.8;
const rad = Math.PI / 180;

const STATUSES = ['active', 'inactive', 'unverified'];
export const HEIGHT_SOURCES = ['file', 'dem', 'constant', 'missing'];
/** strict: the bundled RBMC file (4-character IDs). Otherwise: imported stations (1–20 characters). */
export function validateStations(list, { strict = true } = {}) {
  if (!Array.isArray(list) || list.length > IMPORT_LIMIT) throw Error('invalidCors');
  const ids = new Set();
  for (const s of list) {
    if (!s || typeof s.id !== 'string' || !(strict ? /^[A-Z0-9]{4}$/ : IMPORTED_ID).test(s.id) || ids.has(s.id) ||
        ![s.lat, s.lon, s.h].every(Number.isFinite) || Math.abs(s.lat) > 85 || Math.abs(s.lon) > 180 || Math.abs(s.h) > 12000 ||
        (!strict && (!STATUSES.includes(s.status) || typeof s.city !== 'string' || s.city.length > 80 ||
          !Array.isArray(s.networks) || s.networks.length > 5 || !s.networks.every(n => typeof n === 'string' && n.length <= 40) ||
          (s.heightSource != null && !HEIGHT_SOURCES.includes(s.heightSource)) || (s.H != null && !Number.isFinite(s.H)))))
      throw Error('invalidCors');
    ids.add(s.id);
  }
  return list;
}
/** Bundled stations overlaid by the project's imported ones (same ID: the imported one wins). */
export function mergeStations(bundled, imported = []) {
  const ids = new Set(imported.map(s => s.id));
  return [...bundled.filter(s => !ids.has(s.id)), ...imported];
}
export async function loadDataset(fetchImpl = fetch) {
  const response = await fetchImpl(DATASET_URL);
  if (!response.ok) throw Error('corsMissing');
  const data = await response.json();
  validateStations(data.stations);
  return data;
}

export function haversine(a, b) {
  const dphi = (b.lat - a.lat) * rad, dl = (b.lon - a.lon) * rad;
  const h = Math.sin(dphi / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function nearestStation(stations, point, { maxMeters = Infinity, statuses = null } = {}) {
  let best = null, distance = Infinity;
  for (const s of stations) {
    if (statuses && !statuses.includes(s.status)) continue;
    const d = haversine(point, s);
    if (d < distance) { distance = d; best = s; }
  }
  return best && distance <= maxMeters ? { station: best, distance } : null;
}
