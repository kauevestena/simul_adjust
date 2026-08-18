// The Pixi scene.
//
// Replaces the Phase 1 immediate-mode renderer. Three things changed, and each
// one was a measured problem:
//
//   * Visible entities come from `world.spatial`, the uniform hash grid that
//     already existed and that the old renderer never touched. It scanned all
//     ~2000 entities every frame, allocated a fresh array and sorted it.
//   * Sprites are POOLED. A container child is reused frame to frame and simply
//     re-pointed at a different texture, so a walk across the valley allocates
//     nothing.
//   * Ground chunks are textures, not per-frame pixel work.
//
// The world container is laid out in BASE PIXELS (16 per metre) and scaled by an
// integer. Everything inside therefore lands on exact pixel boundaries, which is
// the whole reason the art stays crisp.

import { PX_PER_M } from './pixbuf.js';
import { DETAIL_ZOOM } from './camera.js';
import { KIND } from '../world/entities.js';
import { SIZES } from './sprites/nature.js';
import { pixi } from './pixi.js';

/** Which painted size bucket an entity's continuous scale belongs in. */
function sizeBucket(scale = 1) {
  let best = 0;
  for (let i = 1; i < SIZES.length; i++) {
    if (Math.abs(SIZES[i] - scale) < Math.abs(SIZES[best] - scale)) best = i;
  }
  return best;
}

const spriteKeyFor = (ent) => {
  switch (ent.kind) {
    case KIND.ARVORE:
      return `tree-${ent.variant % 8}-${sizeBucket(ent.scale)}`;
    case KIND.ARBUSTO:
      return `bush-${ent.variant % 6}-${sizeBucket(ent.scale)}`;
    case KIND.ROCHA:
      return `rock-${ent.variant % 5}-${sizeBucket(ent.scale)}`;
    case KIND.POSTE:
      return 'poste';
    case KIND.MARCO_DIVISA:
      return `divisa-${ent.variant % 3}`;
    case KIND.MARCO_JOGADOR:
      return 'marco';
    case KIND.BENFEITORIA:
      return `building-${ent.id}`;
    default:
      return null;
  }
};

export function makeScene({ app, camera, atlas, ground }) {
  const PIXI = pixi();

  // ---- containers ---------------------------------------------------------
  const world = new PIXI.Container();
  const groundLayer = new PIXI.Container();
  const overlayLines = new PIXI.Graphics(); // parcel boundaries and fences
  const sorted = new PIXI.Container();
  const effects = new PIXI.Container();

  sorted.sortableChildren = true;
  world.addChild(groundLayer, overlayLines, sorted, effects);
  app.stage.addChild(world);

  // Screen-space light pass: a full-viewport tint plus a vignette.
  const light = new PIXI.Container();
  const tint = new PIXI.Sprite(PIXI.Texture.WHITE);
  tint.blendMode = 'multiply';
  tint.alpha = 0;
  const vignette = new PIXI.Sprite(makeVignette(PIXI));
  // Enough to frame the scene and draw the eye to the middle; any more and the
  // corners of a 40-hectare valley go to mud.
  vignette.alpha = 0.16;
  light.addChild(tint, vignette);
  app.stage.addChild(light);

  // ---- pools --------------------------------------------------------------
  /** chunk key -> Sprite */
  const chunkSprites = new Map();
  /** Reusable entity sprites; index into `sorted.children`. */
  const entityPool = [];
  let entityUsed = 0;

  function takeEntitySprite() {
    let s = entityPool[entityUsed];
    if (!s) {
      s = new PIXI.Sprite();
      s.anchor.set(0, 0);
      entityPool.push(s);
      sorted.addChild(s);
    }
    entityUsed++;
    s.visible = true;
    return s;
  }

  // ---- ground -------------------------------------------------------------
  function drawGround(w) {
    const cm = ground.chunkMetres;
    const view = camera.viewRect(cm);
    const minCx = Math.floor(view.minE / cm);
    const maxCx = Math.floor(view.maxE / cm);
    const minCy = Math.floor(view.minN / cm);
    const maxCy = Math.floor(view.maxN / cm);

    const live = new Set();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const originE = cx * cm;
        const originN = cy * cm;
        if (
          originE + cm < w.bounds.minE || originE > w.bounds.maxE ||
          originN + cm < w.bounds.minN || originN > w.bounds.maxN
        ) continue;

        const key = `${cx},${cy}`;
        live.add(key);
        let sp = chunkSprites.get(key);
        if (!sp) {
          sp = new PIXI.Sprite();
          // Base pixels; N up in the world means the chunk's TOP edge is its
          // highest northing.
          sp.x = originE * PX_PER_M;
          sp.y = -(originN + cm) * PX_PER_M;
          groundLayer.addChild(sp);
          chunkSprites.set(key, sp);
        }

        const tex = ground.get(cx, cy);
        if (tex) {
          if (sp.texture !== tex) {
            sp.texture = tex;
            sp.tint = 0xffffff;
            sp.width = cm * PX_PER_M;
            sp.height = cm * PX_PER_M;
          }
        } else if (sp.texture !== PIXI.Texture.WHITE) {
          // Still baking: a plausible flat green beats a hole in the world.
          sp.texture = PIXI.Texture.WHITE;
          sp.tint = parseInt(ground.placeholder(cx, cy).slice(1), 16);
          sp.width = cm * PX_PER_M;
          sp.height = cm * PX_PER_M;
        }
      }
    }

    // Retire chunks that have scrolled away, so the display list stays small.
    for (const [key, sp] of chunkSprites) {
      if (live.has(key)) continue;
      sp.destroy();
      chunkSprites.delete(key);
    }
  }

  // ---- parcel boundaries and fences ---------------------------------------
  function drawLines(w, activeParcelId) {
    overlayLines.clear();

    for (const parcel of w.parcels) {
      const active = parcel.id === activeParcelId;
      const pts = parcel.vertices;
      if (pts.length < 3) continue;

      overlayLines.moveTo(pts[0].e * PX_PER_M, -pts[0].n * PX_PER_M);
      for (let i = 1; i < pts.length; i++) {
        overlayLines.lineTo(pts[i].e * PX_PER_M, -pts[i].n * PX_PER_M);
      }
      overlayLines.closePath();

      if (active) overlayLines.fill({ color: 0xf2c14e, alpha: 0.08 });
      overlayLines.stroke({
        width: active ? 3 : 1.5,
        color: active ? 0xd9622b : 0x3f3324,
        alpha: active ? 0.95 : 0.3,
      });
    }

    // Fences: two rails with a shadow under them. A single hairline reads as a
    // scratch on the grass rather than as something you cannot walk through —
    // and a fence the player cannot see is a fence they will walk into.
    for (const ent of w.entities) {
      if (ent.kind !== KIND.CERCA || !ent.seg) continue;
      const trace = (dy) => {
        overlayLines.moveTo(ent.seg[0][0] * PX_PER_M, -ent.seg[0][1] * PX_PER_M + dy);
        for (let i = 1; i < ent.seg.length; i++) {
          overlayLines.lineTo(ent.seg[i][0] * PX_PER_M, -ent.seg[i][1] * PX_PER_M + dy);
        }
      };
      trace(3);
      overlayLines.stroke({ width: 2, color: 0x1e2a18, alpha: 0.25 });
      trace(-6);
      overlayLines.stroke({ width: 2, color: 0xa8763e, alpha: 1 });
      trace(-11);
      overlayLines.stroke({ width: 2, color: 0xc08d4f, alpha: 1 });
    }
  }

  // ---- everything that stands up ------------------------------------------
  const visible = [];

  /** Close enough to the tripod to be the one crouched over it. */
  const AT_INSTRUMENT = 2.0;

  /**
   * Which frame of the surveyor to draw.
   *
   * The kneel used to be chosen by "is a station set up at all", and a setup
   * survives for the rest of the job — so from the first tripod onwards the
   * surveyor slid around the entire valley permanently crouched, legs frozen
   * mid-fold. Kneeling is a thing you do AT the instrument, so it is now
   * decided by where the player actually is.
   *
   * Standing still resolves to the idle breath rather than to walk frame 0,
   * which is what stopped the sprite looking like a photograph.
   */
  function characterKey(p, station) {
    const atInstrument =
      station &&
      !p.moving &&
      Math.hypot((station.trueE ?? station.E) - p.e, (station.trueN ?? station.N) - p.n) <= AT_INSTRUMENT;

    if (atInstrument) return p.idleFrame ? 'char-kneel-idle' : 'char-kneel';
    if (p.moving) return `char-${p.facing}-${p.frame % 4}`;
    return p.idleFrame ? `char-${p.facing}-idle` : `char-${p.facing}-0`;
  }

  /**
   * Which frame of Ligeirinho to draw.
   *
   * The same rule as the player's minus the kneel, which is hers alone: the
   * tribrach is at her end of the sight and he is at the other, holding the
   * pole. He carries it in every frame, so there is no separate planted pose to
   * paint — standing still with the prism up IS the idle.
   */
  function assistantKey(a) {
    if (a.moving) return `aux-${a.facing}-${a.frame % 4}`;
    return a.idleFrame ? `aux-${a.facing}-idle` : `aux-${a.facing}-0`;
  }

  function drawEntities(w, playerState, station, assistantState) {
    const detail = camera.zoom >= DETAIL_ZOOM;
    const view = camera.viewRect(12);
    visible.length = 0;

    // The spatial index turns "what is on screen" from a scan of the whole
    // valley into a walk over a handful of 16 m cells.
    for (const ent of w.spatial.queryRect(view.minE, view.minN, view.maxE, view.maxN)) {
      if (ent.kind === KIND.CERCA) continue; // drawn as lines
      if (!detail && (ent.kind === KIND.ARBUSTO || ent.kind === KIND.ROCHA)) continue;
      // Not yet found: buried in the scrub, and drawn only once the crew has
      // turned it up. `game/discovery.js` clears the flag on the same radius
      // this used to test for itself, so the two cannot disagree any more.
      if (ent.hidden) continue;
      visible.push(ent);
    }

    entityUsed = 0;

    for (const ent of visible) {
      const key = spriteKeyFor(ent);
      const frame = key && atlas.get(key);
      if (!frame) continue;
      place(takeEntitySprite(), frame, ent.e, ent.n);
    }

    // The instrument, when one is set up, and the surveyor.
    if (station) {
      const f = atlas.get('station');
      if (f) place(takeEntitySprite(), f, station.trueE ?? station.E, station.trueN ?? station.N);
    }

    const cf = atlas.get(characterKey(playerState, station)) || atlas.get('char-S-0');
    if (cf) place(takeEntitySprite(), cf, playerState.e, playerState.n);

    if (assistantState) {
      const af = atlas.get(assistantKey(assistantState)) || atlas.get('aux-S-0');
      if (af) place(takeEntitySprite(), af, assistantState.e, assistantState.n);
    }

    // Park the leftovers rather than destroying them; next frame may want them.
    for (let i = entityUsed; i < entityPool.length; i++) entityPool[i].visible = false;
  }

  /**
   * Position one sprite. Rounded to whole BASE pixels: the container scale is an
   * integer, so a rounded base pixel is an exact screen pixel and the sprite
   * never lands between two of them.
   */
  function place(sprite, frame, e, n) {
    sprite.texture = frame.texture;
    sprite.x = Math.round(e * PX_PER_M - frame.w * frame.ax);
    sprite.y = Math.round(-n * PX_PER_M - frame.h * frame.ay);
    // Far things are drawn first, so a tree to the south overlaps one to the
    // north. That single rule is what gives a top-down scene any depth at all.
    sprite.zIndex = -n;
  }

  // ---- frame --------------------------------------------------------------
  function render(view) {
    const { world: w, player, assistant, activeParcelId, station, light: lightState } = view;

    if (!w) {
      world.visible = false;
      return;
    }

    // Plan mode draws on the overlay canvas instead; hiding the world container
    // is both correct and free.
    if (camera.planMode) {
      world.visible = false;
      light.visible = false;
      return;
    }

    world.visible = true;
    light.visible = true;

    const k = camera.scale;
    const off = camera.containerOffset();
    world.scale.set(k);
    world.x = off.x;
    world.y = off.y;

    drawGround(w);
    drawLines(w, activeParcelId);
    drawEntities(w, player, station, assistant);

    // Light pass, in screen space.
    tint.width = camera.vw;
    tint.height = camera.vh;
    vignette.width = camera.vw;
    vignette.height = camera.vh;
    if (lightState) {
      const [r, g, b] = lightState.tint;
      tint.tint = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      tint.alpha = 1;
    } else {
      tint.alpha = 0;
    }
  }

  return {
    render,
    world,
    light,
    /**
     * Where `effects.js` hangs its sprites. Inside the sorted container, so a
     * butterfly or a swaying tuft is depth-sorted with the trees rather than
     * floating over everything.
     */
    effectsLayer: sorted,
    /** Chunk textures are the big allocation; a new world must drop them. */
    reset() {
      for (const sp of chunkSprites.values()) sp.destroy();
      chunkSprites.clear();
      overlayLines.clear();
    },
    get stats() {
      return { entities: visible.length, chunks: chunkSprites.size, pool: entityPool.length };
    },

    /**
     * Which frame of the surveyor is being drawn, for tests and probes.
     *
     * Exposed rather than re-derived by the caller: the rule about when the
     * player kneels was wrong for a whole release, and a copy of it in a test
     * would have been wrong in exactly the same way.
     */
    characterKey,
    assistantKey,
  };
}

/** A soft radial darkening at the edges. Cheap, and it frames the scene. */
function makeVignette(PIXI) {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, 'rgba(20,26,16,0)');
  g.addColorStop(1, 'rgba(20,26,16,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: canvas }) });
}
