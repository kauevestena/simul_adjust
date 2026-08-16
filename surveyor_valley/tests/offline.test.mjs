// The offline guarantee.
//
// PixiJS comes from a CDN, which is the one thing that could stop this game
// working in the classroom it was written for. The mitigation is a service
// worker that caches everything on first load — and a mitigation nobody checks
// is not a mitigation.
//
// The failure this catches is silent and nasty: a service worker only sees
// requests made after it takes control, so the module imports issued during the
// very first page load never pass through it. Precache the entry point alone
// and the second, offline visit gets a styled shell, a working renderer, and no
// game at all — with no error anywhere. Adding a module and forgetting the list
// reproduces exactly that, months later, on somebody else's machine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

/** The `CORE` array's string literals, in order. */
function precached() {
  const start = sw.indexOf('const CORE = [');
  assert.ok(start > 0, 'sw.js must declare a CORE precache list');
  const end = sw.indexOf('];', start);
  return [...sw.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

test('every shipped module and stylesheet is precached for offline use', () => {
  const listed = new Set(precached().map((p) => p.replace(/^\.\//, '')));

  const onDisk = [
    'index.html',
    ...walk('src').filter((f) => f.endsWith('.js')),
    ...walk('styles').filter((f) => f.endsWith('.css')),
  ];

  const missing = onDisk.filter((f) => !listed.has(f));
  assert.deepEqual(
    missing,
    [],
    `these files ship but would not be available offline — add them to CORE in sw.js:\n  ${missing.join('\n  ')}`,
  );

  // And nothing listed that no longer exists, which would make `install` retry
  // a 404 on every visit.
  const real = new Set(onDisk);
  const stale = [...listed].filter((f) => f !== '' && f !== 'index.html' && !real.has(f));
  assert.deepEqual(stale, [], `CORE lists files that are gone: ${stale.join(', ')}`);
});

test('the Pixi pin, its integrity hash and the cached URL all agree', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const loader = readFileSync(join(ROOT, 'src/render/pixi.js'), 'utf8');

  const urlIn = (text) => (text.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/pixi\.js@[^'"\s]+/) || [])[0];
  const htmlUrl = urlIn(html);
  const swUrl = urlIn(sw);
  const loaderVersion = (loader.match(/PIXI_VERSION = '([^']+)'/) || [])[1];

  assert.ok(htmlUrl, 'index.html must preload the Pixi bundle');
  assert.equal(swUrl, htmlUrl, 'the service worker must cache the exact URL the page loads');
  assert.ok(htmlUrl.includes(`@${loaderVersion}/`), `pixi.js version pin disagrees: html=${htmlUrl}, loader=${loaderVersion}`);

  // Subresource Integrity only applies through the modulepreload; a dynamic
  // import cannot carry it. Losing the attribute silently drops the check.
  assert.match(html, /rel="modulepreload"/, 'the preload is what applies SRI — do not remove it');
  assert.match(html, /integrity="sha384-[A-Za-z0-9+/=]+"/, 'the Pixi preload must carry an SRI hash');
  assert.match(html, /crossorigin="anonymous"/, 'SRI on a cross-origin preload requires crossorigin');

  // A floating range cannot be pinned by a hash.
  assert.match(htmlUrl, /@\d+\.\d+\.\d+\//, 'pin an exact version, never a range');
});
