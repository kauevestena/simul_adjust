import {controls,defaults,evaluate,series} from './model.mjs';
import {messages,detectLang} from './i18n.mjs';
const $=id=>document.getElementById(id);
let stored;try{stored=localStorage.getItem('monorepo_lang');}catch{}
let lang=detectLang(new URLSearchParams(location.search).get('lang'),stored,navigator.language);
let p={...defaults};
const fmt=(v,d=2)=>v.toLocaleString(lang,{maximumFractionDigits:d});
for(const [key,[min,max,step,value,unit]] of Object.entries(controls)){
 const div=document.createElement('div');div.className='control';
 div.innerHTML=`<label for="${key}" data-t="${key}"></label><div class="inputrow"><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><input id="${key}-number" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
 $('controls').append(div);
 for(const id of [key,key+'-number']) $(id).addEventListener('input',()=>{
   const input=$(id),v=input.valueAsNumber;
   if(!input.validity.valid||!Number.isFinite(v))return;
   p[key]=v;$(key).value=v;$(key+'-number').value=v;render();
 });
 for(const id of [key,key+'-number']) $(id).addEventListener('change',()=>{$(id).value=p[key];});
}
function language(next){lang=next;document.documentElement.lang=lang;document.title=messages[lang].title;
 document.querySelectorAll('[data-t]').forEach(el=>el.textContent=messages[lang][el.dataset.t]);
 for(const key of Object.keys(controls))for(const suffix of ['', '-number'])$(key+suffix).setAttribute('aria-label',messages[lang][key]+' · '+messages[lang][suffix?'number':'slider']);
 for(const [id,l] of [['pt','pt-BR'],['en','en']]){$(id).setAttribute('aria-pressed',String(lang===l));$(id).setAttribute('aria-label',messages[lang].lang+': '+l);}
 $('portal').textContent=messages[lang].portal;$('portal').href='../?lang='+lang;
 try{localStorage.setItem('monorepo_lang',lang);}catch{}
 const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();
}
const line=(x1,y1,x2,y2,color,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
const text=(x,y,t,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
function render(){const r=evaluate(p),t=messages[lang],mode=$('mode').value;
 $('result').textContent=mode==='parallel'&&!r.visibleParallel?'—':fmt(r[mode]*100)+' cm';
 $('angle').textContent=fmt(r.angle)+'°';$('ratio').textContent='B/Z = '+fmt(p.base/p.distance,3);
 $('fpx').textContent=fmt(r.fpx,0)+' px';$('pitch').textContent=t.pitch+': '+fmt(r.pixelMicrons)+' µm';
 $('warning').textContent=[!r.visibleParallel?t.outside:'',r[mode]/p.distance>.1?t.weak:''].filter(Boolean).join(' ');
 const scale=Math.min(560/p.base,220/p.distance),cx=380,yc=280,yt=yc-p.distance*scale,half=p.base*scale/2;
 let g=text(cx,yt-18,t.target+' · Z = '+fmt(p.distance)+' m')+line(cx,yc,cx,yt,'#627791','4 5');
 for(const x of [cx-half,cx+half]){
   g+=line(x,yc,cx,yt,'#73c9ff');
   const axisX=mode==='parallel'?x:cx,axisY=yt;
   // Offset the dashed overlay slightly in thickness so it remains visible when coincident.
   g+=line(x,yc,axisX,axisY,'#ffbd69','7 6');
   g+=`<rect x="${x-10}" y="${yc-7}" width="20" height="14" rx="3" fill="#dce7f5"/>`;
 }
 g+=`<circle cx="${cx}" cy="${yt}" r="5" fill="#ffbd69"/>`+line(cx-half,yc+22,cx+half,yc+22,'#627791')+text(cx,yc+43,'B = '+fmt(p.base)+' m');
 g+=text(15,25,t.range+': '+fmt(r.range)+' m','start');
 $('geometry').innerHTML=g;$('geometry').setAttribute('aria-label',t.plan+'. '+t.angle+': '+fmt(r.angle)+'°');
 const rows=series(p),vals=rows.flatMap(v=>[v.convergent,...(v.visibleParallel?[v.parallel]:[])]).concat([r.convergent,...(r.visibleParallel?[r.parallel]:[])]).map(v=>v*100);
 let lo=Math.floor(Math.log10(Math.min(...vals))),hi=Math.ceil(Math.log10(Math.max(...vals)));if(lo===hi)hi++;
 const xx=b=>75+b/20*650, yy=v=>265-(Math.log10(v*100)-lo)/(hi-lo)*220;
 let chart='';for(let e=lo;e<=hi;e++){let y=yy(10**e/100);chart+=line(75,y,725,y,'#30405a')+text(65,y+4,fmt(10**e,6),'end');}
 for(let b=0;b<=20;b+=2)chart+=text(xx(b),287,fmt(b,0));
 chart+=text(400,313,t.axisBase)+text(75,20,t.axisError,'start');
 for(const [key,color] of [['parallel','#73c9ff'],['convergent','#ffbd69']]){
  const visible=rows.filter(v=>key!=='parallel'||v.visibleParallel);
  chart+=`<polyline points="${visible.map(v=>xx(v.base)+','+yy(v[key])).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
  for(const v of visible)chart+=`<circle cx="${xx(v.base)}" cy="${yy(v[key])}" r="2.5" fill="${color}"><title>${t[key]}: B=${fmt(v.base)} m; σZ=${fmt(v[key]*100)} cm</title></circle>`;
  if(key!=='parallel'||r.visibleParallel)chart+=`<circle cx="${xx(p.base)}" cy="${yy(r[key])}" r="6" fill="${color}" stroke="#fff" stroke-width="2"/>`;
 }
 $('chart').innerHTML=chart;$('chart').setAttribute('aria-label',t.chartTitle+'. '+t.chartHint);
}
$('pt').onclick=()=>language('pt-BR');$('en').onclick=()=>language('en');$('mode').onchange=render;
$('reset').onclick=()=>{p={...defaults};for(const k of Object.keys(controls)){$(k).value=p[k];$(k+'-number').value=p[k];}$('mode').value='convergent';render();};
$('csv').onclick=()=>{
 const header=lang==='pt-BR'?'base_m;sigma_paralelo_cm;sigma_convergente_cm;paralelo_visivel;distancia_Z_m;focal_mm;sensor_largura_mm;imagem_largura_px;sigma_imagem_px':'baseline_m;parallel_sigma_cm;convergent_sigma_cm;parallel_visible;distance_Z_m;focal_mm;sensor_width_mm;image_width_px;image_sigma_px';
 const rows=series(p).map(r=>[r.base,r.visibleParallel?r.parallel*100:'',r.convergent*100,Number(r.visibleParallel),p.distance,p.focal,p.sensor,p.width,p.sigma].join(';'));
 const url=URL.createObjectURL(new Blob(['\uFEFF'+header+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='depth_error.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
language(lang);
