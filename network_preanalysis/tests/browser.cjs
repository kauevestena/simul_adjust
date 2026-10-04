/* Real mouse/form regression checks; synthetic Terrarium tiles make CI offline.
 * NETWORK_SCREENSHOTS=/tmp/path npm run test:browser --prefix network_preanalysis
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
  let p = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root + path.sep) && p !== root) { res.writeHead(403); res.end(); return; }
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    res.setHeader('Content-Type', /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.png') ? 'image/png' : p.endsWith('.json') ? 'application/json' : 'text/html');
    res.end(fs.readFileSync(p));
  } catch { res.writeHead(404); res.end(); }
});
let browser;
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1440,height:960}}), errors=[], external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('data:'))external.push(r.url());});
  const url=`http://127.0.0.1:${server.address().port}/network_preanalysis/`;
  await page.goto(url+'?lang=pt');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('14/14'));
  await page.evaluate(async()=>{window.__networkTestApp=await import('./app.mjs');});
  const state=()=>page.evaluate(async()=>(await import('./app.mjs')).getState());
  const result=()=>page.evaluate(async()=>{const r=(await import('./app.mjs')).getResult();return {rank:r.rank,solvable:r.solvable,dof:r.dof,h:r.worstHorizontal,rows:r.rows,invalid:r.invalidSights,precision:r.precision};});
  // The polling predicate must be synchronous: a Promise is itself truthy.
  const settle=(level=null)=>page.waitForFunction(level=>{const a=window.__networkTestApp;return !a.isBusy()&&(level===null||a.getState().level===level);},level);
  async function pointPos(id){return page.evaluate(async id=>{const a=await import('./app.mjs'),v=a.getView(),p=a.getState().points.find(p=>p.id===id),r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x+v.width/2+(p.E-v.center[0])*v.scale,y:r.y+v.height/2-(p.N-v.center[1])*v.scale};},id);}
  async function clickPoint(id){const p=await pointPos(id);await page.mouse.click(p.x,p.y);}
  async function field(id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');}
  async function screenshot(name){if(process.env.NETWORK_SCREENSHOTS){fs.mkdirSync(process.env.NETWORK_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.NETWORK_SCREENSHOTS,name+'.png')});}}
  const c=await page.locator('#canvas').boundingBox();assert.ok(c.width/1440>.75);
  await screenshot('01-default-pt');
  assert.equal((await result()).solvable,true);assert.equal((await state()).points.filter(p=>p.control==='fixed').length,2);
  assert.equal(external.length,0,'Level 0 must work without external requests');
  await page.click('[data-lang="en"]');assert.equal(await page.getAttribute('html','lang'),'en');
  assert.equal(await page.evaluate(()=>localStorage.getItem('monorepo_lang')),'en');
  assert.match(await page.getAttribute('a.portal','href'),/lang=en/);
  assert.match(await page.textContent('h1'),/Topographic/);
  const first=await result();await page.selectOption('#instrument','educational');assert.ok((await result()).h>first.h*2);
  await page.selectOption('#instrument','standard');
  await clickPoint('S02');const before=(await state()).points.find(p=>p.id==='S02');
  await field('p-HI','');await page.click('#apply-point');assert.equal(await page.locator('#error').isVisible(),true);assert.equal((await state()).points.find(p=>p.id==='S02').HI,before.HI);
  await field('p-HI',2.1);await page.click('#apply-point');assert.equal((await state()).points.find(p=>p.id==='S02').HI,2.1);
  await page.selectOption('#p-control','stochastic');await field('p-sigma-0',20);await page.click('#apply-point');assert.equal((await state()).points.find(p=>p.id==='S02').control,'stochastic');
  await page.selectOption('#p-control','unknown');
  const start=await pointPos('S02');await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+35,start.y-65,{steps:8});await page.mouse.up();
  assert.ok((await state()).points.find(p=>p.id==='S02').N>before.N+10);
  assert.notEqual((await result()).h,first.h);
  await page.click('#undo');assert.equal((await state()).points.find(p=>p.id==='S02').N,before.N);
  await page.click('#redo');assert.ok((await state()).points.find(p=>p.id==='S02').N>before.N+10);
  await page.click('#baseline');assert.equal(await page.locator('#comparison').isVisible(),true);
  await page.click('[data-tool="sighted_only"]');await page.mouse.click(c.x+c.width*.55,c.y+c.height*.22);
  const target=(await state()).points.at(-1);assert.equal(target.type,'sighted_only');assert.equal((await result()).solvable,false);
  await page.click('[data-tool="sight"]');await clickPoint(target.id);assert.match(await page.textContent('#error'),/origin must be a station/);
  await clickPoint('S01');await clickPoint(target.id);assert.equal((await result()).solvable,true);
  await page.uncheck('#s-distance');assert.equal((await result()).solvable,false);
  await page.check('#s-distance');assert.equal((await result()).solvable,true);
  await page.click('[data-tool="sight"]');await clickPoint('S03');await clickPoint(target.id);
  await page.locator('[data-effect]').first().click();await screenshot('02-reliability-en');
  await page.click('#matrices');assert.ok((await page.textContent('#matrix-content')).length>100);await page.selectOption('#matrix-choice','Σxx');await page.click('[data-close="matrix-dialog"]');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#save')]);
  const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(saved.points.length,6);
  await page.selectOption('#example','resection');assert.equal((await result()).rank,4);
  await page.selectOption('#example','intersection');assert.equal((await result()).rank,5);assert.ok((await state()).sights.every(s=>!s.components.distance));
  await page.selectOption('#example','weak');assert.ok((await result()).h>first.h*10);
  await page.locator('#file').setInputFiles({name:'network.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.waitForFunction(()=>document.querySelector('#file').value==='');await settle();assert.equal((await state()).points.length,6);
  await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>document.querySelector('#file').value==='');assert.equal(await page.locator('#error').isVisible(),true);assert.equal((await state()).points.length,6);
  await page.click('[data-tool="select"]');await clickPoint(target.id);await page.click('#delete-selected');assert.equal((await state()).points.length,5);assert.ok(!(await state()).sights.some(s=>s.to===target.id));
  // A synthetic RGB elevation fixture exercises the real browser decoder/loader.
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'synthetic-terrain.png'))}));
  await page.selectOption('#level','1');await settle(1);assert.equal((await state()).level,1,await page.textContent('#error'));
  assert.ok((await state()).points.some(p=>Math.abs(p.U)>.01));
  const vis=await page.evaluate(async()=>(await import('./app.mjs')).getVisibility());assert.equal(Object.keys(vis).length,8);
  for(const row of (await result()).rows)if(row.sightId)assert.equal(vis[row.sightId].status,'visible');
  // The terrain preview loads after the analytical result. Wait for its palette
  // at an empty canvas corner, so screenshots cannot pass with a blank map.
  await page.waitForFunction(()=>document.querySelector('#canvas').getContext('2d').getImageData(10,10,1,1).data[2]<220);
  await screenshot('03-rural');
  const rural=await state();await page.selectOption('#level','0');await settle(0);assert.ok((await state()).points.every(p=>p.U===0));
  // Rapid scenario switching cannot install a stale rural result over Level 0.
  await page.selectOption('#level','1');await page.selectOption('#level','0');await settle(0);assert.equal((await state()).level,0);
  await page.waitForTimeout(100);assert.equal((await state()).level,0);
  assert.ok(rural.heightDatum.includes('H'));
  // Level 2 exercises the pinned real street geometry with synthetic DEM pixels.
  await page.selectOption('#level','2');await settle(2);
  assert.equal(await page.locator('#street-attribution').isVisible(),true);
  assert.equal(await page.locator('#urban-tools').isVisible(),true);
  const urban=await state();assert.equal(urban.streetDataset,'pato-branco-streets-v1');
  assert.equal(urban.origin.lat,-26.229);assert.equal(urban.origin.lon,-52.671);
  const candidates=await page.evaluate(async()=>{
    const {nearestStreet}=await import('./network/constraints.mjs'),s=window.__networkTestApp.getConstraints();
    let far,near,near2;
    for(let E=-170;E<170;E+=6)for(let N=-100;N<130;N+=6){
      const p={E,N},r=nearestStreet(p,s.streets);
      if(r.distance>22&&!far)far=p;
      if(r.distance>8&&r.distance<12&&!near)near={...p,nearest:r.nearest};
      if(r.distance>8&&r.distance<12&&near&&!near2&&Math.hypot(E-near.E,N-near.N)>80)near2={...p,nearest:r.nearest};
    }
    return {far,near,near2};
  });assert.ok(candidates.far&&candidates.near&&candidates.near2);
  async function clickENU(p){const q=await page.evaluate(p=>{const v=window.__networkTestApp.getView(),r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x+v.width/2+(p.E-v.center[0])*v.scale,y:r.y+v.height/2-(p.N-v.center[1])*v.scale};},p);await page.mouse.click(q.x,q.y);return q;}
  await page.click('[data-tool="station"]');await clickENU(candidates.far);
  assert.match(await page.textContent('#error'),/More than 3 m/);assert.equal((await state()).points.length,5);
  await page.uncheck('#snap-streets');await clickENU(candidates.near);
  assert.equal((await state()).points.length,5);
  await page.check('#snap-streets');await clickENU(candidates.near);await settle(2);
  const added=(await state()).points.at(-1);assert.equal(added.type,'station');assert.equal((await state()).points.length,6);
  assert.ok(Math.hypot(added.E-candidates.near.nearest[0],added.N-candidates.near.nearest[1])<.01);
  await page.click('[data-tool="select"]');await clickPoint(added.id);
  await field('p-E',candidates.far.E);await field('p-N',candidates.far.N);await page.click('#apply-point');await settle(2);
  assert.match(await page.textContent('#error'),/More than 3 m/);
  assert.equal((await state()).points.at(-1).E,added.E,'typed coordinates cannot bypass the street rule');
  // Rejected drag leaves coordinates/history intact; legal drag snaps visibly.
  const dragStart=await pointPos(added.id);await page.mouse.move(dragStart.x,dragStart.y);await page.mouse.down();
  const farScreen=await page.evaluate(p=>{const v=window.__networkTestApp.getView(),r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x+v.width/2+(p.E-v.center[0])*v.scale,y:r.y+v.height/2-(p.N-v.center[1])*v.scale};},candidates.far);
  await page.mouse.move(farScreen.x,farScreen.y,{steps:5});assert.equal(await page.locator('#placement-feedback.invalid').isVisible(),true);await page.mouse.up();await settle(2);
  assert.equal((await state()).points.at(-1).E,added.E);
  await page.click('#undo');await settle(2);assert.equal((await state()).points.length,5);
  await page.click('#redo');await settle(2);assert.equal((await state()).points.length,6);
  const legalStart=await pointPos(added.id);await page.mouse.move(legalStart.x,legalStart.y);await page.mouse.down();
  const legalEnd=await page.evaluate(p=>{const v=window.__networkTestApp.getView(),r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x+v.width/2+(p.E-v.center[0])*v.scale,y:r.y+v.height/2-(p.N-v.center[1])*v.scale};},candidates.near2);
  await page.mouse.move(legalEnd.x,legalEnd.y,{steps:5});assert.match(await page.textContent('#placement-feedback'),/Snap to street/);await page.mouse.up();await settle(2);
  assert.ok(Math.hypot((await state()).points.at(-1).E-candidates.near2.nearest[0],(await state()).points.at(-1).N-candidates.near2.nearest[1])<.01);
  const validUrban=await state(),badUrban=structuredClone(validUrban);Object.assign(badUrban.points[0],candidates.far);
  await page.locator('#file').setInputFiles({name:'bad-urban.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(badUrban))});await page.waitForFunction(()=>document.querySelector('#file').value==='');await settle(2);
  assert.equal((await state()).points[0].E,validUrban.points[0].E,'off-street JSON must be rejected, not snapped');
  await clickPoint(added.id);await page.click('#delete-selected');await settle(2);
  await page.click('[data-tool="sighted_only"]');await clickENU(candidates.near);await settle(2);
  assert.equal((await state()).points.at(-1).type,'sighted_only');
  await page.click('[data-tool="select"]');await page.click('#fit-area');
  await page.waitForFunction(()=>{
    const c=document.querySelector('#canvas'),p=c.getContext('2d').getImageData(c.width/2-100,c.height/2-100,200,200).data;
    let terrainPixels=0;for(let i=2;i<p.length;i+=4)if(p[i]<220)terrainPixels++;
    return terrainPixels>20000;
  });
  await screenshot('05-urban-area');
  const [urbanDownload]=await Promise.all([page.waitForEvent('download'),page.click('#save')]);
  const urbanSaved=JSON.parse(fs.readFileSync(await urbanDownload.path(),'utf8'));
  await page.selectOption('#level','0');await settle(0);
  await page.locator('#file').setInputFiles({name:'urban.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(urbanSaved))});await page.waitForFunction(()=>document.querySelector('#file').value==='');await settle(2);
  assert.deepEqual((await state()).points.map(p=>[p.id,p.E,p.N]),urbanSaved.points.map(p=>[p.id,p.E,p.N]));
  // Editing only HI must preserve a legal boundary coordinate beyond the
  // inspector's displayed millimetres, rather than rounding it off the street.
  const boundary=await page.evaluate(async()=>{
    const {nearestStreet}=await import('./network/constraints.mjs'),s=window.__networkTestApp.getConstraints();
    for(const [a,b] of s.streets){
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      for(const sign of [-1,1]){
        const p={E:(a[0]+b[0])/2-sign*3*dy/length,N:(a[1]+b[1])/2+sign*3*dx/length};
        if(Math.abs(p.E)>500||Math.abs(p.N)>500)continue;
        const rounded={E:Number(p.E.toFixed(3)),N:Number(p.N.toFixed(3))};
        if(Math.abs(nearestStreet(p,s.streets).distance-3)<1e-8&&nearestStreet(rounded,s.streets).distance>3.00001)return p;
      }
    }
  });assert.ok(boundary);
  const boundaryNetwork=await state();Object.assign(boundaryNetwork.points[1],boundary);
  await page.locator('#file').setInputFiles({name:'boundary.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(boundaryNetwork))});await page.waitForFunction(()=>document.querySelector('#file').value==='');await settle(2);
  await page.click('[data-select-point="S01"]');await field('p-HI',2);await page.click('#apply-point');await settle(2);
  assert.equal((await state()).points[1].E,boundary.E);assert.equal((await state()).points[1].N,boundary.N);assert.equal((await state()).points[1].HI,2);
  const urbanVisibility=await page.evaluate(()=>window.__networkTestApp.getVisibility());
  for(const row of (await result()).rows)if(row.sightId)assert.equal(urbanVisibility[row.sightId].status,'visible');
  await page.selectOption('#level','1');await page.selectOption('#level','2');await page.selectOption('#level','0');await settle(0);
  assert.equal(await page.locator('#street-attribution').isVisible(),false);
  await page.selectOption('#level','2');await settle(2);
  await page.setViewportSize({width:390,height:844});
  if(await page.getAttribute('#toggle-panel','aria-expanded')==='true')await page.click('#toggle-panel');
  await page.click('#fit');await screenshot('04-mobile');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok((await page.locator('#canvas').boundingBox()).height>280);
  await page.click('#toggle-panel');await page.click('[data-lang="pt-BR"]');assert.match(await page.textContent('h1'),/Pré-análise/);
  assert.match(await page.textContent('#urban-note'),/edifícios/);
  // A missing street snapshot must leave the previous scenario usable. Retry
  // loads the real local file after the intentionally failed request.
  const failed=await browser.newPage();let rejectStreet=true;
  await failed.route('**/pato-branco-streets.geojson',route=>rejectStreet?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await failed.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',route=>route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'synthetic-terrain.png'))}));
  await failed.goto(url+'?lang=en');await failed.selectOption('#level','2');
  await failed.waitForFunction(()=>document.querySelector('#error').textContent.includes('Street geometry unavailable'));
  assert.equal(await failed.inputValue('#level'),'0');rejectStreet=false;
  await failed.selectOption('#level','2');await failed.waitForFunction(()=>document.querySelector('#canvas-level').textContent.includes('Pato Branco'));
  await failed.close();
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: canvas editing, control/sight models, precision, reliability, examples, JSON, rural/urban terrain, street constraints/snapping/imports/retry, PT/EN and mobile.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
