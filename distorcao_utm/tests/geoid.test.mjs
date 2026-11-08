import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGeoidLoader, sampleGeoid, tilesFor, decodeResiduals, TILE } from '../geoid.mjs';
import * as M from '../model.mjs';

const dataDir = new URL('../data/egm2008-5/', import.meta.url);
const fileFetch = async url => {
  const b = fs.readFileSync(new URL(url));
  return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
const loader = createGeoidLoader({ base: dataDir.href, fetchImpl: fileFetch });
const nodes = JSON.parse(fs.readFileSync(new URL('./geoid-node-fixture.json', import.meta.url))).samples;
const cubic = JSON.parse(fs.readFileSync(new URL('./geoid-cubic-reference.json', import.meta.url))).samples;
const box = (lat, lon, d = 0.01) => ({ latMin: lat - d, latMax: lat + d, lonMin: lon - d, lonMax: lon + d });

test('index.json matches the decoder constants; all 648 tiles exist', () => {
  const index = JSON.parse(fs.readFileSync(new URL('index.json', dataDir)));
  for (const k of ['perDegree', 'tileDegrees', 'nodes', 'marginBefore', 'rows', 'cols', 'offset', 'scale']) assert.equal(index[k], TILE[k], k);
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.bin'));
  assert.equal(files.length, 648);
});

test('planar predictor decoding round-trips', () => {
  const n = 5, v = Array.from({ length: n * n }, (_, k) => 30000 + ((k * 7919) % 500));
  const res = new Int16Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * n + j;
    res[k] = i === 0 && j === 0 ? v[0] - 32768 : i === 0 ? v[k] - v[k - 1] : j === 0 ? v[k] - v[k - n] : v[k] - v[k - 1] - v[k - n] + v[k - n - 1];
  }
  assert.deepEqual([...decodeResiduals(res, n)], v);
});

test('decoded tiles reproduce the egm2008-5.pgm node values (3 mm quantum)', async () => {
  for (const [lat, lon, N] of nodes) {
    const patch = await loader.patch(box(lat, lon));
    assert.ok(Math.abs(sampleGeoid(patch, lat, lon) - N) < 1e-4, `${lat},${lon}`);
  }
});

test('bicubic sampling agrees with GeographicLib cubic (pygeodesy) within 3 cm, incl. tile seams', async () => {
  let worst = 0;
  for (const [lat, lon, N] of cubic) {
    const patch = await loader.patch(box(lat, lon, 0.2));
    const d = Math.abs(sampleGeoid(patch, lat, lon) - N);
    worst = Math.max(worst, d);
    assert.ok(d < 0.03, `${lat},${lon}: ${sampleGeoid(patch, lat, lon)} vs ${N}`);
  }
  assert.ok(worst < 0.03);
});

test('Timbuktu (16°46′33″N, 3°00′34″W): EGM2008 ≈ 28.789 m', async () => {
  const lat = 16 + 46 / 60 + 33 / 3600, lon = -(3 + 34 / 3600);
  const N = sampleGeoid(await loader.patch(box(lat, lon)), lat, lon);
  assert.ok(Math.abs(N - 28.789) < 0.01, String(N));
});

test('continuity across a tile seam and the antimeridian', async () => {
  for (const [lat, lon] of [[30, -170], [20, 0], [-40, 180]]) {
    const patch = await loader.patch({ latMin: lat - 0.5, latMax: lat + 0.5, lonMin: lon - 0.5, lonMax: lon + 0.5 });
    const a = sampleGeoid(patch, lat + 1e-7, lon - 1e-7), b = sampleGeoid(patch, lat - 1e-7, lon + 1e-7);
    assert.ok(Math.abs(a - b) < 1e-4, `${lat},${lon}`);
    assert.ok(patch.tiles.length >= 2, 'the box straddles tiles');
  }
});

test('only the tiles of the area are requested', () => {
  const p = M.normalizeParams({});
  assert.deepEqual(tilesFor(M.areaBounds(p)), ['r11c12.bin']);
  assert.equal(tilesFor({ latMin: -0.5, latMax: 0.5, lonMin: 9.5, lonMax: 10.5 }).length, 4);
});

test('with the geoid on, heights become H = h − N and only the vertical metric changes', async () => {
  const p = M.normalizeParams({ spanWE: 40000, spanNS: 40000, grid: 3, buildingDensity: 0.05, terrainDensity: 0.0002, geoid: true, lat: 45.9, lon: 7.0 });
  const patch = await loader.patch(M.areaBounds(p));
  const off = M.simulate({ ...p, geoid: false }, { gridSize: 21, geoidPatch: patch });
  const on = M.simulate(p, { gridSize: 21, geoidPatch: patch });
  assert.ok(Number.isFinite(on.context.geoidN0) && on.context.useGeoid && !off.context.useGeoid);
  assert.deepEqual(on.ppm, off.ppm);
  let maxDiff = 0;
  for (let i = 0; i < on.grid.fields.dz.length; i++) {
    const expected = off.grid.fields.dz[i] - (on.grid.fields.geoidN[i] - on.context.geoidN0);
    maxDiff = Math.max(maxDiff, Math.abs(on.grid.fields.dz[i] - expected));
  }
  assert.ok(maxDiff < 1e-3, String(maxDiff));
  for (let i = 0; i < on.grid.fields.dg.length; i++) {
    assert.ok(Math.abs(on.grid.fields.dg[i] + (on.grid.fields.geoidN[i] - on.context.geoidN0)) < 1e-4);
  }
  assert.equal(off.dg, null);
  assert.equal(on.dg.length, on.ppm.length);
  const span = Math.max(...on.grid.fields.geoidN) - Math.min(...on.grid.fields.geoidN);
  assert.ok(span > 0.3, `the Alps make the geoid vary: ${span}`);
});
