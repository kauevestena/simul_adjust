// Browser test: node transform_lab/tests/browser.cjs   (CHROME_PATH=/usr/bin/google-chrome to use a system Chrome)
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.TRANSFORM_SCREENSHOTS;
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png' };
const BLOCK = ['E2', 'F2', 'G2', 'H2', 'I2', 'J2', 'K2', 'R2', 'Q2', 'P2', 'O2', 'N2', 'M2', 'L2'];

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [], external = [];
  const watch = (page, { strictExternal = true } = {}) => {
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
    page.on('request', r => { const u = new URL(r.url()); if (strictExternal && u.protocol.startsWith('http') && u.hostname !== 'localhost') external.push(r.url()); });
    page.on('requestfailed', r => errors.push(`requestfailed: ${r.url()}`));
  };
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); } };
  const ready = page => page.evaluate(() => window.__lab.ready());
  const lab = (page, fn, arg) => page.evaluate(fn, arg);
  const canvasInk = (page, sel) => page.evaluate(s => { const c = document.querySelector(s); if (!c) return -1; const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }, sel);
  const run = async page => { await page.click('#btnRun'); await ready(page); };

  // ------------------------------------------------------------------ main page
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true, locale: 'de-DE' });
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base}/transform_lab/index.html`);
  await ready(page);
  assert.equal(await page.getAttribute('html', 'lang'), 'en', 'browser language de-DE falls back to English');
  assert.match(await page.getAttribute('a.portal', 'href'), /^\.\.\/\?lang=en$/);
  for (const a of await page.$$('a[data-page]')) assert.match(await a.getAttribute('href'), /\?lang=en$/);
  assert.equal(await page.evaluate(() => new URL(location.href).searchParams.get('lang')), 'en');

  // ATV-AJ (56) is preloaded, with the pointing σ of its preset, and nothing is adjusted until ▶
  let s = await lab(page, () => ({ result: window.__lab.result, n: window.__lab.dataset.ts.length, file: window.__lab.state.rawName, p: window.__lab.state.sim.instrument.pointingMm }));
  assert.deepEqual(s, { result: null, n: 56, file: 'ATV-AJ_56.csv', p: 0.4 });
  assert.match(await page.textContent('#panelGlobalTest'), /Waiting for the adjustment/);
  assert.ok(await page.$eval('#step1', el => el.classList.contains('step-active')), 'step 1 waits');
  assert.ok(await page.isVisible('#pendingNote'));
  assert.ok(await page.isDisabled('#btnOutliers'), 'detection needs an adjustment');
  assert.ok(await canvasInk(page, '#canvas2d') > 500, '2D view shows the data before the adjustment');
  await shot(page, 'main-waiting');

  await run(page);
  let r = await lab(page, () => { const r = window.__lab.result; return { ok: r.ok, s0: r.res.sigma0sq, pass: r.res.test.pass, counts: r.counts, plane: r.plane.ok }; });
  assert.ok(r.ok && r.pass, `ATV-AJ_56 passes the global test: σ̂0² ${r.s0}`);
  assert.equal(r.counts.matched, 56); assert.equal(r.counts.tsOnly, 0); assert.ok(r.plane);
  assert.match(await page.textContent('#summary'), /0\.0099/, 'the λ tile');
  assert.ok(await page.$eval('#step1', el => el.classList.contains('step-done')));
  assert.match(await page.textContent('#panelGlobalTest'), /Accepted/);
  assert.match(await page.textContent('#paramsPanel'), /κ/, 'Euler angles in the parameters card');
  await shot(page, 'main-2d');

  // language: toggle, shared storage, link preservation
  await page.click('[data-lang="pt-BR"]');
  assert.equal(await page.getAttribute('html', 'lang'), 'pt-BR');
  assert.equal(await page.evaluate(() => localStorage.getItem('monorepo_lang')), 'pt-BR');
  assert.match(await page.getAttribute('a.portal', 'href'), /lang=pt-BR/);
  assert.match(await page.getAttribute('a[data-page="teoria.html"]', 'href'), /^teoria\.html\?lang=pt-BR$/);
  assert.match(await page.textContent('.tabs button[data-tab="hist"]'), /Resíduos 1D/);
  assert.match(await page.textContent('#panelGlobalTest'), /Aprovado/);
  assert.ok(!(await page.textContent('#workflowForm')).includes('<sub>'), 'no raw markup in labels');
  await page.click('[data-lang="en"]');
  assert.match(await page.textContent('.tabs button[data-tab="hist"]'), /1D residuals/);

  // every tab renders
  for (const tab of ['view3d', 'plane', 'hist', 'points', 'results', 'settings', 'view2d']) {
    await page.click(`.tabs button[data-tab="${tab}"]`); await page.waitForTimeout(250);
    assert.ok(await page.isVisible(`#tab-${tab}`), tab);
  }
  await page.click('.tabs button[data-tab="view3d"]'); await page.waitForTimeout(500);
  assert.ok(await canvasInk(page, '#host3d canvas') > 500, '3D canvas has drawn pixels');
  await shot(page, 'main-3d');
  await page.click('.tabs button[data-tab="plane"]'); await page.waitForTimeout(300);
  assert.ok(await canvasInk(page, '#canvasPlane') > 2000, 'plane map drawn');
  assert.match(await page.textContent('#planeInfo'), /RMS d/);
  await shot(page, 'main-plane');
  await page.click('.tabs button[data-tab="hist"]');
  for (const q of ['std', 'w', 'planeW', 'planeD']) { await page.selectOption('#histQuantity', q); await page.waitForTimeout(100); assert.ok(await canvasInk(page, '#canvasHist') > 500, `histogram ${q}`); }
  await page.click('.tabs button[data-tab="results"]');
  assert.match(await page.textContent('#resultsBox'), /Sheet plane/);
  await page.click('.tabs button[data-tab="points"]');
  assert.equal((await page.$$('#pointsTable tbody tr')).length, 70, 'points table: 56 measured + 14 not collected');

  // changing a setting only invalidates; ▶ recomputes. Parametric rejects what combined accepts
  const combined = await lab(page, () => window.__lab.result.res.sigma0sq);
  await page.selectOption('#workflowForm [data-path="method"]', 'parametrico');
  assert.equal(await lab(page, () => window.__lab.result), null, 'a change does not recompute');
  assert.match(await page.textContent('#panelGlobalTest'), /Waiting/);
  await run(page);
  assert.ok(await lab(page, () => window.__lab.result.res.sigma0sq) > combined, 'parametric σ̂0² > combined');
  await page.selectOption('#workflowForm [data-path="method"]', 'combinado'); await run(page);
  await page.evaluate(() => window.__lab.set('rotation', 'quaternion')); await run(page);
  assert.ok(Math.abs(await lab(page, () => window.__lab.result.res.sigma0sq) - combined) < 1e-6, 'quaternion = Euler');
  await page.evaluate(() => window.__lab.set('rotation', 'euler')); await run(page);

  // ATV-AJ (70): the shifted block; RANSAC isolates it; deactivating it restores the printer scale
  await page.click('[data-sample="atv70"]'); await ready(page);
  assert.equal(await lab(page, () => window.__lab.dataset.ts.length), 70);
  assert.equal(await lab(page, () => window.__lab.result), null);
  await run(page);
  r = await lab(page, () => ({ pass: window.__lab.result.res.test.pass, ppm: window.__lab.result.params.deltaPpm }));
  assert.equal(r.pass, false); assert.ok(r.ppm < -10000, `δλ ${r.ppm}`);
  await page.selectOption('#outlierMethod', 'ransac');
  await page.click('#btnOutliers'); await ready(page);
  const flagged = await lab(page, () => window.__lab.detection.flagged);
  assert.ok(flagged.length >= 10 && flagged.every(n => BLOCK.includes(n)), `RANSAC flags ${flagged}`);
  assert.ok(await page.isVisible('#tab-points'), 'detection shows the points table');
  assert.equal((await page.$$('#pointsTable tr.row-outlier')).length, flagged.length);
  await shot(page, 'main-outliers');
  await page.click('#btnDeactivate');
  assert.equal(await lab(page, () => window.__lab.result), null);
  assert.equal(await lab(page, () => Object.keys(window.__lab.state.cfg.excluded).length), flagged.length);
  await run(page);
  r = await lab(page, () => ({ ppm: window.__lab.result.params.deltaPpm, ex: window.__lab.result.counts.excluded, plane: window.__lab.result.plane.m }));
  assert.ok(r.ppm > -4000 && r.ppm < -2500, `δλ after deactivating the block ${r.ppm}`);
  assert.equal(r.ex, flagged.length); assert.equal(r.plane, 70 - flagged.length, 'deactivated points leave the plane fit too');
  await page.selectOption('#outlierMethod', 'snooping');
  await page.click('#btnReactivate'); await run(page);
  await page.click('#btnOutliers'); await ready(page);
  const snoop = await lab(page, () => window.__lab.detection.flagged);
  assert.ok(snoop.slice(0, flagged.length).every(n => BLOCK.includes(n)), `snooping removes the block first: ${snoop}`);
  await page.selectOption('#outlierMethod', 'tau'); await page.click('#btnOutliers'); await ready(page);
  await page.selectOption('#outlierMethod', 'ksigma'); await page.click('#btnOutliers'); await ready(page);
  assert.ok(Array.isArray(await lab(page, () => window.__lab.detection.flagged)));

  // a gross error injected on purpose is found by data snooping
  await page.click('[data-sample="atv56"]'); await ready(page);
  await page.click('#btnBlunder');
  assert.ok(await page.isVisible('#dlgBlunder'));
  await page.evaluate(() => { document.querySelectorAll('#blunderList input').forEach(i => { i.checked = i.value === 'D0'; }); const k = document.getElementById('blunderK'); k.value = '40'; k.dispatchEvent(new Event('input')); });
  await page.selectOption('#blunderObs', 'S');
  await page.click('#btnInject');
  assert.ok(await lab(page, () => !!window.__lab.dataset.ts.find(q => q.name === 'D0').blunder));
  assert.match(await page.textContent('#dataStatus'), /injected/);
  await run(page);
  await page.selectOption('#outlierMethod', 'snooping'); await page.click('#btnOutliers'); await ready(page);
  const found = await lab(page, () => window.__lab.detection);
  assert.equal(found.history[0].name, 'D0', 'the injected point is removed first'); assert.equal(found.comps[0].obs, 'S');
  await page.click('#btnClearBlunders'); await ready(page);
  assert.ok(await lab(page, () => !window.__lab.dataset.ts.some(q => q.blunder)));

  // check-point slider (0–90 %, step 5); injunctions report their counts after ▶
  assert.equal(await page.getAttribute('[data-path="checkPct"]', 'max'), '90');
  assert.equal(await page.getAttribute('[data-path="checkPct"]', 'step'), '5');
  await page.selectOption('#workflowForm [data-path="injunctions.set"]', 'n8'); await run(page);
  assert.match(await page.textContent('#injInfo'), /independent/);
  await page.selectOption('#workflowForm [data-path="injunctions.set"]', 'none'); await run(page);

  // downloads
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlDist')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).length, 2416);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#dlObs')]);
  assert.ok(fs.readFileSync(await dl2.path(), 'utf8').includes('point_id,azimuth_deg'));
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#dlParams')]);
  assert.ok(fs.readFileSync(await dl3.path(), 'utf8').includes('parameter,value,sigma'));

  // import a file through the file input; the 3 extra IDs of the simulated sample are only transformed
  await page.setInputFiles('#importFile', path.join(ROOT, 'transform_lab', 'data', 'sample_ts_raw.csv'));
  await page.waitForFunction(() => window.__lab.state.rawName === 'sample_ts_raw.csv'); await ready(page);
  assert.match(await page.textContent('#dataStatus'), /66 points read/);
  await run(page);
  assert.equal(await lab(page, () => window.__lab.result.counts.tsOnly), 3);
  // a unit change re-parses the same file
  const x0 = await lab(page, () => window.__lab.dataset.ts[0].xyz[0]);
  await page.selectOption('#unitsForm [data-path="tsUnit"]', 'mm'); await ready(page);
  assert.ok(Math.abs(await lab(page, () => window.__lab.dataset.ts[0].xyz[0]) / x0 - 1000) < 1e-6, 'mm = 1000 × m');
  await page.selectOption('#unitsForm [data-path="tsUnit"]', 'm'); await ready(page);
  await page.selectOption('#importFormat', 'xyz');
  assert.equal(await page.evaluate(() => document.querySelector('#instrumentForm [data-path="instrument.angleSec"]').closest('label').hidden), true, 'instrument σ not used by xyz files');
  await page.selectOption('#importFormat', 'raw'); await ready(page);

  // the synthetic generator: landscape sheet → Euler gimbal lock
  await page.click('#synthBox summary');
  await page.selectOption('#simForm [data-path="preset"]', 'landscape');
  await page.click('#btnGenerate'); await ready(page);
  assert.equal(await lab(page, () => window.__lab.state.source), 'sim');
  await run(page);
  const gl = await lab(page, () => { const r = window.__lab.result; return r.ok ? r.res.flags.map(f => f.code) : [r.error.code]; });
  assert.ok(gl.includes('gimbal') || gl.includes('singular'), `landscape flags ${gl}`);
  assert.ok((await page.textContent('#messages')).length > 10, 'a message explains it');

  // reset brings back the default data, nothing adjusted
  await page.click('.tabs button[data-tab="settings"]');
  await page.click('#resetBtn'); await ready(page);
  assert.equal(await lab(page, () => window.__lab.state.rawName), 'ATV-AJ_56.csv');
  assert.equal(await lab(page, () => window.__lab.result), null);

  // no horizontal overflow on a phone
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'main page overflows at 390 px');
  assert.ok(await page.isVisible('a.portal'), 'portal link stays visible on a phone');
  await shot(page, 'main-mobile');
  await page.setViewportSize({ width: 1440, height: 950 });

  // ------------------------------------------------------------------ theory page
  await page.goto(`${base}/transform_lab/teoria.html?lang=pt`);
  await page.waitForSelector('.katex'); await page.waitForTimeout(300);
  assert.equal(await page.$$eval('.katex-error', e => e.length), 0, 'no KaTeX errors');
  assert.ok((await page.$$eval('.katex', e => e.length)) > 200, 'math rendered');
  assert.ok(await page.isVisible('h2#s6 .pt') && !(await page.isVisible('h2#s6 .en')));
  for (const id of ['s3-1', 's3-2', 's3-3', 's3-4', 's3-5', 's11', 's12']) assert.ok(await page.$(`#${id}`), id);
  await page.click('[data-lang="en"]');
  assert.ok(await page.isVisible('h2#s6 .en') && !(await page.isVisible('h2#s6 .pt')));
  assert.equal(await page.$$eval('.katex-error', e => e.length), 0);
  assert.match(await page.getAttribute('a.portal', 'href'), /lang=en/);
  assert.match(await page.getAttribute('a[data-page="index.html"]', 'href'), /^index\.html\?lang=en$/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'theory overflow');
  await shot(page, 'theory');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'theory page overflows at 390 px');
  await page.setViewportSize({ width: 1440, height: 950 });

  // ------------------------------------------------------------------ comparison page
  await page.goto(`${base}/transform_lab/comparacao.html?lang=en`);
  await page.waitForFunction(() => window.__cmp && window.__cmp.resA);
  assert.ok(await page.evaluate(() => window.__cmp.resA.ok && window.__cmp.resB.ok));
  assert.ok((await page.$$('#cmpTable tbody tr')).length >= 15);
  // invariants of a parametrization change: same rotation, same σ0²
  await page.evaluate(() => window.__cmp.applyPreset('rotations'));
  const same = await page.evaluate(() => { const A = window.__cmp.resA.res, B = window.__cmp.resB.res; return { dS: Math.abs(A.sigma0sq - B.sigma0sq), dL: Math.abs(A.lambda - B.lambda) }; });
  assert.ok(same.dS < 1e-6 && same.dL < 1e-12, JSON.stringify(same));
  await page.evaluate(() => window.__cmp.applyPreset('methods'));
  const m = await page.evaluate(() => ({ a: window.__cmp.resA.res.sigma0sq, b: window.__cmp.resB.res.sigma0sq }));
  assert.ok(m.b > m.a, `parametric σ0² ${m.b} > combined ${m.a}`);
  // the dialog edits configuration B; the comparison waits for ▶
  await page.click('#editB'); assert.ok(await page.isVisible('#dlgB'));
  await page.selectOption('#formB [data-path="rotation"]', 'matrix'); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__cmp.b.rotation), 'matrix');
  assert.equal(await page.evaluate(() => window.__cmp.stale), true);
  await page.click('#dlgB .dlg-foot [data-close]'); assert.ok(!(await page.isVisible('#dlgB')));
  await page.click('#runCompare');
  assert.ok(await page.evaluate(() => window.__cmp.resB && window.__cmp.resB.cfg.rotation === 'matrix'));
  // gimbal preset uses its own scenario
  await page.evaluate(() => window.__cmp.applyPreset('gimbal')); await page.waitForTimeout(300);
  assert.match(await page.textContent('#messages'), /landscape/i);
  await shot(page, 'compare');
  assert.match(await page.getAttribute('a[data-page="index.html"]', 'href'), /lang=en/);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'compare page overflows at 390 px');

  // ------------------------------------------------------------------ portal card
  // the portal itself loads web fonts: only transform_lab's own pages must be free of external requests
  const portal = await ctx.newPage(); watch(portal, { strictExternal: false });
  await portal.goto(`${base}/index.html?lang=en`);
  await portal.click('[data-card-id="transform_lab"] .btn-launch');
  await portal.waitForURL(/transform_lab/);
  assert.match(portal.url(), /lang=en/);
  assert.match(await portal.title(), /transform_lab/);
  await ready(portal);
  const labExternal = [];
  portal.on('request', r => { const u = new URL(r.url()); if (u.hostname !== 'localhost' && u.protocol.startsWith('http')) labExternal.push(r.url()); });
  await portal.reload(); await ready(portal);
  assert.deepEqual(labExternal, [], 'transform_lab page loaded from the portal makes no external requests');

  assert.deepEqual(external, [], 'no external requests');
  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log('transform_lab browser tests passed');
})().catch(e => { console.error(e); process.exit(1); });
