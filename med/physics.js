/* Numerical models for the MED lessons. SI internally, explicit mm/ppm at the
 * instrument-error boundary. No DOM, dependencies or hidden random state. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MEDPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const C = 299792458;
  const TAU = 2 * Math.PI;
  const UNITS = [10, 100, 1000, 10000]; // U = lambda_mod / 2, NOT wavelength.
  const REFERENCE = { temperature: 15, pressure: 1013.25, index: 1.00028 };
  function finite(value, name) {
    if (!Number.isFinite(value)) throw new RangeError(`${name}: valor não finito`);
    return value;
  }
  function positive(value, name) {
    finite(value, name);
    if (value <= 0) throw new RangeError(`${name}: use um valor positivo`);
    return value;
  }
  function mod(value, period) {
    positive(period, 'período');
    return ((finite(value, 'valor') % period) + period) % period;
  }
  function circularDifference(a, b, period = 360) {
    return mod(a - b + period / 2, period) - period / 2;
  }
  function pulse(distance, index = REFERENCE.index, timingErrorNs = 0) {
    if (finite(distance, 'distância') < 0) throw new RangeError('distância negativa');
    const velocity = C / positive(index, 'índice');
    const time = 2 * distance / velocity;
    const observedTime = time + finite(timingErrorNs, 'erro temporal') * 1e-9;
    return { velocity, time, observedTime, measured: velocity * observedTime / 2,
      errorMm: velocity * timingErrorNs * 1e-6 / 2, valid: observedTime >= 0 };
  }
  function phase(distance, unit, index = REFERENCE.index, phaseErrorDeg = 0) {
    if (finite(distance, 'distância') < 0) throw new RangeError('distância negativa');
    positive(unit, 'unidade de comprimento');
    const fraction = mod(distance, unit) / unit;
    const degrees = mod(fraction * 360 + finite(phaseErrorDeg, 'erro de fase'), 360);
    return { unit, wavelength: 2 * unit, frequency: C / (positive(index, 'índice') * 2 * unit),
      cycles: Math.floor(distance / unit), degrees, remainder: degrees * unit / 360 };
  }
  // Enumerate fine-frequency candidates and compare *circular* phase residuals.
  // No access to simulated truth. The upper bound is exclusive: [0, maxDistance).
  function solveAmbiguity(readings, maxDistance = 10000, toleranceDeg = 0.02) {
    if (!readings.length) return { candidates: [], unique: false };
    positive(maxDistance, 'alcance'); positive(toleranceDeg, 'tolerância');
    readings.forEach(r => { positive(r.unit, 'unidade'); finite(r.degrees, 'fase'); });
    const fine = readings.reduce((a, b) => a.unit < b.unit ? a : b);
    if (maxDistance / fine.unit > 100000) throw new RangeError('muitos candidatos');
    const remainder = mod(fine.degrees, 360) * fine.unit / 360;
    const candidates = [];
    for (let k = 0; k * fine.unit + remainder < maxDistance - 1e-10; k++) {
      const distance = k * fine.unit + remainder;
      const residuals = readings.map(r => circularDifference(phase(distance, r.unit).degrees, r.degrees));
      if (residuals.every(v => Math.abs(v) <= toleranceDeg + 1e-9)) {
        candidates.push({ distance, cycles: k, residuals });
      }
    }
    return { candidates, unique: candidates.length === 1 };
  }
  function errorBudget(distance, { zero = 0, scale = 0, amplitude = 0, phaseDeg = 0, unit = 10, prism = 0 } = {}) {
    if (finite(distance, 'distância') < 0) throw new RangeError('distância negativa');
    [zero, scale, amplitude, phaseDeg, prism].forEach(v => finite(v, 'parâmetro'));
    const cyclic = amplitude * Math.sin(TAU * distance / positive(unit, 'unidade') + phaseDeg * Math.PI / 180);
    const scaleMm = scale * distance / 1000;
    return { zero, scale: scaleMm, cyclic, prism, total: zero + scaleMm + cyclic + prism };
  }
  function nominalMm(distance, a, b) {
    return Math.abs(finite(a, 'a')) + Math.abs(finite(b, 'b')) * Math.abs(finite(distance, 'distância')) / 1000;
  }
  // Explicit teaching approximation: dry gas, fixed optical band/composition.
  // Refractivity is proportional to density p/T; n_ref is chosen, not an EDM's
  // certified reference index. This is not Ciddor, IUGG, or a humidity correction.
  function airIndex(temperature, pressure) {
    if (finite(temperature, 'temperatura') <= -273.15) throw new RangeError('temperatura absoluta inválida');
    positive(pressure, 'pressão');
    return 1 + (REFERENCE.index - 1) * (pressure / REFERENCE.pressure) *
      (REFERENCE.temperature + 273.15) / (temperature + 273.15);
  }
  function atmosphere(distance, temperature, pressure, setTemperature = 15, setPressure = 1013.25) {
    if (finite(distance, 'distância') < 0) throw new RangeError('distância negativa');
    const actual = airIndex(temperature, pressure);
    const configured = airIndex(setTemperature, setPressure);
    const indicated = distance * actual / configured;
    const correctionPpm = (configured / actual - 1) * 1e6;
    return { actual, configured, indicated, correctionPpm,
      correctionMm: (distance - indicated) * 1000,
      corrected: indicated * configured / actual };
  }
  function pathAtmosphere(distance, temperatures, pressure, sensorTemperature) {
    positive(distance, 'distância');
    if (!temperatures.length) throw new RangeError('sem segmentos');
    const indices = temperatures.map(t => airIndex(t, pressure));
    const average = indices.reduce((s, n) => s + n, 0) / indices.length;
    const sensorIndex = airIndex(sensorTemperature, pressure);
    const indicated = distance * average / sensorIndex;
    return { indices, average, sensorIndex, indicated, errorMm: (indicated - distance) * 1000,
      time: 2 * distance * average / C };
  }
  function reduceSlope(distance, zenithDeg, instrumentHeight = 0, targetHeight = 0,
    sigmaDistanceMm = 0, sigmaZenithSeconds = 0) {
    positive(distance, 'distância');
    if (finite(zenithDeg, 'zênite') < 0 || zenithDeg > 180) throw new RangeError('zênite fora de [0, 180]');
    finite(instrumentHeight, 'altura'); finite(targetHeight, 'altura');
    const z = zenithDeg * Math.PI / 180;
    const sd = finite(sigmaDistanceMm, 'incerteza') / 1000;
    const sz = finite(sigmaZenithSeconds, 'incerteza angular') * Math.PI / (180 * 3600);
    if (sd < 0 || sz < 0) throw new RangeError('incerteza negativa');
    return { horizontal: distance * Math.sin(z), vertical: distance * Math.cos(z),
      heightDifference: instrumentHeight + distance * Math.cos(z) - targetHeight,
      sigmaHorizontalMm: Math.hypot(Math.sin(z) * sd, distance * Math.cos(z) * sz) * 1000,
      sigmaVerticalMm: Math.hypot(Math.cos(z) * sd, distance * Math.sin(z) * sz) * 1000 };
  }
  function targetReturn(distance, reflectance, incidenceDeg) {
    positive(distance, 'distância');
    finite(reflectance, 'reflectância'); finite(incidenceDeg, 'incidência');
    if (reflectance < 0 || reflectance > 1 || incidenceDeg < 0 || incidenceDeg > 90) throw new RangeError('alvo inválido');
    // Relative Lambertian receiver signal, fixed intercepted power and aperture.
    // Normalized to a white, normal surface at 100 m; no absolute range claim.
    return reflectance * Math.cos(incidenceDeg * Math.PI / 180) * (100 / distance) ** 2;
  }
  function normalRandom(seed) {
    let state = seed >>> 0;
    const uniform = () => { state = (1664525 * state + 1013904223) >>> 0; return (state + 0.5) / 4294967296; };
    return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(TAU * uniform());
  }
  function repeatedMeasurements(count, biasMm, sigmaMm, seed = 42) {
    if (!Number.isInteger(count) || count < 2 || count > 10000) throw new RangeError('n fora de [2, 10000]');
    finite(biasMm, 'viés'); finite(sigmaMm, 'desvio padrão');
    if (sigmaMm < 0) throw new RangeError('desvio padrão negativo');
    const random = normalRandom(seed);
    const errors = Array.from({ length: count }, () => biasMm + sigmaMm * random());
    const mean = errors.reduce((s, v) => s + v, 0) / count;
    const standardDeviation = Math.sqrt(errors.reduce((s, v) => s + (v - mean) ** 2, 0) / (count - 1));
    return { errors, mean, standardDeviation, standardError: standardDeviation / Math.sqrt(count),
      expectedStandardError: sigmaMm / Math.sqrt(count) };
  }
  function calibrationObservations(distances, parameters, sigmaMm, seed = 42) {
    if (!Number.isFinite(sigmaMm) || sigmaMm < 0) throw new RangeError('ruído inválido');
    const random = normalRandom(seed);
    return distances.map(distance => ({ distance,
      errorMm: errorBudget(distance, parameters).total + sigmaMm * random(),
      sigmaMm: sigmaMm || 1 }));
  }
  // Weighted, twice-orthogonalized QR. Avoid normal-equation inversion and report
  // unidentifiable models instead of inventing a calibration for a deficient base.
  function fitCalibration(observations, unit = 10, includeCyclic = false) {
    positive(unit, 'unidade');
    const p = includeCyclic ? 4 : 2;
    const n = observations.length;
    if (n <= p) throw new RangeError('É preciso ter mais observações que parâmetros.');
    const design = observations.map(o => {
      finite(o.distance, 'distância'); finite(o.errorMm, 'erro'); positive(o.sigmaMm, 'sigma');
      return [1, o.distance / 1000, ...(includeCyclic ? [Math.sin(TAU * o.distance / unit), Math.cos(TAU * o.distance / unit)] : [])];
    });
    const columns = Array.from({ length: p }, (_, j) => design.map((row, i) => row[j] / observations[i].sigmaMm));
    const y = observations.map(o => o.errorMm / o.sigmaMm);
    const R = Array.from({ length: p }, () => Array(p).fill(0));
    const Q = [];
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    for (let j = 0; j < p; j++) {
      const v = columns[j].slice();
      const originalNorm = Math.hypot(...v);
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < j; k++) {
          const projection = dot(Q[k], v);
          R[k][j] += projection;
          v.forEach((_, i) => { v[i] -= projection * Q[k][i]; });
        }
      }
      R[j][j] = Math.hypot(...v);
      if (R[j][j] <= 1e-9 * Math.max(1, originalNorm)) {
        throw new RangeError('Base sem diversidade suficiente: estes parâmetros não podem ser separados.');
      }
      Q.push(v.map(x => x / R[j][j]));
    }
    const backSolve = rhs => {
      const x = Array(p).fill(0);
      for (let i = p - 1; i >= 0; i--) {
        x[i] = (rhs[i] - R[i].reduce((s, v, j) => s + (j > i ? v * x[j] : 0), 0)) / R[i][i];
      }
      return x;
    };
    const coefficients = backSolve(Q.map(q => dot(q, y)));
    const fitted = design.map(row => dot(row, coefficients));
    const residuals = observations.map((o, i) => o.errorMm - fitted[i]);
    const dof = n - p;
    const sse = residuals.reduce((s, r, i) => s + (r / observations[i].sigmaMm) ** 2, 0);
    const inverseColumns = Array.from({ length: p }, (_, j) => backSolve(Array.from({ length: p }, (_, i) => +(i === j))));
    const covariance = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) =>
      inverseColumns.reduce((s, col) => s + col[i] * col[j], 0)));
    const standardErrors = covariance.map((row, i) => Math.sqrt(row[i]));
    return { coefficients, fitted, residuals, dof, sigma0: Math.sqrt(sse / dof),
      rms: Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / n),
      standardErrors, covariance,
      correlation: covariance[0][1] / (standardErrors[0] * standardErrors[1]),
      amplitude: includeCyclic ? Math.hypot(coefficients[2], coefficients[3]) : 0 };
  }
  return { C, TAU, UNITS, REFERENCE, mod, circularDifference, pulse, phase, solveAmbiguity,
    errorBudget, nominalMm, airIndex, atmosphere, pathAtmosphere, reduceSlope,
    targetReturn, normalRandom, repeatedMeasurements, calibrationObservations, fitCalibration };
});
