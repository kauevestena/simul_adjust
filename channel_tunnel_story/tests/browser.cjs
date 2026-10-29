const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,firefox,webkit}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const LIVE=process.env.STORY_LIVE_MAP==='1';
const EXTERNAL_BASE=process.env.STORY_BASE_URL;
const SHOTS=process.env.STORY_SCREENSHOTS || path.join(__dirname,'../test-results');
const engine=process.env.STORY_BROWSER||'chromium';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.md':'text/plain'};
const server=http.createServer((req,res)=>{
  let file=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
const fixtureStyle={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#b8d9e3'}}]};
async function fixtures(context,fail='') {
  if(LIVE&&!fail)return;
  await context.route('https://tiles.openfreemap.org/**',route=>fail==='style'?route.abort():route.fulfill({json:fixtureStyle}));
  await context.route('https://s3.amazonaws.com/elevation-tiles-prod/**',route=>fail==='terrain'?route.abort():route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'fixtures/terrain.png'))}));
}
const input=async(page,id,value)=>page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
const noOverflow=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
async function axe(page) {
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],'accessibility violations');
}
(async()=>{
  console.log('Starting browser suite:',engine,LIVE?'live':'fixtures');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  console.log('HTTP server ready');
  const base=(EXTERNAL_BASE||`http://127.0.0.1:${server.address().port}`).replace(/\/$/,'');
  const browser=await({chromium,firefox,webkit}[engine]).launch({headless:!(engine==='firefox'&&process.env.DISPLAY),...(engine==='firefox'?{firefoxUserPrefs:{'webgl.force-enabled':true,'webgl.disabled':false}}:{}),...(process.env.STORY_PROXY?{proxy:{server:process.env.STORY_PROXY,bypass:'127.0.0.1,localhost'}}:{}),...(engine==='chromium'?{args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
  console.log('Browser ready');fs.mkdirSync(SHOTS,{recursive:true});
  try {
    for(const size of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740},{width:844,height:390}]) {
      const mobile=size.width<850;
      const ctx=await browser.newContext({ignoreHTTPSErrors:process.env.STORY_IGNORE_HTTPS_ERRORS==='1',viewport:size,locale:'en-US',reducedMotion:'reduce',hasTouch:mobile,...(engine!=='firefox'?{isMobile:mobile}:{})});
      await fixtures(ctx);const page=await ctx.newPage(),errors=[],responses=[];
      page.on('pageerror',e=>{errors.push(e.message);console.error('pageerror:',e.message);});
      if(process.env.STORY_DEBUG)page.on('console',m=>console.log(m.type(),m.text()));
      page.on('response',r=>{if(/openfreemap|elevation-tiles-prod/.test(r.url()))responses.push({url:r.url(),status:r.status()});});
      console.log('Opening story at',size.width);await page.goto(base+'/channel_tunnel_story/?lang=en');console.log('Document loaded');if(process.env.STORY_DEBUG)console.log(await page.evaluate(()=>({state:window.__story?.mapState,terrain:window.__story?.map?.getTerrain(),sources:window.__story?.map?.getStyle()?.sources})));
      await page.waitForFunction(()=>window.__story && window.__story.mapState==='ready',null,{timeout:60000}).catch(async e=>{await page.screenshot({path:path.join(SHOTS,'failure-map.png')});console.error(await page.evaluate(()=>({state:window.__story?.mapState,status:document.getElementById('mapStatus').textContent,loaded:window.__story?.map?.isStyleLoaded(),terrain:window.__story?.map?.getTerrain()})),errors);throw e;});
      assert.equal(await page.locator('.chapter').count(),7);assert.equal(await page.locator('html').getAttribute('lang'),'en');
      assert.equal(await page.evaluate(()=>window.__story.map.getTerrain().exaggeration),1.6);
      const elevation=await page.evaluate(()=>window.__story.map.queryTerrainElevation([1.16,51.1]));
      assert.ok(Number.isFinite(elevation),'terrain has decoded elevation');
      if(LIVE){assert.ok(responses.some(r=>/\.pbf|planet/.test(r.url)&&r.status===200),'live basemap tiles');assert.ok(responses.some(r=>r.url.includes('terrarium')&&r.status===200),'live DEM tiles');}
      await noOverflow(page);await page.screenshot({path:path.join(SHOTS,`${engine}-${size.width}-${LIVE?'live':'fixture'}-map.png`)});
      // Scroll and keyboard-driven chapter navigation both track the camera and active heading.
      for(let i=0;i<7;i++){
        await page.locator('#chapterNav button').nth(i).focus();await page.keyboard.press('Enter');
        await page.waitForFunction(i=>window.__story.active===i,i);
        assert.ok(Math.abs(await page.evaluate(()=>window.__story.mapProgress)-[0,.12,.23,.45,.7,1,1][i])<1e-9,'chapter progress tracks schematic map');
        await page.waitForFunction(expected=>!window.__story.cutaway || Math.abs(window.__story.cutaway.progress-expected)<1e-9,[0,.12,.23,.45,.7,1,1][i],{timeout:10000});
        assert.equal(await page.locator('#chapterNav button[aria-current=step]').count(),1);
        const visible=await page.locator('.chapter').nth(i).evaluate(el=>{const r=el.getBoundingClientRect(),stage=document.querySelector('.stage').getBoundingClientRect();const top=innerWidth<=850?stage.bottom:62;return r.top>=top-2&&r.top<innerHeight-20;});
        assert.ok(visible,'chapter heading not behind sticky map');
      }
      await page.locator('#chapter-control').evaluate(e=>e.scrollIntoView({behavior:'instant'}));await page.waitForFunction(()=>window.__story.active===1);
      await page.click('#pt');assert.equal(await page.locator('html').getAttribute('lang'),'pt-BR');assert.match(await page.locator('#chapter-control').textContent(),/Nortech/);
      assert.equal(await page.evaluate(()=>localStorage.getItem('monorepo_lang')),'pt-BR');assert.match(await page.locator('#back').getAttribute('href'),/lang=pt/);
      await input(page,'datumOffset',-0.50);
      assert.match(await page.locator('#heightResult').textContent(),/25,50 m/);
      const heightBefore=await page.locator('#frenchDatum').getAttribute('y1');
      await input(page,'datumOffset',0.70);
      assert.notEqual(await page.locator('#frenchDatum').getAttribute('y1'),heightBefore);
      await input(page,'angle',20);await page.selectOption('#distance','38');assert.equal(await page.locator('#modelOutput').textContent(),'3,685 m');
      const bearingBefore=await page.locator('#bearingRay').getAttribute('y2');
      await input(page,'angle',-20);assert.equal(await page.locator('#modelOutput').textContent(),'-3,685 m');
      assert.notEqual(await page.locator('#bearingRay').getAttribute('y2'),bearingBefore);
      const opticalLine=await page.locator('#opticalTrack').getAttribute('points');
      const withGyro=await page.locator('#traverseResult').textContent();await page.uncheck('#gyro');assert.notEqual(await page.locator('#traverseResult').textContent(),withGyro);
      await input(page,'bias',-7);
      assert.notEqual(await page.locator('#opticalTrack').getAttribute('points'),opticalLine);
      await input(page,'movement',8);await input(page,'datumShift',20);assert.match(await page.locator('#monitorResult').textContent(),/8,3 ± 3,20/);
      const targetBefore=await page.locator('#monitorTarget').getAttribute('cy');
      await page.check('#unstable');assert.match(await page.locator('#monitorResult').textContent(),/instável/);
      assert.notEqual(await page.locator('#monitorTarget').getAttribute('cy'),targetBefore);
      await page.click('#en');await noOverflow(page);await axe(page);
      // Sliders scroll down to the laboratory. Explicitly return to control before checking GNSS stage.
      await page.locator('#chapterNav button').nth(1).click();
      await page.click('#sectionView');
      await page.waitForFunction(()=>window.__story.cutaway?.phase==='control');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyMarkers.length),13);
      assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyLegs.length),12);
      assert.equal(await page.evaluate(()=>window.__story.cutaway.gnssGroup.visible),true,'linked GPS network in surface-control chapter');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyGroup.visible),false,'no underground traverse before tunnelling starts');
      await page.locator('#chapterNav button').nth(3).click();
      await page.waitForFunction(()=>window.__story.cutaway.phase==='traverse');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyGroup.visible),true);
      assert.equal(await page.evaluate(()=>window.__story.cutaway.gnssGroup.visible),false);
      await page.locator('#chapterNav button').nth(4).click();
      await page.waitForFunction(()=>window.__story.cutaway.phase==='digging');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.tunnelGroup.visible),true);
      assert.ok(await page.evaluate(()=>window.__story.cutaway.driveMeshes.some(d=>d.holder.children.length>=2)),'excavated lining exists only in advanced segments');
      await page.uncheck('#survey');assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyGroup.visible),false);
      await page.check('#survey');assert.equal(await page.evaluate(()=>window.__story.cutaway.surveyGroup.visible),true);
      await page.locator('#cutaway canvas').focus();const beforeOrbit=await page.evaluate(()=>window.__story.cutaway.camera.position.x);await page.keyboard.press('ArrowLeft');assert.notEqual(await page.evaluate(()=>window.__story.cutaway.camera.position.x),beforeOrbit);await page.keyboard.press('Home');
      const span=await page.evaluate(()=>{const c=window.__story.cutaway;return Math.abs(c.curves[1].getPoint(1).project(c.camera).x-c.curves[1].getPoint(0).project(c.camera).x);});assert.ok(span>.6&&span<2,'cutaway occupies the viewport without clipping');
      await input(page,'advance',60);assert.equal(await page.evaluate(()=>window.__story.cutaway.progress),.6);
      await page.click('#followCam');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.mode),'follow');
      const cameraBefore=await page.evaluate(()=>window.__story.cutaway.camera.position.x);
      await input(page,'advance',72);
      assert.notEqual(await page.evaluate(()=>window.__story.cutaway.camera.position.x),cameraBefore,'third-person chase camera follows digging');
      await page.click('#overviewCam');
      assert.equal(await page.evaluate(()=>window.__story.cutaway.mode),'overview');
      await input(page,'advance',60);
      await page.click('#play');await page.waitForFunction(()=>window.__story.cutaway.progress>.6);if(await page.evaluate(()=>window.__story.playing))await page.click('#play');assert.equal(await page.evaluate(()=>window.__story.playing),false);
      await page.screenshot({path:path.join(SHOTS,`${engine}-${size.width}-cutaway.png`)});await axe(page);
      await page.click('#mapView');await page.uncheck('#terrain');await page.waitForFunction(()=>window.__story.map.getTerrain()===null);
      await page.check('#terrain');await page.waitForFunction(()=>!!window.__story.map.getTerrain());
      await page.locator('#chapter-underground .sources-mini a').click();await page.waitForFunction(()=>location.hash==='#source-9');
      assert.deepEqual(errors,[]);await ctx.close();console.log(`${engine} ${size.width}px: story, map, cutaway, models, i18n, accessibility passed`);
    }
    if(!EXTERNAL_BASE){
      // Style failure, terrain failure and disabled storage must leave the lesson usable.
      for(const fail of ['style','terrain','storage','webgl']){
        const ctx=await browser.newContext({reducedMotion:'reduce'});await fixtures(ctx,fail);
        if(fail==='webgl')await ctx.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
        if(fail==='storage')await ctx.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage blocked');};Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};});
        const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/channel_tunnel_story/?lang=pt#chapter-underground');
        await page.waitForFunction(()=>window.__story?.active===3);
        if(fail!=='storage')await page.waitForFunction(s=>window.__story.mapState===s,['style','webgl'].includes(fail)?'mapFailed':'terrainFailed');
        await page.click('#en');await input(page,'angle',0);assert.equal(await page.locator('#modelOutput').textContent(),'0.000 m');assert.deepEqual(errors,[]);await ctx.close();
      }
    }
    // Portal syntax and bilingual card integration, including the existing Transform Lab route.
    const ctx=await browser.newContext();await fixtures(ctx);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?lang=en');
    assert.match(await page.locator('[data-card-id="channel_tunnel_story"] .card-title').textContent(),/Channel Tunnel/);
    const storyCard=page.locator('#simulatorsGrid > .sim-card[data-card-id="channel_tunnel_story"]');
    const otherCard=page.locator('#simulatorsGrid > .sim-card[data-card-id="transform_lab"]');
    assert.equal(await storyCard.count(),1,'Channel Tunnel card is a direct grid child');
    assert.equal(await storyCard.getAttribute('data-status'),'experimental');
    assert.match(await storyCard.locator('.badge-experimental').textContent(),/Experimental/);
    const width=await storyCard.evaluate(el=>el.getBoundingClientRect().width);
    const otherWidth=await otherCard.evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(Math.abs(width-otherWidth)<2,'Channel Tunnel card uses the same grid width as its peers');
    await page.click('.lang-btn[data-lang="pt-BR"]');
    assert.match(await storyCard.locator('.badge-experimental').textContent(),/Experimental/);
    await page.click('.lang-btn[data-lang="en"]');

    assert.match(await page.locator('[data-card-id="transform_lab"] .btn-launch').getAttribute('href'),/lang=en/);
    await page.click('[data-card-id="channel_tunnel_story"] .btn-launch');await page.waitForURL(/channel_tunnel_story/);assert.match(page.url(),/lang=en/);
    await page.click('#back');await page.waitForURL(/\?lang=en$/);assert.deepEqual(errors,[]);await ctx.close();
  }finally{await browser.close();server.close();}
  console.log('Channel Tunnel browser suite passed'+(LIVE?' (live external map)':''));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
