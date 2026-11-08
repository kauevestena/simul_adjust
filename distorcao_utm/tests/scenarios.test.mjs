import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../model.mjs';
import { SCENARIOS, scenarioById, DEFAULT_SCENARIO } from '../scenarios.mjs';
import { assessSystematic, level } from '../systematic.mjs';
import { createGeoidLoader } from '../geoid.mjs';

const loader = createGeoidLoader({
  base: new URL('../data/egm2008-5/', import.meta.url).href,
  fetchImpl: async url => { const b = fs.readFileSync(new URL(url)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; },
});
const METRICS = ['ppm', 'dh', 'dz', 'dg', 'd3'];

test('verdict levels: ≤ T/3 negligible, ≤ T tolerable, > T exceeds (sign ignored)', () => {
  assert.equal(level(0.006, 0.02), 'negligible');
  assert.equal(level(-0.0067, 0.02), 'tolerable');
  assert.equal(level(0.02, 0.02), 'tolerable');
  assert.equal(level(-0.021, 0.02), 'exceeds');
});

test('scenario definitions are complete, bilingual and inside the model limits', () => {
  assert.equal(new Set(SCENARIOS.map(s => s.id)).size, SCENARIOS.length);
  assert.ok(scenarioById(DEFAULT_SCENARIO));
  assert.ok(SCENARIOS.some(s => s.group === 'tolerable') && SCENARIOS.some(s => s.group === 'critical'));
  for (const s of SCENARIOS) {
    assert.ok(['tolerable', 'critical'].includes(s.group), s.id);
    assert.ok(s.tolerance > 0 && s.tolerance <= 1, s.id);
    assert.ok(METRICS.includes(s.display.metric), s.id);
    assert.ok(s.display.metric !== 'dg' || s.params.geoid, `${s.id}: geoid metric needs the geoid`);
    for (const pair of [s.title, s.text]) assert.ok(pair.length === 2 && pair.every(x => x.trim().length > 10), s.id);
    const p = M.normalizeParams({ ...M.DEFAULTS, ...s.params });
    for (const [k, v] of Object.entries(s.params)) assert.equal(p[k], v, `${s.id}.${k} is clamped`);
  }
  assert.deepEqual(scenarioById('pato').params, {}, 'the default scenario is the model default');
});

for (const s of SCENARIOS) {
  test(`scenario ${s.id}: quoted scale error and verdict match the model`, async () => {
    const p = M.normalizeParams({ ...M.DEFAULTS, ...s.params });
    const patch = p.geoid ? await loader.patch(M.areaBounds(p)) : null;
    const out = M.simulate(p, { geoidPatch: patch, maxPoints: 400000, gridSize: 41 });
    const a = assessSystematic(out, s.tolerance);
    assert.ok(Math.abs(a.scale.ppm - s.claim.ppm) <= Math.max(3, 0.02 * Math.abs(s.claim.ppm)), `${a.scale.ppm} vs ${s.claim.ppm}`);
    assert.ok(s.claim.overall.includes(a.overall), `${s.id}: ${a.overall}`);
    assert.equal(s.group === 'tolerable', a.overall !== 'exceeds', `${s.id}: group vs verdict`);
    if (p.geoid) assert.ok(a.vertical.geoid > 0.5, 'the steep geoid tilts the cloud by more than 50 cm');
  });
}
