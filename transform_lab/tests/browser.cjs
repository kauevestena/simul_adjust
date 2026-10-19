// Browser test: node transform_lab/tests/browser.cjs   (CHROME_PATH=/usr/bin/google-chrome to use a system Chrome)
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.TRANSFORM_SCREENSHOTS;
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png' };

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
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };
  const ready = page => page.evaluate(() => window.__lab.ready());

  // ------------------------------------------------------------------ main page
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true, locale: 'de-DE' });
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base}/transform_lab/index.html`);
  await ready(page);
  assert.equal(await page.getAttribute('html', 'lang'), 'en', 'browser language de-DE falls back to English');
  assert.match(await page.getAttribute('a.portal', 'href'), /^\.\.\/\?lang=en$/);
  for (const a of await page.$$('a[data-page]')) assert.match(await a.getAttribute('href'), /\?lang=en$/);
  assert.equal(await page.evaluate(() => new URL(location.href).searchParams.get('lang')), 'en');

  let r = await page.evaluate(() => ({ ok: window.__lab.result.ok, s0: window.__lab.result.res.sigma0sq, counts: window.__lab.result.counts }));
  assert.ok(r.ok); assert.ok(r.s0 > 0.5 && r.s0 < 2, `default sigma0² ${r.s0}`);
  assert.ok(r.counts.check > 0 && r.counts.tsOnly === 3);
  assert.ok((await page.textContent('#summary')).includes('0.01'), 'summary tiles show λ');
  await shot(page, 'main-2d');

  // language: toggle, shared storage, link preservation
  await page.click('[data-lang="pt-BR"]');
  assert.equal(await page.getAttribute('html', 'lang'), 'pt-BR');
  assert.equal(await page.evaluate(() => localStorage.getItem('monorepo_lang')), 'pt-BR');
  assert.match(await page.getAttribute('a.portal', 'href'), /lang=pt-BR/);
  assert.match(await page.getAttribute('a[data-page="teoria.html"]', 'href'), /^teoria\.html\?lang=pt-BR$/);
  assert.match(await page.textContent('.tabs button[data-tab="hist"]'), /Histograma/);
  await page.click('[data-lang="en"]');
  assert.match(await page.textContent('.tabs button[data-tab="hist"]'), /histogram/i);

  // every tab renders
  for (const tab of ['view3d', 'hist', 'results', 'points', 'view2d']) {
    await page.click(`.tabs button[data-tab="${tab}"]`); await page.waitForTimeout(250);
    assert.ok(await page.isVisible(`#tab-${tab}`), tab);
  }
  await page.click('.tabs button[data-tab="view3d"]'); await page.waitForTimeout(500);
  const px = await page.evaluate(() => { const c = document.querySelector('#host3d canvas'); if (!c) return -1; const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  assert.ok(px > 500, `3D canvas has drawn pixels (${px})`);
  await shot(page, 'main-3d');
  await page.click('.tabs button[data-tab="results"]'); await page.waitForTimeout(150);
  assert.ok((await page.textContent('#resultsBox')).includes('κ'), 'results list the Euler angles');
  await shot(page, 'main-results');
  await page.click('.tabs button[data-tab="points"]');
  assert.ok((await page.$$('#pointsTable tbody tr')).length >= 66, 'points table');

  // changing the model recomputes: parametric rejects the global test, rotation parametrizations agree
  const ref0 = await page.evaluate(() => { const r = window.__lab.result; return { s0: r.res.sigma0sq, R: r.res.R }; });
  await page.evaluate(() => window.__lab.set('rotation', 'quaternion')); await ready(page);
  const q = await page.evaluate(() => window.__lab.result.res.R);
  assert.ok(Math.max(...q.flat().map((v, i) => Math.abs(v - ref0.R.flat()[i]))) < 1e-9, 'quaternion = Euler rotation');
  await page.evaluate(() => { window.__lab.set('rotation', 'euler'); window.__lab.set('method', 'parametrico'); }); await ready(page);
  const par = await page.evaluate(() => window.__lab.result.res.sigma0sq);
  assert.ok(par > ref0.s0, `parametric σ̂0² ${par} > combined ${ref0.s0}`);
  await page.evaluate(() => window.__lab.set('method', 'combinado')); await ready(page);

  // gimbal lock scenario through the form
  await page.selectOption('[data-path="preset"]', 'landscape'); await ready(page);
  const gl = await page.evaluate(() => { const r = window.__lab.result; return r.ok ? r.res.flags.map(f => f.code) : [r.error.code]; });
  assert.ok(gl.includes('gimbal') || gl.includes('singular'), `landscape flags ${gl}`);
  assert.ok((await page.textContent('#messages')).length > 10, 'a message explains it');
  await page.selectOption('[data-path="preset"]', 'wall'); await ready(page);

  // check-point slider (0–90 %, step 5) and click-to-toggle in the 2D view
  assert.equal(await page.getAttribute('[data-path="checkPct"]', 'max'), '90');
  assert.equal(await page.getAttribute('[data-path="checkPct"]', 'step'), '5');
  await page.evaluate(() => { const el = document.querySelector('[data-path="checkPct"]'); el.value = '50'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await ready(page);
  assert.ok(await page.evaluate(() => window.__lab.result.counts.check) >= 28);
  const nChecks = await page.evaluate(() => window.__lab.result.counts.check);
  await page.click('.tabs button[data-tab="view2d"]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__lab.set('checkOverride', { A0: true })); await ready(page);
  assert.equal(await page.evaluate(() => window.__lab.result.roles.A0), 'check');
  assert.ok(await page.evaluate(() => window.__lab.result.counts.check) >= nChecks - 1);

  // injunctions: counts are reported
  await page.evaluate(() => { window.__lab.set('checkPct', 20); window.__lab.set('injunctions.set', 'n8'); }); await ready(page);
  assert.match(await page.textContent('#injInfo'), /independent/);
  await shot(page, 'main-injunctions');
  await page.evaluate(() => window.__lab.set('injunctions.set', 'none')); await ready(page);

  // downloads: the 2415-pair distance table
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlDist')]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  assert.equal(text.replace(/^﻿/, '').trim().split(/\r?\n/).length, 2416);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#dlObs')]);
  assert.ok(fs.readFileSync(await dl2.path(), 'utf8').includes('hz_deg'));

  // import: the committed sample file
  await page.selectOption('#source', 'import');
  await page.selectOption('#importFormat', 'raw');
  await page.setInputFiles('#importFile', path.join(ROOT, 'transform_lab', 'data', 'sample_ts_raw.csv'));
  await page.waitForFunction(() => window.__lab.state.source === 'import');
  await ready(page);
  assert.ok(await page.evaluate(() => window.__lab.result.ok && window.__lab.dataset.meta.source === 'import'));
  assert.match(await page.textContent('#importStatus'), /66 points/);
  await page.evaluate(() => document.getElementById('resetBtn').click()); await ready(page);

  // no horizontal overflow on a phone
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'main page overflows at 390 px');
  assert.ok(await page.isVisible('a.portal'), 'portal link stays visible on a phone');
  await shot(page, 'main-mobile');
  await page.setViewportSize({ width: 1360, height: 900 });

  // ------------------------------------------------------------------ theory page
  await page.goto(`${base}/transform_lab/teoria.html?lang=pt`);
  await page.waitForSelector('.katex'); await page.waitForTimeout(300);
  assert.equal(await page.$$eval('.katex-error', e => e.length), 0, 'no KaTeX errors');
  assert.ok((await page.$$eval('.katex', e => e.length)) > 80, 'math rendered');
  assert.ok(await page.isVisible('h2#s6 .pt') && !(await page.isVisible('h2#s6 .en')));
  await page.click('[data-lang="en"]');
  assert.ok(await page.isVisible('h2#s6 .en') && !(await page.isVisible('h2#s6 .pt')));
  assert.equal(await page.$$eval('.katex-error', e => e.length), 0);
  assert.match(await page.getAttribute('a.portal', 'href'), /lang=en/);
  assert.match(await page.getAttribute('a[data-page="index.html"]', 'href'), /^index\.html\?lang=en$/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'theory overflow');
  await shot(page, 'theory');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'theory page overflows at 390 px');
  await page.setViewportSize({ width: 1360, height: 900 });

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
  // the dialog opens and edits configuration B
  await page.click('#editB'); assert.ok(await page.isVisible('#dlgB'));
  await page.selectOption('#formB [data-path="rotation"]', 'matrix'); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__cmp.b.rotation), 'matrix');
  await page.click('#dlgB .dlg-foot [data-close]'); assert.ok(!(await page.isVisible('#dlgB')));
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
