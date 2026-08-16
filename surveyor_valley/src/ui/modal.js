// One modal implementation for every dialog in the game.
//
// Backdrop click, Escape and a focus trap are all handled here, once, because a
// dialog that swallows the keyboard while the player is trying to walk is a
// bug that only shows up when someone is already frustrated.

import { el, clear, trapFocus } from './dom.js';
import { t } from './i18n.js';

export function makeModalHost(root) {
  const stack = [];

  const backdrop = el('div.modal-backdrop', { hidden: true });
  root.append(backdrop);

  function isOpen() {
    return stack.length > 0;
  }

  function close(handle) {
    const idx = handle ? stack.findIndex((s) => s.handle === handle) : stack.length - 1;
    if (idx < 0) return;
    const [entry] = stack.splice(idx, 1);
    entry.release?.();
    entry.node.remove();
    entry.onClose?.();
    if (!stack.length) {
      backdrop.hidden = true;
      document.body.classList.remove('modal-open');
    }
  }

  function closeAll() {
    while (stack.length) close();
  }

  /**
   * @param {object} opts
   * @param {string} opts.titleKey  i18n key for the heading
   * @param {Node|Node[]} opts.body
   * @param {Array<{labelKey:string, primary?:boolean, onClick?:Function, closes?:boolean}>} [opts.actions]
   * @param {boolean} [opts.dismissible]  backdrop/Escape close it
   */
  function open({ titleKey, title, body, actions = [], dismissible = true, wide = false, onClose = null }) {
    const handle = Symbol('modal');

    const closeBtn = el('button.modal-close', {
      type: 'button',
      'aria-label': t('common.close'),
      onclick: () => close(handle),
      html: '&times;',
    });

    const footer = actions.length
      ? el(
          'footer.modal-actions',
          {},
          actions.map((a) =>
            el(`button.btn${a.primary ? '.btn-primary' : ''}`, {
              type: 'button',
              disabled: a.disabled,
              onclick: () => {
                const keep = a.onClick?.();
                if (a.closes !== false && keep !== false) close(handle);
              },
              text: a.labelKey ? t(a.labelKey) : a.label,
            }),
          ),
        )
      : null;

    const node = el(
      `div.modal${wide ? '.modal-wide' : ''}`,
      { role: 'dialog', 'aria-modal': 'true' },
      el(
        'header.modal-head',
        {},
        el('h2.modal-title', { text: title || t(titleKey) }),
        dismissible ? closeBtn : null,
      ),
      el('div.modal-body', {}, Array.isArray(body) ? body : [body]),
      footer,
    );

    root.append(node);
    backdrop.hidden = false;
    document.body.classList.add('modal-open');

    const release = trapFocus(node);
    stack.push({ handle, node, release, onClose, dismissible });

    // Focus the primary action so Enter does the obvious thing.
    (node.querySelector('.btn-primary') || node.querySelector('button'))?.focus();

    return {
      handle,
      node,
      close: () => close(handle),
      setBody(next) {
        const bodyNode = node.querySelector('.modal-body');
        clear(bodyNode);
        bodyNode.append(...(Array.isArray(next) ? next : [next]));
      },
    };
  }

  backdrop.addEventListener('click', () => {
    const top = stack[stack.length - 1];
    if (top?.dismissible) close(top.handle);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !stack.length) return;
    const top = stack[stack.length - 1];
    if (top.dismissible) {
      ev.stopPropagation();
      close(top.handle);
    }
  });

  return { open, close, closeAll, isOpen };
}
