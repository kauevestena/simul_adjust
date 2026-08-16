// Minimal pub/sub. Lets subsystems talk without importing each other:
// the renderer never reaches into the survey layer, it just listens.

export function makeBus() {
  const handlers = new Map();

  return {
    /** Subscribe. Returns an unsubscribe function. */
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => this.off(event, fn);
    },

    off(event, fn) {
      handlers.get(event)?.delete(fn);
    },

    /** Subscribe for a single delivery. */
    once(event, fn) {
      const off = this.on(event, (payload) => {
        off();
        fn(payload);
      });
      return off;
    },

    /**
     * Publish. A throwing listener is reported but never stops the others,
     * so one broken panel cannot freeze the game loop.
     */
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[bus] listener for "${event}" threw:`, err);
        }
      }
    },

    clear() {
      handlers.clear();
    },
  };
}

/** The single application-wide bus. */
export const bus = makeBus();

// Event names, collected here so a typo is a missing import rather than a
// silently dead listener.
export const EV = {
  LANG_CHANGED: 'lang:changed',
  STATE_CHANGED: 'state:changed',
  TOOL_CHANGED: 'tool:changed',
  MARCO_PLACED: 'marco:placed',
  STATION_SET: 'station:set',
  OBSERVATION: 'observation:recorded',
  LOS_BLOCKED: 'los:blocked',
  NOTIFY: 'notify',
  TUTORIAL: 'tutorial:advanced',
  SERVICE_STARTED: 'service:started',
  SERVICE_FINISHED: 'service:finished',
  TRAVERSE_COMPUTED: 'traverse:computed',
  CAMERA_ZOOM: 'camera:zoom',
};
