import test from "node:test";
import assert from "node:assert/strict";
import {lateralErrorMeters,illustrativeRoute,PORTALS} from "../model.mjs";
test("zero angular error gives zero lateral deviation",()=>assert.equal(lateralErrorMeters(38,0),0));
test("one arcsecond over 20 km yields about 0.097 metres",()=>assert.ok(Math.abs(lateralErrorMeters(20,1)-0.0969627)<0.00001));
test("negative bearing error changes the sign",()=>assert.ok(lateralErrorMeters(10,-2)<0));
test("invalid inputs are rejected",()=>{for(const args of [[-1,2],[10,NaN],[10,324000],[Infinity,1]])assert.throws(()=>lateralErrorMeters(...args),RangeError)});
test("the route begins at UK portal and ends at French portal",()=>{assert.deepEqual(illustrativeRoute(0)[0],PORTALS.uk);assert.deepEqual(illustrativeRoute(1)[1],PORTALS.fr)});
test("route progress is bounded",()=>{assert.deepEqual(illustrativeRoute(-1),illustrativeRoute(0));assert.deepEqual(illustrativeRoute(2),illustrativeRoute(1))});

import {adjustTraverse, monitoringExercise, ARCSEC_TO_RAD} from '../model.mjs';
test('bearing model matches independent 45 degree geometry and odd symmetry',()=>{
  assert.ok(Math.abs(lateralErrorMeters(1,45*3600)-1000)<1e-10);
  for(const d of [0,10,20,38])for(const a of [.5,2,20])assert.ok(Math.abs(lateralErrorMeters(d,a)+lateralErrorMeters(d,-a))<1e-12);
});
test('both angular singularities, infinity and negative distance reject',()=>{
  for(const a of [[1,-324000],[NaN,1],[1,Infinity],[1,-Infinity]])assert.throws(()=>lateralErrorMeters(...a),RangeError);
});
test('open optical traverse equals summed observations and analytic covariance',()=>{
  const r=adjustTraverse(5,false), s=3000*ARCSEC_TO_RAD;
  assert.ok(Math.abs(r.endpoint-(30+.5)*s)<1e-11);
  assert.ok(Math.abs(r.sigma-Math.sqrt(6)*2*s)<1e-11);assert.equal(r.dof,0);
});
test('least squares equals independent per-leg weighted means and satisfies normal equations',()=>{
  const r=adjustTraverse(5,true), scale=3000*ARCSEC_TO_RAD;
  let expected=0,variance=0;
  for(let i=0;i<6;i++){
    const obs=r.observations.filter(o=>o.leg===i), w=obs.reduce((s,o)=>s+1/o.sigma**2,0);
    expected+=obs.reduce((s,o)=>s+o.value/o.sigma**2,0)/w;variance+=1/w;
  }
  assert.ok(Math.abs(r.endpoint-expected)<1e-11);assert.ok(Math.abs(r.sigma-Math.sqrt(variance))<1e-11);assert.equal(r.dof,3);
  for(let i=0;i<6;i++)assert.ok(Math.abs(r.observations.reduce((s,o)=>s+o.a[i]*o.residual/o.sigma**2,0))<1e-8);
  assert.ok(r.sigma<adjustTraverse(5,false).sigma);assert.ok(r.endpoint>scale,'gyro does not magically remove all bias');
});
test('monitoring separates datum shift from movement under stable references',()=>{
  for(const d of [-20,0,20]){const r=monitoringExercise(8,d);assert.ok(Math.abs(r.corrected-8.3)<1e-12);assert.ok(Math.abs(r.datum-d)<1e-12);assert.ok(Math.abs(r.sigma-Math.sqrt(8/3))<1e-12);}
});
test('unstable control biases monitoring and is disclosed',()=>{
  const r=monitoringExercise(8,5,true);assert.ok(Math.abs(r.corrected-(8.3-10/3))<1e-12);assert.equal(r.unstable,true);
  assert.throws(()=>monitoringExercise(NaN,0),RangeError);assert.throws(()=>adjustTraverse(Infinity),RangeError);
});
