// Boot and wiring.
//
// Everything the UI can do goes through `api`, and `api` is also what the
// headless smoke test drives — so the test exercises production paths rather
// than a parallel set of hooks that can quietly rot.

import { bus, EV } from './core/bus.js';
import { makeLoop } from './core/loop.js';
import { makeStore, makeInitialState, DIFFICULTY } from './core/state.js';
import { storage } from './core/storage.js';
import { randomSeed, makeRng } from './core/rng.js';

import { buildWorld } from './world/world.js';

import { makeCamera } from './render/camera.js';
import { makeAtlas } from './render/atlas.js';
import { makeGroundBaker } from './render/groundbake.js';
import { makeOverlays } from './render/overlays.js';
import { makeScene } from './render/scene.js';
import { makeDisplay } from './render/display.js';
import { makePlanView } from './render/planview.js';
import { makeEffects } from './render/effects.js';
import { building } from './render/sprites/index.js';
import { lightAt } from './render/palette.js';
import { pixi } from './render/pixi.js';
import { makeAudio } from './audio/audio.js';

import { makePlayer, updatePlayer, interpolated, fastTravel, halt } from './game/player.js';
import { makeInput } from './game/input.js';
import { makeTools, TOOL, PANEL_TOOLS } from './game/tools.js';
import { makeTutorial } from './game/tutorial.js';
import { makeService } from './game/service.js';

import { initLanguage, applyI18n, t, setLanguage, lang, registerLanguage, setAngleFormat } from './ui/i18n.js';
import { makeModalHost } from './ui/modal.js';
import { makeNotifier } from './ui/notify.js';
import { showIntro } from './ui/intro.js';
import { makeHud } from './ui/hud.js';
import { makeToolbar } from './ui/toolbar.js';
import { renderCaderneta } from './ui/caderneta.js';
import { renderCalculos } from './ui/calculos.js';
import { showStationDialog } from './ui/stationdialog.js';
import { showParcelPicker, showCampaignEnd } from './ui/parcelpicker.js';
import { showShop } from './ui/shop.js';
import { el } from './ui/dom.js';

import { buildPlanta, buildPlantaTables } from './report/planta.js';
import { buildMemorial } from './report/memorial.js';
import { makeDocBlocks } from './report/docmodel.js';
import { drawListToCanvas, docBlocksToHtml, renderDebrief } from './report/reportview.js';
import { exportPDF, printFallback, downloadText } from './report/pdf.js';

import { areaOf } from './survey/geometry.js';
import { num } from './ui/i18n.js';
import { fmtDuration } from './survey/units.js';

// ---------------------------------------------------------------- context ---

const root = document.getElementById('app');
const canvas = document.getElementById('world');
const overlayCanvas = document.getElementById('overlay');

const store = makeStore(makeInitialState());
const camera = makeCamera();
const atlas = makeAtlas();
const overlays = makeOverlays({ camera });
const planView = makePlanView({ camera });
const audio = makeAudio();

let world = null;
let ground = null;
let display = null;
let scene = null;
let effects = null;
let player = makePlayer();
let input = null;
let hoverTarget = null;
let running = false;

const modals = makeModalHost(root);
const notifier = makeNotifier(root);

const service = makeService({ store, getWorld: () => world, bus, EV });

const tools = makeTools({
  bus,
  EV,
  getContext: () => {
    const s = store.get();
    const svc = s.activeService;
    return {
      world,
      service: svc,
      inventory: s.inventory,
      knownOrPlacedMarcos: s.network.length,
      station: service.currentSetup(),
      observationCount: svc?.observations.length ?? 0,
      setupCount: new Set((svc?.setups ?? []).map((x) => x.overId).filter(Boolean)).size,
      parcelSurveyed: service.parcelProgress().complete,
    };
  },
});

const tutorial = makeTutorial({
  bus,
  EV,
  getContext: () => {
    const s = store.get();
    const svc = s.activeService;
    return {
      service: svc,
      marcoCount: svc?.marcos.length ?? 0,
      setupCount: svc?.setups.length ?? 0,
      observationCount: svc?.observations.length ?? 0,
      manualSights: svc?.manualSights ?? 0,
      parcelSurveyed: service.parcelProgress().complete,
      traverse: svc?.traverse ?? null,
      servicesDone: s.stats.servicesDone,
    };
  },
});

const hud = makeHud(root, {
  onShop: () => openShop(),
  onJobs: () => nextJob(),
  onBatch: () => doMeasureAll(),
  onToggleSetting: (key) => toggleSetting(key),
  audio,
});
const toolbar = makeToolbar({ root, tools, onSelect: selectTool });

// ------------------------------------------------------------------- view ---

/** Everything the renderer and overlays need for one frame. */
function buildView(alpha = 1) {
  const s = store.get();
  const svc = s.activeService;
  const setup = service.currentSetup();
  const drawPlayer = interpolated(player, alpha);

  let tripodCheck = null;
  if (world && (tools.active === TOOL.MARCO || tools.active === TOOL.ESTACAO)) {
    tripodCheck = { e: player.e, n: player.n, check: world.canSetupTripod(player.e, player.n) };
  }

  let aim = null;
  if (setup && tools.active === TOOL.VISADA && hoverTarget) {
    aim = {
      target: hoverTarget,
      los: world.lineOfSight(
        { e: setup.trueE, n: setup.trueN },
        { e: hoverTarget.e, n: hoverTarget.n },
        { targetId: hoverTarget.id },
      ),
    };
  }

  return {
    world,
    player: drawPlayer,
    activeParcelId: svc?.parcelId ?? null,
    station: setup,
    setups: svc?.setups ?? [],
    observations: setup ? setup.observations : [],
    network: s.network.filter((p) => p.E != null),
    aim,
    tripodCheck,
    lang: lang(),
    showCornerLabels: tools.active === TOOL.VISADA,
    light: lightAt(dayFraction(svc)),
  };
}

/**
 * Where the working day has got to: 0 is 07:00, 1 is 18:00.
 *
 * The service clock drives the light, which is what turns "elapsed time" from a
 * number in the corner into something the player can feel — and it is the same
 * clock the debrief reports, so the sky never lies about how long a job took.
 *
 * A crew arrives on site mid-morning, not at first light, so the day STARTS at
 * 0.28. Beginning at literal dawn painted the opening screen cold blue, which
 * is a miserable first impression and tells the player nothing.
 */
const DAY_START = 0.28;
const DAY_SPAN_MS = 5 * 3600 * 1000; // a long job runs into golden hour
function dayFraction(svc) {
  if (!svc) return DAY_START;
  return Math.max(0, Math.min(1, DAY_START + (svc.elapsedMs / DAY_SPAN_MS) * (1 - DAY_START)));
}

// ------------------------------------------------------------------- loop ---

let clockAcc = 0;

const loop = makeLoop({
  update(dt) {
    if (!world || !running) return;
    if (modals.isOpen()) {
      // Park the surveyor rather than freezing them mid-stride: momentum kept
      // across a dialog is spent the moment it closes, and a station dialog
      // that reads the player's position wants that position to hold still.
      halt(player);
      return;
    }

    const intent = input.intent();
    const wasPhase = player.walkPhase;
    updatePlayer(player, intent, world, dt);
    camera.follow(player, dt);
    store.tickService(dt);

    // One footstep per half stride, from the same phase that drives the walk
    // animation — so what you hear and what you see are the same motion.
    if (player.moving && Math.floor(player.walkPhase * 2) !== Math.floor(wasPhase * 2)) {
      audio.step(world.terrain.soilAt(player.e, player.n).id);
    }

    effects?.update(dt, { player, running: intent.run && player.moving });

    // The clock has to move on its own, not only when something else changes.
    clockAcc += dt;
    if (clockAcc > 0.25) {
      clockAcc = 0;
      hud.tick(store.get().activeService?.elapsedMs ?? 0, service.clock());
    }
  },
  render(alpha) {
    if (!display) return;
    const view = buildView(alpha);

    // Bake ground on whatever is left of the frame, nearest chunk first. The
    // budget is the point: a chunk takes ~20 ms and must never land in one go.
    if (ground) ground.pump(4, camera.e, camera.n);

    if (scene) scene.render(view);
    display.present();

    const ctx = display.beginOverlay();
    if (camera.planMode) planView.draw(ctx, view);
    overlays.draw(ctx, view);
  },
});

// ------------------------------------------------------------- interaction --

function selectTool(tool) {
  const verdict = tools.activate(tool);
  if (!verdict.ok) return verdict;

  if (tool === TOOL.CADERNETA) openCaderneta();
  else if (tool === TOOL.CALCULOS) openCalculos();
  else if (tool === TOOL.ENTREGA) openDelivery();
  else if (tool === TOOL.MAPA) openMap();

  toolbar.refresh();
  return verdict;
}

/** The sightable thing nearest a world position, within the cursor's pick radius. */
function targetAt(worldPos) {
  if (!world || !worldPos) return null;
  const pick = Math.max(1.5, 16 / camera.zoom);
  let best = null;
  let bestD = Infinity;
  for (const ent of world.spatial.queryCircle(worldPos.e, worldPos.n, pick)) {
    if (!ent.targetable || ent.hidden) continue;
    const d = Math.hypot(ent.e - worldPos.e, ent.n - worldPos.n);
    if (d < bestD && d <= pick) {
      bestD = d;
      best = ent;
    }
  }
  return best;
}

function onHover(worldPos) {
  hoverTarget = tools.active === TOOL.VISADA ? targetAt(worldPos) : null;
}

/**
 * Do whatever the active tool does, here.
 *
 * Shared by the left click and by SPACE, deliberately: every action in this
 * game already happens where the PLAYER stands, not where the cursor points —
 * you drive the stake at your feet, and the tripod goes over a marco you are
 * standing on. A click has never used its own coordinates. Space is therefore
 * not a second code path with its own rules but the same one under a key that
 * does not need the mouse, and routing both through here is what stops the two
 * drifting apart later.
 *
 * VISADA is the one that reads the cursor, because aiming is the one thing you
 * genuinely do at a distance: mouse to aim, space to shoot.
 *
 * Every branch that declines to act says why. This function used to fall
 * through in silence whenever the active tool had nothing to do — and since
 * every job STARTS on the walk tool, the first press of the key a player has
 * just been taught did nothing whatsoever, which is indistinguishable from a
 * feature that was never built. Every sibling action here toasts on refusal;
 * this was the one path that did not.
 */
function doActiveToolAction() {
  if (!world || !running) return;

  switch (tools.active) {
    case TOOL.MARCO:
      doPlaceMarco();
      break;
    case TOOL.ESTACAO:
      doSetupStation();
      break;
    case TOOL.VISADA: {
      // Resolved from where the cursor is NOW, rather than from whatever the
      // last pointermove happened to leave behind. Selecting this tool with the
      // 4 key — or letting the game select it for you after a station goes up —
      // fires no pointer event at all, so a cursor already resting on a corner
      // used to leave the key dead until the mouse was physically nudged.
      const target = hoverTarget || targetAt(input?.worldPointer);
      if (target) doSight(target.id);
      else notifier.key('tip.noTarget', {}, 'warn');
      break;
    }
    default:
      // Walking, or a panel tool. There is nothing to do at your feet, and
      // saying so is the whole point.
      notifier.key('tip.pickATool', {}, 'warn');
      break;
  }
}

function onClick() {
  doActiveToolAction();
}

function onDoubleClick(worldPos) {
  if (!world || !running) return;
  // Double-clicking a monument walks you there, and charges you for the walk.
  let best = null;
  let bestD = Infinity;
  for (const cp of store.get().network) {
    const d = Math.hypot(cp.trueE - worldPos.e, cp.trueN - worldPos.n);
    if (d < bestD && d < Math.max(3, 24 / camera.zoom)) {
      bestD = d;
      best = cp;
    }
  }
  if (!best) return;

  const r = fastTravel(player, world, { e: best.trueE, n: best.trueN }, store);
  if (!r.ok) {
    notifier.key('notify.travelNoRoom', {}, 'warn');
    return;
  }
  camera.snapTo(player);
  notifier.key('notify.travelled', { dist: r.metres.toFixed(0), time: fmtDuration(r.seconds * 1000) }, 'info');
  refreshUI();
}

/** The marco goes in where the player stands: you drive the stake at your feet. */
function doPlaceMarco() {
  const r = service.placeMarco(player.e, player.n);
  if (!r.ok) {
    const key =
      r.reason === 'badSoil'
        ? 'tripod.badSoil'
        : r.reason === 'obstacle'
          ? 'tripod.obstacle'
          : r.reason === 'tooCloseToMarco'
            ? 'marco.tooCloseToMarco'
            : r.reason === 'noMarcosLeft'
              ? 'marco.noMarcosLeft'
              : 'marco.badGround';
    notifier.key(
      key,
      {
        soil: r.detail?.soil ? t(`soil.${r.detail.soil}`) : '',
        obj: r.detail?.kind ? t(`obstacle.${r.detail.kind}`) : '',
      },
      'warn',
    );
    return;
  }
  notifier.key('marco.placed', { id: r.id }, 'success');
  refreshUI();
}

function doSetupStation() {
  const s = store.get();

  const candidates = s.network
    .map((cp) => ({ ...cp, distance: Math.hypot(cp.trueE - player.e, cp.trueN - player.n) }))
    .filter((cp) => cp.distance <= 1.0)
    .sort((a, b) => a.distance - b.distance);

  if (!candidates.length) {
    notifier.key('tripod.tooFarFromMarco', {}, 'warn');
    return;
  }

  const needsDatum = s.network.every((cp) => cp.E == null);
  const knownCount = s.network.filter((cp) => cp.E != null).length;

  showStationDialog({
    modals,
    candidates,
    backsights: s.network,
    needsDatum,
    canFreeStation: knownCount >= 2,
    onFreeStation: doFreeStation,
    onConfirm: ({ over, backsight, orientMode, datumMode }) => {
      const r = service.setupStation({
        over,
        backsight,
        orientMode,
        datumMode,
        playerPos: { e: player.e, n: player.n },
      });
      if (!r.ok) {
        notifier.key(`station.${r.reason}`, r.detail || {}, 'warn');
        return;
      }
      notifier.key('station.installed', { id: over, backsight }, 'success');
      selectTool(TOOL.VISADA);
      refreshUI();
    },
  });
}

function doFreeStation() {
  const known = store.get().network.filter((cp) => cp.E != null).map((cp) => cp.id);
  const r = service.setupFreeStation({ targets: known, playerPos: { e: player.e, n: player.n } });
  if (!r.ok) {
    notifier.key(`station.${r.reason}`, r.detail || {}, 'warn');
    return;
  }
  notifier.key(
    'station.resectionResult',
    { rms: r.resection.rms.toFixed(3), ppm: r.resection.scalePPM.toFixed(0) },
    'success',
  );
  if (r.resection.scaleSuspect) notifier.key('station.scaleSuspect', {}, 'warn');
  selectTool(TOOL.VISADA);
  refreshUI();
}

/**
 * Flip a survey-practice setting.
 *
 * The angle unit is display-only and applies immediately everywhere, including
 * to observations already recorded. Two-face changes how the NEXT sight is
 * taken and never rewrites one already in the field book — a reading is a
 * reading.
 */
function toggleSetting(key) {
  const s = store.get();
  if (key === 'angleFormat') {
    s.settings.angleFormat = s.settings.angleFormat === 'gon' ? 'dms' : 'gon';
    setAngleFormat(s.settings.angleFormat);
  } else if (key === 'twoFace') {
    s.settings.twoFace = !s.settings.twoFace;
  }
  audio.click();
  refreshUI();
}

/** How many sights must be taken by hand before batch measuring unlocks. */
const MANUAL_SIGHTS_TO_UNLOCK = 4;

const batchUnlocked = () => (store.get().activeService?.manualSights ?? 0) >= MANUAL_SIGHTS_TO_UNLOCK;

/**
 * Measure every visible target from the current setup in one go.
 *
 * Gated on having taken a handful of sights by hand, which is the brief's own
 * requirement and a sound one: the point of the first few is to learn what a
 * sight *is*, and handing over the batch button immediately would let a student
 * finish a parcel without ever aiming at anything.
 */
function doMeasureAll() {
  if (!service.currentSetup()) {
    notifier.key('sight.noStation', {}, 'warn');
    return;
  }
  if (!batchUnlocked()) {
    notifier.key('sight.measureAllLocked', {}, 'warn');
    return;
  }

  const r = service.measureAll({});
  notifier.key('sight.measureAllDone', { n: r.measured, blocked: r.blocked }, r.measured ? 'success' : 'warn');
  if (r.measured) audio.chime();
  refreshUI();
}

function doSight(targetId) {
  const r = service.sight(targetId);
  if (!r.ok) {
    if (r.blocked) {
      notifier.key('sight.blocked', { obj: t(`obstacle.${r.kind}`) }, 'warn');
    } else {
      notifier.key(`sight.${r.reason}`, {}, 'warn');
    }
    return;
  }
  notifier.key(
    'sight.recorded',
    {
      label: r.observation.label,
      dist: r.distance.toFixed(3),
      hz: r.hz.toFixed(4),
    },
    'info',
  );
  refreshUI();
}

// ----------------------------------------------------------------- panels ---

function openCaderneta() {
  const svc = store.get().activeService;
  modals.open({
    titleKey: 'caderneta.title',
    wide: true,
    body: renderCaderneta({ setups: svc.setups, observations: svc.observations }),
    actions: [{ labelKey: 'common.close' }],
  });
}

function openCalculos() {
  const s = store.get();
  const ring = service.surveyedRing();

  const render = () => {
    const traverse = service.runTraverse();
    return renderCalculos({
      traverse,
      area: ring.length >= 3 ? areaOf(ring) : null,
      requiredPrecision: store.difficulty().requiredPrecision,
      rule: s.settings.compRule,
      onRuleChange: (rule) => {
        store.setSetting('compRule', rule);
        dialog.setBody(render());
      },
    });
  };

  const dialog = modals.open({
    titleKey: 'calc.title',
    wide: true,
    body: render(),
    actions: [{ labelKey: 'common.close' }],
  });
}

function openMap() {
  const s = store.get();
  const body = el(
    'div.parcel-list',
    {},
    el('p.hint', { text: t('map.subtitle') }),
    ...world.parcels.map((p) => {
      const progress = s.parcels[p.id];
      const status = progress?.status || 'available';
      return el(
        `div.parcel-card${p.id === s.activeService?.parcelId ? '.is-active' : ''}`,
        {},
        el('h4', { text: p.propertyName }),
        el('p.muted', { text: p.owner }),
        el('p', { text: `${(p.area).toFixed(0)} m² · ${p.hectares.toFixed(2)} ha · ${p.vertices.length} vértices` }),
        el('span.chip', { text: t(`map.status.${status}`) }),
      );
    }),
  );
  modals.open({ titleKey: 'map.title', body, wide: true, actions: [{ labelKey: 'common.close' }] });
}

function openDelivery() {
  const progress = service.parcelProgress();
  if (!progress.complete) {
    notifier.key('delivery.incomplete', { n: progress.missing.length }, 'warn');
    return;
  }

  const result = service.finish();
  if (!result.ok) {
    notifier.key('delivery.incomplete', { n: result.progress?.missing.length ?? 0 }, 'warn');
    return;
  }

  const s = store.get();
  const planta = buildPlanta({ report: result.report, state: s, lang: lang(), playerName: s.player.name });
  const memorial = buildMemorial({ report: result.report, state: s, lang: lang(), playerName: s.player.name });

  const docs = makeDocBlocks();
  buildPlantaTables(result.report, docs, lang());

  const plantaCanvas = el('canvas.planta-canvas');
  const body = el(
    'div.delivery',
    {},
    renderDebrief(result),
    el('h3', { text: t('delivery.planta') }),
    plantaCanvas,
    el('h3', { text: t('delivery.memorial') }),
    docBlocksToHtml(memorial.blocks),
    docBlocksToHtml(docs.blocks),
  );

  const dialog = modals.open({
    titleKey: 'delivery.title',
    body,
    wide: true,
    actions: [
      {
        labelKey: 'delivery.exportPdf',
        primary: true,
        closes: false,
        onClick: async () => {
          try {
            await exportPDF({
              drawList: planta.drawList,
              blocks: [...memorial.blocks, { t: 'pagebreak' }, ...docs.blocks],
              filenameBase: result.report.parcel.propertyName,
            });
          } catch {
            // A school firewall should not cost the student their document.
            notifier.key('delivery.pdfFailed', {}, 'warn');
            downloadText(memorial.text, `memorial-${result.report.parcel.id}.txt`);
            printFallback();
          }
          return false;
        },
      },
      {
        labelKey: 'pay.total',
        onClick: () => showPayment(result),
      },
    ],
  });

  // Draw after the canvas is in the document so it has a measured width.
  requestAnimationFrame(() => drawListToCanvas(plantaCanvas, planta.drawList, planta.sheet, 3.4));

  lastReport = { result, planta, memorial, docs };
  refreshUI();
  return dialog;
}

let lastReport = null;

/**
 * The payment screen, itemised.
 *
 * Deliberately a breakdown rather than a number: the whole reason the economy
 * exists is to make it visible that a tighter closure and a quicker job are
 * both worth money, and a single total teaches nothing.
 */
function showPayment(result) {
  const s = store.get();
  audio.kaching();

  const rows = result.breakdown.lines.map((line) =>
    el(
      `tr${line.value < 0 ? '.is-debit' : ''}`,
      {},
      el('td', { text: t(line.key, line.detail ? formatDetail(line.detail) : {}) }),
      el('td', { text: `${line.value < 0 ? '−' : ''}R$ ${num(Math.abs(line.value), 0)}` }),
    ),
  );

  return modals.open({
    titleKey: 'pay.title',
    body: el(
      'div.payment',
      {},
      el(
        'table.tbl.pay-table',
        {},
        el('tbody', {}, rows),
        el(
          'tfoot',
          {},
          el(
            'tr.pay-total',
            {},
            el('td', { text: t('pay.total') }),
            el('td', { text: `R$ ${num(result.breakdown.total, 0)}` }),
          ),
        ),
      ),
    ),
    dismissible: false,
    actions: [
      { labelKey: 'pay.shop', closes: false, onClick: () => openShop() },
      { labelKey: 'pay.next', primary: true, onClick: () => nextJob() },
    ],
  });
}

/** Multipliers read better as "×1.2" than as a bare number. */
const formatDetail = (d) => ({
  ...d,
  ...(d.mult != null ? { mult: `×${num(d.mult, 2)}` } : {}),
  ...(d.ha != null ? { ha: num(d.ha, 2) } : {}),
  ...(d.hours != null ? { hours: num(d.hours, 1) } : {}),
});

function openShop() {
  return showShop({
    modals,
    store,
    onChange: refreshUI,
    sfx: (kind) => (kind === 'kaching' ? audio.kaching() : audio.reject()),
  });
}

/** Back to the job board, or the end of the campaign if all six are done. */
function nextJob() {
  const s = store.get();
  const remaining = world.parcels.filter((p) => s.parcels?.[p.id]?.status !== 'done');

  if (!remaining.length) {
    return showCampaignEnd({
      modals,
      state: s,
      parcels: world.parcels,
      onRestart: () => {
        modals.closeAll();
        showIntro({ modals, onStart: ({ seed, difficulty }) => boot({ seed, difficulty }), initial: bootOptions });
      },
    });
  }

  return showParcelPicker({
    modals,
    parcels: world.parcels,
    state: s,
    difficulty: store.difficulty(),
    dismissible: false,
    onChoose: startParcel,
  });
}

/**
 * Begin a service on a parcel. The network persists across jobs, which is what
 * makes monuments left near a boundary worth something on the neighbour's land.
 */
function startParcel(parcelId) {
  const parcel = world.parcelById.get(parcelId);
  if (!parcel) return;

  service.start(parcelId);
  const spawn = world.spawnPointFor(parcel);
  player = makePlayer(spawn);
  camera.snapTo(spawn);
  tools.reset();

  // Bake the ground the player is about to be standing in.
  const cm = ground.chunkMetres;
  const c0 = Math.floor(spawn.e / cm);
  const r0 = Math.floor(spawn.n / cm);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) ground.bakeNow(c0 + dx, r0 + dy);
  }

  refreshUI();
}

// -------------------------------------------------------------------- UI ----

function refreshUI() {
  const s = store.get();
  const svc = s.activeService;
  const parcel = service.activeParcel();
  const ring = service.surveyedRing();

  hud.update({
    parcel,
    service: svc,
    station: service.currentSetup(),
    progress: service.parcelProgress(),
    inventory: s.inventory,
    difficulty: store.difficulty(),
    money: s.player.money,
  });
  hud.setBatch({
    visible: Boolean(service.currentSetup()) && tools.active === TOOL.VISADA,
    unlocked: batchUnlocked(),
    twoFace: Boolean(s.settings.twoFace),
    gon: s.settings.angleFormat === 'gon',
  });
  hud.setChecklist(tutorial.checklist());
  hud.setArea(ring.length >= 3 ? areaOf(ring) : null);
  toolbar.refresh();
  tutorial.refresh();
}

// ------------------------------------------------------------------ start ---

async function startGame({ seed, difficulty }) {
  store.replace(
    makeInitialState({
      seed,
      difficulty,
      lang: lang(),
    }),
  );

  await prepareWorld(seed, difficulty);

  // All six properties are on offer from the start; the player picks the order,
  // and control left in the ground near a boundary is worth something on the
  // neighbour's land.
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const spawn = world.spawnPointFor(parcel);
  player = makePlayer(spawn);
  camera.snapTo(spawn);
  bakeAround(spawn);

  begin();
}

/**
 * Everything that depends only on (seed, difficulty): the world itself and the
 * whole render stack over it.
 *
 * Shared by a new game and by restoring a save, because a save stores the seed
 * rather than the world — regenerating is both smaller and safer than trying to
 * serialize a valley.
 */
async function prepareWorld(seed, difficulty) {
  world = buildWorld(seed, DIFFICULTY[difficulty] || DIFFICULTY.medio);
  camera.setBounds(world.bounds);

  if (!display) display = await makeDisplay({ worldCanvas: canvas, overlayCanvas, camera });
  display.resize();

  if (!atlas.ready) atlas.build();

  // Buildings are sized by the world generator, so their sprites are painted
  // here rather than in the shared sheet. Six of them; the cost is nothing.
  for (const ent of world.entities) {
    if (ent.kind !== 'benfeitoria' || !ent.seg) continue;
    const xs = ent.seg.map((p) => p[0]);
    const ys = ent.seg.map((p) => p[1]);
    const made = building(makeRng(seed, `casa:${ent.id}`), {
      wm: Math.max(...xs) - Math.min(...xs),
      hm: Math.max(...ys) - Math.min(...ys),
      variant: ent.id.charCodeAt(ent.id.length - 1) % 2,
    });
    atlas.addDynamic(`building-${ent.id}`, made.pix, made.anchorX, made.anchorY);
  }

  ground?.invalidateAll();
  ground = makeGroundBaker(world.terrain);
  scene?.reset();
  scene = makeScene({ app: display.app, camera, atlas, ground });
  effects?.reset();
  effects = makeEffects({ PIXI: pixi(), atlas, container: scene.effectsLayer, camera });
  planView.invalidate();
}

/**
 * Bake the ground the player is about to be standing in.
 * Runs behind the intro modal, where a couple of hundred milliseconds costs
 * nothing and arriving to a fully painted valley is worth a lot.
 */
function bakeAround({ e, n }) {
  const cm = ground.chunkMetres;
  const c0 = Math.floor(e / cm);
  const r0 = Math.floor(n / cm);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) ground.bakeNow(c0 + dx, r0 + dy);
  }
}

/** Bind input and start the loop. The last step of any entry into play. */
function begin() {
  if (!input) {
    input = makeInput({
      // The overlay sits on top and covers the world canvas exactly, so it is
      // the single owner of pointer events.
      canvas: overlayCanvas,
      camera,
      bus,
      EV,
      onClick,
      onDoubleClick,
      onHover,
      onToolKey: (tool) => selectTool(tool),
      onBatchKey: () => doMeasureAll(),
      onAct: () => doActiveToolAction(),
      isModalOpen: () => modals.isOpen(),
    });
  }

  running = true;
  tools.reset();
  refreshUI();
  loop.start();
}

/**
 * Resume a saved campaign.
 *
 * The save carries the seed, so the valley is regenerated rather than restored;
 * `service.rehydrate()` then rebuilds the observation stream and the reduced
 * points from the stored observations, which is what makes the surveyed ring
 * come back identical rather than merely similar.
 */
async function restoreGame(saved) {
  store.replace(saved, 'restore');
  const s = store.get();
  if (s.lang) setLanguage(s.lang);

  await prepareWorld(s.seed, s.difficulty);
  service.rehydrate();

  const svc = s.activeService;
  const parcel = svc ? world.parcelById.get(svc.parcelId) : null;

  // Stand where the player left off, falling back to a fresh spawn if the saved
  // position is unusable — a save should never strand someone inside a rock.
  let spot = { e: s.player.e, n: s.player.n };
  if (!Number.isFinite(spot.e) || !Number.isFinite(spot.n) || !world.isPassable(spot.e, spot.n)) {
    spot = parcel ? world.spawnPointFor(parcel) : { e: world.bounds.maxE / 2, n: world.bounds.maxN / 2 };
  }
  player = makePlayer(spot);
  player.facing = s.player.facing || 'S';
  camera.snapTo(spot);
  if (s.settings?.zoom) camera.setZoom(s.settings.zoom);
  setAngleFormat(s.settings?.angleFormat || 'dms');
  bakeAround(spot);

  begin();

  // No active job — the campaign is between properties, so go to the board.
  if (!svc || svc.completed) nextJob();
}

// ----------------------------------------------------------------- events ---

bus.on(EV.LOS_BLOCKED, ({ from, to, at }) => {
  overlays.flashBlocked(from, to, at);
  audio.blocked();
});

bus.on(EV.NOTIFY, ({ kind, key, params }) => {
  notifier.key(key, params || {}, kind || 'info');
  if (kind === 'error' || kind === 'warn') audio.reject();
});

// Feedback for the things the player actually does. Each one gets a sound and
// a burst of particles at the place it happened, so an action never lands as a
// silent change to a number somewhere else on screen.
bus.on(EV.MARCO_PLACED, (m) => {
  audio.thunk();
  if (m) effects?.thunk(m.e ?? m.trueE, m.n ?? m.trueN);
});

bus.on(EV.STATION_SET, () => audio.setup());

bus.on(EV.OBSERVATION, (o) => {
  audio.chime();
  if (o && o.E != null) effects?.ping(o.E, o.N);
});

bus.on(EV.TRAVERSE_COMPUTED, (tr) => {
  if (tr?.ok && tr.angOk) audio.fanfare();
});

bus.on(EV.SERVICE_FINISHED, () => audio.complete());

bus.on(EV.LANG_CHANGED, () => {
  toolbar.rebuildLabels();
  applyI18n(document);
  refreshUI();
});

window.addEventListener('resize', () => display?.resize());

/**
 * Autosave.
 *
 * Debounced two seconds, so a burst of observations costs one write. Until this
 * existed the only write was the `pagehide` flush below, which browsers fire
 * unreliably and never at all on a crash — so a campaign could be lost whole.
 *
 * The player's position is not part of the store, so it is folded in here; it
 * is the only thing a reload would otherwise forget.
 */
function snapshotForSave() {
  const s = store.get();
  s.player.e = player.e;
  s.player.n = player.n;
  s.player.facing = player.facing;
  s.settings.zoom = camera.zoom;
  return s;
}

bus.on(EV.STATE_CHANGED, () => {
  if (running) storage.saveDebounced(snapshotForSave);
});

for (const ev of ['visibilitychange', 'pagehide']) {
  window.addEventListener(ev, () => {
    if (running) storage.flush(snapshotForSave);
    // A background tab must not keep singing to itself.
    audio.setActive(document.visibilityState === 'visible');
  });
}

// ------------------------------------------------------------------- boot ---

initLanguage();
applyI18n(document);

// A world is fully described by its seed, so a link can carry one. Handy for
// handing a class the same valley, and for driving a headless screenshot.
//   ?seed=sv-1a2b3c&difficulty=facil&lang=en&start=1
const params = new URLSearchParams(location.search);
const urlSeed = params.get('seed');
const urlDifficulty = params.get('difficulty');
const urlLang = params.get('lang');

if (urlLang) setLanguage(urlLang);

const bootOptions = {
  seed: urlSeed || randomSeed(),
  difficulty: DIFFICULTY[urlDifficulty] ? urlDifficulty : 'medio',
};

// After one successful visit the whole game — Pixi included — is cached, so a
// classroom behind a captive portal only needs a network the very first time.
// Never on file://, where the registration throws.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Offline support is a bonus; its absence must never break the game. */
    });
  });

  /**
   * Take a new build the moment it is ready.
   *
   * The worker serves cache-first and refreshes in the background, so without
   * this a changed file lands one reload LATE — you edit something, reload, and
   * are still looking at the previous build. That is indistinguishable from the
   * change not working, and it cost a round of confusion over a keybinding that
   * was in fact already implemented.
   *
   * The campaign survives it: state is autosaved on every change and flushed on
   * `pagehide`. The flag is what stops a reload from re-triggering the event and
   * spinning.
   */
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

/**
 * The renderer needs PixiJS, and PixiJS comes from a CDN. If it cannot be had,
 * say so in the player's language instead of leaving a black canvas.
 */
function showLoadFailure(err) {
  console.error(err);
  root.append(
    el(
      'div.boot-error',
      {},
      el('h2', { text: t('boot.failTitle') }),
      el('p', { text: t('boot.failBody') }),
      el('button.btn.btn-primary', { type: 'button', text: t('boot.retry'), onclick: () => location.reload() }),
    ),
  );
}

const boot = (opts) => {
  // The intro button is a real user gesture, which is exactly what an
  // AudioContext needs. Starting audio anywhere else would be blocked.
  audio.start();
  return startGame(opts).catch(showLoadFailure);
};

/**
 * A save worth offering to resume.
 *
 * `loadSave()` does the validating, migrating and quarantining; anything it
 * hands back is structurally sound. An explicit seed in the URL overrides it,
 * because that is someone asking for a specific valley.
 */
function resumableSave() {
  if (urlSeed) return null;
  const saved = storage.loadSave();
  if (!saved || !saved.seed || !DIFFICULTY[saved.difficulty]) return null;
  const done = Object.values(saved.parcels || {}).filter((p) => p.status === 'done').length;
  // Nothing achieved yet: starting fresh is simply better than resuming.
  if (!done && !saved.activeService?.observations?.length) return null;
  return { saved, done, money: saved.player?.money ?? 0 };
}

const resume = (entry) =>
  restoreGame(entry.saved).catch((err) => {
    // A save that cannot be resumed must not cost the player the game. Start
    // fresh and say so, rather than leaving a black screen.
    console.error(err);
    notifier.key('save.restoreFailed', {}, 'warn');
    storage.clearSave();
    return startGame(bootOptions).catch(showLoadFailure);
  });

if (params.get('start') === '1') {
  boot(bootOptions);
} else {
  const entry = resumableSave();
  showIntro({
    modals,
    onStart: ({ seed, difficulty }) => boot({ seed, difficulty }),
    onContinue: entry ? () => { audio.start(); return resume(entry); } : null,
    saved: entry,
    initial: entry ? { seed: entry.saved.seed, difficulty: entry.saved.difficulty } : bootOptions,
  });
}

// ----------------------------------------------------------- test handle ----

/**
 * The single global the headless test drives. Every method is the same call the
 * UI makes, so a green smoke test means the real paths work.
 */
window.game = {
  get state() {
    return store.get();
  },
  get world() {
    return world;
  },
  get player() {
    return player;
  },
  camera,
  bus,
  store,
  service,
  tools,
  tutorial,

  api: {
    async newGame({ seed = randomSeed(), difficulty = 'medio', lang: language = 'pt' } = {}) {
      setLanguage(language);
      modals.closeAll();
      await startGame({ seed, difficulty });
      return { seed, difficulty };
    },

    listParcels: () =>
      world.parcels.map((p) => ({
        id: p.id,
        owner: p.owner,
        propertyName: p.propertyName,
        areaM2: p.area,
        hectares: p.hectares,
        vertices: p.vertices.length,
      })),

    listParcelVertices: (parcelId) => {
      const parcel = world.parcelById.get(parcelId || store.get().activeService.parcelId);
      return parcel.markIds.map((id, i) => ({ id, label: parcel.vertices[i].id }));
    },

    chooseParcel(id) {
      const parcel = world.parcelById.get(id);
      if (!parcel) return { ok: false, reason: 'unknownParcel' };
      service.start(id);
      const spawn = world.spawnPointFor(parcel);
      player = makePlayer(spawn);
      camera.snapTo(spawn);
      refreshUI();
      return { ok: true, id };
    },

    teleportPlayer(e, n) {
      player.e = e;
      player.n = n;
      player.prevE = e;
      player.prevN = n;
      halt(player); // arrive at rest, like fast travel does
      camera.snapTo(player);
      return { e, n };
    },

    canSetupAt: (e, n) => world.canSetupTripod(e, n),

    placeMarco(e, n, label) {
      if (e != null) window.game.api.teleportPlayer(e, n);
      const r = service.placeMarco(player.e, player.n, label);
      refreshUI();
      return r;
    },

    setupStation(opts) {
      const r = service.setupStation({ ...opts, playerPos: { e: player.e, n: player.n } });
      refreshUI();
      return r;
    },

    setupFreeStation(opts) {
      const r = service.setupFreeStation({ ...opts, playerPos: { e: player.e, n: player.n } });
      refreshUI();
      return r;
    },

    sight(targetId) {
      const r = service.sight(targetId);
      refreshUI();
      return r;
    },

    measureAll: (opts) => {
      const r = service.measureAll(opts);
      refreshUI();
      return r;
    },

    visibleTargets: (opts) =>
      service.visibleTargets(opts).map((v) => ({
        id: v.entity.id,
        label: v.entity.label,
        distance: v.distance,
        clear: v.clear,
      })),

    parcelProgress: () => service.parcelProgress(),
    surveyedRing: () => service.surveyedRing(),
    computeTraverse: (opts) => service.runTraverse(opts || {}),
    getReport: () => service.parcelReport(lang()),
    debrief: () => service.debrief(),

    finishService() {
      const result = service.finish();
      if (!result.ok) return result;
      const s = store.get();
      const planta = buildPlanta({ report: result.report, state: s, lang: lang(), playerName: s.player.name });
      const memorial = buildMemorial({ report: result.report, state: s, lang: lang(), playerName: s.player.name });
      lastReport = { result, planta, memorial };
      return {
        ...result,
        planta: { items: planta.drawList.items, scaleDen: planta.scaleDen },
        memorial: memorial.text,
      };
    },

    openDelivery,

    async exportPDF() {
      if (!lastReport) return { ok: false, reason: 'noReport' };
      const docs = makeDocBlocks();
      buildPlantaTables(lastReport.result.report, docs, lang());
      const name = await exportPDF({
        drawList: lastReport.planta.drawList,
        blocks: [...lastReport.memorial.blocks, { t: 'pagebreak' }, ...docs.blocks],
        filenameBase: lastReport.result.report.parcel.propertyName,
      });
      return { ok: true, name };
    },

    setLanguage,
    registerLanguage,
    getStateSnapshot: () => store.snapshot(),
    loadSnapshot(snapshot) {
      store.replace(snapshot, 'restore');
      service.rehydrate();
      refreshUI();
      return true;
    },
    resetSave() {
      storage.clearSave();
      return true;
    },
  },

  debug: {
    hash: () => world?.hash() ?? null,
    stats: () => world?.stats() ?? null,
    atlasCount: () => atlas.count,
    atlasFrame: (key) => {
      const f = atlas.get(key);
      return f ? { w: f.w, h: f.h, wm: f.wm, hm: f.hm } : null;
    },
    ground: () => ground?.stats ?? null,
    scene: () => scene?.stats ?? null,
    /** The surveyor sprite the scene would draw right now. */
    charKey: () => scene?.characterKey(player, service.currentSetup()) ?? null,
    fps: () => loop.fps,
    frames: () => loop.frameStats(),
    resetFrames: () => loop.resetStats(),
    /** Drive the player from a test without bypassing collision. */
    walk(e, n, run = false) {
      if (!world) return null;
      updatePlayer(player, { e, n, run }, world, 1 / 60);
      return { e: player.e, n: player.n };
    },
    ready: () => running && atlas.ready,
  },
};

// `api.ready` is what the probes and the smoke test poll on.
window.game.api.ready = () => running && atlas.ready;

/** Resolves once the world is built and the atlas has rasterized. */
window.game.ready = new Promise((resolve) => {
  const check = () => {
    if (running && atlas.ready) resolve(true);
    else setTimeout(check, 60);
  };
  check();
});
