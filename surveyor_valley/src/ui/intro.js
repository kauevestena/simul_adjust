// The opening dialog: what the game is, how to move, and the three choices
// that shape the run — language, difficulty, and the world seed.
//
// The language toggle lives here because the brief asks for it here, and
// because it is the one setting a student must be able to find before they can
// read anything else.

import { el } from './dom.js';
import { t, num, setLanguage, lang, availableLanguages, applyI18n } from './i18n.js';
import { randomSeed } from '../core/rng.js';
import { DIFFICULTY } from '../core/state.js';

const CONTROLS = [
  ['intro.moveKeys', 'intro.moveDesc'],
  ['intro.runKeys', 'intro.runDesc'],
  ['intro.mouseKeys', 'intro.mouseDesc'],
  ['intro.rightDragKeys', 'intro.rightDragDesc'],
  ['intro.toolKeys', 'intro.toolDesc'],
  ['intro.spaceKeys', 'intro.spaceDesc'],
  ['intro.batchKeys', 'intro.batchDesc'],
  ['intro.dblClickKeys', 'intro.dblClickDesc'],
  ['intro.escKeys', 'intro.escDesc'],
];

/**
 * @param {object} p
 * @param {object} p.modals
 * @param {(opts:{seed:string, difficulty:string}) => void} p.onStart
 * @param {() => void} [p.onContinue]  present only when a save can be resumed
 * @param {{done:number, money:number}} [p.saved]  what that save contains
 */
export function showIntro({ modals, onStart, onContinue = null, saved = null, initial = {} }) {
  let seed = initial.seed || randomSeed();
  let difficulty = initial.difficulty || 'medio';

  const seedInput = el('input.seed-input', {
    type: 'text',
    value: seed,
    spellcheck: 'false',
    'aria-label': t('intro.seedTitle'),
    oninput: (ev) => {
      seed = ev.target.value.trim() || randomSeed();
    },
  });

  const langButtons = el(
    'div.lang-switch',
    { role: 'group', 'aria-label': t('intro.languageTitle') },
    availableLanguages().map((code) =>
      el(`button.lang-btn${code === lang() ? '.is-active' : ''}`, {
        type: 'button',
        dataset: { lang: code },
        text: code.toUpperCase(),
        onclick: (ev) => {
          setLanguage(code);
          for (const b of ev.target.parentElement.children) {
            b.classList.toggle('is-active', b.dataset.lang === code);
          }
          rerender();
        },
      }),
    ),
  );

  const difficultyButtons = el(
    'div.difficulty-choice',
    { role: 'radiogroup' },
    Object.keys(DIFFICULTY).map((id) =>
      el(
        `button.diff-btn${id === difficulty ? '.is-active' : ''}`,
        {
          type: 'button',
          dataset: { diff: id },
          role: 'radio',
          'aria-checked': String(id === difficulty),
          onclick: (ev) => {
            difficulty = id;
            const group = ev.currentTarget.parentElement;
            for (const b of group.children) {
              const on = b.dataset.diff === id;
              b.classList.toggle('is-active', on);
              b.setAttribute('aria-checked', String(on));
            }
          },
        },
        el('strong', { 'data-i18n': `difficulty.${id}` }),
        el('span', { 'data-i18n': `difficulty.${id}Desc` }),
      ),
    ),
  );

  const body = el(
    'div.intro',
    {},
    el('p.intro-tagline', { 'data-i18n': 'intro.tagline' }),

    el(
      'section.intro-section',
      {},
      el('h3', { 'data-i18n': 'intro.objectiveTitle' }),
      el('p', { 'data-i18n': 'intro.objective' }),
    ),

    el(
      'section.intro-section',
      {},
      el('h3', { 'data-i18n': 'intro.controlsTitle' }),
      el(
        'dl.controls',
        {},
        CONTROLS.flatMap(([k, d]) => [el('dt', { 'data-i18n': k }), el('dd', { 'data-i18n': d })]),
      ),
    ),

    el(
      'div.intro-choices',
      {},
      el(
        'section.intro-section',
        {},
        el('h3', { 'data-i18n': 'intro.languageTitle' }),
        langButtons,
      ),
      el(
        'section.intro-section',
        {},
        el('h3', { 'data-i18n': 'intro.seedTitle' }),
        el(
          'div.seed-row',
          {},
          seedInput,
          el('button.btn.btn-ghost', {
            type: 'button',
            'data-i18n': 'intro.seedRandom',
            onclick: () => {
              seed = randomSeed();
              seedInput.value = seed;
            },
          }),
        ),
        el('p.hint', { 'data-i18n': 'intro.seedHelp' }),
      ),
    ),

    el(
      'section.intro-section',
      {},
      el('h3', { 'data-i18n': 'intro.difficultyTitle' }),
      difficultyButtons,
    ),

    el('p.disclaimer', { 'data-i18n': 'intro.disclaimer' }),
  );

  // Resuming leads, when there is something to resume. The summary is there so
  // the choice is informed: "continue" and "new game" look identical otherwise,
  // and one of them silently throws away a campaign.
  if (onContinue && saved) {
    body.prepend(
      el(
        'section.intro-section.intro-resume',
        {},
        el('h3', { 'data-i18n': 'intro.resumeTitle' }),
        el('p', {
          text: t('intro.resumeSummary', { done: saved.done, money: num(saved.money, 0) }),
        }),
        el('p.hint', { 'data-i18n': 'intro.resumeWarning' }),
      ),
    );
  }

  const dialog = modals.open({
    titleKey: 'intro.title',
    body,
    dismissible: false,
    wide: true,
    actions: [
      ...(onContinue ? [{ labelKey: 'intro.resume', primary: true, onClick: () => onContinue() }] : []),
      {
        labelKey: onContinue ? 'intro.startNew' : 'intro.start',
        primary: !onContinue,
        onClick: () => onStart({ seed, difficulty }),
      },
    ],
  });

  function rerender() {
    applyI18n(dialog.node);
    // Action labels live outside the translated body, so they are set by hand.
    // There may be one button or two, depending on whether a save can resume.
    const buttons = [...dialog.node.querySelectorAll('.modal-actions .btn')];
    const labels = onContinue ? ['intro.resume', 'intro.startNew'] : ['intro.start'];
    buttons.forEach((btn, i) => {
      if (labels[i]) btn.textContent = t(labels[i]);
    });
    const title = dialog.node.querySelector('.modal-title');
    if (title) title.textContent = t('intro.title');
  }

  rerender();
  return dialog;
}
