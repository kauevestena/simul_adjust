// Two renderer-agnostic document structures, both in PAPER MILLIMETRES.
//
// Composition happens once, against these; canvas preview, HTML and PDF are
// then three thin renderers over the same data. That is what guarantees the
// drawing the player looks at and the PDF they hand in are the same document,
// and it is why the PDF layer needs no scaling logic of its own — jsPDF is
// already in millimetres.

/** A4, the paper every Brazilian survey document is delivered on. */
export const A4 = {
  landscape: { w: 297, h: 210 },
  portrait: { w: 210, h: 297 },
};

/**
 * Stroke width is stored as `lw` on EVERY primitive, never as `w`.
 *
 * `w` means the width of a rectangle, and a renderer that reads `it.w` as the
 * pen width will happily stroke a 277 mm border — painting the whole sheet
 * solid black. Callers may still pass `w` for convenience on the stroke-only
 * shapes; it is normalised to `lw` here so the two meanings can never collide
 * downstream.
 */
export function makeDrawList() {
  const items = [];
  const api = {
    items,
    line(x1, y1, x2, y2, { w = 0.25, lw = w, colour = '#000', dash = null } = {}) {
      items.push({ t: 'line', x1, y1, x2, y2, lw, colour, dash });
      return api;
    },
    poly(pts, { w = 0.25, lw = w, colour = '#000', closed = false, dash = null, fill = null } = {}) {
      items.push({ t: 'poly', pts, lw, colour, closed, dash, fill });
      return api;
    },
    rect(x, y, w, h, { lw = 0.25, colour = '#000', fill = null } = {}) {
      items.push({ t: 'rect', x, y, w, h, lw, colour, fill });
      return api;
    },
    circle(x, y, r, { w = 0.25, lw = w, colour = '#000', fill = null } = {}) {
      items.push({ t: 'circle', x, y, r, lw, colour, fill });
      return api;
    },
    text(x, y, s, { size = 2.5, align = 'left', angle = 0, bold = false, colour = '#000' } = {}) {
      items.push({ t: 'text', x, y, s, size, align, angle, bold, colour });
      return api;
    },
    /** A filled triangle, used for the north arrow and station symbols. */
    tri(pts, { colour = '#000', fill = '#000', w = 0.25, lw = w } = {}) {
      items.push({ t: 'poly', pts, closed: true, colour, fill, lw });
      return api;
    },
  };
  return api;
}

export function makeDocBlocks() {
  const blocks = [];
  const api = {
    blocks,
    h1: (text) => (blocks.push({ t: 'h1', text }), api),
    h2: (text) => (blocks.push({ t: 'h2', text }), api),
    p: (text, opts = {}) => (blocks.push({ t: 'p', text, ...opts }), api),
    kv: (pairs) => (blocks.push({ t: 'kv', pairs }), api),
    table: (head, rows) => (blocks.push({ t: 'table', head, rows }), api),
    sign: (name, role) => (blocks.push({ t: 'sign', name, role }), api),
    spacer: (mm = 4) => (blocks.push({ t: 'spacer', mm }), api),
    pagebreak: () => (blocks.push({ t: 'pagebreak' }), api),
    note: (text) => (blocks.push({ t: 'note', text }), api),
  };
  return api;
}

/**
 * Build the world-metres to paper-millimetres transform for a drawing frame.
 *
 * @param {{minE,minN,maxE,maxN}} bbox   extent to fit, in metres
 * @param {{x,y,w,h}} frame              drawing area, in millimetres
 * @param {number} scaleDen              e.g. 1000 for 1:1000
 */
export function worldToPaper(bbox, frame, scaleDen) {
  // 1 m of ground occupies 1000/scaleDen millimetres of paper.
  const mmPerMetre = 1000 / scaleDen;
  const cx = (bbox.minE + bbox.maxE) / 2;
  const cy = (bbox.minN + bbox.maxN) / 2;
  const fx = frame.x + frame.w / 2;
  const fy = frame.y + frame.h / 2;

  return (e, n) => ({
    x: fx + (e - cx) * mmPerMetre,
    // Paper Y grows downward, North grows upward.
    y: fy - (n - cy) * mmPerMetre,
  });
}

/** The standard scale series, and the first denominator the drawing fits into. */
export const SCALE_SERIES = [250, 500, 1000, 1500, 2000, 2500, 5000, 10000];

export function chooseScale(bbox, frame, margin = 0.1) {
  const wM = (bbox.maxE - bbox.minE) * (1 + margin);
  const hM = (bbox.maxN - bbox.minN) * (1 + margin);
  for (const den of SCALE_SERIES) {
    const mmPerMetre = 1000 / den;
    if (wM * mmPerMetre <= frame.w && hM * mmPerMetre <= frame.h) return den;
  }
  return SCALE_SERIES[SCALE_SERIES.length - 1];
}

/** Strip diacritics for a filesystem-safe filename. */
export const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
