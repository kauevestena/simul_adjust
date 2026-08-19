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
import { lightAt, LIGEIRINHO_LOOK, ownerLook } from './render/palette.js';
import { pixi } from './render/pixi.js';
import { makeAudio } from './audio/audio.js';

import { makePlayer, updatePlayer, interpolated, fastTravel, halt, canStand, nearestStandable } from './game/player.js';
import {
  makeAssistant,
  updateAssistant,
  interpolatedAssistant,
  haltAssistant,
  sendTo,
  recall,
  placeBeside,
  MODE as AUX_MODE,
} from './game/assistant.js';
import { revealMarksNear, applyRevealed, REVEAL_RADIUS } from './game/discovery.js';
import { makeInput } from './game/input.js';
import { makeTools, TOOL, PANEL_TOOLS } from './game/tools.js';
import { makeTutorial } from './game/tutorial.js';
import { makeService, OCCUPY_RADIUS } from './game/service.js';

import { initLanguage, applyI18n, t, setLanguage, lang, registerLanguage, setAngleFormat } from './ui/i18n.js';
import { makeModalHost } from './ui/modal.js';
import { makeNotifier } from './ui/notify.js';
import { showIntro } from './ui/intro.js';
import { paintSurveyor, HEAD, MINI } from './ui/portrait.js';
import { makeHud } from './ui/hud.js';
import { makeToolbar } from './ui/toolbar.js';
import { renderCaderneta, cadernetaRows } from './ui/caderneta.js';
import { renderCalculos } from './ui/calculos.js';
import { showStationDialog } from './ui/stationdialog.js';
import { showParcelPicker, showCampaignEnd } from './ui/parcelpicker.js';
import { showShop } from './ui/shop.js';
import { el } from './ui/dom.js';

import { buildPlanta, buildPlantaTables } from './report/planta.js';
import { buildMemorial } from './report/memorial.js';
import { buildErrorFigure } from './report/errorfigure.js';
import { makeDocBlocks } from './report/docmodel.js';
import { drawListToCanvas, docBlocksToHtml, renderDebrief } from './report/reportview.js';
import { exportPDF, printFallback, downloadText, downloadCSV } from './report/pdf.js';

import { areaOf } from './survey/geometry.js';
import { num } from './ui/i18n.js';
import { fmtDuration } from './survey/units.js';

// ---------------------------------------------------------------- context ---

const root = document.getElementById('app');
const canvas = document.getElementById('world');

/**
 * Where the HTML panels sit over the canvas, in CSS pixels.
 *
 * The overlay canvas is UNDER the HUD bar, the checklist and the thumbstick, so
 * anything pinned to an edge is drawn behind them and simply cannot be seen —
 * which is how the first version of the unfound-corner arrow ended up invisible
 * in exactly the corner it was pointing to. Cached rather than measured every
 * frame: `getBoundingClientRect` forces layout, and these move only when the
 * HUD changes or the window does.
 *
 * Declared up here because `makeHud` runs at module top level and calls back
 * into the measurement while it lays itself out.
 */
let safeArea = { top: 0, right: 0, bottom: 0, left: 0 };
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
let assistant = makeAssistant();
let input = null;
let hoverTarget = null;
let running = false;
/** The look the atlas sheet was painted with, so a changed one repaints it. */
let builtLook = null;

const modals = makeModalHost(root);
const notifier = makeNotifier(root);

const service = makeService({
  store,
  getWorld: () => world,
  bus,
  EV,
  // The service enforces "you must be at the instrument" itself, so every
  // caller — the click, the SPACE key, the batch button and `api.sight` — is
  // judged by one rule instead of four copies of it.
  getPlayerPos: () => (running ? { e: player.e, n: player.n } : null),
});

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
      atInstrument: service.atInstrument(),
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
  onChecklistToggle: () => measureSafeArea(),
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

  // The soil disc, drawn where the thing would actually go. For the tripod that
  // is always underfoot; for a marco it follows the cursor once the cursor is
  // out of arm's reach, because that is now where the stake lands — choosing a
  // spot across the field with the preview stuck to your boots would be picking
  // blind.
  let tripodCheck = null;
  if (world && (tools.active === TOOL.MARCO || tools.active === TOOL.ESTACAO)) {
    const at = input?.worldPointer;
    const remote =
      tools.active === TOOL.MARCO && at && Math.hypot(at.e - player.e, at.n - player.n) > OCCUPY_RADIUS;
    const spot = remote ? at : player;
    tripodCheck = { e: spot.e, n: spot.n, check: world.canSetupTripod(spot.e, spot.n) };
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
    assistant: interpolatedAssistant(assistant, alpha),
    activeParcelId: svc?.parcelId ?? null,
    corners: cornerStates(),
    safeArea,
    station: setup,
    setups: svc?.setups ?? [],
    observations: setup ? setup.observations : [],
    network: s.network.filter((p) => p.E != null),
    aim,
    tripodCheck,
    lang: lang(),
    showCornerLabels: tools.active === TOOL.VISADA,
    // Only once the documents are done and before the owner has paid: any
    // earlier and it is a distraction, any later and it points at nothing.
    sede: svc?.delivered && !svc.completed && world ? world.sedeFor(svc.parcelId) : null,
    light: lightAt(dayFraction(svc)),
    now: sceneClock,
  };
}

function measureSafeArea() {
  if (!canvas) return;
  const view = canvas.getBoundingClientRect();
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };

  for (const sel of ['.hud-bar', '.checklist', '.toolbar', '.field-actions', '.thumbstick']) {
    const node = root.querySelector(sel);
    if (!node || node.hidden) continue;
    // Deliberately NOT `offsetParent`: these panels are positioned, and a
    // positioned element reports a null offsetParent — which silently skipped
    // every one of them. A hidden or unrendered node measures zero anyway,
    // which is the check that actually works.
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) continue;

    // Each panel owns exactly ONE edge. Testing all four let the full-width HUD
    // bar count as a left inset AND a right inset — both 1280 px — which walled
    // off the whole canvas and put every marker straight back in the corner the
    // insets exist to keep it out of.
    const band = r.width >= view.width * 0.6;
    if (band) {
      if (r.top - view.top <= view.height / 2) inset.top = Math.max(inset.top, r.bottom - view.top);
      else inset.bottom = Math.max(inset.bottom, view.bottom - r.top);
    } else if (r.left - view.left <= view.width / 2) {
      inset.left = Math.max(inset.left, r.right - view.left);
    } else {
      inset.right = Math.max(inset.right, view.right - r.left);
    }
  }

  // Never let the panels eat the frame: a marker with nowhere legal to go is
  // worse than one sitting slightly under an edge.
  inset.left = Math.min(inset.left, view.width * 0.25);
  inset.right = Math.min(inset.right, view.width * 0.25);
  inset.top = Math.min(inset.top, view.height * 0.25);
  inset.bottom = Math.min(inset.bottom, view.height * 0.25);
  safeArea = inset;
}

/**
 * The state of every corner of the parcel being surveyed.
 *
 * The boundary itself is drawn from the true geometry, always — so on médio and
 * difícil the player could see the line BEND at a corner whose mark is still
 * buried, with nothing on it to click and nothing saying why. Measured over six
 * seeds, that is 30 of 199 corners on médio and 80 of 199 on difícil, and it
 * left 94% of difícil parcels with at least one corner that read as a bug.
 *
 * Showing where they are is not a giveaway: the premise of the job is that the
 * owner has already walked the boundary and pointed the corners out. What the
 * player still has to do — go there, and find the evidence in the scrub — is
 * untouched, and on difícil it is still charged to the clock.
 */
function cornerStates() {
  const svc = store.get().activeService;
  const parcel = svc && world ? world.parcelById.get(svc.parcelId) : null;
  if (!parcel) return [];
  const missing = new Set(service.parcelProgress().missing);

  return parcel.markIds.map((id, i) => {
    const ent = world.entity(id);
    const v = parcel.vertices[i];
    return {
      id,
      label: v.id,
      e: ent ? ent.e : v.e,
      n: ent ? ent.n : v.n,
      // Three states, because "2/5" in the HUD never says WHICH two.
      state: !ent || ent.hidden ? 'unfound' : missing.has(id) ? 'found' : 'measured',
    };
  });
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
let discoveryAcc = 0;
/**
 * Seconds of GAME time, for the idle animations of things that are not the
 * crew. Advanced from the fixed step rather than read off the wall clock, so
 * everybody in the valley holds still while a dialog is open — exactly as the
 * player and Ligeirinho already do.
 */
let sceneClock = 0;
/** Last verdict on standing at the eyepiece, for spotting the flip. */
let wasAtInstrument = null;

const loop = makeLoop({
  update(dt) {
    if (!world || !running) return;
    if (modals.isOpen()) {
      // Park the surveyor rather than freezing them mid-stride: momentum kept
      // across a dialog is spent the moment it closes, and a station dialog
      // that reads the player's position wants that position to hold still.
      halt(player);
      haltAssistant(assistant);
      return;
    }

    sceneClock += dt;

    const intent = input.intent();
    const wasPhase = player.walkPhase;
    updatePlayer(player, intent, world, dt);
    updateCrew(dt);

    // The camera lets go while you are standing at the instrument.
    //
    // Sighting is the one thing done at a distance, and now that a reading
    // requires standing on the monument, corners past the edge of the screen
    // would otherwise be unreachable — the right-drag pan already existed but
    // `follow` yanked it straight back past the dead zone every frame. So it
    // stops following while you are set up and still, and resumes the moment
    // you walk. This is the difference between "you must stand here" being a
    // rule and being a cage.
    if (!lookingAround()) camera.follow(player, dt);
    store.tickService(dt);
    checkSedeArrival();

    // One footstep per half stride, from the same phase that drives the walk
    // animation — so what you hear and what you see are the same motion.
    if (player.moving && Math.floor(player.walkPhase * 2) !== Math.floor(wasPhase * 2)) {
      audio.step(world.terrain.soilAt(player.e, player.n).id);
    }

    effects?.update(dt, { player, running: intent.run && player.moving });

    discoveryAcc += dt;
    if (discoveryAcc > 0.25) {
      discoveryAcc = 0;
      findBoundaryMarks();
    }

    // Whether you are standing at the eyepiece is the only tool verdict that
    // depends on WHERE YOU ARE, and the rail is refreshed by `refreshUI` on two
    // dozen discrete events and never by the loop. So walking off and placing a
    // marco — which does refresh — set `disabled` on VISADA, and walking back
    // never cleared it: `toolbar.js` sets the real attribute, so the button was
    // dead rather than merely stale, and the session looked unresumable. Only
    // the rail is redrawn, and only on the flip: `refreshUI` rebuilds the HUD,
    // the checklist and the area, which is a lot of work for one boolean.
    const here = service.atInstrument().ok;
    if (here !== wasAtInstrument) {
      wasAtInstrument = here;
      toolbar.refresh();
    }

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

/**
 * Advance Ligeirinho, and take the reading the moment the prism is on the point.
 *
 * `arrived` and `gaveUp` are both worth acting on: a corner in a marsh or hard
 * against a building is one `canStand` refuses outright, and a sight that waited
 * for an arrival that can never happen would hang with nothing on screen to say
 * why. He plants the pole as close as he got, and the reading is taken.
 */
function updateCrew(dt) {
  const { arrived, gaveUp } = updateAssistant(assistant, world, dt, { player });

  // Walking away mid-errand calls a SIGHT off — the same rule that governs the
  // reading itself, so it cannot be sidestepped by clicking and then strolling
  // off while he runs. A marco errand is untouched by it: nothing about driving
  // a stake concerns the eyepiece, and you plant marcos before there is a
  // station to stand at in the first place.
  if (errandQueue[0]?.kind === 'sight' && !service.atInstrument().ok) {
    cancelErrands('sight.leftInstrument');
    return;
  }

  if (arrived || gaveUp) finishErrand({ arrived, gaveUp });
}

/**
 * Turn up the boundary evidence the crew has walked into.
 *
 * On médio and difícil a share of the corners start buried in scrub, and until
 * this ran they could be SEEN and never measured — which kept `parcelProgress`
 * incomplete and ENTREGA locked, so two thirds of médio jobs and nine tenths of
 * difícil ones could not be delivered at all. Finding one is worth announcing:
 * it is the moment the harder settings are actually teaching something.
 */
function findBoundaryMarks() {
  const found = revealMarksNear(world, [player, assistant]);
  if (!found.length) return;
  const s = store.get();
  s.revealedMarks.push(...found);
  for (const id of found) {
    notifier.key('notify.markFound', { label: world.entity(id)?.label || id }, 'success');
  }
  refreshUI();
}

/** Standing at the instrument with nothing in motion: the camera lets go. */
function lookingAround() {
  const setup = service.currentSetup();
  return Boolean(setup) && !player.moving && player.speed === 0 && service.atInstrument().ok;
}

// ------------------------------------------------------------- interaction --

function selectTool(tool) {
  const verdict = tools.activate(tool);
  if (!verdict.ok) return verdict;

  // Picking up a different tool calls Ligeirinho back in — but only a tool that
  // is not the one whose errand he is running, or selecting MARCO twice would
  // cancel the marco he was sent to plant. Escape is bound to the walk tool, so
  // this is also how a mistaken batch is cancelled. Panels cancel nothing:
  // opening the field book to check a reading is not a change of mind.
  const owner = TOOL_FOR_ERRAND[errandQueue[0]?.kind];
  if (!PANEL_TOOLS.has(tool) && tool !== owner) cancelErrands();

  if (tool === TOOL.CADERNETA) openCaderneta();
  else if (tool === TOOL.CALCULOS) openCalculos();
  else if (tool === TOOL.ENTREGA) openDelivery();
  else if (tool === TOOL.MAPA) openMap();

  toolbar.refresh();
  // The batch bar is shown by `refreshUI` and only for the sighting tool, so
  // without this it appeared one state change late — pressing 4 left it stale
  // until something else happened to redraw the HUD.
  if (!PANEL_TOOLS.has(tool)) refreshUI();
  return verdict;
}

/**
 * Say why there is nothing to aim at — including when there IS.
 *
 * `targetAt` skips buried marks, and rightly: a mark nobody has found is not
 * something the instrument may be pointed at. But falling through to "nenhum
 * alvo sob o cursor" made the game deny the corner exists, while drawing the
 * boundary bending straight through it. That is the complaint that opened this
 * round, and it was the message rather than the world that was wrong.
 *
 * So this looks a second time, deliberately including hidden marks, purely to
 * produce a better sentence. `targetAt` keeps its single rule about what may be
 * sighted, which is the thing worth not muddling.
 */
function explainNoTarget(at) {
  const buried = buriedCornerAt(at);
  if (!buried) {
    notifier.key('tip.noTarget', {}, 'warn');
    return;
  }
  const away = Math.max(0, Math.round(Math.hypot(buried.e - player.e, buried.n - player.n)));
  notifier.key('tip.cornerBuried', { label: buried.label || '', dist: away, reach: Math.round(REVEAL_RADIUS) }, 'warn');
}

/** A corner mark under the cursor that the crew has not turned up yet. */
function buriedCornerAt(worldPos) {
  if (!world || !worldPos) return null;
  const pick = Math.max(2.5, 20 / camera.zoom);
  let best = null;
  let bestD = Infinity;
  for (const ent of world.spatial.queryCircle(worldPos.e, worldPos.n, pick)) {
    if (!ent.hidden || ent.targetKind !== 'divisa') continue;
    const d = Math.hypot(ent.e - worldPos.e, ent.n - worldPos.n);
    if (d < bestD && d <= pick) {
      bestD = d;
      best = ent;
    }
  }
  return best;
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
 * Do whatever the active tool does.
 *
 * Shared by the left click and by SPACE, and the two now differ in exactly one
 * respect: a click knows where the cursor is and SPACE does not. So `at` is the
 * click's world position, or null for the key, and each branch decides what
 * that is worth to it.
 *
 * MARCO is where it matters. The stake goes in at your feet — from SPACE, or
 * from a click on your own boots — and anywhere further off is Ligeirinho's
 * errand. Until this round nothing in the game used the cursor's coordinates
 * for anything but aiming, which is why this comment used to say a click never
 * had its own; the auxiliar is what changed that, and it changed it for the
 * one action where "over there" is a real instruction rather than a shortcut.
 *
 * ESTAÇÃO stays underfoot: a tripod goes where the surveyor is.
 *
 * VISADA reads the cursor because aiming is the one thing you genuinely do at a
 * distance: mouse to aim, space to shoot.
 *
 * Every branch that declines to act says why. This function used to fall
 * through in silence whenever the active tool had nothing to do — and since
 * every job STARTS on the walk tool, the first press of the key a player has
 * just been taught did nothing whatsoever, which is indistinguishable from a
 * feature that was never built. Every sibling action here toasts on refusal;
 * this was the one path that did not.
 */
function doActiveToolAction(at = null) {
  if (!world || !running) return;

  switch (tools.active) {
    case TOOL.MARCO:
      doPlaceMarco(at);
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
      const at2 = at || input?.worldPointer;
      const target = targetAt(at) || hoverTarget || targetAt(input?.worldPointer);
      if (target) doSight(target.id);
      else explainNoTarget(at2);
      break;
    }
    default:
      // Walking, or a panel tool. There is nothing to do at your feet, and
      // saying so is the whole point.
      notifier.key('tip.pickATool', {}, 'warn');
      break;
  }
}

function onClick(worldPos) {
  doActiveToolAction(worldPos);
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

/** One description of why a monument was refused, wherever it was refused. */
function notifyMarcoRefusal(r) {
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
}

/**
 * Drive a stake — yours, or his.
 *
 * A monument at your feet is one you plant yourself, and one across the field
 * is what the auxiliar is for. So the split is by distance rather than by input
 * device: SPACE and a click on your own boots do the same thing, and a click
 * beyond arm's reach is an errand. `OCCUPY_RADIUS` is the same metre that
 * decides whether you are standing on a monument and whether you are behind the
 * eyepiece — one idea, said three ways.
 *
 * The refusal is worked out HERE, at the click, and not when he arrives: the
 * soil under that spot does not change while he runs, so making the player wait
 * a second to be told it was never legal is worse feedback than an instant no.
 * Same argument as the line-of-sight check before a sight.
 */
function doPlaceMarco(at = null) {
  const mine = !at || Math.hypot(at.e - player.e, at.n - player.n) <= OCCUPY_RADIUS;
  if (mine) {
    const r = service.placeMarco(player.e, player.n);
    if (!r.ok) {
      notifyMarcoRefusal(r);
      return r;
    }
    notifier.key('marco.placed', { id: r.id }, 'success');
    refreshUI();
    return r;
  }

  const verdict = service.canPlaceMarco(at.e, at.n);
  if (!verdict.ok) {
    notifyMarcoRefusal(verdict);
    return verdict;
  }
  notifier.key('marco.auxSent', {}, 'info');
  return enqueueErrands([{ kind: 'marco', e: at.e, n: at.n }]);
}

function doSetupStation() {
  const s = store.get();
  const playerPos = { e: player.e, n: player.n };

  const candidates = s.network
    .map((cp) => ({ ...cp, distance: Math.hypot(cp.trueE - player.e, cp.trueN - player.n) }))
    .filter((cp) => cp.distance <= OCCUPY_RADIUS)
    .sort((a, b) => a.distance - b.distance);

  // What a free station can actually be fixed on from where you are standing.
  // Answered before the dialog opens rather than as a refusal after it, and by
  // the same function `setupFreeStation` uses — so the count on screen and the
  // requirement are one thing.
  const visibleKnown = service.visibleKnownPoints(playerPos);
  const freeOnly = candidates.length === 0;

  // Standing on open ground with nothing to occupy used to end here, which made
  // the free station reachable only from on top of a monument — the one place
  // you have no need of it. Estação livre exists precisely for the spot with no
  // marco under it, so that is now where it is offered.
  if (freeOnly && visibleKnown.length < 2) {
    notifier.key(candidates.length ? 'tripod.tooFarFromMarco' : 'station.noMarcoNoFix', {}, 'warn');
    return;
  }

  const needsDatum = s.network.every((cp) => cp.E == null);

  showStationDialog({
    modals,
    candidates,
    backsights: s.network,
    needsDatum,
    freeOnly,
    visibleKnown: visibleKnown.length,
    canFreeStation: visibleKnown.length >= 2,
    onFreeStation: doFreeStation,
    onConfirm: ({ over, backsight, orientMode }) => {
      const r = service.setupStation({
        over,
        backsight,
        orientMode,
        playerPos,
      });
      if (!r.ok) {
        notifier.key(`station.${r.reason}`, r.detail || {}, 'warn');
        return;
      }
      notifier.key('station.installed', { id: over, backsight }, 'success');
      selectTool(TOOL.VISADA);
      frameTheFigure(r.setup);
      refreshUI();
    },
  });
}

function doFreeStation() {
  // No `targets`: the service takes what is visible from here, which is the
  // list the dialog counted.
  const r = service.setupFreeStation({ playerPos: { e: player.e, n: player.n } });
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
  frameTheFigure(r.setup);
  refreshUI();
}

/**
 * Pull back far enough to see what is about to be measured.
 *
 * Now that a reading has to be taken from the instrument, a corner off the edge
 * of the screen is a corner that cannot be clicked. `camera.fit` was written
 * for exactly this — its docstring has always said "used when a station is set
 * up, so the whole figure being measured comes into view" — and had never once
 * been called. Only zooms OUT: a player who has deliberately zoomed in on a
 * corner should not be yanked back out by setting up next to it.
 */
function frameTheFigure(setup) {
  const parcel = service.activeParcel();
  if (!parcel || !setup) return;
  const before = camera.zoom;
  const points = [...parcel.vertices, { e: setup.trueE, n: setup.trueN }];
  camera.fit(points, { padding: 10 });
  if (camera.zoom > before) camera.setZoom(before);
  camera.snapTo(player);
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

/**
 * Measure every visible target from the current setup in one go.
 *
 * Two gates, and they are different in kind. The manual-sight quota is a
 * TUTORIAL gate — the point of the first few sights is to learn what a sight
 * *is*, and handing the button over immediately would let a student finish a
 * parcel without ever aiming at anything. The difficulty gate is a DESIGN one:
 * batch measuring is a convenience, and on médio and difícil the work is meant
 * to be done target by target.
 *
 * Both live in `tutorial.batchMeasureUnlocked()`, which used to have a second,
 * subtly different copy here that ignored whether this was the first service.
 */
function doMeasureAll() {
  if (!service.currentSetup()) {
    notifier.key('sight.noStation', {}, 'warn');
    return { ok: false, reason: 'noStation' };
  }
  if (!store.difficulty().batchMeasure) {
    notifier.key('sight.measureAllFacilOnly', {}, 'warn');
    return { ok: false, reason: 'facilOnly' };
  }
  if (!tutorial.batchMeasureUnlocked()) {
    notifier.key('sight.measureAllLocked', {}, 'warn');
    return { ok: false, reason: 'locked' };
  }
  if (!service.atInstrument().ok) {
    notifier.key('sight.notAtInstrument', {}, 'warn');
    return { ok: false, reason: 'notAtInstrument' };
  }

  // Ligeirinho tours them one by one, because every one of these is a real
  // sight taken with the prism actually standing on the point. A batch that
  // teleported the readings in would undo the thing the crew exists to show.
  const targets = service.visibleTargets({}).filter((v) => v.clear);
  if (!targets.length) {
    notifier.key('sight.measureAllDone', { n: 0, blocked: 0 }, 'warn');
    return { ok: false, reason: 'nothingVisible' };
  }
  return enqueueSights(targets.map((v) => v.entity.id), { batch: true });
}

// ----------------------------------------------------------- Ligeirinho's errands --

/**
 * Work waiting on Ligeirinho, and what to say when the run is over.
 *
 * Two kinds now, and one queue on purpose. A reading lands when the prism
 * reaches the point and a monument goes in when he gets there with it, so both
 * are the same shape: send him, wait, act on arrival. Two parallel queues would
 * drift the moment one of them learned something about being cancelled that the
 * other did not.
 *
 * The deferral lives here rather than inside `service.*` — the survey core
 * stays synchronous and DOM-free, and every test that drives it keeps working.
 *
 *   {kind:'sight',  targetId}
 *   {kind:'marco',  e, n}
 */
let errandQueue = [];
let sightBatch = null;
/** Settled when the queue drains, so `api.sight` can be awaited. */
let errandDone = null;

/** Which tool owns an errand, for deciding what a tool change cancels. */
const TOOL_FOR_ERRAND = { sight: TOOL.VISADA, marco: TOOL.MARCO };

function enqueueErrands(jobs, { batch = false } = {}) {
  // A new errand replaces whatever he was doing — clicking a second spot is a
  // change of mind, not a queue. Settling the outgoing promise first is what
  // stops the replaced one hanging forever: `api.sight` and `api.placeMarcoAt`
  // both await these, and an overwritten `errandDone` would never be called.
  settleErrands({ ok: false, reason: 'superseded' });

  errandQueue = [...jobs];
  sightBatch = batch ? { measured: 0, blocked: 0 } : null;
  const promise = new Promise((resolve) => {
    errandDone = resolve;
  });
  dispatchNextErrand();
  return promise;
}

const enqueueSights = (ids, opts) =>
  enqueueErrands(ids.map((targetId) => ({ kind: 'sight', targetId })), opts);

/** Finish the errand and release anything waiting on it. */
function settleErrands(result) {
  const done = errandDone;
  errandDone = null;
  done?.(result);
}

/** Where an errand sends him. */
function errandPoint(job) {
  if (job.kind === 'marco') return { e: job.e, n: job.n };
  const target = world?.entity(job.targetId);
  return target ? { e: target.e, n: target.n } : null;
}

/** Send him to the head of the queue, or wind the errand up. */
function dispatchNextErrand() {
  if (!errandQueue.length) {
    if (sightBatch) {
      notifier.key(
        'sight.measureAllDone',
        { n: sightBatch.measured, blocked: sightBatch.blocked },
        sightBatch.measured ? 'success' : 'warn',
      );
      if (sightBatch.measured) audio.chime();
      sightBatch = null;
      refreshUI();
    }
    recall(assistant);
    settleErrands(lastErrandResult);
    return;
  }
  const to = errandPoint(errandQueue[0]);
  if (!to) {
    errandQueue.shift();
    dispatchNextErrand();
    return;
  }
  sendTo(assistant, to.e, to.n);
}

/** Abandon whatever he was doing, and say why. */
function cancelErrands(reasonKey = null) {
  if (!errandQueue.length && !sightBatch) return;
  errandQueue = [];
  sightBatch = null;
  recall(assistant);
  if (reasonKey) notifier.key(reasonKey, {}, 'warn');
  settleErrands({ ok: false, reason: reasonKey || 'cancelled' });
  refreshUI();
}

/** The verdict on the last errand, for anything awaiting the queue. */
let lastErrandResult = null;

/**
 * He has stopped: do the thing he went there for.
 *
 * `arrived` and `gaveUp` part company here, and they should. A prism a couple
 * of metres short of an unreachable corner is a slightly worse reading, which a
 * real prism man calls anyway — but a monument planted somewhere along the way
 * is simply a monument in the wrong place, and every coordinate derived from it
 * afterwards would be wrong with no sign that anything went astray.
 */
function finishErrand({ arrived }) {
  const job = errandQueue.shift();
  if (!job) return;

  if (job.kind === 'marco') finishMarcoErrand(job, { arrived });
  else finishSightErrand(job);

  dispatchNextErrand();
}

/**
 * Take the reading, whether he made it to the point or ran out of road.
 *
 * A prism a metre or two short of a corner in a marsh is what a real prism man
 * calls anyway, so `gaveUp` is not a refusal here — which is exactly where a
 * monument differs, and why the two are separate functions.
 */
function finishSightErrand(job) {
  const r = service.sight(job.targetId);
  lastErrandResult = r;
  if (r.ok) {
    if (sightBatch) sightBatch.measured++;
    else {
      notifier.key(
        'sight.recorded',
        { label: r.observation.label, dist: r.distance.toFixed(3), hz: r.hz.toFixed(4) },
        'info',
      );
    }
  } else if (sightBatch) {
    sightBatch.blocked++;
  } else if (r.blocked) {
    notifier.key('sight.blocked', { obj: t(`obstacle.${r.kind}`) }, 'warn');
  } else {
    notifier.key(`sight.${r.reason}`, {}, 'warn');
  }

  if (!sightBatch) refreshUI();
}

/** Plant it — but only if he actually got there. See `finishErrand`. */
function finishMarcoErrand(job, { arrived }) {
  if (!arrived) {
    // He was sent to a spot that passed every check, so the ground is fine and
    // the ROUTE is what failed. Planting it where he gave up would put a
    // monument metres from where it was asked for, silently.
    lastErrandResult = { ok: false, reason: 'auxCouldNotReach' };
    notifier.key('marco.auxCouldNotReach', {}, 'warn');
    refreshUI();
    return;
  }
  const r = service.placeMarco(job.e, job.n);
  lastErrandResult = r;
  if (r.ok) notifier.key('marco.placedByAux', { id: r.id }, 'success');
  else notifyMarcoRefusal(r);
  refreshUI();
}

/**
 * Aim at one target.
 *
 * The line of sight is checked HERE, before he sets off, and deliberately so:
 * the line between the instrument and the corner does not change while he runs,
 * so making the player wait a second to be told it was never possible would be
 * worse feedback than the instant refusal they get today. What waits is the
 * reading, not the verdict on whether it can be taken at all.
 */
function doSight(targetId) {
  const setup = service.currentSetup();
  if (!setup) {
    notifier.key('sight.noStation', {}, 'warn');
    return { ok: false, reason: 'noStation' };
  }
  if (!service.atInstrument().ok) {
    notifier.key('sight.notAtInstrument', {}, 'warn');
    return { ok: false, reason: 'notAtInstrument' };
  }

  const target = service.truePositionOf(targetId);
  if (!target) {
    notifier.key('sight.unknownTarget', {}, 'warn');
    return { ok: false, reason: 'unknownTarget' };
  }

  const los = world.lineOfSight(
    { e: setup.trueE, n: setup.trueN },
    { e: target.trueE, n: target.trueN },
    { targetId },
  );
  if (!los.clear) {
    const blocker = los.blockers[0];
    bus.emit(EV.LOS_BLOCKED, { from: { e: setup.trueE, n: setup.trueN }, to: { e: target.trueE, n: target.trueN }, at: blocker.at, kind: blocker.kind });
    notifier.key('sight.blocked', { obj: t(`obstacle.${blocker.kind}`) }, 'warn');
    return { ok: false, reason: 'blocked', blocked: true, kind: blocker.kind };
  }

  return enqueueSights([targetId]);
}

// ----------------------------------------------------------------- panels ---

function openCaderneta() {
  const svc = store.get().activeService;
  modals.open({
    titleKey: 'caderneta.title',
    wide: true,
    body: renderCaderneta({ setups: svc.setups, observations: svc.observations }),
    actions: [
      {
        // The field book is the one artefact a student hands in, and it could
        // not leave the browser. CSV rather than PDF: it is data, and the point
        // of handing it in is that somebody checks the arithmetic.
        labelKey: 'caderneta.export',
        closes: false,
        onClick: () => {
          const rows = cadernetaRows({ setups: svc.setups, observations: svc.observations });
          downloadCSV(rows, `caderneta-${svc.parcelId}.csv`);
          notifier.key('caderneta.exported', { n: rows.length - 1 }, 'success');
          return false;
        },
      },
      { labelKey: 'common.close' },
    ],
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

  // Draws up the documents and scores the job; banks nothing. The owner is a
  // person who lives somewhere, and he settles up at his own kitchen table.
  const result = service.deliver();
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

  // The error figure is debrief-only and never joins the documents: the planta
  // is the deliverable and imitates a legal instrument, so the true corner
  // positions have no business on it. This is the one screen in the game where
  // truth is shown at all.
  const figure = buildErrorFigure({ corners: result.debrief?.corners ?? [], t });
  const errorCanvas = figure.drawList.items.length ? el('canvas.planta-canvas') : null;

  const body = el(
    'div.delivery',
    {},
    renderDebrief(result),
    errorCanvas ? el('h3', { text: t('debrief.figureTitle') }) : null,
    errorCanvas,
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
        labelKey: 'delivery.toSede',
        onClick: () => announceSede(),
      },
    ],
  });

  // Draw after the canvases are in the document so they have a measured width.
  requestAnimationFrame(() => {
    drawListToCanvas(plantaCanvas, planta.drawList, planta.sheet, 3.4);
    if (errorCanvas) drawListToCanvas(errorCanvas, figure.drawList, figure.sheet, 3.4);
  });

  lastReport = { result, planta, memorial, docs };
  refreshUI();
  return dialog;
}

let lastReport = null;

// ------------------------------------------------------------- getting paid --

/**
 * Point the player at the farmhouse.
 *
 * The documents are done; the money is at the sede. Said once, by name, because
 * "go and get paid" with no indication of where is the kind of instruction that
 * turns into wandering — the waypoint in `overlays.js` does the rest.
 */
function announceSede() {
  const svc = store.get().activeService;
  const sede = svc && world?.sedeFor(svc.parcelId);
  if (!sede) {
    // No homestead on this parcel at all: pay on the spot rather than send the
    // player to look for a building that does not exist.
    collectPayment();
    return;
  }
  const parcel = service.activeParcel();
  notifier.key('delivery.goToSede', { owner: parcel?.owner ?? '', property: parcel?.propertyName ?? '' }, 'info');
}

/** Close enough to the door to be knocking on it. */
const SEDE_RADIUS = 3.0;

/**
 * Have we arrived to be paid?
 *
 * Checked from the fixed step rather than hung off a click, because arriving is
 * the action — the owner comes out to meet you. Fires once: `collectPayment`
 * refuses a job already paid.
 */
function checkSedeArrival() {
  const svc = store.get().activeService;
  if (!svc?.delivered || svc.completed || modals.isOpen()) return;
  const sede = world?.sedeFor(svc.parcelId);
  if (!sede) return;
  if (Math.hypot(player.e - sede.door.e, player.n - sede.door.n) > SEDE_RADIUS) return;
  collectPayment();
}

function collectPayment() {
  const result = service.collectPayment();
  if (!result.ok) return;
  showPayment(result);
  refreshUI();
}

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

  // The owner, in person. The screen used to open with a table of numbers for
  // money handed over by nobody — and there is somebody standing on the
  // doorstep now, so it is the same face, painted from the same look the sprite
  // out in the valley is painted from.
  const parcel = service.activeParcel();
  const portrait = parcel
    ? el('canvas.pay-face', {
        width: HEAD.w * MINI,
        height: HEAD.h * MINI,
        'aria-hidden': 'true',
      })
    : null;
  if (portrait) paintSurveyor(portrait, ownerLook(parcel.ownerBody, parcel.index), HEAD);

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
      parcel
        ? el(
            'div.pay-owner',
            {},
            portrait,
            el('p.pay-owner-line', { text: t('pay.ownerLine', { owner: parcel.owner }) }),
          )
        : null,
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
        showIntro({ modals, onStart: (opts) => boot(opts), initial: bootOptions });
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
  assistant = placeBeside(world, spawn);
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
    // Fácil only. Hidden rather than disabled off it — see `DIFFICULTY`.
    batch: store.difficulty().batchMeasure,
    unlocked: tutorial.batchMeasureUnlocked(),
    twoFace: Boolean(s.settings.twoFace),
    gon: s.settings.angleFormat === 'gon',
  });
  hud.setChecklist(tutorial.checklist());
  hud.setArea(ring.length >= 3 ? areaOf(ring) : null);
  toolbar.refresh();
  tutorial.refresh();
  measureSafeArea();
}

// ------------------------------------------------------------------ start ---

async function startGame({ seed, difficulty, name = '', look = null }) {
  const fresh = makeInitialState({ seed, difficulty, lang: lang() });
  fresh.player.name = name;
  fresh.player.look = look;
  store.replace(fresh);

  await prepareWorld(seed, difficulty);

  // All six properties are on offer from the start; the player picks the order,
  // and control left in the ground near a boundary is worth something on the
  // neighbour's land.
  const parcel = world.parcels[0];
  service.start(parcel.id);

  const spawn = world.spawnPointFor(parcel);
  player = makePlayer(spawn);
  assistant = placeBeside(world, spawn);
  camera.snapTo(spawn);
  bakeAround(spawn);

  begin();
  meetLigeirinho();
}

/**
 * Introduce the auxiliar, once.
 *
 * He needs introducing because he is not scenery: he is the reason a reading
 * can only be taken from the instrument, and a player who has not been told
 * that will read the refusal as the game being broken. So the rule and the man
 * who makes it reasonable arrive in the same breath.
 *
 * Once per campaign, recorded in the save — a second dialog on every reload
 * would turn a joke into a nuisance.
 */
function meetLigeirinho() {
  const s = store.get();
  if (s.player.metLigeirinho) return;
  s.player.metLigeirinho = true;

  const portrait = paintSurveyor(el('canvas.char-portrait', { width: 24 * 5, height: 34 * 5 }), LIGEIRINHO_LOOK);

  modals.open({
    titleKey: 'ligeirinho.title',
    body: el(
      'div.meet-aux',
      {},
      portrait,
      // Resolved now, not marked with `data-i18n`: that attribute is only ever
      // read by `applyI18n`, which runs over the document at boot and on a
      // language change — never over a modal body built afterwards. A dialog
      // that opens once, mid-game, has to translate itself.
      el(
        'div.meet-aux-text',
        {},
        el('p.meet-aux-lead', { text: t('ligeirinho.lead') }),
        el('p', { text: t('ligeirinho.body') }),
        el('p.hint', { text: t('ligeirinho.hint') }),
      ),
    ),
    dismissible: false,
    actions: [{ labelKey: 'ligeirinho.ok', primary: true }],
  });
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

  // The player's face is baked into the sheet, so a campaign started with a
  // different look has to repaint it. Keyed on the look itself rather than on
  // "is this a new game", because resuming a save is also a way to arrive here
  // wanting a different face from the one currently uploaded.
  const look = store.get().player.look;
  const lookKey = JSON.stringify(look ?? null);
  if (!atlas.ready || builtLook !== lookKey) {
    atlas.build(look);
    builtLook = lookKey;
  }

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

  // A save stores the seed, not the valley, so the world comes back with every
  // corner buried again. Put the crew's discoveries back before anybody looks
  // at it — the same reason `service.rehydrate` replants the player's marcos.
  applyRevealed(world, store.get().revealedMarks);

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
      // The thumbstick is a sibling of the panels, so it sits above the canvas
      // and inside the same layout the safe-area measurement already reads.
      root,
      camera,
      bus,
      EV,
      onClick,
      onDoubleClick,
      onHover,
      onTouch: () => {
        // A tablet in landscape is wide enough to keep the roteiro on screen,
        // where it covers a quarter of the play area and silently eats taps.
        hud.collapseChecklist();
        measureSafeArea();
      },
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

  // Added this round, and additive — a v2 save simply has no list yet. Filling
  // it in here rather than bumping `SAVE_VERSION` is the point: a bump would
  // run the migration chain, and the only migration that exists drops the job
  // in flight. Nobody should lose a half-surveyed parcel over an empty array.
  if (!Array.isArray(s.revealedMarks)) s.revealedMarks = [];

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
  assistant = placeBeside(world, spot);
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

window.addEventListener('resize', () => {
  display?.resize();
  measureSafeArea();
});

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
    onStart: (opts) => boot(opts),
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
  get assistant() {
    return assistant;
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
      assistant = placeBeside(world, spawn);
      camera.snapTo(spawn);
      refreshUI();
      return { ok: true, id };
    },

    teleportPlayer(e, n) {
      // Land somewhere the player could have walked to. This is the one path
      // that set the position directly, so a test or a probe could drop the
      // surveyor into a lake and every walkability guarantee downstream would
      // be reasoning about a position the game says is impossible.
      if (!canStand(world, e, n)) {
        const spot = nearestStandable(world, e, n);
        if (spot) ({ e, n } = spot);
      }
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

    /**
     * Exactly what a click beyond arm's reach does: Ligeirinho runs there and
     * plants it, so this WAITS for him. Resolves with the monument, or with the
     * immediate refusal if the ground was never legal.
     *
     * Deliberately not a shortcut past the crew — `placeMarco` above is the
     * at-your-feet path, and a probe that skipped the errand would be testing a
     * game nobody plays.
     */
    async placeMarcoAt(e, n) {
      const verdict = doPlaceMarco({ e, n });
      const r = verdict?.then ? await verdict : verdict;
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

    /**
     * Aim at a target, exactly the way a click does — so this WAITS for
     * Ligeirinho to reach the point. Resolves with the reading, or with the
     * immediate refusal if the line is blocked or you are not at the
     * instrument.
     *
     * Deliberately not a shortcut to `service.sight`. This handle exists so a
     * probe exercises production paths; one that skipped the crew would be
     * testing a game nobody plays.
     */
    async sight(targetId) {
      const verdict = doSight(targetId);
      const r = verdict?.then ? await verdict : verdict;
      refreshUI();
      return r;
    },

    measureAll: (opts) => {
      const r = doMeasureAll(opts);
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

    /**
     * Draw up the documents. Produces the planta and the memorial and scores
     * the job; the owner has not paid yet — see `collectPayment`.
     */
    finishService() {
      const result = service.deliver();
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

    /** Where the owner is waiting, and how far the player is from him. */
    sede() {
      const svc = store.get().activeService;
      const sede = svc && world?.sedeFor(svc.parcelId);
      if (!sede) return null;
      return {
        door: sede.door,
        owner: sede.owner,
        distance: Math.hypot(player.e - sede.door.e, player.n - sede.door.n),
        radius: SEDE_RADIUS,
      };
    },

    /**
     * Walk to the sede and take the money, in one call. The walk is charged at
     * the real pace, exactly as double-clicking a monument is.
     */
    goCollect() {
      const svc = store.get().activeService;
      const sede = svc && world?.sedeFor(svc.parcelId);
      if (!sede) return { ok: false, reason: 'noSede' };
      const r = fastTravel(player, world, sede.door, store);
      if (!r.ok) return { ok: false, reason: r.reason };
      camera.snapTo(player);
      const result = service.collectPayment();
      if (result.ok) {
        showPayment(result);
        refreshUI();
      }
      return result;
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
    /** The canvas area the HTML panels are not covering. */
    safeArea: () => ({ ...safeArea }),
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
