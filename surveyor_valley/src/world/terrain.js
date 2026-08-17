// Soil as a continuous field.
//
// `soilAt(e, n)` is a pure function of two seeded noise fields. Nothing is
// stored as geometry, which means the tripod test can sample at any radius it
// likes — 0.55 m and 1.00 m rings included — without grid artefacts, and the
// player never sees a suspiciously square patch of marsh.

import { makeNoise } from '../core/noise.js';

// `color` is the flat fill used by the plan view and by chunk placeholders. The
// painted texture lives in `render/palette.js`; these are the same hues, kept
// here so nothing in `world/` has to import anything from `render/`.
/**
 * Ground, and how fast you can cross it.
 *
 * The slow factors used to bottom out at 0.45 — a 1.35 m/s crawl, slower than a
 * real person walks — and marsh forms a continuous ring around every lake, so
 * any route that went near water spent its whole shoreline segment at that
 * pace. The floor is 0.8 now: the ground still reads underfoot, but nothing in
 * the valley is slower than walking.
 */
export const SOIL = {
  PASTO: { id: 'PASTO', walkable: true, tripodOk: true, speedFactor: 1.0, color: '#5fa03c', detail: '#4f8a30' },
  CAMPO_SUJO: { id: 'CAMPO_SUJO', walkable: true, tripodOk: true, speedFactor: 0.92, color: '#8a9a3f', detail: '#78872f' },
  SOLO_EXPOSTO: { id: 'SOLO_EXPOSTO', walkable: true, tripodOk: true, speedFactor: 1.0, color: '#a8763e', detail: '#8f6230' },
  LAVOURA: { id: 'LAVOURA', walkable: true, tripodOk: true, speedFactor: 0.85, color: '#8a6234', detail: '#6f4f28' },
  AREIA: { id: 'AREIA', walkable: true, tripodOk: false, speedFactor: 0.85, color: '#dcc98f', detail: '#c9b478' },
  ROCHA: { id: 'ROCHA', walkable: true, tripodOk: false, speedFactor: 0.9, color: '#96958d', detail: '#7e7d75' },
  BREJO: { id: 'BREJO', walkable: true, tripodOk: false, speedFactor: 0.8, color: '#3f7a2c', detail: '#336322' },
  AGUA: { id: 'AGUA', walkable: false, tripodOk: false, speedFactor: 0, color: '#3f92c4', detail: '#2c6f9e' },
};

export const SOIL_IDS = Object.keys(SOIL);

/**
 * @param {string} seed
 * @param {{width:number, height:number}} bounds  world extent in metres
 */
/**
 * Soil samples per metre.
 *
 * This is the size of the step in every class boundary in the game, and at the
 * default zoom of 32 px/m a 1 m cell was a 32-screen-pixel staircase — the
 * "straight-lined boundaries between soils" that no amount of dithering could
 * disguise, because the dither only ragged a band around a line that was still
 * a line. At 4 samples/m the step is 25 cm, or 8 screen pixels, which the
 * existing half-metre jitter genuinely does dissolve.
 *
 * The rung is a compromise measured rather than guessed: `classify` costs
 * ~350 ns (eleven fBm octaves over three fields), so per-metre precompute of a
 * whole valley is ~50 ms, 4/m is ~0.8 s spread lazily across chunk bakes, and
 * per-art-pixel (16/m) would be 35 MB of memo and 13 s — out of the question.
 */
export const CELLS_PER_M = 4;

export function makeTerrain(seed, bounds) {
  const moisture = makeNoise(seed, 'moisture');
  const firmness = makeNoise(seed, 'firmness');
  const grain = makeNoise(seed, 'grain');

  // The function is still the truth; this only spares the renderer from
  // re-evaluating four octaves per pixel.
  const cell = 1 / CELLS_PER_M;
  const w = Math.ceil(bounds.width * CELLS_PER_M) + 2;
  const h = Math.ceil(bounds.height * CELLS_PER_M) + 2;
  const memo = new Uint8Array(w * h).fill(255);

  function classify(e, n) {
    // Feature sizes are set against the PARCEL, not the valley: big enough to
    // read as landscape, small enough that one property is never a single flat
    // colour — because which ground a tripod can stand on is a decision the
    // player makes inside one parcel. They came down with the parcels, in
    // proportion, when a holding went from about 2.5 ha to about 0.8.
    const wet = moisture.fbm(e, n, { scale: 31, octaves: 4 });
    const firm = firmness.fbm(e, n, { scale: 23, octaves: 4 });
    const fine = grain.fbm(e, n, { scale: 8, octaves: 3 });

    // Thresholds tuned so this reads as a working pasture valley: grazing land
    // dominates, and the ground a tripod cannot stand on — marsh, rock, loose
    // sand, water — stays occasional. Around a third of the valley being
    // unusable made planting a monument a chore rather than a decision.
    if (wet > 0.56) return SOIL.AGUA;
    if (wet > 0.42) return SOIL.BREJO;
    if (firm > 0.54) return SOIL.ROCHA;
    if (wet < -0.46 && firm < -0.18) return SOIL.AREIA;
    if (firm < -0.40) return SOIL.SOLO_EXPOSTO;
    if (fine > 0.30) return SOIL.LAVOURA;
    if (fine < -0.28) return SOIL.CAMPO_SUJO;
    return SOIL.PASTO;
  }

  function soilAt(e, n) {
    const cx = Math.floor((e - bounds.minE) * CELLS_PER_M);
    const cy = Math.floor((n - bounds.minN) * CELLS_PER_M);
    const ix = cx + 1;
    const iy = cy + 1;
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return classify(e, n);
    const idx = iy * w + ix;
    const cached = memo[idx];
    if (cached !== 255) return SOIL[SOIL_IDS[cached]];
    // The CELL CENTRE, not the point that happened to ask. Caching the caller's
    // own position within the cell made that cell mean whatever the first query
    // into it meant — and scatter, the closable-ring pass and spawn siting all
    // probe at arbitrary points long before any chunk bakes. The map therefore
    // depended on call order, which quietly breaks the determinism
    // `world.hash()` promises: same seed, different valley.
    const soil = classify(bounds.minE + (cx + 0.5) * cell, bounds.minN + (cy + 0.5) * cell);
    memo[idx] = SOIL_IDS.indexOf(soil.id);
    return soil;
  }

  return {
    soilAt,
    /** Uncached, for tests and for sub-metre sampling. */
    classify,
    isWalkable: (e, n) => soilAt(e, n).walkable,
    isTripodOk: (e, n) => soilAt(e, n).tripodOk,
    speedAt: (e, n) => soilAt(e, n).speedFactor,
    bounds,
  };
}
