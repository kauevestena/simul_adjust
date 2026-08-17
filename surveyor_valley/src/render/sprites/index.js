// The roster: every sprite the game can draw, and how big it is.
//
// Sizes are NOT declared here. A sprite's world size is its pixel size divided
// by `PX_PER_M`, full stop — which removes an entire class of bug where the art
// and the collision radius quietly disagree about how wide a tree is.
//
// The archetypes are painted from a FIXED seed, deliberately. Per-world
// variation comes from which variant an entity picks and how it is scaled, not
// from the art changing under the player between sessions.

import { makeRng } from '../../core/rng.js';
import { tree, bush, rock, SIZES } from './nature.js';
import { surveyor } from './character.js';
import { playerMarco, boundaryMark, totalStation, prism, fencePost } from './survey.js';
import { grassTuft, tussock, flower, pebble, stone, reed, clod, crop } from './ground.js';

export const TREE_VARIANTS = 8;
export const BUSH_VARIANTS = 6;
export const ROCK_VARIANTS = 5;

const ART_SEED = 'surveyor-valley-art-v1';

/**
 * Paint every atlas sprite.
 * @returns {Array<{key:string, pix:object, anchorX:number, anchorY:number}>}
 */
export function buildSprites() {
  const out = [];
  const add = (key, made) => out.push({ key, ...made });

  // ---- vegetation and stone ----------------------------------------------
  // Three painted sizes each, because pixel art cannot be scaled at draw time.
  for (let s = 0; s < SIZES.length; s++) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      add(`tree-${v}-${s}`, tree(makeRng(ART_SEED, `tree:${v}`), v, s));
    }
    for (let v = 0; v < BUSH_VARIANTS; v++) {
      add(`bush-${v}-${s}`, bush(makeRng(ART_SEED, `bush:${v}`), v, s));
    }
    for (let v = 0; v < ROCK_VARIANTS; v++) {
      add(`rock-${v}-${s}`, rock(makeRng(ART_SEED, `rock:${v}`), v, s));
    }
  }

  // ---- the surveyor -------------------------------------------------------
  for (const dir of ['S', 'N', 'E']) {
    for (let frame = 0; frame < 4; frame++) {
      add(`char-${dir}-${frame}`, surveyor({ dir, frame }));
    }
    // The top of a breath. Walk frame 0 is the bottom of it, so standing still
    // alternates between the two and only this one has to be painted.
    add(`char-${dir}-idle`, surveyor({ dir, pose: 'idle' }));
  }
  // West is east mirrored: cheaper, and the two can never drift apart.
  for (let frame = 0; frame < 4; frame++) {
    const east = surveyor({ dir: 'E', frame });
    add(`char-W-${frame}`, { pix: east.pix.mirrorX(), anchorX: 0.5, anchorY: east.anchorY });
  }
  const eastIdle = surveyor({ dir: 'E', pose: 'idle' });
  add('char-W-idle', { pix: eastIdle.pix.mirrorX(), anchorX: 0.5, anchorY: eastIdle.anchorY });

  add('char-kneel', surveyor({ pose: 'kneel' }));
  add('char-kneel-idle', surveyor({ pose: 'kneel-idle' }));

  // ---- the kit ------------------------------------------------------------
  add('marco', playerMarco());
  for (let v = 0; v < 3; v++) add(`divisa-${v}`, boundaryMark(v));
  add('station', totalStation());
  add('prism', prism());
  add('poste', fencePost());

  // ---- swayable ground cover ---------------------------------------------
  // Baked tufts cost nothing but cannot move. These few are real sprites so the
  // grass around the player can bend when walked through.
  for (let v = 0; v < 4; v++) {
    add(`tuft-${v}`, grassTuft(makeRng(ART_SEED, `tuft:${v}`), { tall: v > 1 }));
  }

  return out;
}

/**
 * The small stuff that gets baked into terrain chunks. Returned as raw buffers
 * rather than atlas entries, because `groundbake` blits them directly and never
 * needs them on the GPU.
 */
export function buildGroundSprites() {
  const set = (name, n, make) => {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(make(makeRng(ART_SEED, `${name}:${i}`), i).pix);
    return arr;
  };

  return {
    tuft: set('gtuft', 8, (rng) => grassTuft(rng, { tall: false })),
    tuftTall: set('gtuftT', 6, (rng) => grassTuft(rng, { tall: true })),
    tuftDry: set('gtuftD', 6, (rng) => grassTuft(rng, { dry: true })),
    tussock: set('gtus', 5, (rng) => tussock(rng)),
    flower: set('gflw', 8, (rng, i) => flower(rng, i % 4)),
    pebble: set('gpeb', 6, (rng) => pebble(rng)),
    stone: set('gstn', 6, (rng) => stone(rng)),
    reed: set('greed', 5, (rng) => reed(rng)),
    clod: set('gclod', 5, (rng) => clod(rng)),
    crop: set('gcrop', 5, (rng) => crop(rng)),
  };
}

export { building } from './built.js';
