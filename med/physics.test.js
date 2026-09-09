'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./physics.js');
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

test('a light pulse travels out AND back; 1 ns corresponds to 149.896229 mm in vacuum', () => {
  near(P.pulse(149.896229, 1).time, 1e-6, 1e-18);
  near(P.pulse(300, 1, 1).errorMm, 149.896229);
  near(P.pulse(600, 1, 1).errorMm, 149.896229);
  near(P.pulse(300, 1, -1).measured, 299.850103771);
  assert.equal(P.pulse(0, 1, -1).valid, false);
});
test('modulation wavelength is twice the one-way ambiguity interval', () => {
  const r = P.phase(3123.456, 10, 1);
  near(r.wavelength, 20); near(r.frequency, 14989622.9);
  near(r.degrees, 124.416, 1e-8); near(r.remainder, 3.456, 1e-9);
  assert.equal(r.cycles, 312);
  near(P.phase(3133.456, 10).degrees, r.degrees, 1e-8);
});
test('four decimal unit lengths progressively remove ambiguity without consulting truth', () => {
  const readings = [
    { unit: 10, degrees: 124.416 }, { unit: 100, degrees: 84.4416 },
    { unit: 1000, degrees: 44.44416 }, { unit: 10000, degrees: 112.444416 }
  ];
  [1000, 100, 10, 1].forEach((count, i) => assert.equal(P.solveAmbiguity(readings.slice(0, i + 1)).candidates.length, count));
  near(P.solveAmbiguity(readings).candidates[0].distance, 3123.456);
  const twice = P.solveAmbiguity(readings, 20000);
  assert.equal(twice.candidates.length, 2); assert.equal(twice.unique, false);
  near(twice.candidates[1].distance, 13123.456);
});
test('phase wrapping works at zero, decade boundaries and immediately on either side', () => {
  for (const distance of [0, .001, 9.999, 10, 10.001, 99.999, 100, 999.999, 1000, 9999.999]) {
    const result = P.solveAmbiguity(P.UNITS.map(unit => P.phase(distance, unit)));
    assert.equal(result.unique, true, `distance ${distance}`);
    near(result.candidates[0].distance, distance, 1e-7);
  }
  near(P.circularDifference(.01, 359.99), .02, 1e-9);
  near(P.circularDifference(359.99, .01), -.02, 1e-9);
  near(P.phase(10, 10).degrees, 0);
  assert.equal(P.solveAmbiguity([]).unique, false);
});
test('upper bound is excluded and contradictory readings produce no candidates', () => {
  const zeros = P.UNITS.map(unit => ({ unit, degrees: 0 }));
  const r = P.solveAmbiguity(zeros);
  assert.deepEqual(r.candidates.map(v => v.distance), [0]);
  assert.equal(P.solveAmbiguity([{ unit: 10, degrees: 0 }, { unit: 100, degrees: 10 }]).candidates.length, 0);
});
test('mm, metres and ppm remain distinct and correction reverses the error sign', () => {
  const r = P.errorBudget(250, { zero: 5, scale: 4, amplitude: 3, unit: 1000, prism: -2 });
  near(r.zero, 5); near(r.scale, 1); near(r.cyclic, 3); near(r.total, 7);
  near(P.errorBudget(1000, { scale: 1 }).total, 1);
  near(P.nominalMm(500, 2, 2), 3);
  near(P.errorBudget(250, { amplitude: 3, unit: 1000, phaseDeg: 180 }).cyclic, -3);
});
test('calibration recovers independently specified zero and scale with exact data', () => {
  const observations = [0, 250, 500, 1000].map((distance, i) => ({ distance, errorMm: [5, 6, 7, 9][i], sigmaMm: 1 }));
  const fit = P.fitCalibration(observations);
  near(fit.coefficients[0], 5); near(fit.coefficients[1], 4);
  near(fit.rms, 0); assert.equal(fit.dof, 2);
});
test('calibration recovers sine/cosine coefficients and not a supplied truth', () => {
  // U=40; manual quarter-cycle values, varying lengths independently of phase.
  const distances = [0, 10, 20, 30, 80, 130, 180, 230];
  const sine = [0, 1, 0, -1, 0, 1, 0, -1], cosine = [1, 0, -1, 0, 1, 0, -1, 0];
  const observations = distances.map((distance, i) => ({ distance, errorMm: 2 + 6 * distance / 1000 + 3 * sine[i] + 4 * cosine[i], sigmaMm: 1 }));
  const fit = P.fitCalibration(observations, 40, true);
  [2, 6, 3, 4].forEach((v, i) => near(fit.coefficients[i], v, 1e-8));
  near(fit.amplitude, 5); near(fit.rms, 0);
  assert.ok(P.fitCalibration(observations, 40, false).rms > 1);
});
test('weighted residuals are orthogonal to design and known covariance is recovered', () => {
  const equal = [0, 1000, 2000].map(distance => ({ distance, errorMm: 1, sigmaMm: 1 }));
  const known = P.fitCalibration(equal);
  near(known.covariance[0][0], 5 / 6); near(known.covariance[1][1], .5); near(known.covariance[0][1], -.5);
  const observations = [0, 500, 1000, 1500].map((distance, i) => ({ distance, errorMm: [2, 5, 3, 7][i], sigmaMm: [1, 2, 1, 3][i] }));
  const fit = P.fitCalibration(observations);
  near(fit.residuals.reduce((sum, r, i) => sum + r / observations[i].sigmaMm ** 2, 0), 0);
  near(fit.residuals.reduce((sum, r, i) => sum + r * observations[i].distance / 1000 / observations[i].sigmaMm ** 2, 0), 0);
});
test('deficient baselines fail explicitly instead of emitting false parameters', () => {
  const repeated = Array.from({ length: 8 }, () => ({ distance: 100, errorMm: 2, sigmaMm: 1 }));
  assert.throws(() => P.fitCalibration(repeated), /diversidade/);
  const locked = [20, 60, 120, 220, 360, 520, 780, 1020].map(distance => ({ distance, errorMm: 3, sigmaMm: 1 }));
  assert.throws(() => P.fitCalibration(locked, 20, true), /diversidade/);
  assert.throws(() => P.fitCalibration(repeated.slice(0, 2)), /observações/);
});
test('baseline diversity changes parameter uncertainty even at the same observation count', () => {
  const data = distances => distances.map(distance => ({ distance, errorMm: 0, sigmaMm: 1 }));
  const broad = P.fitCalibration(data([0, 250, 500, 1000]));
  const narrow = P.fitCalibration(data([100, 100.1, 100.2, 100.3]));
  assert.ok(narrow.standardErrors[1] > 1000 * broad.standardErrors[1]);
});
test('air-density approximation has a declared reference and correct temperature/pressure response', () => {
  near(P.airIndex(15, 1013.25), 1.00028, 1e-14);
  // At twice absolute temperature, refractivity halves; at half pressure too.
  near(P.airIndex(303.15, 1013.25), 1.00014, 1e-14);
  near(P.airIndex(15, 506.625), 1.00014, 1e-14);
  const warmer = P.atmosphere(1000, 25, 1013.25, 15, 1013.25);
  assert.ok(warmer.indicated < 1000); assert.ok(warmer.correctionPpm > 0);
  near(warmer.corrected, 1000, 1e-9);
  const matching = P.atmosphere(1000, 25, 950, 25, 950);
  near(matching.correctionPpm, 0); near(matching.correctionMm, 0);
  near(P.atmosphere(2000, 25, 1013.25).correctionMm, 2 * warmer.correctionMm, 1e-7);
});
test('path integration distinguishes uniform air and an unsampled warm middle', () => {
  const uniform = P.pathAtmosphere(1000, [15, 15, 15], 1013.25, 15);
  near(uniform.errorMm, 0, 1e-6);
  const warm = P.pathAtmosphere(1000, [15, 35, 15], 1013.25, 15);
  assert.ok(warm.errorMm < -5);
  near(warm.average, (2 * 1.00028 + P.airIndex(35, 1013.25)) / 3, 1e-14);
  near(warm.time, 2 * 1000 * warm.average / P.C, 1e-18);
});
test('zenith angles, heights and angular uncertainty use consistent units', () => {
  const r = P.reduceSlope(100, 60, 1.5, 2);
  near(r.horizontal, 50 * Math.sqrt(3)); near(r.vertical, 50); near(r.heightDifference, 49.5);
  const horizontal = P.reduceSlope(1000, 90, 1.5, 2, 2, 5);
  near(horizontal.horizontal, 1000); near(horizontal.heightDifference, -.5);
  near(horizontal.sigmaHorizontalMm, 2); near(horizontal.sigmaVerticalMm, 24.240684055, 1e-8);
  const up = P.reduceSlope(1000, 0, 0, 0, 2, 5);
  near(up.sigmaHorizontalMm, horizontal.sigmaVerticalMm); near(up.sigmaVerticalMm, 2);
  near(P.reduceSlope(100, 180).vertical, -100);
});
test('target experiment follows its relative inverse-square and cosine assumptions', () => {
  near(P.targetReturn(100, .8, 0), .8);
  near(P.targetReturn(200, .8, 60), .1);
  near(P.targetReturn(100, 0, 0), 0);
  near(P.targetReturn(100, 1, 90), 0);
});
test('repetition is reproducible, preserves prefixes and does not remove systematic bias', () => {
  const a = P.repeatedMeasurements(4, 5, 2, 42), b = P.repeatedMeasurements(100, 5, 2, 42);
  assert.deepEqual(a.errors, b.errors.slice(0, 4));
  assert.deepEqual(a, P.repeatedMeasurements(4, 5, 2, 42));
  assert.notDeepEqual(a.errors, P.repeatedMeasurements(4, 5, 2, 43).errors);
  near(a.expectedStandardError, 1); near(b.expectedStandardError, .2);
  const systematic = P.repeatedMeasurements(100, 5, 0);
  near(systematic.mean, 5); near(systematic.standardDeviation, 0); near(systematic.standardError, 0);
});
test('nonphysical and nonfinite numerical inputs are rejected', () => {
  assert.throws(() => P.airIndex(-273.15, 1000), RangeError);
  assert.throws(() => P.airIndex(15, 0), RangeError);
  assert.throws(() => P.phase(10, 0), RangeError);
  assert.throws(() => P.phase(NaN, 10), RangeError);
  assert.throws(() => P.solveAmbiguity([{ unit: 0, degrees: 0 }]), RangeError);
  assert.throws(() => P.reduceSlope(100, 181), RangeError);
  assert.throws(() => P.repeatedMeasurements(1, 0, 1), RangeError);
});
