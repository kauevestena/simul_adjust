import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildImported, parseTsRaw, parseJob, parseXyz, tsFromRaw, tsFromXyz, renumberByOrder, builtinReference, observationsCsv, referenceCsv, resultsCsv } from '../core/io.mjs';
import { simulateDataset } from '../core/simulate.mjs';
import { run } from '../core/pipeline.mjs';
import { buildData } from '../scripts/generate_data.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('committed data files are up to date with the generator', () => {
  for (const [name, text] of Object.entries(buildData())) {
    assert.equal(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'), text, name);
  }
});

test('raw CSV: delimiters, decimal comma, header, DDD.MMSS and per-row sigmas', () => {
  const a = parseTsRaw('name;hz;v;s\nA0;40,5;88,25;7,9821\nB0;41;88;8.0;1.5;1.5;0.003');
  assert.equal(a.rows.length, 2); close(a.rows[0].hzDeg, 40.5, 0); close(a.rows[0].dist, 7.9821, 0);
  assert.equal(a.rows[1].sigmaHzSec, 1.5);
  const d = parseTsRaw('17,163.0330,88.3000,7.5', { angleFormat: 'dmmss' });
  close(d.rows[0].hzDeg, 163 + 3 / 60 + 30 / 3600, 1e-12); assert.equal(d.rows[0].name, '17');
  assert.equal(parseTsRaw('A0,1,2').errors.length, 1);
  assert.equal(parseTsRaw('A0,1,2,-3').errors[0].reason, 'distance');
});

test('job file and coordinate files', () => {
  const j = parseJob('SS      5,0.000,\nSD      270.5603,117.5148,3.448\n');
  assert.equal(j.rows[0].name, '5'); close(j.rows[0].hzDeg, 270 + 56 / 60 + 3 / 3600, 1e-12);
  const x = parseXyz('P;1,5;2;0\nQ;3;4;5;0.001;0.001;0.002');
  assert.equal(x.rows.length, 2); close(x.rows[0].xyz[0], 1.5, 0); assert.deepEqual(x.rows[1].sigma, [0.001, 0.001, 0.002]);
  const ts = tsFromXyz(x.rows); assert.equal(ts[1].cov[2][2], 0.002 ** 2);
});

test('numeric names map to the grid order', () => {
  const ref = builtinReference('cm');
  const ts = renumberByOrder([{ name: '1' }, { name: '71' }, { name: 'A0' }, { name: '27' }], ref);
  assert.deepEqual(ts.map(t => t.name), ['A0', '71', 'A0', 'A1']);
});

test('observations CSV round-trips into the same coordinates and covariances', () => {
  const ds = simulateDataset({ seed: 4 });
  const back = tsFromRaw(parseTsRaw(observationsCsv(ds)).rows, { tsUnit: 'm' });
  assert.equal(back.length, ds.ts.length);
  back.forEach((t, i) => {
    t.xyz.forEach((v, k) => close(v, ds.ts[i].xyz[k], 8e-6));
    t.cov.forEach((r, a) => r.forEach((v, b) => close(v, ds.ts[i].cov[a][b], 1e-9 + 1e-3 * Math.abs(ds.ts[i].cov[a][a]))));
  });
});

test('importing the exported observations gives the same adjustment', () => {
  const ds = simulateDataset({ seed: 4 });
  const imported = { ...ds, ts: tsFromRaw(parseTsRaw(observationsCsv(ds)).rows, { tsUnit: 'm' }) };
  const a = run(ds, {}), b = run(imported, {});
  close(a.res.lambda, b.res.lambda, 1e-9);
});

test('results CSV has one line per point', () => {
  const r = run(simulateDataset({ seed: 4 }), {});
  const csv = resultsCsv(r, ['name', 'role', 'x', 'y', 'z', 'sx', 'sy', 'sz', 'dx', 'dy', 'dz', 'stat']);
  assert.equal(csv.trim().split('\r\n').length, r.points.length + 1);
  assert.ok(referenceCsv(builtinReference('mm'), 'mm').includes('B0,30,0,0'));
});

test('buildImported re-parses the same text for another unit and format', async () => {
  const { buildImported } = await import('../core/io.mjs');
  const fs = await import('node:fs');
  const text = fs.readFileSync(new URL('../data/sample_ts_raw.csv', import.meta.url), 'utf8');
  const m = buildImported(text, { tsUnit: 'm', name: 'sample' }), mm = buildImported(text, { tsUnit: 'mm', name: 'sample' });
  assert.equal(m.dataset.ts.length, 66);
  assert.equal(m.dataset.truth, null);
  assert.equal(m.dataset.meta.source, 'import');
  assert.ok(Math.abs(mm.dataset.ts[0].xyz[0] / m.dataset.ts[0].xyz[0] - 1000) < 1e-9);
  assert.ok(Math.abs(mm.dataset.ts[0].cov[0][0] / m.dataset.ts[0].cov[0][0] - 1e6) < 1e-3);
});

test('the documented columns (Point ID; Azimuth; Zenith Angle; Slope Distance) parse with a header, ; and decimal commas', () => {
  const { rows, errors } = parseTsRaw('Point ID;Azimuth;Zenith Angle;Slope Distance\nA0;12,5;88,25;7,9825\n7;300;90;8,1\n', {});
  assert.equal(errors.length, 0); assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].name, rows[0].hzDeg, rows[0].zenDeg, rows[0].dist], ['A0', 12.5, 88.25, 7.9825]);
  // numeric IDs stay unmatched unless the grid-order option is on
  const off = buildImported('A0;12;88;8\n7;300;90;8\n', { renumber: false }), on = buildImported('A0;12;88;8\n7;300;90;8\n', { renumber: true });
  assert.equal(off.dataset.ts[1].name, '7'); assert.equal(on.dataset.ts[1].name, 'G0');
});

test('data/ATV-AJ.csv is the serpentine conversion of the original job file', async () => {
  const { convertJob } = await import('../scripts/convert_job.mjs');
  const csv = readFileSync(new URL('../data/ATV-AJ.csv', import.meta.url), 'utf8');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(convertJob(readFileSync(new URL('../foundation/inputs/ATV-AJ.txt', import.meta.url), 'utf8')), csv); } finally { console.warn = warn; }
  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines[0], 'Point ID,Azimuth,Zenith Angle,Slope Distance');
  const names = lines.slice(1).map(l => l.split(',')[0]);
  assert.equal(new Set(names).size, 70);
  assert.deepEqual(names.slice(0, 8), ['A0', 'B0', 'C0', 'D0', 'E0', 'F0', 'G0', 'N0']);   // second line starts at the right end
  const { dataset } = buildImported(csv, {});
  assert.equal(run(dataset, { checkPct: 0 }).counts.tsOnly, 0);
});

test('data/ATV-AJ_56.csv is the first 8 scan lines (56 points) of the same conversion', async () => {
  const { convertJob } = await import('../scripts/convert_job.mjs');
  const job = readFileSync(new URL('../foundation/inputs/ATV-AJ.txt', import.meta.url), 'utf8');
  const csv = readFileSync(new URL('../data/ATV-AJ_56.csv', import.meta.url), 'utf8');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(convertJob(job, { rows: 8 }), csv); } finally { console.warn = warn; }
  assert.equal(csv.trim().split(/\r?\n/).length, 57);
});
