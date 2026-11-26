// Station import: GeoJSON/JSON and delimited text (CSV, TSV, semicolons, spaces) to station
// records. UI-independent: the wizard maps columns/properties, this module parses and validates.
// Heights may come from the file, the Z coordinate, a constant or the DEM (sampled by the app).
export const IMPORT_LIMIT = 5000;
export const IMPORTED_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,19}$/;
const MAX_LAT = 85; // MapLibre / Web Mercator limit used across the simulator

const strip = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9φλ]/g, '');
const SYNONYMS = {
  id: ['id', 'codigo', 'cod', 'code', 'sigla', 'station', 'estacao', 'stationid', 'site', 'marco', 'vertice', 'ponto', 'point', 'identificador'],
  name: ['name', 'nome', 'city', 'cidade', 'municipio', 'local', 'localidade', 'descricao', 'description', 'label', 'rotulo', 'title'],
  lat: ['lat', 'latitude', 'phi', 'φ', 'y', 'latdd', 'latdeg', 'latgraus', 'lat4326'],
  lon: ['lon', 'lng', 'long', 'longitude', 'lambda', 'λ', 'x', 'londd', 'londeg', 'longraus', 'lon4326'],
  h: ['h', 'height', 'alt', 'altitude', 'elev', 'elevation', 'z', 'helip', 'altelip', 'altitudeelipsoidal', 'ellipsoidalheight', 'he', 'hgt'],
  status: ['status', 'situacao', 'state', 'estado'],
};
const matches = (name, field) => SYNONYMS[field].includes(strip(name));

/** Decimal number with dot or comma (a final separator wins if both appear: 1.043,182 or 1,043.182). */
export function parseNumber(value) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '').trim().replace(/\s*m$/i, '');
  if (!s) return NaN;
  const dot = s.lastIndexOf('.'), comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (comma >= 0) s = s.replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

/**
 * Latitude or longitude in decimal degrees from decimal or sexagesimal text:
 * -25.4484 · -25,4484 · 25°26'54.13"S · S 25 26 54,13 · -49:13:51.4 · 49d13m51.4sW · 49°13'51"O (Oeste) · 35 L (Leste).
 */
export function parseAngle(value, kind) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '').trim().replace(/[′’´]/g, "'").replace(/[″”]/g, '"').replace(/º/g, '°').replace(/''/g, '"');
  if (!s) return NaN;
  // Hemisphere letter at the start (any case) or at the end: upper case, or lower case after a
  // space, quote or degree sign (a bare trailing "s" after a digit is the seconds unit).
  const hemi = s.match(/^([NSEWLO])\s*/i) || s.match(/\s*([NSEWLO])$/) || s.match(/(?<=[\s"'°])([nsewlo])$/);
  let hemiNegative = null;
  if (hemi) {
    const h = hemi[1].toUpperCase();
    if (!(kind === 'lat' ? 'NS' : 'EWLO').includes(h)) return NaN;
    hemiNegative = 'SWO'.includes(h);
    s = (s.slice(0, hemi.index) + s.slice(hemi.index + hemi[0].length)).trim();
  }
  let negative = false;
  if (/^[-−]/.test(s)) { negative = true; s = s.slice(1).trim(); } else if (s.startsWith('+')) s = s.slice(1).trim();
  if (negative && hemiNegative === false) return NaN; // "-25 N" is contradictory
  const sign = negative || hemiNegative ? -1 : 1;
  const plain = parseNumber(s);
  if (Number.isFinite(plain)) return sign * plain;
  const parts = s.replace(/(\d),(\d)/g, '$1.$2').split(/[°:dms'"\s]+/i).filter(Boolean);
  if (parts.length < 2 || parts.length > 3 || !parts.every(p => /^\d+(\.\d+)?$/.test(p))) return NaN;
  const [d, m, sec = 0] = parts.map(Number);
  if (!Number.isInteger(d) || m >= 60 || sec >= 60 || (parts.length === 3 && !Number.isInteger(m))) return NaN;
  return sign * (d + m / 60 + sec / 3600);
}

// ---------- delimited text ----------
function splitLine(line, delimiter) {
  if (delimiter === 'space') return line.trim().split(/\s+/);
  const out = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"' && cell.trim() === '') { quoted = true; cell = ''; }
    else if (c === delimiter) { out.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  out.push(cell.trim());
  return out;
}
export function detectDelimiter(lines) {
  const sample = lines.slice(0, 30);
  for (const d of ['\t', ';', '|', ',']) {
    const counts = sample.map(l => splitLine(l, d).length - 1);
    const mode = counts.sort((a, b) => counts.filter(x => x === b).length - counts.filter(x => x === a).length)[0];
    if (mode >= 1 && sample.filter(l => splitLine(l, d).length - 1 === mode).length >= Math.ceil(sample.length * 0.8)) return d;
  }
  return sample.every(l => l.trim().split(/\s+/).length >= 2) ? 'space' : ',';
}
const numericish = cell => Number.isFinite(parseNumber(cell)) || Number.isFinite(parseAngle(cell, 'lat')) || Number.isFinite(parseAngle(cell, 'lon'));
export function parseDelimited(text, { delimiter = 'auto', header = 'auto' } = {}) {
  if (typeof text !== 'string' || text.length > 5e6) throw Error('importTooLarge');
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length) throw Error('importEmpty');
  const d = delimiter === 'auto' ? detectDelimiter(lines) : delimiter;
  const table = lines.map(l => splitLine(l, d));
  const first = table[0], second = table[1] || [];
  const known = first.some(c => Object.keys(SYNONYMS).some(f => matches(c, f)));
  const hasHeader = header === 'auto' ? known || first.filter(numericish).length < second.filter(numericish).length : Boolean(header);
  const width = Math.max(...table.map(r => r.length));
  const columns = Array.from({ length: width }, (_, i) => (hasHeader && first[i]) || `#${i + 1}`);
  const rows = (hasHeader ? table.slice(1) : table);
  if (rows.length > IMPORT_LIMIT) throw Error('importTooLarge');
  return { kind: 'table', delimiter: d, hasHeader, columns, rows };
}

// ---------- GeoJSON / JSON ----------
const scalar = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
export function parseJsonSource(text) {
  let data;
  try { data = typeof text === 'string' ? JSON.parse(text.replace(/^﻿/, '')) : text; } catch { throw Error('importJson'); }
  let items = [];
  if (Array.isArray(data)) items = data;
  else if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) items = data.features;
  else if (data?.type === 'Feature' || ['Point', 'MultiPoint'].includes(data?.type)) items = [data];
  else if (Array.isArray(data?.stations)) items = data.stations; // e.g. data/rbmc-stations.json
  else throw Error('importJson');
  const records = []; let skipped = 0;
  for (const item of items) {
    const geometry = item?.type === 'Feature' ? item.geometry : ['Point', 'MultiPoint'].includes(item?.type) ? item : null;
    const raw = item?.type === 'Feature' ? item.properties || {} : geometry ? {} : item || {};
    const props = Object.fromEntries(Object.entries(raw).filter(([, v]) => scalar(v)));
    if (item?.type === 'Feature' && item.id != null && props.id == null) props.id = item.id;
    if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) records.push({ coords: geometry.coordinates, props });
    else if (geometry?.type === 'MultiPoint' && Array.isArray(geometry.coordinates)) geometry.coordinates.forEach(c => records.push({ coords: c, props }));
    else if (geometry) skipped++;
    else if (Object.keys(props).length) records.push({ coords: null, props });
    else skipped++;
    if (records.length > IMPORT_LIMIT) throw Error('importTooLarge');
  }
  if (!records.length) throw Error('importNoPoints');
  const keys = [...new Set(records.flatMap(r => Object.keys(r.props)))];
  return { kind: 'json', records, keys, skipped, hasZ: records.some(r => Array.isArray(r.coords) && Number.isFinite(r.coords[2])) };
}

export function parseSource(text, fileName = '') {
  const trimmed = String(text ?? '').replace(/^﻿/, '').trimStart();
  if (/\.(geo)?json$/i.test(fileName) || trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonSource(trimmed);
  return parseDelimited(String(text ?? ''));
}

// ---------- mapping ----------
const pick = (names, field, taken = []) => names.findIndex((n, i) => !taken.includes(i) && matches(n, field));
export function guessMapping(source) {
  if (source.kind === 'json') {
    const keys = source.keys, find = field => keys.find(k => matches(k, field)) ?? null;
    const coords = source.records.some(r => Array.isArray(r.coords)) ? 'geometry' : 'properties';
    const h = find('h');
    return { coords, lat: find('lat'), lon: find('lon'), id: find('id'), name: find('name'),
      h: h ?? (source.hasZ ? '@z' : null), status: find('status') };
  }
  const { columns, rows } = source, taken = [];
  const take = i => { if (i >= 0) taken.push(i); return i; };
  let lat = take(pick(columns, 'lat')), lon = take(pick(columns, 'lon'));
  if (lat < 0 || lon < 0) {
    // No header names: the first two columns whose values all parse as angles, latitude first
    // unless the first one exceeds ±90 (then it can only be a longitude).
    const numeric = columns.map((_, i) => i).filter(i => !taken.includes(i) && rows.length && rows.slice(0, 50).every(r => Number.isFinite(parseAngle(r[i], 'lon'))));
    if (numeric.length >= 2) {
      const [a, b] = numeric, big = i => rows.slice(0, 50).some(r => Math.abs(parseAngle(r[i], 'lon')) > 90);
      [lat, lon] = big(a) && !big(b) ? [b, a] : [a, b];
      taken.push(lat, lon);
    }
  }
  let h = take(pick(columns, 'h'));
  if (h < 0 && !source.hasHeader) {
    const next = columns.map((_, i) => i).find(i => !taken.includes(i) && rows.slice(0, 50).every(r => Number.isFinite(parseNumber(r[i]))));
    h = take(next ?? -1);
  }
  let id = take(pick(columns, 'id'));
  const name = take(pick(columns, 'name')), status = take(pick(columns, 'status'));
  if (id < 0) id = take(columns.map((_, i) => i).find(i => !taken.includes(i) && rows.slice(0, 50).some(r => r[i] && !numericish(r[i]))) ?? -1);
  return { lat, lon, h, id, name, status };
}

export const sanitizeId = value => String(value ?? '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[_.-]+/, '').slice(0, 20);
/** First free "ID-2", "ID-3"… that still fits in 20 characters. */
export function withSuffix(id, taken) {
  for (let k = 2; ; k++) {
    const suffix = `-${k}`, candidate = `${id.slice(0, 20 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
function normalizeStatus(value, fallback) {
  const s = strip(value);
  if (['active', 'ativa', 'ativo', 'operante', 'operacional', 'on', '1', 'true', 'sim', 'yes'].includes(s)) return 'active';
  if (['inactive', 'inativa', 'inativo', 'inoperante', 'off', '0', 'false', 'nao', 'no', 'removed', 'removida'].includes(s)) return 'inactive';
  return fallback;
}
function field(source, record, key) {
  if (key == null || key === -1 || key === '') return undefined;
  return source.kind === 'json' ? record.props[key] : record[key];
}

/**
 * Apply a mapping. Returns all rows with their parsed values or the reason they are rejected,
 * the valid station records (h null where the DEM must be sampled), a bounding box and whether
 * the coordinates look swapped. options: { swap, idPrefix, heightMode: 'file' | 'dem' | 'constant',
 * constantHeight, defaultStatus, network }.
 */
export function buildStations(source, mapping, options = {}) {
  const { swap = false, idPrefix = 'IMP', heightMode = 'file', constantHeight = 0, defaultStatus = 'active', network = 'import' } = options;
  const prefix = (sanitizeId(idPrefix) || 'IMP').slice(0, 12); // room for the counter within 20 characters
  const records = source.kind === 'json' ? source.records : source.rows;
  const rows = [], stations = [], used = new Set();
  let auto = 0, renamed = 0;
  records.forEach((record, index) => {
    let latRaw, lonRaw, zRaw;
    if (source.kind === 'json' && mapping.coords === 'geometry') {
      if (!Array.isArray(record.coords)) { rows.push({ index, error: 'importNoCoordinates' }); return; }
      [lonRaw, latRaw, zRaw] = record.coords;
    } else { latRaw = field(source, record, mapping.lat); lonRaw = field(source, record, mapping.lon); }
    if (swap) [latRaw, lonRaw] = [lonRaw, latRaw];
    const lat = parseAngle(latRaw, 'lat'), lon = parseAngle(lonRaw, 'lon');
    const row = { index, lat, lon };
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { rows.push({ ...row, error: 'importBadCoordinate' }); return; }
    if (Math.abs(lat) > MAX_LAT || Math.abs(lon) > 180) { rows.push({ ...row, error: 'importOutOfRange' }); return; }
    let id = sanitizeId(field(source, record, mapping.id));
    if (!id || !IMPORTED_ID.test(id)) { do { id = `${prefix}${++auto}`; } while (used.has(id)); row.autoId = true; }
    if (used.has(id)) { id = withSuffix(id, used); row.renamed = true; renamed++; }
    used.add(id);
    let h = null, heightSource = 'dem';
    if (heightMode === 'constant') { h = constantHeight; heightSource = 'constant'; }
    else if (heightMode === 'file') {
      const value = mapping.h === '@z' ? zRaw : field(source, record, mapping.h);
      const parsed = value === undefined || value === null || value === '' ? NaN : parseNumber(value);
      if (Number.isFinite(parsed) && Math.abs(parsed) <= 12000) { h = parsed; heightSource = 'file'; }
    }
    const nameValue = field(source, record, mapping.name), rawId = field(source, record, mapping.id);
    const station = { id, name9: null, city: String(nameValue ?? (row.autoId || rawId == null ? '' : rawId)).slice(0, 80),
      status: mapping.status != null && mapping.status !== -1 ? normalizeStatus(field(source, record, mapping.status), defaultStatus) : defaultStatus,
      networks: [String(network || 'import').slice(0, 40)], agencies: [], lat, lon, h, coordSource: 'import', heightSource };
    rows.push({ ...row, id, h, heightSource, city: station.city, status: station.status });
    stations.push(station);
  });
  const valid = stations.length;
  const bbox = valid ? [Math.min(...stations.map(s => s.lon)), Math.min(...stations.map(s => s.lat)),
    Math.max(...stations.map(s => s.lon)), Math.max(...stations.map(s => s.lat))] : null;
  // Out-of-range latitudes that would be valid longitudes (and vice versa) suggest swapped columns.
  const outOfRange = rows.filter(r => r.error === 'importOutOfRange');
  const swapSuggested = !swap && outOfRange.length > 0 && outOfRange.every(r => Math.abs(r.lat) <= 180 && Math.abs(r.lon) <= MAX_LAT);
  return { rows, stations, valid, invalid: rows.length - valid, autoIds: auto, renamed,
    needsDem: stations.filter(s => s.h === null).length, bbox, swapSuggested };
}
