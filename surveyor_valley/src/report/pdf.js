// PDF export.
//
// jsPDF is loaded LAZILY, on the first export, so the game still boots in a
// classroom with no network. It is a UMD bundle, so a dynamic import() will not
// do — the script has to be injected.
//
// The DrawList is already in millimetres and jsPDF is configured in
// millimetres, so page one maps one-to-one with no scaling layer at all.
//
// If the CDN is unreachable — school firewalls being what they are — the caller
// falls back to the browser's own print-to-PDF, which needs no network.

import { A4, slug } from './docmodel.js';
import { t } from '../ui/i18n.js';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';

let loading = null;

export function loadJsPDF() {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () =>
      globalThis.jspdf?.jsPDF ? resolve(globalThis.jspdf.jsPDF) : reject(new Error('jsPDF loaded but missing'));
    script.onerror = () => {
      loading = null;
      reject(new Error('jsPDF could not be fetched'));
    };
    document.head.append(script);
  });
  return loading;
}

const MARGIN = 16;

/**
 * @param {object} p
 * @param {{items:Array}} p.drawList   page 1, in millimetres
 * @param {Array} p.blocks             memorial and tables, pages 2+
 * @param {string} p.filenameBase
 */
export async function exportPDF({ drawList, blocks, filenameBase, sheet = A4.landscape }) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  renderDrawList(doc, drawList);

  doc.addPage('a4', 'portrait');
  renderBlocks(doc, blocks);

  const name = `SurveyorValley_${slug(filenameBase)}_${stamp()}.pdf`;
  doc.save(name);
  void sheet;
  return name;
}

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/** Hex to the [r,g,b] triple jsPDF wants. Falls back to black. */
function rgb(colour) {
  if (!colour || typeof colour !== 'string') return [0, 0, 0];
  const m = colour.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const rgba = colour.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b] = rgba[1].split(',').map((s) => parseFloat(s));
    return [r, g, b];
  }
  return [0, 0, 0];
}

function renderDrawList(doc, drawList) {
  for (const it of drawList.items) {
    const stroke = rgb(it.colour);
    doc.setDrawColor(...stroke);
    // Never `it.w`: on a rect that is the rectangle's width, not the pen's.
    doc.setLineWidth(it.lw ?? 0.25);
    if (it.dash) doc.setLineDashPattern(it.dash, 0);
    else doc.setLineDashPattern([], 0);

    switch (it.t) {
      case 'line':
        doc.line(it.x1, it.y1, it.x2, it.y2);
        break;

      case 'poly': {
        if (!it.pts.length) break;
        if (it.fill) {
          doc.setFillColor(...rgb(it.fill));
        }
        // jsPDF wants relative deltas from the first point.
        const deltas = [];
        for (let i = 1; i < it.pts.length; i++) {
          deltas.push([it.pts[i][0] - it.pts[i - 1][0], it.pts[i][1] - it.pts[i - 1][1]]);
        }
        if (it.closed) {
          const last = it.pts[it.pts.length - 1];
          deltas.push([it.pts[0][0] - last[0], it.pts[0][1] - last[1]]);
        }
        doc.lines(deltas, it.pts[0][0], it.pts[0][1], [1, 1], it.fill ? 'FD' : 'S', it.closed);
        break;
      }

      case 'rect':
        if (it.fill) {
          doc.setFillColor(...rgb(it.fill));
          doc.rect(it.x, it.y, it.w, it.h, 'FD');
        } else {
          doc.rect(it.x, it.y, it.w, it.h, 'S');
        }
        break;

      case 'circle':
        if (it.fill) {
          doc.setFillColor(...rgb(it.fill));
          doc.circle(it.x, it.y, it.r, 'FD');
        } else {
          doc.circle(it.x, it.y, it.r, 'S');
        }
        break;

      case 'text': {
        doc.setTextColor(...stroke);
        doc.setFont('helvetica', it.bold ? 'bold' : 'normal');
        // jsPDF sizes text in points; the DrawList is in millimetres.
        doc.setFontSize(it.size * (72 / 25.4));
        const opts = { align: it.align === 'center' ? 'center' : it.align === 'right' ? 'right' : 'left', baseline: 'middle' };
        if (it.angle) opts.angle = it.angle;
        doc.text(it.s, it.x, it.y, opts);
        break;
      }

      default:
        break;
    }
  }
  doc.setLineDashPattern([], 0);
}

function renderBlocks(doc, blocks) {
  const page = A4.portrait;
  const maxW = page.w - MARGIN * 2;
  let y = MARGIN;

  const need = (mm) => {
    if (y + mm > page.h - MARGIN) {
      doc.addPage('a4', 'portrait');
      y = MARGIN;
    }
  };

  const write = (text, { size = 10, bold = false, align = 'left', colour = [0, 0, 0], lead = 1.35 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...colour);
    const lines = doc.splitTextToSize(text, maxW);
    const lineH = (size * 25.4) / 72 * lead;
    for (const line of lines) {
      need(lineH);
      doc.text(line, align === 'center' ? page.w / 2 : MARGIN, y, { align });
      y += lineH;
    }
  };

  for (const b of blocks) {
    switch (b.t) {
      case 'h1':
        need(10);
        write(b.text, { size: 15, bold: true, align: 'center' });
        y += 3;
        break;

      case 'h2':
        y += 2;
        need(8);
        write(b.text, { size: 12, bold: true });
        y += 1;
        break;

      case 'p':
        write(b.text, { size: 10 });
        y += 2;
        break;

      case 'kv':
        for (const [k, v] of b.pairs) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          const label = `${k}: `;
          const labelW = doc.getTextWidth(label);
          const lines = doc.splitTextToSize(String(v), maxW - labelW);
          need(5);
          doc.setTextColor(0, 0, 0);
          doc.text(label, MARGIN, y);
          doc.setFont('helvetica', 'normal');
          doc.text(lines[0] ?? '', MARGIN + labelW, y);
          y += 4.6;
          for (const extra of lines.slice(1)) {
            need(4.6);
            doc.text(extra, MARGIN + labelW, y);
            y += 4.6;
          }
        }
        y += 2;
        break;

      case 'table': {
        const cols = b.head.length;
        const colW = maxW / cols;
        need(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        b.head.forEach((h, i) => doc.text(String(h), MARGIN + colW * i, y, { maxWidth: colW - 2 }));
        y += 4;
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y - 2.6, page.w - MARGIN, y - 2.6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        for (const row of b.rows) {
          need(4.4);
          row.forEach((c, i) => {
            const s = String(c);
            const fit = doc.splitTextToSize(s, colW - 2)[0] ?? s;
            doc.text(fit, MARGIN + colW * i, y);
          });
          y += 4.2;
        }
        y += 3;
        break;
      }

      case 'sign':
        y += 8;
        need(14);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y, MARGIN + 78, y);
        y += 4.5;
        write(`${b.name} — ${b.role}`, { size: 9.5 });
        break;

      case 'note':
        y += 3;
        write(b.text, { size: 8.5, bold: true, colour: [163, 36, 26] });
        break;

      case 'spacer':
        y += b.mm;
        break;

      case 'pagebreak':
        doc.addPage('a4', 'portrait');
        y = MARGIN;
        break;

      default:
        break;
    }
  }
}

/** Offline fallbacks: no network, no library, still a usable document. */
export function printFallback() {
  window.print();
}

export function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(rows, filename) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  downloadText(csv, filename);
}

export const pdfUnavailableMessage = () => t('delivery.pdfFailed');
