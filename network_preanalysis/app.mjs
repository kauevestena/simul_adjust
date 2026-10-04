import { example, RURAL, validatePointPlacement } from './network/scenarios.mjs';
import { INSTRUMENTS, makePoint, makeSight, validateNetwork, serialize, deserialize } from './network/model.mjs';
import { analyze } from './network/preanalysis.mjs';
import { externalReliability } from './network/reliability.mjs';
import { createRuralTerrain, networkVisibility } from './network/terrain.mjs';
import { createTerrarium } from '../shared/terrarium.mjs';
import { NetworkCanvas } from './canvas.mjs';
import { renderContext, esc, fmt, mm, field } from './inspector.mjs';
import { t, setLanguage, getLanguage, initialLanguage } from './i18n.mjs';

const $ = id => document.getElementById(id);
let network = example(), result = analyze(network), selected = null, tool = 'select', source = null;
let visibility = {}, terrain = null, busy = false, revision = 0, effect = null, baseline = null, lastError = null;
const tiles = createTerrarium(), undo = [], redo = [];
const instrumentKeys = ['directionArcsec', 'zenithArcsec', 'distanceMm', 'ppm'];
const view = { labels: true, ellipses: true, precisionLabels: false, redundancy: false, terrain: true, confidence: '1sigma', exaggeration: 5000 };
const scene = () => ({ network, result: busy ? null : result, selected, tool, source, view, visibility, effect: busy ? null : effect, busy });
const canvas = new NetworkCanvas($('canvas'), scene, action => { handleAction(action).catch(fail); });
export const getState = () => structuredClone(network);
export const getResult = () => result;
export const getView = () => ({ center: [...canvas.center], scale: canvas.scale, width: canvas.width, height: canvas.height });
export const isBusy = () => busy;
export const getVisibility = () => structuredClone(visibility);

function fail(error) { lastError=error.message || 'invalidNetwork'; $('error').textContent = t(lastError); $('error').hidden = false; }
function clearError() { lastError=null; $('error').hidden = true; document.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid')); }
function read(id, min = -1e6, max = 1e6) {
  const input = $(id), text = input.value.trim().replace(',', '.'), value = Number(text);
  if (!text || !Number.isFinite(value) || value < min || value > max) { input.setAttribute('aria-invalid','true'); throw Error('invalidNumber'); }
  return value;
}
function updateHint() {
  $('hint').textContent = t(tool==='sight'?(source?'targetHint':'sightHint'):tool==='delete'?'deleteHint':tool==='select'?'pointHint':'addHint');
}
function render() {
  $('level').value = String(busy ? 1 : network.level); $('example').disabled = busy || network.level === 1;
  $('example').value = ['traverse','weak','resection','intersection','mixed'].includes(network.scenario)?network.scenario:'traverse';
  $('busy').hidden = !busy; $('terrain-note').hidden = network.level === 0;
  document.querySelector('[data-t="terrainApprox"]').textContent=t('terrainApprox',{geoid:fmt(network.geoidUndulation??0,1)});
  $('canvas-level').textContent = t(network.level?'rural':'plane'); updateHint();
  $('canvas-legend').textContent = `${t('exaggerationNote')} ×${view.exaggeration.toLocaleString(getLanguage())} · ${t(view.confidence==='95'?'confidence95':'oneSigma')}`;
  if (view.redundancy) $('canvas-legend').textContent += ` · ${t('redundancy')}: 0 → 1`;
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  $('undo').disabled = busy || !undo.length; $('redo').disabled = busy || !redo.length;
  $('instrument').disabled = busy; $('save').disabled = busy; $('matrices').disabled = busy;
  $('instrument-fields').innerHTML = instrumentKeys.map(k=>field(`i-${k}`,t(k),network.instrument[k],busy)).join('');
  $('alpha').value = network.statistics.alpha; $('power').value = network.statistics.power;
  $('alpha').disabled = $('power').disabled = busy;
  renderContext($('context'),scene());
  if (busy) $('context').querySelectorAll('input,select,button').forEach(e=>e.disabled=true);
  $('status').textContent = busy ? t('loading') : `${t(result.solvable?'solved':'unsolved')} · ${t('rank')} ${result.rank}/${result.parameters.length}`;
  $('status').className = !busy && !result.solvable ? 'bad' : '';
  const metrics = [[t('points'),network.points.length],[t('components'),busy?'—':`${result.observationCount} + ${result.controlCount}`],
    [t('dof'),busy?'—':result.dof],[t('worstH'),busy?'—':mm(result.worstHorizontal)],[t('worstU'),busy?'—':mm(result.worstVertical)]];
  $('metrics').innerHTML = metrics.map(([label,value])=>`<span>${esc(label)}<b>${esc(value)}</b></span>`).join('');
  $('comparison').hidden = !baseline;
  if (baseline) $('comparison').textContent = `${t('comparison')} · H: ${mm(baseline.h)} → ${busy?'—':mm(result.worstHorizontal)} · U: ${mm(baseline.u)} → ${busy?'—':mm(result.worstVertical)} · r: ${baseline.dof} → ${busy?'—':result.dof}`;
  $('baseline').textContent = t(baseline?'clearComparison':'compare');
  if(lastError)$('error').textContent=t(lastError);
  if($('matrix-dialog').open)renderMatrix();
  canvas.draw();
}

async function commit(draft, { fit = false, history = true, prepareTerrain = false } = {}) {
  clearError();
  const token = ++revision;
  // Rural origin is established from the terrain before normal schema validation.
  let nextTerrain = terrain, nextVisibility = {};
  busy = draft.level === 1; effect = null; render();
  try {
    if (draft.level === 1) {
      if (!nextTerrain || prepareTerrain) {
        const config = draft.origin ? { ...RURAL, lat: draft.origin.lat, lon: draft.origin.lon,
          origin: draft.origin, geoidUndulation: draft.geoidUndulation, heightDatum: draft.heightDatum } : RURAL;
        nextTerrain = await createRuralTerrain(config, tiles);
      }
      draft.origin = nextTerrain.origin; draft.geoidUndulation = nextTerrain.geoidUndulation;
      draft.heightDatum = nextTerrain.metadata.heightDatum;
      await Promise.all(draft.points.map(async p => { const g = await nextTerrain.ground(p.E,p.N); p.U=g.U; p.geographic=g; }));
      validateNetwork(draft);
      nextVisibility = await networkVisibility(draft,nextTerrain);
    } else { validateNetwork(draft); nextTerrain = null; }
    if (token !== revision) return;
    if (history) { undo.push(structuredClone(network)); if(undo.length>40)undo.shift(); redo.length=0; }
    network = draft; terrain = nextTerrain; visibility = nextVisibility;
    result = analyze(network,visibility); busy = false;
    render(); if(fit){canvas.fit();$('inspector').scrollTop=0;}
    if (terrain && (prepareTerrain || !canvas.terrain)) {
      const imageToken = token;
      // Background imagery failure never fabricates LOS or analytical elevations.
      canvas.terrainImage(terrain).then(image=>{if(imageToken===revision){canvas.terrain=image;canvas.draw();}}).catch(()=>{});
    }
  } catch(error) {
    if(token!==revision)return;
    busy=false;render();fail(error);
  }
}
async function mutate(fn) {
  if (busy) return;
  const draft=structuredClone(network);fn(draft);await commit(draft);
}
function select(kind,id) { selected=kind?{kind,id}:null; effect=null;render();$('inspector').scrollTop=0; }
function setTool(value) { tool=value;source=null;updateHint();render(); }
async function handleAction(a) {
  if(busy)return;
  if(a.type==='select') {select(a.kind,a.id);return;}
  if(a.type==='delete'&&a.id) {
    await mutate(n=>{if(a.kind==='point'){n.points=n.points.filter(p=>p.id!==a.id);n.sights=n.sights.filter(s=>s.from!==a.id&&s.to!==a.id);}else n.sights=n.sights.filter(s=>s.id!==a.id);});selected=null;source=null;render();return;
  }
  if(a.type==='move'||a.type==='add') {
    const placement=validatePointPlacement(a,network.level?{bounds:RURAL.bounds}:{});if(!placement.valid)throw Error(placement.reason);
    await mutate(n=>{
      if(a.type==='move'){const p=n.points.find(p=>p.id===a.id);p.E=a.E;p.N=a.N;}
      else {let i=1,id;do{id=`${a.pointType==='station'?'S':'P'}${String(i++).padStart(2,'0')}`;}while(n.points.some(p=>p.id===id));n.points.push(makePoint(id,a.E,a.N,a.pointType));selected={kind:'point',id};}
    });return;
  }
  if(a.type==='sight'&&a.id) {
    const p=network.points.find(p=>p.id===a.id);
    if(!source){if(p.type!=='station')throw Error('stationOrigin');source=p.id;render();return;}
    if(source===p.id)throw Error('selfSight');
    const existing=network.sights.find(s=>s.from===source&&s.to===p.id);
    if(existing){selected={kind:'sight',id:existing.id};source=null;render();throw Error('duplicateSight');}
    const origin=source;source=null;
    await mutate(n=>{const s=makeSight(origin,p.id);n.sights.push(s);selected={kind:'sight',id:s.id};});
  }
}
function applyPoint() {
  const p=network.points.find(p=>p.id===selected?.id);if(!p)return;
  const values={label:$('p-label').value,type:$('p-type').value,control:$('p-control').value,
    E:read('p-E'),N:read('p-N'),HI:read('p-HI',0,100),HT:read('p-HT',0,100),active:$('p-active').checked};
  let sigma=null;
  if($('p-sigma-0'))sigma=[0,1,2].map(i=>read(`p-sigma-${i}`,.000001,1e6)/1000);
  return mutate(n=>{
    const next=n.points.find(x=>x.id===p.id);Object.assign(next,values);
    if(sigma){
      const old=p.controlCovariance?p.controlCovariance.map((r,i)=>Math.sqrt(r[i])):p.controlSigma;
      if(sigma.some((v,i)=>Math.abs(v-old[i])>5e-7)){next.controlSigma=sigma;delete next.controlCovariance;}
    }
  });
}
function download(name,data) {
  const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function matrices() {
  const n=result.rows.length,P=Array.from({length:n},()=>Array(n).fill(0));
  for(const b of result.blocks??[])b.p.forEach((row,i)=>row.forEach((v,j)=>P[b.start+i][b.start+j]=v));
  return {A:result.A??[],P,N:result.N??[],'Σxx':result.covariance??[]};
}
function renderMatrix() {
  const m=matrices()[$('matrix-choice').value];
  $('matrix-content').textContent=m.slice(0,40).map(r=>r.slice(0,40).map(x=>x.toExponential(4).padStart(12)).join(' ')).join('\n')||t('noValue');
  $('matrix-order').textContent=`${t('unknowns')}:\n${result.parameters.map((p,i)=>`${i+1}: ${p.id}.${p.axis}`).join('  ')}\n\n${t('components')}:\n${result.rows.map((r,i)=>`${i+1}: ${r.sightId??r.pointId} · ${t(r.component)}`).join('\n')}`;
}

document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{setLanguage(b.dataset.lang);render();}));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('help').onclick=()=>$('help-dialog').showModal();
$('fit').onclick=()=>canvas.fit();
$('clear-selection').onclick=()=>select(null);
$('toggle-panel').onclick=()=>{const hidden=$('workspace').classList.toggle('panel-hidden');$('toggle-panel').setAttribute('aria-expanded',String(!hidden));};
$('example').onchange=()=>{selected=null;source=null;baseline=null;commit(example($('example').value),{fit:true});};
$('level').onchange=()=>{selected=null;source=null;baseline=null;const n=example($('level').value==='1'?'rural':'traverse');n.level=Number($('level').value);commit(n,{fit:true,prepareTerrain:true});};
$('instrument').onchange=()=>{const preset=INSTRUMENTS[$('instrument').value];if(preset)mutate(n=>{n.instrument={...preset};});};
$('instrument-fields').addEventListener('change',()=>{
  try{const instrument=Object.fromEntries(instrumentKeys.map(k=>[k,read(`i-${k}`,0,10000)]));$('instrument').value='custom';mutate(n=>{n.instrument=instrument;});}catch(e){fail(e);}
});
for(const id of ['alpha','power'])$(id).onchange=()=>{try{const stats={alpha:read('alpha',1e-6,.2),power:read('power',.5,.9998)};mutate(n=>{n.statistics=stats;});}catch(e){fail(e);}};
for(const [id,key] of [['labels','labels'],['ellipses','ellipses'],['precision-labels','precisionLabels'],['redundancy-color','redundancy'],['terrain-layer','terrain']])$(id).onchange=()=>{view[key]=$(id).checked;render();};
$('confidence').onchange=()=>{view.confidence=$('confidence').value;render();};
$('exaggeration').onchange=()=>{try{view.exaggeration=read('exaggeration',1,1e6);clearError();render();}catch(e){fail(e);}};
$('clear-effect').onclick=()=>{effect=null;render();};
$('baseline').onclick=()=>{baseline=baseline?null:{h:result.worstHorizontal,u:result.worstVertical,dof:result.dof};render();};
$('save').onclick=()=>download('network-preanalysis.json',serialize(network));
$('load').onclick=()=>$('file').click();
$('file').onchange=async()=>{
  try{const f=$('file').files[0];if(!f)return;if(f.size>2e6)throw Error('invalidNetwork');const n=deserialize(await f.text());selected=null;source=null;await commit(n,{fit:true,prepareTerrain:true});}catch(e){fail(e);}finally{$('file').value='';}
};
for(const [id,from,to] of [['undo',undo,redo],['redo',redo,undo]])$(id).onclick=async()=>{
  if(!from.length||busy)return;const previous=from.pop();to.push(structuredClone(network));selected=null;source=null;await commit(previous,{history:false,prepareTerrain:true});
};
$('matrices').onclick=()=>{renderMatrix();$('matrix-dialog').showModal();};$('matrix-choice').onchange=renderMatrix;
$('matrix-save').onclick=()=>download('network-matrices.json',{parameters:result.parameters,rows:result.rows,rank:result.rank,...matrices()});
$('context').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
    if(b.dataset.selectPoint)select('point',b.dataset.selectPoint);
    else if(b.dataset.selectSight)select('sight',b.dataset.selectSight);
    else if(b.id==='apply-point')Promise.resolve(applyPoint()).catch(fail);
    else if(b.dataset.role)mutate(n=>{const p=n.points.find(p=>p.id===selected.id);p.role=b.dataset.role;p.control='fixed';});
    else if(b.id==='delete-selected')handleAction({type:'delete',...selected}).catch(fail);
    else if(b.dataset.effect!=null){effect=externalReliability(result,Number(b.dataset.effect));render();}
  }catch(error){fail(error);}
});
$('context').addEventListener('change',e=>{
  const id=e.target.id;
  try{
    if(id==='p-control'||id==='p-type')Promise.resolve(applyPoint()).catch(fail);
    if(id.startsWith('s-')){
      const value=id==='s-HT'?read('s-HT',0,100):e.target.checked;
      mutate(n=>{const s=n.sights.find(s=>s.id===selected.id);if(id==='s-active')s.active=value;else if(id==='s-override'){if(value)s.HT=n.points.find(p=>p.id===s.to).HT;else delete s.HT;}else if(id==='s-HT')s.HT=value;else s.components[id.slice(2)]=value;});
    }
  }catch(error){fail(error);}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){source=null;tool='select';render();}
  if((e.key==='Delete'||e.key==='Backspace')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&selected){e.preventDefault();handleAction({type:'delete',...selected}).catch(fail);}
});
if(innerWidth<700){$('workspace').classList.add('panel-hidden');$('toggle-panel').setAttribute('aria-expanded','false');}
setLanguage(initialLanguage());render();requestAnimationFrame(()=>canvas.fit());
