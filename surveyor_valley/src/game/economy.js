// Getting paid, and spending it.
//
// The economy exists to make precision and speed both matter, visibly. A player
// who rushes a job and closes at 1:900 gets paid, but noticeably less than one
// who took twenty more minutes and closed at 1:12,000 — and the breakdown says
// exactly which line cost them the difference. That is the whole design: the
// payment screen is a teaching surface, not a reward animation.
//
// Pure functions of plain data, so the numbers can be tested without a browser.

import { TIERS, TRIPODS, TARGETS, MARCOS } from '../survey/instrument.js';
import { overtimePenalty } from './timer.js';

/** Reais per hectare before any multiplier. */
export const BASE_PAY_PER_HA = 950;

/** A callout fee, so a tiny parcel is still worth the drive. */
export const CALLOUT = 380;

/**
 * How good the survey was, 0..1, from the achieved relative precision against
 * what the difficulty demands.
 *
 * Meeting the requirement exactly scores 0.5; comfortably beating it approaches
 * 1. Deliberately generous below the line rather than a cliff — a student whose
 * traverse just missed tolerance should be paid less, not nothing.
 */
export function qualityFrom(relPrecision, requiredPrecision) {
  if (!Number.isFinite(relPrecision) || relPrecision <= 0) return 1;
  const ratio = requiredPrecision / relPrecision; // >1 means better than required
  if (ratio <= 0) return 0;
  // log2 so each doubling of precision is a fixed step of quality.
  return Math.max(0, Math.min(1, 0.5 + Math.log2(ratio) / 6));
}

/**
 * The full payment, itemised.
 *
 * @param {object} p
 * @param {{hectares:number, propertyName:string}} p.parcel
 * @param {number} p.quality        0..1, from `qualityFrom`
 * @param {number} p.elapsedMs
 * @param {{payMult:number}} p.difficulty
 * @param {number} [p.marcosUsed]   monuments left in the ground, reimbursed
 * @param {number} [p.marcoUnitPrice]
 * @returns {{total:number, lines:Array<{key:string, value:number, detail?:object}>}}
 */
export function paymentBreakdown({
  parcel,
  quality,
  elapsedMs,
  difficulty,
  marcosUsed = 0,
  marcoUnitPrice = 0,
  overtimeMs = 0,
}) {
  const area = Math.round(parcel.hectares * BASE_PAY_PER_HA);
  const hours = elapsedMs / 3600000;

  // A gentle nudge to be quick, never a penalty that punishes care. A student
  // who takes an extra half hour to do it properly must not end up out of
  // pocket, or the economy teaches the opposite of what the course does.
  const timeMult = hours < 1 ? 1.1 : hours < 2 ? 1.0 : hours < 3 ? 0.92 : 0.85;
  const qualityMult = 0.6 + 0.6 * quality;
  const diffMult = difficulty?.payMult ?? 1;

  const gross = (CALLOUT + area) * diffMult;
  const afterQuality = gross * qualityMult;
  const afterTime = afterQuality * timeMult;

  // Overtime is charged on the fee, not on the work: the job still counts, the
  // documents are still produced, and the player simply earns less for having
  // run past the day. Voiding the job instead would throw away everything they
  // measured, which teaches nothing.
  const overMult = overtimePenalty(overtimeMs);
  const afterOvertime = afterTime * overMult;

  const materials = Math.round(marcosUsed * marcoUnitPrice);
  const total = Math.max(0, Math.round(afterOvertime - materials));

  return {
    total,
    quality,
    overtimeMs,
    lines: [
      { key: 'pay.callout', value: CALLOUT },
      { key: 'pay.area', value: area, detail: { ha: parcel.hectares } },
      { key: 'pay.difficulty', value: Math.round(gross - CALLOUT - area), detail: { mult: diffMult } },
      { key: 'pay.quality', value: Math.round(afterQuality - gross), detail: { mult: qualityMult } },
      { key: 'pay.time', value: Math.round(afterTime - afterQuality), detail: { mult: timeMult, hours } },
      ...(overtimeMs > 0
        ? [
            {
              key: 'pay.overtime',
              value: Math.round(afterOvertime - afterTime),
              detail: { mult: overMult, minutes: Math.round(overtimeMs / 60000) },
            },
          ]
        : []),
      ...(materials ? [{ key: 'pay.materials', value: -materials, detail: { n: marcosUsed } }] : []),
    ],
  };
}

// -------------------------------------------------------------- the shop ---

/**
 * Everything on sale, in the order it appears in the store.
 *
 * Prices live in `survey/instrument.js` beside the specifications they buy, so
 * there is exactly one place where "the 5-second instrument" is defined.
 */
export function catalogue() {
  return [
    {
      slot: 'instrument',
      key: 'shop.instruments',
      items: TIERS.map((tier) => ({
        id: tier.id,
        price: tier.price,
        spec: { sigmaDirSec: tier.sigmaDirSec, distA_mm: tier.distA_mm, distPPM: tier.distPPM },
      })),
    },
    {
      slot: 'tripod',
      key: 'shop.tripods',
      items: TRIPODS.map((tri) => ({
        id: tri.id,
        price: tri.price,
        spec: { centringSigma_mm: tri.centringSigma_mm },
      })),
    },
    {
      slot: 'target',
      key: 'shop.targets',
      items: TARGETS.map((tgt) => ({
        id: tgt.id,
        price: tgt.price,
        spec: { centringSigma_mm: tgt.centringSigma_mm },
      })),
    },
  ];
}

/** Monuments are consumable, so they are bought by the dozen rather than owned. */
export const MARCO_PACK = 12;
export const marcoPackPrice = (id = 'estaca-mad') =>
  Math.round((MARCOS.find((m) => m.id === id) || MARCOS[0]).unitPrice * MARCO_PACK);

/**
 * Is this item an upgrade the player can and should buy?
 *
 * "Owned" means the player already has it or something strictly better in the
 * same slot, which is why the list is ordered by price: buying the 3" after the
 * 1" would be a downgrade, and the store simply never offers it.
 */
export function shopState(inventory, money) {
  return catalogue().map((group) => {
    const ownedIndex = group.items.findIndex((i) => i.id === inventory[group.slot]);
    return {
      ...group,
      items: group.items.map((item, i) => ({
        ...item,
        owned: i === ownedIndex,
        superseded: i < ownedIndex,
        affordable: item.price <= money,
        locked: i > ownedIndex && item.price > money,
      })),
    };
  });
}

/**
 * Apply a purchase.
 * @returns {{ok:boolean, reason?:string, money?:number}}
 */
export function buy(state, slot, id) {
  if (slot === 'marcos') {
    const price = marcoPackPrice(state.inventory.marcoKind);
    if (state.player.money < price) return { ok: false, reason: 'cannotAfford' };
    state.player.money -= price;
    state.inventory.marcos += MARCO_PACK;
    return { ok: true, money: state.player.money };
  }

  const group = catalogue().find((g) => g.slot === slot);
  if (!group) return { ok: false, reason: 'unknownSlot' };
  const item = group.items.find((i) => i.id === id);
  if (!item) return { ok: false, reason: 'unknownItem' };

  const ownedIndex = group.items.findIndex((i) => i.id === state.inventory[slot]);
  const wantIndex = group.items.indexOf(item);
  if (wantIndex <= ownedIndex) return { ok: false, reason: 'alreadyOwned' };
  if (state.player.money < item.price) return { ok: false, reason: 'cannotAfford' };

  state.player.money -= item.price;
  state.inventory[slot] = id;
  return { ok: true, money: state.player.money };
}

/**
 * What a job is likely to pay, for the parcel picker. Assumes a competent run,
 * so the figure shown before starting is a fair expectation rather than a best
 * case the player will resent missing.
 */
export function estimatePayment(parcel, difficulty) {
  return paymentBreakdown({
    parcel,
    quality: 0.55,
    elapsedMs: 75 * 60 * 1000,
    difficulty,
  }).total;
}
