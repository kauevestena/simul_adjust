import {lateralErrorMeters, illustrativeRoute, PORTALS, adjustTraverse, monitoringExercise} from './model.mjs';
import {chapters, ui, refs} from './content.mjs';
const $ = id => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let lang, active = -1, map, cutaway, view = 'map', mapState = 'loading', terrainFailed = false, terrainLoaded = false;
let playing = false, lastFrame = 0, animationFrame;
const locale = () => lang === 'pt' ? 'pt-BR' : 'en';
const f = (v, digits=3) => v.toLocaleString(locale(), {minimumFractionDigits:digits, maximumFractionDigits:digits});
function initialLang() {
  const p = new URLSearchParams(location.search).get('lang');
  if (['en','pt','pt-BR'].includes(p)) return p === 'en' ? 'en' : 'pt';
  try { const s=localStorage.getItem('monorepo_lang'); if (['en','pt','pt-BR'].includes(s)) return s === 'en' ? 'en' : 'pt'; } catch {}
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
// Keep chapter nodes stable when translating, so focus and reading position survive.
chapters.forEach((c,i) => {
  const b=document.createElement('button'); b.type='button'; b.textContent=String(i+1).padStart(2,'0');
  b.setAttribute('aria-controls', 'chapter-'+c.id); b.addEventListener('click',()=>navigateChapter(i)); $('chapterNav').append(b);
  const a=document.createElement('article'); a.className='chapter'; a.id='chapter-'+c.id; a.tabIndex=-1;
  a.innerHTML='<div class="year"></div><div class="eyebrow"></div><h2></h2><p></p><div class="lesson"></div><div class="sources-mini"></div>';
  a.querySelector('h2').id='heading-'+c.id; a.setAttribute('aria-labelledby','heading-'+c.id); $('chapters').append(a);
});
refs.forEach(([author,title,url],i)=>{
  const li=document.createElement('li'), a=document.createElement('a'); li.id='source-'+(i+1); li.tabIndex=-1;
  a.href=url; a.textContent=author+': '+title; li.append(a); $('sourcesList').append(li);
});
function setLanguage(next) {
  const anchor=active>=0 ? $('chapter-'+chapters[active].id) : null;
  const oldTop=anchor?.getBoundingClientRect().top;
  const reading=anchor && oldTop < innerHeight && anchor.getBoundingClientRect().bottom > innerHeight/2;
  lang=next; const t=ui[lang]; document.documentElement.lang=locale(); document.title=t.mainTitle+' · simul_adjust';
  try {localStorage.setItem('monorepo_lang',locale());} catch {}
  const url=new URL(location); url.searchParams.set('lang',lang); history.replaceState(null,'',url);
  $('back').href='../?lang='+lang; $('pt').setAttribute('aria-pressed',String(lang==='pt')); $('en').setAttribute('aria-pressed',String(lang==='en'));
  for (const [id,value] of Object.entries(t)) { const node=$(id); if(node && typeof value==='string' && !['mapStatus','mapCaveat','mapFallback','traverseResult','monitorResult','play'].includes(id)) node.textContent=value; }
  $('chapterNav').setAttribute('aria-label',t.navLabel); $('map').setAttribute('aria-label',t.mapLabel);
  document.querySelector('meta[name=description]').content=t.subtitle;
  chapters.forEach((c,i)=>{
    const section=$('chapter-'+c.id), text=c[lang], button=$('chapterNav').children[i];
    button.setAttribute('aria-label',`${i+1}. ${text[1]}`); button.title=text[1];
    section.querySelector('.year').textContent=c.year==='1990-12-01' ? (lang==='pt'?'1 DEZ 1990':'1 DEC 1990') : c.year;
    section.querySelector('.eyebrow').textContent=text[0]; section.querySelector('h2').textContent=text[1]; section.querySelector('p').textContent=text[2];
    section.querySelector('.lesson').textContent=t.lesson+': '+text[3];
    const source=section.querySelector('.sources-mini'); source.replaceChildren(document.createTextNode(t.sourcesLabel+': '));
    for(const n of c.src) {const a=document.createElement('a'); a.href='#source-'+n; a.textContent=`[${n}]`; a.setAttribute('aria-label',`${t.sourcesLabel}: ${refs[n-1][0]}`); source.append(a);}
  });
  refreshViewText(); updateModels(); localizeMap();
  if(reading) scrollBy({top:anchor.getBoundingClientRect().top-oldTop,behavior:'instant'});
}
function refreshViewText() {
  const t=ui[lang]; $('mapCaveat').textContent=view==='map'?t.mapCaveat:t.sectionCaveat;
  $('mapStatus').textContent=t[mapState]; $('mapFallback').textContent=t.mapFallback;
  $('play').textContent=t[playing?'pause':'play']; $('play').setAttribute('aria-pressed',String(playing));
  if(cutaway)cutaway.renderer.domElement.setAttribute('aria-label',t.sectionKeys);
  $('activeChapter').textContent=active<0?'PT-BR / EN':`${active+1} / 7 · ${chapters[active][lang][0]}`;
}
function localizeMap() {
  const labels=lang==='pt'?['Aproximar','Afastar','Restaurar norte']:['Zoom in','Zoom out','Reset bearing to north'];
  ['zoom-in','zoom-out','compass'].forEach((name,i)=>{const b=document.querySelector('.maplibregl-ctrl-'+name);if(b){b.title=labels[i];b.setAttribute('aria-label',labels[i]);}});
  document.querySelectorAll('[data-portal]').forEach(el=>el.setAttribute('aria-label',lang==='pt'?`Portal aproximado: ${el.dataset.portal==='uk'?'Reino Unido':'França'}`:`Approximate ${el.dataset.portal==='uk'?'UK':'French'} portal`));
  const canvas=map?.getCanvas(); if(canvas) canvas.setAttribute('aria-label',ui[lang].mapLabel);
  const attr=document.querySelector('.maplibregl-ctrl-attrib-button'); if(attr) attr.setAttribute('aria-label',lang==='pt'?'Abrir atribuição':'Toggle attribution');
  document.querySelectorAll('.maplibregl-cooperative-gesture-screen').forEach(e=>e.textContent=lang==='pt'?'Use dois dedos para mover o mapa; Ctrl + rolagem para zoom.':'Use two fingers to move the map; Ctrl + scroll to zoom.');
}
function setActive(i) {
  if(i===active) return; active=i;
  [...$('chapterNav').children].forEach((b,j)=>{if(i===j)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  refreshViewText(); if(i<0)return;
  if(map && mapState!=='mapFailed') {const [lng,lat,zoom,pitch,bearing]=chapters[i].camera;map.flyTo({center:[lng,lat],zoom:zoom-(innerWidth<=850?1.2:0),pitch,bearing,duration:motion.matches?0:1200,essential:false});}
}
function navigateChapter(i) {
  const el=$('chapter-'+chapters[i].id); const url=new URL(location); url.hash=el.id; history.pushState(null,'',url);
  setActive(i); el.focus({preventScroll:true}); el.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
}
let scrollQueued=false;
function syncScroll() {
  scrollQueued=false;
  const stage=document.querySelector('.stage'), r=stage.getBoundingClientRect();
  const top=document.querySelector('.top').getBoundingClientRect().bottom;
  const overlay=getComputedStyle(stage).position==='sticky' && innerWidth<=850 ? r.bottom : top;
  const probe=overlay+(innerHeight-overlay)*0.3;
  let next=-1;
  chapters.forEach((c,i)=>{if($('chapter-'+c.id).getBoundingClientRect().top<=probe)next=i;});
  setActive(next);
}
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(syncScroll);}},{passive:true});
addEventListener('resize',syncScroll);
addEventListener('hashchange',()=>{const i=chapters.findIndex(c=>'#chapter-'+c.id===location.hash); if(i>=0)setActive(i);});
function updateModels() {
  const t=ui[lang], angle=Number($('angle').value), distance=Number($('distance').value);
  $('angleValue').textContent=f(angle,1)+'″'; $('angle').setAttribute('aria-valuetext',f(angle,1)+' arcsec');
  $('modelOutput').textContent=f(lateralErrorMeters(distance,angle))+' m';
  const bias=Number($('bias').value), optical=adjustTraverse(bias,false), adjusted=adjustTraverse(bias,$('gyro').checked);
  $('biasValue').textContent=f(bias,1)+'″';
  $('traverseRows').replaceChildren(...adjusted.y.map((y,i)=>{const row=document.createElement('tr');for(const value of ['P'+i,f(adjusted.x[i]/1000,0),f(optical.y[i]),f(y)]){const td=document.createElement('td');td.textContent=value;row.append(td);}return row;}));
  $('traverseResult').textContent=`${t.traverseResult}: ${f(adjusted.endpoint)} m / ${f(adjusted.sigma)} m / ${adjusted.dof}.`;
  const movement=Number($('movement').value), datum=Number($('datumShift').value), m=monitoringExercise(movement,datum,$('unstable').checked);
  $('movementValue').textContent=f(movement,0)+' mm'; $('datumValue').textContent=f(datum,0)+' mm';
  $('monitorResult').textContent=`${t.monitorResult}: ${f(m.raw,1)} / ${f(m.datum,1)} / ${f(m.corrected,1)} ± ${f(m.limit95,2)} mm.${m.unstable?' '+t.unstableWarning:''}`;
}
for(const id of ['angle','distance','bias','gyro','movement','datumShift','unstable']) $(id).addEventListener('input',updateModels);
$('pt').addEventListener('click',()=>setLanguage('pt')); $('en').addEventListener('click',()=>setLanguage('en'));
function status(value) {mapState=value;refreshViewText();$('map').dataset.state=value;}
function unavailable() {status('mapFailed');$('mapFallback').hidden=view!=='map';}
function applyTerrain() {
  if(!map?.getSource('terrain')) return;
  if($('terrain').checked && !terrainFailed) {map.setTerrain({source:'terrain',exaggeration:1.6});status(terrainLoaded?'ready':'loading');}
  else {map.setTerrain(null);status(terrainFailed?'terrainFailed':'flat');}
}
function startMap() {
  if(!window.maplibregl){unavailable();return;}
  try {
    map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[1.47,51.01],zoom:innerWidth<=850?7.8:9,pitch:innerWidth<=850?40:52,bearing:-22,cooperativeGestures:true,attributionControl:false});
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');localizeMap();
    const timeout=setTimeout(()=>{if(!map.isStyleLoaded())unavailable();},20000);
    map.on('load',()=>{
      clearTimeout(timeout);$('mapFallback').hidden=true;
      map.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:illustrativeRoute(1)}}});
      map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#d25929','line-width':5,'line-opacity':0.95}});
      for(const [key,color] of [['uk','#f6c46a'],['fr','#6ae3d7']]){const marker=new maplibregl.Marker({color}).setLngLat(PORTALS[key]).addTo(map);marker.getElement().dataset.portal=key;marker.getElement().setAttribute('role','img');}
      map.addSource('terrain',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:13,attribution:'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles / AWS Open Data</a>'});
      applyTerrain();localizeMap();if(active<0&&innerWidth<=850)map.fitBounds(new maplibregl.LngLatBounds().extend(PORTALS.uk).extend(PORTALS.fr),{padding:{top:25,bottom:62,left:15,right:50},maxZoom:8,pitch:40,bearing:-22,duration:0});
    });
    map.on('idle',()=>{if(map.getTerrain() && map.isSourceLoaded('terrain') && !terrainFailed){terrainLoaded=true;status('ready');}});
    map.on('error',e=>{
      if(e.sourceId==='terrain' || e.error?.message?.includes('elevation-tiles-prod')) {terrainFailed=true;applyTerrain();}
      else if(!map.isStyleLoaded())unavailable();
    });
    map.on('webglcontextlost',unavailable);
    $('terrain').addEventListener('change',applyTerrain);
  } catch(error) {console.warn('Map initialization failed',error);unavailable();}
}
async function setView(next) {
  view=next;document.documentElement.dataset.view=next;$('map').hidden=next!=='map';$('cutaway').hidden=next!=='section';$('mapTools').hidden=next!=='map';$('sectionTools').hidden=next!=='section';
  $('mapView').setAttribute('aria-pressed',String(next==='map'));$('sectionView').setAttribute('aria-pressed',String(next==='section'));
  $('mapFallback').hidden=next!=='map'||mapState!=='mapFailed';refreshViewText();
  if(next==='map'){setPlaying(false);map?.resize();return;}
  if(!cutaway)try {const {Cutaway}=await import('./cutaway.mjs');cutaway=new Cutaway($('cutaway'));cutaway.setProgress(Number($('advance').value)/100);} catch {$('cutaway').textContent=ui[lang].sectionFallback;$('play').disabled=true;}
  cutaway?.resize();if(cutaway)cutaway.renderer.domElement.setAttribute('aria-label',ui[lang].sectionKeys);
}
function setPlaying(value) {playing=value;cancelAnimationFrame(animationFrame);lastFrame=0;refreshViewText();if(playing)animationFrame=requestAnimationFrame(animate);}
function animate(time) {
  if(!playing)return;
  const delta=lastFrame?Math.min(time-lastFrame,100):0;lastFrame=time;
  const value=Math.min(100,Number($('advance').value)+delta/180);
  $('advance').value=String(value);updateAdvance();if(value>=100)setPlaying(false);else animationFrame=requestAnimationFrame(animate);
}
function updateAdvance() {$('advanceValue').textContent=Math.round(Number($('advance').value))+'%';cutaway?.setProgress(Number($('advance').value)/100);}
$('mapView').addEventListener('click',()=>setView('map'));$('sectionView').addEventListener('click',()=>setView('section'));
$('advance').step='any';$('advance').addEventListener('input',()=>{setPlaying(false);updateAdvance();});
$('play').addEventListener('click',()=>{if(Number($('advance').value)>=100){$('advance').value='0';updateAdvance();}setPlaying(!playing);});
$('resetView').addEventListener('click',()=>cutaway?.reset());
motion.addEventListener('change',()=>{if(motion.matches){map?.stop();setPlaying(false);}});
addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
setLanguage(initialLang());startMap();
const deepLink=chapters.findIndex(c=>'#chapter-'+c.id===location.hash);
if(deepLink>=0)requestAnimationFrame(()=>{setActive(deepLink);$('chapter-'+chapters[deepLink].id).scrollIntoView({behavior:'instant'});});
// Read-only diagnostics used by real-browser tests, including deployed Pages verification.
window.__story={get map(){return map;},get active(){return active;},get cutaway(){return cutaway;},get playing(){return playing;},get mapState(){return mapState;}};
