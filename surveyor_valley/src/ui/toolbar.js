// The tool rail.
//
// Every button's enabled state AND its tooltip come from `tools.canActivate`,
// so there is one description of each rule. A disabled button always explains
// itself — being told "implante dois marcos primeiro" is the tutorial.

import { el, clear } from './dom.js';
import { t } from './i18n.js';
import { TOOL, TOOL_ORDER } from '../game/tools.js';

const ICONS = {
  [TOOL.WALK]:
    '<path d="M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7l-3 3v5h2v-4l2-1 2 6 2-1-2-6 2-2 2 3 2-1-3-4z"/>',
  [TOOL.MARCO]:
    '<path d="M9 2h6l1 14H8zM7 17h10v3H7z"/>',
  [TOOL.ESTACAO]:
    '<path d="M12 2a3 3 0 0 1 3 3v2h-6V5a3 3 0 0 1 3-3zM8 8h8v3H8zM12 11 5 21h2l5-7 5 7h2z"/>',
  [TOOL.VISADA]:
    '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2.5A5.5 5.5 0 1 1 12 17.5 5.5 5.5 0 0 1 12 6.5zM11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4z"/>',
  [TOOL.CADERNETA]:
    '<path d="M5 3h14v18H5zm3 4h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/>',
  [TOOL.CALCULOS]:
    '<path d="M4 3h16v18H4zm3 3h10v3H7zm0 5h3v3H7zm5 0h3v3h-3zm-5 5h3v3H7zm5 0h3v3h-3z"/>',
  [TOOL.MAPA]:
    '<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zM9 5.5l6 2v11l-6-2z"/>',
  [TOOL.ENTREGA]:
    '<path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 12h8v2H8zm0 4h8v2H8z"/>',
};

const icon = (tool) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${ICONS[tool] || ''}</svg>`;

export function makeToolbar({ root, tools, onSelect }) {
  const rail = el('nav.toolbar', { 'aria-label': t('app.title') });
  root.append(rail);

  const buttons = new Map();

  function build() {
    clear(rail);
    buttons.clear();
    TOOL_ORDER.forEach((tool, i) => {
      const btn = el('button.tool-btn', {
        type: 'button',
        dataset: { tool },
        onclick: () => onSelect(tool),
      });
      btn.innerHTML = icon(tool);
      btn.append(el('span.tool-label', { text: t(`tool.${tool}`) }));
      btn.append(el('kbd.tool-key', { text: tool === TOOL.MAPA ? 'M' : String(i + 1) }));
      rail.append(btn);
      buttons.set(tool, btn);
    });
  }

  /** Refresh enabled state and tooltips from the single source of truth. */
  function refresh() {
    for (const { tool, ok, reasonKey } of tools.survey()) {
      const btn = buttons.get(tool);
      if (!btn) continue;
      btn.disabled = !ok;
      btn.classList.toggle('is-disabled', !ok);
      btn.classList.toggle('is-active', tools.active === tool);
      btn.title = ok ? t(`tool.${tool}`) : t(reasonKey);
      btn.setAttribute('aria-disabled', String(!ok));
    }
  }

  build();
  refresh();

  return {
    refresh,
    rebuildLabels() {
      build();
      refresh();
    },
  };
}
