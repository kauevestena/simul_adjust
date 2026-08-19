// The colours of the valley.
//
// One place, because a palette only works if it is small and shared. Every
// material is a three-step `ramp()` — shadow, midtone, highlight — with the hue
// rotating as the value moves, and sprites are painted from those three steps
// and nothing else. Limiting the vocabulary is most of what makes a set of
// independently drawn sprites look like they belong in the same world.
//
// The tuning target is Stardew's spring: saturated grass, warm earth, strong
// value contrast. The Phase 1 palette was olive and grey and read as a survey
// diagram rather than a place worth walking around.

import { ramp } from './pixbuf.js';

/** Three steps unless noted: [shadow, mid, light]. */
export const P = {
  grass: ramp('#5fa03c', 3),
  grassDry: ramp('#8a9a3f', 3),
  grassDeep: ramp('#3f7a2c', 3),

  leaf: [ramp('#4f9c33', 3), ramp('#5fae3a', 3), ramp('#3f8a2e', 3), ramp('#6fb845', 3)],
  leafAutumn: ramp('#c98a2e', 3),
  trunk: ramp('#8a5f34', 3),
  branch: ramp('#6e4a28', 3),

  soil: ramp('#a8763e', 3),
  soilWet: ramp('#7a5730', 3),
  sand: ramp('#dcc98f', 3),

  rock: ramp('#96958d', 3),
  rockMoss: ramp('#6f8455', 3),

  water: ramp('#3f92c4', 3),
  waterDeep: ramp('#2c6f9e', 3),
  foam: ramp('#cfe9f5', 3),

  wood: ramp('#a8763e', 3),
  woodDark: ramp('#7a5227', 3),
  concrete: ramp('#cfc9ba', 3),
  metal: ramp('#adb6bd', 3),
  iron: ramp('#5d6a72', 3),

  // The surveyor. A hi-vis vest is what a field surveyor actually wears, and it
  // conveniently makes the player the most saturated thing on screen.
  //
  // Skin gets a much smaller hue rotation than everything else. The house
  // default swings orange toward red on the shadow step, which on a face reads
  // as a wound rather than as shading.
  skin: ramp('#e0a878', 3, { hueShift: 0.012, spread: 0.115, satBoost: 0.03 }),
  shirt: ramp('#4a7fb5', 3),
  vest: ramp('#f2a71b', 3),
  trousers: ramp('#40506b', 3),
  boots: ramp('#5a3f2a', 3),
  hat: ramp('#e8d9b0', 3),
  hatBand: ramp('#8a5a2b', 3),
  hair: ramp('#4a3324', 3),

  // Ligeirinho. A checked shirt and straw, against the player's hi-vis and
  // canvas: at 24 pixels tall the two have to be told apart by COLOUR before
  // anything else, because nobody is going to read a silhouette that size.
  plaid: ramp('#c4553d', 3),
  plaidDark: ramp('#7d3126', 3),
  straw: ramp('#e3c069', 3),
  denim: ramp('#5b6b86', 3),

  // The landowners. Sunday clothes rather than field kit — nobody who owns the
  // farm is dressed for holding a prism pole — and deliberately outside both
  // crew palettes: no hi-vis, no plaid, no denim.
  linen: ramp('#d9c7a2', 3),
  chita: ramp('#b06a86', 3),
  khaki: ramp('#8f8455', 3),
  camisa: ramp('#7fa8a0', 3),

  instrument: ramp('#3a4650', 3),
  instrumentTrim: ramp('#f2c14e', 3),
  lens: ramp('#7fd0f0', 3),
  prism: ramp('#3fb0e0', 3),

  roof: ramp('#b8503a', 3),
  roofZinc: ramp('#7d8f9c', 3),
  wall: ramp('#e8dcc0', 3),
  wallShade: ramp('#c4b494', 3),

  // No pure white: a two-pixel white dot on green does not read as a flower,
  // it reads as a dead pixel. Cream is as light as this palette goes.
  flower: [ramp('#e0607a', 3), ramp('#efc850', 3), ramp('#b47fd0', 3), ramp('#f0e0a8', 3)],

  shadow: '#1e2a18',
};

/**
 * Skin tones the player can choose between.
 *
 * Every one is built with the same reduced hue rotation `P.skin` uses, and for
 * the same reason: the house default swings orange toward red on the shadow
 * step, which on a face reads as a wound rather than as shading. The deeper
 * tones need it even more, because a big hue swing on a dark base goes purple.
 *
 * Ordered light to deep. The index is what gets saved, so the ORDER IS A SAVE
 * FORMAT — inserting a tone in the middle would repaint every existing
 * player's face. Append only.
 */
const skinRamp = (hex) => ramp(hex, 3, { hueShift: 0.012, spread: 0.115, satBoost: 0.03 });

export const SKIN_TONES = [
  { id: 'clara', base: '#f0c9a4', ramp: skinRamp('#f0c9a4'), hair: 2 },
  { id: 'morena-clara', base: '#e0a878', ramp: skinRamp('#e0a878'), hair: 0 },
  { id: 'morena', base: '#c08553', ramp: skinRamp('#c08553'), hair: 0 },
  { id: 'parda', base: '#9c6238', ramp: skinRamp('#9c6238'), hair: 1 },
  { id: 'negra', base: '#6b4026', ramp: skinRamp('#6b4026'), hair: 1 },
];

/**
 * Hair colours. `hair` on a skin tone is the one picked by default when that
 * tone is chosen, so the first thing a player sees is always a plausible
 * pairing — they can then set it to whatever they like.
 */
export const HAIR_TONES = [
  { id: 'castanho', ramp: ramp('#4a3324', 3) },
  { id: 'preto', ramp: ramp('#2b2320', 3) },
  { id: 'louro', ramp: ramp('#c9a25c', 3) },
  { id: 'ruivo', ramp: ramp('#9c4a24', 3) },
  { id: 'grisalho', ramp: ramp('#9a958e', 3) },
];

/**
 * Hats. Nobody surveys a pasture bare-headed, so there is no "none" — the sun
 * in this valley is not optional and the brim is half the silhouette.
 *
 * `brim` and `crown` are read by the painter in `sprites/character.js`;
 * `band` is the ribbon. Same append-only rule as the skin tones.
 */
export const HAT_STYLES = [
  { id: 'abaLarga', brim: 6.2, crown: 2.3, ramp: P.hat, band: P.hatBand },
  { id: 'palha', brim: 7.0, crown: 2.0, ramp: P.straw, band: P.woodDark },
  { id: 'bone', brim: 4.4, crown: 2.6, ramp: P.shirt, band: P.iron, cap: true },
  { id: 'sol', brim: 6.6, crown: 2.8, ramp: P.concrete, band: P.grassDeep },
];

/** What a fresh player looks like before they touch anything. */
export const DEFAULT_LOOK = { body: 'm', skin: 1, hair: 0, hat: 0 };

/**
 * Resolve a saved look into the actual colour ramps the painter needs.
 *
 * Every index is clamped rather than trusted: a look comes out of a save file,
 * and a save from a build with more tones than this one must degrade to a
 * plausible surveyor instead of painting `undefined` into the face.
 */
export function resolveLook(look = {}) {
  const pick = (arr, i, fallback) => arr[Math.min(arr.length - 1, Math.max(0, i ?? fallback))];
  const skin = pick(SKIN_TONES, look.skin, DEFAULT_LOOK.skin);
  const hair = pick(HAIR_TONES, look.hair ?? skin.hair, DEFAULT_LOOK.hair);
  const hat = pick(HAT_STYLES, look.hat, DEFAULT_LOOK.hat);
  return {
    body: look.body === 'f' ? 'f' : 'm',
    skin: skin.ramp,
    hair: hair.ramp,
    hat,
    shirt: P.shirt,
    vest: P.vest,
    trousers: P.trousers,
    boots: P.boots,
    /** The hi-vis vest is the player's; Ligeirinho wears a shirt and nothing else. */
    wearsVest: true,
    carriesPole: false,
  };
}

/**
 * Ligeirinho, fixed. Checked shirt, denim, straw hat, prism pole — and no
 * hi-vis, so the eye can tell in one frame which of the two is the player.
 *
 * The clothes are what distinguish him, not the face: the player may pick any
 * of the five tones, so a look that leaned on skin alone would collide with
 * whichever one they chose. Ruivo under straw is the caipira, and it also keeps
 * him off a fair player's default pairing, which is louro.
 */
export const LIGEIRINHO_LOOK = {
  body: 'm',
  skin: SKIN_TONES[0].ramp,
  hair: HAIR_TONES[3].ramp,
  hat: HAT_STYLES[1],
  shirt: P.plaid,
  vest: P.plaidDark,
  trousers: P.denim,
  boots: P.boots,
  wearsVest: false,
  carriesPole: true,
};

/**
 * The landowners, one look per parcel.
 *
 * Six of them, so a valley never has two neighbours wearing the same clothes,
 * and painted for BOTH bodies — which body an owner gets is decided by the name
 * they carry (`world/names.js`), and the name comes out of a shuffle, so the
 * atlas cannot know it. Twelve standing figures is 12 x 8 frames of 24x34, or
 * about 78k pixels: nothing, and it buys a valley where the neighbours listed
 * as confrontantes in the memorial are people you have walked past.
 *
 * None of them wears hi-vis or carries a pole. That is the whole visual grammar
 * of this game — the vest is the player, the plaid and the pole are Ligeirinho,
 * and everybody else is somebody who lives here.
 */
/**
 * `vest` is the CHECK on the shirt here, not a garment: the painter reads it as
 * a vest only when `wearsVest` is set, and draws two sparse crossing lines with
 * it otherwise. Setting it to the shirt's own ramp is therefore how somebody
 * gets a plain shirt — two of the six, or a row of neighbours all reads as one
 * family in matching flannel.
 */
export const OWNER_LOOKS = [
  { skin: 1, hair: 4, hat: 0, shirt: P.linen, vest: P.linen, trousers: P.khaki },
  { skin: 3, hair: 1, hat: 3, shirt: P.chita, vest: P.plaidDark, trousers: P.trousers },
  { skin: 4, hair: 1, hat: 2, shirt: P.camisa, vest: P.camisa, trousers: P.khaki },
  { skin: 2, hair: 0, hat: 0, shirt: P.khaki, vest: P.woodDark, trousers: P.trousers },
  { skin: 0, hair: 4, hat: 3, shirt: P.linen, vest: P.chita, trousers: P.denim },
  { skin: 2, hair: 3, hat: 1, shirt: P.camisa, vest: P.iron, trousers: P.khaki },
];

/**
 * Resolve one of the looks above into ramps the painter can use.
 *
 * @param {'m'|'f'} body
 * @param {number} variant  index into `OWNER_LOOKS`, wrapped
 */
export function ownerLook(body, variant = 0) {
  const o = OWNER_LOOKS[((variant % OWNER_LOOKS.length) + OWNER_LOOKS.length) % OWNER_LOOKS.length];
  const base = resolveLook({ body, skin: o.skin, hair: o.hair, hat: o.hat });
  return { ...base, shirt: o.shirt, vest: o.vest, trousers: o.trousers, wearsVest: false, carriesPole: false };
}

/**
 * Ground colours per soil class, keyed by the ids in `world/terrain.js`.
 *
 * Two separate vocabularies, and the distinction matters:
 *
 *   `grain`  sprinkled per pixel at low density and DELIBERATELY close in value
 *            to the base. Grain is meant to be felt, not seen. Using the full
 *            three-step ramp here — which the first attempt did — turns a
 *            pasture into television static.
 *   `patch`  larger, lower-frequency mottling that gives a big field some
 *            regional variation instead of one even tone to the horizon.
 */
const grainOf = (base, spread = 0.075) => {
  const r = ramp(base, 5, { spread, hueShift: 0.15, satBoost: 0.04 });
  return [r[0], r[4]]; // one step down, one step up — symmetric about the base
};

export const GROUND = {
  PASTO: { base: P.grass[1], grain: grainOf('#5fa03c'), patch: [P.grass[0], P.grassDeep[2]] },
  CAMPO_SUJO: { base: P.grassDry[1], grain: grainOf('#8a9a3f'), patch: [P.grassDry[0], P.grass[1]] },
  SOLO_EXPOSTO: { base: P.soil[1], grain: grainOf('#a8763e'), patch: [P.soil[0], P.soil[2]] },
  // Furrow tones come from `patch`, and they stay close to the field's own
  // colour on purpose: high-contrast furrows turn a crop field into corduroy
  // visible from orbit, which is what the first pass looked like.
  LAVOURA: { base: P.soil[1], grain: grainOf('#a8763e'), patch: [P.soilWet[2], P.soil[1]] },
  AREIA: { base: P.sand[1], grain: grainOf('#dcc98f'), patch: [P.sand[0], P.sand[2]] },
  ROCHA: { base: P.rock[1], grain: grainOf('#96958d'), patch: [P.rock[0], P.rockMoss[0]] },
  BREJO: { base: P.grassDeep[1], grain: grainOf('#3f7a2c'), patch: [P.grassDeep[0], P.waterDeep[0]] },
  // Water is a smooth surface, and grain that reads as pleasant texture on
  // grass reads as television static on it. Tighter tones, and half as often.
  AGUA: { base: P.water[1], grain: grainOf('#3f92c4', 0.028), grainRate: 0.5, patch: [P.waterDeep[1], P.water[2]] },
};

/**
 * Light through the working day, as a multiply tint plus an additive warmth.
 * The service clock drives this, which is what turns "elapsed time" from a
 * number in the corner into something the player can feel.
 */
export const DAYLIGHT = [
  { t: 0.0, tint: [0.72, 0.74, 0.92], warm: [0.10, 0.05, 0.0] }, // 07:00 cool dawn
  { t: 0.18, tint: [0.96, 0.94, 0.92], warm: [0.05, 0.03, 0.0] }, // 09:00
  { t: 0.42, tint: [1.0, 1.0, 1.0], warm: [0.0, 0.0, 0.0] }, // midday, neutral
  { t: 0.72, tint: [1.0, 0.94, 0.82], warm: [0.06, 0.02, 0.0] }, // 15:30 warm
  { t: 0.9, tint: [0.94, 0.78, 0.66], warm: [0.12, 0.04, 0.0] }, // golden hour
  { t: 1.0, tint: [0.66, 0.62, 0.80], warm: [0.06, 0.0, 0.04] }, // 18:00 dusk
];

/** Interpolate the daylight table. `t` is 0 at 07:00, 1 at 18:00. */
export function lightAt(t) {
  t = Math.max(0, Math.min(1, t));
  let a = DAYLIGHT[0];
  let b = DAYLIGHT[DAYLIGHT.length - 1];
  for (let i = 0; i + 1 < DAYLIGHT.length; i++) {
    if (t >= DAYLIGHT[i].t && t <= DAYLIGHT[i + 1].t) {
      a = DAYLIGHT[i];
      b = DAYLIGHT[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const k = (t - a.t) / span;
  const mix = (u, v) => u + (v - u) * k;
  return {
    tint: [mix(a.tint[0], b.tint[0]), mix(a.tint[1], b.tint[1]), mix(a.tint[2], b.tint[2])],
    warm: [mix(a.warm[0], b.warm[0]), mix(a.warm[1], b.warm[1]), mix(a.warm[2], b.warm[2])],
  };
}
