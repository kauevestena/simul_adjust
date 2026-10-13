import test from 'node:test';import assert from 'node:assert/strict';
import {evaluate,defaults,series,controls} from '../model.mjs';
import {messages,detectLang} from '../i18n.mjs';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('reference example and independent ray perturbations',()=>{
 close(evaluate(defaults).parallel,.08838834764831845);
 for(const base of [.1,.5,2,10,20])for(const mode of ['parallel','convergent']){
  const p={...defaults,base},r=evaluate(p),turn=mode==='convergent'?r.theta:0;
  const u0=mode==='parallel'?r.fpx*base/(2*p.distance):0;
  // Intersect two perturbed rays, independently of the propagated closed form.
  const depth=(u,v)=>base/(Math.tan(turn+Math.atan(u/r.fpx))-Math.tan(-turn+Math.atan(v/r.fpx)));
  const h=.001,du=(depth(u0+h,-u0)-depth(u0-h,-u0))/(2*h),dv=(depth(u0,-u0+h)-depth(u0,-u0-h))/(2*h);
  close(Math.hypot(du,dv)*p.sigma,r[mode],1e-6);
 }
});
test('scaling, field of view and invalid inputs',()=>{
 const r=evaluate(defaults);close(evaluate({...defaults,sigma:10}).convergent,2*r.convergent);
 close(evaluate({...defaults,width:12000}).convergent,r.convergent/2);
 assert.equal(evaluate({...defaults,base:20}).visibleParallel,false);
 assert.equal(evaluate({...defaults,base:15}).visibleParallel,true);
 for(const k of Object.keys(controls))for(const v of [0,-1,NaN,Infinity])assert.throws(()=>evaluate({...defaults,[k]:v}));
 assert.equal(series(defaults).length,40);assert.equal(series(defaults)[39].base,20);
});
test('translations and language precedence',()=>{
 assert.deepEqual(Object.keys(messages.en).sort(),Object.keys(messages['pt-BR']).sort());
 assert.equal(detectLang('pt','en','en'),'pt-BR');assert.equal(detectLang(null,'en','pt-BR'),'en');assert.equal(detectLang(null,null,'pt-PT'),'pt-BR');
});
