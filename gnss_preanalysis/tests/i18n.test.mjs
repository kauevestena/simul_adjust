import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { words, detectLanguage } from '../i18n.mjs';
import { DELIMITERS } from '../wizard.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = ['../app.mjs', '../inspector.mjs', '../wizard.mjs', '../model/analysis.mjs', '../model/network.mjs', '../model/stochastic.mjs',
  '../model/cors.mjs', '../model/importer.mjs', '../model/stations.mjs', '../model/geojson.mjs']
  .map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');

test('every entry has non-empty Portuguese and English text with the same placeholders', () => {
  for (const [key, pair] of Object.entries(words)) {
    assert.ok(Array.isArray(pair) && pair.length === 2 && pair.every(x => typeof x === 'string' && x.trim()), key);
    const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
    assert.equal(holes(pair[0]), holes(pair[1]), `${key} placeholders`);
  }
});

test('the page and the code only use defined keys', () => {
  for (const m of html.matchAll(/data-(?:t|label|html)="([^"]+)"/g)) assert.ok(words[m[1]], `index.html: ${m[1]}`);
  for (const m of source.matchAll(/(?:diag|showError|error)\('(\w+)'/g)) assert.ok(words[m[1]], `diagnostic ${m[1]}`);
  for (const m of source.matchAll(/\bt\('(\w+)'/g)) assert.ok(words[m[1]], `t('${m[1]}')`);
  for (const [, key] of DELIMITERS) assert.ok(words[key], key);
  // Row errors of the importer are shown in the wizard preview.
  for (const m of source.matchAll(/error: '(\w+)'/g)) assert.ok(words[m[1]], `row error ${m[1]}`);
  for (const m of source.matchAll(/throw (?:Object\.assign\()?Error\('(\w+)'\)/g)) assert.ok(words[m[1]], `error ${m[1]}`);
  for (const code of ['coincident', 'terrainMissing', 'corsMissing', 'invalidCors', 'lastSession', 'notProject', 'openedInWizard', 'hFile', 'hConstant'])
    assert.ok(words[code], code);
});

test('language order: URL, shared storage, then browser', () => {
  assert.equal(detectLanguage({ query: '?lang=en', stored: 'pt-BR', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ query: '?lang=pt', stored: 'en', browser: 'en-US' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '', stored: 'en', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ query: '', stored: '', browser: 'pt-PT' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '', stored: '', browser: 'de-DE' }), 'en');
});

test('portal card and bilingual card metadata exist', () => {
  const portal = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.equal(portal.match(/data-card-id="gnss_preanalysis"/g)?.length, 1);
  assert.match(portal, /href="gnss_preanalysis\/"/);
  const start = portal.indexOf('"gnss_preanalysis": {'), block = portal.slice(start, portal.indexOf('"camera_proj": {', start));
  assert.ok(start > 0 && /"pt-BR"/.test(block) && /"en"/.test(block));
});
