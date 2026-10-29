import test from 'node:test';
import assert from 'node:assert/strict';
import {driveExtentAt,remainingRockAt} from '../excavation_extent.mjs';

test('intact ground fills the full unexcavated Channel cross-section initially',()=>{
  const start=remainingRockAt(0);
  assert.deepEqual(start,{left:-10,right:10,width:20,center:0,closed:false,extent:0});
});
test('rock narrows continuously and symmetrically as the two faces approach',()=>{
  const stages=[0,.1,.4,.6,.88,.995,1].map(p=>remainingRockAt(p));
  for(let i=1;i<stages.length;i++){
    assert.ok(stages[i].width<stages[i-1].width,'no stagnant central gap between progress steps');
    assert.equal(stages[i].left,-stages[i].right);
  }
  assert.equal(remainingRockAt(.4).width,12);
  assert.ok(remainingRockAt(.995).width>0);
});
test('there is zero rock or unexplained void at 100 percent breakthrough',()=>{
  const end=remainingRockAt(1);
  assert.equal(end.left,0);
  assert.equal(end.right,0);
  assert.equal(end.width,0);
  assert.equal(end.closed,true);
  assert.equal(driveExtentAt(1,0),.5);
  assert.equal(driveExtentAt(1,1),.5);
  assert.equal(driveExtentAt(1,2),.5);
});
test('outer tunnels start later than the service tunnel but also meet',()=>{
  assert.equal(driveExtentAt(.1,0),0);
  assert.ok(driveExtentAt(.5,0)<driveExtentAt(.5,1));
  assert.equal(driveExtentAt(1,2),driveExtentAt(1,1));
});
test('out-of-range and nonfinite input never creates inverted rock bounds',()=>{
  for(const p of [-2,0,.1,.5,.9,1,10,NaN,Infinity,-Infinity]){
    for(const bore of [0,1,2]){
      const r=remainingRockAt(p,bore);
      assert.ok(r.left<=r.right);
      assert.ok(r.width>=0&&r.width<=20);
    }
  }
});
