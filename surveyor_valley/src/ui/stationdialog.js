// Setting up the instrument, as a dialog.
//
// Two decisions live here. The everyday one is which monument to backsight and
// whether to zero on it or dial the azimuth in — both workflows are taught, so
// both are offered and the caderneta shows the difference.
//
// The other only appears once, on the very first setup of the campaign, when
// nothing anywhere has a coordinate: the player chooses whether the local datum
// is born from a compass reading (honest, good to about half a degree) or from
// simply declaring the line to the backsight to be north. The planta then
// labels its north arrow to match whichever they picked.

import { el } from './dom.js';
import { t } from './i18n.js';
import { ORIENT } from '../survey/station.js';

const radioGroup = (name, options, initial, onChange) => {
  let value = initial;
  const group = el(
    'div.radio-group',
    { role: 'radiogroup' },
    options.map((opt) =>
      el(
        `label.radio${opt.id === value ? '.is-active' : ''}`,
        {},
        el('input', {
          type: 'radio',
          name,
          value: opt.id,
          checked: opt.id === value,
          onchange: (ev) => {
            value = opt.id;
            for (const l of ev.target.closest('.radio-group').querySelectorAll('.radio')) {
              l.classList.toggle('is-active', l.querySelector('input').checked);
            }
            onChange?.(value);
          },
        }),
        el('span.radio-body', {}, el('strong', { text: opt.label }), el('span', { text: opt.help })),
      ),
    ),
  );
  return { node: group, get value() { return value; } };
};

/**
 * @param {object} p
 * @param {object} p.modals
 * @param {Array} p.candidates   monuments within reach to occupy
 * @param {Array} p.backsights   monuments that can serve as a backsight
 * @param {boolean} p.needsDatum true on the campaign's very first setup
 * @param {Function} p.onConfirm
 */
export function showStationDialog({ modals, candidates, backsights, needsDatum, onConfirm, onFreeStation, canFreeStation }) {
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

  const orient = radioGroup(
    'orient',
    [
      { id: ORIENT.ZERO_BACKSIGHT, label: t('station.zeroBacksight'), help: t('station.zeroBacksightHelp') },
      { id: ORIENT.BY_AZIMUTH, label: t('station.byAzimuth'), help: t('station.byAzimuthHelp') },
    ],
    ORIENT.ZERO_BACKSIGHT,
  );

  const body = el(
    'div.station-dialog',
    {},
    el('div.field', {}, el('label', { text: t('station.over') }), overSelect),
    el('div.field', {}, el('label', { text: t('station.backsight') }), backsightSelect),
    el('div.field', {}, el('label', { text: t('station.orientMode') }), orient.node),
    // The first setup of a campaign births the datum. There is nothing to
    // choose about it any more — north is the map's north — but saying so is
    // worth a line, because it is the moment the coordinate system begins.
    needsDatum
      ? el(
          'section.datum-block',
          {},
          el('h4', { text: t('station.datumTitle') }),
          el('p.hint', { text: t('station.datumHelp') }),
        )
      : null,
    canFreeStation
      ? el(
          'section.free-station',
          {},
          el('h4', { text: t('station.freeStation') }),
          el('p.hint', { text: t('station.freeStationHelp') }),
          el('button.btn.btn-ghost', {
            type: 'button',
            text: t('station.freeStation'),
            onclick: () => {
              dialog.close();
              onFreeStation?.();
            },
          }),
        )
      : null,
  );

  const dialog = modals.open({
    titleKey: 'station.title',
    body,
    actions: [
      { labelKey: 'common.cancel' },
      {
        labelKey: 'common.confirm',
        primary: true,
        onClick: () =>
          onConfirm({
            over,
            backsight,
            orientMode: orient.value,
          }),
      },
    ],
  });

  return dialog;
}
