// The first service teaches itself.
//
// The brief is specific about the opening: the player MUST materialize at least
// two monuments before the instrument can be set up, because two points are
// what an orientation needs. Rather than a wall of text, the checklist advances
// as the player does the thing, and the tool rail refuses what is not yet
// possible with a reason attached.

export const STEP = {
  PLACE_FIRST_MARCO: 0,
  PLACE_SECOND_MARCO: 1,
  SET_UP_STATION: 2,
  TAKE_SIGHTS: 3,
  WALK_THE_LOOP: 4,
  COMPUTE: 5,
  DELIVER: 6,
  DONE: 7,
};

/** Manual sights required before the batch-measure convenience unlocks. */
export const MANUAL_SIGHTS_TO_UNLOCK_BATCH = 4;

const STEPS = [
  { id: STEP.PLACE_FIRST_MARCO, key: 'tutorial.placeFirstMarco' },
  { id: STEP.PLACE_SECOND_MARCO, key: 'tutorial.placeSecondMarco' },
  { id: STEP.SET_UP_STATION, key: 'tutorial.setUpStation' },
  { id: STEP.TAKE_SIGHTS, key: 'tutorial.takeSights' },
  { id: STEP.WALK_THE_LOOP, key: 'tutorial.walkTheLoop' },
  { id: STEP.COMPUTE, key: 'tutorial.compute' },
  { id: STEP.DELIVER, key: 'tutorial.deliver' },
];

export function makeTutorial({ getContext, bus, EV }) {
  /**
   * Recompute the step from the state itself rather than tracking it by hand:
   * reloading a save mid-service then lands on the right step for free.
   */
  function currentStep() {
    const c = getContext();
    if (!c.service) return STEP.PLACE_FIRST_MARCO;
    if (c.marcoCount < 1) return STEP.PLACE_FIRST_MARCO;
    if (c.marcoCount < 2) return STEP.PLACE_SECOND_MARCO;
    if (c.setupCount < 1) return STEP.SET_UP_STATION;
    if (c.observationCount < 3) return STEP.TAKE_SIGHTS;
    if (!c.parcelSurveyed) return STEP.WALK_THE_LOOP;
    if (!c.traverse) return STEP.COMPUTE;
    if (!c.service.completed) return STEP.DELIVER;
    return STEP.DONE;
  }

  function checklist() {
    const step = currentStep();
    return STEPS.map((s) => ({
      ...s,
      done: s.id < step,
      active: s.id === step,
    }));
  }

  /** Only the first service is hand-held; later ones just show the checklist. */
  const isTutorialService = () => (getContext().servicesDone ?? 0) === 0;

  function batchMeasureUnlocked() {
    const c = getContext();
    if (!isTutorialService()) return true;
    return (c.manualSights ?? 0) >= MANUAL_SIGHTS_TO_UNLOCK_BATCH;
  }

  let announced = -1;
  function refresh() {
    const step = currentStep();
    if (step !== announced) {
      announced = step;
      bus.emit(EV.TUTORIAL, { step, checklist: checklist() });
    }
    return step;
  }

  return { currentStep, checklist, refresh, isTutorialService, batchMeasureUnlocked, STEP };
}
