import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNumber, parseAngle, parseDelimited, parseJsonSource, parseSource, guessMapping, buildStations,
  sanitizeId, IMPORT_LIMIT } from '../model/importer.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const dms = (d, m, s) => d + m / 60 + s / 3600;

test('numbers with decimal point or comma, and thousands separators', () => {
  assert.equal(parseNumber('925,861'), 925.861); assert.equal(parseNumber('925.861'), 925.861);
  assert.equal(parseNumber('1.043,182'), 1043.182); assert.equal(parseNumber('1,043.182'), 1043.182);
  assert.equal(parseNumber('12 m'), 12); assert.equal(parseNumber('-3e2'), -300);
  assert.ok(Number.isNaN(parseNumber(''))); assert.ok(Number.isNaN(parseNumber('abc'))); assert.ok(Number.isNaN(parseNumber('1.2.3')));
});

test('angles: decimal, sexagesimal, hemisphere letters in English and Portuguese', () => {
  close(parseAngle('-25.4484', 'lat'), -25.4484); close(parseAngle('-25,4484', 'lat'), -25.4484);
  close(parseAngle(`25°26'54.1269"S`, 'lat'), -dms(25, 26, 54.1269));
  close(parseAngle(`S 25 26 54,1269`, 'lat'), -dms(25, 26, 54.1269));
  close(parseAngle('-49:13:51.4372', 'lon'), -dms(49, 13, 51.4372));
  close(parseAngle('49d13m51.4sW', 'lon'), -dms(49, 13, 51.4));
  close(parseAngle(`49°13'51"O`, 'lon'), -dms(49, 13, 51), 1e-12);
  close(parseAngle('35 L', 'lon'), 35); close(parseAngle('25 26 N', 'lat'), dms(25, 26, 0));
  close(parseAngle(`25°26'54"s`, 'lat'), -dms(25, 26, 54), 1e-12);
  close(parseAngle('25d26m54s', 'lat'), dms(25, 26, 54), 1e-12); // trailing "s" after a digit is seconds
  close(parseAngle('−25.5', 'lat'), -25.5); close(parseAngle('-25.5 S', 'lat'), -25.5);
  for (const bad of ['-25 N', `25°61'00"S`, '25 26 70', 'N 49 W', '12a', '']) assert.ok(Number.isNaN(parseAngle(bad, 'lat')), bad);
  assert.ok(Number.isNaN(parseAngle('49 N', 'lon')), 'N is not a longitude hemisphere');
});

test('GeoJSON with only coordinates: automatic IDs and DEM heights', () => {
  const geojson = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-49.23, -25.45] } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-49.10, -25.40] } },
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }] };
  const source = parseSource(JSON.stringify(geojson), 'bases.geojson');
  assert.equal(source.kind, 'json'); assert.equal(source.records.length, 2); assert.equal(source.skipped, 1);
  const mapping = guessMapping(source);
  assert.equal(mapping.coords, 'geometry'); assert.equal(mapping.id, null); assert.equal(mapping.h, null);
  const r = buildStations(source, mapping, { idPrefix: 'BASE' });
  assert.deepEqual(r.stations.map(s => s.id), ['BASE1', 'BASE2']);
  assert.equal(r.needsDem, 2); assert.ok(r.stations.every(s => s.h === null && s.heightSource === 'dem'));
  assert.deepEqual(r.bbox, [-49.23, -25.45, -49.1, -25.4]);
  const withZ = parseJsonSource({ type: 'Feature', id: 'K9', properties: null, geometry: { type: 'Point', coordinates: [-49.2, -25.4, 910.5] } });
  const m2 = guessMapping(withZ);
  assert.equal(m2.h, '@z'); assert.equal(m2.id, 'id');
  const r2 = buildStations(withZ, m2);
  assert.equal(r2.stations[0].id, 'K9'); assert.equal(r2.stations[0].h, 910.5); assert.equal(r2.stations[0].heightSource, 'file');
  const multi = parseJsonSource({ type: 'MultiPoint', coordinates: [[-49, -25], [-48, -24]] });
  assert.equal(buildStations(multi, guessMapping(multi)).valid, 2);
});

test('JSON with coordinates in properties, plain arrays and the bundled station file', () => {
  const props = parseJsonSource({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { nome: 'Marco A', latitude: '-25,40', longitude: '-49,20', altitude: '901,2' } }] });
  const m = guessMapping(props);
  assert.equal(m.coords, 'properties'); assert.equal(m.lat, 'latitude'); assert.equal(m.lon, 'longitude'); assert.equal(m.h, 'altitude'); assert.equal(m.name, 'nome');
  const r = buildStations(props, m);
  assert.equal(r.stations[0].lat, -25.4); assert.equal(r.stations[0].h, 901.2); assert.equal(r.stations[0].city, 'Marco A');
  const plain = parseJsonSource('[{"lat": -10, "lon": -40}, {"lat": -11, "lng": -41, "id": "AB 12"}]');
  const mp = guessMapping(plain);
  assert.equal(mp.lon, 'lon'); // first matching key
  const rp = buildStations(plain, { ...mp, lon: 'lon' });
  assert.equal(rp.valid, 1); assert.equal(rp.rows[1].error, 'importBadCoordinate');
  const bundled = readFileSync(new URL('../data/rbmc-stations.json', import.meta.url), 'utf8');
  const own = parseSource(bundled, 'rbmc-stations.json'), mo = guessMapping(own);
  assert.equal(mo.coords, 'properties'); assert.equal(mo.id, 'id'); assert.equal(mo.h, 'h');
  const ro = buildStations(own, mo);
  assert.equal(ro.valid, 141); assert.equal(ro.stations.find(s => s.id === 'UFPR').h, 925.861);
  assert.equal(ro.stations.find(s => s.id === 'PRCV').status, 'inactive');
});

test('delimited text: headers in Portuguese, semicolons with decimal commas, DMS, quotes, spaces', () => {
  const a = parseDelimited('código;latitude;longitude;altitude;cidade\nUFPR;-25,44836778;-49,23095501;925,861;Curitiba\nPRPI;-25,3867;-49,1265;910,018;"Pinhais; PR"');
  assert.equal(a.delimiter, ';'); assert.equal(a.hasHeader, true);
  const ma = guessMapping(a);
  assert.deepEqual([ma.id, ma.lat, ma.lon, ma.h, ma.name], [0, 1, 2, 3, 4]);
  const ra = buildStations(a, ma);
  assert.equal(ra.stations[0].lat, -25.44836778); assert.equal(ra.stations[1].city, 'Pinhais; PR');
  const b = parseDelimited(`id,lat,lon\nM1,25°26'54.1"S,49°13'51.4"W\nM2,"25 30 00 S","49 10 00 W"`);
  const rb = buildStations(b, guessMapping(b), { heightMode: 'constant', constantHeight: 900 });
  close(rb.stations[0].lat, -dms(25, 26, 54.1)); close(rb.stations[1].lon, -dms(49, 10, 0));
  assert.ok(rb.stations.every(s => s.h === 900 && s.heightSource === 'constant'));
  const c = parseDelimited('-25.40 -49.20\n-25.41 -49.21\n-25.42 -49.22');
  assert.equal(c.delimiter, 'space'); assert.equal(c.hasHeader, false);
  const mc = guessMapping(c);
  assert.deepEqual([mc.lat, mc.lon, mc.id], [0, 1, -1]);
  const rc = buildStations(c, mc);
  assert.deepEqual(rc.stations.map(s => s.id), ['IMP1', 'IMP2', 'IMP3']); assert.equal(rc.needsDem, 3);
  const d = parseDelimited('P1\t-49.2\t-25.4\t900\nP2\t-49.3\t-25.5\t910');
  const md = guessMapping(d); // headerless; no value exceeds 90, so latitude is assumed first
  assert.equal(d.delimiter, '\t'); assert.equal(md.id, 0); assert.equal(md.h, 3);
  const tsv = parseDelimited('P1\t-120.5\t35.1');
  const mt = guessMapping(tsv);
  assert.deepEqual([mt.lat, mt.lon], [2, 1], 'a value beyond ±90 can only be a longitude');
});

test('validation report: out-of-range values suggest swapping, duplicates are renamed, statuses normalised', () => {
  const s = parseDelimited('id,lat,lon,status\nA,-49.2,-25.4,ativa\nB,-120.1,35.0,inoperante\nA,-25.6,-49.4,x');
  const m = guessMapping(s);
  const r = buildStations(s, m);
  assert.equal(r.rows[0].error, undefined); // -49.2 is still a valid latitude
  assert.equal(r.rows[1].error, 'importOutOfRange'); assert.equal(r.swapSuggested, true);
  assert.deepEqual(r.stations.map(x => x.id), ['A', 'A-2']); assert.equal(r.renamed, 1);
  assert.deepEqual(r.stations.map(x => x.status), ['active', 'active']);
  const swapped = buildStations(s, m, { swap: true });
  assert.equal(swapped.rows[1].error, undefined); assert.equal(swapped.rows[1].status, 'inactive');
  assert.equal(sanitizeId('  Base UTFPR #1 '), 'Base_UTFPR_1'); assert.equal(sanitizeId('__x'), 'x');
  assert.equal(sanitizeId('a'.repeat(30)).length, 20);
  const projected = parseDelimited('id,x,y\nE1,677000.5,7183000.2');
  const rp = buildStations(projected, guessMapping(projected));
  assert.equal(rp.valid, 0); assert.equal(rp.rows[0].error, 'importOutOfRange'); assert.equal(rp.swapSuggested, false);
});

test('errors for empty, malformed, pointless and oversized inputs', () => {
  assert.throws(() => parseDelimited('\n# only a comment\n'), /importEmpty/);
  assert.throws(() => parseSource('{"type":"FeatureCollection"', 'x.geojson'), /importJson/);
  assert.throws(() => parseJsonSource({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } }] }), /importNoPoints/);
  assert.throws(() => parseJsonSource('{"hello": 1}'), /importJson/);
  const big = 'lat,lon\n' + Array.from({ length: IMPORT_LIMIT + 1 }, () => '-25,-49').join('\n');
  assert.throws(() => parseDelimited(big), /importTooLarge/);
});
