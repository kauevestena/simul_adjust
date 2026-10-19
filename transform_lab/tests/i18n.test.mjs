import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { words, detectLanguage, setLanguage, t } from '../i18n.mjs';
import { COMPARE_PRESETS } from '../compare-presets.mjs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('language precedence is URL, shared monorepo preference, then browser', () => {
  assert.equal(detectLanguage({ query: '?lang=en', stored: 'pt-BR', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ query: '?lang=pt', stored: 'en', browser: 'en-US' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '?lang=pt-BR', browser: 'en-US' }), 'pt-BR');
  assert.equal(detectLanguage({ query: '?lang=de', stored: 'en', browser: 'pt-BR' }), 'en');
  assert.equal(detectLanguage({ browser: 'pt-PT' }), 'pt-BR');
  assert.equal(detectLanguage({ browser: 'de-DE' }), 'en');
});

test('every entry has a non-empty PT and EN string with the same placeholders', () => {
  for (const [key, pair] of Object.entries(words)) {
    assert.equal(pair.length, 2, key);
    assert.ok(pair.every(s => typeof s === 'string' && s.length > 0), key);
    const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
    assert.equal(ph(pair[0]), ph(pair[1]), `${key}: placeholders differ`);
  }
});

const SOURCES = ['index.html', 'comparacao.html', 'teoria.html', 'app.mjs', 'compare.mjs', 'ui.mjs', 'theory.mjs', 'views/view2d.mjs', 'views/view3d.mjs', 'views/histogram.mjs'];

test('every key referenced by the pages and modules exists in both languages', () => {
  for (const file of SOURCES) {
    const src = read(file);
    for (const m of src.matchAll(/data-(?:t|t-html|label|ph)="([^"]+)"/g)) assert.ok(words[m[1]], `${file}: ${m[1]}`);
    for (const m of src.matchAll(/\b(?:t|L)\('([^']+)'/g)) assert.ok(words[m[1]], `${file}: ${m[1]}`);
  }
});

test('dynamic key families are complete', () => {
  const need = [];
  ['combinado', 'parametrico', 'euler', 'quaternion', 'matrix', 'axisAngle', 'estimate', 'rigid', 'full', 'diagonal', 'none', 'n8', 'n4', 'all', 'random', 'relative', 'absolute', 'aposteriori', 'apriori', 'wall', 'frontal', 'oblique', 'landscape', 'table', 'tableAligned', 'easel'].forEach(v => need.push(`o.${v}`));
  ['control', 'check', 'uncollected', 'tsOnly'].forEach(v => need.push(`role.${v}`));
  ['singular', 'collinear', 'fewPoints', 'fewControl', 'internal'].forEach(v => need.push(`m.err.${v}`));
  ['gimbal', 'axisUndefined', 'constraintsOff', 'notConverged', 'illConditioned', 'constraintViolated'].forEach(v => need.push(`m.flag.${v}`));
  Object.keys(COMPARE_PRESETS).forEach(v => need.push(`cmp.p.${v}`, `cmp.d.${v}`));
  need.forEach(k => assert.ok(words[k], k));
});

test('switching language changes the strings', () => {
  assert.equal(t('portal'), '← Simuladores');
  const prev = globalThis.document; globalThis.document = undefined;   // node: no DOM, setLanguage returns early
  setLanguage('en'); assert.equal(t('portal'), '← Simulators');
  setLanguage('pt-BR'); assert.equal(t('portal'), '← Simuladores');
  globalThis.document = prev;
});

test('theory page: every Portuguese block has an English twin of the same kind, and vice versa', () => {
  const html = read('teoria.html');
  const body = html.slice(html.indexOf('<article'));
  const tags = cls => [...body.matchAll(new RegExp(`<(p|li|span|strong)\\s+class="${cls}"`, 'g'))].map(m => m[1]);
  const pt = tags('pt'), en = tags('en');
  assert.ok(pt.length > 40, `found ${pt.length} Portuguese blocks`);
  assert.deepEqual(pt, en, 'pt/en blocks must alternate in pairs of the same element type');
  // every pair is adjacent: the pt block comes right before its en twin
  const seq = [...body.matchAll(/class="(pt|en)"/g)].map(m => m[1]);
  for (let i = 0; i < seq.length; i += 2) assert.deepEqual(seq.slice(i, i + 2), ['pt', 'en'], `pair ${i / 2}`);
});

test('theory page: equations are language-neutral (no running text inside math)', () => {
  const html = read('teoria.html');
  for (const m of html.matchAll(/\\text\{([^}]*)\}/g)) assert.ok(!/[áéíóúãõç]/i.test(m[1]) && !/ em | de | e |\//.test(m[1]), `text in math: ${m[1]}`);
});

test('portal card exists in both languages once added to the root portal', () => {
  const portal = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(portal, /data-card-id="transform_lab"/);
  const m = portal.match(/"transform_lab":\s*\{"pt-BR":\s*\{[\s\S]*?\},\s*"en":\s*\{[\s\S]*?\}\s*\}/);
  assert.ok(m, 'cardTranslations entry with pt-BR and en');
});

