// Rendering the report on screen.
//
// The DrawList goes to a canvas and the DocBlocks to HTML — both are thin
// translations of the same document the PDF will get, so what the player
// reviews is what they hand in.

import { el, clear } from './../ui/dom.js';
import { t, num } from './../ui/i18n.js';
import { fmtDuration } from '../survey/units.js';

/** Paint a DrawList (in millimetres) onto a canvas at the given pixels-per-mm. */
export function drawListToCanvas(canvas, drawList, sheet, pxPerMm = 3.2) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.round(sheet.w * pxPerMm * dpr);
  canvas.height = Math.round(sheet.h * pxPerMm * dpr);
  canvas.style.aspectRatio = `${sheet.w} / ${sheet.h}`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(pxPerMm * dpr, 0, 0, pxPerMm * dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheet.w, sheet.h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const it of drawList.items) {
    ctx.save();
    ctx.strokeStyle = it.colour || '#000';
    // Never `it.w`: on a rect that is the rectangle's width, not the pen's.
    ctx.lineWidth = it.lw ?? 0.25;
    ctx.setLineDash(it.dash || []);

    switch (it.t) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(it.x1, it.y1);
        ctx.lineTo(it.x2, it.y2);
        ctx.stroke();
        break;

      case 'poly': {
        ctx.beginPath();
        it.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        if (it.closed) ctx.closePath();
        if (it.fill) {
          ctx.fillStyle = it.fill;
          ctx.fill();
        }
        ctx.stroke();
        break;
      }

      case 'rect':
        if (it.fill) {
          ctx.fillStyle = it.fill;
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
        ctx.strokeRect(it.x, it.y, it.w, it.h);
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        if (it.fill) {
          ctx.fillStyle = it.fill;
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'text': {
        ctx.fillStyle = it.colour || '#000';
        ctx.font = `${it.bold ? '700 ' : ''}${it.size}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = it.align === 'center' ? 'center' : it.align === 'right' ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        if (it.angle) {
          ctx.translate(it.x, it.y);
          ctx.rotate((-it.angle * Math.PI) / 180);
          ctx.fillText(it.s, 0, 0);
        } else {
          ctx.fillText(it.s, it.x, it.y);
        }
        break;
      }

      default:
        break;
    }
    ctx.restore();
  }
  return canvas;
}

/** Turn DocBlocks into readable HTML. */
export function docBlocksToHtml(blocks) {
  const root = el('article.doc');
  for (const b of blocks) {
    switch (b.t) {
      case 'h1':
        root.append(el('h1.doc-h1', { text: b.text }));
        break;
      case 'h2':
        root.append(el('h2.doc-h2', { text: b.text }));
        break;
      case 'p':
        root.append(el(`p.doc-p${b.justify ? '.doc-justify' : ''}`, { text: b.text }));
        break;
      case 'kv':
        root.append(
          el(
            'dl.doc-kv',
            {},
            b.pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]),
          ),
        );
        break;
      case 'table':
        root.append(
          el(
            'div.doc-table-wrap',
            {},
            el(
              'table.doc-table',
              {},
              el('thead', {}, el('tr', {}, b.head.map((h) => el('th', { text: h })))),
              el('tbody', {}, b.rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: String(c) }))))),
            ),
          ),
        );
        break;
      case 'sign':
        root.append(
          el('div.doc-sign', {}, el('div.doc-sign-line'), el('div.doc-sign-name', { text: `${b.name} — ${b.role}` })),
        );
        break;
      case 'note':
        root.append(el('p.doc-note', { text: b.text }));
        break;
      case 'spacer':
        root.append(el('div', { style: { height: `${b.mm}mm` } }));
        break;
      default:
        break;
    }
  }
  return root;
}

/** The end-of-service scorecard: what the player got, and how close it was. */
export function renderDebrief(result) {
  const d = result.debrief;
  const row = (labelKey, value, cls = '') =>
    el(`div.stat${cls}`, {}, el('span.stat-label', { text: t(labelKey) }), el('span.stat-value', { text: value }));

  const accurate = Math.abs(d.areaErrorPct) < 0.5;

  return el(
    'div.debrief',
    {},
    el('p.debrief-lead', { text: t('delivery.congratulations', { owner: result.report.parcel.owner }) }),
    el(
      'div.stats',
      {},
      row('delivery.areaSurveyed', `${num(d.areaSurveyed, 2)} m²`),
      row('delivery.areaTrue', `${num(d.areaTrue, 2)} m²`),
      row('delivery.areaError', `${num(d.areaErrorM2, 2)} m² (${num(d.areaErrorPct, 3)} %)`, accurate ? '.is-good' : '.is-bad'),
      row('delivery.perimeterError', `${num(d.perimeterError, 3)} m`),
      row('delivery.sideRms', `${num(d.sideRms, 3)} m`),
      row('delivery.elapsed', fmtDuration(result.elapsedMs)),
      row('delivery.quality', `${Math.round(result.quality * 100)} %`),
      row('delivery.payment', `R$ ${num(result.payment, 0)}`, '.is-good'),
    ),
    // Which corner, not just how much. The aggregate figures above are
    // datum-invariant and answer a different question; this one needs the
    // frames aligned, which is why it took a `datumShift` to become possible.
    d.corners?.length ? renderCornerErrors(d) : null,
  );
}

/** Per-corner error, worst first: the list a student can act on. */
function renderCornerErrors(d) {
  const mm = (v) => `${(v * 1000).toFixed(0)} mm`;
  const rows = [...d.corners].sort((a, b) => b.d - a.d);

  return el(
    'section.debrief-corners',
    {},
    el('h4', { text: t('debrief.perCorner') }),
    el('p.hint', {
      text: t('debrief.perCornerHelp', { rms: mm(d.cornerRms), control: mm(d.control?.rms ?? 0) }),
    }),
    el(
      'table.tbl',
      {},
      el(
        'thead',
        {},
        el('tr', {}, [t('debrief.corner'), 'ΔE', 'ΔN', t('debrief.offBy'), t('debrief.sights')].map((h) => el('th', { text: h }))),
      ),
      el(
        'tbody',
        {},
        rows.map((c) =>
          el(
            `tr${c === rows[0] && c.d > 0 ? '.is-bad' : ''}`,
            {},
            el('td', { text: c.label }),
            el('td', { text: mm(c.dE) }),
            el('td', { text: mm(c.dN) }),
            el('td', { text: mm(c.d) }),
            el('td', { text: String(c.sights ?? 0) }),
          ),
        ),
      ),
    ),
  );
}

export function mount(container, node) {
  clear(container).append(node);
  return container;
}
