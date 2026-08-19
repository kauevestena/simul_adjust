// One "serviço": the survey of a single rural property, start to delivery.
//
// This module orchestrates the actual surveying — it is where the world, the
// instrument model and the traverse maths meet. Everything the UI can do goes
// through a method here, and so does everything the headless test does, which
// is what keeps the two honest about exercising the same code.
//
// The workflow it supports is the real one taught in Topografia 1:
//   1. materialize monuments (marcos) around the property
//   2. occupy one, orient on another, and radiate to the boundary corners
//   3. occupy the rest in turn, sighting neighbouring stations so the
//      polygon of stations forms a closed traverse with a real closure error
//   4. compensate, compute the area, deliver the planta and the memorial

import { makeRng } from '../core/rng.js';
import { azimuth, distance, polarPoint, areaOf, perimeterOf, sideTable } from '../survey/geometry.js';
import { normalize360 } from '../survey/units.js';
import { resolveKit } from '../survey/instrument.js';
import { setupOverKnownPoint, sightTarget, establishDatum, ORIENT } from '../survey/station.js';
import { solveResection, reduceFreeStation } from '../survey/resection.js';
import { computeTraverse, RULE } from '../survey/traverse.js';
import { makeControlPoint, assignCoordinates, SOURCE, resetCounter, datumShift, accuracyReport } from '../survey/network.js';
import { reducedPoints } from '../survey/observations.js';
import { canStand } from './player.js';
import { isSelfIntersecting } from '../core/math2d.js';
import { paymentBreakdown } from './economy.js';
import { budgetFor, clockState } from './timer.js';
import { MARCOS } from '../survey/instrument.js';

/** Minimum separation between two monuments, metres. */
const MARCO_MIN_SEPARATION = 1.0;
/**
 * How close the player must stand to occupy a monument — and, since this round,
 * to take a reading from the instrument standing on it.
 *
 * One constant for one idea: "you are at this point". Sighting used to check
 * nothing at all, so a player set the tripod up once and then measured the
 * whole parcel from wherever they had wandered off to. That is the one thing a
 * total station cannot do, and it is why Ligeirinho exists: somebody has to
 * carry the prism, and it is not the person behind the eyepiece.
 *
 * Exported because it now carries a third phrasing of the same idea: a click
 * inside this radius is a click on your own boots, which you deal with
 * yourself, and one outside it is an errand for the assistant.
 */
export const OCCUPY_RADIUS = 1.0;

/**
 * @param {() => ({e:number,n:number}|null)} [p.getPlayerPos]
 *        Where the surveyor is standing. Defaulting to `null` means UNCHECKED,
 *        which is what lets the DOM-free tests drive a whole survey without
 *        modelling a body — `tests/pipeline.test.mjs` supplies a real one and
 *        asserts the rule. The check lives here rather than in the click
 *        handler so that `api.sight`, `measureAll` and the SPACE key cannot each
 *        forget it in their own way.
 */
export function makeService({ store, getWorld, bus, EV, getPlayerPos = () => null }) {
  /** Observation noise stream, re-created per service so replays are exact. */
  let rng = null;
  /** targetId -> {id, label, E, N, sights} */
  let surveyed = new Map();

  const state = () => store.get();
  const service = () => state().activeService;
  const kit = () => resolveKit(state().inventory);

  function notify(kind, key, params = {}) {
    bus.emit(EV.NOTIFY, { kind, key, params });
  }

  // ------------------------------------------------------------- lifecycle --

  function start(parcelId) {
    const world = getWorld();
    const parcel = world.parcelById.get(parcelId);
    if (!parcel) return { ok: false, reason: 'unknownParcel' };

    resetCounter(state().network.length);
    const svc = store.startService(parcelId);
    // The id must not carry wall-clock time: the observation noise stream is
    // derived from it, and a seed has to replay identically every time.
    svc.id = `svc-${parcelId}-${state().stats.servicesDone}`;
    rng = makeRng(state().seed, `obs:${svc.id}`);
    surveyed = new Map();
    return { ok: true, service: svc, parcel };
  }

  /**
   * A monument exists twice: as a control point (`M3`) and as the world entity
   * you actually point the instrument at (`marco-M3`). Sights carry the entity
   * id, so these two translate between them. Getting this wrong is silent —
   * the sight records fine and the monument simply never gains coordinates.
   */
  const entityIdForPoint = (pointId) => `marco-${pointId}`;

  function controlPointFor(targetId) {
    const direct = store.findControlPoint(targetId);
    if (direct) return direct;
    if (typeof targetId === 'string' && targetId.startsWith('marco-')) {
      return store.findControlPoint(targetId.slice('marco-'.length));
    }
    return null;
  }

  const activeParcel = () => {
    const svc = service();
    return svc ? getWorld().parcelById.get(svc.parcelId) : null;
  };

  // ----------------------------------------------------------------- marcos --

  /**
   * Materialize a monument. It gets TRUE coordinates immediately (that is where
   * it physically is) but no surveyed coordinates until something measures it.
   */
  /**
   * May a monument go in here?
   *
   * Split out because a marco is no longer always planted at the player's feet:
   * a click beyond arm's reach sends Ligeirinho, and the refusal has to arrive
   * at the CLICK rather than a second later when he gets there. Same reasoning
   * as the line-of-sight check before a sight — the ground does not change
   * while he runs, so making the player wait to be told the spot was never
   * legal is worse feedback than an instant no.
   *
   * `placeMarco` calls this, so the two cannot drift: one description of the
   * rule, which is the invariant `game/tools.js` states about itself.
   */
  function canPlaceMarco(e, n) {
    const world = getWorld();
    if (!service()) return { ok: false, reason: 'noService' };
    if (state().inventory.marcos <= 0) return { ok: false, reason: 'noMarcosLeft' };

    if (!canStand(world, e, n)) return { ok: false, reason: 'badGround' };
    const tripod = world.canSetupTripod(e, n);
    if (!tripod.ok) return { ok: false, reason: tripod.reason, detail: tripod.detail };

    for (const cp of state().network) {
      if (Math.hypot(cp.trueE - e, cp.trueN - n) < MARCO_MIN_SEPARATION) {
        return { ok: false, reason: 'tooCloseToMarco' };
      }
    }
    return { ok: true };
  }

  function placeMarco(e, n, label = null) {
    const world = getWorld();
    const svc = service();
    const verdict = canPlaceMarco(e, n);
    if (!verdict.ok) return verdict;

    const id = label || `M${state().network.length + 1}`;
    const cp = makeControlPoint({
      id,
      label: id,
      kind: 'marco',
      trueE: e,
      trueN: n,
      serviceId: svc.id,
      parcelId: svc.parcelId,
    });
    store.addControlPoint(cp);
    svc.marcos.push(id);
    state().inventory.marcos--;

    world.addMarco(e, n, id);
    bus.emit(EV.MARCO_PLACED, cp);
    return { ok: true, id, point: cp };
  }

  // ------------------------------------------------------------- occupation --

  /** Where a target physically is, whatever kind of thing it is. */
  function truePositionOf(id) {
    const cp = controlPointFor(id);
    if (cp) return { id, trueE: cp.trueE, trueN: cp.trueN, label: cp.label };
    const ent = getWorld().entity(id);
    if (ent) return { id, trueE: ent.e, trueN: ent.n, label: ent.label || id };
    return null;
  }

  /** Coordinates the player has surveyed for this point, if any. */
  function knownPositionOf(id) {
    const cp = controlPointFor(id);
    if (cp && cp.E != null) return { id, E: cp.E, N: cp.N, label: cp.label };
    const s = surveyed.get(id);
    if (s) return { id, E: s.E, N: s.N, label: s.label };
    return null;
  }

  /**
   * Is the surveyor standing at the instrument?
   *
   * Measured against the setup's TRUE position, which carries the centring
   * error — a couple of millimetres against a one-metre radius, so it makes no
   * practical difference and keeps the frames from being mixed.
   *
   * @returns {{ok:boolean, distance:number}}
   */
  function atInstrument(setup) {
    const pos = getPlayerPos();
    if (!setup || !pos) return { ok: true, distance: 0 };
    const d = Math.hypot(setup.trueE - pos.e, setup.trueN - pos.n);
    return { ok: d <= OCCUPY_RADIUS, distance: d };
  }

  function canOccupy(marcoId, playerPos) {
    const world = getWorld();
    const cp = store.findControlPoint(marcoId);
    if (!cp) return { ok: false, reason: 'unknownMarco' };
    if (Math.hypot(cp.trueE - playerPos.e, cp.trueN - playerPos.n) > OCCUPY_RADIUS) {
      return { ok: false, reason: 'tooFarFromMarco' };
    }
    const tripod = world.canSetupTripod(cp.trueE, cp.trueN, { ignoreIds: [`marco-${marcoId}`] });
    if (!tripod.ok) return { ok: false, reason: tripod.reason, detail: tripod.detail };
    return { ok: true, point: cp };
  }

  /**
   * Set the instrument up over a monument and orient on a backsight.
   *
   * For the very first setup of the campaign nothing has coordinates yet, so
   * this is also where the local datum is born: the station takes an arbitrary
   * origin and north is the map's north. There used to be a choice of two
   * flavours here, both of which rotated the surveyed frame away from the world
   * — see `establishDatum`.
   */
  function setupStation({ over, backsight, orientMode = ORIENT.ZERO_BACKSIGHT, playerPos }) {
    const svc = service();
    if (!svc) return { ok: false, reason: 'noService' };

    const occupy = canOccupy(over, playerPos ?? { e: truePositionOf(over)?.trueE, n: truePositionOf(over)?.trueN });
    if (!occupy.ok) return occupy;

    const stationCp = store.findControlPoint(over);
    const backCp = store.findControlPoint(backsight);
    if (!backCp) return { ok: false, reason: 'unknownBacksight' };
    if (backsight === over) return { ok: false, reason: 'backsightIsStation' };

    let datum = svc.datum;

    // ---- birth of the datum ------------------------------------------------
    // Exactly once per campaign, and only while NOTHING anywhere has
    // coordinates. Keying this off "these two points happen to be unknown"
    // instead would let a second, contradictory datum be born the moment the
    // player occupies a monument they forgot to measure — every corner sighted
    // afterwards would land in a different frame, and the area would silently
    // come out tens of percent wrong.
    const anyKnown = state().network.some((cp) => cp.E != null);

    if (!anyKnown && !datum) {
      const trueDist = distance(stationCp.trueE, stationCp.trueN, backCp.trueE, backCp.trueN);
      const k = kit();
      const sigmaD = Math.hypot(k.instrument.distA_mm / 1000, k.instrument.distPPM * 1e-6 * trueDist);
      const measured = trueDist + rng.gauss() * sigmaD;

      datum = establishDatum({ m1: stationCp, m2: backCp, originE: 1000, originN: 1000 });
      svc.datum = datum;

      assignCoordinates(stationCp, { E: datum.originE, N: datum.originN, source: SOURCE.ARBITRARY });
      const p = polarPoint(datum.originE, datum.originN, datum.azimuthM1M2, measured);
      assignCoordinates(backCp, { E: p.E, N: p.N, source: SOURCE.IRRADIATED });
      surveyed.set(backCp.id, { id: backCp.id, label: backCp.label, E: p.E, N: p.N, sights: 1 });
    } else if (stationCp.E == null) {
      return { ok: false, reason: 'stationNotCoordinated' };
    } else if (backCp.E == null) {
      return { ok: false, reason: 'backsightNotCoordinated' };
    }

    const setup = setupOverKnownPoint({
      over: stationCp,
      backsight: backCp,
      kit: kit(),
      rng,
      orientMode,
    });
    setup.parcelId = svc.parcelId;
    store.addSetup(setup);
    bus.emit(EV.STATION_SET, setup);
    return { ok: true, setup, datum };
  }

  /**
   * Which coordinated points could be sighted from a spot on open ground.
   *
   * The free station's whole precondition, answerable BEFORE the tripod goes
   * down — so the dialog can say "3 pontos conhecidos visíveis daqui" instead of
   * letting the player commit and then refusing. `setupFreeStation` uses it too,
   * so what the dialog promises and what the setup requires are the same list.
   */
  function visibleKnownPoints(playerPos, { maxDist = 320 } = {}) {
    const world = getWorld();
    if (!playerPos || !world) return [];
    const from = { e: playerPos.e, n: playerPos.n };
    const out = [];
    for (const cp of state().network) {
      if (cp.E == null) continue;
      const target = truePositionOf(cp.id);
      if (!target) continue;
      const d = Math.hypot(target.trueE - from.e, target.trueN - from.n);
      if (d > maxDist || d < 0.5) continue;
      const los = world.lineOfSight(from, { e: target.trueE, n: target.trueN }, { targetId: cp.id });
      if (!los.clear) continue;
      out.push({ id: cp.id, label: cp.label, distance: d });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Free station: stand anywhere sensible, sight two or more known points, and
   * let the Helmert fit tell you where you are.
   */
  function setupFreeStation({ targets, playerPos }) {
    const svc = service();
    if (!svc) return { ok: false, reason: 'noService' };

    const world = getWorld();
    const tripod = world.canSetupTripod(playerPos.e, playerPos.n);
    if (!tripod.ok) return { ok: false, reason: tripod.reason, detail: tripod.detail };

    // Default to what can actually be seen from here, which is the same list
    // the dialog counted. An explicit `targets` stays possible for the probe.
    const ids = targets ?? visibleKnownPoints(playerPos).map((p) => p.id);

    const known = {};
    const usable = [];
    for (const id of ids) {
      const k = knownPositionOf(id);
      if (!k) continue;
      known[id] = { E: k.E, N: k.N };
      usable.push(id);
    }
    if (usable.length < 2) return { ok: false, reason: 'needTwoKnownPoints' };

    // A provisional setup: true position known to the simulation, coordinates not.
    const circleOffset = rng.range(0, 360);
    const provisional = {
      id: 'provisional',
      E: 0,
      N: 0,
      trueE: playerPos.e,
      trueN: playerPos.n,
      circleOffset,
      theta0: 0,
      observations: [],
    };

    const raw = [];
    for (const id of usable) {
      const target = truePositionOf(id);
      const los = world.lineOfSight(
        { e: provisional.trueE, n: provisional.trueN },
        { e: target.trueE, n: target.trueN },
        { targetId: id },
      );
      if (!los.clear) continue;
      const obs = sightTarget({ setup: provisional, target, kit: kit(), rng });
      provisional.observations.push(obs);
      raw.push({ targetId: id, hz: obs.hz, distance: obs.distance });
    }
    if (raw.length < 2) return { ok: false, reason: 'notEnoughVisible' };

    const solution = solveResection(raw, known);
    if (!solution.ok) return { ok: false, reason: solution.reason };

    const setup = {
      id: `st-free-${svc.setups.length + 1}`,
      mode: 'free',
      overId: null,
      backsightId: null,
      orientMode: ORIENT.ARBITRARY,
      E: solution.E,
      N: solution.N,
      trueE: provisional.trueE,
      trueN: provisional.trueN,
      circleOffset,
      theta0: solution.theta0,
      resection: solution,
      instrumentId: kit().instrument.id,
      parcelId: svc.parcelId,
      observations: [],
    };

    // The sights used to fix the station are legitimate observations too.
    for (const o of reduceFreeStation(solution, provisional.observations)) {
      const rec = { ...o, setupId: setup.id };
      setup.observations.push(rec);
      store.addObservation(rec);
    }

    store.addSetup(setup);
    bus.emit(EV.STATION_SET, setup);
    return { ok: true, setup, resection: solution };
  }

  const currentSetup = () => store.currentSetup();

  // --------------------------------------------------------------- sighting --

  /** What the instrument could be pointed at from where it stands. */
  function visibleTargets({ maxDist = 320 } = {}) {
    const setup = currentSetup();
    const world = getWorld();
    if (!setup) return [];
    const from = { e: setup.trueE, n: setup.trueN };
    const out = [];
    for (const ent of world.spatial.queryCircle(from.e, from.n, maxDist)) {
      if (!ent.targetable) continue;
      const d = Math.hypot(ent.e - from.e, ent.n - from.n);
      if (d > maxDist || d < 0.5) continue;
      if (ent.hidden) continue;
      const los = world.lineOfSight(from, { e: ent.e, n: ent.n }, { targetId: ent.id });
      out.push({ entity: ent, distance: d, clear: los.clear, blockers: los.blockers });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  /**
   * One sight. A blocked line of sight is a refusal with a named obstacle, not
   * a silently wrong number — that lesson is the reason obstacles exist.
   */
  function sight(targetId, { manual = true, twoFace = null } = {}) {
    const setup = currentSetup();
    if (!setup) return { ok: false, reason: 'noStation' };

    // You have to be behind the eyepiece. Ligeirinho carries the prism to the
    // point; the reading is taken from the instrument, by you.
    const here = atInstrument(setup);
    if (!here.ok) return { ok: false, reason: 'notAtInstrument', detail: { dist: here.distance.toFixed(1) } };

    const world = getWorld();
    const target = truePositionOf(targetId);
    if (!target) return { ok: false, reason: 'unknownTarget' };

    const from = { e: setup.trueE, n: setup.trueN };
    const to = { e: target.trueE, n: target.trueN };
    const los = world.lineOfSight(from, to, { targetId });
    if (!los.clear) {
      const blocker = los.blockers[0];
      bus.emit(EV.LOS_BLOCKED, { from, to, at: blocker.at, kind: blocker.kind });
      return { ok: false, reason: 'blocked', blocked: true, blockers: los.blockers, kind: blocker.kind };
    }

    // Two faces by default once the player has switched it on: it is a
    // per-sight choice, so a rushed single-face survey stays possible — and
    // measurably worse, because collimation never averages out.
    const obs = sightTarget({
      setup,
      target,
      kit: kit(),
      rng,
      label: target.label,
      twoFace: twoFace ?? Boolean(state().settings.twoFace),
    });
    setup.observations.push(obs);
    store.addObservation(obs);
    if (manual) service().manualSights = (service().manualSights || 0) + 1;

    // Fold the new reduction into this point's running mean.
    const prev = surveyed.get(targetId);
    if (prev) {
      const k = prev.sights + 1;
      surveyed.set(targetId, {
        ...prev,
        E: (prev.E * prev.sights + obs.E) / k,
        N: (prev.N * prev.sights + obs.N) / k,
        sights: k,
      });
    } else {
      surveyed.set(targetId, { id: targetId, label: target.label, E: obs.E, N: obs.N, sights: 1 });
    }

    // A monument that has now been measured gains surveyed coordinates.
    const cp = controlPointFor(targetId);
    if (cp && cp.E == null) {
      const s = surveyed.get(targetId);
      assignCoordinates(cp, { E: s.E, N: s.N, source: SOURCE.IRRADIATED });
    }

    bus.emit(EV.OBSERVATION, obs);
    return { ok: true, observation: obs, hz: obs.hz, distance: obs.distance, azimuth: obs.azimuth };
  }

  /** Measure everything currently visible. Unlocked once the basics are learnt. */
  function measureAll({ maxDist = 320, twoFace = null } = {}) {
    const results = { measured: 0, blocked: 0, items: [] };
    for (const t of visibleTargets({ maxDist })) {
      const r = sight(t.entity.id, { manual: false, twoFace });
      if (r.ok) results.measured++;
      else results.blocked++;
      results.items.push({ id: t.entity.id, ok: r.ok, reason: r.reason });
    }
    return results;
  }

  // ------------------------------------------------------------- the parcel --

  /** Surveyed coordinates of the active parcel's corners, in ring order. */
  function surveyedRing() {
    const parcel = activeParcel();
    if (!parcel) return [];
    const ring = [];
    for (let i = 0; i < parcel.markIds.length; i++) {
      const s = surveyed.get(parcel.markIds[i]);
      if (!s) return [];
      ring.push({ id: parcel.vertices[i].id, label: parcel.vertices[i].id, E: s.E, N: s.N, sights: s.sights });
    }
    return ring;
  }

  function parcelProgress() {
    const parcel = activeParcel();
    if (!parcel) return { done: 0, total: 0, complete: false, missing: [] };
    const missing = parcel.markIds.filter((id) => !surveyed.has(id));
    return {
      done: parcel.markIds.length - missing.length,
      total: parcel.markIds.length,
      complete: missing.length === 0,
      missing,
    };
  }

  // ------------------------------------------------------------- the traverse -

  /**
   * Build a closed traverse from the stations the player occupied.
   *
   * A station contributes an angle only if it sighted BOTH its neighbours in
   * the loop — which is exactly the discipline a real traverse demands, and the
   * panel says so when the data is not there yet.
   */
  function buildTraverseInput() {
    const svc = service();
    if (!svc) return { ok: false, reason: 'noService' };

    // Every occupation of every monument, grouped by monument, in the order the
    // monuments were first occupied.
    const occupationOrder = [];
    const byStation = new Map();
    for (const s of svc.setups) {
      if (s.mode !== 'known' || !s.overId) continue;
      if (!byStation.has(s.overId)) {
        byStation.set(s.overId, []);
        occupationOrder.push(s.overId);
      }
      byStation.get(s.overId).push(s);
    }
    const loop = occupationOrder.map((id) => ({ id, setups: byStation.get(id) }));
    if (loop.length < 3) return { ok: false, reason: 'needThreeStations', have: loop.length };

    // Sights are recorded against the world entity (`marco-M3`), while the loop
    // is keyed by control point (`M3`), so accept either spelling.
    const readingTo = (setup, pointId) => {
      const entityId = entityIdForPoint(pointId);
      const hits = setup.observations.filter((o) => o.targetId === pointId || o.targetId === entityId);
      return hits.length ? hits[hits.length - 1] : null;
    };

    /**
     * An angle is the difference of two circle readings, so both must come from
     * the SAME occupation — each setup has its own arbitrary circle zero, and
     * mixing readings across two setups would silently produce nonsense. So
     * pick, per station, an occupation that saw both of its loop neighbours.
     */
    const occupationSeeingBoth = (station, backId, fwdId) => {
      for (const setup of station.setups) {
        const oBack = readingTo(setup, backId);
        const oFwd = readingTo(setup, fwdId);
        if (oBack && oFwd) return { setup, oBack, oFwd };
      }
      return null;
    };

    /** Does this cyclic ordering give every station a usable angle? */
    const picksFor = (order) => {
      const out = [];
      for (let i = 0; i < order.length; i++) {
        const pick = occupationSeeingBoth(
          order[i],
          order[(i - 1 + order.length) % order.length].id,
          order[(i + 1) % order.length].id,
        );
        if (!pick) return null;
        out.push(pick);
      }
      return out;
    };

    /**
     * The order the player happened to occupy the monuments in is NOT
     * necessarily a traverse: two consecutive occupations may have a rock or a
     * stand of trees between them, so no angle exists there. Rather than make
     * the player guess the right sequence, work out which closed loop their
     * observations actually support.
     *
     * The candidate that matters most is the stations sorted by bearing around
     * their own centroid: that is guaranteed to be a SIMPLE polygon, and a
     * simple polygon is the only kind whose angles obey (n∓2)·180°. A crossing
     * loop can still satisfy every "saw both neighbours" check while closing at
     * something absurd like 1:4, so geometry is checked, not just visibility.
     */
    /** Always the SURVEYED coordinate, never one this function's own output moved. */
    const radiated = (cp) => (cp && cp.radiatedE != null ? { E: cp.radiatedE, N: cp.radiatedN } : cp);

    const coordOf = (station) => {
      const cp = radiated(store.findControlPoint(station.id));
      return cp && cp.E != null ? { E: cp.E, N: cp.N } : null;
    };

    const simple = (candidate) => {
      const pts = candidate.map(coordOf);
      if (pts.some((p) => !p)) return false;
      return !isSelfIntersecting(pts.map((p) => [p.E, p.N]));
    };

    const byBearing = () => {
      const withCoords = loop.map((s) => ({ s, c: coordOf(s) })).filter((x) => x.c);
      if (withCoords.length !== loop.length) return null;
      const cE = withCoords.reduce((t, x) => t + x.c.E, 0) / withCoords.length;
      const cN = withCoords.reduce((t, x) => t + x.c.N, 0) / withCoords.length;
      return withCoords
        .map((x) => ({ ...x, a: Math.atan2(x.c.E - cE, x.c.N - cN) }))
        .sort((p, q) => p.a - q.a)
        .map((x) => x.s);
    };

    const legLength = (a, b) => {
      for (const s of a.setups) {
        const o = readingTo(s, b.id);
        if (o) return o.distance;
      }
      return Infinity;
    };
    const loopLength = (candidate) =>
      candidate.reduce((sum, s, i) => sum + legLength(s, candidate[(i + 1) % candidate.length]), 0);

    let order = null;
    let picks = null;
    /** Stations left out of the closed figure, reported to the player. */
    let dropped = 0;

    for (const candidate of [byBearing(), loop]) {
      if (!candidate) continue;
      const p = picksFor(candidate);
      if (p && simple(candidate)) {
        order = candidate;
        picks = p;
        break;
      }
    }

    if (!picks && loop.length <= 8) {
      // A cycle is rotation-invariant, so pin the first station and permute the
      // rest: 7! at the very most, and typically far fewer. Only simple
      // polygons are eligible; among those, the shortest wins.
      let best = null;
      let bestLen = Infinity;
      const permute = (rest, acc) => {
        if (!rest.length) {
          const candidate = [loop[0], ...acc];
          if (picksFor(candidate) && simple(candidate)) {
            const len = loopLength(candidate);
            if (len < bestLen) {
              bestLen = len;
              best = candidate;
            }
          }
          return;
        }
        for (let i = 0; i < rest.length; i++) {
          permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]]);
        }
      };
      permute(loop.slice(1), []);
      if (best) {
        order = best;
        picks = picksFor(order);
      }
    }

    /**
     * Last resort: drop the stations that break the chain and close a traverse
     * around what is left.
     *
     * Occupying twelve stations and finding that one pair could not see each
     * other should not cost the player the entire computation — a real surveyor
     * would simply run the polygon through the stations that do connect. Each
     * pass removes one offender and re-tests, because removing a station makes
     * its two neighbours adjacent and may open a new gap.
     */
    if (!picks) {
      // Breadth-first over "remove one station", keeping the LARGEST subset
      // that closes. Greedily dropping the first offender cascades: removing a
      // station makes its two neighbours adjacent, and that new pair very often
      // was never measured together either, so a single bad choice early can
      // eat the whole figure. Exploring a few alternatives at each level costs
      // almost nothing and recovers traverses the greedy walk throws away.
      const seen = new Set();
      const queue = [byBearing() || loop];
      let examined = 0;

      while (queue.length && examined < 60) {
        const cur = queue.shift();
        if (cur.length < 3) continue;
        const fingerprint = cur.map((s) => s.id).join(',');
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        examined++;

        const p = picksFor(cur);
        if (p && simple(cur)) {
          order = cur;
          picks = p;
          dropped = loop.length - cur.length;
          break;
        }
        if (cur.length === 3) continue;

        // Branch on every station that cannot see both of its neighbours.
        for (let i = 0; i < cur.length; i++) {
          const back = cur[(i - 1 + cur.length) % cur.length];
          const fwd = cur[(i + 1) % cur.length];
          if (occupationSeeingBoth(cur[i], back.id, fwd.id)) continue;
          queue.push(cur.filter((_, k) => k !== i));
        }
      }
    }

    if (!picks) {
      // Report against the occupation order, which is what the player sees.
      const missing = [];
      for (let i = 0; i < loop.length; i++) {
        const here = loop[i];
        const back = loop[(i - 1 + loop.length) % loop.length];
        const fwd = loop[(i + 1) % loop.length];
        if (occupationSeeingBoth(here, back.id, fwd.id)) continue;
        const sawBack = here.setups.some((s) => readingTo(s, back.id));
        const sawFwd = here.setups.some((s) => readingTo(s, fwd.id));
        missing.push({
          station: here.id,
          needs: [!sawBack ? back.id : null, !sawFwd ? fwd.id : null].filter(Boolean),
          sameSetup: sawBack && sawFwd,
        });
      }
      return { ok: false, reason: 'incompleteAngles', missing };
    }

    const angles = [];
    const distances = [];

    for (let i = 0; i < order.length; i++) {
      const here = order[i];
      const fwd = order[(i + 1) % order.length];
      const pick = picks[i];

      angles.push(normalize360(pick.oFwd.hz - pick.oBack.hz));

      // Prefer this station's own measurement of the leg ahead; average with
      // the far end's measurement of the same leg when both exist.
      const dHere = pick.oFwd.distance;
      const dThere = fwd.setups.map((s) => readingTo(s, here.id)?.distance).find((d) => d != null);
      distances.push(dThere != null ? (dHere + dThere) / 2 : dHere);
    }

    if (distances.some((d) => d == null || !Number.isFinite(d))) {
      return { ok: false, reason: 'incompleteDistances' };
    }

    // `order` is the loop that was actually solved, which may be a reordering
    // of the occupation sequence.
    const first = radiated(store.findControlPoint(order[0].id));
    const second = radiated(store.findControlPoint(order[1].id));
    if (!first || first.E == null || !second || second.E == null) {
      return { ok: false, reason: 'noStartCoordinates' };
    }

    return {
      ok: true,
      reordered: order !== loop,
      dropped,
      stations: order.map((s) => ({ id: s.id })),
      angles,
      distances,
      startPoint: { E: first.E, N: first.N },
      startAzimuth: azimuth(first.E, first.N, second.E, second.N),
    };
  }

  function runTraverse({ rule = null } = {}) {
    const input = buildTraverseInput();
    if (!input.ok) return input;

    const inst = kit().instrument;
    const result = computeTraverse({
      stations: input.stations,
      angles: input.angles,
      distances: input.distances,
      startPoint: input.startPoint,
      startAzimuth: input.startAzimuth,
      rule: rule || state().settings.compRule || RULE.BOWDITCH,
      sigmaDirSec: inst.sigmaDirSec,
    });

    if (result.ok) {
      service().traverse = result;
      // Compensated station coordinates replace the radiated ones.
      for (const c of result.coords) {
        const cp = store.findControlPoint(c.id);
        if (cp) assignCoordinates(cp, { E: c.E, N: c.N, source: SOURCE.TRAVERSE });
      }
      result.reradiated = reradiate(result);
      bus.emit(EV.TRAVERSE_COMPUTED, result);
    }
    return result;
  }

  /**
   * Reduce the detail again, from the network the compensation just produced.
   *
   * Without this the whole cálculos panel was theatre. Compensation moved the
   * STATIONS and stopped there, while every boundary corner kept the coordinate
   * it had been radiated to from the unadjusted ones — so switching Bowditch to
   * transit redistributed corrections that could not reach the planta, the
   * memorial, the area or the score. Measured on a clean survey: stations moved
   * up to 5 mm, corners moved 0.0000 m, and the delivered area was identical to
   * the last millimetre.
   *
   * The orientation comes from INVERTING the adjusted coordinates rather than
   * from the traverse's own leg azimuths, and deliberately: `coords` is the
   * coordinate set being delivered, so detail reduced from it has to be
   * consistent with it. It is also exactly the hand method — inverse the
   * adjusted coordinates for the azimuth to the ré, then re-radiate.
   *
   * Setups outside the loop — a free station, a monument occupied once and
   * never closed through — are left exactly as they were. Nothing adjusted
   * them, so nothing here may pretend it did.
   */
  function reradiate(result) {
    const svc = service();
    const adjusted = new Map(result.coords.map((c) => [c.id, c]));
    const done = [];
    const skipped = [];

    for (const setup of svc.setups) {
      const at = setup.mode === 'known' ? adjusted.get(setup.overId) : null;
      if (!at) {
        // Named rather than passed over in silence: a student looking at a
        // compensated coordinate list is entitled to know which of their
        // occupations the compensation did not reach.
        if (setup.observations.length) {
          skipped.push({ id: setup.id, over: setup.overId, mode: setup.mode, n: setup.observations.length });
        }
        continue;
      }

      // The ré's adjusted position — from the loop if it is in it, otherwise
      // from the network, which the loop has just rewritten anyway.
      const bs = adjusted.get(setup.backsightId) || knownPositionOf(setup.backsightId);
      if (!bs || bs.E == null) continue;

      const theta0 = normalize360(azimuth(at.E, at.N, bs.E, bs.N) - setup.backsightReading);
      for (const o of setup.observations) {
        const az = normalize360(o.hz + theta0);
        const p = polarPoint(at.E, at.N, az, o.distance);
        // The observed reduction is left standing. A field book records what
        // was measured and what it gave at the time; overwriting it would also
        // mean a second run of the traverse compounded on the first instead of
        // recomputing from the observations.
        o.adjE = p.E;
        o.adjN = p.N;
        o.adjAzimuth = az;
      }
      done.push({ id: setup.id, over: setup.overId, n: setup.observations.length });
    }

    // Every reduction that feeds a coordinate goes through one cache, so
    // rebuilding it here is what carries the adjustment into the ring, the
    // area, the documents and the score.
    surveyed = new Map();
    for (const p of reducedPoints(svc.observations)) {
      surveyed.set(p.id, { id: p.id, label: p.label, E: p.E, N: p.N, sights: p.sights });
    }

    return { adjusted: done, skipped };
  }

  // -------------------------------------------------------------- delivery ---

  /** Area, perimeter and the side table the planta and memorial both consume. */
  function parcelReport(lang = 'pt') {
    const parcel = activeParcel();
    const ring = surveyedRing();
    if (!parcel || ring.length < 3) return null;

    const area = areaOf(ring);
    const sides = sideTable(ring, (i) => parcel.confrontanteFor(i, lang));
    return {
      parcel,
      vertices: ring,
      sides,
      area,
      perimeter: perimeterOf(ring),
      datum: service()?.datum || null,
      traverse: service()?.traverse || null,
    };
  }

  /**
   * How well the player actually did. Compared on datum-invariant quantities —
   * area, perimeter, individual side lengths — because the arbitrary origin and
   * rotation would otherwise dominate any coordinate comparison and tell the
   * player nothing about their measuring.
   */
  function debrief() {
    const parcel = activeParcel();
    const ring = surveyedRing();
    if (!parcel || ring.length < 3) return null;

    const truth = parcel.vertices.map((v) => ({ id: v.id, E: v.e, N: v.n }));
    const areaTrue = areaOf(truth);
    const areaSurveyed = areaOf(ring);
    const perimTrue = perimeterOf(truth);
    const perimSurveyed = perimeterOf(ring);

    const sideErrors = [];
    for (let i = 0; i < truth.length; i++) {
      const j = (i + 1) % truth.length;
      const dTrue = distance(truth[i].E, truth[i].N, truth[j].E, truth[j].N);
      const dObs = distance(ring[i].E, ring[i].N, ring[j].E, ring[j].N);
      sideErrors.push(dObs - dTrue);
    }
    const sideRms = Math.sqrt(sideErrors.reduce((s, v) => s + v * v, 0) / sideErrors.length);

    // ---- where the error actually went --------------------------------------
    //
    // Area, perimeter and the side RMS are datum-invariant, which is why they
    // came first and why they stay: they answer "how good was the survey?"
    // without needing the frames aligned at all. They cannot answer "which
    // corner did I get wrong?", and that is the question a student is left
    // holding. `accuracyReport` was written for it and had never been called.
    //
    // The alignment is a pure translation — see `datumShift` — fitted on the
    // control network rather than on the corners, so a corner's own error
    // cannot leak into the shift and hide itself.
    const shift = datumShift(state().network);
    const control = accuracyReport(state().network, shift);
    const corners = ring.map((p, i) => {
      const dE = p.E - shift.dE - truth[i].E;
      const dN = p.N - shift.dN - truth[i].N;
      return { id: p.id, label: p.label || p.id, E: p.E, N: p.N, dE, dN, d: Math.hypot(dE, dN), sights: p.sights ?? 0 };
    });
    const cornerRms = Math.sqrt(corners.reduce((s, c) => s + c.d * c.d, 0) / corners.length);
    const worstCorner = corners.reduce((w, c) => (w === null || c.d > w.d ? c : w), null);

    return {
      areaTrue: areaTrue.m2,
      areaSurveyed: areaSurveyed.m2,
      areaErrorM2: areaSurveyed.m2 - areaTrue.m2,
      areaErrorPct: ((areaSurveyed.m2 - areaTrue.m2) / areaTrue.m2) * 100,
      perimeterTrue: perimTrue,
      perimeterSurveyed: perimSurveyed,
      perimeterError: perimSurveyed - perimTrue,
      sideRms,
      sideErrors,
      /** Per-corner, in the aligned frame: the answer to "which one?". */
      corners,
      cornerRms,
      worstCorner,
      control,
      datumShift: shift,
    };
  }

  /**
   * The itemised payment. Lives in `game/economy.js` so the numbers can be
   * tested without a browser and so the shop and the job board quote from the
   * same formula the delivery screen pays out.
   */
  function computePayment({ parcel, quality, elapsedMs, marcosUsed }) {
    return paymentBreakdown({
      parcel,
      quality,
      elapsedMs,
      difficulty: store.difficulty(),
      marcosUsed,
      marcoUnitPrice: MARCOS[0].unitPrice,
      overtimeMs: clock().overtimeMs,
    });
  }

  /**
   * The job against its time budget. Untimed on fácil and médio, where
   * `budgetFor` returns null and every field degrades to "plenty of time".
   */
  function clock() {
    const svc = service();
    const parcel = activeParcel();
    if (!svc || !parcel) return clockState(0, null);
    return clockState(svc.elapsedMs, budgetFor(parcel, store.difficulty()));
  }

  /**
   * Draw up the documents and score the job — WITHOUT paying for it.
   *
   * Delivery and payment are two moments now, because the owner is a person who
   * lives somewhere: you finish the paperwork wherever you are standing, and
   * then you walk to the sede and he settles up. So this produces everything and
   * changes no money; `collectPayment` is the other half.
   *
   * Deterministic, and deliberately re-runnable: a save records only that the
   * job was delivered, and this rebuilds the identical result from the stored
   * observations on reload rather than persisting a whole report.
   */
  function deliver() {
    const result = scoreJob();
    if (!result.ok) return result;
    const svc = service();
    svc.delivered = true;
    return result;
  }

  /**
   * The owner pays. Only once, and only for a job that was actually delivered.
   */
  function collectPayment() {
    const svc = service();
    if (!svc) return { ok: false, reason: 'noService' };
    if (!svc.delivered) return { ok: false, reason: 'notDelivered' };
    if (svc.completed) return { ok: false, reason: 'alreadyPaid' };

    const result = scoreJob();
    if (!result.ok) return result;
    store.finishService(result);
    return result;
  }

  /**
   * Score the job and build the report payload. Pure: it banks nothing and
   * completes nothing, so it can be called for the delivery screen and again
   * for the payment screen and give the same answer both times.
   */
  function scoreJob() {
    const svc = service();
    const parcel = activeParcel();
    if (!svc || !parcel) return { ok: false, reason: 'noService' };

    const progress = parcelProgress();
    if (!progress.complete) return { ok: false, reason: 'parcelIncomplete', progress };

    const report = parcelReport(state().lang);
    const scores = debrief();
    const traverse = svc.traverse;

    // Quality: mostly how well the area came out, tempered by the traverse
    // closure when the player bothered to run one.
    const areaScore = Math.max(0, 1 - Math.abs(scores.areaErrorPct) / 2);
    const closureScore = traverse?.ok
      ? Math.max(0, Math.min(1, traverse.relDenominator / (1 / store.difficulty().requiredPrecision)))
      : 0.5;
    const quality = Math.max(0, Math.min(1, areaScore * 0.7 + closureScore * 0.3));

    const breakdown = computePayment({
      parcel,
      quality,
      elapsedMs: svc.elapsedMs,
      marcosUsed: svc.marcos.length,
    });

    const result = {
      ok: true,
      parcelId: parcel.id,
      elapsedMs: svc.elapsedMs,
      area: report.area,
      perimeter: report.perimeter,
      closure: traverse?.ok
        ? { eAngSec: traverse.eAngSec, eLin: traverse.eLin, relDenominator: traverse.relDenominator }
        : null,
      quality,
      payment: breakdown.total,
      breakdown,
      debrief: scores,
      report,
    };

    return result;
  }

  return {
    clock,
    start,
    placeMarco,
    canPlaceMarco,
    canOccupy,
    visibleKnownPoints,
    setupStation,
    setupFreeStation,
    sight,
    measureAll,
    visibleTargets,
    /** Exposed so the tool rail and the click handler judge by the same rule. */
    atInstrument: () => atInstrument(currentSetup()),
    surveyedRing,
    surveyedPoints: () => [...surveyed.values()],
    parcelProgress,
    activeParcel,
    currentSetup,
    buildTraverseInput,
    runTraverse,
    parcelReport,
    debrief,
    deliver,
    collectPayment,
    /** The score and the documents, banking nothing. Safe to call twice. */
    scoreJob,
    knownPositionOf,
    truePositionOf,
    /** Restore the reduction cache after a save is reloaded. */
    rehydrate() {
      const svc = service();
      if (!svc) return;
      rng = makeRng(state().seed, `obs:${svc.id}`);
      surveyed = new Map();
      for (const p of reducedPoints(svc.observations)) {
        surveyed.set(p.id, { id: p.id, label: p.label, E: p.E, N: p.N, sights: p.sights });
      }

      // Put the player's own monuments back INTO the world.
      //
      // A save stores the seed, not the valley, so the world is regenerated
      // from scratch — and a regenerated valley has no marcos in it, because
      // the player planted those. The control points came back above and so did
      // their labels, which is why this went unnoticed: the network panel and
      // the plan view looked right while the monuments themselves had no entity
      // at all. No sprite on the ground, and nothing to point the instrument at,
      // so reloading mid-job quietly cost you every station you had set.
      const world = getWorld();
      if (!world) return;
      for (const cp of state().network) {
        if (cp.kind !== 'marco' || world.entity(`marco-${cp.id}`)) continue;
        world.addMarco(cp.trueE, cp.trueN, cp.id);
      }
    },
    notify,
  };
}
