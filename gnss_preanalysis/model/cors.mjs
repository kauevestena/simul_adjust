// Continuously operating reference stations: bundled RBMC snapshot and user-imported lists.
export const DATASET_URL = new URL('../data/rbmc-stations.json', import.meta.url).href;
const R_EARTH = 6371008.8;
const rad = Math.PI / 180;

export function validateStations(list) {
  if (!Array.isArray(list) || list.length > 5000) throw Error('invalidCors');
  const ids = new Set();
  for (const s of list) {
    if (!s || typeof s.id !== 'string' || !/^[A-Z0-9]{4}$/.test(s.id) || ids.has(s.id) ||
        ![s.lat, s.lon, s.h].every(Number.isFinite) || Math.abs(s.lat) > 85 || Math.abs(s.lon) > 180 || Math.abs(s.h) > 12000)
      throw Error('invalidCors');
    ids.add(s.id);
  }
  return list;
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

// Imported lists: CSV "id,lat,lon,h[,city,status]" (decimal degrees, ellipsoidal h in m) or GeoJSON points.
export function parseCorsCsv(textValue) {
  if (typeof textValue !== 'string' || textValue.length > 2e6) throw Error('invalidCors');
  const lines = textValue.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) throw Error('invalidCors');
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].toLowerCase().split(sep).map(x => x.trim());
  const col = name => header.indexOf(name);
  const hasHeader = ['id', 'lat', 'lon'].every(k => col(k) >= 0);
  const idx = hasHeader ? { id: col('id'), lat: col('lat'), lon: col('lon'), h: col('h'), city: col('city'), status: col('status') }
    : { id: 0, lat: 1, lon: 2, h: 3, city: 4, status: 5 };
  const rows = (hasHeader ? lines.slice(1) : lines).map(line => {
    const c = line.split(sep).map(x => x.trim());
    const num = i => (i >= 0 && c[i] !== undefined && c[i] !== '' ? Number(c[i].replace(',', '.')) : NaN);
    return { id: String(c[idx.id] || '').toUpperCase().slice(0, 4), name9: null, city: idx.city >= 0 ? c[idx.city] || '' : '',
      status: idx.status >= 0 && c[idx.status] ? c[idx.status].toLowerCase() : 'active', networks: ['custom'], agencies: [],
      lat: num(idx.lat), lon: num(idx.lon), h: Number.isFinite(num(idx.h)) ? num(idx.h) : 0, coordSource: 'import' };
  });
  return validateStations(rows);
}
export function parseCorsGeoJson(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  const features = data?.type === 'FeatureCollection' ? data.features : null;
  if (!Array.isArray(features)) throw Error('invalidCors');
  return validateStations(features.filter(f => f?.geometry?.type === 'Point').map(f => {
    const [lon, lat, z] = f.geometry.coordinates, p = f.properties || {};
    return { id: String(p.id ?? p.ID ?? p.name ?? '').toUpperCase().slice(0, 4), name9: null, city: p.city || '',
      status: p.status || 'active', networks: ['custom'], agencies: [], lat, lon,
      h: Number.isFinite(p.h) ? p.h : Number.isFinite(z) ? z : 0, coordSource: 'import' };
  }));
}
