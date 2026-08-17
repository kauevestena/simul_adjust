// The canonical game state and its mutators.
//
// One rule holds the whole design together: a marco the player drops has *true*
// coordinates (where they actually stood) but no *known* coordinates until it
// has been surveyed. The player only ever sees surveyed values. Truth lives in
// the world, never in the state the player reads, and is revealed only in the
// end-of-service debrief as a score.

import { SAVE_VERSION } from './storage.js';
import { bus, EV } from './bus.js';

/**
 * The required relative precisions came down with the parcels, and they had to.
 *
 * Linear closure error is built from things that do not shrink: 2.5 mm of
 * instrument centring, 5.0 mm of target centring, the EDM's 10 mm constant.
 * Relative precision is perimeter over that error, so it degrades in direct
 * proportion to the figure — shrinking a parcel to a third of its area makes a
 * fixed 1:X requirement about 1.7x harder to meet, not easier.
 *
 * These numbers look loose for cadastral work, and they are — honestly so. A
 * 30-50 m parcel closed with a 10" instrument, 2.5 mm of centring and a 10 mm
 * EDM constant cannot do better; that relative precision falls with the size of
 * the figure is a real surveying fact and one worth a student meeting.
 *
 * Measured over 36 completed surveys with the starter instrument at the current
 * block size: median 1:3787, worst 1:1235. Against these three that is 0%, 8%
 * and 22% of honest surveys falling short — fácil free, difícil demanding either
 * care or a better instrument, which is what the shop is for. The best survey
 * observed closed at 1:38266, so the ceiling is the kit, not the ground.
 *
 * Missing the requirement costs quality and therefore pay; it never blocks
 * delivery.
 */
export const DIFFICULTY = {
  facil: {
    id: 'facil',
    obstacleDensity: 0.4,
    cornerHiding: 0,
    timeLimit: false,
    requiredPrecision: 1 / 1000,
    payMult: 0.8,
  },
  medio: {
    id: 'medio',
    obstacleDensity: 0.85,
    cornerHiding: 0.15,
    timeLimit: false,
    requiredPrecision: 1 / 1500,
    payMult: 1.0,
  },
  dificil: {
    id: 'dificil',
    obstacleDensity: 1.35,
    cornerHiding: 0.4,
    timeLimit: true,
    requiredPrecision: 1 / 2000,
    payMult: 1.5,
  },
};

/** Time limit in seconds for a parcel, used only on `dificil`. */
export function estimateTimeLimit({ perimeter, nVertices }) {
  const walkMin = perimeter / 45; // 45 m/min including setup faff
  const stationMin = nVertices * 3.5;
  return 1.35 * (walkMin + stationMin + 6) * 60;
}

export function makeInitialState(overrides = {}) {
  return {
    version: SAVE_VERSION,
    seed: 'sv-000000',
    lang: 'pt',
    difficulty: 'medio',
    player: { name: '', money: 0, e: 0, n: 0, facing: 'S' },
    inventory: {
      instrument: 'et10',
      tripod: 'tri-mad',
      target: 'bastao',
      marcos: 12,
    },
    /** Control points, surveyed values only. Persists ACROSS services. */
    network: [],
    /** Per-parcel campaign progress, keyed by parcel id. */
    parcels: {},
    activeService: null,
    settings: {
      /** Screen pixels per metre; must be a rung of the camera's zoom ladder. */
      zoom: 32,
      /** 'dms' or 'gon'. */
      angleFormat: 'dms',
      compRule: 'bowditch',
      /** Observe both faces (PD/PI) on every sight. */
      twoFace: false,
      showGrid: false,
    },
    stats: { servicesDone: 0, totalElapsedMs: 0, totalEarned: 0 },
    ...overrides,
  };
}

export function makeActiveService(parcelId) {
  return {
    id: `svc-${Date.now().toString(36)}`,
    parcelId,
    elapsedMs: 0,
    /** ids of marcos materialized during this service */
    marcos: [],
    setups: [],
    observations: [],
    traverse: null,
    tutorialStep: 0,
    /** Sights taken manually — gates the batch-measure unlock. */
    manualSights: 0,
    datum: null,
    completed: false,
  };
}

export function makeStore(initial = makeInitialState()) {
  let state = initial;

  function notify(reason) {
    bus.emit(EV.STATE_CHANGED, { state, reason });
  }

  return {
    get() {
      return state;
    },

    /** Replace wholesale (new game, save restore). */
    replace(next, reason = 'replace') {
      state = next;
      notify(reason);
    },

    /**
     * Shallow-merge a patch at the top level and announce it.
     * Deliberately not a deep merge: nested updates go through the named
     * mutators below so every change has one obvious call site.
     */
    patch(partial, reason = 'patch') {
      state = { ...state, ...partial };
      notify(reason);
    },

    setLang(lang) {
      if (state.lang === lang) return;
      state.lang = lang;
      notify('lang');
    },

    setSetting(key, value) {
      state.settings[key] = value;
      notify('setting');
    },

    startService(parcelId) {
      state.activeService = makeActiveService(parcelId);
      state.parcels[parcelId] = { ...(state.parcels[parcelId] || {}), status: 'active' };
      notify('service-start');
      bus.emit(EV.SERVICE_STARTED, state.activeService);
      return state.activeService;
    },

    /** Advance the service clock. Called from the fixed update, never wall-clock. */
    tickService(dtSeconds) {
      const svc = state.activeService;
      if (!svc || svc.completed) return;
      svc.elapsedMs += dtSeconds * 1000;
    },

    /** Charge simulated walking time for a fast-travel jump. */
    chargeTravelTime(metres, realisticSpeed = 1.4) {
      const svc = state.activeService;
      if (!svc || svc.completed) return 0;
      const seconds = metres / realisticSpeed;
      svc.elapsedMs += seconds * 1000;
      return seconds;
    },

    addControlPoint(cp) {
      state.network.push(cp);
      notify('network');
      return cp;
    },

    findControlPoint(id) {
      return state.network.find((p) => p.id === id) || null;
    },

    /** Control points that already carry surveyed coordinates. */
    knownPoints() {
      return state.network.filter((p) => p.E != null && p.N != null);
    },

    addObservation(obs) {
      state.activeService?.observations.push(obs);
      bus.emit(EV.OBSERVATION, obs);
      return obs;
    },

    addSetup(setup) {
      state.activeService?.setups.push(setup);
      bus.emit(EV.STATION_SET, setup);
      return setup;
    },

    currentSetup() {
      const s = state.activeService?.setups;
      return s && s.length ? s[s.length - 1] : null;
    },

    finishService(result) {
      const svc = state.activeService;
      if (!svc) return null;
      svc.completed = true;
      state.parcels[svc.parcelId] = {
        ...(state.parcels[svc.parcelId] || {}),
        status: 'done',
        elapsedMs: svc.elapsedMs,
        payment: result.payment ?? 0,
        closure: result.closure ?? null,
      };
      state.stats.servicesDone++;
      state.stats.totalElapsedMs += svc.elapsedMs;
      state.stats.totalEarned += result.payment ?? 0;
      state.player.money += result.payment ?? 0;
      notify('service-finish');
      bus.emit(EV.SERVICE_FINISHED, result);
      return result;
    },

    difficulty() {
      return DIFFICULTY[state.difficulty] || DIFFICULTY.medio;
    },

    /** Deep copy for save/restore round-trip testing. */
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },
  };
}
