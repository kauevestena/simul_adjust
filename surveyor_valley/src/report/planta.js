// The plan drawing.
//
// Composed as a DrawList in paper millimetres, so the on-screen preview and the
// PDF are literally the same instructions. Everything a Brazilian planta is
// expected to carry is here: scale, north arrow labelled for the datum actually
// used, dimensioned sides, confrontantes outside each line, a coordinate grid,
// a title block, and the disclaimer that keeps it from being mistaken for a
// legal instrument.

import { makeDrawList, A4, worldToPaper, chooseScale } from './docmodel.js';
import { t, num, dateLong } from '../ui/i18n.js';
import { formatDMS } from '../survey/units.js';
import { formatRumo } from '../survey/geometry.js';
import { getInstrument } from '../survey/instrument.js';

const MARGIN = 10;
const BLOCK = { w: 88, h: 56 };

export function buildPlanta({ report, state, lang = 'pt', playerName = '' }) {
  const { parcel, vertices, sides, area, perimeter, datum, traverse } = report;
  const dl = makeDrawList();
  const sheet = A4.landscape;

  const frame = {
    x: MARGIN,
    y: MARGIN,
    w: sheet.w - MARGIN * 2,
    h: sheet.h - MARGIN * 2,
  };

  // Sheet border and the drawing area left of the title block.
  dl.rect(frame.x, frame.y, frame.w, frame.h, { lw: 0.5 });
  const draw = {
    x: frame.x + 4,
    y: frame.y + 10,
    w: frame.w - 8,
    h: frame.h - BLOCK.h - 16,
  };

  const bbox = vertices.reduce(
    (b, v) => ({
      minE: Math.min(b.minE, v.E),
      maxE: Math.max(b.maxE, v.E),
      minN: Math.min(b.minN, v.N),
      maxN: Math.max(b.maxN, v.N),
    }),
    { minE: Infinity, maxE: -Infinity, minN: Infinity, maxN: -Infinity },
  );

  const scaleDen = chooseScale(bbox, draw, 0.18);
  const P = worldToPaper(bbox, draw, scaleDen);

  dl.text(draw.x, frame.y + 6, t('planta.title'), { size: 4.2, bold: true });
  dl.text(draw.x + draw.w, frame.y + 6, `${parcel.propertyName} — ${parcel.owner}`, {
    size: 3,
    align: 'right',
  });

  drawGrid(dl, bbox, P, draw, scaleDen);
  drawParcel(dl, vertices, P);
  drawSides(dl, sides, P, lang);
  drawVertices(dl, vertices, P);
  if (traverse?.ok) drawTraverse(dl, traverse, P);
  drawNorthArrow(dl, draw, datum, lang);
  drawScaleBar(dl, draw, scaleDen);
  drawTitleBlock(dl, frame, {
    parcel,
    area,
    perimeter,
    scaleDen,
    state,
    playerName,
    lang,
  });

  return { drawList: dl, scaleDen, sheet, bbox };
}

/** A coordinate grid at a round interval, with crosses rather than full lines. */
function drawGrid(dl, bbox, P, draw, scaleDen) {
  const step = scaleDen <= 500 ? 20 : scaleDen <= 1500 ? 50 : 100;
  const startE = Math.ceil(bbox.minE / step) * step;
  const startN = Math.ceil(bbox.minN / step) * step;

  for (let e = startE; e <= bbox.maxE; e += step) {
    for (let n = startN; n <= bbox.maxN; n += step) {
      const p = P(e, n);
      if (p.x < draw.x || p.x > draw.x + draw.w || p.y < draw.y || p.y > draw.y + draw.h) continue;
      dl.line(p.x - 1.2, p.y, p.x + 1.2, p.y, { w: 0.12, colour: '#8a8a8a' });
      dl.line(p.x, p.y - 1.2, p.x, p.y + 1.2, { w: 0.12, colour: '#8a8a8a' });
    }
  }

  // Label the grid along the top and left edges only.
  for (let e = startE; e <= bbox.maxE; e += step) {
    const p = P(e, bbox.maxN);
    if (p.x < draw.x || p.x > draw.x + draw.w) continue;
    dl.text(p.x, draw.y - 1, String(Math.round(e)), { size: 1.8, align: 'center', colour: '#666' });
  }
  for (let n = startN; n <= bbox.maxN; n += step) {
    const p = P(bbox.minE, n);
    if (p.y < draw.y || p.y > draw.y + draw.h) continue;
    dl.text(draw.x - 1, p.y, String(Math.round(n)), { size: 1.8, align: 'right', colour: '#666' });
  }
}

function drawParcel(dl, vertices, P) {
  const pts = vertices.map((v) => {
    const p = P(v.E, v.N);
    return [p.x, p.y];
  });
  dl.poly(pts, { closed: true, w: 0.6, colour: '#111', fill: 'rgba(217,98,43,0.06)' });
}

function drawSides(dl, sides, P, lang) {
  for (const s of sides) {
    const a = P(s.fromPoint.E, s.fromPoint.N);
    const b = P(s.toPoint.E, s.toPoint.N);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    // Rotate the dimension text along the line, flipped when it would be upside
    // down — a plan whose labels read backwards is not a plan anyone will use.
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;

    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 8) continue; // too short to letter legibly

    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;

    dl.text(mx + nx * 1.8, my + ny * 1.8, `${num(s.distance, 2)} m`, {
      size: 2.1,
      align: 'center',
      angle: -angle,
      bold: true,
    });
    dl.text(mx + nx * 4.2, my + ny * 4.2, `Az ${formatDMS(s.azimuth)}`, {
      size: 1.8,
      align: 'center',
      angle: -angle,
      colour: '#444',
    });

    // Confrontante goes OUTSIDE the parcel; the ring is counter-clockwise, so
    // the outward normal is the other side.
    //
    // Truncated to what the line can actually hold, because neighbouring names
    // are long ("Chácara Beira-Córrego, de propriedade de …") and three of them
    // overlapping across the top of the sheet is worse than three short ones.
    const size = 1.7;
    const maxChars = Math.floor(len / (size * 0.58));
    if (s.confrontante && maxChars >= 10) {
      dl.text(mx - nx * 3.2, my - ny * 3.2, truncate(s.confrontante, Math.min(maxChars, 46)), {
        size,
        align: 'center',
        angle: -angle,
        colour: '#2f6fb5',
      });
    }
  }
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function drawVertices(dl, vertices, P) {
  for (const v of vertices) {
    const p = P(v.E, v.N);
    dl.circle(p.x, p.y, 0.9, { w: 0.3, colour: '#111', fill: '#fff' });
    dl.text(p.x + 1.6, p.y - 1.4, v.label || v.id, { size: 2.3, bold: true });
  }
}

function drawTraverse(dl, traverse, P) {
  const pts = traverse.coords.map((c) => {
    const p = P(c.E, c.N);
    return [p.x, p.y];
  });
  dl.poly(pts, { closed: true, w: 0.35, colour: '#d9622b', dash: [2, 1.4] });
  for (const c of traverse.coords) {
    const p = P(c.E, c.N);
    dl.tri(
      [
        [p.x, p.y - 1.4],
        [p.x + 1.2, p.y + 1],
        [p.x - 1.2, p.y + 1],
      ],
      { colour: '#d9622b', fill: '#fff', w: 0.3 },
    );
  }
}

function drawNorthArrow(dl, draw, datum, lang) {
  const x = draw.x + draw.w - 14;
  const y = draw.y + 16;
  dl.tri(
    [
      [x, y - 9],
      [x + 3.4, y + 2],
      [x, y - 0.6],
    ],
    { fill: '#111', colour: '#111', w: 0.2 },
  );
  dl.tri(
    [
      [x, y - 9],
      [x - 3.4, y + 2],
      [x, y - 0.6],
    ],
    { fill: '#fff', colour: '#111', w: 0.2 },
  );
  dl.text(x, y - 10.6, 'N', { size: 3, align: 'center', bold: true });
  const key = datum?.northLabel === 'magnetico' ? 'planta.northMagnetic' : 'planta.northArbitrary';
  dl.text(x, y + 5, t(key), { size: 1.7, align: 'center', colour: '#444' });
  void lang;
}

function drawScaleBar(dl, draw, scaleDen) {
  const mmPerMetre = 1000 / scaleDen;
  const candidates = [5, 10, 20, 25, 50, 100, 200, 500];
  const total = candidates.find((c) => c * mmPerMetre >= 30 && c * mmPerMetre <= 65) || 100;
  const wmm = total * mmPerMetre;

  const x = draw.x + 2;
  const y = draw.y + draw.h - 3;
  const segs = 4;

  for (let i = 0; i < segs; i++) {
    dl.rect(x + (wmm / segs) * i, y - 1.6, wmm / segs, 1.6, {
      lw: 0.15,
      colour: '#111',
      fill: i % 2 ? '#fff' : '#111',
    });
  }
  for (let i = 0; i <= segs; i++) {
    dl.text(x + (wmm / segs) * i, y + 2.4, String(Math.round((total / segs) * i)), {
      size: 1.7,
      align: 'center',
    });
  }
  dl.text(x + wmm + 3, y + 2.4, 'm', { size: 1.7 });
  dl.text(x, y - 3.2, `1:${scaleDen}`, { size: 2.4, bold: true });
}

function drawTitleBlock(dl, frame, { parcel, area, perimeter, scaleDen, state, playerName, lang }) {
  const x = frame.x + frame.w - BLOCK.w - 3;
  const y = frame.y + frame.h - BLOCK.h - 3;

  dl.rect(x, y, BLOCK.w, BLOCK.h, { lw: 0.4, fill: '#fff' });

  const rows = [
    [t('planta.property'), parcel.propertyName],
    [t('planta.owner'), parcel.owner],
    [t('planta.municipio'), `${parcel.municipio} / ${parcel.uf}`],
    [t('planta.area'), `${num(area.m2, 2)} m²  (${num(area.hectares, 4)} ha)`],
    [t('planta.perimeter'), `${num(perimeter, 2)} m`],
    [t('planta.scale'), `1:${scaleDen}`],
    [t('planta.date'), dateLong()],
    [t('planta.responsible'), playerName || t('app.title')],
    [t('planta.seed'), state.seed],
  ];

  let ry = y + 5;
  for (const [k, v] of rows) {
    dl.text(x + 2.5, ry, `${k}:`, { size: 1.9, colour: '#555' });
    dl.text(x + 26, ry, truncate(String(v), 44), { size: 1.9, bold: true });
    ry += 4.6;
  }

  // Non-negotiable: this document imitates a legal instrument and must never be
  // mistakable for one.
  dl.rect(x, y + BLOCK.h - 6, BLOCK.w, 6, { lw: 0.3, fill: '#fdeaea' });
  dl.text(x + BLOCK.w / 2, y + BLOCK.h - 2.2, t('planta.disclaimer'), {
    size: 2,
    align: 'center',
    bold: true,
    colour: '#a3241a',
  });
  void lang;
}

/** Page two: the coordinate and side tables, as DocBlocks. */
export function buildPlantaTables(report, docs, lang) {
  docs.h2(t('planta.tableVertices'));
  docs.table(
    [t('planta.colPoint'), t('planta.colE'), t('planta.colN')],
    report.vertices.map((v) => [v.label || v.id, num(v.E, 3), num(v.N, 3)]),
  );
  docs.spacer(4);
  docs.h2(t('planta.tableSides'));
  docs.table(
    [t('planta.colSide'), t('planta.colAz'), t('planta.colRumo'), t('planta.colDist'), t('planta.colConfrontante')],
    report.sides.map((s) => [
      `${s.from}–${s.to}`,
      formatDMS(s.azimuth),
      formatRumo(s.azimuth, lang),
      num(s.distance, 2),
      s.confrontante,
    ]),
  );
  return docs;
}

export { getInstrument };
