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
