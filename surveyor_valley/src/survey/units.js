// Angular units, DMS formatting and parsing, locale-aware numbers.
//
// The formatter is the fussy part: seconds must be rounded FIRST and then
// carried into minutes and degrees, or you get the classic `0°59'60"` bug.
// All the decomposition below is done in integer ticks to make that exact.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const toRad = (deg) => deg * DEG;
export const toDeg = (rad) => rad * RAD;

/** Arc-seconds to degrees, and back. */
export const secToDeg = (sec) => sec / 3600;
export const degToSec = (deg) => deg * 3600;

/** Wrap into [0, 360). */
export function normalize360(deg) {
  const v = deg % 360;
  return v < 0 ? v + 360 : v;
}

/** Wrap into (-180, 180]. Use for differences, never for azimuths. */
export function normalize180(deg) {
  let v = normalize360(deg);
  if (v > 180) v -= 360;
  return v;
}

/** Signed smallest difference a - b, in (-180, 180]. */
export const angleDiff = (a, b) => normalize180(a - b);

/**
 * Format decimal degrees as DMS.
 * @param {number} deg
 * @param {{decimals?:number, pad?:boolean, wrap?:boolean}} opts
 *        `decimals` on the seconds; `pad` zero-pads degrees to 3 digits;
 *        `wrap` normalizes into [0, 360) first (default true).
 * @returns {string} e.g. `87°12'45"`
 */
export function formatDMS(deg, opts = {}) {
  const { decimals = 0, pad = false, wrap = true } = opts;
  const value = wrap ? normalize360(deg) : deg;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  // Integer arithmetic in units of 10^-decimals arc-seconds: rounding here
  // carries automatically, so 0.9999999° becomes 1°00'00" and never 0°59'60".
  const scale = 10 ** decimals;
  let ticks = Math.round(abs * 3600 * scale);
  if (wrap) {
    const full = 360 * 3600 * scale;
    ticks = ((ticks % full) + full) % full;
  }

  const perDeg = 3600 * scale;
  const perMin = 60 * scale;
  const d = Math.floor(ticks / perDeg);
  const rem = ticks - d * perDeg;
  const m = Math.floor(rem / perMin);
  const s = (rem - m * perMin) / scale;

  const dStr = pad ? String(d).padStart(3, '0') : String(d);
  const mStr = String(m).padStart(2, '0');
  const sStr = decimals > 0
    ? s.toFixed(decimals).padStart(3 + decimals, '0')
    : String(s).padStart(2, '0');

  return `${sign}${dStr}°${mStr}'${sStr}"`;
}

/**
 * Parse an angle written in any of the forms students actually type:
 * `87°12'45"`, `87 12 45`, `87-12-45.5`, `87:12:45`, `87.2125`, `87,2125`.
 * @returns {number|null} decimal degrees, or null if unparseable
 */
export function parseDMS(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  if (typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const negative = /^-/.test(trimmed);
  // Comma as a decimal separator is the Brazilian norm.
  const nums = trimmed.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;

  const [d = 0, m = 0, s = 0] = nums.slice(0, 3).map(Number);
  if (![d, m, s].every(Number.isFinite)) return null;
  if (nums.length > 1 && (m >= 60 || s >= 60)) return null;

  const value = d + m / 60 + s / 3600;
  return negative ? -value : value;
}

/** Gons (grads), offered as an alternative angular unit. 400 gon = 360°. */
export const degToGon = (deg) => (deg * 10) / 9;
export const gonToDeg = (gon) => (gon * 9) / 10;

/**
 * Gons, formatted. Decimal by nature — that is the entire point of the unit,
 * and the reason European practice prefers it: a right angle is 100.0000 gon
 * and arithmetic on it needs no sexagesimal carrying at all.
 */
export function formatGon(deg, { decimals = 4, wrap = true } = {}) {
  const g = degToGon(wrap ? normalize360(deg) : deg);
  return `${g.toFixed(decimals)} gon`;
}

/**
 * One angle, in whichever unit the player has chosen.
 *
 * Every angle the game shows goes through here, so the toggle is genuinely
 * global rather than "most places". `formatDMS` and `formatGon` stay exported
 * for the places that must be one or the other regardless — the memorial
 * descritivo is a Brazilian legal-style document and is always in DMS.
 *
 * @param {number} deg
 * @param {'dms'|'gon'} format
 */
export function formatAngle(deg, format = 'dms', opts = {}) {
  return format === 'gon' ? formatGon(deg, opts) : formatDMS(deg, opts);
}

export const LOCALE = {
  pt: { intl: 'pt-BR', decimal: ',' },
  en: { intl: 'en-US', decimal: '.' },
};

/** Format a number with locale separators, e.g. pt `1.234,56` / en `1,234.56`. */
export function fmtNum(value, lang = 'pt', decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE[lang]?.intl || 'pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** A distance in metres, always three decimals: surveyors read millimetres. */
export const fmtMetres = (v, lang = 'pt') => `${fmtNum(v, lang, 3)} m`;

/** Elapsed milliseconds as `h:mm:ss` (or `m:ss` under an hour). */
export function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
