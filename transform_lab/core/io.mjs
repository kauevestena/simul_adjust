// Import and export of the lab's data. CSV files may use "," or ";" (with decimal comma) and
// a header line; names are kept as text ("17" stays "17").
import { parseDmmss, parseJobFile, polarToLocal, polarSigmas, localCovariance, DEG, ARCSEC } from '../../shared/total_station.mjs';
import { unitFactor } from './units.mjs';
import { referencePoints } from './reference.mjs';

function splitLine(line, delim) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === delim && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function detectDelimiter(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  if (first.includes('\t')) return '\t';
  if (first.includes(';')) return ';';
  return ',';
}

const num = (s, delim) => Number(String(s).replace(delim === ',' ? /$^/ : ',', '.'));

export function parseTable(text) {
  const delim = detectDelimiter(text);
  const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => splitLine(l, delim));
  return { delim, rows };
}

// Point ID ; Azimuth (arbitrary circle origin) ; Zenith Angle ; Slope Distance [; σAz″ ; σZ″ ; σS(m)]
// angles in decimal degrees or packed DDD.MMSS; the first non-numeric row is taken as a header
export function parseTsRaw(text, { angleFormat = 'deg' } = {}) {
  const { delim, rows } = parseTable(text);
  const out = [], errors = [];
  rows.forEach((r, i) => {
    if (r.length < 4) { errors.push({ line: i + 1, reason: 'columns' }); return; }
    const ang = s => (angleFormat === 'dmmss' ? parseDmmss(s) : num(s, delim));
    const hz = ang(r[1]), zen = ang(r[2]), dist = num(r[3], delim);
    if (![hz, zen, dist].every(Number.isFinite)) { if (i > 0) errors.push({ line: i + 1, reason: 'number' }); return; }
    if (!(dist > 0)) { errors.push({ line: i + 1, reason: 'distance' }); return; }
    const extra = r.slice(4, 7).map(s => (s === '' || s === undefined ? null : num(s, delim)));
    out.push({ name: r[0], hzDeg: hz, zenDeg: zen, dist, sigmaHzSec: extra[0], sigmaZenSec: extra[1], sigmaDistM: extra[2] });
  });
  return { rows: out, errors };
}

export function parseJob(text) {
  const { records, errors } = parseJobFile(text);
  return { rows: records.map(r => ({ name: r.id, hzDeg: r.hzDeg, zenDeg: r.zenDeg, dist: r.dist })), errors };
}

// name ; x ; y ; z [; σx ; σy ; σz]  (σ in the same unit as the coordinates)
export function parseXyz(text) {
  const { delim, rows } = parseTable(text);
  const out = [], errors = [];
  rows.forEach((r, i) => {
    if (r.length < 4) { errors.push({ line: i + 1, reason: 'columns' }); return; }
    const v = [1, 2, 3].map(k => num(r[k], delim));
    if (!v.every(Number.isFinite)) { if (i > 0) errors.push({ line: i + 1, reason: 'number' }); return; }
    const sg = r.slice(4, 7).map(s => (s === '' || s === undefined ? null : num(s, delim)));
    out.push({ name: r[0], xyz: v, sigma: sg.every(x => x !== null && Number.isFinite(x)) ? sg : null });
  });
  return { rows: out, errors };
}

// Raw observations → total-station points in `tsUnit` with Σ from the instrument settings
export function tsFromRaw(rows, { tsUnit = 'm', instrument = { angleSec: 2, mm: 2, ppm: 2, pointingMm: 0 } } = {}) {
  const f = unitFactor('m', tsUnit);
  return rows.map(r => {
    const hz = r.hzDeg * DEG, zen = r.zenDeg * DEG;
    const nominal = polarSigmas(r.dist, zen, instrument);
    const sig = [
      r.sigmaHzSec != null ? r.sigmaHzSec * ARCSEC : nominal[0],
      r.sigmaZenSec != null ? r.sigmaZenSec * ARCSEC : nominal[1],
      r.sigmaDistM != null ? r.sigmaDistM : nominal[2]
    ];
    return {
      name: r.name, xyz: polarToLocal(hz, zen, r.dist).map(v => v * f),
      cov: localCovariance(hz, zen, r.dist, sig).map(row => row.map(v => v * f * f)),
      polar: { hzDeg: r.hzDeg, zenDeg: r.zenDeg, dist: r.dist, sigmas: sig }
    };
  });
}

export function tsFromXyz(rows, { defaultSigma = 0.002 } = {}) {
  return rows.map(r => {
    const s = r.sigma ?? [defaultSigma, defaultSigma, defaultSigma];
    return { name: r.name, xyz: r.xyz, cov: [[s[0] ** 2, 0, 0], [0, s[1] ** 2, 0], [0, 0, s[2] ** 2]] };
  });
}

// Numeric names ("1", "2", …) in the order of the reference list → the names of the reference
export function renumberByOrder(ts, ref) {
  const names = new Set(ref.map(p => p.name));
  return ts.map(t => {
    if (names.has(t.name) || !/^\d+$/.test(t.name)) return t;
    const k = Number(t.name) - 1;
    return k >= 0 && k < ref.length ? { ...t, name: ref[k].name, originalName: t.name } : t;
  });
}

// Pure import pipeline shared by the page and the tests: raw text + options → dataset (re-run on any option change)
export function buildImported(text, { format = 'raw', angleFormat = 'deg', renumber = true, refUnit = 'cm', tsUnit = 'm', instrument, name = '' } = {}) {
  const ref = builtinReference(refUnit);
  let rows, errors, ts;
  if (format === 'xyz') { ({ rows, errors } = parseXyz(text)); ts = tsFromXyz(rows); }
  else {
    ({ rows, errors } = format === 'job' ? parseJob(text) : parseTsRaw(text, { angleFormat }));
    ts = tsFromRaw(rows, { tsUnit, instrument });
  }
  if (renumber) ts = renumberByOrder(ts, ref);
  return { dataset: { version: 1, refUnit, tsUnit, ref, ts, truth: null, meta: { source: 'import', file: name } }, errors };
}

export function referenceFromCsv(text, unit) {
  const { rows, errors } = parseXyz(text);
  return { unit, errors, ref: rows.map(r => ({ name: r.name, x: r.xyz[0], y: r.xyz[1], z: r.xyz[2] })) };
}

export function builtinReference(unit = 'cm') {
  const f = unitFactor('cm', unit);
  return referencePoints().map(p => ({ name: p.name, col: p.col, row: p.row, x: p.x * f, y: p.y * f, z: 0 }));
}

// ---------------------------------------------------------------- exports
const q = v => (/[",;\r\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const toCsv = (header, lines) => [header.map(q).join(','), ...lines.map(l => l.map(q).join(','))].join('\r\n') + '\r\n';

// The simulated (or imported) raw observations in the same format the importer reads
export function observationsCsv(dataset) {
  const lines = dataset.ts.filter(t => t.polar).map(t => [t.name, t.polar.hzDeg.toFixed(7), t.polar.zenDeg.toFixed(7), t.polar.dist.toFixed(5),
    (t.polar.sigmas[0] / ARCSEC).toFixed(5), (t.polar.sigmas[1] / ARCSEC).toFixed(5), t.polar.sigmas[2].toFixed(7)]);
  return toCsv(['point_id', 'azimuth_deg', 'zenith_deg', 'slope_distance_m', 'sigma_hz_arcsec', 'sigma_zenith_arcsec', 'sigma_dist_m'], lines);
}

export function referenceCsv(ref, unit) {
  return toCsv(['name', `x_${unit}`, `y_${unit}`, `z_${unit}`], ref.map(p => [p.name, p.x, p.y, p.z]));
}

// Per-point results of a run, in the output unit
export function resultsCsv(result, header) {
  const f = result.outFactor, fmt = (v, d = 5) => (Number.isFinite(v) ? v.toFixed(d) : '');
  const lines = result.points.map(p => {
    const t = p.tsAdj || p.tsPred || p.tsObs || [NaN, NaN, NaN];
    const sd = p.sigma || [NaN, NaN, NaN];
    return [p.name, p.role, ...t.map(v => fmt(v * f)), ...sd.map(v => fmt(v * f)),
      ...(p.vT ? p.vT.map(v => fmt(v * f)) : p.d ? p.d.map(v => fmt(v * f)) : ['', '', '']),
      p.chi2 !== undefined ? fmt(p.chi2, 3) : (p.T !== undefined ? fmt(p.T, 3) : '')];
  });
  return toCsv(header, lines);
}
