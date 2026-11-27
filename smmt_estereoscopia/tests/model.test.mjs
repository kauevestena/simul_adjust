import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  groundCrossingAngleDeg,
  heightComparisonCurve,
  intersectConvexPolygons,
  polygonArea,
  simulate,
} from "../model.mjs";
import {
  analyzeOrthoUsability,
  computePixelGsd,
  horizonSvAt,
  projectGroundToImage,
  projectImageToGround,
} from "../ortho.mjs";

test("parallel axes default state produces exact analytical footprint and overlap", () => {
  assert.equal(DEFAULTS.mountMode, "front");
  assert.equal(DEFAULTS.height, 1.5);

  // With H = 2.0, B = 1.0, Ws = 10, Hs = 10, f = 10 => single ground width = H * Ws / f = 2.0 m
  // Left footprint X in [-1.5, +0.5], Right footprint X in [-0.5, +1.5]
  // Overlap X in [-0.5, +0.5] => width = 1.0 m (50% lateral, 50% area), total swath = 3.0 m
  const sim = simulate({
    mountMode: "nadir",
    height: 2.0,
    baseline: 1.0,
    focal: 10.0,
    sensorWidth: 10.0,
    sensorHeight: 10.0,
    resX: 1000,
    resY: 1000,
    convergenceDeg: 0,
    pitchDeg: 0,
  });

  assert.equal(sim.crossing, null);
  assert.ok(Math.abs(sim.singleWidth - 2.0) < 1e-6);
  assert.ok(Math.abs(sim.overlapWidth - 1.0) < 1e-6);
  assert.ok(Math.abs(sim.overlapAreaPct - 50.0) < 1e-5);
  assert.ok(Math.abs(sim.overlapLateralPct - 50.0) < 1e-5);
  assert.ok(Math.abs(sim.totalSwathWidth - 3.0) < 1e-6);
  assert.ok(Math.abs(sim.gsdMm - 2.0) < 1e-6); // 2.0 m / 1000 px = 2 mm/px
});

test("no overlap when baseline exceeds single footprint width", () => {
  const sim = simulate({
    mountMode: "nadir",
    height: 1.0,
    baseline: 2.0,
    focal: 10.0,
    sensorWidth: 10.0,
    sensorHeight: 10.0,
    convergenceDeg: 0,
    pitchDeg: 0,
  });

  // Single footprint width = 1.0 m, centers at -1 and +1 => gap of 1.0 m
  assert.equal(sim.overlapPoly2D.length, 0);
  assert.equal(sim.overlapAreaPct, 0);
  assert.ok(Math.abs(sim.gapWidth - 1.0) < 1e-6);
});

test("groundCrossingAngleDeg makes optical axes intersect at Y = 0", () => {
  const base = { ...DEFAULTS, mountMode: "nadir", height: 2.0, baseline: 1.2, pitchDeg: 10 };
  const alpha = groundCrossingAngleDeg(base);
  const sim = simulate({ ...base, convergenceDeg: alpha });

  assert.ok(sim.crossing !== null);
  assert.equal(sim.crossing.convergent, true);
  assert.equal(sim.crossing.location, "ground");
  assert.ok(Math.abs(sim.crossing.heightAboveGround) < 1e-6);
  assert.ok(Math.abs(sim.left.axisGround[0]) < 1e-6);
  assert.ok(Math.abs(sim.right.axisGround[0]) < 1e-6);
  const parallel = simulate({ ...base, convergenceDeg: 0 });
  assert.ok(sim.overlapWidth > parallel.overlapWidth);
  assert.ok(sim.overlapArea > parallel.overlapArea);

  // At low height where parallel axes have zero overlap, ground crossing creates strong overlap
  const lowBase = {
    mountMode: "nadir",
    height: 1.0,
    baseline: 1.2,
    focal: 10.0,
    sensorWidth: 10.0,
    sensorHeight: 10.0,
    pitchDeg: 0,
  };
  const lowPar = simulate({ ...lowBase, convergenceDeg: 0 });
  const lowConv = simulate({ ...lowBase, convergenceDeg: groundCrossingAngleDeg(lowBase) });
  assert.equal(lowPar.overlapAreaPct, 0);
  assert.ok(lowConv.overlapAreaPct > 40);
});

test("higher convergence crosses above pavement", () => {
  const sim = simulate({
    ...DEFAULTS,
    mountMode: "nadir",
    height: 2.5,
    baseline: 1.0,
    convergenceDeg: 25,
    pitchDeg: 0,
  });
  assert.ok(sim.crossing.heightAboveGround > 0);
  assert.equal(sim.crossing.location, "above");
});

test("height comparison curve increases overlap monotonically for parallel axes", () => {
  const curve = heightComparisonCurve({ ...DEFAULTS, mountMode: "nadir", convergenceDeg: 0 }, 45);
  assert.equal(curve.length, 46);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(
      curve[i].overlapAreaPct >= curve[i - 1].overlapAreaPct - 1e-6,
      `Expected monotonic overlap increase at step ${i}`,
    );
  }
});

test("Sutherland-Hodgman polygon intersection computes exact square overlap", () => {
  const a = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  const b = [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ];
  const inter = intersectConvexPolygons(a, b);
  assert.ok(Math.abs(polygonArea(inter) - 1.0) < 1e-6);
});

test("front-facing mode looks forward (-Z) and crosses cleanly on pavement", () => {
  const base = {
    ...DEFAULTS,
    mountMode: "front",
    height: 2.0,
    baseline: 1.0,
    pitchDeg: 30,
    convergenceDeg: 0,
  };
  const par = simulate(base);
  // Optical axes should hit pavement ahead of the car (negative Z) at distance H / tan(30°)
  const expectedZ = -2.0 / Math.tan((30 * Math.PI) / 180);
  assert.ok(Math.abs(par.left.axisGround[2] - expectedZ) < 1e-5);
  assert.ok(Math.abs(par.right.axisGround[2] - expectedZ) < 1e-5);
  assert.ok(par.overlapAreaPct > 0);

  const alpha = groundCrossingAngleDeg(base);
  const conv = simulate({ ...base, convergenceDeg: alpha });
  assert.equal(conv.crossing.location, "ground");
  assert.ok(Math.abs(conv.crossing.heightAboveGround) < 1e-5);
  assert.ok(Math.abs(conv.left.axisGround[0]) < 1e-5);
  assert.ok(Math.abs(conv.right.axisGround[0]) < 1e-5);
});

test("projective homography round-trip and oblique GSD increases from bottom to top", () => {
  const sim = simulate({
    ...DEFAULTS,
    mountMode: "front",
    height: 2.2,
    pitchDeg: 25,
    convergenceDeg: 0,
  });
  const cam = sim.left;

  // Round-trip: image -> ground -> image
  const g = projectImageToGround(cam, sim.params, 0.25, -0.4);
  assert.ok(g !== null);
  const back = projectGroundToImage(cam, sim.params, g.x, g.z);
  assert.ok(Math.abs(back.su - 0.25) < 1e-6);
  assert.ok(Math.abs(back.sv - -0.4) < 1e-6);

  // Resolution is finer (smaller GSD) near bottom of trapezoid than further up
  const gsdBottom = computePixelGsd(cam, sim.params, 0, -0.8);
  const gsdCenter = computePixelGsd(cam, sim.params, 0, 0.0);
  assert.ok(gsdBottom.gsdMaxMm < gsdCenter.gsdMaxMm);

  // Horizon / vanishing line is visible for 25° depression with ~57° VFOV
  const svHoriz = horizonSvAt(cam, sim.params, 0);
  assert.ok(svHoriz !== null && svHoriz > 0 && svHoriz < 1);

  const analysis = analyzeOrthoUsability(cam, sim.params, 3.5);
  assert.equal(analysis.horizonVisible, true);
  assert.ok(analysis.unprojectablePct > 0);
  assert.ok(analysis.usablePct > 0 && analysis.usablePct < 100);
});
