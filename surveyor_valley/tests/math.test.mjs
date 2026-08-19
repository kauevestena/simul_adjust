// Pure-math tests. No DOM, no dependencies, no package.json:
//   node --test surveyor_valley/tests/
//
// These exist because every number the game shows a student is derived here,
// and a wrong azimuth convention or a `0°59'60"` would teach the wrong thing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sightTarget } from '../src/survey/station.js';

import { formatDMS, parseDMS, normalize360, normalize180, degToSec, degToGon, gonToDeg, formatGon, formatAngle } from '../src/survey/units.js';
import { azimuth, polarPoint, rumo, formatRumo, areaOf, perimeterOf, sideTable } from '../src/survey/geometry.js';
import { TIERS, distanceSigma, directionSigma, getInstrument, resolveKit } from '../src/survey/instrument.js';
import { solveResection } from '../src/survey/resection.js';
import {
  computeTraverse,
  expectedAngleSum,
  anglesFromCoords,
  distancesFromCoords,
  RULE,
} from '../src/survey/traverse.js';
import { makeRng } from '../src/core/rng.js';
import { toRad } from '../src/survey/units.js';
import { datumShift, accuracyReport } from '../src/survey/network.js';
import { buildErrorFigure, chooseExaggeration } from '../src/report/errorfigure.js';

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${a} ≈ ${b} (tol ${tol})`);

// ---------------------------------------------------------------- azimuth ---

test('azimuth is clockwise from North: atan2(dE, dN), not atan2(y, x)', () => {
  // The whole convention in one table. If this ever flips, every number the
  // game prints is wrong in a way that looks plausible.
  const cases = [
    [0, 1, 0, 'N'],
    [1, 1, 45, 'NE'],
    [1, 0, 90, 'E'],
    [1, -1, 135, 'SE'],
    [0, -1, 180, 'S'],
    [-1, -1, 225, 'SW'],
    [-1, 0, 270, 'W'],
    [-1, 1, 315, 'NW'],
  ];
  for (const [dE, dN, expected, name] of cases) {
    near(azimuth(0, 0, dE, dN), expected, 1e-9, `azimuth to ${name}`);
  }
});

test('azimuth and polarPoint are inverses', () => {
  const rng = makeRng('az-roundtrip', 't');
  for (let i = 0; i < 500; i++) {
    const E0 = rng.range(-500, 500);
    const N0 = rng.range(-500, 500);
    const az = rng.range(0, 360);
    const d = rng.range(1, 400);
    const p = polarPoint(E0, N0, az, d);
    near(azimuth(E0, N0, p.E, p.N), az, 1e-9, 'azimuth back');
    near(Math.hypot(p.E - E0, p.N - N0), d, 1e-9, 'distance back');
  }
});

test('normalize360 and normalize180 wrap correctly', () => {
  near(normalize360(-10), 350, 1e-12);
  near(normalize360(370), 10, 1e-12);
  near(normalize360(720), 0, 1e-12);
  near(normalize180(190), -170, 1e-12);
  near(normalize180(180), 180, 1e-12);
  near(normalize180(-190), 170, 1e-12);
});

// -------------------------------------------------------------------- DMS ---

test('formatDMS rounds seconds first, then carries', () => {
  // The classic bug: naive decomposition prints 0°59'60".
  assert.equal(formatDMS(0.9999999), '1°00\'00"');
  assert.equal(formatDMS(0.999999 * 60 / 60), '1°00\'00"');
  assert.equal(formatDMS(59.9999999 / 3600), '0°01\'00"');
  assert.equal(formatDMS(359.9999999), '0°00\'00"'); // wraps rather than printing 360
  assert.equal(formatDMS(87 + 12 / 60 + 45 / 3600), '87°12\'45"');
  assert.equal(formatDMS(0), '0°00\'00"');
});

test('formatDMS never emits 60 in the minutes or seconds field', () => {
  const rng = makeRng('dms-sweep', 't');
  for (let i = 0; i < 20000; i++) {
    const deg = rng.range(0, 360);
    for (const decimals of [0, 1, 2]) {
      const s = formatDMS(deg, { decimals });
      const m = s.match(/^(\d+)°(\d{2})'([\d.]+)"$/);
      assert.ok(m, `unparseable output: ${s}`);
      assert.ok(Number(m[1]) < 360, `degrees overflowed: ${s}`);
      assert.ok(Number(m[2]) < 60, `minutes hit 60: ${s}`);
      assert.ok(Number(m[3]) < 60, `seconds hit 60: ${s}`);
    }
  }
});

test('parseDMS accepts every syntax a student might type', () => {
  const expected = 87 + 12 / 60 + 45 / 3600;
  for (const s of ['87°12\'45"', '87 12 45', '87-12-45', '87:12:45', '87º12\'45"']) {
    near(parseDMS(s), expected, 1e-12, `parsing ${s}`);
  }
  near(parseDMS('87.2125'), 87.2125, 1e-12, 'decimal degrees');
  near(parseDMS('87,2125'), 87.2125, 1e-12, 'comma decimal');
  near(parseDMS('87 12 45.5'), 87 + 12 / 60 + 45.5 / 3600, 1e-12, 'fractional seconds');
  near(parseDMS('-12 30 00'), -(12.5), 1e-12, 'negative');
  assert.equal(parseDMS(''), null);
  assert.equal(parseDMS('abc'), null);
  assert.equal(parseDMS('87 70 00'), null, 'minutes >= 60 rejected');
});

test('parseDMS(formatDMS(x)) round-trips within half an arc-second', () => {
  const rng = makeRng('dms-roundtrip', 't');
  for (let i = 0; i < 10000; i++) {
    const deg = rng.range(0, 360);
    const back = parseDMS(formatDMS(deg, { decimals: 2 }));
    const errSec = Math.abs(degToSec(normalize180(back - deg)));
    assert.ok(errSec <= 0.5, `round-trip error ${errSec}" for ${deg}`);
  }
});

// ------------------------------------------------------------------- rumo ---

test('rumo maps each quadrant, with exact cardinals called out', () => {
  assert.deepEqual(rumo(0), { quadrant: 'NE', angle: 0, cardinal: 'N' });
  assert.deepEqual(rumo(90), { quadrant: 'SE', angle: 90, cardinal: 'E' });
  assert.deepEqual(rumo(180), { quadrant: 'SE', angle: 0, cardinal: 'S' });
  assert.deepEqual(rumo(270), { quadrant: 'SW', angle: 90, cardinal: 'W' });

  const r1 = rumo(30);
  assert.equal(r1.quadrant, 'NE');
  near(r1.angle, 30, 1e-12);

  const r2 = rumo(150);
  assert.equal(r2.quadrant, 'SE');
  near(r2.angle, 30, 1e-12);

  const r3 = rumo(210);
  assert.equal(r3.quadrant, 'SW');
  near(r3.angle, 30, 1e-12);

  const r4 = rumo(330);
  assert.equal(r4.quadrant, 'NW');
  near(r4.angle, 30, 1e-12);
});

test('formatRumo follows each language convention', () => {
  const az = 87 + 12 / 60 + 45 / 3600;
  assert.equal(formatRumo(az, 'pt'), '87°12\'45" NE');
  assert.equal(formatRumo(az, 'en'), 'N 87°12\'45" E');
  assert.equal(formatRumo(270, 'pt'), 'O'); // Oeste
  assert.equal(formatRumo(270, 'en'), 'W');
});

// ------------------------------------------------------------------- area ---

test('shoelace area, perimeter and orientation', () => {
  const square = [
    { id: 'A', E: 0, N: 0 },
    { id: 'B', E: 10, N: 0 },
    { id: 'C', E: 10, N: 10 },
    { id: 'D', E: 0, N: 10 },
  ];
  const a = areaOf(square);
  near(a.m2, 100, 1e-9, 'square area');
  assert.equal(a.ccw, true, 'this winding is counter-clockwise');
  near(perimeterOf(square), 40, 1e-9, 'square perimeter');

  const reversed = [...square].reverse();
  const b = areaOf(reversed);
  near(b.m2, 100, 1e-9, 'reversed area unchanged');
  assert.equal(b.ccw, false, 'sign flips with winding');

  near(a.hectares, 0.01, 1e-12, 'hectares');
  near(areaOf(square).alqueirePaulista, 100 / 24200, 1e-15, 'alqueire');
});

test('area of a hand-computed irregular pentagon', () => {
  // Shoelace by hand: (0,0) (40,0) (55,25) (25,45) (-10,20)
  //  = ½|0·0−40·0 + 40·25−55·0 + 55·45−25·25 + 25·20−(−10)·45 + (−10)·0−0·20|
  //  = ½|0 + 1000 + (2475−625) + (500+450) + 0| = ½(1000+1850+950) = 1900
  const p = [
    { id: '1', E: 0, N: 0 },
    { id: '2', E: 40, N: 0 },
    { id: '3', E: 55, N: 25 },
    { id: '4', E: 25, N: 45 },
    { id: '5', E: -10, N: 20 },
  ];
  near(areaOf(p).m2, 1900, 1e-9, 'pentagon area');
});

test('sideTable produces consistent azimuths, distances and bearings', () => {
  const ring = [
    { id: 'M1', E: 0, N: 0 },
    { id: 'M2', E: 100, N: 0 },
    { id: 'M3', E: 100, N: 100 },
    { id: 'M4', E: 0, N: 100 },
  ];
  const sides = sideTable(ring, (i) => `viz-${i}`);
  assert.equal(sides.length, 4);
  near(sides[0].azimuth, 90, 1e-9, 'M1->M2 due East');
  near(sides[1].azimuth, 0, 1e-9, 'M2->M3 due North');
  near(sides[2].azimuth, 270, 1e-9, 'M3->M4 due West');
  near(sides[3].azimuth, 180, 1e-9, 'M4->M1 due South');
  for (const s of sides) near(s.distance, 100, 1e-9, 'each side 100 m');
  assert.equal(sides[2].confrontante, 'viz-2');
});

// ------------------------------------------------------------- instrument ---

test('distance sigma combines mm and ppm in quadrature', () => {
  const et10 = getInstrument('et10');
  near(distanceSigma(et10, 0), 0.010, 1e-12, 'fixed part alone');
  // At 1000 m: √(0.010² + 0.010²)
  near(distanceSigma(et10, 1000), Math.hypot(0.01, 0.01), 1e-12, 'quadrature, not a linear sum');
  assert.ok(distanceSigma(et10, 1000) < 0.02, 'a linear sum would give exactly 0.020');

  const et5 = getInstrument('et5');
  assert.ok(distanceSigma(et5, 200) < distanceSigma(et10, 200), 'better gear, smaller sigma');
});

test('empirical distance noise matches the stated sigma', () => {
  const rng = makeRng('sigma-check', 't');
  const inst = getInstrument('et10');
  const d = 150;
  const sigma = distanceSigma(inst, d);
  const n = 100000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = rng.gauss() * sigma;
    sum += v;
    sumSq += v * v;
  }
  const empirical = Math.sqrt(sumSq / n - (sum / n) ** 2);
  near(empirical / sigma, 1, 0.02, 'empirical sigma within 2%');
});

test('direction sigma penalises short sights', () => {
  const inst = getInstrument('et10');
  assert.ok(directionSigma(inst, 3) > directionSigma(inst, 200), 'short sights are worse');
  // At long range the pointing term is negligible and the tier spec dominates.
  near(directionSigma(inst, 500) * 3600, 10, 0.3, 'converges to the stated 10"');
});

test('every tier is monotonically better and priced upward', () => {
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].sigmaDirSec <= TIERS[i - 1].sigmaDirSec, 'angles improve');
    assert.ok(TIERS[i].distA_mm <= TIERS[i - 1].distA_mm, 'distances improve');
    assert.ok(TIERS[i].price > TIERS[i - 1].price, 'and cost more');
  }
});

// -------------------------------------------------------------- resection ---

/** Forward-simulate noise-free polar observations from a station. */
function simulateSights(station, theta0, points, scale = 1) {
  return points.map((p) => {
    const az = normalize360((Math.atan2(p.E - station.E, p.N - station.N) * 180) / Math.PI);
    return {
      targetId: p.id,
      hz: normalize360(az - theta0),
      distance: Math.hypot(p.E - station.E, p.N - station.N) / scale,
    };
  });
}

test('resection recovers station, orientation and unit scale exactly when noise-free', () => {
  const known = {
    A: { E: 1000, N: 1000 },
    B: { E: 1180, N: 1040 },
    C: { E: 1120, N: 1210 },
  };
  const truth = { E: 1075.321, N: 1088.654 };
  const theta0 = 213.777;
  const obs = simulateSights(truth, theta0, [
    { id: 'A', ...known.A },
    { id: 'B', ...known.B },
    { id: 'C', ...known.C },
  ]);

  const sol = solveResection(obs, known);
  assert.equal(sol.ok, true);
  near(sol.E, truth.E, 1e-9, 'easting');
  near(sol.N, truth.N, 1e-9, 'northing');
  near(normalize180(sol.theta0 - theta0), 0, 1e-9, 'orientation constant');
  assert.ok(Math.abs(sol.scale - 1) < 1e-12, 'scale is unity');
  assert.ok(sol.rms < 1e-9, 'residuals vanish');
});

test('resection is exact with only two known points', () => {
  const known = { A: { E: 0, N: 0 }, B: { E: 200, N: 60 } };
  const truth = { E: 80, N: -40 };
  const theta0 = 47.5;
  const obs = simulateSights(truth, theta0, [
    { id: 'A', ...known.A },
    { id: 'B', ...known.B },
  ]);
  const sol = solveResection(obs, known);
  assert.equal(sol.ok, true);
  near(sol.E, truth.E, 1e-9, 'easting');
  near(sol.N, truth.N, 1e-9, 'northing');
  near(normalize180(sol.theta0 - theta0), 0, 1e-9, 'orientation');
});

test('resection reports a scale blunder in ppm', () => {
  const known = {
    A: { E: 1000, N: 1000 },
    B: { E: 1180, N: 1040 },
    C: { E: 1120, N: 1210 },
  };
  const truth = { E: 1075, N: 1090 };
  // Every distance short by 500 ppm, as if the prism constant were wrong.
  const obs = simulateSights(truth, 12, [
    { id: 'A', ...known.A },
    { id: 'B', ...known.B },
    { id: 'C', ...known.C },
  ], 1 - 500e-6);
  const sol = solveResection(obs, known);
  near(sol.scalePPM, -500, 1, 'recovered scale error');
  assert.equal(sol.scaleSuspect, true, 'flagged for the player');
});

test('resection with realistic noise lands within a sane error band', () => {
  const rng = makeRng('resection-mc', 't');
  const known = {
    A: { E: 1000, N: 1000 },
    B: { E: 1180, N: 1040 },
    C: { E: 1120, N: 1210 },
  };
  const truth = { E: 1075, N: 1090 };
  const inst = getInstrument('et10');
  const errors = [];

  for (let trial = 0; trial < 1000; trial++) {
    const obs = simulateSights(truth, 137.2, [
      { id: 'A', ...known.A },
      { id: 'B', ...known.B },
      { id: 'C', ...known.C },
    ]).map((o) => ({
      ...o,
      hz: normalize360(o.hz + rng.gauss() * directionSigma(inst, o.distance)),
      distance: o.distance + rng.gauss() * distanceSigma(inst, o.distance),
    }));
    const sol = solveResection(obs, known);
    errors.push(Math.hypot(sol.E - truth.E, sol.N - truth.N));
  }

  const rmsErr = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  // Sights are ~100 m; 10" is ~5 mm at that range, distances ~10 mm.
  assert.ok(rmsErr > 0.001, `error should not be zero, got ${rmsErr}`);
  assert.ok(rmsErr < 0.05, `error should stay under 50 mm, got ${rmsErr}`);
});

test('resection refuses a degenerate configuration', () => {
  const known = { A: { E: 0, N: 0 } };
  const sol = solveResection([{ targetId: 'A', hz: 0, distance: 10 }], known);
  assert.equal(sol.ok, false);
  assert.equal(sol.reason, 'needTwoPoints');
});

// --------------------------------------------------------------- traverse ---

const SQUARE_CCW = [
  { id: 'E1', E: 1000, N: 1000 },
  { id: 'E2', E: 1100, N: 1000 },
  { id: 'E3', E: 1100, N: 1100 },
  { id: 'E4', E: 1000, N: 1100 },
];

test('expected angle sum: interior for a CCW loop, exterior for a CW one', () => {
  // A CCW square read with angles to the right gives four interior 90s.
  const ccw = expectedAngleSum(4, 360);
  assert.equal(ccw.kind, 'interior');
  assert.equal(ccw.sum, 360);

  // The same square walked the other way gives four exterior 270s.
  const cw = expectedAngleSum(4, 1080);
  assert.equal(cw.kind, 'exterior');
  assert.equal(cw.sum, 1080);

  // Six stations, interior.
  assert.equal(expectedAngleSum(6, 720).sum, 720);
});

test('angles derived from a CCW square are the interior angles', () => {
  const angles = anglesFromCoords(SQUARE_CCW);
  for (const a of angles) near(a, 90, 1e-9, 'interior right angle');
  near(angles.reduce((s, a) => s + a, 0), 360, 1e-9, 'sum = (n-2)·180');
});

test('angles derived from a CW square are the exterior angles', () => {
  const cw = [...SQUARE_CCW].reverse();
  const angles = anglesFromCoords(cw);
  for (const a of angles) near(a, 270, 1e-9, 'exterior angle');
  near(angles.reduce((s, a) => s + a, 0), 1080, 1e-9, 'sum = (n+2)·180');
});

test('a perfect closed traverse closes to zero and reproduces its coordinates', () => {
  for (const pts of [SQUARE_CCW, [...SQUARE_CCW].reverse()]) {
    const angles = anglesFromCoords(pts);
    const distances = distancesFromCoords(pts);
    const startAz = azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N);

    const r = computeTraverse({
      stations: pts.map((p) => ({ id: p.id })),
      angles,
      distances,
      startPoint: { E: pts[0].E, N: pts[0].N },
      startAzimuth: startAz,
      sigmaDirSec: 10,
    });

    assert.equal(r.ok, true);
    near(r.eAngSec, 0, 1e-6, 'no angular misclosure');
    assert.equal(r.angOk, true);
    assert.ok(r.eLin < 1e-9, `no linear misclosure, got ${r.eLin}`);

    for (let i = 0; i < pts.length; i++) {
      near(r.coords[i].E, pts[i].E, 1e-9, `E of ${pts[i].id}`);
      near(r.coords[i].N, pts[i].N, 1e-9, `N of ${pts[i].id}`);
    }
  }
});

test('a five-sided irregular traverse also closes perfectly when noise-free', () => {
  const pts = [
    { id: 'E1', E: 1000, N: 1000 },
    { id: 'E2', E: 1142.15, N: 1007.02 },
    { id: 'E3', E: 1188.4, N: 1120.9 },
    { id: 'E4', E: 1071.6, N: 1195.3 },
    { id: 'E5', E: 971.2, N: 1108.75 },
  ];
  const r = computeTraverse({
    stations: pts.map((p) => ({ id: p.id })),
    angles: anglesFromCoords(pts),
    distances: distancesFromCoords(pts),
    startPoint: { E: pts[0].E, N: pts[0].N },
    startAzimuth: azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N),
    sigmaDirSec: 10,
  });
  assert.equal(r.ok, true);
  assert.ok(r.eLin < 1e-9, `linear closure ${r.eLin}`);
  for (let i = 0; i < pts.length; i++) {
    near(r.coords[i].E, pts[i].E, 1e-9, `E of ${pts[i].id}`);
    near(r.coords[i].N, pts[i].N, 1e-9, `N of ${pts[i].id}`);
  }
  near(areaOf(r.coords).m2, areaOf(pts).m2, 1e-6, 'area survives the traverse');
});

test('an evenly spread angular error is removed exactly', () => {
  // Equal distribution assumes the error is shared equally among the stations.
  // When it genuinely is, the compensation is exact and the figure lands back
  // on its true corners.
  const pts = SQUARE_CCW;
  const r = computeTraverse({
    stations: pts.map((p) => ({ id: p.id })),
    angles: anglesFromCoords(pts).map((a) => a + 15 / 3600),
    distances: distancesFromCoords(pts),
    startPoint: { E: pts[0].E, N: pts[0].N },
    startAzimuth: azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N),
    sigmaDirSec: 10,
  });

  near(r.eAngSec, 60, 1e-6, 'four stations, 15" each');
  near(r.angleCorrSec, -15, 1e-6, 'so 15" comes back off each');
  assert.ok(r.eLin < 1e-9, 'and the traverse then closes exactly');
  for (let i = 0; i < pts.length; i++) {
    near(r.coords[i].E, pts[i].E, 1e-9, `E of ${pts[i].id}`);
    near(r.coords[i].N, pts[i].N, 1e-9, `N of ${pts[i].id}`);
  }
});

test('a blunder at one station is detected and damped, but cannot be undone', () => {
  // This is the honest — and didactically important — limit of the method.
  // Equal distribution has no way to know WHERE the error happened, so a
  // 60" blunder at a single station gets smeared over all four. The closure
  // check catches it; the compensation only reduces its effect.
  const pts = SQUARE_CCW;
  const bad = anglesFromCoords(pts);
  bad[1] += 60 / 3600;

  const r = computeTraverse({
    stations: pts.map((p) => ({ id: p.id })),
    angles: bad,
    distances: distancesFromCoords(pts),
    startPoint: { E: pts[0].E, N: pts[0].N },
    startAzimuth: azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N),
    sigmaDirSec: 10,
  });

  near(r.eAngSec, 60, 1e-6, 'the misclosure is exactly the error we injected');
  near(r.angleCorrSec, -15, 1e-6, 'spread equally over four stations');
  near(r.adjAngles.reduce((s, a) => s + a, 0), 360, 1e-9, 'adjusted angles now sum correctly');
  assert.ok(Math.abs(r.eAngSec) > r.tolAngSec, '60" fails the 10" instrument tolerance');

  const err = (coords) =>
    Math.max(...pts.map((p, i) => Math.hypot(coords[i].E - p.E, coords[i].N - p.N)));
  const rawErr = err(r.rawCoords);
  const adjErr = err(r.coords);

  assert.ok(adjErr < rawErr, `compensation must improve the figure (${rawErr} → ${adjErr})`);
  assert.ok(adjErr < 0.05, `and leave it within 50 mm, got ${adjErr}`);
  assert.ok(adjErr > 0.001, 'but it genuinely cannot recover the truth');
});

test('compensation conserves the misclosure exactly, under both rules', () => {
  const pts = SQUARE_CCW;
  const bad = anglesFromCoords(pts);
  bad[2] += 120 / 3600;

  for (const rule of [RULE.BOWDITCH, RULE.TRANSIT]) {
    const r = computeTraverse({
      stations: pts.map((p) => ({ id: p.id })),
      angles: bad,
      distances: distancesFromCoords(pts),
      startPoint: { E: pts[0].E, N: pts[0].N },
      startAzimuth: azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N),
      rule,
      sigmaDirSec: 10,
    });
    const sumCorrE = r.corrections.reduce((s, c) => s + c.dE, 0);
    const sumCorrN = r.corrections.reduce((s, c) => s + c.dN, 0);
    near(sumCorrE, -r.eE, 1e-9, `${rule}: ΣδE = −eE`);
    near(sumCorrN, -r.eN, 1e-9, `${rule}: ΣδN = −eN`);
  }
});

test('angular tolerance scales with instrument and station count', () => {
  const pts = SQUARE_CCW;
  const args = {
    stations: pts.map((p) => ({ id: p.id })),
    angles: anglesFromCoords(pts),
    distances: distancesFromCoords(pts),
    startPoint: { E: pts[0].E, N: pts[0].N },
    startAzimuth: 90,
  };
  const cheap = computeTraverse({ ...args, sigmaDirSec: 10 });
  const good = computeTraverse({ ...args, sigmaDirSec: 5 });
  assert.ok(good.tolAngSec < cheap.tolAngSec, 'a better instrument earns a tighter tolerance');
  // 2·10"·√2·√4 = 56.6"
  near(cheap.tolAngSec, 2 * 10 * Math.SQRT2 * 2, 1e-9);
});

test('relative precision is reported as 1:N against the total length', () => {
  const pts = SQUARE_CCW;
  const distances = distancesFromCoords(pts);
  // Stretch one leg by 4 cm: 400 m of traverse, 0.04 m of closure → 1:10000.
  const stretched = [...distances];
  stretched[0] += 0.04;

  const r = computeTraverse({
    stations: pts.map((p) => ({ id: p.id })),
    angles: anglesFromCoords(pts),
    distances: stretched,
    startPoint: { E: pts[0].E, N: pts[0].N },
    startAzimuth: azimuth(pts[0].E, pts[0].N, pts[1].E, pts[1].N),
    sigmaDirSec: 10,
  });
  near(r.eLin, 0.04, 1e-9, 'linear misclosure');
  near(r.sumD, 400.04, 1e-9, 'total length');
  near(r.relDenominator, 400.04 / 0.04, 1e-6, 'relative precision denominator');
});

test('computeTraverse rejects malformed input rather than guessing', () => {
  assert.equal(computeTraverse({ stations: [{ id: 'a' }, { id: 'b' }], angles: [], distances: [], startPoint: { E: 0, N: 0 }, startAzimuth: 0 }).reason, 'needThreeStations');
  assert.equal(
    computeTraverse({
      stations: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      angles: [1, 2],
      distances: [1, 2, 3],
      startPoint: { E: 0, N: 0 },
      startAzimuth: 0,
    }).reason,
    'lengthMismatch',
  );
});

// --------------------------------------------------------------------- rng ---

test('a seed reproduces its stream exactly, and named streams differ', () => {
  const a = makeRng('sv-abc', 'terrain');
  const b = makeRng('sv-abc', 'terrain');
  const c = makeRng('sv-abc', 'scatter');
  const av = Array.from({ length: 1000 }, () => a.next());
  const bv = Array.from({ length: 1000 }, () => b.next());
  const cv = Array.from({ length: 1000 }, () => c.next());
  assert.deepEqual(av, bv, 'same seed and stream → identical values');
  assert.notDeepEqual(av, cv, 'different stream → different values');
  assert.ok(av.every((v) => v >= 0 && v < 1), 'uniforms stay in range');
});

test('gauss is unbiased with unit variance', () => {
  const rng = makeRng('gauss-check', 't');
  const n = 200000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = rng.gauss();
    sum += v;
    sumSq += v * v;
  }
  near(sum / n, 0, 0.01, 'mean');
  near(Math.sqrt(sumSq / n), 1, 0.01, 'standard deviation');
});

// ---------------------------------------------------------- two faces -----

/**
 * Collimation error, and why the two-face procedure exists.
 *
 * `c` is a fixed mechanical misalignment of the line of sight — the same value
 * on every reading from that instrument, forever. So it is NOT noise, and the
 * distinction is the entire lesson: averaging a thousand readings on one face
 * leaves it untouched, while a single pair of faces removes it exactly.
 */
test('a single face carries the collimation error however many times you read', () => {
  const kit = resolveKit({ instrument: 'et10', tripod: 'tri-mad', target: 'bastao' });
  const c = getInstrument('et10').collimationSec;
  const setup = { id: 'st-1', E: 1000, N: 1000, trueE: 1000, trueN: 1000, circleOffset: 0, theta0: 0, observations: [] };
  const target = { id: 'T', trueE: 1120, trueN: 1060 };
  const truth = azimuth(1000, 1000, target.trueE, target.trueN);
  // A perfect target, so only collimation and pointing remain.
  const clean = { ...kit, target: { centringSigma_mm: 0.0001 } };

  const rng = makeRng('collimation', 'one-face');
  const errs = [];
  for (let i = 0; i < 3000; i++) {
    const o = sightTarget({ setup, target, kit: clean, rng, twoFace: false });
    errs.push(normalize180(o.hz - truth) * 3600);
  }
  const bias = errs.reduce((a, b) => a + b, 0) / errs.length;

  assert.ok(
    Math.abs(bias - c) < 1.5,
    `one face should sit ~${c}" off the truth; measured ${bias.toFixed(2)}"`,
  );
});

test('two faces cancel it exactly, and recover 2c for the student to read', () => {
  const kit = resolveKit({ instrument: 'et10', tripod: 'tri-mad', target: 'bastao' });
  const c = getInstrument('et10').collimationSec;
  const setup = { id: 'st-1', E: 1000, N: 1000, trueE: 1000, trueN: 1000, circleOffset: 0, theta0: 0, observations: [] };
  const target = { id: 'T', trueE: 1120, trueN: 1060 };
  const truth = azimuth(1000, 1000, target.trueE, target.trueN);
  const clean = { ...kit, target: { centringSigma_mm: 0.0001 } };

  const rng = makeRng('collimation', 'two-face');
  const errs = [];
  const twoCs = [];
  for (let i = 0; i < 3000; i++) {
    const o = sightTarget({ setup, target, kit: clean, rng, twoFace: true });
    errs.push(normalize180(o.hz - truth) * 3600);
    twoCs.push(o.twoCSec);
  }
  const bias = errs.reduce((a, b) => a + b, 0) / errs.length;
  const meanTwoC = twoCs.reduce((a, b) => a + b, 0) / twoCs.length;

  assert.ok(Math.abs(bias) < 1.0, `two faces should be unbiased; measured ${bias.toFixed(2)}"`);
  assert.ok(
    Math.abs(meanTwoC - 2 * c) < 2,
    `2c should come back as ${2 * c}"; measured ${meanTwoC.toFixed(2)}"`,
  );

  // And the pair is a mean of two readings, so it is also quieter by √2. That
  // is a bonus, not the point — the point is the bias above.
  const sd = Math.sqrt(errs.reduce((s, v) => s + (v - bias) ** 2, 0) / errs.length);
  assert.ok(sd > 0, 'the pair must still carry pointing noise');
});

test('the two-face mean is taken the short way round the circle', () => {
  // A pair straddling 0° must not average to its own opposite. Every angle in
  // the game is normalized to [0, 360), so this is a real hazard rather than a
  // theoretical one.
  const kit = resolveKit({ instrument: 'et1', tripod: 'tri-fib', target: 'prisma-tri' });
  const setup = { id: 'st-1', E: 1000, N: 1000, trueE: 1000, trueN: 1000, circleOffset: 0, theta0: 0, observations: [] };
  const clean = { ...kit, target: { centringSigma_mm: 0.0001 } };

  // Due north from the station: readings land either side of zero.
  const target = { id: 'N', trueE: 1000, trueN: 1150 };
  const rng = makeRng('collimation', 'wrap');
  for (let i = 0; i < 400; i++) {
    const o = sightTarget({ setup, target, kit: clean, rng, twoFace: true });
    const off = Math.abs(normalize180(o.hz - 0)) * 3600;
    assert.ok(off < 120, `mean across 0° went wrong: hz=${o.hz.toFixed(6)} (${off.toFixed(1)}" off north)`);
  }
});

// ----------------------------------------------------------------- gon -----

test('gon converts, formats and round-trips', () => {
  assert.equal(degToGon(360), 400);
  assert.equal(degToGon(90), 100);
  assert.equal(gonToDeg(400), 360);
  assert.ok(Math.abs(gonToDeg(degToGon(123.456)) - 123.456) < 1e-12);

  // The whole point of the unit: a right angle needs no sexagesimal carrying.
  assert.equal(formatGon(90), '100.0000 gon');
  assert.equal(formatAngle(90, 'gon'), '100.0000 gon');
  assert.equal(formatAngle(90, 'dms'), formatDMS(90));

  // An unknown format must not silently produce nothing.
  assert.equal(formatAngle(90, 'nonsense'), formatDMS(90));
});

// --------------------------------------------------- aligning the frames ----

test('datumShift recovers a pure translation exactly', () => {
  // The surveyed frame differs from the world's by a shift and nothing else —
  // arbitrary origin, map north — so this has an exact answer, and the whole
  // per-corner error report rests on it being exact.
  const shift = { dE: 1000 - 73.25, dN: 1000 - 118.5 };
  const net = [
    { id: 'M1', trueE: 73.25, trueN: 118.5 },
    { id: 'M2', trueE: 130.0, trueN: 96.25 },
    { id: 'M3', trueE: 101.75, trueN: 160.0 },
  ].map((p) => ({ ...p, E: p.trueE + shift.dE, N: p.trueN + shift.dN }));

  const got = datumShift(net);
  assert.ok(Math.abs(got.dE - shift.dE) < 1e-9, `dE ${got.dE}`);
  assert.ok(Math.abs(got.dN - shift.dN) < 1e-9, `dN ${got.dN}`);
  assert.equal(got.n, 3);

  // With the shift removed there is nothing left, because nothing was wrong.
  const report = accuracyReport(net, got);
  assert.ok(report.rms < 1e-9, `residual ${report.rms}`);
});

test('accuracyReport returns the error that was actually injected', () => {
  const shift = { dE: 900, dN: 900 };
  const errors = [
    { dE: 0.012, dN: -0.005 },
    { dE: -0.003, dN: 0.021 },
    { dE: 0.0, dN: 0.0 },
    { dE: -0.009, dN: -0.009 },
  ];
  // Zero-mean, so the fitted shift is the true one and the residuals survive.
  const mE = errors.reduce((s, e) => s + e.dE, 0) / errors.length;
  const mN = errors.reduce((s, e) => s + e.dN, 0) / errors.length;

  const net = errors.map((e, i) => ({
    id: `P${i}`,
    trueE: 100 + i * 17,
    trueN: 200 - i * 11,
    E: 100 + i * 17 + shift.dE + e.dE - mE,
    N: 200 - i * 11 + shift.dN + e.dN - mN,
  }));

  const report = accuracyReport(net, datumShift(net));
  assert.equal(report.n, 4);
  report.items.forEach((item, i) => {
    assert.ok(Math.abs(item.dE - (errors[i].dE - mE)) < 1e-9, `${item.id} dE`);
    assert.ok(Math.abs(item.dN - (errors[i].dN - mN)) < 1e-9, `${item.id} dN`);
  });
  // The worst one is the one that is worst, and it is named.
  const biggest = report.items.reduce((w, i) => (i.d > w.d ? i : w));
  assert.equal(report.worst.id, biggest.id);
});

test('an unsurveyed network reports nothing rather than NaN', () => {
  assert.deepEqual(datumShift([]), { dE: 0, dN: 0, n: 0 });
  assert.equal(accuracyReport([]).n, 0);
  assert.equal(accuracyReport([{ id: 'x', trueE: 1, trueN: 2, E: null, N: null }]).n, 0);
});

// -------------------------------------------------------- the error plot ----

test('the error figure states its exaggeration and draws one vector per corner', () => {
  // Every number on this drawing is a lie without the factor printed beside it:
  // the vectors are millimetres shown at metres. So the factor is asserted to
  // be on the sheet, not merely computed.
  const corners = [
    { label: 'V1', E: 1000, N: 1000, dE: 0.012, dN: -0.004, d: Math.hypot(0.012, 0.004) },
    { label: 'V2', E: 1050, N: 1004, dE: -0.006, dN: 0.009, d: Math.hypot(0.006, 0.009) },
    { label: 'V3', E: 1042, N: 1046, dE: 0.001, dN: 0.002, d: Math.hypot(0.001, 0.002) },
    { label: 'V4', E: 998, N: 1039, dE: -0.008, dN: -0.001, d: Math.hypot(0.008, 0.001) },
  ];
  const fig = buildErrorFigure({ corners, t: (k, v) => `${k}:${JSON.stringify(v ?? {})}` });

  assert.ok(fig.factor > 1, 'the vectors have to be magnified to be visible at all');
  const texts = fig.drawList.items.filter((i) => i.t === 'text').map((i) => i.s);
  assert.ok(texts.some((s) => s.includes('figureLegend') && s.includes(String(fig.factor))), 'the factor is printed');
  assert.ok(texts.some((s) => s.includes('figureNote')), 'and so is "not part of the delivery"');

  // One error line per corner that actually has an error.
  const lines = fig.drawList.items.filter((i) => i.t === 'line');
  assert.equal(lines.length, corners.length, 'one vector per corner');

  // Nothing may wander off the sheet, or the worst corner is the one you cannot see.
  for (const it of fig.drawList.items) {
    for (const [x, y] of coordsOf(it)) {
      assert.ok(x >= -1 && x <= fig.sheet.w + 1, `x ${x} is off the sheet`);
      assert.ok(y >= -1 && y <= fig.sheet.h + 1, `y ${y} is off the sheet`);
    }
  }
});

test('the exaggeration is chosen for the worst vector, and is a round number', () => {
  // 8% of a 50 m figure is 4 m; a 20 mm error therefore wants about 200x.
  assert.equal(chooseExaggeration(0.02, 50), 200);
  // A big blunder needs less magnification, not more.
  assert.ok(chooseExaggeration(1.0, 50) < chooseExaggeration(0.02, 50));
  // Degenerate inputs must not produce Infinity on a drawing.
  assert.ok(Number.isFinite(chooseExaggeration(0, 50)));
  assert.ok(Number.isFinite(chooseExaggeration(0.01, 0)));
});

function coordsOf(it) {
  if (it.t === 'line') return [[it.x1, it.y1], [it.x2, it.y2]];
  if (it.t === 'poly') return it.pts;
  if (it.t === 'rect') return [[it.x, it.y], [it.x + it.w, it.y + it.h]];
  return [[it.x, it.y]];
}
