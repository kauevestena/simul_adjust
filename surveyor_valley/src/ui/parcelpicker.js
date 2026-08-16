// Choosing the next job.
//
// Six properties, shown as a board of jobs on offer. The spec asks for the
// player to move from service to service and to be able to reuse control they
// have already established — so the count of reusable monuments is the most
// important number on each card. It is the whole strategy layer: taking the
// neighbouring property while your marcos are still in the ground is worth more
// than taking the biggest one.

import { el } from './dom.js';
import { t, num } from './i18n.js';
import { reusableFor } from '../survey/network.js';
import { estimatePayment } from '../game/economy.js';
import { fmtDuration } from '../survey/units.js';

/**
 * @param {object} p
 * @param {object} p.modals
 * @param {Array} p.parcels        all six, from the world
 * @param {object} p.state
 * @param {object} p.difficulty
 * @param {(parcelId:string)=>void} p.onChoose
 * @param {boolean} [p.dismissible] false while the player has no active job
 */
export function showParcelPicker({ modals, parcels, state, difficulty, onChoose, dismissible = true }) {
  const done = Object.values(state.parcels || {}).filter((p) => p.status === 'done').length;

  const body = el('div');
  body.append(
    el('p.hint', { text: t('picker.intro', { done, total: parcels.length }) }),
    el('div.parcel-list', {}, parcels.map((parcel) => card(parcel))),
  );

  const dialog = modals.open({
    title: t('picker.title'),
    body,
    wide: true,
    dismissible,
  });

  function card(parcel) {
    const progress = state.parcels?.[parcel.id];
    const isDone = progress?.status === 'done';
    const reusable = reusableFor(state.network || [], parcel, 150);

    const node = el(
      `div.parcel-card${isDone ? '.is-done' : ''}`,
      {},
      el('h4', { text: parcel.propertyName }),
      el('p.parcel-owner', { text: parcel.owner }),
      el(
        'dl.parcel-facts',
        {},
        el('dt', { text: t('picker.area') }),
        el('dd', { text: `${num(parcel.hectares, 2)} ha` }),
        el('dt', { text: t('picker.vertices') }),
        el('dd', { text: String(parcel.vertices.length) }),
        el('dt', { text: t('picker.pays') }),
        el('dd', { text: `R$ ${num(estimatePayment(parcel, difficulty), 0)}` }),
      ),
    );

    if (reusable.length) {
      node.append(
        el('p.parcel-reuse', {
          text: t('picker.reusable', { n: reusable.length }),
        }),
      );
    }

    if (isDone) {
      node.append(
        el('p.parcel-done', {
          text: t('picker.completed', {
            time: fmtDuration(progress.elapsedMs || 0),
            paid: num(progress.payment || 0, 0),
          }),
        }),
      );
    } else {
      node.append(
        el('button.btn.btn-primary.parcel-take', {
          type: 'button',
          text: t('picker.take'),
          onclick: () => {
            dialog.close();
            onChoose(parcel.id);
          },
        }),
      );
    }
    return node;
  }

  return dialog;
}

/**
 * The end of the campaign. Six properties surveyed; show what the whole
 * campaign came to rather than just congratulating.
 */
export function showCampaignEnd({ modals, state, parcels, onRestart }) {
  const rows = parcels.map((p) => {
    const prog = state.parcels?.[p.id] || {};
    return [p.propertyName, fmtDuration(prog.elapsedMs || 0), `R$ ${num(prog.payment || 0, 0)}`];
  });

  const body = el('div');
  body.append(
    el('p', { text: t('campaign.body') }),
    el(
      'div.stats',
      {},
      el(
        'div.stat',
        {},
        el('span.stat-label', { text: t('campaign.totalTime') }),
        el('span.stat-value', { text: fmtDuration(state.stats.totalElapsedMs) }),
      ),
      el(
        'div.stat',
        {},
        el('span.stat-label', { text: t('campaign.totalEarned') }),
        el('span.stat-value', { text: `R$ ${num(state.stats.totalEarned, 0)}` }),
      ),
      el(
        'div.stat',
        {},
        el('span.stat-label', { text: t('campaign.kit') }),
        el('span.stat-value', { text: t(`eq.${state.inventory.instrument}`) }),
      ),
    ),
    el(
      'table.tbl',
      {},
      el('thead', {}, el('tr', {}, [t('picker.property'), t('hud.elapsed'), t('picker.pays')].map((h) => el('th', { text: h })))),
      el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: c }))))),
    ),
  );

  return modals.open({
    title: t('campaign.title'),
    body,
    dismissible: false,
    actions: [{ label: t('campaign.restart'), primary: true, onClick: onRestart }],
  });
}
