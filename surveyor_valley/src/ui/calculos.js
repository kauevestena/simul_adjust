// The computation panel: closure, tolerance, compensation.
//
// This is the didactic centrepiece, so it shows the verdict AND the arithmetic
// behind it, names the rule being applied, and lets the student switch between
// Bowditch and transit to watch the corrections redistribute. It also says
// plainly what it is not — a rigorous least-squares adjustment — rather than
// leaving the impression that this is all there is.

import { el, clear, table } from './dom.js';
import { t, num, lang, locale, angleFormat } from './i18n.js';
import { formatAngle } from '../survey/units.js';
import { formatRumo } from '../survey/geometry.js';
import { RULE, formatRelPrecision } from '../survey/traverse.js';

/** Angles honour the player's unit choice: DMS or gon. */
const fmtAngle = (deg, opts) => formatAngle(deg, angleFormat(), opts);


const stat = (labelKey, value, cls = '') =>
  el(`div.stat${cls}`, {}, el('span.stat-label', { text: t(labelKey) }), el('span.stat-value', { text: value }));

/** Explain what is still missing instead of just refusing to compute. */
function renderBlocked(result) {
  const root = el('div.calc-blocked');
  const reasonKey = `calc.${result.reason}`;
  root.append(el('p.notice', { text: t(reasonKey, { have: result.have ?? 0 }) }));

  if (result.reason === 'incompleteAngles' && result.missing?.length) {
    root.append(
      el(
        'ul.missing',
        {},
        result.missing.map((m) => el('li', { text: `${m.station}: ${m.needs.join(', ')}` })),
      ),
    );
  }
  return root;
}

/**
 * @param {object} p
 * @param {object} p.traverse   result of computeTraverse, or a {ok:false} reason
 * @param {object} p.area       areaOf() of the surveyed ring, may be null
 * @param {number} p.requiredPrecision
 * @param {(rule:string)=>void} p.onRuleChange
 */
export function renderCalculos({ traverse, area, requiredPrecision, rule, onRuleChange }) {
  const root = el('div.calculos');
  root.append(el('p.notice.notice-muted', { text: t('calc.notRigorous') }));

  if (area) {
    root.append(
      el(
        'section.calc-section',
        {},
        el('h4', { text: t('calc.area') }),
        el('p.formula', { text: t('calc.areaFormula') }),
        el(
          'div.stats',
          {},
          stat('calc.area', `${num(area.m2, 2)} m²`),
          stat('common.hectares', `${num(area.hectares, 4)} ha`),
        ),
      ),
    );
  }

  if (!traverse || !traverse.ok) {
    root.append(renderBlocked(traverse || { reason: 'needThreeStations', have: 0 }));
    return root;
  }

  const angOk = traverse.angOk;
  const relOk = traverse.relPrecision <= requiredPrecision;

  root.append(
    el(
      'section.calc-section',
      {},
      el('h4', { text: t('calc.angularClosure') }),
      el(
        'div.stats',
        {},
        stat('calc.angularSum', fmtAngle(traverse.sumObs, { wrap: false })),
        stat(
          'calc.angularTheoretical',
          `${fmtAngle(traverse.sumTheo, { wrap: false })} (${t(
            traverse.angleKind === 'interior' ? 'calc.interior' : 'calc.exterior',
          )})`,
        ),
        stat('calc.angularClosure', `${traverse.eAngSec.toFixed(1)}"`, angOk ? '.is-good' : '.is-bad'),
        stat('calc.angularTolerance', `± ${traverse.tolAngSec.toFixed(1)}"`),
        stat('calc.angularCorrection', `${traverse.angleCorrSec.toFixed(1)}"`),
      ),
      el(`p.verdict${angOk ? '.is-good' : '.is-bad'}`, { text: t(angOk ? 'calc.pass' : 'calc.fail') }),
    ),
  );

  root.append(
    el(
      'section.calc-section',
      {},
      el('h4', { text: t('calc.linearClosure') }),
      el(
        'div.stats',
        {},
        stat('calc.eE', `${num(traverse.eE, 3)} m`),
        stat('calc.eN', `${num(traverse.eN, 3)} m`),
        stat('calc.eLin', `${num(traverse.eLin, 3)} m`),
        stat('calc.perimeter', `${num(traverse.sumD, 3)} m`),
        stat('calc.relPrecision', formatRelPrecision(traverse.relDenominator, locale()), relOk ? '.is-good' : '.is-bad'),
        stat('calc.required', formatRelPrecision(1 / requiredPrecision, locale())),
      ),
      el(`p.verdict${relOk ? '.is-good' : '.is-bad'}`, { text: t(relOk ? 'calc.pass' : 'calc.fail') }),
    ),
  );

  // Switching rules is one line of code and a genuinely instructive comparison.
  const ruleSwitch = el(
    'div.rule-switch',
    {},
    el('span.stat-label', { text: t('calc.rule') }),
    ...[RULE.BOWDITCH, RULE.TRANSIT].map((r) =>
      el(`button.chip${r === rule ? '.is-active' : ''}`, {
        type: 'button',
        text: t(r === RULE.BOWDITCH ? 'calc.bowditch' : 'calc.transit'),
        onclick: () => onRuleChange?.(r),
      }),
    ),
  );

  root.append(
    el(
      'section.calc-section',
      {},
      el('h4', { text: t('calc.title') }),
      ruleSwitch,
      table(
        [
          t('calc.colStation'),
          t('calc.colAngleObs'),
          t('calc.colAngleAdj'),
          t('calc.colAzimuth'),
          t('planta.colRumo'),
          t('calc.colDistance'),
          t('calc.colCorrE'),
          t('calc.colCorrN'),
          t('planta.colE'),
          t('planta.colN'),
        ],
        traverse.rows.map((r) => [
          `${r.from} → ${r.to}`,
          fmtAngle(r.angleObs),
          fmtAngle(r.angleAdj),
          fmtAngle(r.azimuth),
          formatRumo(r.azimuth, lang()),
          num(r.distance, 3),
          num(r.corrE, 4),
          num(r.corrN, 4),
          num(r.E, 3),
          num(r.N, 3),
        ]),
      ),
    ),
  );

  return root;
}

export function mountCalculos(container, data) {
  clear(container).append(renderCalculos(data));
  return container;
}
