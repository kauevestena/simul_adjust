import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../model.mjs';
import * as C from '../../network_preanalysis/network/coordinates.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./pyproj-utm-reference.json', import.meta.url)));
const small = { spanWE: 600, spanNS: 400, grid: 3, sizeMin: 20, sizeMax: 60, buildingDensity: 0.5, terrainDensity: 0.05 };

test('UTM forward (Krüger n^6) matches PROJ: E/N < 1 mm, k < 1e-9, γ < 1e-7°', () => {
  for (const c of fixture.cases) {
    const u = M.utmForward(c.lat, c.lon, c.zone, c.south);
    assert.ok(Math.abs(u.E - c.E) < 1e-3, `E ${c.lat},${c.lon}: ${u.E} vs ${c.E}`);
    assert.ok(Math.abs(u.N - c.N) < 1e-3, `N ${c.lat},${c.lon}`);
    assert.ok(Math.abs(u.k - c.k) < 1e-9, `k ${c.lat},${c.lon}: ${u.k} vs ${c.k}`);
    assert.ok(Math.abs(u.gamma - c.convergence) < 1e-7, `γ ${c.lat},${c.lon}: ${u.gamma} vs ${c.convergence}`);
  }
});

test('UTM known values: k0 on the CM, false origin, zones', () => {
  const u = M.utmForward(0, -51, 22, false);
  assert.ok(Math.abs(u.E - 500000) < 1e-9 && Math.abs(u.N) < 1e-9 && Math.abs(u.k - 0.9996) < 1e-15);
  assert.equal(M.zoneOf(-52.671), 22); assert.equal(M.zoneOf(180), 1); assert.equal(M.zoneOf(-180), 1); assert.equal(M.zoneOf(179.9), 60);
  assert.equal(M.centralMeridian(22), -51);
  assert.equal(M.chooseZone(-52.671, 'west'), 21); assert.equal(M.chooseZone(-52.671, 'east'), 23); assert.equal(M.chooseZone(178, 'east'), 1);
  // ppm at the CM on the equator at h = 0 is exactly the k0 reduction
  const ctx = M.projectionContext(M.normalizeParams({ lat: 0, lon: -51, h0: 0 }));
  assert.ok(Math.abs(ctx.ppm0 - (-400)) < 1e-6, String(ctx.ppm0));
  assert.ok(Math.abs((M.elevationFactor(-26.229, 1000) - 1) * 1e6 + 157) < 1, 'EF ≈ −157 ppm at 1000 m');
});

test('batch ECEF -> geodetic agrees with network_preanalysis/coordinates.mjs', () => {
  const o = {};
  for (const llh of [{ lat: -26.229, lon: -52.671, h: 1000 }, { lat: 83.9, lon: 179.9, h: 9000 }, { lat: -79.9, lon: -179.9, h: -500 }, { lat: 0, lon: 0, h: 0 }, { lat: 45, lon: 90, h: 4321.5 }]) {
    const xyz = C.llhToEcef(llh), ref = C.ecefToLlh(xyz);
    M.ecefToGeodeticInto(...xyz, o);
    assert.ok(Math.abs(o.phi * 180 / Math.PI - ref.lat) < 1e-11 && Math.abs(o.lam * 180 / Math.PI - ref.lon) < 1e-11 && Math.abs(o.h - ref.h) < 1e-6);
  }
});

test('the scene: cubes are exact cubes in ECEF/ENU, terrain lies on h = h0', () => {
  const cloud = M.generateCloud(small);
  const ctx = M.projectionContext(cloud.params);
  const o = {};
  for (const b of cloud.buildings) {
    const c = b.corners.map(([x, y, z]) => M.transformPoint(ctx, x, y, z, {}));
    const d = (i, j) => Math.hypot(c[i].e - c[j].e, c[i].n - c[j].n, c[i].u - c[j].u);
    for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 4], [3, 7], [4, 5], [6, 7]]) assert.ok(Math.abs(d(i, j) - b.size) < 1e-6, `edge ${i}-${j}`);
    assert.ok(Math.abs(d(0, 7) - b.size * Math.sqrt(3)) < 1e-6, 'space diagonal');
    M.transformPoint(ctx, ...b.origin, o);
    assert.ok(Math.abs(o.h - cloud.params.h0) < 1e-6, 'base on the surface');
  }
  for (let i = 0; i < cloud.X.length; i++) if (cloud.cls[i] === 0) {
    M.ecefToGeodeticInto(cloud.X[i], cloud.Y[i], cloud.Z[i], o);
    assert.ok(Math.abs(o.h - cloud.params.h0) < 1e-6);
  }
  assert.equal(cloud.counts.total, cloud.X.length);
  assert.ok(cloud.counts.terrain > 0 && cloud.counts.buildings > 0);
});

test('no terrain points inside building footprints', () => {
  const cloud = M.generateCloud({ ...small, terrainDensity: 0.5 });
  const ctx = M.projectionContext(cloud.params);
  const o = {};
  for (let i = 0; i < cloud.X.length; i += 3) if (cloud.cls[i] === 0) {
    M.transformPoint(ctx, cloud.X[i], cloud.Y[i], cloud.Z[i], o);
    for (const b of cloud.buildings) {
      const inside = Math.abs(o.e - b.e) < b.size / 2 - 0.05 && Math.abs(o.n - b.n) < b.size / 2 - 0.05;
      assert.ok(!inside, `terrain point ${i} inside building ${b.id}`);
    }
  }
});

test('UTM: horizontal cube edges scale by k·ρ/(ρ+h); heights are untouched without geoid', () => {
  for (const p of [{}, { lat: 60, lon: 10.5, h0: 3000, zone: 'west' }, { lat: -5, lon: -45, h0: 0 }]) {
    const out = M.simulate({ ...small, ...p }, { gridSize: 11 });
    for (const b of out.buildings) {
      const meanPpm = ((b.utmWE + b.utmSN) / 2 / b.size - 1) * 1e6;
      assert.ok(Math.abs(meanPpm - b.ppmBase) < 0.05, `${meanPpm} vs ${b.ppmBase}`);
      assert.ok(Math.abs(b.utmWE / b.utmSN - 1) < 2e-6, 'directional EF difference stays ~1 ppm');
      assert.ok(Math.abs(b.dH) < 1e-6, 'vertical edge preserved');
    }
  }
});

test('rigid reference: zero displacement at the centre, θ ≈ γ0, ENU cloud undistorted', () => {
  const p = M.normalizeParams(small);
  const ctx = M.projectionContext(p);
  const o = M.transformPoint(ctx, ...ctx.O, {});
  assert.ok(Math.hypot(o.dx, o.dy, o.dz) < 1e-6 && Math.hypot(o.e, o.n, o.u) < 1e-6);
  assert.ok(Math.abs(ctx.theta - ctx.gamma0 * Math.PI / 180) < 1e-6, `${ctx.theta} vs ${ctx.gamma0}`);
  assert.equal(ctx.zone, 22); assert.equal(ctx.south, true);
  // displacement grows with distance (scale) and the vertical part is the dropped curvature
  const g = M.distortionGrid(p, ctx, 21);
  const corner = 0, middle = 10 * 21 + 10;
  assert.ok(g.fields.dh[corner] > 100 * g.fields.dh[middle]);
  const r = Math.hypot(p.spanWE, p.spanNS) / 2;
  assert.ok(Math.abs(g.fields.dz[corner] - r * r / (2 * 6.37e6)) < 0.004, String(g.fields.dz[corner]));
});

test('ppm at roofs is lower than at the ground (elevation factor uses each point h)', () => {
  const out = M.simulate(small, { gridSize: 11 });
  let roof = 0, ground = 0, nr = 0, ng = 0;
  for (let i = 0; i < out.ppm.length; i++) {
    if (out.cls[i] === 1) { roof += out.ppm[i]; nr++; } else if (out.cls[i] === 0) { ground += out.ppm[i]; ng++; }
  }
  assert.ok(roof / nr < ground / ng);
});

test('seeded generation is deterministic; seeds change the layout', () => {
  const a = M.generateCloud(small), b = M.generateCloud(small), c = M.generateCloud({ ...small, seed: 7 });
  assert.deepEqual(a.X, b.X); assert.deepEqual(a.buildings.map(x => x.size), b.buildings.map(x => x.size));
  assert.notDeepEqual(a.buildings.map(x => x.size), c.buildings.map(x => x.size));
  // density changes never change the building sizes
  const d = M.generateCloud({ ...small, buildingDensity: 2 });
  assert.deepEqual(a.buildings.map(x => x.size), d.buildings.map(x => x.size));
});

test('point budget: terrain is reduced first, then buildings; estimate matches the generator', () => {
  const p = M.normalizeParams({ spanWE: 20000, spanNS: 20000, terrainDensity: 1, buildingDensity: 0.1 });
  const b = M.applyBudget(p, 200000);
  assert.ok(b.reduced && b.counts.total <= 200000);
  assert.equal(b.buildingDensity, 0.1, 'buildings untouched while terrain can absorb the cut');
  const cloud = M.generateCloud(p, { maxPoints: 200000 });
  assert.ok(cloud.counts.total <= 200000 * 1.02, String(cloud.counts.total));
  const q = M.normalizeParams({ grid: 12, spanWE: 4000, spanNS: 4000, sizeMin: 250, sizeMax: 300, buildingDensity: 25 });
  const bq = M.applyBudget(q, 300000);
  assert.ok(bq.buildingDensity < 25 && bq.counts.buildings <= 0.8 * 300000 && bq.counts.total <= 300000);
  const exact = M.estimateCounts(M.normalizeParams(small));
  const real = M.generateCloud(small).counts;
  assert.equal(real.buildings, exact.buildings);
  assert.ok(Math.abs(real.terrain - exact.terrain) / exact.terrain < 0.05);
});

test('normalizeParams clamps to the limits', () => {
  const p = M.normalizeParams({ lat: 89, lon: 500, h0: 1e6, spanWE: 1, grid: 99, sizeMin: 80, sizeMax: 10, zone: 'x', seed: 'abc' });
  assert.equal(p.lat, 84); assert.equal(p.lon, 180); assert.equal(p.h0, 9000); assert.equal(p.spanWE, 100); assert.equal(p.grid, 12);
  assert.equal(p.sizeMin, 10); assert.equal(p.sizeMax, 80); assert.equal(p.zone, 'auto'); assert.equal(p.seed, 1);
});

test('building sizes are capped to 80 % of the cell', () => {
  const l = M.buildingLayout(M.normalizeParams({ spanWE: 300, spanNS: 300, grid: 6, sizeMin: 100, sizeMax: 200 }));
  for (const b of l.list) assert.ok(b.size <= 40 + 1e-9);
  assert.ok(l.capped);
});

test('performance guard: 200k points end-to-end well under 3 s', () => {
  const t0 = performance.now();
  const out = M.simulate({ spanWE: 2000, spanNS: 2000, terrainDensity: 0.04, buildingDensity: 0.3 }, { gridSize: 61 });
  const dt = performance.now() - t0;
  assert.ok(out.counts.total > 150000, String(out.counts.total));
  assert.ok(dt < 3000, `${dt.toFixed(0)} ms`);
});

test('toDms formats signed angles', () => {
  assert.equal(M.toDms(0.7386863381), '0° 44′ 19.27″');
  assert.equal(M.toDms(-1.5, 0), '−1° 30′ 00″');
});
