// Converts a total-station job file (SS/SD records, angles DDD.MMSS) of the printed grid into the lab's import CSV:
//   Point ID, Azimuth, Zenith Angle, Slope Distance   (decimal degrees, metres)
// Repeated job IDs (re-shots) keep the later reading.
// The grid was scanned line by line from the bottom row: the first line left→right, the next right→left (serpentine).
// Usage: node transform_lab/scripts/convert_job.mjs <job.txt> <out.csv> [--cols 7] [--rows 10] [--no-serpentine]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseJobFile } from '../../shared/total_station.mjs';
import { pointName, GRID } from '../core/reference.mjs';
import { toCsv } from '../core/io.mjs';

export function convertJob(text, { cols = GRID.cols, serpentine = true, rows = GRID.rows } = {}) {
  let { records, errors } = parseJobFile(text);
  if (errors.length) throw new Error(`job file: ${errors.length} unreadable record(s)`);
  // a repeated job ID is a re-shot of the same point: the later reading replaces the earlier one
  const last = new Map(records.map((r, i) => [r.id, i]));
  const kept = records.filter((r, i) => last.get(r.id) === i);
  const dropped = records.length - kept.length;
  records = kept;
  if (records.length !== cols * GRID.rows) throw new Error(`expected ${cols * GRID.rows} points, found ${records.length}`);
  const lines = records.map((r, k) => {
    const row = Math.floor(k / cols), p = k % cols, col = serpentine && row % 2 === 1 ? cols - 1 - p : p;
    return [pointName(row * cols + col), r.hzDeg.toFixed(7), r.zenDeg.toFixed(7), r.dist.toFixed(4)];
  });
  if (dropped) console.warn(`${dropped} repeated job ID(s): kept the later reading`);
  return toCsv(['Point ID', 'Azimuth', 'Zenith Angle', 'Slope Distance'], lines.slice(0, rows * cols));   // --rows N keeps only the first N scan lines
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output, ...flags] = process.argv.slice(2);
  if (!input || !output) { console.error('usage: convert_job.mjs <job.txt> <out.csv> [--cols N] [--rows N] [--no-serpentine]'); process.exit(1); }
  const cols = flags.includes('--cols') ? Number(flags[flags.indexOf('--cols') + 1]) : GRID.cols;
  const rows = flags.includes('--rows') ? Number(flags[flags.indexOf('--rows') + 1]) : GRID.rows;
  writeFileSync(output, convertJob(readFileSync(input, 'utf8'), { cols, rows, serpentine: !flags.includes('--no-serpentine') }));
  console.log(`written ${output}`);
}
