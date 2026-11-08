// Throughput benchmark (not part of CI): node distorcao_utm/tests/bench.mjs
// Benchmark de desempenho (fora da CI). Used to choose MAX_POINTS in model.mjs.
import * as M from '../model.mjs';

const targets = [100_000, 500_000, 1_000_000, 2_000_000, 3_000_000];
console.log('points    | generate ms | transform ms | extras ms | total ms | ns/point | heap MB');
for (const target of targets) {
  // 2 km × 2 km, default buildings (~0.63 M points at 1 pt/m²); terrain fills up the rest
  const base = { spanWE: 2000, spanNS: 2000, buildingDensity: Math.min(1, target / 1.2e6) };
  const b = M.estimateCounts(M.normalizeParams(base)).buildings;
  const terrainDensity = Math.max(0.0001, (target - b) / (4e6 * 0.97));
  M.simulate({ ...base, terrainDensity }, { maxPoints: 1e8, gridSize: 31 }); // warm-up
  const out = M.simulate({ ...base, terrainDensity }, { maxPoints: 1e8 });
  const t = out.timing, n = out.counts.total;
  const heap = process.memoryUsage().heapUsed / 1e6;
  console.log(`${String(n).padStart(9)} | ${t.generate.toFixed(0).padStart(11)} | ${t.transform.toFixed(0).padStart(12)} | ${t.extras.toFixed(0).padStart(9)} | ${t.total.toFixed(0).padStart(8)} | ${(1e6 * t.total / n).toFixed(0).padStart(8)} | ${heap.toFixed(0).padStart(7)}`);
}
