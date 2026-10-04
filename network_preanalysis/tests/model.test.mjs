import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { llhToEcef, ecefToLlh, ecefToEnu, llhToEnu, enuToLlh, WGS84 } from '../network/coordinates.mjs';
import { sightGeometry, sightJacobian, wrapPi, ARCSECOND } from '../network/observations.mjs';
import { analyze } from '../network/preanalysis.mjs';
import { errorEllipse, noncentrality, externalReliability } from '../network/reliability.mjs';
import { makePoint, makeSight, serialize, deserialize } from '../network/model.mjs';
import { example, validatePointPlacement } from '../network/scenarios.mjs';
import { covarianceBlock } from '../network/stochastic.mjs';
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a-b) <= tol, `${a} != ${b} (tol ${tol})`);

test('WGS84 equator, poles, ECEF/ENU axes and geographic round trips', () => {
  assert.deepEqual(llhToEcef({lat:0,lon:0,h:0}), [6378137,0,0]);
  close(llhToEcef({lat:90,lon:0,h:0})[2], WGS84.a*(1-WGS84.f), 1e-8);
  const o={lat:0,lon:0,h:0};
  assert.deepEqual(ecefToEnu([6378140,1,2],o),[1,2,3]);
  for(const llh of [{lat:-25.454,lon:-49.07,h:912.3},{lat:89.999,lon:179.9,h:2100},{lat:-90,lon:0,h:0},{lat:0,lon:180,h:-100}]) {
    const actual=ecefToLlh(llhToEcef(llh));
    close(actual.lat,llh.lat,1e-10);close(actual.lon,llh.lon,1e-10);close(actual.h,llh.h,2e-8);
  }
  const origin={lat:-25.45,lon:-49.07,h:930};
  const enu=[235,-193,42];
  llhToEnu(enuToLlh(enu,origin),origin).forEach((x,i)=>close(x,enu[i],2e-8));
  assert.throws(()=>llhToEcef({lat:100,lon:0,h:0}));
});
test('known 3D geometry and independent instrument/target heights', () => {
  const a=makePoint('a',0,0),b=makePoint('b',3,4); b.U=12;
  const g=sightGeometry(a,b);close(g.distance,13);close(g.zenith,Math.atan2(5,12));close(g.direction,Math.atan2(3,4));
  a.HI=2.5;b.HT=0.5;close(sightGeometry(a,b).delta[2],10);
  close(sightGeometry(a,b,{HT:2.5}).delta[2],12);
  a.omega=2*Math.PI-0.1;close(wrapPi(sightGeometry(a,b).direction-g.direction),0.1);
});
test('analytic derivatives versus central differences, all axes/heights/omega', () => {
  for(const [e,n,u] of [[13,27,5],[-35,18,-7],[0.0001,70,0],[1000,-900,160]]) {
    const a=makePoint('a',1,-2),b=makePoint('b',e,n);b.U=u;a.omega=2*Math.PI-1e-5;
    for(const c of ['direction','zenith','distance']) {
      const g=sightGeometry(a,b),j=sightJacobian(g,c);
      for(const [point,sign] of [[a,-1],[b,1]]) for(const [k,axis] of ['E','N','U'].entries()) {
        const h=1e-4, v=point[axis]; point[axis]=v+h;const plus=sightGeometry(a,b)[c];point[axis]=v-h;const minus=sightGeometry(a,b)[c];point[axis]=v;
        close((c==='direction'?wrapPi(plus-minus):plus-minus)/(2*h),j[k]*sign,2e-9);
      }
      for(const [point,axis,expected] of [[a,'HI',-j[2]],[b,'HT',j[2]],[a,'omega',c==='direction'?-1:0]]) {
        const h=1e-5,v=point[axis];point[axis]=v+h;const plus=sightGeometry(a,b)[c];point[axis]=v-h;const minus=sightGeometry(a,b)[c];point[axis]=v;
        close((c==='direction'?wrapPi(plus-minus):plus-minus)/(2*h),expected,2e-8);
      }
    }
  }
});
test('one fixed GNSS start + one fixed finish solves a generic reciprocal traverse', () => {
  const n=example(),r=analyze(n);assert.equal(n.points.filter(p=>p.control==='fixed').length,2);
  assert.equal(r.rank,14);assert.equal(r.solvable,true);assert.equal(r.dof,10);
  assert.ok(r.precision.S01.sigma.every(x=>x>0));
  close(r.rows.reduce((s,x)=>s+x.redundancy,0),r.dof,1e-10);
});
test('generic resection, oriented angle-only intersection, and distance-only network', () => {
  assert.equal(analyze(example('resection')).rank,4);
  const n=example('intersection');assert.equal(analyze(n).solvable,true);
  n.sights=n.sights.filter(s=>s.to==='P01');assert.equal(analyze(n).solvable,false);
  const d=example('resection');d.points.filter(p=>p.control==='fixed').forEach(p=>p.HT=5);
  d.sights.forEach(s=>s.components={direction:false,zenith:false,distance:true});
  const r=analyze(d);assert.equal(r.solvable,true);assert.equal(r.parameters.length,3);
});
test('rank diagnostics: disconnected, no control, one direction, no observations', () => {
  const n=example();n.points.push(makePoint('isolated',100,200));
  let r=analyze(n);assert.equal(r.solvable,false);assert.ok(r.diagnostics.some(x=>x.code==='disconnected'));
  assert.ok(r.diagnostics.some(x=>x.code==='pointUndetermined'&&x.id==='isolated'));assert.equal(r.covariance,null);
  n.points.pop();n.points.forEach(p=>p.control='unknown');r=analyze(n);assert.equal(r.defect,4);assert.ok(r.diagnostics.some(x=>x.code==='datumMissing'));
  n.sights=[n.sights[0]];r=analyze(n);assert.ok(r.diagnostics.some(x=>x.code==='orientationUnknown'));
  n.sights=[];r=analyze(n);assert.equal(r.rank,0);assert.ok(r.diagnostics.some(x=>x.code==='noObservations'));
});
test('covariance and reliability agree with independent finite-difference LAPACK/SciPy oracle', () => {
  const data=JSON.parse(readFileSync(new URL('./numerical-reference.json',import.meta.url)));
  for(const f of data.cases) {
    const r=analyze(f.network);assert.equal(r.solvable,true);
    assert.deepEqual(r.parameters.map(p=>[p.id,p.axis]),f.parameters);
    r.covariance.forEach((row,i)=>row.forEach((x,j)=>close(x,f.covariance[i][j],Math.max(1e-14,Math.abs(f.covariance[i][j])*2e-7))));
    r.rows.forEach((row,i)=>{
      close(row.redundancy,f.redundancy[i],2e-8);
      if(f.mdb[i]===null) assert.equal(row.mdb,Infinity);else close(row.mdb,f.mdb[i],f.mdb[i]*2e-6);
    });
    close(r.rows.reduce((s,x)=>s+x.redundancy,0),r.dof,1e-8);
    close(noncentrality(.001,.8),f.delta,1e-5);
  }
});
test('closed-form one polar target covariance with known backsight orientation', () => {
  const n=example('intersection');n.points=[makePoint('A',0,0,'station','fixed'),makePoint('B',0,100,'sighted_only','fixed'),makePoint('P',100,0,'sighted_only')];
  n.sights=[makeSight('A','B'),makeSight('A','P')];
  const r=analyze(n);assert.equal(r.solvable,true);
  close(r.precision.P.covariance[0][0],.002**2+(2e-6*100)**2,1e-14);
  close(r.precision.P.covariance[1][1],2*(2*ARCSECOND*100)**2,1e-14);
  close(r.precision.P.covariance[2][2],(2*ARCSECOND*100)**2,1e-14);
  assert.equal(r.rows.find(x=>x.to==='P'&&x.component==='distance').mdb,Infinity);
});
test('precision responds to instrument/control uncertainty and extra observations', () => {
  const n=example(),r=analyze(n);Object.keys(n.instrument).forEach(k=>n.instrument[k]*=2);
  close(analyze(n).precision.S02.sigma[0],r.precision.S02.sigma[0]*2,1e-12);
  n.points.filter(p=>p.control==='fixed').forEach(p=>p.control='stochastic');
  assert.ok(analyze(n).precision.S02.sigma[0]>r.precision.S02.sigma[0]);
  const m=example();m.sights.push(makeSight('S01','S03'));
  assert.ok(analyze(m).precision.S02.ellipse.major<=r.precision.S02.ellipse.major+1e-12);
});
test('correlated raw covariance uses original-observation redundancy and MDB', () => {
  const n=example('resection'),r=analyze(n),m=r.rows.length;
  n.observationCovariance=Array.from({length:m},(_,i)=>Array.from({length:m},(_,j)=>i===j?r.rows[i].sigma**2:0));
  n.observationCovariance[0][3]=n.observationCovariance[3][0]=.3*r.rows[0].sigma*r.rows[3].sigma;
  const c=analyze(n);assert.equal(c.solvable,true);close(c.rows.reduce((s,x)=>s+x.redundancy,0),c.dof,1e-8);
  assert.ok(c.rows[0].mdb>0);assert.notEqual(c.covariance[0][0],r.covariance[0][0]);
});
test('ellipse orientation, 2D confidence scaling, external reliability', () => {
  const e=errorEllipse([[4,0],[0,1]]);close(e.major,2);close(e.minor,1);close(e.azimuth,Math.PI/2);
  close(errorEllipse([[4,0],[0,1]],'95').major/2,2.44774683068,1e-10);
  const rotated=errorEllipse([[2.5,1.5],[1.5,2.5]]);close(rotated.theta,Math.PI/4);
  const r=analyze(example());const i=r.rows.findIndex(x=>x.redundancy>.2&&x.component==='distance');
  const ext=externalReliability(r,i);assert.ok(ext);assert.ok(Math.hypot(...ext.points.S01)>0);
  ext.dx.forEach((x,j)=>close(x,r.gain[j][i]*r.rows[i].mdb));
});
test('invalid inputs are diagnosed, impossible sights excluded, JSON round trip', () => {
  const n=example();n.instrument.directionArcsec=0;assert.equal(analyze(n).diagnostics[0].code,'invalidSigma');
  const s=example();s.sights.push(makeSight('S01','S01'));assert.ok(analyze(s).invalidSights.some(x=>x.code==='selfSight'));
  s.points[1].type='sighted_only';assert.ok(analyze(s).invalidSights.some(x=>x.code==='stationOrigin'));
  assert.throws(()=>covarianceBlock([[1,2],[2,1]],2));assert.throws(()=>covarianceBlock([[1,2],[0,1]],2));
  assert.deepEqual(deserialize(serialize(example())),example());assert.throws(()=>deserialize('{bad'));
  const bad=example();bad.points[0].E=null;assert.equal(analyze(bad).solvable,false);
  const negative=example();negative.points[0].HI=-1;assert.equal(analyze(negative).solvable,false);
});
test('placement API separates the future 3 metre urban rule from UI', () => {
  const scenario={level:2,streets:[[[0,0],[100,0]]]};
  assert.equal(validatePointPlacement({E:50,N:3},scenario).valid,true);
  assert.equal(validatePointPlacement({E:50,N:3.01},scenario).valid,false);
  assert.deepEqual(validatePointPlacement({E:50,N:4},scenario).nearest,[50,0]);
});
