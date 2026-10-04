import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { clipSegment, nearestStreet, validatePointPlacement, resolvePointPlacement, validateNetworkPlacement } from '../network/constraints.mjs';
import { PATO_BRANCO, projectStreets } from '../network/streets.mjs';
import { urbanExample, example } from '../network/scenarios.mjs';
import { serialize, deserialize } from '../network/model.mjs';
import { analyze } from '../network/preanalysis.mjs';
import { createTerrain, networkVisibility } from '../network/terrain.mjs';

const data = JSON.parse(readFileSync(new URL('../data/pato-branco-streets.geojson', import.meta.url)));
const origin = { lat: PATO_BRANCO.lat, lon: PATO_BRANCO.lon, h: 760 };
const scene = projectStreets(data, origin);
const straight = { level: 2, bounds: [-100, -100, 100, 100], streets: [[[-50, 0], [50, 0]]] };
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a-b) <= tolerance, `${a} != ${b}`);

test('street limit is inclusive, metric, and uses segment endpoints and all streets', () => {
  assert.equal(validatePointPlacement({E: 0, N: 3}, straight).valid, true);
  assert.equal(validatePointPlacement({E: 0, N: -3}, straight).valid, true);
  assert.equal(validatePointPlacement({E: 0, N: 3.00001}, straight).valid, false);
  close(nearestStreet({E: 53, N: 4}, straight.streets).distance, 5);
  const lines = [[[100,100],[100,100]], [[0,0],[10,10]], [[0,20],[20,20]]];
  close(nearestStreet({E: 5, N: 7}, lines).distance, Math.SQRT2);
  assert.equal(nearestStreet({E: 7, N: 21}, lines).streetIndex, 2);
  assert.equal(validatePointPlacement({E: 0, N: 0}, {level:2}).reason, 'streetsMissing');
  assert.equal(validatePointPlacement({E: NaN, N: 0}, straight).reason, 'coordinateRange');
});

test('optional snapping preserves valid offsets, has a 15 m limit, and cannot bypass bounds', () => {
  const valid = resolvePointPlacement({E: 0, N: 2.5}, straight, true);
  assert.equal(valid.snapped, false); close(valid.position.N, 2.5);
  const snapped = resolvePointPlacement({E: 0, N: 15}, straight, true);
  assert.equal(snapped.valid, true); assert.equal(snapped.snapped, true); close(snapped.position.N, 0);
  assert.equal(resolvePointPlacement({E: 0, N: 15.0001}, straight, true).valid, false);
  assert.equal(resolvePointPlacement({E: 0, N: 8}, straight, false).valid, false);
  assert.equal(resolvePointPlacement({E: 101, N: 0}, straight, true).reason, 'outsideTerrain');
});

test('street clipping keeps snapping candidates inside the loaded extent', () => {
  assert.deepEqual(clipSegment([-20,0],[20,0],[-10,-10,10,10]),[[-10,0],[10,0]]);
  assert.deepEqual(clipSegment([0,-20],[0,20],[-10,-10,10,10]),[[0,-10],[0,10]]);
  assert.equal(clipSegment([-20,11],[20,11],[-10,-10,10,10]),null);
  assert.deepEqual(clipSegment([0,0],[0,0],[-10,-10,10,10]),[[0,0],[0,0]]);
  for (const line of scene.streets) for (const [E,N] of line)
    assert.ok(E>=-650 && E<=650 && N>=-650 && N<=650);
});

test('pinned Pato Branco data preserves OSM identity, source metadata and content integrity', () => {
  assert.equal(data.features.length, 288);
  assert.equal(data.metadata.license, 'ODbL-1.0');
  assert.match(data.metadata.source, /^https:\/\/api.openstreetmap.org\/api\/0.6\/map/);
  assert.equal(createHash('sha256').update(JSON.stringify(data.features)).digest('hex'), data.metadata.features_sha256);
  assert.ok(data.features.some(f=>f.id==='way/157632420' && f.properties.name==='Avenida Brasil'));
  for (const f of data.features) {
    assert.ok(f.properties.osm_version>0); assert.match(f.properties.osm_timestamp,/^\d{4}-/);
    assert.equal(f.geometry.coordinates.length, f.properties.osm_nodes.length);
  }
  assert.ok(scene.streets.length>300); assert.equal(scene.streets.length,scene.streetFeatures.length);
  assert.throws(()=>projectStreets({...data,features:[]},origin),/streetsMissing/);
  assert.throws(()=>projectStreets({...data,metadata:{id:'untrusted'}},origin),/streetsMissing/);
});

test('urban JSON binds the street snapshot and geographic frame; every point must satisfy placement', () => {
  const n=urbanExample(scene); assert.deepEqual(deserialize(serialize(n)),n);
  assert.doesNotThrow(()=>validateNetworkPlacement(n,scene));
  const wrongOrigin=structuredClone(n);wrongOrigin.origin.lon+=.01;
  assert.throws(()=>deserialize(JSON.stringify(wrongOrigin)),/urbanReference/);
  const wrongDataset=structuredClone(n);wrongDataset.streetDataset='different';
  assert.throws(()=>deserialize(JSON.stringify(wrongDataset)),/urbanReference/);
  const invalid=structuredClone(n);
  // Locate a true block interior in the real geometry, independently of UI snapping.
  let interior;
  for(let E=-550;E<550&&!interior;E+=20)for(let N=-550;N<550;N+=20)
    if(nearestStreet({E,N},scene.streets).distance>20){interior={E,N};break;}
  assert.ok(interior);Object.assign(invalid.points[1],interior,{active:false,type:'sighted_only'});
  assert.throws(()=>validateNetworkPlacement(invalid,scene),/streetDistance/);
  assert.throws(()=>validateNetworkPlacement(n,null),/streetsMissing/);
  assert.throws(()=>validateNetworkPlacement(n,{...scene,origin:{...origin,h:origin.h+10}}),/urbanReference/);
  assert.equal(analyze(invalid,{},scene).diagnostics[0].code,'streetDistance');
  assert.equal(analyze(n).diagnostics[0].code,'streetsMissing');
  // The same horizontal position remains allowed in unconstrained rural mode.
  assert.equal(validatePointPlacement(interior,{level:1,bounds:scene.bounds}).valid,true);
  assert.equal(analyze(example()).solvable,true);
});

test('urban terrain supplies design heights while the generic solver retains unknown U', async () => {
  const terrain=await createTerrain(PATO_BRANCO,{metadata:{},sample:async()=>760});
  const s=projectStreets(data,terrain.origin),n=urbanExample(s);
  await Promise.all(n.points.map(async p=>Object.assign(p,{U:(await terrain.ground(p.E,p.N)).U})));
  const vis=await networkVisibility(n,terrain),r=analyze(n,vis,s);
  assert.equal(r.rank,14);assert.equal(r.solvable,true);assert.equal(r.observationCount,24);
  assert.equal(r.parameters.filter(p=>p.axis==='U').length,3);
  assert.equal(n.points.filter(p=>p.control==='fixed').length,2);
  assert.ok(n.points.some(p=>Math.abs(p.U)>.001));
  vis[n.sights[0].id]={status:'blocked'};vis[n.sights[1].id]={status:'missing'};
  const excluded=analyze(n,vis,s);
  assert.equal(excluded.observationCount,18);
  assert.deepEqual(excluded.invalidSights.slice(0,2).map(x=>x.code),['terrainBlocked','terrainMissing']);
  assert.equal(analyze(n,{},s).observationCount,0);
});
