import { bootLanguage } from './i18n.mjs';

bootLanguage();

// Both language versions stay in the DOM (CSS hides the inactive one), so the math is rendered once.
const MATH = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false }
  ],
  throwOnError: false
};
const render = () => window.renderMathInElement(document.getElementById('doc'), MATH);
if (window.renderMathInElement) render(); else window.addEventListener('load', render);
