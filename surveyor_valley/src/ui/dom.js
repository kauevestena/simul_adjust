// Small DOM helpers. No framework, on purpose: the whole page is a canvas plus
// a handful of panels, and a build step would buy nothing.

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * `el('button.primary', {onclick}, 'Text')`
 * Tag may carry a #id and any number of .classes.
 */
export function el(spec, attrs = {}, ...children) {
  const [tagAndId, ...classes] = String(spec).split('.');
  const [tag, id] = tagAndId.split('#');
  const node = document.createElement(tag || 'div');
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') node.className = `${node.className} ${v}`.trim();
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

export const show = (node, on = true) => {
  if (node) node.hidden = !on;
  return node;
};
export const hide = (node) => show(node, false);

/** Keep Tab inside a dialog while it is open. */
export function trapFocus(container) {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function onKey(ev) {
    if (ev.key !== 'Tab') return;
    const items = qsa(selector, container).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

/** A `<table>` from a header row and body rows. */
export function table(head, rows, { className = 'tbl' } = {}) {
  const thead = el('thead', {}, el('tr', {}, head.map((h) => el('th', {}, h))));
  const tbody = el(
    'tbody',
    {},
    rows.map((r) => el('tr', {}, r.map((c) => el('td', {}, c)))),
  );
  return el(`table.${className}`, {}, thead, tbody);
}
