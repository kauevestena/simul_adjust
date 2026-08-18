// Setting up the instrument, as a dialog.
//
// Two ways to fix a station, and the dialog is whichever of them the ground
// under your feet allows. Standing on a monument you occupy it and orient on a
// backsight; standing anywhere else you can still work, by sighting two or more
// points whose coordinates you already have and letting the resection tell you
// where you are. That second case used to be unreachable: the dialog refused to
// open unless a marco was within arm's reach, so estação livre was on offer
// only from the one place nobody needs it.
//
// There is no longer a choice of orientation method. Zeroing on the backsight
// is the one a surveyor can actually perform — you point at the ré and set the
// circle to zero — whereas dialling an azimuth onto the limb before pointing at
// anything is not something the instrument lets you do directly, so offering it
// taught a workflow that does not exist.
//
// The other decision only appears once, on the very first setup of a campaign,
// when nothing anywhere has a coordinate: that is the moment the local datum is
// born, and saying so is worth a line.

import { el } from './dom.js';
import { t } from './i18n.js';
import { ORIENT } from '../survey/station.js';

/**
 * @param {object} p
 * @param {object} p.modals
 * @param {Array} p.candidates   monuments within reach to occupy
 * @param {Array} p.backsights   monuments that can serve as a backsight
 * @param {boolean} p.needsDatum true on the campaign's very first setup
 * @param {boolean} [p.freeOnly] nothing to occupy here: a free station or nothing
 * @param {number} [p.visibleKnown] coordinated points in sight from this spot
 * @param {Function} p.onConfirm
 */
export function showStationDialog({
  modals,
  candidates,
  backsights,
  needsDatum,
  onConfirm,
  onFreeStation,
  canFreeStation,
  freeOnly = false,
  visibleKnown = 0,
}) {
  let over = candidates[0]?.id ?? null;
  let backsight = backsights.find((b) => b.id !== over)?.id ?? null;

  const overSelect = el(
    'select.select',
    {
      'aria-label': t('station.over'),
      onchange: (ev) => {
        over = ev.target.value;
        refreshBacksights();
      },
    },
    candidates.map((c) => el('option', { value: c.id, text: `${c.label} (${c.distance.toFixed(2)} m)` })),
  );

  const backsightSelect = el('select.select', {
    'aria-label': t('station.backsight'),
    onchange: (ev) => {
      backsight = ev.target.value;
    },
  });

  function refreshBacksights() {
    backsightSelect.innerHTML = '';
    const usable = backsights.filter((b) => b.id !== over);
    for (const b of usable) {
      backsightSelect.append(el('option', { value: b.id, text: b.label }));
    }
    backsight = usable[0]?.id ?? null;
  }
  refreshBacksights();

  // The free station block. It leads when there is nothing to occupy, and sits
  // underneath as an alternative when there is.
  const freeBlock = canFreeStation
    ? el(
        `section.free-station${freeOnly ? '.is-lead' : ''}`,
        {},
        // The modal title already carries the name when this block IS the
        // dialog, so repeating it as a heading is just noise.
        freeOnly ? null : el('h4', { text: t('station.freeStation') }),
        el('p.hint', { text: t('station.freeStationHelp') }),
        // The precondition, on screen before the click rather than as a refusal
        // after it. Two is the minimum the Helmert fit can be solved with; a
        // third is what turns an exact answer into a checked one.
        el('p.hint.free-count', { text: t('station.visibleKnown', { n: visibleKnown }) }),
        freeOnly
          ? null
          : el('button.btn.btn-ghost', {
              type: 'button',
              text: t('station.freeStation'),
              onclick: () => {
                dialog.close();
                onFreeStation?.();
              },
            }),
      )
    : null;

  const body = el(
    'div.station-dialog',
    {},
    freeOnly ? el('p.hint', { text: t('station.freeOnlyHere') }) : null,
    freeOnly ? null : el('div.field', {}, el('label', { text: t('station.over') }), overSelect),
    freeOnly ? null : el('div.field', {}, el('label', { text: t('station.backsight') }), backsightSelect),
    // One method, so it is stated rather than chosen.
    freeOnly
      ? null
      : el(
          'div.field',
          {},
          el('label', { text: t('station.orientMode') }),
          el('p.hint', {}, el('strong', { text: t('station.zeroBacksight') }), el('span', { text: ` — ${t('station.zeroBacksightHelp')}` })),
        ),
    // The first setup of a campaign births the datum. There is nothing to
    // choose about it any more — north is the map's north — but saying so is
    // worth a line, because it is the moment the coordinate system begins.
    needsDatum && !freeOnly
      ? el(
          'section.datum-block',
          {},
          el('h4', { text: t('station.datumTitle') }),
          el('p.hint', { text: t('station.datumHelp') }),
        )
      : null,
    freeBlock,
  );

  const dialog = modals.open({
    titleKey: freeOnly ? 'station.freeStation' : 'station.title',
    body,
    actions: [
      { labelKey: 'common.cancel' },
      {
        labelKey: 'common.confirm',
        primary: true,
        onClick: () =>
          freeOnly
            ? onFreeStation?.()
            : onConfirm({
                over,
                backsight,
                orientMode: ORIENT.ZERO_BACKSIGHT,
              }),
      },
    ],
  });

  return dialog;
}
