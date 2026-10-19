// The printed A4 reference grid (transform_lab/foundation/target_grid): 7 columns × 10 rows of
// vertices, 3 cm apart, named A0…Z0, A1…Z1, A2…R2 row by row from the lower-left corner.
// x right, y up, z out of the sheet (right-handed), centimetres, z = 0.
import { stream } from './rng.mjs';
import { independentRows, zeros } from './linalg.mjs';

export const GRID = { cols: 7, rows: 10, spacingCm: 3 };

export function pointName(idx) { return `${String.fromCharCode(65 + (idx % 26))}${Math.floor(idx / 26)}`; }

export function referencePoints() {
  const pts = [];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      const idx = r * GRID.cols + c;
      pts.push({ name: pointName(idx), col: c, row: r, x: c * GRID.spacingCm, y: r * GRID.spacingCm, z: 0 });
    }
  }
  return pts;
}

// ---------------------------------------------------------------- stochastic model Σ_S
// Printed-sheet model, all in the unit of the coordinates (convert σ before calling):
//   • random placement of each dot: σ_xy (in the sheet plane) and σ_z (out of plane);
//   • optional printer scale error, one random factor per axis (ppm of the coordinate), common
//     to all points: Cov(δx_i, δx_j) = x_i x_j σ_ppmX², likewise for y. It makes Σ_S dense.
export function referenceCovariance(pts, { sxy, sz = sxy, ppmX = 0, ppmY = 0 }) {
  const n = pts.length, S = zeros(3 * n, 3 * n);
  for (let i = 0; i < n; i++) {
    S[3 * i][3 * i] += sxy * sxy; S[3 * i + 1][3 * i + 1] += sxy * sxy; S[3 * i + 2][3 * i + 2] += sz * sz;
  }
  const px = ppmX * 1e-6, py = ppmY * 1e-6;
  if (px || py) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      S[3 * i][3 * j] += pts[i].x * pts[j].x * px * px;
      S[3 * i + 1][3 * j + 1] += pts[i].y * pts[j].y * py * py;
    }
  }
  return S;
}

// ---------------------------------------------------------------- pairs and distances
export const pairKind = (a, b, s0 = null) => {
  if (a.col === undefined || b.col === undefined) {                // custom reference: classify by distance
    if (!s0) return 'far';
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    return d <= 1.05 * s0 ? 'h' : d <= 1.5 * s0 ? 'd' : 'far';
  }
  const dc = Math.abs(a.col - b.col), dr = Math.abs(a.row - b.row);
  if (dc + dr === 1) return dc ? 'h' : 'v';
  if (dc === 1 && dr === 1) return 'd';
  return 'far';
};

// All n(n−1)/2 pairs with their nominal distance, ordered by distance (ties by index)
export function allPairs(pts) {
  const out = [];
  let s0 = Infinity;
  if (pts.some(p => p.col === undefined)) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) s0 = Math.min(s0, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z));
  }
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    out.push({ i, j, a: a.name, b: b.name, d: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), kind: pairKind(a, b, s0) });
  }
  return out.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
}

// Distance injunction sets (spec): all, neighbours with diagonals (8-connected), only horizontal
// and vertical neighbours (4-connected), or a random percentage of all pairs
export function selectPairs(pairs, set, { pct = 10, rng = null } = {}) {
  switch (set) {
    case 'all': return pairs.slice();
    case 'n8': return pairs.filter(p => p.kind !== 'far');
    case 'n4': return pairs.filter(p => p.kind === 'h' || p.kind === 'v');
    case 'random': {
      const k = Math.round(pairs.length * pct / 100);
      const r = rng || stream(1, 'injunctions');
      const keep = new Set(r.sample(pairs.map((_, i) => i), k));
      return pairs.filter((_, i) => keep.has(i));
    }
    default: return [];
  }
}

// σ_d of every pair from the covariance of the two points (full 3×3 blocks and cross-blocks)
export function distanceSigma(p, a, b, S) {
  const u = [p[a].x - p[b].x, p[a].y - p[b].y, p[a].z - p[b].z];
  const d = Math.hypot(...u);
  if (!(d > 0)) return 0;
  u[0] /= d; u[1] /= d; u[2] /= d;
  let v = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    v += u[r] * u[c] * (S[3 * a + r][3 * a + c] + S[3 * b + r][3 * b + c] - S[3 * a + r][3 * b + c] - S[3 * b + r][3 * a + c]);
  }
  return Math.sqrt(Math.max(v, 0));
}

export function distanceTable(pts, S) {
  return allPairs(pts).map(p => ({ ...p, sigma: distanceSigma(pts, p.i, p.j, S) }));
}

// Independent subset of a pair list for a set of points (gradients of the distances taken at
// the nominal planar configuration). Dependent distances carry no extra information: with the
// shape fixed, the rest follow. Returns { rows: kept pairs, kept: kept indices }.
export function independentPairs(pairs, pts, { relTol = 1e-8 } = {}) {
  const n = pts.length;
  const grads = pairs.map(p => {
    const g = new Array(3 * n).fill(0), a = pts[p.i], b = pts[p.j];
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d = Math.hypot(dx, dy, dz) || 1;
    g[3 * p.i] = dx / d; g[3 * p.i + 1] = dy / d; g[3 * p.i + 2] = dz / d;
    g[3 * p.j] = -dx / d; g[3 * p.j + 1] = -dy / d; g[3 * p.j + 2] = -dz / d;
    return g;
  });
  const kept = independentRows(grads, { relTol });
  return { kept, rows: kept.map(k => pairs[k]) };
}

export function distancesCsv(table, { unit = 'cm', labels = ['point_a', 'point_b', 'distance', 'sigma', 'type'], sigmaUnit = 'mm', sigmaFactor = 10, decimals = 4 } = {}) {
  const head = [labels[0], labels[1], `${labels[2]}_${unit}`, `${labels[3]}_${sigmaUnit}`, labels[4]];
  const lines = table.map(p => [p.a, p.b, p.d.toFixed(decimals), (p.sigma * sigmaFactor).toFixed(decimals), p.kind].join(','));
  return [head.join(','), ...lines].join('\r\n') + '\r\n';
}
