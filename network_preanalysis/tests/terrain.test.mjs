import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTerrarium, decodeTerrarium, tilePixel, pixelResolution } from '../../shared/terrarium.mjs';
import { createRuralTerrain, lineOfSight, networkVisibility } from '../network/terrain.mjs';
import { makePoint } from '../network/model.mjs';
import { example } from '../network/scenarios.mjs';
import { analyze } from '../network/preanalysis.mjs';
import { llhToEnu } from '../network/coordinates.mjs';

test('shared sampler preserves nivelamento z14/floor pixels and RGB decoding', async()=>{
  assert.equal(decodeTerrarium(137,219,68),2523.265625);
  const p=tilePixel(-49.236,-25.448);assert.equal(p.zoom,14);
  const n=2**14, phi=-25.448*Math.PI/180;
  assert.equal(p.x,Math.floor((-49.236+180)/360*n));
  assert.equal(p.py,Math.floor((((1-Math.log(Math.tan(phi)+1/Math.cos(phi))/Math.PI)/2*n)%1)*256));
  assert.ok(pixelResolution(-25.45)>8&&pixelResolution(-25.45)<9);
  let count=0;
  const data=new Uint8ClampedArray(256*256*4);for(let i=0;i<data.length;i+=4)data.set([131,150,128,255],i);
  const t=createTerrarium({loadTile:async()=>{count++;return data;}});
  assert.deepEqual(await Promise.all([t.sample(-49.236,-25.448),t.sample(-49.236,-25.448)]),[918.5,918.5]);assert.equal(count,1);
  assert.ok(tilePixel(180,0).x<2**14);assert.throws(()=>tilePixel(0,90));
});
test('missing / nodata tiles reject without a synthetic 100 m fallback; retry works',async()=>{
  let first=true;
  const t=createTerrarium({loadTile:async()=>{if(first){first=false;throw Error('offline');}return new Uint8ClampedArray(256*256*4);}});
  await assert.rejects(t.sample(0,0));await assert.rejects(t.sample(0,0));
  const source=readFileSync(new URL('../../nivelamento/app.js',import.meta.url),'utf8');
  assert.match(source,/import\('\.\.\/shared\/terrarium\.mjs'\)/);
  assert.match(source,/this\.terrain\.sample\(lng, lat\)/);
  assert.doesNotMatch(source,/return 100\.000/);
});
test('flat, blocked, tangent, height-dependent and unavailable terrain LOS',async()=>{
  const a=makePoint('a',0,0),b=makePoint('b',100,0),flat={resolution:10,sample:async()=>0};
  assert.equal((await lineOfSight(a,b,flat)).status,'visible');
  const hill={resolution:10,sample:async e=>e>40&&e<60?4:0};
  const blocked=await lineOfSight(a,b,hill);assert.equal(blocked.status,'blocked');assert.ok(blocked.minimumClearance<0);assert.ok(blocked.obstruction.E>40);assert.ok(blocked.sampleSpacing<=5);
  a.HI=b.HT=5;assert.equal((await lineOfSight(a,b,hill)).status,'visible');
  a.HI=b.HT=4;assert.equal((await lineOfSight(a,b,hill)).status,'visible');
  b.HT=0;assert.equal((await lineOfSight(a,b,hill)).status,'blocked');
  assert.equal((await lineOfSight(a,b,{resolution:10,sample:async()=>NaN})).status,'missing');
});
test('rural H + N0 -> LLH -> ECEF -> ENU, retaining the height distinction',async()=>{
  const config={lat:-25.45,lon:-49.07,geoidUndulation:15,bounds:[-500,-500,500,500]};
  const terrain=await createRuralTerrain(config,{metadata:{},sample:async()=>900});
  assert.equal(terrain.origin.h,915);
  const ground=await terrain.ground(400,200);
  assert.equal(ground.H,900);assert.equal(ground.h,915);
  const enu=llhToEnu({lat:ground.lat,lon:ground.lon,h:ground.h},terrain.origin);
  assert.ok(Math.abs(enu[0]-400)<1e-5);assert.ok(Math.abs(enu[1]-200)<1e-5);assert.ok(ground.U<0);assert.ok(Math.abs(ground.U)<.1);
  await assert.rejects(terrain.sample(600,0));
});
test('Level 1 excludes blocked or missing sights and never treats terrain U as control',async()=>{
  const n=example();n.level=1;n.origin={lat:-25.45,lon:-49.07,h:900};n.geoidUndulation=0;
  const noTerrain=analyze(n);assert.equal(noTerrain.observationCount,0);assert.equal(noTerrain.solvable,false);
  const flat={resolution:10,sample:async()=>0};
  const vis=await networkVisibility(n,flat);const full=analyze(n,vis);assert.equal(full.solvable,true);assert.equal(full.parameters.filter(p=>p.axis==='U').length,3);
  vis[n.sights[0].id]={status:'blocked'};const blocked=analyze(n,vis);assert.equal(blocked.observationCount,full.observationCount-3);assert.equal(blocked.invalidSights[0].code,'terrainBlocked');
});
