// Seeded simulation of the experiment: the printed A4 sheet is stuck on a flat surface and
// measured with a reflectorless total station. Everything random draws from a named stream.
import { stream } from './rng.mjs';
import { referencePoints } from './reference.mjs';
import { UNITS, unitFactor } from './units.mjs';
import { polarToLocal, localToPolar, polarSigmas, localCovariance, simulatePolar, DEG, ARCSEC } from '../../shared/total_station.mjs';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(...a); return a.map(v => v / n); };
const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const PRESETS = {
  // The default: A4 portrait on a wall, oblique so that the line of sight is not along the normal
  wall: { mount: 'wall', landscape: false, distance: 8, hz: 40, heightDiff: 0.4, obliquity: 15, tilt: 0, roll: 0 },
  frontal: { mount: 'wall', landscape: false, distance: 6, hz: 40, heightDiff: 0.4, obliquity: 0, tilt: 0, roll: 0 },
  oblique: { mount: 'wall', landscape: false, distance: 8, hz: 40, heightDiff: 0.4, obliquity: 55, tilt: 0, roll: 0 },
  // Sheet x axis vertical: R[2][0] = ±1, the Euler gimbal lock (φ = ±90°)
  landscape: { mount: 'wall', landscape: true, distance: 8, hz: 40, heightDiff: 0.4, obliquity: 15, tilt: 0, roll: 0 },
  // Face up on a table; roll = 90° aligns the sheet axes with the station axes (R = I, θ = 0)
  table: { mount: 'table', landscape: false, distance: 3, hz: 40, heightDiff: -1.1, obliquity: 0, tilt: 0, roll: 25 },
  tableAligned: { mount: 'table', landscape: false, distance: 3, hz: 90, heightDiff: -1.1, obliquity: 0, tilt: 0, roll: 90 },
  easel: { mount: 'easel', landscape: false, distance: 5, hz: 40, heightDiff: 0.2, obliquity: 20, tilt: 20, roll: 0 }
};

export const DEFAULT_SIM = {
  seed: 7,
  ...PRESETS.wall,
  preset: 'wall',
  refUnit: 'cm', tsUnit: 'm',
  instrument: { angleSec: 2, mm: 2, ppm: 2, pointingMm: 0 },
  reference: { trueSigmaMm: 0.1, printScalePpmX: 0, printScalePpmY: 0 },
  collectedPct: 90, extraPoints: 3,
  azimuthOffset: 0                      // deg; arbitrary origin of the horizontal circle (does not change the adjustment)
};

// Columns of R (sheet axes expressed in the TS frame) for a sheet centred on c
export function sheetAxes(cfg, c) {
  const hz = cfg.hz * DEG, phi = cfg.obliquity * DEG, Z = [0, 0, 1];
  const toInstr = unit([-c[0], -c[1], 0]);                        // horizontal direction sheet → instrument
  const rot = [toInstr[0] * Math.cos(phi) - toInstr[1] * Math.sin(phi), toInstr[0] * Math.sin(phi) + toInstr[1] * Math.cos(phi), 0];
  let n, x, y;
  if (cfg.mount === 'table') {
    n = Z;
    const az = cfg.roll * DEG;
    x = [Math.sin(az), Math.cos(az), 0]; y = cross(n, x);
  } else {
    const tilt = (cfg.mount === 'easel' ? cfg.tilt : 0) * DEG;
    n = unit([rot[0] * Math.cos(tilt), rot[1] * Math.cos(tilt), Math.sin(tilt)]);
    const up = unit([Z[0] - dotp(Z, n) * n[0], Z[1] - dotp(Z, n) * n[1], Z[2] - dotp(Z, n) * n[2]]);
    y = up; x = cross(y, n);
    if (cfg.landscape) { x = up; y = cross(n, x); }
    if (cfg.mount === 'wall' && cfg.roll) {
      const a = cfg.roll * DEG, cx = Math.cos(a), sx = Math.sin(a);
      const nx = [x[0] * cx + y[0] * sx, x[1] * cx + y[1] * sx, x[2] * cx + y[2] * sx];
      const ny = [-x[0] * sx + y[0] * cx, -x[1] * sx + y[1] * cx, -x[2] * sx + y[2] * cx];
      x = nx; y = ny;
    }
  }
  void hz;
  return [[x[0], y[0], n[0]], [x[1], y[1], n[1]], [x[2], y[2], n[2]]];
}

export function simulateDataset(input = {}) {
  const cfg = { ...DEFAULT_SIM, ...input, instrument: { ...DEFAULT_SIM.instrument, ...input.instrument }, reference: { ...DEFAULT_SIM.reference, ...input.reference } };
  const ref0 = referencePoints();                                  // cm
  const toRefUnit = unitFactor('cm', cfg.refUnit);
  const uf = unitFactor(cfg.refUnit, cfg.tsUnit);                  // nominal scale reference → TS
  const rPrint = stream(cfg.seed, 'print'), rNoise = stream(cfg.seed, 'noise'), rCollect = stream(cfg.seed, 'collect'), rExtra = stream(cfg.seed, 'extra');

  // true printed coordinates (cm): nominal × (1 + printer scale error per axis) + random dot placement
  const ex = cfg.reference.printScalePpmX * 1e-6, ey = cfg.reference.printScalePpmY * 1e-6;
  const sPlace = cfg.reference.trueSigmaMm / 10;                  // mm → cm
  const pn = cfg.noise === false ? () => 0 : rPrint.normal;
  const trueCm = ref0.map(p => [p.x * (1 + ex) + sPlace * pn(), p.y * (1 + ey) + sPlace * pn(), sPlace * pn()]);

  // pose of the sheet in the TS frame
  const hz = cfg.hz * DEG, c = [cfg.distance * Math.sin(hz), cfg.distance * Math.cos(hz), cfg.heightDiff];
  const R = sheetAxes(cfg, c);
  const lamTrue = 0.01;                                            // cm → m (nominal, the printer scale error is in the coordinates)
  const centre = [9, 13.5, 0];
  const t = [0, 1, 2].map(r => c[r] - lamTrue * (R[r][0] * centre[0] + R[r][1] * centre[1] + R[r][2] * centre[2]));
  const toTs = xcm => [0, 1, 2].map(r => t[r] + lamTrue * (R[r][0] * xcm[0] + R[r][1] * xcm[1] + R[r][2] * xcm[2]));   // metres

  const mToTs = unitFactor('m', cfg.tsUnit);
  const measure = (name, xm) => {
    const exact = localToPolar(xm);
    const sig = polarSigmas(exact.dist, exact.zen, cfg.instrument);
    const o0 = simulatePolar(xm, sig, cfg.noise === false ? () => 0 : rNoise.normal);
    // the horizontal circle zero is arbitrary: every azimuth is read from an unknown origin
    const o = { ...o0, hz: ((o0.hz + (cfg.azimuthOffset || 0) * DEG) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) };
    const sigM = polarSigmas(o.dist, o.zen, cfg.instrument);     // evaluated at the measured values, as in the field
    const xyzM = polarToLocal(o.hz, o.zen, o.dist);
    const covM = localCovariance(o.hz, o.zen, o.dist, sigM);
    return {
      name, xyz: xyzM.map(v => v * mToTs), cov: covM.map(r => r.map(v => v * mToTs * mToTs)),
      polar: { hzDeg: o.hz / DEG, zenDeg: o.zen / DEG, dist: o.dist, sigmas: sigM }
    };
  };

  // which reference points are collected
  const idx = ref0.map((_, i) => i);
  const keepN = Math.max(3, Math.round(ref0.length * cfg.collectedPct / 100));
  const kept = new Set(rCollect.sample(idx, keepN));
  const ts = [];
  ref0.forEach((p, i) => { if (kept.has(i)) ts.push(measure(p.name, toTs(trueCm[i]))); });

  // extra TS points with no counterpart in the reference list: random marks on the sheet
  const extraTruth = {};
  for (let k = 1; k <= cfg.extraPoints; k++) {
    const xs = [0.5 + 17 * rExtra.uniform(), 0.5 + 26 * rExtra.uniform(), 0];
    const name = `EX${k}`;
    ts.push(measure(name, toTs(xs)));
    extraTruth[name] = xs.map(v => v * toRefUnit);
  }

  return {
    version: 1, refUnit: cfg.refUnit, tsUnit: cfg.tsUnit,
    ref: ref0.map(p => ({ name: p.name, col: p.col, row: p.row, x: p.x * toRefUnit, y: p.y * toRefUnit, z: 0 })),
    ts,
    truth: {
      R, t: t.map(v => v * mToTs), lambdaNominal: uf,
      refTrue: trueCm.map(p => p.map(v => v * toRefUnit)), extraSheet: extraTruth,
      printScalePpm: [cfg.reference.printScalePpmX, cfg.reference.printScalePpmY]
    },
    meta: { source: 'simulation', config: cfg }
  };
}

export { ARCSEC, UNITS };
