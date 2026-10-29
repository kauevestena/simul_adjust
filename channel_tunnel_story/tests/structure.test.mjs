import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {Script} from 'node:vm';
import {chapters, ui, refs} from '../content.mjs';
const root=new URL('../../',import.meta.url);
test('portal inline scripts compile, guarding all simulator cards',()=>{
  const html=readFileSync(new URL('index.html',root),'utf8'); let count=0;
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(/\bsrc=/.test(m[1]) || /application\/ld\+json/.test(m[1]))continue;
    new Script(m[2],{filename:'portal-inline.js'});count++;
  }
  assert.ok(count>0);
});
test('all seven chapters have bilingual prose and valid traceable sources',()=>{
  assert.equal(chapters.length,7);assert.equal(new Set(chapters.map(c=>c.id)).size,7);
  assert.ok(chapters.some(c=>c.id==='breakthrough'));assert.ok(chapters.some(c=>c.id==='monitoring'));
  for(const c of chapters){for(const lang of ['pt','en']){assert.equal(c[lang].length,4);assert.ok(c[lang].every(s=>s.length>0));}for(const n of c.src)assert.ok(refs[n-1]);}
  assert.deepEqual(Object.keys(ui.pt).sort(),Object.keys(ui.en).sort());
  for(const ref of refs)assert.equal(new URL(ref[2]).protocol,'https:');
});
test('local page scripts and styles resolve, with an executable map implementation',()=>{
  const page=readFileSync(new URL('channel_tunnel_story/index.html',root),'utf8');
  for(const m of page.matchAll(/(?:src|href)="(\.\/[^"#?]+\.(?:js|mjs|css))"/g))assert.ok(existsSync(new URL('channel_tunnel_story/'+m[1],root)),m[1]);
  const script=readFileSync(new URL('channel_tunnel_story/app.mjs',root),'utf8');
  new Script(readFileSync(new URL('channel_tunnel_story/vendor/maplibre-gl.js',root),'utf8'));
  assert.match(script,/new maplibregl\.Map\(/);
});


test('experimental Channel Tunnel card is within the standard portal grid',()=>{
  const html=readFileSync(new URL('index.html',root),'utf8');
  const grid=html.indexOf('<main class="simulators-grid" id="simulatorsGrid">');
  const gridEnd=html.indexOf('</main>',grid);
  const card=html.indexOf('data-card-id="channel_tunnel_story"');
  assert.ok(grid>=0 && card>grid && card<gridEnd,'card must be a child of the grid rather than a full-width sibling');
  assert.equal(html.match(/data-card-id="channel_tunnel_story"/g)?.length,1);
  const cardHtml=html.slice(html.lastIndexOf('<article ',card),html.indexOf('</article>',card));
  assert.match(cardHtml,/class="sim-card"/);
  assert.match(cardHtml,/data-status="experimental"/);
  assert.match(cardHtml,/class="badge-experimental">🧪 Experimental/);
  assert.doesNotMatch(cardHtml,/data-status="unfinished"/);
  assert.match(html,/"pt-BR":\{"experimental":"🧪 Experimental"/);
  assert.match(html,/"en":\{"experimental":"🧪 Experimental"/);
});
