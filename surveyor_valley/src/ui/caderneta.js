// The field book.
//
// Grouped by occupation, with the orientation constant in each group header and
// the reduction formula above the table — because the point is not to show the
// student a number but to show them where the number came from.

import { el, clear, table } from './dom.js';
import { t, num, lang, angleFormat } from './i18n.js';
import { formatAngle } from '../survey/units.js';
import { formatRumo } from '../survey/geometry.js';
import { groupBySetup, derivedAngles } from '../survey/observations.js';

/** Angles honour the player's unit choice: DMS or gon. */
const fmtAngle = (deg, opts) => formatAngle(deg, angleFormat(), opts);

/**
 * The field book as a flat table, for a spreadsheet.
 *
 * A caderneta is the one artefact a student actually hands in, and until now it
 * could not leave the browser. Flat rather than grouped on purpose: the setup
 * context is repeated on every line so the file sorts, filters and pivots like
 * data instead of like a printout.
 *
 * Both reductions are carried. `E`/`N` are what the observation gave when it
 * was taken; `E ajust.`/`N ajust.` are the same observation reduced again from
 * the compensated traverse — see `service.js#reradiate` — and having the pair
 * side by side is exactly the comparison the cálculos panel is teaching.
 */
export function cadernetaRows({ setups, observations }) {
  const header = [
    t('caderneta.csvSetup'),
    t('caderneta.csvOver'),
    t('caderneta.csvBacksight'),
    t('station.theta0'),
    t('caderneta.colTarget'),
    t('caderneta.colHz'),
    'PD',
    'PI',
    '2C (")',
    t('caderneta.colDist'),
    t('caderneta.colAz'),
    'E',
    'N',
    `E ${t('caderneta.csvAdjusted')}`,
    `N ${t('caderneta.csvAdjusted')}`,
  ];

  const n = (v, dp) => (v == null || Number.isNaN(v) ? '' : v.toFixed(dp));
  const rows = [header];

  for (const { setup, rows: obs } of groupBySetup(setups, observations)) {
    for (const o of obs) {
      rows.push([
        setup.id,
        setup.mode === 'free' ? t('station.freeStation') : setup.overId ?? '',
        setup.backsightId ?? '',
        n(setup.theta0, 6),
        o.label ?? o.targetId,
        n(o.hz, 6),
        n(o.hzPD, 6),
        n(o.hzPI, 6),
        n(o.twoCSec, 1),
        n(o.distance, 4),
        n(o.azimuth, 6),
        n(o.E, 4),
        n(o.N, 4),
        n(o.adjE, 4),
        n(o.adjN, 4),
      ]);
    }
  }
  return rows;
}

export function renderCaderneta({ setups, observations }) {
  const root = el('div.caderneta');

  if (!observations.length) {
    root.append(el('p.empty', { 'data-i18n': 'caderneta.empty', text: t('caderneta.empty') }));
    return root;
  }

  root.append(el('p.formula', { text: t('caderneta.formula') }));

  for (const { setup, rows } of groupBySetup(setups, observations)) {
    if (!rows.length) continue;

    const where =
      setup.mode === 'free'
        ? t('caderneta.freeStation')
        : `${t('caderneta.over', { id: setup.overId })}, ${t('caderneta.backsight', { id: setup.backsightId })}`;

    // Both faces are only shown when some sight in this occupation actually
    // took them; two dashed columns on a single-face survey is just noise.
    const anyTwoFace = rows.some((o) => o.twoFace);
    const twoCs = rows.filter((o) => o.twoCSec != null).map((o) => o.twoCSec);
    const meanTwoC = twoCs.length ? twoCs.reduce((a, b) => a + b, 0) / twoCs.length : null;

    root.append(
      el(
        'div.caderneta-group',
        {},
        el(
          'header.caderneta-head',
          {},
          el('h4', { text: t('caderneta.setup', { id: setup.id }) }),
          el('span.muted', { text: where }),
          el('span.theta', { text: `${t('station.theta0')} = ${fmtAngle(setup.theta0)}` }),
          el('span.muted', { text: `E ${num(setup.E, 3)} · N ${num(setup.N, 3)}` }),
          // The number the procedure exists to produce. Averaging more readings
          // on ONE face can never remove this; swinging the telescope does.
          meanTwoC != null
            ? el('span.theta.theta-2c', { text: `2c = ${num(meanTwoC, 1)}″`, title: t('caderneta.twoCHelp') })
            : null,
        ),
        table(
          [
            t('caderneta.colTarget'),
            ...(anyTwoFace ? [t('caderneta.colHzPD'), t('caderneta.colHzPI')] : []),
            t('caderneta.colHz'),
            t('caderneta.colDist'),
            t('caderneta.colAz'),
            t('caderneta.colRumo'),
            t('caderneta.colDE'),
            t('caderneta.colDN'),
            t('caderneta.colE'),
            t('caderneta.colN'),
          ],
          rows.map((o) => [
            o.label,
            ...(anyTwoFace ? [o.twoFace ? fmtAngle(o.hzPD) : '—', o.twoFace ? fmtAngle(o.hzPI) : '—'] : []),
            fmtAngle(o.hz),
            num(o.distance, 3),
            fmtAngle(o.azimuth),
            formatRumo(o.azimuth, lang()),
            num(o.dE, 3),
            num(o.dN, 3),
            num(o.E, 3),
            num(o.N, 3),
          ]),
        ),
        renderAngles(rows),
      ),
    );
  }

  return root;
}

/** Angles to the right between consecutive sights — what a student tabulates. */
function renderAngles(rows) {
  const angles = derivedAngles(rows);
  if (angles.length === 0) return null;
  return el(
    'div.derived-angles',
    {},
    el('h5', { text: t('calc.colAngleObs') }),
    el(
      'ul',
      {},
      angles.map((a) => el('li', { text: `${a.from} → ${a.to}: ${fmtAngle(a.angle)}` })),
    ),
  );
}

export function mountCaderneta(container, data) {
  clear(container).append(renderCaderneta(data));
  return container;
}
