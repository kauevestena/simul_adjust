import test from 'node:test';
import assert from 'node:assert/strict';
import {surveySequenceAt,WALL_STATION_COUNT} from '../survey_sequence.mjs';

test('the teaching sequence starts with surface GNSS and portal transfer',()=>{
  const start=surveySequenceAt(0);
  assert.equal(start.phase,'gnss-transfer');
  assert.equal(start.instrument,-1);
  assert.equal(start.reached,0);
  assert.equal(start.showOutsideGNSS,true);
  assert.equal(start.showPortalTransfer,true);
});
test('an instrument occupies the current bracket, a prism the forward bracket',()=>{
  const a=surveySequenceAt(.18);
  assert.equal(a.phase,'wall-traverse');
  assert.equal(a.instrument,0);
  assert.equal(a.prism,1);
  assert.equal(a.backsight,-1);
  assert.equal(a.reached,2);
});
test('the former prism becomes an instrument when the traverse advances',()=>{
  const before=surveySequenceAt(.18),after=surveySequenceAt(.37);
  assert.equal(after.instrument,before.prism);
  assert.equal(after.prism,after.instrument+1);
  assert.equal(after.backsight,before.instrument);
  assert.equal(after.showOutsideGNSS,false);
});
test('positions are bounded, deterministic and never exceed the available brackets',()=>{
  for(const progress of [-2,0,.11,.12,.24,.25,.40,.75,1,2,NaN]){
    const a=surveySequenceAt(progress),b=surveySequenceAt(progress);
    assert.deepEqual(a,b);
    assert.ok(a.reached<=WALL_STATION_COUNT);
    if(a.instrument>=0)assert.equal(a.prism,a.instrument+1);
  }
  assert.equal(surveySequenceAt(1).prism,WALL_STATION_COUNT-1);
});


test('surface GNSS and portal descent have continuous, distinct phases',()=>{
  const a=surveySequenceAt(.02),b=surveySequenceAt(.04);
  assert.equal(a.phase,'gnss-transfer');
  assert.equal(a.subphase,'surface');
  assert.ok(b.surfaceProgress>a.surfaceProgress);
  const c=surveySequenceAt(.07),d=surveySequenceAt(.105);
  assert.equal(c.subphase,'portal');
  assert.equal(d.subphase,'portal');
  assert.ok(d.transferProgress>c.transferProgress);
  assert.equal(c.showPortalTransfer,true);
  assert.equal(surveySequenceAt(.04).showPortalTransfer,false);
});
test('every progress movement within a traverse leg changes its fractional state',()=>{
  const a=surveySequenceAt(.18),b=surveySequenceAt(.20);
  assert.equal(a.instrument,b.instrument);
  assert.ok(b.stepProgress>a.stepProgress,'camera and sight-line markers must move between mounts');
  const x=surveySequenceAt(.37),y=surveySequenceAt(.38);
  assert.equal(x.instrument,y.instrument);
  assert.ok(y.stepProgress>x.stepProgress);
});
