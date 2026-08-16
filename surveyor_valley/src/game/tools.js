// The tool rail, and the single place an action is authorized.
//
// `canActivate` returns both the verdict and the REASON. The toolbar renders
// its disabled state and its tooltip from that same result, so there is exactly
// one description of why you cannot do something — no chance of a button that
// looks available and silently refuses, or a tooltip that has drifted out of
// date with the rule it is describing.

export const TOOL = {
  WALK: 'walk',
  MARCO: 'marco',
  ESTACAO: 'estacao',
  VISADA: 'visada',
  CADERNETA: 'caderneta',
  CALCULOS: 'calculos',
  MAPA: 'mapa',
  ENTREGA: 'entrega',
};

export const TOOL_ORDER = [
  TOOL.WALK,
  TOOL.MARCO,
  TOOL.ESTACAO,
  TOOL.VISADA,
  TOOL.CADERNETA,
  TOOL.CALCULOS,
  TOOL.MAPA,
  TOOL.ENTREGA,
];

export const TOOL_KEYS = {
  1: TOOL.WALK,
  2: TOOL.MARCO,
  3: TOOL.ESTACAO,
  4: TOOL.VISADA,
  5: TOOL.CADERNETA,
  6: TOOL.CALCULOS,
  7: TOOL.ENTREGA,
  m: TOOL.MAPA,
  M: TOOL.MAPA,
};

/** Tools that open a panel rather than changing what a click on the map does. */
export const PANEL_TOOLS = new Set([TOOL.CADERNETA, TOOL.CALCULOS, TOOL.MAPA, TOOL.ENTREGA]);

export function makeTools({ getContext, bus, EV }) {
  let active = TOOL.WALK;

  /**
   * @returns {{ok:boolean, reasonKey:string|null}}
   *          `reasonKey` is an i18n key, never a rendered string.
   */
  function canActivate(tool) {
    const c = getContext();
    const ok = { ok: true, reasonKey: null };
    const no = (reasonKey) => ({ ok: false, reasonKey });

    if (!c.world || !c.service) return no('tip.noService');

    switch (tool) {
      case TOOL.WALK:
      case TOOL.MAPA:
        return ok;

      case TOOL.MARCO:
        if (c.inventory.marcos <= 0) return no('tip.noMarcosLeft');
        return ok;

      case TOOL.ESTACAO: {
        // The forced tutorial: two monuments before an instrument can be oriented.
        if (c.knownOrPlacedMarcos < 2) return no('tip.needTwoMarcos');
        return ok;
      }

      case TOOL.VISADA:
        if (!c.station) return no('tip.needStation');
        return ok;

      case TOOL.CADERNETA:
        if (c.observationCount === 0) return no('tip.noObservations');
        return ok;

      case TOOL.CALCULOS:
        if (c.setupCount < 3) return no('tip.needThreeSetups');
        return ok;

      case TOOL.ENTREGA:
        if (!c.parcelSurveyed) return no('tip.parcelIncomplete');
        return ok;

      default:
        return no('tip.unknownTool');
    }
  }

  function activate(tool) {
    const verdict = canActivate(tool);
    if (!verdict.ok) {
      bus.emit(EV.NOTIFY, { kind: 'warn', key: verdict.reasonKey });
      return verdict;
    }
    // Panels do not take over the map cursor; they open and leave the mode alone.
    if (!PANEL_TOOLS.has(tool)) active = tool;
    bus.emit(EV.TOOL_CHANGED, { tool, panel: PANEL_TOOLS.has(tool) });
    return verdict;
  }

  return {
    canActivate,
    activate,
    get active() {
      return active;
    },
    reset() {
      active = TOOL.WALK;
      bus.emit(EV.TOOL_CHANGED, { tool: active, panel: false });
    },
    /** Verdicts for every tool at once, for rendering the rail. */
    survey() {
      return TOOL_ORDER.map((t) => ({ tool: t, ...canActivate(t) }));
    },
  };
}
