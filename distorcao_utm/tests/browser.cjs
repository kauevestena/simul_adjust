/* Browser regression checks (Playwright). Starts a local server rooted at the repository, then closes it.
   Run: NODE_PATH=./camera_proj/node_modules node distorcao_utm/tests/browser.cjs
   Set DISTORCAO_UTM_SCREENSHOTS to an output directory to keep review screenshots. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.svg': 'image/svg+xml' };
const tileRequests = [];
const server = http.createServer((req, res) => {
  let p = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root + path.sep) && p !== root) { res.writeHead(403); res.end(); return; }
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (p.endsWith('.bin')) tileRequests.push(path.basename(p));
    res.setHeader('Content-Type', TYPES[path.extname(p)] || 'text/html');
    res.end(fs.readFileSync(p));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

let browser;
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.__longTasks = [];
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__longTasks.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ }
  });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // the simulator must be self-contained (the portal page itself may load web fonts)
  const watchRequests = p => p.on('request', r => {
    if (!r.frame().url().includes('/distorcao_utm/')) return;
    if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url());
  });
  watchRequests(page);
  const state = () => page.evaluate(async () => (await import('./app.mjs')).getState());
  // wait until a simulation newer than `after` (a job number) has finished
  const idle = async (p = page, { after = 0, timeout = 60000 } = {}) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await p.evaluate(async () => (await import('./app.mjs')).getState());
      if (s.ready && !s.busy && s.job > after) return s;
      await p.waitForTimeout(250);
    }
    throw Error('simulation did not finish');
  };
  const jobNow = async () => (await state()).job;
  const setField = async (id, value) => { await page.fill(`#${id}-n`, String(value)); await page.dispatchEvent(`#${id}-n`, 'change'); };
  const shotDir = process.env.DISTORCAO_UTM_SCREENSHOTS;
  const shot = async (name, p = page) => { if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await p.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true }); } };

  // 1. boot in Portuguese, default scene computed in the worker
  await page.goto(`${base}/distorcao_utm/?lang=pt`);
  let s = await idle();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'pt-BR');
  assert.equal(await page.title(), 'distorcao_utm · Distorções UTM e do Geoide em Nuvens de Pontos');
  assert.equal(s.workerUsed, true, 'the pipeline runs in a Web Worker');
  assert.ok(s.webgl && s.drawCount > 0, 'WebGL split view rendered');
  assert.equal(s.counts.total, s.counts.terrain + s.counts.buildings);
  assert.ok(s.counts.total > 500000, String(s.counts.total));
  assert.equal(s.context.zone, 22); assert.equal(s.context.south, true);
  assert.ok(Math.abs(s.context.ppm0 + 213.06) < 0.1, String(s.context.ppm0));
  assert.equal(s.display.metric, 'ppm'); assert.equal(s.exaggerationUniform, 100);
  assert.deepEqual(s.geoidTiles, [], 'no geoid tile is fetched while the geoid is off');
  assert.equal(await page.locator('#metric option[value="dg"]').isDisabled(), true);
  assert.match(await page.locator('#cap-right').textContent(), /h elipsoidal · distorção ×100/);
  assert.equal(await page.locator('#cubes tbody tr').count() >= 2, true);
  console.log(`default scene: ${s.counts.total} points in ${s.timing.total.toFixed(0)} ms (worker)`);
  await shot('default-pt');

  // 2. chart hover readout
  const box = await page.locator('#chart').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  assert.match(await page.locator('#readout').textContent(), /Cursor/);

  // 3. metrics and colour scales
  await page.selectOption('#metric', 'dh');
  s = await state();
  assert.equal(s.scale.kind, 'sequential'); assert.equal(s.unit.unit, 'cm');
  assert.equal(await page.locator('#arrows-note').isVisible(), true);
  await page.selectOption('#range', 'zero');
  assert.equal((await state()).scale.min, 0);
  await page.selectOption('#metric', 'dz');
  s = await state();
  assert.ok(s.scale.min < 0 && s.scale.max > 0 && Math.abs(s.scale.min + s.scale.max) < 1e-9, 'zero-anchored diverging scale');
  await page.selectOption('#range', 'data');

  // 4. exaggeration is a shader uniform (no recomputation)
  const job = (await state()).job;
  await setField('exaggeration', 1000);
  s = await state();
  assert.equal(s.exaggerationUniform, 1000); assert.equal(s.job, job, 'no new simulation for the exaggeration');
  assert.match(await page.locator('#cap-right').textContent(), /×1\.000/);

  // 5. geoid on demand: only the tile of the area is fetched; the geoid metric becomes available
  let before = await jobNow();
  await page.check('#geoid');
  s = await idle(page, { after: before });
  assert.deepEqual(s.geoidTiles, ['r11c12.bin']); assert.deepEqual(tileRequests, ['r11c12.bin']);
  assert.ok(s.context.useGeoid && Number.isFinite(s.context.geoidN0) && Math.abs(s.context.geoidN0 - 4.65) < 0.05, String(s.context.geoidN0));
  assert.match(await page.locator('#cap-right').textContent(), /H ortométrica/);
  assert.equal(await page.locator('#metric option[value="dg"]').isDisabled(), false);
  await page.selectOption('#metric', 'dg');
  s = await state();
  assert.ok(['diverging', 'negative', 'positive'].includes(s.scale.kind) && s.unit.unit !== 'ppm');
  await shot('geoid-pt');
  before = await jobNow();
  await page.uncheck('#geoid');
  s = await idle(page, { after: before });
  assert.equal(s.display.metric, 'dz', 'geoid metric falls back when the geoid is turned off');

  // 6. language switch without reload
  await page.locator('[data-lang="en"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.title(), 'distorcao_utm · UTM & Geoid Distortions in Point Clouds');
  assert.match(await page.locator('a.portal').getAttribute('href'), /\?lang=en$/);
  assert.match(page.url(), /lang=en/);
  assert.equal(await page.evaluate(() => localStorage.getItem('monorepo_lang')), 'en');
  assert.match(await page.locator('#cap-right').textContent(), /ellipsoidal h · distortion ×1,000/);
  assert.match(await page.locator('#stats').textContent(), /Meridian convergence/);
  await setField('exaggeration', 100);

  // 7. point budget: densest settings stay within the budget, with the main thread responsive
  await page.evaluate(() => { window.__longTasks.length = 0; });
  before = await jobNow();
  await setField('spanWE', 20000); await setField('spanNS', 20000);
  await setField('buildingDensity', 25); await setField('terrainDensity', 4);
  const t0 = Date.now();
  s = await idle(page, { after: before, timeout: 120000 });
  const wall = Date.now() - t0;
  assert.ok(s.budget.reduced && s.counts.total <= s.maxPoints, `${s.counts.total} > ${s.maxPoints}`);
  assert.equal(await page.locator('#budget-note').isVisible(), true);
  const longest = await page.evaluate(() => Math.max(0, ...window.__longTasks));
  console.log(`budget scene: ${s.counts.total} points, worker ${s.timing.total.toFixed(0)} ms, wall ${wall} ms, longest main-thread task ${longest.toFixed(0)} ms`);
  assert.ok(longest < 2500, `main thread blocked for ${longest} ms`);
  await shot('budget-en');

  // 8. portal round trip keeps the language
  await page.goto(`${base}/?lang=en`);
  await page.locator('[data-card-id="distorcao_utm"] .btn-launch').click();
  await idle();
  assert.equal(await page.title(), 'distorcao_utm · UTM & Geoid Distortions in Point Clouds');
  assert.match(await page.locator('a.portal').getAttribute('href'), /\?lang=en$/);

  // 9. phone layout: stacked views, no horizontal overflow, smaller budget on touch devices
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await phone.newPage();
  m.on('pageerror', e => errors.push(e.message));
  watchRequests(m);
  await m.goto(`${base}/distorcao_utm/?lang=pt-BR`);
  const ms = await idle(m);
  assert.equal(ms.maxPoints, 1000000);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
  assert.equal(await m.locator('#split').evaluate(el => el.classList.contains('stacked')), true);
  await shot('phone-pt', m);

  assert.deepEqual(errors, [], 'no JS, WebGL or resource errors');
  assert.deepEqual(external, [], 'runtime is self-contained');
  console.log('Browser checks passed: worker pipeline, WebGL split view, metrics and scales, exaggeration uniform, geoid tiles on demand, i18n, point budget, portal round trip and phone layout.');
}

main()
  .then(async () => { await browser?.close(); server.close(); })
  .catch(async error => { console.error(error); process.exitCode = 1; await browser?.close(); server.close(); });
