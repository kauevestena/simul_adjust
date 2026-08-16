// Toasts and the persistent warning banner.
//
// Two channels on purpose: a toast for "that happened" and a banner for "this
// is still true". A blocked sight line is a toast; being out of marcos is a
// banner, because it stays wrong until you do something about it.

import { el } from './dom.js';
import { t } from './i18n.js';

const TOAST_MS = 3600;

export function makeNotifier(root) {
  const toasts = el('div.toasts', { 'aria-live': 'polite' });
  const banner = el('div.banner', { hidden: true, role: 'status' });
  root.append(banner, toasts);

  function toast(message, kind = 'info') {
    const node = el(`div.toast.toast-${kind}`, { text: message });
    toasts.append(node);
    // Let the element land before animating, so the transition actually runs.
    requestAnimationFrame(() => node.classList.add('toast-in'));
    setTimeout(() => {
      node.classList.remove('toast-in');
      setTimeout(() => node.remove(), 260);
    }, TOAST_MS);
    return node;
  }

  return {
    toast,
    /** Toast from an i18n key, which is what the event bus carries. */
    key(key, params = {}, kind = 'info') {
      return toast(t(key, params), kind);
    },
    info: (msg) => toast(msg, 'info'),
    warn: (msg) => toast(msg, 'warn'),
    error: (msg) => toast(msg, 'error'),
    success: (msg) => toast(msg, 'success'),

    setBanner(message, kind = 'warn') {
      if (!message) {
        banner.hidden = true;
        return;
      }
      banner.className = `banner banner-${kind}`;
      banner.textContent = message;
      banner.hidden = false;
    },
    clearBanner() {
      banner.hidden = true;
    },
  };
}
