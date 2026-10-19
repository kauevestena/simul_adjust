import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adjustTransformation } from '../core/transform.mjs';
import { rotationDifference } from '../core/rotations.mjs';

const ref = JSON.parse(readFileSync(new URL('./numerical-reference.json', import.meta.url), 'utf8'));
const { src, dst, Sigma_T, Sigma_S, pairs, D, sigma_D, lambda0 } = ref.input;

test('numerical reference was produced by the independent NumPy oracle', () => {
  assert.match(ref.provenance.method, /NumPy/);
  assert.equal(Object.keys(ref.cases).length, 9);
});

for (const [name, c] of Object.entries(ref.cases)) {
  test(`matches the NumPy oracle: ${name}`, () => {
    const injunctions = c.injunctions ? { type: c.injunctions, pairs: pairs.map(([i, j], k) => ({ i, j, D: D[k], sigma: sigma_D[k] })) } : null;
    const r = adjustTransformation({
      method: c.method, rotation: c.rotation, estimateScale: c.estimateScale, src, dst, SigmaT: Sigma_T, SigmaS: Sigma_S, lambda0, injunctions
    });
    assert.equal(r.r, c.r, 'redundancy');
    assert.ok(Math.abs(r.Omega - c.Omega) < 1e-7 * Math.max(1, c.Omega), `Ω ${r.Omega} vs ${c.Omega}`);
    assert.ok(Math.abs(r.lambda - c.lam) < 1e-12, `λ ${r.lambda} vs ${c.lam}`);
    r.t.forEach((v, i) => assert.ok(Math.abs(v - c.t[i]) < 1e-9, `t${i} ${v} vs ${c.t[i]}`));
    assert.ok(rotationDifference(r.R, c.R) < 1e-10, 'rotation');
    // a-priori standard deviations of the translation and of λ
    r.SigmaXapriori.slice(0, 3).forEach((row, i) => {
      const sd = Math.sqrt(Math.max(row[i], 0));
      assert.ok(Math.abs(sd - c.sigmas_apriori[i]) < 1e-5 * Math.max(sd, 1e-9) + 1e-12, `σ_t${i} ${sd} vs ${c.sigmas_apriori[i]}`);
    });
    if (c.estimateScale) {
      const k = r.nUnknown - 1, sd = Math.sqrt(Math.max(r.SigmaXapriori[k][k], 0));
      assert.ok(Math.abs(sd - c.sigmas_apriori[c.sigmas_apriori.length - 1]) < 1e-5 * sd + 1e-14, `σ_λ ${sd} vs ${c.sigmas_apriori.at(-1)}`);
    }
  });
}

test('parametric Euler agrees with an independent weighted Gauss–Newton', () => {
  const r = adjustTransformation({ method: 'parametrico', rotation: 'euler', estimateScale: true, src, dst, SigmaT: Sigma_T, SigmaS: Sigma_S, lambda0 });
  ref.gauss_newton_parametric_euler.forEach((v, i) => assert.ok(Math.abs(r.X[i] - v) < 1e-9, `X${i}`));
});
