// EGM2008 geoid (5' grid, GeographicLib packaging) split in 10°×10° tiles, fetched on demand.
// Pure helpers (decode, mosaic, bicubic sampling) work in the page, the worker and node:test.
// Tile format: see scripts/build_geoid_tiles.py and data/egm2008-5/index.json.

export const GEOID_BASE = new URL('./data/egm2008-5/', import.meta.url).href;
export const TILE = Object.freeze({ perDegree: 12, tileDegrees: 10, cells: 120, nodes: 123, marginBefore: 1, rows: 18, cols: 36, offset: -108, scale: 0.003 });
const GLOBAL_ROWS = 180 * TILE.perDegree + 1;   // 2161 node rows, 90N .. 90S
const GLOBAL_COLS = 360 * TILE.perDegree;       // 4320 node columns (wrap), from 180W

export const tileName = (row, col) => `r${String(row).padStart(2, '0')}c${String(col).padStart(2, '0')}.bin`;

/** Undo the planar predictor: int16 residuals -> uint16 node values (row-major, nodes × nodes). */
export function decodeResiduals(res, nodes = TILE.nodes) {
  const v = new Uint16Array(nodes * nodes);
  for (let i = 0; i < nodes; i++) {
    for (let j = 0; j < nodes; j++) {
      const k = i * nodes + j;
      let x;
      if (i === 0 && j === 0) x = res[0] + 32768;
      else if (i === 0) x = v[k - 1] + res[k];
      else if (j === 0) x = v[k - nodes] + res[k];
      else x = res[k] + v[k - 1] + v[k - nodes] - v[k - nodes - 1];
      v[k] = x;
    }
  }
  return v;
}

/** bytes (gzip or already inflated by the server) -> Uint16Array of node values. */
export async function decodeTile(bytes) {
  let raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (raw[0] === 0x1f && raw[1] === 0x8b) {
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
    raw = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const res = new Int16Array(raw.length / 2);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let i = 0; i < res.length; i++) res[i] = dv.getInt16(2 * i, true);
  return decodeResiduals(res);
}

/** Global node (row from 90N, col from 180W) -> tile and in-tile index. Rows clamp at the poles. */
function locate(row, col) {
  const r = Math.min(GLOBAL_ROWS - 1, Math.max(0, row));
  const c = ((col % GLOBAL_COLS) + GLOBAL_COLS) % GLOBAL_COLS;
  const tr = Math.min(TILE.rows - 1, Math.floor(r / TILE.cells)), tc = Math.floor(c / TILE.cells);
  return { tr, tc, i: r - tr * TILE.cells + TILE.marginBefore, j: c - tc * TILE.cells + TILE.marginBefore };
}

/** Node window (global indices) covering a lat/lon box plus the bicubic margin. */
export function patchWindow({ latMin, latMax, lonMin, lonMax }) {
  const P = TILE.perDegree;
  const row0 = Math.floor((90 - latMax) * P) - 1, row1 = Math.ceil((90 - latMin) * P) + 2;
  const col0 = Math.floor((lonMin + 180) * P) - 1, col1 = Math.ceil((lonMax + 180) * P) + 2;
  return { row0, row1, col0, col1 };
}

/** Tiles needed for a box (names). */
export function tilesFor(box) {
  const w = patchWindow(box), names = new Set();
  for (let r = w.row0; r <= w.row1; r++) for (let c = w.col0; c <= w.col1; c++) {
    const l = locate(r, c);
    names.add(tileName(l.tr, l.tc));
  }
  return [...names].sort();
}

/**
 * Build a patch { latNorth, lonWest, step, rows, cols, data: Float32Array(N metres) } for a box.
 * getTile(name) must resolve to the decoded Uint16Array of that tile.
 */
export async function buildPatch(box, getTile) {
  const w = patchWindow(box), rows = w.row1 - w.row0 + 1, cols = w.col1 - w.col0 + 1;
  const tiles = new Map();
  await Promise.all(tilesFor(box).map(async name => tiles.set(name, await getTile(name))));
  const data = new Float32Array(rows * cols);
  for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
    const l = locate(w.row0 + a, w.col0 + b);
    const v = tiles.get(tileName(l.tr, l.tc))[l.i * TILE.nodes + l.j];
    data[a * cols + b] = TILE.offset + TILE.scale * v;
  }
  return {
    latNorth: 90 - w.row0 / TILE.perDegree, lonWest: -180 + w.col0 / TILE.perDegree,
    step: 1 / TILE.perDegree, rows, cols, data, tiles: [...tiles.keys()],
  };
}

// Keys (1981) cubic convolution, a = −0.5 (Catmull–Rom): interpolating, C¹.
function keys(t) {
  const t2 = t * t, t3 = t2 * t;
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
}
/** Bicubic geoid undulation N (m) at lat/lon (degrees) from a patch. NaN outside it. */
export function sampleGeoid(patch, lat, lon) {
  const inv = 1 / patch.step;
  let dl = lon - patch.lonWest;
  dl -= 360 * Math.floor(dl / 360);
  const x = dl * inv, y = (patch.latNorth - lat) * inv;
  const j = Math.floor(x), i = Math.floor(y);
  if (i < 1 || j < 1 || i + 2 >= patch.rows || j + 2 >= patch.cols) return NaN;
  const wy = keys(y - i), wx = keys(x - j), d = patch.data, C = patch.cols;
  let s = 0;
  for (let a = 0; a < 4; a++) {
    const row = (i - 1 + a) * C + j - 1;
    s += wy[a] * (wx[0] * d[row] + wx[1] * d[row + 1] + wx[2] * d[row + 2] + wx[3] * d[row + 3]);
  }
  return s;
}

/** Browser/worker loader with an in-memory tile cache. fetchImpl is injectable for tests. */
export function createGeoidLoader({ base = GEOID_BASE, fetchImpl = (...a) => fetch(...a) } = {}) {
  const cache = new Map();
  const requested = [];
  const getTile = name => {
    if (!cache.has(name)) {
      requested.push(name);
      cache.set(name, fetchImpl(new URL(name, base).href)
        .then(r => { if (!r.ok) throw Error(`geoid tile ${name}: HTTP ${r.status}`); return r.arrayBuffer(); })
        .then(decodeTile)
        .catch(err => { cache.delete(name); throw err; }));
    }
    return cache.get(name);
  };
  return { getTile, requested, patch: box => buildPatch(box, getTile) };
}
