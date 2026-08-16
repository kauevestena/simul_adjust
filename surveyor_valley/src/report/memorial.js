// The memorial descritivo.
//
// A Brazilian metes-and-bounds description: it opens at a vertex, walks the
// ring naming the azimuth, bearing, distance and confrontante of each side, and
// closes back on the starting point.
//
// Every sentence is an i18n TEMPLATE with placeholders, never a concatenation
// of translated fragments. That is what lets the English version come out as
// idiomatic metes-and-bounds ("thence, bearing N 87°12'45" E, a distance of…")
// instead of Portuguese word order wearing English words.

import { makeDocBlocks } from './docmodel.js';
import { t, num, dateLong, locale } from '../ui/i18n.js';
import { formatDMS } from '../survey/units.js';
import { formatRumo } from '../survey/geometry.js';
import { getInstrument } from '../survey/instrument.js';
import { formatRelPrecision } from '../survey/traverse.js';

/**
 * @param {object} p
 * @param {object} p.report    from service.parcelReport()
 * @param {object} p.state
 * @param {string} p.lang
 * @param {string} p.playerName
 * @returns {{blocks:Array, text:string}}
 */
export function buildMemorial({ report, state, lang = 'pt', playerName = '' }) {
  const { parcel, vertices, sides, area, perimeter, datum, traverse } = report;
  const docs = makeDocBlocks();

  docs.h1(t('memorial.title'));

  docs.kv([
    [t('memorial.property'), parcel.propertyName],
    [t('memorial.owner'), parcel.owner],
    [t('memorial.municipio'), `${parcel.municipio} / ${parcel.uf}`],
    [t('memorial.matricula'), t('memorial.matriculaValue', { n: matriculaFor(parcel, state.seed) })],
    [t('memorial.area'), `${num(area.m2, 2)} m² (${num(area.hectares, 4)} ha)`],
    [t('memorial.perimeter'), `${num(perimeter, 2)} m`],
    [
      t('memorial.referenceSystem'),
      t('memorial.referenceSystemValue', {
        vertex: vertices[0].label || vertices[0].id,
        orientation: t(
          datum?.northLabel === 'magnetico' ? 'memorial.orientationCompass' : 'memorial.orientationArbitrary',
        ),
      }),
    ],
  ]);

  docs.spacer(3);
  docs.h2(t('memorial.perimeterTitle'));

  // One flowing paragraph, the way a real memorial reads.
  const parts = [];
  parts.push(
    t('memorial.opening', {
      vertex: vertices[0].label || vertices[0].id,
      e: num(vertices[0].E, 3),
      n: num(vertices[0].N, 3),
    }),
  );

  sides.forEach((s, i) => {
    const last = i === sides.length - 1;
    const to = vertices[(i + 1) % vertices.length];
    parts.push(
      t(last ? 'memorial.closing' : 'memorial.segment', {
        az: formatDMS(s.azimuth),
        rumo: formatRumo(s.azimuth, lang),
        dist: num(s.distance, 2),
        confrontante: s.confrontante || t('common.none'),
        toVertex: to.label || to.id,
        e: num(to.E, 3),
        n: num(to.N, 3),
      }),
    );
  });

  docs.p(parts.join(' '), { justify: true });

  docs.spacer(3);
  const instrument = t(`eq.${state.inventory.instrument}`);
  if (traverse?.ok) {
    docs.p(
      t('memorial.methodTraverse', {
        instrument,
        // The document names the method plainly; the UI's parenthetical
        // ("Bowditch (bússola)") belongs on a button, not in a legal text.
        rule: t(traverse.rule === 'transit' ? 'memorial.ruleTransit' : 'memorial.ruleBowditch'),
        // Seconds follow the document's own locale, like every other number
        // in it — a stray "-61.5" among "1.234,56" reads as a typo.
        eAng: `${num(traverse.eAngSec, 1)}"`,
        relPrecision: formatRelPrecision(traverse.relDenominator, locale()),
      }),
    );
  } else {
    docs.p(t('memorial.method', { instrument }));
  }

  docs.spacer(6);
  docs.p(t('memorial.signature', { municipio: parcel.municipio, date: dateLong() }));
  docs.sign(playerName || t('app.title'), t('memorial.responsible'));

  docs.spacer(4);
  docs.note(t('memorial.disclaimer'));

  return { blocks: docs.blocks, text: blocksToText(docs.blocks) };
}

/** A stable fake registry number, so the same parcel always shows the same one. */
function matriculaFor(parcel, seed) {
  let h = 0;
  for (const ch of `${seed}:${parcel.id}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 10000 + (h % 89999);
  return `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, '0')}`;
}

/** Flatten to plain text, for the .txt fallback export and for testing. */
export function blocksToText(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h1':
        out.push(b.text.toUpperCase(), '');
        break;
      case 'h2':
        out.push('', b.text, '');
        break;
      case 'kv':
        for (const [k, v] of b.pairs) out.push(`${k}: ${v}`);
        break;
      case 'p':
        out.push(b.text, '');
        break;
      case 'table':
        out.push(b.head.join('\t'));
        for (const r of b.rows) out.push(r.join('\t'));
        out.push('');
        break;
      case 'sign':
        out.push('', '_'.repeat(46), `${b.name} — ${b.role}`);
        break;
      case 'note':
        out.push('', b.text);
        break;
      case 'spacer':
        out.push('');
        break;
      default:
        break;
    }
  }
  return out.join('\n');
}
