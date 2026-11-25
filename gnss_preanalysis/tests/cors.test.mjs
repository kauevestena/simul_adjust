import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateStations, nearestStation, haversine, parseCorsCsv, parseCorsGeoJson } from '../model/cors.mjs';

const data = JSON.parse(readFileSync(new URL('../data/rbmc-stations.json', import.meta.url), 'utf8'));
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
const dms = text => { const [d, m, s] = text.trim().split(/\s+/); return (d.startsWith('-') ? -1 : 1) * (Math.abs(+d) + +m / 60 + +s / 3600); };

test('RBMC snapshot: integrity, provenance and checksum', () => {
  const { metadata, stations } = data;
  validateStations(stations);
  assert.equal(metadata.count, stations.length);
  assert.equal(stations.length, 141);
  assert.deepEqual(metadata.statusCounts, { active: 117, inactive: 22, unverified: 2 });
  assert.ok(stations.every(s => ['active', 'inactive', 'unverified'].includes(s.status)), 'removed stations are not offered');
  assert.ok(stations.every(s => s.networks.includes('RBMC')));
  assert.ok(stations.every(s => s.lat > -34 && s.lat < 5.5 && s.lon > -74.5 && s.lon < -34), 'inside Brazil');
  assert.deepEqual(metadata.excluded.map(e => e.id), ['MSMN', 'RJRE', 'SCBL', 'SCCR']);
  const canonical = JSON.stringify(sorted(stations));
  assert.equal(createHash('sha256').update(canonical).digest('hex'), metadata.stationsSha256);
  const list = readFileSync(new URL('../data/sources/sirgas-station-list-BRA-2026-11-24.txt', import.meta.url));
  assert.equal(createHash('sha256').update(list).digest('hex'), metadata.sources.stationList.sha256);
  const supplement = readFileSync(new URL('../data/sources/supplementary-coordinates.csv', import.meta.url));
  assert.equal(createHash('sha256').update(supplement).digest('hex'), metadata.sources.supplement.sha256);
});

test('approximate NGL coordinates agree with official IBGE SIRGAS2000 values to a few decimetres', () => {
  const rows = readFileSync(new URL('../data/sources/official-check-coordinates.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [id, lat, lon, h] = row.split(',');
    const s = data.stations.find(x => x.id === id), official = { lat: dms(lat), lon: dms(lon) };
    assert.equal(s.coordSource, 'ngl');
    assert.ok(haversine(s, official) < 0.3, `${id} horizontal ${haversine(s, official)}`);
    assert.ok(Math.abs(s.h - Number(h)) < 0.15, `${id} height`);
  }
  const prpi = data.stations.find(x => x.id === 'PRPI');
  assert.equal(prpi.coordSource, 'ibge_report'); assert.equal(prpi.h, 910.018);
});

test('nearest station and snapping radius', () => {
  const near = nearestStation(data.stations, { lat: -25.45, lon: -49.23 });
  assert.equal(near.station.id, 'UFPR'); assert.ok(near.distance < 300);
  assert.equal(nearestStation(data.stations, { lat: -25.45, lon: -49.23 }, { maxMeters: 50 }), null);
  const active = nearestStation(data.stations, { lat: -24.96, lon: -53.47 }, { statuses: ['active'] });
  assert.equal(active.station.id, 'PRCL', 'inactive PRCV is skipped when only active stations are allowed');
  assert.ok(Math.abs(haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111195) < 5);
});

test('imported CORS lists: CSV with or without header, semicolons and GeoJSON', () => {
  const a = parseCorsCsv('id,lat,lon,h,city\nabcd,-10.5,-40.25,120.5,Somewhere\nEFGH,-10.6,-40.3,99,Else');
  assert.deepEqual(a.map(s => s.id), ['ABCD', 'EFGH']); assert.equal(a[0].h, 120.5); assert.equal(a[0].networks[0], 'custom');
  const b = parseCorsCsv('# comment\nWXYZ;-10,5;-40,25;12');
  assert.equal(b[0].lat, -10.5); assert.equal(b[0].lon, -40.25);
  assert.throws(() => parseCorsCsv('id,lat,lon\nAB,-10,-40'), /invalidCors/);
  assert.throws(() => parseCorsCsv('id,lat,lon\nABCD,-100,-40'), /invalidCors/);
  assert.throws(() => parseCorsCsv('id,lat,lon\nABCD,-10,-40\nABCD,-11,-40'), /invalidCors/);
  const g = parseCorsGeoJson({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'qrst' }, geometry: { type: 'Point', coordinates: [-45, -20, 800] } }] });
  assert.equal(g[0].id, 'QRST'); assert.equal(g[0].h, 800);
  assert.throws(() => parseCorsGeoJson({ type: 'Feature' }), /invalidCors/);
});
