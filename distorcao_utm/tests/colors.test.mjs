import test from 'node:test';
import assert from 'node:assert/strict';
import { LUTS, rgbToOklab, makeScale, unitFor, niceTicks } from '../colors.mjs';

test('every colour ramp is monotone in OKLab lightness (magnitude reads as lightness)', () => {
  for (const [name, lut] of Object.entries(LUTS)) {
    let prev = -1;
    for (let i = 0; i < 256; i++) {
      const L = rgbToOklab([lut[3 * i], lut[3 * i + 1], lut[3 * i + 2]])[0];
      assert.ok(L >= prev - 1e-3, `${name} step ${i}`);
      prev = L;
    }
  }
});

test('signed metrics: blue below zero, red above, gray-ish neutral at zero', () => {
  const s = makeScale('ppm', -300, 100, 'data');
  assert.equal(s.kind, 'diverging');
  const [rn, , bn] = s.color(-300), [rp, , bp] = s.color(100), z = s.color(0);
  assert.ok(bn > rn && rp > bp);
  assert.ok(Math.max(...z) - Math.min(...z) < 12);
  // a small negative tail stays faint next to a large positive side
  const tail = makeScale('dz', -0.0026, 0.195, 'data');
  const L = c => rgbToOklab(c)[0];
  assert.ok(Math.abs(L(tail.color(-0.0026)) - L(tail.color(0))) < 0.03);
  assert.ok(L(tail.color(0.195)) - L(tail.color(0)) > 0.3);
  const z0 = makeScale('dz', -0.1, 0.5, 'zero');
  assert.equal(z0.min, -0.5); assert.equal(z0.max, 0.5);
  assert.equal(makeScale('ppm', -235, -209, 'data').kind, 'negative');
  assert.equal(makeScale('dh', 0.1, 0.3, 'zero').min, 0);
});

test('units and ticks', () => {
  assert.equal(unitFor('ppm', 300).unit, 'ppm');
  assert.equal(unitFor('dh', 0.004).unit, 'mm');
  assert.equal(unitFor('dh', 0.3).unit, 'cm');
  assert.equal(unitFor('dh', 3).unit, 'm');
  assert.deepEqual(niceTicks(-1, 1, 4), [-1, -0.5, 0, 0.5, 1]);
});
