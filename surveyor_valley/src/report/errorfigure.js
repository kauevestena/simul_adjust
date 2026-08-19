// The carta de erros: where the error actually went.
//
// The debrief has always reported the area error, the perimeter error and a
// side RMS. All three are datum-invariant, which is exactly why they came
// first — they answer "how good was this survey?" without needing the surveyed
// frame and the world's to be aligned at all. What none of them can answer is
// "WHICH corner did I get wrong?", and that is the question a student is left
// holding, because it is the only one that tells them what to do differently.
//
// So this draws the surveyed polygon with an error vector at every corner. The
// vectors are tiny — millimetres against a fifty-metre figure — so they are
// exaggerated by a stated factor, which is the ordinary cartographic convention
// for exactly this plot and is printed on the drawing so nobody reads the
// arrows as ground distance.
//
// It is deliberately NOT part of the planta. The planta is the deliverable and
// imitates a legal instrument; truth has no business being on it. This figure
// exists only at the debrief, which is the one place in the whole game where
// the true coordinates are shown at all.
//
// DOM-free: a drawList in paper millimetres, rendered by the same
// `reportview.js#drawListToCanvas` the planta preview goes through.

import { makeDrawList, worldToPaper } from './docmodel.js';

const MARGIN = 6;

/**
 * Its own sheet, not A4.
 *
 * The planta is A4 because it is a document somebody files. This is a figure on
 * a debrief screen, so it is sized to be READ there — squarer and smaller, so
 * the polygon fills it instead of floating in the middle of a landscape page
 * with the vectors too small to see.
 */
export const FIGURE_SHEET = { w: 150, h: 110 };

/** Exaggerations worth printing. Round numbers, because a reader has to hold it. */
const FACTORS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/**
 * Pick the exaggeration so the worst vector reads at about `target` of the
 * figure's width — big enough to see, small enough not to leave the sheet.
 */
export function chooseExaggeration(worstMetres, spanMetres, target = 0.08) {
  if (!(worstMetres > 0) || !(spanMetres > 0)) return FACTORS[0];
  const want = (spanMetres * target) / worstMetres;
  let best = FACTORS[0];
  for (const f of FACTORS) if (f <= want) best = f;
  return best;
}

/**
 * @param {object} p
 * @param {Array<{label:string, E:number, N:number, dE:number, dN:number, d:number}>} p.corners
 *        surveyed position and its error IN THE ALIGNED FRAME — see
 *        `network.js#datumShift` for why the alignment is a pure translation.
 * @param {(key:string, vars?:object) => string} p.t  translator
 */
export function buildErrorFigure({ corners, t, sheet = FIGURE_SHEET }) {
  const dl = makeDrawList();
  if (!corners || corners.length < 3) return { drawList: dl, sheet, factor: 1, scaleDen: 1 };

  const frame = { x: MARGIN, y: MARGIN, w: sheet.w - MARGIN * 2, h: sheet.h - MARGIN * 2 };
  dl.rect(frame.x, frame.y, frame.w, frame.h, { lw: 0.4 });

  const draw = { x: frame.x + 6, y: frame.y + 12, w: frame.w - 12, h: frame.h - 30 };

  const bbox = corners.reduce(
    (b, c) => ({
      minE: Math.min(b.minE, c.E),
      maxE: Math.max(b.maxE, c.E),
      minN: Math.min(b.minN, c.N),
      maxN: Math.max(b.maxN, c.N),
    }),
    { minE: Infinity, maxE: -Infinity, minN: Infinity, maxN: -Infinity },
  );

  // Fitted, not stepped to a standard scale series. A planta must be at 1:500
  // or 1:1000 because somebody scales distances off it; nobody scales anything
  // off an error plot, and rounding to the series here just leaves the figure
  // small and the vectors with it.
  const scaleDen = fitScale(bbox, draw, 0.22);
  const P = worldToPaper(bbox, draw, scaleDen);

  const span = Math.max(bbox.maxE - bbox.minE, bbox.maxN - bbox.minN);
  const worst = corners.reduce((m, c) => Math.max(m, c.d), 0);
  const factor = chooseExaggeration(worst, span);

  dl.text(draw.x, frame.y + 7, t('debrief.figureTitle'), { size: 4, bold: true });

  // The surveyed figure, thin: it is the reference, not the subject.
  dl.poly(corners.map((c) => { const p = P(c.E, c.N); return [p.x, p.y]; }), {
    closed: true,
    lw: 0.3,
    colour: '#6b5334',
  });

  for (const c of corners) {
    const a = P(c.E, c.N);
    // Drawn from the TRUE position to the surveyed one, exaggerated: the arrow
    // head lands where the student put the corner, which is the way round that
    // reads as "you were off by this much, in this direction".
    const b = P(c.E + c.dE * factor, c.N + c.dN * factor);

    dl.circle(a.x, a.y, 0.7, { lw: 0.25, colour: '#1f2a33', fill: '#1f2a33' });
    if (c.d > 0) {
      dl.line(a.x, a.y, b.x, b.y, { lw: 0.7, colour: '#cf3f34' });
      arrowHead(dl, a, b);
    }
    dl.text(a.x + 1.6, a.y - 1.6, `${c.label} · ${(c.d * 1000).toFixed(0)} mm`, { size: 2.4 });
  }

  // The caption carries the two numbers without which the drawing lies: how
  // much the vectors are magnified, and the scale of the figure they sit on.
  dl.text(draw.x, frame.y + frame.h - 9, t('debrief.figureLegend', { factor, scale: Math.round(scaleDen / 10) * 10 }), {
    size: 3,
    bold: true,
  });
  dl.text(draw.x, frame.y + frame.h - 4, t('debrief.figureNote'), { size: 2.3, colour: '#6b5334' });

  return { drawList: dl, sheet, factor, scaleDen, worst };
}

/** The largest scale that still fits the figure, with room for the labels. */
function fitScale(bbox, frame, margin) {
  const wM = Math.max(1e-6, (bbox.maxE - bbox.minE) * (1 + margin));
  const hM = Math.max(1e-6, (bbox.maxN - bbox.minN) * (1 + margin));
  // mm of paper per metre of ground, limited by whichever dimension binds.
  const mmPerMetre = Math.min(frame.w / wM, frame.h / hM);
  return 1000 / mmPerMetre;
}

function arrowHead(dl, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.6) return;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(2.2, len * 0.45);
  const w = h * 0.45;
  dl.poly(
    [
      [to.x, to.y],
      [to.x - ux * h - uy * w, to.y - uy * h + ux * w],
      [to.x - ux * h + uy * w, to.y - uy * h - ux * w],
    ],
    { closed: true, lw: 0.2, colour: '#cf3f34', fill: '#cf3f34' },
  );
}
