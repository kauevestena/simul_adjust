// The status bar and the service checklist.
//
// Deliberately sparse: property, clock, instrument state, progress. Anything
// that needs a table belongs in a panel, not permanently over the map.

import { el, clear } from './dom.js';
import { t, num } from './i18n.js';
import { fmtDuration } from '../survey/units.js';
import { specOf, getInstrument } from '../survey/instrument.js';

/**
 * The working day, as a clock face rather than a stopwatch.
 *
 * `elapsedMs` is the honest service time and it is what the debrief reports;
 * this only maps it onto a wall clock that starts when a crew would actually
 * reach the site. Seeing "09:40" turns elapsed time into something the player
 * feels — and it is the same number driving the colour of the light outside.
 */
const DAY_START_MIN = 8 * 60;
export function clockFor(elapsedMs) {
  // One real minute of play is roughly ten minutes of the working day.
  const minutes = DAY_START_MIN + Math.floor(elapsedMs / 6000) * 10;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function makeHud(root, { onShop, onJobs, onBatch, onToggleSetting, audio } = {}) {
  const field = (labelKey, id, cls = '') =>
    el(`div.hud-field${cls}`, {}, el('span.hud-label', { 'data-i18n': labelKey }), el('span.hud-value', { id }));

  const bar = el(
    'div.hud-bar',
    {},
    el('div.hud-brand', {}, el('span.hud-logo', { text: 'SV' }), el('span', { 'data-i18n': 'app.title' })),
    field('hud.property', 'hud-property'),
    el(
      'div.hud-clock',
      {},
      el('span.hud-clock-face', { id: 'hud-clock' }),
      el('span.hud-clock-sub', { id: 'hud-elapsed' }),
    ),
    el('div.hud-purse', {}, el('span.hud-coin', { text: '●' }), el('span.hud-money', { id: 'hud-money' })),
    field('hud.station', 'hud-station'),
    field('hud.progress', 'hud-progress'),
    field('hud.marcos', 'hud-marcos'),
    field('hud.instrument', 'hud-instrument'),
    el(
      'div.hud-actions',
      {},
      el('button.btn.hud-btn', { type: 'button', 'data-i18n': 'shop.open', onclick: () => onShop?.() }),
      el('button.btn.hud-btn', { type: 'button', 'data-i18n': 'picker.title', onclick: () => onJobs?.() }),
      soundButton(),
    ),
  );

  /**
   * Mute. `audio.setMuted` has persisted under its own key since it was
   * written, with nothing to call it — which in a shared classroom means the
   * game simply cannot be silenced.
   */
  function soundButton() {
    const btn = el('button.btn.hud-btn.hud-sound', {
      type: 'button',
      'aria-label': t('hud.sound'),
      title: t('hud.sound'),
      onclick: () => {
        audio?.setMuted(!audio.muted);
        paint();
      },
    });
    const paint = () => {
      const on = audio ? !audio.muted : true;
      btn.textContent = on ? '♪' : '×';
      btn.classList.toggle('is-off', !on);
      btn.setAttribute('aria-pressed', String(!on));
    };
    paint();
    return btn;
  }

  /**
   * Batch measuring, shown only while a station is set up and the VISADA tool
   * is live. It sits over the map rather than in the top bar because it acts on
   * what is in front of the player, not on the campaign.
   */
  const batchBtn = el('button.btn.btn-primary.batch-btn', {
    type: 'button',
    'data-i18n': 'sight.measureAll',
    onclick: () => onBatch?.(),
  });
  /**
   * Two survey-practice switches, beside the action they affect.
   *
   * Two-face is per-sight and optional on purpose: a rushed single-face survey
   * stays possible, and is measurably worse, because collimation error is
   * systematic and never averages out. Making it visible is the teaching.
   */
  const toggle = (key, labelKey, titleKey) => {
    const btn = el('button.btn.chip-toggle', {
      type: 'button',
      'data-setting': key,
      title: t(titleKey),
      onclick: () => onToggleSetting?.(key),
    });
    btn.textContent = t(labelKey);
    return btn;
  };

  const twoFaceBtn = toggle('twoFace', 'settings.twoFace', 'settings.twoFaceHelp');
  const gonBtn = toggle('angleFormat', 'settings.gon', 'settings.gonHelp');

  const batchBar = el('div.field-actions', { hidden: true }, twoFaceBtn, batchBtn, gonBtn);
  root.append(batchBar);

  const checklist = el('aside.checklist', {}, el('h3', { 'data-i18n': 'tutorial.title' }), el('ol.checklist-items'));

  root.append(bar, checklist);

  const byId = (id) => bar.querySelector(`#${id}`);

  return {
    update(view) {
      const { parcel, service, station, progress, inventory, difficulty, money = 0 } = view;

      byId('hud-property').textContent = parcel ? `${parcel.propertyName} — ${parcel.owner}` : t('common.none');
      byId('hud-clock').textContent = clockFor(service?.elapsedMs ?? 0);
      byId('hud-elapsed').textContent = service ? fmtDuration(service.elapsedMs) : '0:00';
      byId('hud-money').textContent = num(money, 0);
      byId('hud-station').textContent = station
        ? station.mode === 'free'
          ? t('caderneta.freeStation')
          : t('caderneta.over', { id: station.overId })
        : t('hud.noStation');
      byId('hud-progress').textContent = progress ? `${progress.done}/${progress.total}` : '—';
      byId('hud-marcos').textContent = String(inventory?.marcos ?? 0);
      byId('hud-instrument').textContent = specOf(getInstrument(inventory?.instrument));

      // Only difícil runs a clock the player can lose to.
      bar.classList.toggle('is-timed', Boolean(difficulty?.timeLimit));
    },

    /**
     * The clock alone, called from the loop.
     *
     * `update()` runs on state changes, which is the wrong cadence for a
     * running clock — it would sit still and then jump whenever something else
     * happened. This touches two text nodes and a class, and nothing else.
     *
     * @param {object} [clock] from `service.clock()`; on a timed job the
     *        subtitle counts DOWN and the widget changes colour, because time
     *        remaining is the number that matters and elapsed time is not.
     */
    tick(elapsedMs, clock = null) {
      const face = clockFor(elapsedMs);
      const node = byId('hud-clock');
      if (node && node.textContent !== face) node.textContent = face;

      const sub = byId('hud-elapsed');
      const text = clock?.timed
        ? clock.remainingMs >= 0
          ? `− ${fmtDuration(clock.remainingMs)}`
          : `+ ${fmtDuration(clock.overtimeMs)}`
        : fmtDuration(elapsedMs);
      if (sub && sub.textContent !== text) sub.textContent = text;

      const widget = bar.querySelector('.hud-clock');
      if (widget) {
        const level = clock?.timed ? clock.level : 'ok';
        if (widget.dataset.level !== level) widget.dataset.level = level;
      }
    },

    /**
     * Show or hide the batch-measure button.
     *
     * Locked (rather than hidden) once a station is up but the manual-sight
     * quota is unmet, so the player can see the reward for doing it by hand.
     * Hidden outright when the difficulty has no batch measuring at all: that
     * lock can never open, and showing it would only promise something that is
     * never coming. The two toggles beside it stay either way — they are survey
     * practice, not a convenience.
     */
    setBatch({ visible = false, batch = true, unlocked = false, twoFace = false, gon = false } = {}) {
      batchBar.hidden = !visible;
      batchBtn.hidden = !batch;
      batchBtn.disabled = !unlocked;
      batchBtn.title = unlocked ? t('sight.measureAll') : t('sight.measureAllLocked');
      batchBtn.textContent = t('sight.measureAll');

      twoFaceBtn.classList.toggle('is-on', twoFace);
      twoFaceBtn.textContent = t('settings.twoFace');
      twoFaceBtn.setAttribute('aria-pressed', String(twoFace));

      gonBtn.classList.toggle('is-on', gon);
      gonBtn.textContent = t(gon ? 'settings.gon' : 'settings.dms');
      gonBtn.setAttribute('aria-pressed', String(gon));
    },

    setChecklist(items) {
      const list = clear(checklist.querySelector('.checklist-items'));
      for (const item of items) {
        list.append(
          el(
            `li.checklist-item${item.done ? '.is-done' : ''}${item.active ? '.is-active' : ''}`,
            {},
            el('span.check-mark', { text: item.done ? '✓' : item.active ? '▸' : '·' }),
            el('span', { text: t(item.key) }),
          ),
        );
      }
    },

    setArea(area) {
      // Shown once the ring closes, as a running total the player can sanity-check.
      let node = bar.querySelector('#hud-area');
      if (!area) {
        node?.parentElement?.remove();
        return;
      }
      if (!node) {
        const f = el('div.hud-field', {}, el('span.hud-label', { 'data-i18n': 'hud.area' }), el('span.hud-value', { id: 'hud-area' }));
        bar.append(f);
        node = f.querySelector('#hud-area');
        f.querySelector('.hud-label').textContent = t('hud.area');
      }
      node.textContent = `${num(area.m2, 2)} m² (${num(area.hectares, 4)} ha)`;
    },

    toggleChecklist(on) {
      checklist.hidden = !on;
    },
  };
}
