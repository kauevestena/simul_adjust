// Things that move.
//
// Baked ground is dense and detailed and completely dead. This layer puts a
// small number of moving sprites on top of it — grass that sways and bends away
// as you walk through, dust off your boots when you run, a butterfly or two,
// and a ring that expands out of a target the instant an observation lands.
//
// The budget is deliberately tiny: around eighty sprites, all pooled, all from
// the one atlas texture. The density in this game comes from the baked chunks;
// this is only about motion, and motion is cheap when there is little of it.

import { PX_PER_M } from './pixbuf.js';
import { makePix, P } from './sprites/shared.js';
import { hash2 } from './pixbuf.js';

const SWAY_RADIUS = 11; // metres of grass that reacts
const SWAY_STEP = 1.5; // spacing of the animated tufts
const MAX_PARTICLES = 90;
const MAX_BUTTERFLIES = 3;

export function makeEffects({ PIXI, atlas, container, camera }) {
  let t = 0;

  // ---- extra textures, painted here because nothing else wants them -------
  const dustTex = texFrom(PIXI, () => {
    const p = makePix(5, 5);
    p.ellipse(2.5, 2.5, 2.4, 2.0, '#cbbfa4');
    p.ellipse(1.8, 1.8, 1.2, 1.0, '#e6dcc8');
    return p;
  });

  const sparkTex = texFrom(PIXI, () => {
    const p = makePix(3, 3);
    p.px(1, 1, '#ffffff');
    p.px(0, 1, '#f2c14e');
    p.px(2, 1, '#f2c14e');
    p.px(1, 0, '#f2c14e');
    p.px(1, 2, '#f2c14e');
    return p;
  });

  const butterflyTex = [0, 1].map((frame) =>
    texFrom(PIXI, () => {
      const p = makePix(7, 5);
      const spread = frame === 0 ? 3 : 2;
      p.ellipse(3.5 - spread * 0.5, 2, spread * 0.5 + 0.6, 1.6, P.flower[1][2]);
      p.ellipse(3.5 + spread * 0.5, 2, spread * 0.5 + 0.6, 1.6, P.flower[1][1]);
      p.px(3, 2, '#3a2a18');
      p.px(3, 3, '#3a2a18');
      return p;
    }),
  );

  // ---- swaying grass ------------------------------------------------------
  // Every sprite goes straight into the shared sorted container rather than
  // into a sub-container of its own. A Container has a single zIndex, so
  // grouping them would sort all the grass as one layer and a butterfly would
  // pass in front of a tree it is standing behind.
  const swayPool = [];

  function updateSway(player, dt) {
    const half = Math.ceil(SWAY_RADIUS / SWAY_STEP);
    const baseE = Math.round(player.e / SWAY_STEP) * SWAY_STEP;
    const baseN = Math.round(player.n / SWAY_STEP) * SWAY_STEP;

    let used = 0;
    for (let i = -half; i <= half; i++) {
      for (let j = -half; j <= half; j++) {
        const e = baseE + i * SWAY_STEP;
        const n = baseN + j * SWAY_STEP;
        const d = Math.hypot(e - player.e, n - player.n);
        if (d > SWAY_RADIUS) continue;

        const gx = Math.round(e / SWAY_STEP);
        const gy = Math.round(n / SWAY_STEP);
        const h = hash2(gx, gy, 211);
        if (h > 0.42) continue; // most cells stay empty; this is accent, not cover

        const sprite = swayPool[used] || makeSway();
        used++;
        sprite.visible = true;

        const jitterE = (hash2(gx, gy, 213) - 0.5) * SWAY_STEP * 0.8;
        const jitterN = (hash2(gx, gy, 217) - 0.5) * SWAY_STEP * 0.8;
        sprite.x = Math.round((e + jitterE) * PX_PER_M);
        sprite.y = Math.round(-(n + jitterN) * PX_PER_M);
        sprite.zIndex = -(n + jitterN);

        // Idle sway, plus a shove away from the player when they walk through.
        // The shove is the bit that sells it: the world reacts to you.
        const idle = Math.sin(t * 1.7 + h * 24) * 0.055;
        const push = d < 1.6 ? (1 - d / 1.6) * 0.55 * Math.sign(e - player.e || 1) : 0;
        sprite.rotation = idle + push;
        // Fade out at the rim so tufts do not pop in as the player walks.
        sprite.alpha = Math.min(1, (SWAY_RADIUS - d) / 2.5);
      }
    }
    for (let i = used; i < swayPool.length; i++) swayPool[i].visible = false;
    void dt;
  }

  function makeSway() {
    const frame = atlas.get(`tuft-${swayPool.length % 4}`);
    const s = new PIXI.Sprite(frame ? frame.texture : PIXI.Texture.EMPTY);
    // Anchored at the base, so rotation bends the blades rather than spinning
    // the tuft about its middle.
    s.anchor.set(0.5, 1);
    container.addChild(s);
    swayPool.push(s);
    return s;
  }

  // ---- particles ----------------------------------------------------------
  /** @type {Array<{sprite:object, e:number,n:number, ve:number,vn:number, life:number, ttl:number, spin:number, grow:number}>} */
  const particles = [];

  function spawn(texture, e, n, opts) {
    if (particles.length >= MAX_PARTICLES) {
      const dead = particles.findIndex((p) => p.life / p.ttl > 0.75);
      if (dead < 0) return null;
      retire(particles[dead]);
      particles.splice(dead, 1);
    }
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    container.addChild(sprite);
    const p = { sprite, e, n, ve: 0, vn: 0, life: 0, ttl: 0.7, spin: 0, grow: 0, drag: 2.6, ...opts };
    sprite.zIndex = -n;
    particles.push(p);
    return p;
  }

  const retire = (p) => p.sprite.destroy();

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        retire(p);
        particles.splice(i, 1);
        continue;
      }
      const k = p.life / p.ttl;
      p.e += p.ve * dt;
      p.n += p.vn * dt;
      p.ve -= p.ve * p.drag * dt;
      p.vn -= p.vn * p.drag * dt;

      p.sprite.x = Math.round(p.e * PX_PER_M);
      p.sprite.y = Math.round(-p.n * PX_PER_M);
      p.sprite.alpha = 1 - k * k;
      p.sprite.rotation += p.spin * dt;
      const s = 1 + p.grow * k;
      p.sprite.scale.set(s);
    }
  }

  // ---- butterflies --------------------------------------------------------
  const flies = [];

  function updateButterflies(player, dt) {
    while (flies.length < MAX_BUTTERFLIES) {
      const s = new PIXI.Sprite(butterflyTex[0]);
      s.anchor.set(0.5, 0.5);
      container.addChild(s);
      flies.push({
        sprite: s,
        e: player.e + (Math.random() - 0.5) * 16,
        n: player.n + (Math.random() - 0.5) * 16,
        phase: Math.random() * 100,
        speed: 0.7 + Math.random() * 0.6,
      });
    }

    for (const f of flies) {
      // A wandering path from two out-of-phase sines: never straight, never
      // circling, and free of any state to keep.
      f.e += Math.cos(t * f.speed + f.phase) * 1.4 * dt;
      f.n += Math.sin(t * f.speed * 1.37 + f.phase * 1.7) * 1.4 * dt;

      // Keep them loosely around the player rather than letting them drift off.
      const d = Math.hypot(f.e - player.e, f.n - player.n);
      if (d > 14) {
        f.e += (player.e - f.e) * 0.6 * dt;
        f.n += (player.n - f.n) * 0.6 * dt;
      }

      f.sprite.texture = butterflyTex[Math.floor(t * 9 + f.phase) % 2];
      f.sprite.x = Math.round(f.e * PX_PER_M);
      // Bobbing height above the ground.
      f.sprite.y = Math.round(-f.n * PX_PER_M - 18 - Math.sin(t * 3 + f.phase) * 4);
      f.sprite.zIndex = -f.n + 0.01;
      f.sprite.alpha = Math.min(1, Math.max(0, (16 - d) / 4));
    }
  }

  // ---- public emitters ----------------------------------------------------
  let dustCooldown = 0;

  return {
    /** @param {{player:object, running:boolean}} view */
    update(dt, { player, running = false } = {}) {
      t += dt;
      if (!player) return;

      updateSway(player, dt);
      updateButterflies(player, dt);

      // Dust off the boots, but only when actually running.
      dustCooldown -= dt;
      if (running && player.moving && dustCooldown <= 0) {
        dustCooldown = 0.11;
        spawn(dustTex, player.e + (Math.random() - 0.5) * 0.4, player.n - 0.15, {
          ve: (Math.random() - 0.5) * 0.8,
          vn: -0.5 - Math.random() * 0.4,
          ttl: 0.5,
          grow: 0.9,
          spin: (Math.random() - 0.5) * 3,
        });
      }

      updateParticles(dt);
      void camera;
    },

    /** A monument going into the ground: a puff of dirt at the base. */
    thunk(e, n) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random();
        spawn(dustTex, e, n, {
          ve: Math.cos(a) * (1.1 + Math.random()),
          vn: Math.sin(a) * (0.5 + Math.random() * 0.5),
          ttl: 0.55,
          grow: 1.2,
          spin: (Math.random() - 0.5) * 5,
        });
      }
    },

    /** An observation landing: a bright ring of sparks out of the target. */
    ping(e, n) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        spawn(sparkTex, e, n, {
          ve: Math.cos(a) * 3.2,
          vn: Math.sin(a) * 3.2,
          ttl: 0.5,
          drag: 5.5,
          grow: -0.4,
        });
      }
    },

    /** A refusal: a small dark scatter, so a rejected click is never silent. */
    reject(e, n) {
      for (let i = 0; i < 5; i++) {
        spawn(dustTex, e, n, {
          ve: (Math.random() - 0.5) * 1.4,
          vn: 0.6 + Math.random() * 0.5,
          ttl: 0.32,
          grow: 0.4,
        });
      }
    },

    reset() {
      for (const p of particles) retire(p);
      particles.length = 0;
    },

    get stats() {
      return { sway: swayPool.length, particles: particles.length, flies: flies.length };
    },
  };
}

/** Turn a freshly painted buffer into a nearest-filtered texture. */
function texFrom(PIXI, paint) {
  const pix = paint();
  const canvas = document.createElement('canvas');
  canvas.width = pix.w;
  canvas.height = pix.h;
  canvas.getContext('2d').putImageData(new ImageData(pix.data, pix.w, pix.h), 0, 0);
  return new PIXI.Texture({
    source: new PIXI.CanvasSource({ resource: canvas, scaleMode: 'nearest', autoGenerateMipmaps: false }),
  });
}
