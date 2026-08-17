// Versioned, defensive persistence.
//
// Language and settings live under their own keys, deliberately separate from
// the save: wiping a corrupt save must never cost the player their language
// choice. The backend is injected and falls back to an in-memory map, so this
// module imports cleanly under Node.

export const KEYS = {
  SAVE: 'sv.save.v1',
  LANG: 'sv.lang',
  SETTINGS: 'sv.settings',
};

export const SAVE_VERSION = 2;

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function defaultBackend() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryBackend();
    // Safari private mode has localStorage but throws on write.
    const probe = '__sv_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryBackend();
  }
}

export function makeStorage(backend = defaultBackend()) {
  let saveTimer = null;

  function readJSON(key, fallback = null) {
    try {
      const raw = backend.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      // Quota exceeded, or storage disabled entirely. Not fatal: the game keeps
      // playing, the player just loses persistence.
      console.warn('[storage] write failed for', key, err);
      return false;
    }
  }

  /**
   * Chain of version migrations. Each entry takes a save at version N and
   * returns one at N+1.
   */
  const migrations = {
    /**
     * v1 -> v2: one north.
     *
     * A v1 job could be surveyed in a frame ROTATED away from the map — by half
     * a degree under the compass datum, by the whole bearing to the first ré
     * under the arbitrary one. Azimuths are now referred to the map's north, so
     * a job in flight carries coordinates the new documents would caption
     * wrongly. There is no honest way to rotate it back, so the job is dropped
     * and the campaign kept: money, equipment, finished properties and every
     * monument already in the ground all survive, and only the unfinished
     * survey has to be started again in the frame that now exists.
     */
    1: (save) => ({ ...save, version: 2, activeService: null }),
  };

  function migrate(saved) {
    // A save from a NEWER build than this one cannot be understood, and there
    // is no downgrade path. This happens for real: a cached older copy of the
    // game opening a save the current build wrote. Loading it anyway means
    // running on fields this code does not know about, which is how a campaign
    // gets quietly corrupted rather than cleanly refused.
    if (saved.version > SAVE_VERSION) return null;

    let s = saved;
    while (s.version < SAVE_VERSION) {
      const step = migrations[s.version];
      if (!step) return null; // no path forward — treat as unreadable
      s = step(s);
    }
    return s;
  }

  return {
    /** Load the save, or null if absent, corrupt or unmigratable. */
    loadSave() {
      const raw = backend.getItem(KEYS.SAVE);
      if (raw == null) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        this.quarantine(raw, 'unparseable');
        return null;
      }
      if (typeof parsed !== 'object' || parsed === null || typeof parsed.version !== 'number') {
        this.quarantine(raw, 'malformed');
        return null;
      }
      if (parsed.version !== SAVE_VERSION) {
        const migrated = migrate(parsed);
        if (!migrated) {
          this.quarantine(raw, `version ${parsed.version}`);
          return null;
        }
        return migrated;
      }
      return parsed;
    },

    /** Park an unreadable payload rather than silently destroying it. */
    quarantine(raw, reason) {
      const key = `sv.save.corrupt.${Date.now()}`;
      try {
        backend.setItem(key, raw);
      } catch {
        /* nothing more we can do */
      }
      backend.removeItem(KEYS.SAVE);
      console.warn(`[storage] save quarantined under ${key} (${reason})`);
    },

    saveNow(state) {
      return writeJSON(KEYS.SAVE, state);
    },

    /** Debounced write; call freely on every mutation. */
    saveDebounced(getState, delayMs = 2000) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        writeJSON(KEYS.SAVE, getState());
      }, delayMs);
    },

    /** Force out any pending debounced write (visibilitychange, pagehide). */
    flush(getState) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      writeJSON(KEYS.SAVE, getState());
    },

    clearSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      backend.removeItem(KEYS.SAVE);
    },

    getLang() {
      const v = backend.getItem(KEYS.LANG);
      return v === 'pt' || v === 'en' ? v : null;
    },
    setLang(lang) {
      try {
        backend.setItem(KEYS.LANG, lang);
      } catch {
        /* ignore */
      }
    },

    getSettings: () => readJSON(KEYS.SETTINGS, null),
    setSettings: (s) => writeJSON(KEYS.SETTINGS, s),
  };
}

export const storage = makeStorage();
