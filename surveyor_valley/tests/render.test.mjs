// Render-layer tests.
//
// These run under plain `node --test` with nothing installed, which is only
// possible because the art pipeline is DOM-free: a sprite is a plain
// `{w, h, data}`, and `groundpaint` fills a typed array. Canvases and textures
// live in `atlas.js` and `groundbake.js` and are not touched here.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makePix, ramp, rgba, rgbToHsl, hash2, PX_PER_M } from '../src/render/pixbuf.js';
import { buildSprites, buildGroundSprites } from '../src/render/sprites/index.js';
import { classGrid, paintBase, paintDetail, shadeField } from '../src/render/groundpaint.js';
import { makeTerrain } from '../src/world/terrain.js';
import { makeCamera, ZOOM_LADDER, ZOOM_DEFAULT } from '../src/render/camera.js';

// ------------------------------------------------------------ the painter ---

test('the pixel painter blends, bounds-checks and hashes stably', () => {
  const a = makePix(8, 8);
  a.fill(2, 2, 4, 4, '#ff0000');
  assert.deepEqual(a.get(3, 3), [255, 0, 0, 255]);
  assert.deepEqual(a.get(0, 0), [0, 0, 0, 0]);

  // Writes outside the buffer are dropped, not wrapped onto the other edge.
  a.px(-1, 4, '#00ff00');
  a.px(99, 4, '#00ff00');
  assert.deepEqual(a.get(7, 4), [0, 0, 0, 0]);

  const b = makePix(8, 8);
  b.fill(2, 2, 4, 4, '#ff0000');
  assert.equal(a.hash(), b.hash(), 'same operations must give the same pixels');
});

test('outline traces the alpha edge and ignores translucent pixels', () => {
  const pix = makePix(9, 9);
  pix.fill(3, 3, 3, 3, '#4f9c33');
  // A translucent shadow, of the kind `contactShadow` lays down.
  pix.px(1, 8, '#1e2a18', 0.25);

  pix.outline('auto');

  // The edge next to the solid block is drawn...
  assert.ok(pix.get(2, 4)[3] > 0, 'edge pixel beside solid content must be outlined');
  // ...and it is a DARKER GREEN, not black: auto-outline takes the local hue.
  const [r, g, b] = pix.get(2, 4);
  assert.ok(g > r && g > b, 'outline beside green content should stay green');

  // The lone translucent pixel is background, so nothing was drawn around it.
  // Getting this wrong drew a black ellipse around every tree's contact shadow.
  assert.equal(pix.get(0, 8)[3], 0, 'a translucent pixel must not be treated as content');
  assert.equal(pix.get(2, 8)[3], 0);
});

test('ramp shifts hue toward yellow in light and blue in shadow, for any hue', () => {
  // The bug this pins down: a fixed +hue delta warms an orange correctly and
  // sends a green straight into cyan. Grass highlights came out mint.
  for (const base of ['#5fa03c', '#a8763e', '#3f92c4', '#b8503a']) {
    const [dark, mid, light] = ramp(base, 3);
    const hl = rgbToHsl(...rgba(light).slice(0, 3));
    const hm = rgbToHsl(...rgba(mid).slice(0, 3));
    const hd = rgbToHsl(...rgba(dark).slice(0, 3));

    assert.ok(hl[2] > hm[2], `${base}: highlight must be lighter`);
    assert.ok(hd[2] < hm[2], `${base}: shadow must be darker`);

    // Distance round the hue circle to yellow, closer for the highlight.
    const toYellow = (h) => Math.abs(((h - 0.13 + 0.5) % 1) - 0.5);
    assert.ok(
      toYellow(hl[0]) <= toYellow(hm[0]) + 1e-6,
      `${base}: highlight must move toward yellow, not away (got hue ${hl[0].toFixed(3)})`,
    );
    const toBlue = (h) => Math.abs(((h - 0.66 + 0.5) % 1) - 0.5);
    assert.ok(toBlue(hd[0]) <= toBlue(hm[0]) + 1e-6, `${base}: shadow must move toward blue`);
  }
});

// -------------------------------------------------------------- the sheet ---

test('every sprite is deterministic, outlined, and a plausible real size', () => {
  const first = buildSprites();
  const second = buildSprites();
  assert.ok(first.length > 60, 'the roster should not have quietly emptied');
  assert.equal(first.length, second.length);

  for (let i = 0; i < first.length; i++) {
    const a = first[i];
    const b = second[i];
    assert.equal(a.key, b.key);
    assert.equal(a.pix.hash(), b.pix.hash(), `${a.key} must paint identically every time`);
    assert.ok(a.pix.bounds(), `${a.key} must not be empty`);
    assert.ok(a.anchorY > 0 && a.anchorY <= 1, `${a.key} anchor must be inside the sprite`);
  }

  // Sizes are derived from the pixel buffer, so this is really asserting that
  // the art and the world agree about how big things are.
  const size = (key) => {
    const s = first.find((x) => x.key === key);
    return s && { wm: s.pix.w / PX_PER_M, hm: s.pix.h / PX_PER_M };
  };

  const person = size('char-S-0');
  assert.ok(person.hm > 1.6 && person.hm < 2.6, `a surveyor is ${person.hm} m tall`);
  assert.ok(person.wm > 1.0 && person.wm < 2.0);

  const tree = size('tree-0-1');
  assert.ok(tree.wm > 3 && tree.wm < 7, `a tree is ${tree.wm} m across`);
  assert.ok(tree.hm > person.hm * 2, 'a tree must dwarf the surveyor');

  const station = size('station');
  assert.ok(station.hm > 1.5 && station.hm < 3.0, `the instrument is ${station.hm} m tall`);
});

test('the three painted size buckets really differ in size', () => {
  const sprites = buildSprites();
  const at = (s) => sprites.find((x) => x.key === `tree-0-${s}`).pix.w;
  assert.ok(at(0) < at(1) && at(1) < at(2), 'tree size buckets must be strictly increasing');
  // Discrete sizes exist so nothing is ever scaled at draw time; if the buckets
  // were nearly equal there would be no point paying for three of them.
  assert.ok(at(2) - at(0) > 10, 'buckets should be visibly different');
});

test('sprite keys the scene asks for all exist', () => {
  const keys = new Set(buildSprites().map((s) => s.key));
  for (let v = 0; v < 8; v++) for (let s = 0; s < 3; s++) assert.ok(keys.has(`tree-${v}-${s}`));
  for (const dir of ['S', 'N', 'E', 'W']) {
    for (let f = 0; f < 4; f++) assert.ok(keys.has(`char-${dir}-${f}`), `char-${dir}-${f} missing`);
  }
  for (const k of ['char-kneel', 'marco', 'station', 'prism', 'poste', 'divisa-0']) {
    assert.ok(keys.has(k), `${k} missing`);
  }
});

// ------------------------------------------------------------- the ground ---

const BOUNDS = { minE: 0, minN: 0, maxE: 640, maxN: 640, width: 640, height: 640 };

test('a chunk bakes identically every time, and slices only touch their rows', () => {
  const terrain = makeTerrain('render-test', BOUNDS);
  const M = 32;
  const W = M * PX_PER_M;
  const { grid, size } = classGrid(terrain, 256, 256, M);
  const shade = shadeField(256, 256, M);

  const whole = new Uint8ClampedArray(W * W * 4);
  paintBase(whole, grid, size, 256, 256, M, PX_PER_M, 0, W, shade);

  // Painted in slices, exactly as the budgeted queue does it.
  const sliced = new Uint8ClampedArray(W * W * 4);
  for (let r = 0; r < W; r += 48) {
    paintBase(sliced, grid, size, 256, 256, M, PX_PER_M, r, Math.min(W, r + 48), shade);
  }
  assert.deepEqual(Buffer.from(sliced), Buffer.from(whole), 'slicing must not change the result');

  // A slice must touch ONLY its own rows. If it painted the whole chunk each
  // time, the budget would be meaningless and the bake would still hitch.
  const one = new Uint8ClampedArray(W * W * 4);
  paintBase(one, grid, size, 256, 256, M, PX_PER_M, 48, 96, shade);
  const rowOpaque = (y) => one[(y * W + 5) * 4 + 3] > 0;
  assert.ok(rowOpaque(50), 'rows inside the slice must be painted');
  assert.ok(!rowOpaque(10), 'rows before the slice must be untouched');
  assert.ok(!rowOpaque(200), 'rows after the slice must be untouched');
});

test('ground detail is placed from world position, so chunks tile seamlessly', () => {
  const terrain = makeTerrain('render-test', BOUNDS);
  const sprites = buildGroundSprites();
  const M = 32;
  const W = M * PX_PER_M;

  const bake = () => {
    const buf = new Uint8ClampedArray(W * W * 4);
    const { grid, size } = classGrid(terrain, 128, 128, M);
    paintBase(buf, grid, size, 128, 128, M, PX_PER_M, 0, W, shadeField(128, 128, M));
    paintDetail(buf, grid, size, 128, 128, M, PX_PER_M, sprites);
    return Buffer.from(buf);
  };
  assert.deepEqual(bake(), bake(), 'the same patch of ground must grow the same tufts');
});

test('the ground actually has texture rather than being a flat fill', () => {
  const terrain = makeTerrain('render-test', BOUNDS);
  const sprites = buildGroundSprites();
  const M = 32;
  const W = M * PX_PER_M;

  const buf = new Uint8ClampedArray(W * W * 4);
  const { grid, size } = classGrid(terrain, 300, 300, M);
  paintBase(buf, grid, size, 300, 300, M, PX_PER_M, 0, W, shadeField(300, 300, M));
  paintDetail(buf, grid, size, 300, 300, M, PX_PER_M, sprites);

  const seen = new Set();
  for (let i = 0; i < buf.length; i += 4) seen.add((buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]);

  // The Phase 1 ground was one colour per class, blurred. That is the failure
  // this guards against — anything under a few dozen tones is a flat fill.
  assert.ok(seen.size > 40, `expected a textured surface, got ${seen.size} distinct colours`);
  assert.equal(buf[3], 255, 'the ground must be fully opaque — no holes in the world');
});

test('hash2 is stable, well spread, and independent across salts', () => {
  assert.equal(hash2(7, 9, 3), hash2(7, 9, 3));
  assert.notEqual(hash2(7, 9, 3), hash2(7, 9, 4));

  let sum = 0;
  let n = 0;
  for (let x = 0; x < 100; x++) {
    for (let y = 0; y < 100; y++) {
      const v = hash2(x, y, 1);
      assert.ok(v >= 0 && v < 1);
      sum += v;
      n++;
    }
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.02, 'detail placement must not be biased');
});

// ------------------------------------------------------------- the camera ---

test('field zoom is always an integer multiple of the art resolution', () => {
  // Non-integer scaling is what turns pixel art into mush, so this is a
  // correctness property of the renderer, not a preference.
  for (const z of ZOOM_LADDER) {
    if (z < PX_PER_M) continue; // the plan view draws lines, not sprites
    assert.equal(z % PX_PER_M, 0, `zoom ${z} is not a whole number of art pixels`);
  }
  assert.ok(ZOOM_LADDER.includes(ZOOM_DEFAULT));
});

test('the camera lands on whole art pixels however it is moved', () => {
  const cam = makeCamera({ e: 100, n: 100 });
  cam.setViewport(1280, 800);
  cam.setBounds(BOUNDS);

  const onGrid = (v) => Math.abs(v * PX_PER_M - Math.round(v * PX_PER_M)) < 1e-9;

  cam.snapTo({ e: 123.456789, n: 87.1357 });
  assert.ok(onGrid(cam.e) && onGrid(cam.n), 'snapTo must land on an art pixel');

  for (let i = 0; i < 200; i++) {
    cam.follow({ e: 300.371, n: 251.919 }, 1 / 60);
    assert.ok(onGrid(cam.e) && onGrid(cam.n), `follow drifted off the pixel grid at step ${i}`);
  }
});

test('zoom steps rung to rung and stays inside the ladder', () => {
  const cam = makeCamera({ zoom: ZOOM_DEFAULT });
  cam.setViewport(1280, 800);

  for (let i = 0; i < 10; i++) cam.stepZoom(1);
  assert.equal(cam.zoom, ZOOM_LADDER[ZOOM_LADDER.length - 1], 'zooming in must clamp at the top');
  for (let i = 0; i < 20; i++) cam.stepZoom(-1);
  assert.equal(cam.zoom, ZOOM_LADDER[0], 'zooming out must clamp at the bottom');

  cam.setZoom(30);
  assert.ok(ZOOM_LADDER.includes(cam.zoom), 'setZoom must snap to a rung');
});

test('zooming toward a point keeps that point under the cursor', () => {
  const cam = makeCamera({ e: 320, n: 320, zoom: 32 });
  cam.setViewport(1280, 800);
  cam.setBounds(BOUNDS);

  const sx = 900;
  const sy = 300;
  const before = cam.screenToWorld(sx, sy);
  cam.zoomAt(sx, sy, 1);
  const after = cam.screenToWorld(sx, sy);

  // Within one art pixel: the camera snaps to the grid, so exactness is neither
  // achievable nor wanted.
  assert.ok(Math.hypot(after.e - before.e, after.n - before.n) < 1 / PX_PER_M + 1e-9);
});
