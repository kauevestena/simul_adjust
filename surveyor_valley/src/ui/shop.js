// The equipment store.
//
// The point of the shop is not shopping. It is that the specification of every
// item is stated in the units the course uses — 10" and 10 mm + 10 ppm — so
// buying the next instrument is a decision about measurement precision, and the
// player then watches their closure error halve. That is the loop the spec asks
// for: payment funds better equipment, better equipment earns more.
//
// Which is why each row shows what the item would do to the achievable closure
// rather than a star rating.

import { el, clear } from './dom.js';
import { t, num } from './i18n.js';
import { shopState, buy, marcoPackPrice, MARCO_PACK } from '../game/economy.js';
import { angularTolerance } from '../survey/traverse.js';

/**
 * @param {object} p
 * @param {object} p.modals
 * @param {object} p.store
 * @param {() => void} p.onChange  called after a purchase, to refresh the HUD
 * @param {(kind:string) => void} [p.sfx]
 */
export function showShop({ modals, store, onChange, sfx }) {
  const body = el('div.shop');

  const dialog = modals.open({
    title: t('shop.title'),
    body,
    wide: true,
  });

  function purchase(slot, id) {
    const state = store.get();
    const result = buy(state, slot, id);
    if (!result.ok) {
      sfx?.('reject');
      return;
    }
    sfx?.('kaching');
    store.touch?.();
    onChange?.();
    render();
  }

  function render() {
    clear(body);
    const state = store.get();
    const money = state.player.money;

    body.append(
      el(
        'div.shop-head',
        {},
        el('span.shop-purse', { text: `R$ ${num(money, 0)}` }),
        el('p.hint', { text: t('shop.intro') }),
      ),
    );

    for (const group of shopState(state.inventory, money)) {
      const rows = group.items
        // A cheaper item in the same slot is a downgrade, so it is never shown.
        .filter((item) => !item.superseded)
        .map((item) => row(group.slot, item));

      body.append(el('section.shop-group', {}, el('h4', { text: t(group.key) }), el('div.shop-rows', {}, rows)));
    }

    // Monuments are a consumable, not an upgrade.
    const packPrice = marcoPackPrice(state.inventory.marcoKind);
    body.append(
      el(
        'section.shop-group',
        {},
        el('h4', { text: t('shop.marcos') }),
        el(
          'div.shop-rows',
          {},
          el(
            'div.shop-row',
            {},
            el(
              'div.shop-item',
              {},
              el('strong', { text: t('shop.marcoPack', { n: MARCO_PACK }) }),
              el('span.shop-spec', { text: t('shop.marcoHave', { n: state.inventory.marcos }) }),
            ),
            el('button.btn.btn-primary', {
              type: 'button',
              text: `R$ ${num(packPrice, 0)}`,
              disabled: money < packPrice,
              onclick: () => purchase('marcos'),
            }),
          ),
        ),
      ),
    );
  }

  /** One purchasable line, with the measurement consequence spelled out. */
  function row(slot, item) {
    const detail = [];
    if (item.spec.sigmaDirSec != null) {
      detail.push(`${item.spec.sigmaDirSec}" · ${item.spec.distA_mm} mm + ${item.spec.distPPM} ppm`);
      // What that instrument would permit as angular closure on a 5-station
      // loop: the number the Cálculos panel checks against.
      detail.push(t('shop.tolerance', { sec: num(angularTolerance(item.spec.sigmaDirSec, 5), 1) }));
    }
    if (item.spec.centringSigma_mm != null) {
      detail.push(t('shop.centring', { mm: num(item.spec.centringSigma_mm, 1) }));
    }

    return el(
      `div.shop-row${item.owned ? '.is-owned' : ''}`,
      {},
      el(
        'div.shop-item',
        {},
        el('strong', { text: t(`eq.${item.id}`) }),
        el('span.shop-spec', { text: detail.join('  ·  ') }),
      ),
      item.owned
        ? el('span.shop-owned', { text: t('shop.owned') })
        : el('button.btn.btn-primary', {
            type: 'button',
            text: `R$ ${num(item.price, 0)}`,
            disabled: !item.affordable,
            onclick: () => purchase(slot, item.id),
          }),
    );
  }

  render();
  return dialog;
}
