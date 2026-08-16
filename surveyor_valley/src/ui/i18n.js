// Translation.
//
// Portuguese is the default and the fallback, which is what lets English ship
// incrementally: a missing English key falls through to the Portuguese one
// rather than rendering a raw dotted key at a student.
//
// Dynamic text — the memorial descritivo above all — is generated from data
// through `t()` at render time and never stored pre-rendered, so switching
// language regenerates the document properly instead of leaving half of it
// in the old language.

import pt from './lang/pt.js';
import en from './lang/en.js';
import { bus, EV } from '../core/bus.js';
import { storage } from '../core/storage.js';

const DICTS = { pt, en };
let current = 'pt';

/** Register a language after boot; `en` is loaded lazily. */
export function registerLanguage(code, dict) {
  DICTS[code] = dict;
}

export const availableLanguages = () => Object.keys(DICTS);

/**
 * Look up a key and interpolate `{placeholders}`.
 * Resolution: current language → Portuguese → the key itself.
 */
export function t(key, params = {}) {
  const dict = DICTS[current] || DICTS.pt;
  let str = dict[key];
  if (str == null) {
    str = DICTS.pt[key];
    if (str == null) {
      console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
  }
  return String(str).replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m,
  );
}

export const lang = () => current;
export const locale = () => (current === 'en' ? 'en-US' : 'pt-BR');

export function setLanguage(code) {
  if (!DICTS[code]) return false;
  current = code;
  storage.setLang(code);
  document.documentElement.lang = code === 'pt' ? 'pt-BR' : 'en';
  applyI18n(document);
  bus.emit(EV.LANG_CHANGED, code);
  return true;
}

/** Restore the stored choice, defaulting to Portuguese. No browser sniffing. */
export function initLanguage() {
  const stored = storage.getLang();
  current = stored && DICTS[stored] ? stored : 'pt';
  document.documentElement.lang = current === 'pt' ? 'pt-BR' : 'en';
  return current;
}

/**
 * Sweep a subtree and apply every translation attribute.
 * `data-i18n` sets text; the others set the matching attribute.
 */
export function applyI18n(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-html]')) {
    node.innerHTML = t(node.dataset.i18nHtml);
  }
  for (const [attr, dataKey] of [
    ['title', 'i18nTitle'],
    ['placeholder', 'i18nPlaceholder'],
    ['aria-label', 'i18nAria'],
  ]) {
    for (const node of root.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) {
      node.setAttribute(attr, t(node.dataset[dataKey]));
    }
  }
  return root;
}

/** Locale-aware number, matching the memorial's conventions. */
export function num(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function dateLong(d = new Date()) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/**
 * The angle unit the player has chosen: 'dms' or 'gon'.
 *
 * Kept here beside `lang()` because it is the same kind of thing — a display
 * preference every panel must agree on — and because routing it through the
 * store would make `formatAngle` callers depend on game state to render a
 * number.
 */
let angleFmt = 'dms';
export const angleFormat = () => angleFmt;
export function setAngleFormat(f) {
  angleFmt = f === 'gon' ? 'gon' : 'dms';
  return angleFmt;
}
