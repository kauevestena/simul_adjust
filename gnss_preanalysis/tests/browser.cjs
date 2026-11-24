/* Real mouse/form regression checks with MapLibre in a browser. OpenFreeMap and AWS Terrarium
 * requests are answered by local fixtures, so CI needs no outside service.
 *   npm run test:browser --prefix gnss_preanalysis
 *   GNSS_SCREENSHOTS=/tmp/shots CHROME_PATH=/usr/bin/google-chrome npm run test:browser --prefix gnss_preanalysis
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  let p = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root + path.sep) && p !== root) { res.writeHead(403); res.end(); return; }
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(fs.readFileSync(p));
  } catch { res.writeHead(404); res.end(); }
});
const fixtureStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eef0' } }] };
const terrainTile = fs.readFileSync(path.join(__dirname, 'fixtures/synthetic-terrain.png'));
const SHOTS = process.env.GNSS_SCREENSHOTS;
const LIVE = process.env.GNSS_LIVE_MAP === '1';

/** GNSS_LIVE_MAP=1: real OpenFreeMap style/tiles and AWS Terrarium, Curitiba heights, label glyphs, style switch. */
async function live(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } }), responses = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (/openfreemap|elevation-tiles-prod/.test(r.url())) responses.push({ url: r.url(), status: r.status() }); });
  await page.goto(base + '?lang=en');
  await page.waitForFunction(() => window.__gnss);
  await page.evaluate(() => window.__gnss.ready);
  await page.waitForFunction(() => !window.__gnss.isBusy() && window.__gnss.getProject().points.every(p => p.hSource !== 'pending'), null, { timeout: 60000 });
  await page.waitForFunction(() => window.__gnss.getView().map.isStyleLoaded() && window.__gnss.getView().map.areTilesLoaded(), null, { timeout: 60000 });
  const points = await page.evaluate(() => window.__gnss.getProject().points.filter(p => p.kind === 'new').map(p => ({ id: p.id, src: p.hSource, h: p.h })));
  assert.ok(points.every(p => p.src === 'terrain' && p.h > 800 && p.h < 1050), `Curitiba DEM heights ${JSON.stringify(points)}`);
  assert.ok(responses.some(r => /\.pbf|planet/.test(r.url) && r.status === 200), 'live vector tiles');
  assert.ok(responses.some(r => r.url.includes('terrarium') && r.status === 200), 'live DEM tiles');
  assert.ok(await page.evaluate(() => Boolean(window.__gnss.getView().map.getLayer('gnss-cors-label'))), 'station labels use the basemap glyphs');
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 'live-positron.png') }); }
  await page.selectOption('#basemap', 'liberty');
  await page.waitForFunction(() => { const m = window.__gnss.getView().map; return m.isStyleLoaded() && m.getLayer('gnss-baselines-line') && m.getLayer('gnss-hillshade'); }, null, { timeout: 60000 });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'live-liberty.png') });
  assert.deepEqual(errors, []);
  console.log('gnss_preanalysis live map check passed');
}

async function fixtures(context, { failTerrain = false } = {}) {
  await context.route('https://tiles.openfreemap.org/**', route => route.fulfill({ json: fixtureStyle }));
  await context.route('https://s3.amazonaws.com/elevation-tiles-prod/**', route => failTerrain ? route.abort() : route.fulfill({ contentType: 'image/png', body: terrainTile }));
}

async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://127.0.0.1:${server.address().port}/gnss_preanalysis/`;
  if (LIVE) { try { await live(browser, base); } finally { await browser.close(); server.close(); } return; }
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, acceptDownloads: true });
    await fixtures(context);
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1:') && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
    const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };
    const settle = () => page.waitForFunction(() => window.__gnss && !window.__gnss.isBusy());
    const result = () => page.evaluate(() => { const r = window.__gnss.getResult(); return { solvable: r.solvable, dof: r.dof, rank: r.rank,
      codes: r.diagnostics.map(d => d.code), trivial: r.trivialCount, h: r.worstHorizontal, u: r.worstVertical, n: r.rows.length }; });
    const project = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__gnss.getProject())));
    const screenOf = async lngLat => page.evaluate(ll => { const m = window.__gnss.getView().map, p = m.project(ll), r = m.getCanvas().getBoundingClientRect(); return { x: r.x + p.x, y: r.y + p.y }; }, lngLat);
    const clickPoint = async id => { const el = page.locator(`.gnss-marker[data-id="${id}"]`); await el.click(); };

    // 1. Default example, Portuguese, heights from the (synthetic) DEM.
    await page.goto(base + '?lang=pt');
    await page.waitForFunction(() => window.__gnss);
    await page.evaluate(() => window.__gnss.ready); await settle();
    await page.waitForFunction(() => window.__gnss.getProject().points.every(p => p.hSource !== 'pending'));
    let r = await result();
    assert.equal(r.solvable, true); assert.equal(r.dof, 12); assert.equal(r.n, 24);
    const pts = await project();
    assert.ok(pts.points.filter(p => p.kind === 'new').every(p => p.hSource === 'terrain' && p.h > 880 && p.h < 940), 'DEM heights');
    assert.equal(await page.locator('.gnss-marker').count(), 6);
    assert.match(await page.textContent('h1'), /Pré-análise de Redes GNSS/);
    assert.match(await page.textContent('#status'), /determinável/);
    await shot('01-network-pt');

    // 2. Language switch keeps state and updates the portal link and storage.
    await page.click('[data-lang="en"]');
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.evaluate(() => localStorage.getItem('monorepo_lang')), 'en');
    assert.match(await page.getAttribute('a.portal', 'href'), /lang=en/);
    assert.match(await page.textContent('h1'), /GNSS Network Pre-Analysis/);
    assert.match(await page.textContent('#status'), /determinable/);

    // 3. Select a point and a baseline; inspector shows predicted precision and MDB.
    await clickPoint('P2');
    assert.match(await page.textContent('#context'), /σE \/ σN \/ σU/);
    assert.equal(await page.locator('#p-sigma').isVisible(), false, 'control σ only for stochastic points');
    await page.selectOption('#p-control', 'stochastic'); assert.equal(await page.locator('#p-sigma').isVisible(), true);
    await page.selectOption('#p-control', 'free');
    await page.locator('#context [data-baseline]').first().click();
    assert.match(await page.textContent('#context'), /MDB/);
    assert.match(await page.textContent('#context'), /XYZ/);

    // 4. Precision model: RTK worsens, linear → quadratic improves, setup errors matter.
    const before = r.h;
    await page.selectOption('#preset', 'rtk'); r = await result(); assert.ok(r.h > before * 1.5, 'RTK is worse');
    await page.selectOption('#preset', 'static'); r = await result(); assert.ok(Math.abs(r.h - before) < 1e-12);
    await page.selectOption('#combination', 'quadratic'); assert.ok((await result()).h < before);
    await page.selectOption('#combination', 'linear');
    await page.locator('details#setup-section summary').click();
    await page.fill('#new-c', '5'); await page.press('#new-c', 'Tab'); assert.ok((await result()).h > before);
    await page.fill('#new-c', '1'); await page.press('#new-c', 'Tab'); assert.ok(Math.abs((await result()).h - before) < 1e-12);
    await page.fill('#aH', ''); await page.press('#aH', 'Tab'); assert.equal(await page.locator('#error').isVisible(), true);
    assert.equal(await page.inputValue('#aH'), '3', 'invalid input restored');

    // 5. Draw a new point (DEM height) and a baseline in a new session with the mouse.
    await page.click('#add-session');
    assert.equal(await page.inputValue('#active-session'), 'S5');
    await page.click('[data-tool="point"]');
    const target = await screenOf([-49.20, -25.47]);
    await page.mouse.click(target.x, target.y); await settle();
    let p = await project();
    const added = p.points.at(-1);
    assert.equal(added.id, 'P5'); assert.equal(added.hSource, 'terrain');
    assert.equal((await result()).codes.includes('isolatedPoints'), true);
    await page.click('[data-tool="baseline"]');
    await clickPoint('P5'); await clickPoint('P3');
    await clickPoint('P5'); await clickPoint('UFPR');
    p = await project();
    assert.deepEqual(p.baselines.filter(b => b.session === 'S5').map(b => `${b.from}-${b.to}`), ['P5-P3', 'P5-UFPR']);
    r = await result(); assert.equal(r.dof, 15); assert.equal(r.codes.includes('isolatedPoints'), false);
    await clickPoint('P5'); await clickPoint('P3');
    assert.match(await page.textContent('#error'), /already exists/);
    await page.click('#undo'); p = await project(); assert.equal(p.baselines.length, 9);
    await page.click('#redo'); p = await project(); assert.equal(p.baselines.length, 10);
    await shot('02-new-point-en');

    // 6. Drag a new point: coordinates change, height is resampled, results change.
    await page.click('[data-tool="select"]');
    const hBefore = (await result()).h, start = await page.locator('.gnss-marker[data-id="P5"]').boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y - 60, { steps: 10 }); await page.mouse.up(); await settle();
    p = await project(); const moved = p.points.find(x => x.id === 'P5');
    assert.notEqual(moved.lon, added.lon); assert.equal(moved.hSource, 'terrain');
    assert.notEqual((await result()).h, hBefore);

    // 7. Sessions: correlation model, durations and IBGE guide; trivial baselines example.
    await page.check('#session-correlation'); assert.equal((await result()).solvable, true);
    await page.uncheck('#session-correlation');
    await page.selectOption('#example', 'trivial'); await settle();
    r = await result(); assert.equal(r.trivial, 3); assert.ok(r.codes.includes('trivialBaselines'));
    const optimistic = r.h;
    await page.selectOption('#trivial', 'exclude'); r = await result();
    assert.ok(r.codes.includes('trivialExcluded')); assert.equal(r.dof, 0); assert.ok(r.h > optimistic);
    await shot('03-trivial');
    await page.selectOption('#example', 'long'); await settle();
    r = await result(); assert.ok(r.codes.includes('sessionShort'));
    await page.locator('#session-list input[data-field="duration"]').first().fill('300');
    await page.locator('#session-list input[data-field="duration"]').first().press('Tab');
    await page.locator('#session-list input[data-field="duration"]').nth(1).fill('300');
    await page.locator('#session-list input[data-field="duration"]').nth(1).press('Tab');
    assert.equal((await result()).codes.includes('sessionShort'), false);
    await page.selectOption('#frequency', 'single'); assert.ok((await result()).codes.includes('singleFrequencyLong'));

    // 8. Snap to RBMC stations: empty network over Brazil, click near a station marker.
    await page.selectOption('#example', 'empty'); await settle();
    await page.evaluate(() => window.__gnss.getView().map.jumpTo({ center: [-49.23, -25.45], zoom: 9 }));
    await page.click('[data-tool="point"]');
    const ufpr = await screenOf([-49.23095501, -25.44836778]);
    await page.mouse.click(ufpr.x + 6, ufpr.y - 5);
    p = await project();
    assert.equal(p.points.length, 1); assert.equal(p.points[0].kind, 'cors'); assert.equal(p.points[0].corsId, 'UFPR');
    assert.equal(p.points[0].control, 'fixed'); assert.equal(p.points[0].h, 925.861);
    await page.locator('details#view-section summary').click();
    await page.uncheck('#snap');
    await page.mouse.click(ufpr.x + 180, ufpr.y + 120); await settle();
    p = await project(); assert.equal(p.points[1].kind, 'new');
    await page.click('[data-tool="baseline"]');
    await clickPoint('P1');
    const prpi = await screenOf([-49.12654345, -25.38673185]);
    await page.mouse.click(prpi.x, prpi.y); // a station outside the network joins as fixed control
    p = await project();
    assert.ok(p.points.some(x => x.corsId === 'PRPI')); assert.equal(p.baselines.length, 1);
    await page.click('[data-tool="select"]');
    await shot('04-snap');

    // 9. JSON save/load round trip and matrices dialog.
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
    const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(saved.format, 'gnss-preanalysis'); assert.equal(saved.points.length, 3);
    await page.selectOption('#example', 'network'); await settle();
    await page.setInputFiles('#file', { name: 'net.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
    await page.waitForFunction(() => window.__gnss.getProject().points.length === 3);
    await page.setInputFiles('#file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"x"}') });
    await page.waitForSelector('#error:not([hidden])');
    assert.equal((await project()).points.length, 3, 'invalid file keeps the project');
    await page.selectOption('#example', 'network'); await settle();
    await page.click('#matrices'); assert.match(await page.textContent('#matrix-order'), /P1\.X/);
    await page.selectOption('#matrix-choice', 'S'); assert.notEqual((await page.textContent('#matrix-content')).trim(), '—');
    await page.click('#matrix-dialog [data-close]');

    // 10. Imported CORS list.
    await page.setInputFiles('#cors-file', { name: 'mine.csv', mimeType: 'text/csv', buffer: Buffer.from('id,lat,lon,h\nZZZ1,-25.5,-49.3,900\n') });
    await page.waitForFunction(() => window.__gnss.getState().stations.some(s => s.id === 'ZZZ1'));

    // 11. Basemap switch keeps the network layers (re-installed after style.load).
    await page.selectOption('#basemap', 'liberty');
    await page.waitForFunction(() => { const m = window.__gnss.getView().map; return m.isStyleLoaded() && m.getLayer('gnss-baselines-line') && m.getLayer('gnss-cors-circle'); });
    assert.equal(await page.locator('.gnss-marker').count(), (await project()).points.length);

    // 12. Theory/help dialogs in both languages.
    await page.click('#theory'); assert.match(await page.textContent('#theory-dialog'), /incidence/); await page.click('#theory-dialog [data-close]');
    await page.click('[data-lang="pt-BR"]'); await page.click('#theory');
    assert.match(await page.textContent('#theory-dialog'), /incidência/); await page.click('#theory-dialog [data-close]');
    assert.deepEqual(errors, [], 'no page errors');
    assert.ok(external.every(u => /tiles\.openfreemap\.org|elevation-tiles-prod/.test(u)), `unexpected requests: ${external.join(', ')}`);

    // 13. Phone layout: no horizontal overflow, panel toggles over the map.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
    await shot('05-phone');
    await page.click('#toggle-panel'); assert.equal(await page.locator('#inspector').isVisible(), false);
    await page.click('#toggle-panel'); assert.equal(await page.locator('#inspector').isVisible(), true);
    await context.close();

    // 14. DEM failure: points keep an approximate height, flagged, and the network still computes.
    const failing = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    await fixtures(failing, { failTerrain: true });
    const p2 = await failing.newPage();
    await p2.goto(base + '?lang=en&example=radial');
    await p2.waitForFunction(() => window.__gnss && !window.__gnss.isBusy() && window.__gnss.getProject().points.every(p => p.hSource !== 'pending'));
    const res2 = await p2.evaluate(() => ({ codes: window.__gnss.getResult().diagnostics.map(d => d.code), dof: window.__gnss.getResult().dof,
      src: window.__gnss.getProject().points.map(p => p.hSource) }));
    assert.ok(res2.codes.includes('heightAssumed')); assert.equal(res2.dof, 0); assert.ok(res2.src.includes('missing'));
    assert.match(await p2.textContent('#error'), /Elevation unavailable/);
    await failing.close();
    console.log('gnss_preanalysis browser suite passed');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); server.close(); process.exit(1); });
