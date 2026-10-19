// Length units of the lab (metres per unit)
export const UNITS = { mm: 1e-3, cm: 1e-2, m: 1 };
export const UNIT_KEYS = Object.keys(UNITS);

// Multiply a length in `from` by this factor to express it in `to`
export const unitFactor = (from, to) => UNITS[from] / UNITS[to];
