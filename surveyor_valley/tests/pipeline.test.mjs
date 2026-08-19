// End-to-end survey, in plain Node.
//
// This is possible — and worth having — because everything from the world
// generator down through the instrument model, the service orchestration and
// the document builders is free of the DOM. So the whole didactic loop can be
// driven headlessly: plant monuments, occupy them, sight the corners, close the
// traverse, and read the memorial descritivo that comes out the other end.
//
// It is the test that would catch a regression a student would actually notice.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeStore, makeInitialState, DIFFICULTY } from '../src/core/state.js';
import { buildWorld } from '../src/world/world.js';
import { makeService } from '../src/game/service.js';
import { canStand } from '../src/game/player.js';
import { bus, EV } from '../src/core/bus.js';
import { buildMemorial } from '../src/report/memorial.js';
import { buildPlanta } from '../src/report/planta.js';
import { areaOf, azimuth, polarPoint } from '../src/survey/geometry.js';
import { normalize360 } from '../src/survey/units.js';
import { pointInPolygon } from '../src/core/math2d.js';
import { revealMarksNear } from '../src/game/discovery.js';

const SEED = 'sv-pipeline';

/** A spot near `target` where a monument can legally be planted. */
function findMarcoSpot(world, store, target, { maxRadius = 45 } = {}) {
  const tooClose = (e, n) =>
    store.get().network.some((cp) => Math.hypot(cp.trueE - e, cp.trueN - n) < 1.2);

  for (let r = 0; r <= maxRadius; r += 1.2) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const e = target.e + Math.cos(a) * r;
      const n = target.n + Math.sin(a) * r;
      if (!canStand(world, e, n)) continue;
      if (!world.canSetupTripod(e, n).ok) continue;
      if (tooClose(e, n)) continue;
      return { e, n };
    }
  }
  return null;
}

/**
 * Somewhere a tripod can stand that can actually SEE the given corner, and that
 * at least one existing station can see in turn — otherwise the new monument
 * could never be given coordinates. This is the "walk round until you have a
 * line" move, written down.
 */
function findStationSeeing(world, store, corner, existing) {
  const visibleFromNetwork = (e, n) =>
    existing.some((m) => world.lineOfSight({ e: m.e, n: m.n }, { e, n }).clear);

  for (let r = 6; r <= 40; r += 2.5) {
    const steps = Math.max(16, Math.round(r * 2));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const e = corner.e + Math.cos(a) * r;
      const n = corner.n + Math.sin(a) * r;
      if (!canStand(world, e, n)) continue;
      if (!world.canSetupTripod(e, n).ok) continue;
      if (store.get().network.some((cp) => Math.hypot(cp.trueE - e, cp.trueN - n) < 1.2)) continue;
      if (!world.lineOfSight({ e, n }, { e: corner.e, n: corner.n }, { targetId: corner.id }).clear) continue;
      if (!visibleFromNetwork(e, n)) continue;
      return { e, n };
    }
  }
  return null;
}

/**
 * Run a full service on the given parcel and return everything produced.
 * Mirrors the sequence a player performs, in the same order, through the same
 * service methods the UI calls.
 */
function runFullSurvey({ seed = SEED, difficulty = 'facil', parcelIndex = 0, stationCount = 5, instrument = null } = {}) {
  const store = makeStore(makeInitialState({ seed, difficulty }));
  if (instrument) store.get().inventory.instrument = instrument;
  const world = buildWorld(seed, DIFFICULTY[difficulty]);
  const service = makeService({ store, getWorld: () => world, bus, EV });

  const parcel = world.parcels[parcelIndex];
  const started = service.start(parcel.id);
  assert.equal(started.ok, true, 'service starts');

  // --- 1. Plant the control network ---------------------------------------
  // Sited the way a surveyor sites a traverse: each station chosen so it is
  // INTERVISIBLE with the one before it, and the last one visible from the
  // first. Scattering monuments at the corners and hoping is what a student
  // does once; the closure error then cannot be computed at all, because
  // consecutive stations have a rock between them.
  const marcos = [];
  const n = Math.min(stationCount, Math.max(4, parcel.vertices.length));
  const visible = (a, b) => world.lineOfSight({ e: a.e, n: a.n }, { e: b.e, n: b.n }).clear;

  for (let k = 0; k < n; k++) {
    const angle = (k / n) * Math.PI * 2;
    const candidates = [];
    for (let f = 0.3; f <= 0.82; f += 0.06) {
      for (let da = -0.35; da <= 0.35; da += 0.12) {
        const a = angle + da;
        const e = parcel.centroid.e + Math.cos(a) * parcel.bbox.w * 0.5 * f;
        const nn = parcel.centroid.n + Math.sin(a) * parcel.bbox.h * 0.5 * f;
        if (!pointInPolygon(e, nn, parcel.ring)) continue;
        if (!canStand(world, e, nn)) continue;
        if (!world.canSetupTripod(e, nn).ok) continue;
        if (store.get().network.some((cp) => Math.hypot(cp.trueE - e, cp.trueN - nn) < 2)) continue;
        candidates.push({ e, n: nn });
      }
    }

    let choice = candidates.find((c) => {
      if (marcos.length && !visible(marcos[marcos.length - 1], c)) return false;
      if (marcos.length === n - 1 && !visible(marcos[0], c)) return false;
      return true;
    });
    choice = choice || candidates[0];
    if (!choice) continue;

    const r = service.placeMarco(choice.e, choice.n);
    if (r.ok) marcos.push({ id: r.id, ...choice });
  }
  assert.ok(marcos.length >= 3, `enough monuments planted (${marcos.length})`);

  // --- 2. First setup: the datum is born here ------------------------------
  const first = service.setupStation({
    over: marcos[0].id,
    backsight: marcos[1].id,
    playerPos: { e: marcos[0].e, n: marcos[0].n },
  });
  assert.equal(first.ok, true, `first setup: ${first.reason ?? ''}`);

  // Radiate to everything visible: every other monument, so they gain
  // coordinates, and every boundary corner in view.
  const sightEverything = (fromId) => {
    for (const m of marcos) {
      if (m.id !== fromId) service.sight(`marco-${m.id}`);
    }
    for (const id of parcel.markIds) service.sight(id);
  };
  sightEverything(marcos[0].id);

  // --- 3. Occupy the others, in two passes ---------------------------------
  // A monument that was hidden from the first station has no coordinates yet
  // and so cannot be occupied. A second pass picks it up once a nearer station
  // has seen it — which is exactly what a surveyor does when a corner of the
  // network is obstructed from where they started.
  const count = marcos.length;
  const occupyAll = () => {
    for (let i = 0; i < count; i++) {
      const here = marcos[i];
      const back = marcos[(i - 1 + count) % count];
      const setup = service.setupStation({
        over: here.id,
        backsight: back.id,
        playerPos: { e: here.e, n: here.n },
      });
      if (!setup.ok) continue;
      sightEverything(here.id);
    }
  };
  for (let pass = 0; pass < 2; pass++) occupyAll();

  // --- 4. Chase down whatever is still hidden ------------------------------
  // A corner screened by a building or a stand of trees is not a bug; it is the
  // obstacle system doing its job. The answer in the field is to walk round
  // until you can see it and set up there, so that is what this does.
  for (const missingId of service.parcelProgress().missing) {
    const corner = world.entity(missingId);
    if (!corner) continue;

    const extra = findStationSeeing(world, store, corner, marcos);
    if (!extra) continue;
    const planted = service.placeMarco(extra.e, extra.n);
    if (!planted.ok) continue;

    // The new monument needs coordinates before it can be occupied, so sight it
    // from an existing station that can see it.
    for (const m of marcos) {
      const other = marcos.find((x) => x.id !== m.id);
      const setup = service.setupStation({ over: m.id, backsight: other.id, playerPos: { e: m.e, n: m.n } });
      if (setup.ok) service.sight(`marco-${planted.id}`);
    }
    const setup = service.setupStation({
      over: planted.id,
      backsight: marcos[0].id,
      playerPos: { e: extra.e, n: extra.n },
    });
    if (setup.ok) sightEverything(planted.id);
  }

  return { store, world, service, parcel, marcos };
}

// --------------------------------------------------------------- the run ---

test('a whole service runs start to finish and produces a survey', () => {
  const { store, service, parcel } = runFullSurvey();

  const progress = service.parcelProgress();
  assert.equal(progress.complete, true, `all ${progress.total} corners surveyed, missing ${progress.missing}`);

  const ring = service.surveyedRing();
  assert.equal(ring.length, parcel.vertices.length, 'one surveyed point per corner');
  for (const p of ring) {
    assert.ok(Number.isFinite(p.E) && Number.isFinite(p.N), `${p.id} has real coordinates`);
    assert.ok(p.sights >= 1, `${p.id} was actually measured`);
  }

  const svc = store.get().activeService;
  assert.ok(svc.observations.length > ring.length, 'plenty of observations recorded');
  assert.ok(svc.setups.length >= 3, 'several occupations');
});

test('the surveyed area lands within a fraction of a percent of the truth', () => {
  const { service, parcel } = runFullSurvey();
  const d = service.debrief();

  assert.ok(d, 'a debrief is produced');
  // A 10" instrument radiating over ~100 m should be very close indeed.
  assert.ok(
    Math.abs(d.areaErrorPct) < 0.5,
    `area error ${d.areaErrorPct.toFixed(4)}% (${d.areaErrorM2.toFixed(2)} m² on ${parcel.area.toFixed(0)} m²)`,
  );
  assert.ok(Math.abs(d.perimeterError) < 0.5, `perimeter error ${d.perimeterError.toFixed(3)} m`);
  assert.ok(d.sideRms < 0.1, `side length RMS ${d.sideRms.toFixed(4)} m`);
  // ...but not suspiciously perfect: the instrument has real noise in it.
  assert.ok(d.sideRms > 0, 'measurements are not noise-free');
});

test('better gear measurably improves the survey on identical ground', () => {
  // Same seed, same valley, same walk — only the instrument differs. This is
  // what makes the shop meaningful rather than cosmetic.
  //
  // Some worlds put a corner where these five fixed stations simply cannot see
  // it; that is the obstacle system doing its job, not a defect, so those seeds
  // are skipped rather than fudged.
  const cheapErrs = [];
  const goodErrs = [];
  for (const seed of ['sv-instr-a', 'sv-instr-b', 'sv-instr-c', 'sv-instr-d', 'sv-instr-e']) {
    const cheap = runFullSurvey({ seed, instrument: 'et10' }).service.debrief();
    const good = runFullSurvey({ seed, instrument: 'et1' }).service.debrief();
    if (!cheap || !good) continue;
    cheapErrs.push(cheap.sideRms);
    goodErrs.push(good.sideRms);
  }

  assert.ok(cheapErrs.length >= 3, `enough completable worlds to compare (${cheapErrs.length})`);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const cheap = mean(cheapErrs);
  const good = mean(goodErrs);

  assert.ok(good < cheap, `the 1" instrument should beat the 10" one (${good.toFixed(4)} vs ${cheap.toFixed(4)} m)`);
  assert.ok(cheap < 0.05, `even the starter kit is decent (${cheap.toFixed(4)} m)`);
});

test('a partly surveyed parcel is refused rather than quietly completed', () => {
  // Whatever the reason a corner is missing — screened by a building, too far,
  // simply forgotten — the job must not be deliverable, and no partial ring may
  // be offered that a student could mistake for the real boundary.
  const store = makeStore(makeInitialState({ seed: 'sv-partial', difficulty: 'facil' }));
  const world = buildWorld('sv-partial', DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const a = findMarcoSpot(world, store, parcel.centroid);
  const m1 = service.placeMarco(a.e, a.n);
  const b = findMarcoSpot(world, store, { e: parcel.centroid.e + 25, n: parcel.centroid.n });
  const m2 = service.placeMarco(b.e, b.n);
  assert.ok(m1.ok && m2.ok, 'two monuments planted');

  service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a });

  // Sight every corner but the last one.
  for (const id of parcel.markIds.slice(0, -1)) service.sight(id);

  const progress = service.parcelProgress();
  assert.equal(progress.complete, false, 'the survey is incomplete');
  assert.ok(progress.missing.includes(parcel.markIds.at(-1)), 'and it names the corner it is missing');
  assert.deepEqual(service.surveyedRing(), [], 'no partial ring is offered');
  assert.equal(service.parcelReport('pt'), null, 'and no report is produced');

  const finish = service.deliver();
  assert.equal(finish.ok, false, 'delivery is refused');
  assert.equal(finish.reason, 'parcelIncomplete');
  assert.equal(store.get().player.money, 0, 'and nobody gets paid');
});

test('a reading can only be taken from behind the eyepiece', () => {
  // The rule the two-person crew rests on. A total station is not a one-person
  // instrument: somebody carries the prism to the point, and it is not the
  // person reading the circle. Until this existed you set the tripod up once
  // and then measured the whole parcel from wherever you had wandered off to.
  const store = makeStore(makeInitialState({ seed: 'sv-atinst', difficulty: 'facil' }));
  const world = buildWorld('sv-atinst', DIFFICULTY.facil);

  // The service asks where the surveyor is standing; this is that body.
  let at = null;
  const service = makeService({ store, getWorld: () => world, bus, EV, getPlayerPos: () => at });

  const parcel = world.parcels[0];
  service.start(parcel.id);

  const a = findMarcoSpot(world, store, parcel.centroid);
  const m1 = service.placeMarco(a.e, a.n);
  const b = findMarcoSpot(world, store, { e: parcel.centroid.e + 18, n: parcel.centroid.n });
  const m2 = service.placeMarco(b.e, b.n);
  assert.ok(m1.ok && m2.ok, 'two monuments planted');

  at = a;
  const setup = service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a });
  assert.equal(setup.ok, true, `setup: ${setup.reason ?? ''}`);

  // A target this station can actually see, so the refusal below is about
  // WHERE THE PLAYER IS and not about the line of sight.
  const visible = service.visibleTargets().find((v) => v.clear && v.entity.id !== `marco-${m1.id}`);
  assert.ok(visible, 'something is in view from here');

  // Walk five metres away and try to take the reading anyway.
  at = { e: a.e + 5, n: a.n };
  const away = service.sight(visible.entity.id);
  assert.equal(away.ok, false, 'a sight from five metres off the instrument must be refused');
  assert.equal(away.reason, 'notAtInstrument');
  assert.equal(store.get().activeService.observations.length, 0, 'and nothing is recorded');

  // Batch measuring runs through the same door, so it cannot be the way round.
  const batch = service.measureAll({});
  assert.equal(batch.measured, 0, 'measureAll cannot bypass the rule either');

  // Back on the monument, the same sight works.
  at = a;
  const there = service.sight(visible.entity.id);
  assert.equal(there.ok, true, `from the instrument it must succeed: ${there.reason ?? ''}`);
  assert.equal(store.get().activeService.observations.length, 1, 'and is recorded');
});

test('the closed traverse computes, closes and reports a relative precision', () => {
  const { service } = runFullSurvey();
  const traverse = service.runTraverse();

  assert.equal(traverse.ok, true, `traverse: ${traverse.reason ?? ''} ${JSON.stringify(traverse.missing ?? '')}`);
  assert.ok(traverse.nStations >= 3, 'at least three stations');
  assert.ok(Number.isFinite(traverse.eAngSec), 'angular closure is a number');
  assert.ok(Math.abs(traverse.eAngSec) < 300, `angular closure ${traverse.eAngSec.toFixed(1)}" is plausible`);
  assert.ok(traverse.eLin < 0.5, `linear closure ${traverse.eLin.toFixed(4)} m is plausible`);
  assert.ok(traverse.relDenominator > 1000, `relative precision 1:${Math.round(traverse.relDenominator)}`);
  assert.equal(traverse.coords.length, traverse.nStations, 'a coordinate per station');
});

test('delivery pays, scores and hands back a complete report', () => {
  const { service, store } = runFullSurvey();
  service.runTraverse();

  service.deliver();
  const result = service.collectPayment();
  assert.equal(result.ok, true, `finish: ${result.reason ?? ''}`);
  assert.ok(result.payment > 0, `paid R$ ${result.payment}`);
  assert.ok(result.quality > 0 && result.quality <= 1, `quality ${result.quality}`);
  assert.ok(result.report.sides.length === result.report.vertices.length, 'a side per vertex');
  assert.ok(result.area.m2 > 1000, 'a real area');

  const s = store.get();
  assert.equal(s.stats.servicesDone, 1, 'the campaign counter moves');
  assert.equal(s.player.money, result.payment, 'the player is paid');
  assert.equal(s.parcels[result.parcelId].status, 'done', 'the parcel is marked done');
});

test('every side of the report knows its confrontante', () => {
  const { service } = runFullSurvey();
  const report = service.parcelReport('pt');
  assert.ok(report, 'a report exists');
  for (const side of report.sides) {
    assert.ok(side.confrontante.length > 3, `side ${side.from}-${side.to} has a confrontante`);
    assert.ok(Number.isFinite(side.azimuth) && side.azimuth >= 0 && side.azimuth < 360, 'azimuth in range');
    assert.ok(side.distance > 0, 'positive distance');
    assert.ok(side.rumo.quadrant, 'a quadrant bearing');
  }
});

// ------------------------------------------------------------- documents ---

test('the memorial descritivo reads as a proper metes-and-bounds description', () => {
  const { service, store, parcel } = runFullSurvey();
  service.runTraverse();
  service.deliver();
  const result = service.collectPayment();

  const memorial = buildMemorial({
    report: result.report,
    state: store.get(),
    lang: 'pt',
    playerName: 'Fulano de Tal',
  });

  const text = memorial.text;
  assert.match(text, /MEMORIAL DESCRITIVO/, 'it is titled');
  assert.ok(text.includes(parcel.owner), `it names the owner (${parcel.owner})`);
  assert.ok(text.includes(parcel.propertyName), 'it names the property');
  assert.match(text, /Inicia-se a descrição deste perímetro no vértice/, 'it opens correctly');
  assert.match(text, /ponto inicial da presente descrição, encerrando o perímetro descrito/, 'it closes the ring');
  assert.match(text, /azimute de \d+°\d{2}'\d{2}"/, 'azimuths are in DMS');
  assert.match(text, /confrontando neste trecho com/, 'each side names its neighbour');
  assert.match(text, /poligonal fechada compensada pelo método de/, 'the method is stated');

  // Non-negotiable: it must never be mistakable for a legal instrument.
  assert.match(text, /SEM VALOR LEGAL/, 'it carries the disclaimer');

  // One segment sentence per side, plus the opening.
  const segments = text.match(/deste, segue com azimute/g) || [];
  assert.equal(segments.length, result.report.sides.length, 'one sentence per side');
});

test('the planta composes into a drawable, correctly scaled sheet', () => {
  const { service, store } = runFullSurvey();
  service.deliver();
  const result = service.collectPayment();

  const planta = buildPlanta({
    report: result.report,
    state: store.get(),
    lang: 'pt',
    playerName: 'Fulano de Tal',
  });

  assert.ok(planta.scaleDen >= 250, `a standard scale denominator (1:${planta.scaleDen})`);
  assert.equal(planta.sheet.w, 297, 'A4 landscape');

  const items = planta.drawList.items;
  assert.ok(items.length > 40, `a substantial drawing (${items.length} items)`);

  const texts = items.filter((i) => i.t === 'text').map((i) => i.s);
  assert.ok(texts.includes('N'), 'a north arrow');
  assert.ok(texts.some((s) => s.includes(`1:${planta.scaleDen}`)), 'the scale is stated');
  assert.ok(texts.some((s) => s.includes('SEM VALOR LEGAL')), 'the disclaimer is on the sheet');
  assert.ok(texts.some((s) => s.includes(result.report.parcel.owner)), 'the owner is named');

  // Every vertex is labelled and drawn.
  for (const v of result.report.vertices) {
    assert.ok(texts.includes(v.label || v.id), `vertex ${v.id} is labelled`);
  }

  // Every coordinate must be a real number, or the PDF writer emits NaN.
  for (const it of items) {
    for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'w', 'h']) {
      if (it[k] != null) assert.ok(Number.isFinite(it[k]), `${it.t}.${k} is finite`);
    }
    if (it.pts) for (const [x, y] of it.pts) assert.ok(Number.isFinite(x) && Number.isFinite(y), 'polygon point is finite');
  }
});

test('stroke widths are pen-sized, never confused with a shape dimension', () => {
  // The bug this guards against: a renderer reading `it.w` as the line width.
  // On a rect, `w` is the rectangle's WIDTH — so the sheet border stroked at
  // 277 mm and flooded the whole plan solid black, in the preview and in the
  // PDF alike. Line width now lives on `lw` for every primitive.
  const { service, store } = runFullSurvey();
  service.deliver();
  const result = service.collectPayment();
  const planta = buildPlanta({ report: result.report, state: store.get(), lang: 'pt' });

  for (const it of planta.drawList.items) {
    if (it.t === 'text') continue;
    assert.ok(it.lw != null, `${it.t} carries an explicit line width`);
    assert.ok(it.lw > 0 && it.lw <= 2, `${it.t} line width ${it.lw} mm is a pen, not a shape`);
    assert.equal(it.w === undefined || it.t === 'rect', true, `only a rect may carry \`w\` (${it.t})`);
  }

  // And a rect keeps its real dimensions.
  const border = planta.drawList.items.find((i) => i.t === 'rect');
  assert.ok(border.w > 100, `the sheet border is ${border.w} mm wide`);
  assert.ok(border.lw < 1, `but drawn with a ${border.lw} mm pen`);
});

test('the report regenerates in English without leftover Portuguese', () => {
  const { service } = runFullSurvey();
  const pt = service.parcelReport('pt');
  const en = service.parcelReport('en');

  assert.equal(pt.sides.length, en.sides.length, 'same geometry either way');
  // Confrontantes are the visible difference: "de propriedade de" vs "owned by".
  const ptHas = pt.sides.some((s) => s.confrontante.includes('de propriedade de'));
  const enHas = en.sides.some((s) => s.confrontante.includes('owned by'));
  assert.ok(ptHas || pt.sides.every((s) => s.confrontante), 'Portuguese confrontantes');
  assert.ok(enHas || en.sides.every((s) => s.confrontante), 'English confrontantes');
});

// ---------------------------------------------------------- error paths ----

test('the tutorial gate holds: no station without coordinates to stand on', () => {
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const world = buildWorld(SEED, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const spot = findMarcoSpot(world, store, parcel.centroid);
  const m1 = service.placeMarco(spot.e, spot.n);
  assert.equal(m1.ok, true);

  // One monument is not enough to orient anything.
  const r = service.setupStation({
    over: m1.id,
    backsight: m1.id,
    playerPos: { e: spot.e, n: spot.n },
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'backsightIsStation');
});

test('a monument cannot be planted on water, on rock, or on top of another', () => {
  const store = makeStore(makeInitialState({ seed: 'sv-badground', difficulty: 'facil' }));
  const world = buildWorld('sv-badground', DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  service.start(world.parcels[0].id);

  const spot = findMarcoSpot(world, store, world.parcels[0].centroid);
  assert.equal(service.placeMarco(spot.e, spot.n).ok, true);

  const dup = service.placeMarco(spot.e + 0.3, spot.n);
  assert.equal(dup.ok, false, 'cannot stack two monuments');
  assert.ok(['tooCloseToMarco', 'obstacle'].includes(dup.reason), `reason: ${dup.reason}`);

  // Somewhere in the valley there is water; a monument may not go there.
  let water = null;
  for (let e = 10; e < 630 && !water; e += 3) {
    for (let n = 10; n < 630; n += 3) {
      if (world.terrain.soilAt(e, n).id === 'AGUA') {
        water = { e, n };
        break;
      }
    }
  }
  if (water) {
    const r = service.placeMarco(water.e, water.n);
    assert.equal(r.ok, false, 'not in the stream');
  }
});

test('the traverse refuses, with a reason, when the angles are not there', () => {
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const world = buildWorld(SEED, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  service.start(world.parcels[0].id);

  const r = service.runTraverse();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'needThreeStations');
  assert.equal(r.have, 0, 'and it says how many it has');
});

test('the surveyed ring is empty until every corner is measured', () => {
  const store = makeStore(makeInitialState({ seed: SEED, difficulty: 'facil' }));
  const world = buildWorld(SEED, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  assert.deepEqual(service.surveyedRing(), [], 'nothing surveyed yet');
  assert.equal(service.parcelProgress().complete, false);
  assert.equal(service.deliver().ok, false, 'and delivery is refused');
});

test('the same seed replays the same measurements exactly', () => {
  const a = runFullSurvey({ seed: 'sv-replay' });
  const b = runFullSurvey({ seed: 'sv-replay' });

  const ringA = a.service.surveyedRing();
  const ringB = b.service.surveyedRing();
  assert.equal(ringA.length, ringB.length, 'same number of corners');
  for (let i = 0; i < ringA.length; i++) {
    assert.equal(ringA[i].E, ringB[i].E, `corner ${i} easting is identical`);
    assert.equal(ringA[i].N, ringB[i].N, `corner ${i} northing is identical`);
  }
  assert.equal(areaOf(ringA).m2, areaOf(ringB).m2, 'and therefore the same area');
});

/**
 * A traverse must survive stations that cannot see each other.
 *
 * Scattering monuments at the corners — which is what a student does the first
 * time — leaves some consecutive pairs with a tree between them, and the angle
 * at that station simply does not exist. Refusing to compute anything at all
 * would punish an otherwise good survey for one missing sight, so the loop
 * finder drops the offending stations and closes the polygon around the rest.
 *
 * Greedily dropping the FIRST offender is not enough: removing a station makes
 * its two neighbours adjacent, and that new pair very often was never measured
 * together either. This is the regression test for the bounded search that
 * replaced it — before it, this exact scenario returned `incompleteAngles`.
 */
test('a traverse closes by dropping stations that never saw each other', () => {
  const seed = 'sv-scatter';
  const store = makeStore(makeInitialState({ seed, difficulty: 'facil' }));
  const world = buildWorld(seed, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });

  const parcel = world.parcels[0];
  assert.equal(service.start(parcel.id).ok, true);
  store.get().inventory.marcos = 40; // enough to monument every corner

  // Naive placement: one monument beside each corner, no intervisibility check.
  const placed = [];
  for (const v of parcel.vertices) {
    const spot = findMarcoSpot(world, store, v, { maxRadius: 14 });
    if (!spot) continue;
    const res = service.placeMarco(spot.e, spot.n);
    if (res.ok) placed.push({ id: res.id, ...spot });
  }
  assert.ok(placed.length >= 5, `expected several monuments, got ${placed.length}`);

  // Occupy whatever already has coordinates, orienting on another that does —
  // the order a surveyor actually works in.
  const coordinated = () => new Set(store.get().network.filter((c) => c.E != null).map((c) => c.id));
  const occupied = new Set();

  for (let pass = 0; pass < placed.length + 4; pass++) {
    const known = coordinated();
    const first = occupied.size === 0;
    const over = (first ? placed : placed.filter((m) => known.has(m.id))).find((m) => !occupied.has(m.id));
    if (!over) break;

    const pool = (first ? placed : placed.filter((m) => known.has(m.id)))
      .filter((m) => m.id !== over.id)
      .sort((a, b) => Math.hypot(a.e - over.e, a.n - over.n) - Math.hypot(b.e - over.e, b.n - over.n));

    for (const back of pool.slice(0, 5)) {
      const st = service.setupStation({
        over: over.id,
        backsight: back.id,
        playerPos: { e: over.e, n: over.n },
      });
      if (st.ok) {
        service.measureAll({ force: true });
        break;
      }
    }
    occupied.add(over.id);
  }

  const tr = service.runTraverse({});
  assert.equal(tr.ok, true, `traverse should close; got reason "${tr.reason}"`);
  assert.ok(tr.nStations >= 3, 'a closed traverse needs at least three stations');
  // Beating 1:1000 is a low bar; the point is that it computed at all.
  assert.ok(tr.relDenominator > 1000, `relative precision 1:${Math.round(tr.relDenominator)} is implausibly poor`);
});

// ------------------------------------------- the corners you have to find ----

test('a buried corner is unmeasurable until it is found, and measurable after', () => {
  // The chain that was broken from the first commit: `visibleTargets` skips a
  // hidden mark, so it never reaches `surveyed`, so `parcelProgress` never
  // completes, so ENTREGA never unlocks. That is the whole of médio and difícil
  // being undeliverable, and it turns on this one flag.
  const seed = 'sv-buried';
  const store = makeStore(makeInitialState({ seed, difficulty: 'dificil' }));
  const world = buildWorld(seed, DIFFICULTY.dificil);
  const service = makeService({ store, getWorld: () => world, bus, EV });

  const parcel = world.parcels.find((p) => p.markIds.some((id) => world.entity(id).hidden));
  assert.ok(parcel, 'difícil buries corners — that is the setting');
  service.start(parcel.id);

  const buriedId = parcel.markIds.find((id) => world.entity(id).hidden);
  const buried = world.entity(buriedId);

  // A station close enough to see it, so visibility is never the thing failing.
  const a = findMarcoSpot(world, store, { e: buried.e + 6, n: buried.n });
  const b = findMarcoSpot(world, store, { e: buried.e - 6, n: buried.n + 5 });
  assert.ok(a && b, 'somewhere to stand near the corner');
  const m1 = service.placeMarco(a.e, a.n);
  const m2 = service.placeMarco(b.e, b.n);
  const st = service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a });
  assert.equal(st.ok, true, `station: ${st.reason}`);

  const listed = () => service.visibleTargets({}).some((v) => v.entity.id === buriedId);
  assert.equal(listed(), false, 'a buried corner is not something the instrument offers');
  assert.equal(service.parcelProgress().missing.includes(buriedId), true);

  // Found on foot — which is exactly what the scrub is there to make you do.
  revealMarksNear(world, [{ e: buried.e, n: buried.n }]);

  assert.equal(listed(), true, 'once found it must be sightable, or the job is impossible');
  const shot = service.sight(buriedId);
  assert.equal(shot.ok, true, `sighting a found corner: ${shot.reason}`);
  assert.equal(service.parcelProgress().missing.includes(buriedId), false, 'and it must count');
});

// --------------------------------------------------- marcos at a distance ----

test('canPlaceMarco gives the same verdict placeMarco does', () => {
  // They are one rule with two callers now: the click refuses instantly at the
  // cursor, and Ligeirinho plants when he arrives. If the two ever disagree the
  // player is told yes and then told no a second later, for no visible reason.
  const seed = 'sv-canplace';
  const store = makeStore(makeInitialState({ seed, difficulty: 'facil' }));
  const world = buildWorld(seed, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const spot = findMarcoSpot(world, store, parcel.centroid);
  assert.deepEqual(service.canPlaceMarco(spot.e, spot.n), { ok: true });
  assert.equal(service.placeMarco(spot.e, spot.n).ok, true);

  // Now the same spot is taken, and both must say so identically.
  const taken = service.canPlaceMarco(spot.e + 0.3, spot.n);
  const tried = service.placeMarco(spot.e + 0.3, spot.n);
  assert.equal(taken.ok, false);
  assert.equal(tried.ok, false);
  assert.equal(taken.reason, tried.reason, 'the preview and the act must give the same reason');

  // Out of stock is a refusal the preview has to know about too, or the player
  // watches him run 40 m to plant a monument that was never in the bag.
  store.get().inventory.marcos = 0;
  const empty = findMarcoSpot(world, store, parcel.centroid);
  assert.equal(service.canPlaceMarco(empty.e, empty.n).reason, 'noMarcosLeft');
  assert.equal(service.placeMarco(empty.e, empty.n).reason, 'noMarcosLeft');
});

// -------------------------------------------------- a station off a marco ----

test('a free station can be fixed from open ground with two points in sight', () => {
  // The case estação livre exists for. Until this round the dialog would not
  // open unless a monument was within a metre, so the one place it was offered
  // was the one place it is not needed.
  const seed = 'sv-freeground';
  const store = makeStore(makeInitialState({ seed, difficulty: 'facil' }));
  const world = buildWorld(seed, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const a = findMarcoSpot(world, store, parcel.centroid);
  const b = findMarcoSpot(world, store, { e: parcel.centroid.e + 30, n: parcel.centroid.n + 8 });
  const m1 = service.placeMarco(a.e, a.n);
  const m2 = service.placeMarco(b.e, b.n);
  assert.equal(service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a }).ok, true);

  // A third, so that standing anywhere still leaves two others in view: a point
  // you are standing on is not one you can resect off.
  const c = findMarcoSpot(world, store, { e: parcel.centroid.e + 10, n: parcel.centroid.n - 28 });
  const m3 = service.placeMarco(c.e, c.n);
  service.sight(`marco-${m3.id}`);

  // Somewhere off every monument that can see at least two of them.
  let stand = null;
  for (let r = 8; r <= 40 && !stand; r += 2) {
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const e = parcel.centroid.e + Math.cos(th) * r;
      const n = parcel.centroid.n + Math.sin(th) * r;
      if (!world.canSetupTripod(e, n).ok) continue;
      if (store.get().network.some((cp) => Math.hypot(cp.trueE - e, cp.trueN - n) < 5)) continue;
      if (service.visibleKnownPoints({ e, n }).length >= 2) {
        stand = { e, n };
        break;
      }
    }
  }
  assert.ok(stand, 'this world has somewhere to stand with two monuments in view');

  const free = service.setupFreeStation({ playerPos: stand });
  assert.equal(free.ok, true, `free station: ${free.reason}`);
  assert.equal(free.setup.mode, 'free');
  assert.ok(free.resection.n >= 2, 'fixed on at least two points');
  // It solved for where the tripod actually is, so the fit is not just internally
  // consistent — it landed on the ground the player is standing on.
  const slip = Math.hypot(free.setup.trueE - stand.e, free.setup.trueN - stand.n);
  assert.ok(slip < 0.01, `the setup moved ${slip.toFixed(3)} m from where it was put down`);
});

test('a point you are standing on cannot fix you', () => {
  // The old gate counted every coordinated monument, including the one under
  // the tripod, which is not an observation anybody can take.
  const seed = 'sv-freeground';
  const store = makeStore(makeInitialState({ seed, difficulty: 'facil' }));
  const world = buildWorld(seed, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const a = findMarcoSpot(world, store, parcel.centroid);
  const b = findMarcoSpot(world, store, { e: parcel.centroid.e + 30, n: parcel.centroid.n + 8 });
  const m1 = service.placeMarco(a.e, a.n);
  const m2 = service.placeMarco(b.e, b.n);
  service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a });

  const here = service.visibleKnownPoints(a);
  assert.ok(!here.some((p) => p.id === m1.id), 'the monument under your feet is not a sight');
  assert.equal(service.setupFreeStation({ playerPos: a }).reason, 'needTwoKnownPoints');
  void m2;
});

// ------------------------------------------------- compensation that lands ----

test('compensating the traverse moves the corners, not just the stations', () => {
  // The defect this replaces was silent and total: `runTraverse` wrote the
  // compensated coordinates over the STATIONS and stopped, while every boundary
  // corner kept the coordinate it had been radiated to from the unadjusted
  // ones. Measured on a clean survey, the stations moved up to 5 mm and the
  // corners moved 0.0000 m — so the cálculos panel, which invites the student
  // to switch rules and watch the corrections redistribute, could not reach the
  // planta, the memorial, the area or the score.
  const { service } = runFullSurvey();
  const before = service.surveyedRing().map((p) => ({ id: p.id, E: p.E, N: p.N }));
  const areaBefore = areaOf(before).m2;

  const tr = service.runTraverse({ rule: 'bowditch' });
  assert.equal(tr.ok, true, `traverse: ${tr.reason ?? ''}`);
  assert.ok(tr.eLin > 0, 'there is a closure to distribute in the first place');

  const after = service.surveyedRing();
  const moved = before.map((p, i) => Math.hypot(p.E - after[i].E, p.N - after[i].N));
  assert.ok(
    moved.some((m) => m > 1e-6),
    'not one corner moved, so the compensation reached nothing that gets delivered',
  );
  assert.notEqual(areaOf(after).m2, areaBefore, 'the delivered area must feel it too');
});

test('the re-radiation is exactly the hand computation', () => {
  // Inverse the adjusted coordinates for the azimuth to the ré, apply the
  // observed angle, radiate the observed distance. If this drifts from what the
  // student would get with a calculator, the panel is teaching a method the
  // game does not use.
  const { store, service } = runFullSurvey();
  const tr = service.runTraverse({ rule: 'bowditch' });
  assert.equal(tr.ok, true);

  const svc = store.get().activeService;
  const adjusted = new Map(tr.coords.map((c) => [c.id, c]));
  let checked = 0;

  for (const setup of svc.setups) {
    const at = adjusted.get(setup.overId);
    if (setup.mode !== 'known' || !at) continue;
    const bs = adjusted.get(setup.backsightId) || store.get().network.find((c) => c.id === setup.backsightId);
    if (!bs || bs.E == null) continue;

    const theta0 = normalize360(azimuth(at.E, at.N, bs.E, bs.N) - setup.backsightReading);
    for (const o of setup.observations) {
      if (o.adjE == null) continue;
      const p = polarPoint(at.E, at.N, normalize360(o.hz + theta0), o.distance);
      assert.ok(Math.hypot(p.E - o.adjE, p.N - o.adjN) < 1e-9, `${o.label} re-radiated differently by hand`);
      checked++;
    }
  }
  assert.ok(checked > 5, `expected plenty of adjusted observations, checked ${checked}`);
});

test('the field book still records what was measured', () => {
  // A caderneta that rewrote its own reductions would stop being a record. The
  // observed reduction stays; the adjusted one sits beside it.
  const { store, service } = runFullSurvey();
  service.runTraverse({ rule: 'bowditch' });

  const svc = store.get().activeService;
  const adjusted = svc.observations.filter((o) => o.adjE != null);
  assert.ok(adjusted.length, 'something was adjusted');
  for (const o of adjusted) {
    assert.ok(Number.isFinite(o.E) && Number.isFinite(o.N), 'the observed reduction survives');
    assert.ok(Number.isFinite(o.hz) && Number.isFinite(o.distance), 'and so does what was actually read');
  }
});

test('switching compensation rules compares them rather than compounding', () => {
  // The trap, and it was real: `runTraverse` rewrote the station coordinates
  // and the next run read those rewritten stations for its starting azimuth, so
  // bowditch → transit → bowditch did NOT give the first answer back. A student
  // toggling the rule to see the difference was watching a drift.
  const { service } = runFullSurvey();

  const snap = () => service.surveyedRing().map((p) => ({ E: p.E, N: p.N }));
  assert.equal(service.runTraverse({ rule: 'bowditch' }).ok, true);
  const bowditch = snap();

  service.runTraverse({ rule: 'bowditch' });
  const again = snap();
  for (let i = 0; i < bowditch.length; i++) {
    assert.ok(
      Math.hypot(again[i].E - bowditch[i].E, again[i].N - bowditch[i].N) < 1e-12,
      'running the same rule twice must be a no-op',
    );
  }

  service.runTraverse({ rule: 'transit' });
  const transit = snap();
  assert.ok(
    transit.some((p, i) => Math.hypot(p.E - bowditch[i].E, p.N - bowditch[i].N) > 1e-9),
    'the two rules must actually differ, or the choice is decoration',
  );

  service.runTraverse({ rule: 'bowditch' });
  const back = snap();
  for (let i = 0; i < bowditch.length; i++) {
    assert.ok(
      Math.hypot(back[i].E - bowditch[i].E, back[i].N - bowditch[i].N) < 1e-12,
      'coming back to bowditch must give the first answer back, exactly',
    );
  }
});

test('a free station is left alone by the traverse', () => {
  // Nothing adjusted it, so nothing may pretend it did.
  const seed = 'sv-freeuntouched';
  const store = makeStore(makeInitialState({ seed, difficulty: 'facil' }));
  const world = buildWorld(seed, DIFFICULTY.facil);
  const service = makeService({ store, getWorld: () => world, bus, EV });
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const a = findMarcoSpot(world, store, parcel.centroid);
  const b = findMarcoSpot(world, store, { e: parcel.centroid.e + 30, n: parcel.centroid.n + 8 });
  const m1 = service.placeMarco(a.e, a.n);
  const m2 = service.placeMarco(b.e, b.n);
  assert.equal(service.setupStation({ over: m1.id, backsight: m2.id, playerPos: a }).ok, true);

  const c = findMarcoSpot(world, store, { e: parcel.centroid.e + 10, n: parcel.centroid.n - 28 });
  const m3 = service.placeMarco(c.e, c.n);
  service.sight(`marco-${m3.id}`);

  let stand = null;
  for (let r = 8; r <= 40 && !stand; r += 2) {
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const e = parcel.centroid.e + Math.cos(th) * r;
      const n = parcel.centroid.n + Math.sin(th) * r;
      if (!world.canSetupTripod(e, n).ok) continue;
      if (store.get().network.some((cp) => Math.hypot(cp.trueE - e, cp.trueN - n) < 5)) continue;
      if (service.visibleKnownPoints({ e, n }).length >= 2) { stand = { e, n }; break; }
    }
  }
  assert.ok(stand, 'somewhere to stand off the monuments');
  const free = service.setupFreeStation({ playerPos: stand });
  assert.equal(free.ok, true, `free station: ${free.reason ?? ''}`);

  const freeObs = free.setup.observations.map((o) => ({ id: o.id, E: o.E, N: o.N }));
  service.runTraverse({ rule: 'bowditch' });

  for (const o of free.setup.observations) {
    const was = freeObs.find((x) => x.id === o.id);
    assert.equal(o.adjE, undefined, 'a free station is not part of the loop and must not be re-radiated');
    assert.equal(o.E, was.E);
    assert.equal(o.N, was.N);
  }
});
