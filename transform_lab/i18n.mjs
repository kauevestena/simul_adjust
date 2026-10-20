// PT-BR / EN dictionary pairs, t(), data-t / data-label convention (as network_preanalysis).
// Keys used from code are written t('key') or L('key') so tests/i18n.test.mjs can find them.
import { words } from './words.mjs';

let language = 'pt-BR';
const listeners = [];
export const L = key => key;                      // marks a dictionary key in data tables

export function detectLanguage({ query = '', stored = '', browser = '' } = {}) {
  for (const value of [new URLSearchParams(query).get('lang'), stored]) {
    if (value === 'en') return 'en';
    if (value === 'pt' || value === 'pt-BR') return 'pt-BR';
  }
  return browser.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function initialLanguage() {
  let stored = '';
  try { stored = localStorage.getItem('monorepo_lang') || ''; } catch { /* storage blocked */ }
  return detectLanguage({ query: location.search, stored, browser: navigator.language || '' });
}

export const getLanguage = () => language;
export const onLanguage = fn => { listeners.push(fn); };

export function t(key, values = {}) {
  return (words[key]?.[language === 'pt-BR' ? 0 : 1] ?? key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

// Text without markup, for places that cannot show it (option text, titles, aria labels):
// σ<sub>d</sub> becomes σd instead of showing the tags
export const stripTags = s => String(s).replace(/<[^>]*>/g, '');
export const plain = (key, values) => stripTags(t(key, values));

export function applyLanguage(root = document) {
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = plain(el.dataset.t); });
  root.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
  root.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', plain(el.dataset.label)); el.title = plain(el.dataset.label); });
  root.querySelectorAll('[data-ph]').forEach(el => el.setAttribute('placeholder', plain(el.dataset.ph)));
}

export function setLanguage(lang, { rerender = true } = {}) {
  language = lang === 'en' ? 'en' : 'pt-BR';
  if (typeof document === 'undefined') return;
  try { localStorage.setItem('monorepo_lang', language); } catch { /* storage blocked */ }
  const url = new URL(location.href); url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  document.documentElement.lang = language;
  applyLanguage(document);
  document.title = `transform_lab · ${plain(document.body?.dataset.titleKey || 'title')}`;
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
  document.querySelectorAll('a.portal').forEach(el => { el.href = `../?lang=${language}`; });
  document.querySelectorAll('a[data-page]').forEach(el => { el.href = `${el.dataset.page}?lang=${language}`; });
  if (rerender) listeners.forEach(fn => fn(language));
}

export function bootLanguage() {
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
  setLanguage(initialLanguage());
}

export { words };
