import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { words, t, setLanguage, detectLanguage } from '../i18n.mjs';
test('language precedence is URL, shared monorepo preference, then browser',()=>{
  assert.equal(detectLanguage({query:'?lang=en',stored:'pt-BR',browser:'pt-BR'}),'en');
  assert.equal(detectLanguage({query:'?lang=pt',stored:'en',browser:'en-US'}),'pt-BR');
  assert.equal(detectLanguage({query:'?lang=pt-BR',browser:'en-US'}),'pt-BR');
  assert.equal(detectLanguage({query:'?lang=de',stored:'en',browser:'pt-BR'}),'en');
  assert.equal(detectLanguage({browser:'pt-PT'}),'pt-BR');
  assert.equal(detectLanguage({browser:'de-DE'}),'en');
});
test('both languages include every static interface key and diagnostic',()=>{
  for(const [key,pair] of Object.entries(words)){assert.equal(pair.length,2,key);assert.ok(pair.every(s=>typeof s==='string'&&s.length>0),key);}
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const m of html.matchAll(/data-(?:t|label)="([^"]+)"/g))assert.ok(words[m[1]],m[1]);
  for(const file of ['app.mjs','inspector.mjs','network/model.mjs','network/preanalysis.mjs','network/observations.mjs','network/coordinates.mjs','network/scenarios.mjs']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    for(const m of source.matchAll(/(?:\bt\(|\bError\(|code:\s*)'([^']+)'/g))assert.ok(words[m[1]],`${file}: ${m[1]}`);
  }
  setLanguage('en');assert.equal(t('station'),'Station');assert.match(t('rankDefect',{count:2}),/2/);
  setLanguage('pt-BR');assert.equal(t('station'),'Estação');
});
