// The opening dialog: what the game is, how to move, and the choices that shape
// the run — who you are, the language, the difficulty, and the world seed.
//
// The language toggle lives here because the brief asks for it here, and
// because it is the one setting a student must be able to find before they can
// read anything else.
//
// The surveyor's own name and face live here for a less obvious reason: the
// name signs the planta and the memorial descritivo, and until this panel
// existed it was initialised empty and never assigned, so every document a
// student produced was signed "Surveyor Valley". A generated name means the
// field is never blank, and the sprite preview means the choice is visible
// rather than a row of abstract swatches.

import { el } from './dom.js';
import { t, num, setLanguage, lang, availableLanguages, applyI18n } from './i18n.js';
import { randomSeed, makeRng } from '../core/rng.js';
import { DIFFICULTY } from '../core/state.js';
import { SKIN_TONES, HAIR_TONES, HAT_STYLES, DEFAULT_LOOK } from '../render/palette.js';
import { surveyor } from '../render/sprites/character.js';
import { randomSurveyorName } from '../world/names.js';

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

  const look = { ...DEFAULT_LOOK, ...(initial.look || {}) };
  /** True once the player has typed over the generated name. */
  let nameEdited = Boolean(initial.name);
  let name = initial.name || rollName(look.body);

  // ---- who you are --------------------------------------------------------

  /**
   * The sprite, painted at 4x.
   *
   * Straight from the painter rather than through the atlas: `surveyor()`
   * returns a plain `{pix}`, the atlas does not exist yet at this point in the
   * boot, and a canvas here needs no GPU. Nearest-neighbour, because the whole
   * game's art depends on never scaling pixel art by a fraction.
   */
  const preview = el('canvas.char-preview', { width: 24 * 4, height: 34 * 4 });

  function paintPreview() {
    const { pix } = surveyor({ dir: 'S', pose: 'idle', look });
    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, preview.width, preview.height);
    const off = document.createElement('canvas');
    off.width = pix.w;
    off.height = pix.h;
    off.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.data), pix.w, pix.h), 0, 0);
    ctx.drawImage(off, 0, 0, preview.width, preview.height);
  }

  const nameInput = el('input.name-input', {
    type: 'text',
    value: name,
    maxlength: '40',
    spellcheck: 'false',
    'aria-label': t('intro.nameTitle'),
    oninput: (ev) => {
      name = ev.target.value;
      nameEdited = true;
    },
  });

  function rollName(body) {
    return randomSurveyorName(makeRng(String(Math.random()), 'surveyor'), body);
  }

  function setName(next) {
    name = next;
    nameInput.value = next;
  }

  /** A row of swatch buttons over one of the palette tables. */
  function swatches(className, items, key, colourOf) {
    const row = el('div.swatch-row', { role: 'radiogroup', 'aria-label': t(`intro.${key}Title`) });
    items.forEach((item, i) => {
      row.append(
        el(`button.swatch.${className}${i === look[key] ? '.is-active' : ''}`, {
          type: 'button',
          role: 'radio',
          'aria-checked': String(i === look[key]),
          'aria-label': t(`look.${key}.${item.id}`),
          title: t(`look.${key}.${item.id}`),
          style: { background: colourOf(item) },
          dataset: { index: String(i) },
          onclick: () => {
            look[key] = i;
            // Choosing a skin tone also picks the hair that goes with it, so the
            // first thing you see is always a plausible pairing. Only until you
            // have set the hair yourself — after that it is yours.
            if (key === 'skin' && !hairChosen) look.hair = item.hair;
            if (key === 'hair') hairChosen = true;
            for (const b of row.children) {
              const on = Number(b.dataset.index) === look[key];
              b.classList.toggle('is-active', on);
              b.setAttribute('aria-checked', String(on));
            }
            if (key === 'skin') syncHairRow();
            paintPreview();
          },
        }),
      );
    });
    return row;
  }

  let hairChosen = false;
  const skinRow = swatches('swatch-skin', SKIN_TONES, 'skin', (s) => s.base);
  const hairRow = swatches('swatch-hair', HAIR_TONES, 'hair', (h) => h.ramp[1]);
  const hatRow = swatches('swatch-hat', HAT_STYLES, 'hat', (h) => h.ramp[1]);

  /** Keep the hair row's highlight honest when a skin tone moves it. */
  function syncHairRow() {
    for (const b of hairRow.children) {
      const on = Number(b.dataset.index) === look.hair;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    }
  }

  const bodyButtons = el(
    'div.body-choice',
    { role: 'radiogroup', 'aria-label': t('intro.bodyTitle') },
    ['m', 'f'].map((id) =>
      el(`button.btn.body-btn${id === look.body ? '.is-active' : ''}`, {
        type: 'button',
        role: 'radio',
        'aria-checked': String(id === look.body),
        dataset: { body: id },
        'data-i18n': `look.body.${id}`,
        onclick: (ev) => {
          look.body = id;
          for (const b of ev.currentTarget.parentElement.children) {
            const on = b.dataset.body === id;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-checked', String(on));
          }
          // The name pool is gendered, so an untouched generated name follows
          // the body. One the player typed is never overwritten.
          if (!nameEdited) setName(rollName(id));
          paintPreview();
        },
      }),
    ),
  );

  const characterSection = el(
    'section.intro-section.intro-character',
    {},
    el('h3', { 'data-i18n': 'intro.characterTitle' }),
    el(
      'div.char-panel',
      {},
      preview,
      el(
        'div.char-options',
        {},
        el(
          'div.name-row',
          {},
          nameInput,
          el('button.btn.btn-ghost', {
            type: 'button',
            'data-i18n': 'intro.nameRoll',
            title: t('intro.nameRollHelp'),
            onclick: () => {
              setName(rollName(look.body));
              nameEdited = false;
            },
          }),
        ),
        bodyButtons,
        el('label.swatch-label', { 'data-i18n': 'intro.skinTitle' }),
        skinRow,
        el('label.swatch-label', { 'data-i18n': 'intro.hairTitle' }),
        hairRow,
        el('label.swatch-label', { 'data-i18n': 'intro.hatTitle' }),
        hatRow,
      ),
    ),
  );

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

    characterSection,

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
        // A name left blank falls back to a generated one rather than shipping
        // an unsigned memorial descritivo.
        onClick: () => onStart({ seed, difficulty, name: name.trim() || rollName(look.body), look: { ...look } }),
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
  paintPreview();
  return dialog;
}
