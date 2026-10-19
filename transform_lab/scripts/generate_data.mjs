// Regenerates the committed sample data of the lab:
//   data/reference_grid.csv       the 70 vertices of the printed A4 grid (cm)
//   data/reference_distances.csv  all 2415 pair distances with σ_d for a 0.1 mm placement σ
//   data/sample_ts_raw.csv        the default simulated total-station observations (seed 7)
// Usage: node transform_lab/scripts/generate_data.mjs   (tests check the files are up to date)
import { writeFileSync, mkdirSync } from 'node:fs';
import { referencePoints, referenceCovariance, distanceTable, distancesCsv } from '../core/reference.mjs';
import { simulateDataset } from '../core/simulate.mjs';
import { referenceCsv, observationsCsv } from '../core/io.mjs';

export function buildData() {
  const pts = referencePoints();
  const S = referenceCovariance(pts, { sxy: 0.01, sz: 0.01 });          // 0.1 mm expressed in cm
  return {
    'reference_grid.csv': referenceCsv(pts, 'cm'),
    'reference_distances.csv': distancesCsv(distanceTable(pts, S)),
    'sample_ts_raw.csv': observationsCsv(simulateDataset({ seed: 7 }))
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = new URL('../data/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(buildData())) writeFileSync(new URL(name, dir), text);
  console.log('data files written');
}
