import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { words, t, setLanguage, detectLanguage } from '../i18n.mjs';

test('language precedence: URL, then shared monorepo preference, then browser', () => {
  assert.equal(detectLanguage({ query: '?lang=en', stored: 'pt-BR', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ query: '?lang=pt', stored: 'en', browser: 'en-US' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '?lang=pt-BR', browser: 'en-US' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '?lang=de', stored: 'en', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ browser: 'pt-PT' }), 'pt-BR');
  assert.equal(detectLanguage({ browser: 'de-DE' }), 'en');
});

test('both languages hold every key used by the page and the code', () => {
  for (const [key, pair] of Object.entries(words)) {
    assert.equal(pair.length, 2, key);
    assert.ok(pair.every(s => typeof s === 'string' && s.trim().length > 0), key);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/data-(?:t|t-html|label)="([^"]+)"/g)) assert.ok(words[m[1]], m[1]);
  for (const m of html.matchAll(/<option value="(\w+)" data-t="metric_\w+"/g)) {
    assert.ok(words[`metric_${m[1]}`] && words[`metricHelp_${m[1]}`], `metric ${m[1]}`);
  }
  for (const file of ['app.mjs', 'chart.mjs', 'viewer.mjs']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const m of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(words[m[1]], `${file}: ${m[1]}`);
  }
  setLanguage('en'); assert.equal(t('title'), 'UTM & Geoid Distortions in Point Clouds'); assert.match(t('estimate', { n: '5', max: '9' }), /5 of at most 9/);
  setLanguage('pt-BR'); assert.equal(t('title'), 'Distorções UTM e do Geoide em Nuvens de Pontos');
});

test('theory text has the same structure in both languages', () => {
  const [pt, en] = words.theoryBody;
  for (const tag of ['<h3>', '<p class="formula">', '<li>']) assert.equal(pt.split(tag).length, en.split(tag).length, tag);
});
