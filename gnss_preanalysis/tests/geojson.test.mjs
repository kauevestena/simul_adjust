import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../model/analysis.mjs';
import { buildExample } from '../model/examples.mjs';
import { serialize, validateProject, makeSession, makeBaseline } from '../model/network.mjs';
import { projectToGeoJSON, projectFromGeoJSON, stringifyGeoJSON, readProject, MEMBER, GEOJSON_FORMAT } from '../model/geojson.mjs';
import { applyImport, addStationPoint, applyGeoidToStations, pointHeightSource } from '../model/stations.mjs';
import { parseSource, guessMapping, buildStations } from '../model/importer.mjs';

const { stations } = JSON.parse(readFileSync(new URL('../data/rbmc-stations.json', import.meta.url), 'utf8'));
const bundledIds = stations.map(s => s.id);
const station = (id, extra = {}) => ({ id, name9: null, city: '', status: 'active', networks: ['mine'], agencies: [], lat: -25.5, lon: -49.3, h: 900,
  coordSource: 'import', heightSource: 'file', ...extra });

/** A project that exercises every stored field. */
function richProject() {
  const p = buildExample('network', stations);
  p.title = 'campus';
  const [, , p1, p2, p3] = p.points;
  Object.assign(p1, { hSource: 'terrain', H: 912.25, h: 912.25 + 3 });
  Object.assign(p2, { control: 'stochastic', sigmaControl: [3, 4, 9], hSource: 'manual', h: 901.5 });
  Object.assign(p3, { setup: { centering: 2.5, height: 1.5 }, label: 'Marco 3 – praça' });
  p.settings = { ...p.settings, preset: 'rtk', aH: 8, bH: 1, aV: 15, bV: 1, geoidUndulation: 3, sessionCorrelation: true };
  p.sessions.push(makeSession('S5', 'Tarde', 45, 4));
  p.baselines.push({ ...makeBaseline('P1', 'P2', 'S5'), active: false });
  p.stations = [station('Base_1', { heightSource: 'dem', H: 897, h: 900 }), station('B2', { status: 'inactive', city: 'Pinhais; PR' })];
  return validateProject(p);
}

test('GeoJSON project: points + baselines with results, lossless round trip', () => {
  const p = richProject(), r = analyze(p), fc = projectToGeoJSON(p, r);
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc[MEMBER].format, GEOJSON_FORMAT);
  const points = fc.features.filter(f => f.geometry.type === 'Point'), lines = fc.features.filter(f => f.geometry.type === 'LineString');
  assert.equal(points.length, p.points.length); assert.equal(lines.length, p.baselines.length);
  assert.equal(points.length + lines.length, fc.features.length, 'only two geometry types: two layers in QGIS');
  const p2 = points.find(f => f.id === 'P2');
  assert.deepEqual(p2.geometry.coordinates, [p.points[3].lon, p.points[3].lat, 901.5], 'RFC 7946 position: lon, lat, ellipsoidal h');
  // Result attributes equal the analysis (mm, 1σ; azimuth in degrees from north).
  const precision = r.precision.P2;
  assert.equal(p2.properties.sigma_e_mm, Number((precision.sigma[0] * 1000).toFixed(3)));
  assert.equal(p2.properties.ell_major_mm, Number((precision.ellipse.major * 1000).toFixed(3)));
  assert.ok(p2.properties.ell_azim_deg >= 0 && p2.properties.ell_azim_deg < 180);
  const ufpr = points.find(f => f.id === 'UFPR').properties;
  assert.deepEqual([ufpr.sigma_e_mm, ufpr.ell_major_mm, ufpr.ell_azim_deg], [0, 0, null], 'fixed control: σ = 0');
  const line = lines.find(f => f.id === 'UFPR-P1@S1').properties, info = r.baselines['UFPR-P1@S1'];
  assert.equal(line.redundancy, Number(info.redundancyMean.toFixed(4)));
  assert.equal(line.mdb_u_mm, Number((info.mdb[2] * 1000).toFixed(3)));
  assert.equal(line.duration_min, 90); assert.equal(line.included, true);
  const inactive = lines.find(f => f.properties.session === 'S5').properties;
  assert.equal(inactive.active, false); assert.equal(inactive.redundancy, null, 'inactive baselines carry no results');
  // Text: valid JSON, one feature per line, and the same object back.
  const text = stringifyGeoJSON(fc);
  assert.deepEqual(JSON.parse(text), fc);
  assert.equal(text.split('\n').filter(l => l.trim().startsWith('{"type":"Feature"')).length, fc.features.length);
  assert.deepEqual(readProject(text), p);
  assert.deepEqual(readProject(`﻿${text}`), p, 'byte-order mark');
  assert.equal(projectToGeoJSON(p).features[0].properties.sigma_e_mm, null, 'without a result the attributes are null');
});

test('undetectable MDB and an underdetermined network are written as null', () => {
  const radial = buildExample('radial', stations), line = projectToGeoJSON(radial, analyze(radial)).features.find(f => f.geometry.type === 'LineString');
  assert.equal(line.properties.redundancy, 0); assert.deepEqual([line.properties.mdb_e_mm, line.properties.mdb_n_mm, line.properties.mdb_u_mm], [null, null, null]);
  const free = buildExample('network', stations); free.points.forEach(p => { p.control = 'free'; });
  const fc = projectToGeoJSON(free, analyze(free));
  assert.ok(fc.features.filter(f => f.geometry.type === 'Point').every(f => f.properties.sigma_e_mm === null));
  assert.equal(fc[MEMBER].summary.solvable, false);
});

test('a file edited in a GIS still opens: no foreign member, snapped lines, new points', () => {
  const p = richProject(), fc = JSON.parse(stringifyGeoJSON(projectToGeoJSON(p, analyze(p))));
  delete fc[MEMBER]; // some GIS software drops top-level members when saving
  const back = projectFromGeoJSON(fc);
  assert.deepEqual(back.points, p.points);
  assert.deepEqual(back.baselines, p.baselines);
  assert.deepEqual(back.sessions.map(s => [s.id, s.label, s.duration]), p.sessions.map(s => [s.id, s.label, s.duration]), 'sessions from the baseline attributes');
  assert.equal(back.settings.preset, 'static', 'default settings without the member');
  assert.equal(back.stations, undefined);
  // A point and a snapped line added in QGIS: no ID, no attributes except what QGIS writes.
  const p4 = fc.features.find(f => f.id === 'P4').geometry.coordinates;
  fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-49.3, -25.5] } });
  fc.features.push({ type: 'Feature', properties: { id: null }, geometry: { type: 'MultiLineString', coordinates: [[[-49.3, -25.5], p4.slice(0, 2)]] } });
  fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-48, -24], [-47, -23]] } }); // joins no points
  // P3 moved in the GIS (which kept its old Z) and its h_m emptied: the DEM is sampled again.
  const p3 = fc.features.find(f => f.id === 'P3');
  p3.geometry.coordinates = [-49.2, -25.49, p3.geometry.coordinates[2]]; p3.properties.h_m = null;
  const edited = projectFromGeoJSON(fc), added = edited.points.at(-1);
  assert.deepEqual(['lat', 'lon', 'hSource'].map(k => edited.points.find(x => x.id === 'P3')[k]), [-25.49, -49.2, 'pending']);
  assert.equal(added.id, 'P5'); assert.equal(added.hSource, 'pending', 'height sampled from the DEM by the app');
  assert.deepEqual(edited.baselines.at(-1), { id: 'P5-P4@S1', from: 'P5', to: 'P4', session: 'S1', active: true });
  assert.equal(edited.baselines.length, p.baselines.length + 1);
});

test('readProject: GeoJSON, older JSON, and files that are not projects', () => {
  const p = buildExample('long', stations);
  assert.deepEqual(readProject(serialize(p)), p, 'version-1 project JSON');
  const plain = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'x' }, geometry: { type: 'Point', coordinates: [-49, -25] } }] };
  assert.throws(() => readProject(JSON.stringify(plain)), /notProject/, 'a plain point file goes to the import wizard');
  assert.throws(() => readProject('lat,lon\n-25,-49'), /notProject/);
  assert.throws(() => readProject('{"format":"other"}'), /notProject/);
  const future = projectToGeoJSON(p); future[MEMBER].version = 2;
  assert.throws(() => readProject(JSON.stringify(future)), /invalidProject/);
  const broken = projectToGeoJSON(p); broken.features.find(f => f.geometry.type === 'LineString').properties.to = 'NOPE';
  assert.throws(() => readProject(JSON.stringify(broken)), /invalidBaseline/);
  assert.throws(() => readProject('x'.repeat(8e6 + 1)), /invalidProject/);
});

test('import modes: catalogue, control points and new points; conflicts; heights', () => {
  const base = () => buildExample('network', stations);
  // Catalogue only: rename, replace (the network point using the station moves), skip.
  let p = base(), s = applyImport(p, [station('UFPR', { lat: -25.44 }), station('NEW1')], { mode: 'stations', conflict: 'rename', bundledIds });
  assert.deepEqual(p.stations.map(x => x.id), ['UFPR-2', 'NEW1']); assert.deepEqual([s.count, s.conflicts, s.renamed, s.points], [2, 1, 1, 0]);
  validateProject(p);
  p = base(); applyImport(p, [station('UFPR', { lat: -25.44, h: 925, heightSource: 'file' })], { mode: 'stations', conflict: 'replace', bundledIds });
  assert.equal(p.points.find(x => x.corsId === 'UFPR').lat, -25.44, 'network point follows the replaced station');
  p = base(); s = applyImport(p, [station('UFPR')], { mode: 'stations', conflict: 'skip', bundledIds });
  assert.equal(p.stations.length, 0); assert.equal(s.skipped, 1);
  // A second import with the same IDs replaces the earlier imported records.
  applyImport(p, [station('A1', { lat: -25.6 })], { mode: 'stations', bundledIds }); applyImport(p, [station('A1', { lat: -25.7 })], { mode: 'stations', conflict: 'replace', bundledIds });
  assert.deepEqual(p.stations.map(x => [x.id, x.lat]), [['A1', -25.7]]);
  // Control points: heights keep their origin.
  p = base();
  s = applyImport(p, [station('D1', { heightSource: 'dem', H: 897, h: 900 }), station('C1', { heightSource: 'constant', h: 0 }), station('M1', { heightSource: 'missing' })],
    { mode: 'stochastic', bundledIds });
  const d1 = p.points.find(x => x.id === 'D1');
  assert.deepEqual([d1.kind, d1.control, d1.hSource, d1.H, d1.corsId], ['cors', 'stochastic', 'terrain', 897, 'D1']);
  assert.deepEqual(['C1', 'M1'].map(id => p.points.find(x => x.id === id).hSource), ['manual', 'missing']);
  assert.equal(s.points, 3); validateProject(p);
  applyGeoidToStations(p, 5); assert.equal(p.stations.find(x => x.id === 'D1').h, 902, 'h = H + N₀ follows N₀');
  // New points: a new point with the same ID moves; a CORS point is never moved (renamed instead).
  p = base();
  s = applyImport(p, [station('P1', { lat: -25.41, h: 950 }), station('UFPR'), station('Q1', { heightSource: 'dem', H: 880, h: 880 })], { mode: 'points', conflict: 'replace' });
  assert.equal(p.points.find(x => x.id === 'P1').lat, -25.41); assert.equal(p.points.find(x => x.id === 'P1').hSource, 'manual');
  assert.ok(p.points.some(x => x.id === 'UFPR-2' && x.kind === 'new')); assert.equal(p.points.find(x => x.id === 'Q1').hSource, 'terrain');
  assert.deepEqual([s.count, s.replaced, s.renamed, s.points], [3, 1, 1, 2]); validateProject(p);
  assert.equal(pointHeightSource({}), 'cors', 'bundled stations: station coordinates');
  assert.equal(addStationPoint(p, stations.find(x => x.id === 'UFPR')), 'UFPR', 'existing point reused');
});

test('a GeoJSON with only latitude and longitude goes from the file to a saved, reopened project', () => {
  const file = JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-49.31, -25.52] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-49.28, -25.47] } }] });
  const source = parseSource(file, 'campus.geojson'), built = buildStations(source, guessMapping(source), { idPrefix: 'CAMP', heightMode: 'file' });
  assert.deepEqual(built.stations.map(s => [s.id, s.h]), [['CAMP1', null], ['CAMP2', null]], 'automatic IDs; heights left to the DEM');
  built.stations.forEach((s, i) => Object.assign(s, { H: 900 + i, h: 903 + i, heightSource: 'dem' })); // what the app does after sampling
  const p = buildExample('network', stations);
  applyImport(p, built.stations, { mode: 'fixed', bundledIds });
  validateProject(p);
  const back = readProject(stringifyGeoJSON(projectToGeoJSON(p, analyze(p))));
  assert.deepEqual(back, p);
  assert.deepEqual(back.stations.map(s => s.id), ['CAMP1', 'CAMP2']);
});
