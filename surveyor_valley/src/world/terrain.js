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
export const SOIL = {
  PASTO: { id: 'PASTO', walkable: true, tripodOk: true, speedFactor: 1.0, color: '#5fa03c', detail: '#4f8a30' },
  CAMPO_SUJO: { id: 'CAMPO_SUJO', walkable: true, tripodOk: true, speedFactor: 0.85, color: '#8a9a3f', detail: '#78872f' },
  SOLO_EXPOSTO: { id: 'SOLO_EXPOSTO', walkable: true, tripodOk: true, speedFactor: 1.0, color: '#a8763e', detail: '#8f6230' },
  LAVOURA: { id: 'LAVOURA', walkable: true, tripodOk: true, speedFactor: 0.7, color: '#8a6234', detail: '#6f4f28' },
  AREIA: { id: 'AREIA', walkable: true, tripodOk: false, speedFactor: 0.75, color: '#dcc98f', detail: '#c9b478' },
  ROCHA: { id: 'ROCHA', walkable: true, tripodOk: false, speedFactor: 0.9, color: '#96958d', detail: '#7e7d75' },
  BREJO: { id: 'BREJO', walkable: true, tripodOk: false, speedFactor: 0.45, color: '#3f7a2c', detail: '#336322' },
  AGUA: { id: 'AGUA', walkable: false, tripodOk: false, speedFactor: 0, color: '#3f92c4', detail: '#2c6f9e' },
};

export const SOIL_IDS = Object.keys(SOIL);

/**
 * @param {string} seed
 * @param {{width:number, height:number}} bounds  world extent in metres
 */
export function makeTerrain(seed, bounds) {
  const moisture = makeNoise(seed, 'moisture');
  const firmness = makeNoise(seed, 'firmness');
  const grain = makeNoise(seed, 'grain');

  // A memo of 1 m cells. The function is still the truth; this only spares the
  // renderer from re-evaluating four octaves per pixel.
  const w = Math.ceil(bounds.width) + 2;
  const h = Math.ceil(bounds.height) + 2;
  const memo = new Uint8Array(w * h).fill(255);

  function classify(e, n) {
    // Feature sizes chosen against a 640 m valley: big enough to read as
    // landscape, small enough that a 4 ha parcel is not one flat colour.
    const wet = moisture.fbm(e, n, { scale: 95, octaves: 4 });
    const firm = firmness.fbm(e, n, { scale: 72, octaves: 4 });
    const fine = grain.fbm(e, n, { scale: 22, octaves: 3 });

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
    const ix = Math.floor(e - bounds.minE) + 1;
    const iy = Math.floor(n - bounds.minN) + 1;
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return classify(e, n);
    const idx = iy * w + ix;
    const cached = memo[idx];
    if (cached !== 255) return SOIL[SOIL_IDS[cached]];
    const soil = classify(e, n);
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
