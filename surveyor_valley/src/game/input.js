// Keyboard, mouse, wheel — and touch.
//
// Movement keys are polled (held state), everything else is dispatched on the
// event. WASD and the arrow keys are both bound, and so are the Brazilian
// keyboard's usual suspects, because a student should not have to discover the
// control scheme by trial.
//
// Touch is here because without it the game is not merely awkward on a tablet,
// it is unplayable: every tool already worked through pointer events and double
// tap already fast-travelled, but movement was WASD only, so you could not
// reach a corner, find a buried mark or walk to the sede. Three gestures have
// no mouse equivalent to inherit — walking, panning and zooming — and they are
// the three added below.
//
// Everything touch contributes joins the SAME `intent()` the keyboard feeds, so
// `game/player.js` does not know any of this exists.

import { TOOL_KEYS } from './tools.js';

/**
 * Past this fraction of full deflection the surveyor runs.
 *
 * `updatePlayer` normalises the intent vector, so a partial push cannot mean a
 * slower walk however hard anyone leans on it — magnitude has to buy something
 * discrete instead, and Shift is what it stands in for.
 */
const RUN_DEFLECTION = 0.7;

/** Movement of a single touch beyond this is a drag, not a tap. */
const TAP_SLOP = 12;
const TAP_MS = 700;

const MOVE_KEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function makeInput({ canvas, root, camera, bus, EV, onClick, onDoubleClick, onToolKey, onBatchKey, onAct, onHover, onTouch, isModalOpen }) {
  const held = new Set();
  let run = false;
  let pointer = { x: 0, y: 0, inside: false };
  let lastWorld = { e: 0, n: 0 };

  const detach = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    detach.push(() => target.removeEventListener(type, fn, opts));
  };

  /**
   * Capture, but never at the cost of the rest of the handler.
   *
   * `setPointerCapture` throws NotFoundError whenever the pointer is no longer
   * active — a finger lifted between the event and the handler, or a synthetic
   * event. It is a convenience here (the overlay covers the play area anyway),
   * and letting it throw took the whole `pointerdown` branch down with it: the
   * second finger never registered, so pinch and two-finger pan silently did
   * nothing.
   */
  const capture = (target, id) => {
    try {
      target.setPointerCapture?.(id);
    } catch {
      /* the pointer is already gone; nothing to capture and nothing to do */
    }
  };

  on(window, 'keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;

    // A modal owns the keyboard. Movement keys must not pile up behind it, or
    // closing the dialog sets the player walking off in whatever direction they
    // were last pressing — and the arrow keys are how you scroll a long table,
    // so they are not even movement input at that point.
    if (isModalOpen?.() && ev.key !== 'Escape') {
      held.clear();
      run = false;
      return;
    }

    if (MOVE_KEYS[ev.code]) {
      held.add(ev.code);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Shift') {
      run = true;
      return;
    }

    /**
     * Space does whatever the active tool does, where you stand. Every action
     * in this game already happens at the player's feet, so this is the same
     * thing a click does — without having to put the cursor anywhere.
     *
     * `preventDefault` twice over: Space scrolls the page, and it also
     * re-activates a focused button. The toolbar and the HUD are real
     * `<button>` elements which keep focus after a click, and the guard at the
     * top of this handler only excludes inputs and textareas — so without the
     * blur below, clicking a tool and then pressing Space would fire the button
     * again AND take the action. That only shows up after a mouse click, never
     * in a keyboard-only run, which is exactly the kind of bug that ships.
     */
    if (ev.key === ' ' || ev.code === 'Space') {
      ev.preventDefault();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
      onAct?.(ev);
      return;
    }

    if (ev.key === 'Escape') {
      onToolKey?.('walk', ev);
      return;
    }
    const tool = TOOL_KEYS[ev.key];
    if (tool) {
      onToolKey?.(tool, ev);
      ev.preventDefault();
      return;
    }
    // Batch measuring. Not in TOOL_KEYS because it is an action, not a mode.
    if (ev.key === 'b' || ev.key === 'B') {
      onBatchKey?.(ev);
      ev.preventDefault();
      return;
    }
    if (ev.key === '+' || ev.key === '=' || ev.key === 'z' || ev.key === 'Z') {
      camera.stepZoom(1);
      bus.emit(EV.CAMERA_ZOOM, camera.zoom);
    }
    if (ev.key === '-' || ev.key === '_' || ev.key === 'x' || ev.key === 'X') {
      camera.stepZoom(-1);
      bus.emit(EV.CAMERA_ZOOM, camera.zoom);
    }
  });

  on(window, 'keyup', (ev) => {
    held.delete(ev.code);
    if (ev.key === 'Shift') run = false;
  });

  // Losing focus mid-stride would otherwise leave the player walking forever.
  on(window, 'blur', () => {
    held.clear();
    run = false;
  });

  const toCanvas = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  // ---------------------------------------------------------------- touch ---
  //
  // Shown for a coarse pointer, and also the first time a real touch arrives:
  // a convertible laptop reports BOTH a fine and a coarse pointer, so the media
  // query alone leaves the stick hidden on exactly the machine that has a
  // touchscreen and a mouse.
  const stick = { e: 0, n: 0, active: false, id: null, cx: 0, cy: 0 };
  let touchSeen = false;

  const stickRoot = root ? makeStick(root) : null;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (stickRoot && coarse) showStick();

  function showStick() {
    if (touchSeen) return;
    touchSeen = true;
    stickRoot?.node.classList.add('is-on');
    // The stick appears mid-session on a hybrid machine, and it lands in the
    // bottom-left corner where the scale bar already is — so whoever is keeping
    // track of what covers the canvas has to be told.
    onTouch?.();
  }

  function setKnob() {
    if (!stickRoot) return;
    stickRoot.knob.style.transform = `translate(${stick.e * 34}px, ${-stick.n * 34}px)`;
  }

  if (stickRoot) {
    on(stickRoot.node, 'pointerdown', (ev) => {
      ev.preventDefault();
      const r = stickRoot.node.getBoundingClientRect();
      stick.active = true;
      stick.id = ev.pointerId;
      stick.cx = r.left + r.width / 2;
      stick.cy = r.top + r.height / 2;
      capture(stickRoot.node, ev.pointerId);
      aimStick(ev);
    });
    on(stickRoot.node, 'pointermove', (ev) => {
      if (!stick.active || ev.pointerId !== stick.id) return;
      aimStick(ev);
    });
    const release = (ev) => {
      if (!stick.active || (ev && ev.pointerId !== stick.id)) return;
      stick.active = false;
      stick.id = null;
      stick.e = 0;
      stick.n = 0;
      setKnob();
    };
    on(stickRoot.node, 'pointerup', release);
    on(stickRoot.node, 'pointercancel', release);
    on(window, 'blur', () => release(null));
  }

  function aimStick(ev) {
    const dx = ev.clientX - stick.cx;
    // Screen Y grows downward; north grows up.
    const dy = stick.cy - ev.clientY;
    const len = Math.hypot(dx, dy);
    const radius = 44;
    const k = len > radius ? radius / len : 1;
    stick.e = (dx * k) / radius;
    stick.n = (dy * k) / radius;
    setKnob();
  }

  /** Live touches on the canvas, for telling a tap from a pan from a pinch. */
  const touches = new Map();
  let gesture = null;

  const centroid = () => {
    let x = 0;
    let y = 0;
    for (const t of touches.values()) {
      x += t.x;
      y += t.y;
    }
    return { x: x / touches.size, y: y / touches.size };
  };
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  on(canvas, 'pointermove', (ev) => {
    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) {
      const t = touches.get(ev.pointerId);
      t.x = ev.clientX;
      t.y = ev.clientY;
      t.moved = Math.max(t.moved, Math.hypot(ev.clientX - t.x0, ev.clientY - t.y0));

      if (touches.size >= 2 && gesture) {
        // Two fingers: drag pans, spreading zooms. Zoom stays on the ladder —
        // the art is pixel-exact only at whole multiples of 16 px/m, so a
        // continuous pinch would undo the rule the whole renderer rests on.
        const c = centroid();
        camera.e = gesture.e - (c.x - gesture.cx) / camera.zoom;
        camera.n = gesture.n + (c.y - gesture.cy) / camera.zoom;
        camera.clampToBounds();

        const now = spread();
        const ratio = now / gesture.spread;
        if (ratio > 1.35 || ratio < 0.74) {
          const p = toCanvas({ clientX: c.x, clientY: c.y });
          camera.zoomAt(p.x, p.y, ratio > 1 ? 1 : -1);
          bus.emit(EV.CAMERA_ZOOM, camera.zoom);
          gesture.spread = now;
          gesture.e = camera.e;
          gesture.n = camera.n;
          gesture.cx = c.x;
          gesture.cy = c.y;
        }
      }
      return;
    }

    const p = toCanvas(ev);
    pointer = { ...p, inside: true };
    lastWorld = camera.screenToWorld(p.x, p.y);
    onHover?.(lastWorld, p);
  });

  on(canvas, 'pointerleave', () => {
    pointer.inside = false;
    onHover?.(null, null);
  });

  on(canvas, 'pointerdown', (ev) => {
    if (ev.pointerType === 'touch') {
      if (!touchSeen) showStick();
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, at: Date.now(), moved: 0 });
      capture(canvas, ev.pointerId);
      if (touches.size === 2) {
        const c = centroid();
        gesture = { cx: c.x, cy: c.y, e: camera.e, n: camera.n, spread: spread() };
      }
      return;
    }
    if (ev.button !== 0) return;
    capture(canvas, ev.pointerId);
    const p = toCanvas(ev);
    onClick?.(camera.screenToWorld(p.x, p.y), p, ev);
  });

  const endTouch = (ev) => {
    if (ev.pointerType !== 'touch') return;
    const t = touches.get(ev.pointerId);
    touches.delete(ev.pointerId);
    if (touches.size < 2) gesture = null;
    if (!t) return;

    // A tap ACTS; a drag was a pan and must not also plant a monument. The mouse
    // still fires on pointerdown, unchanged — waiting for the release would put
    // a lag on every click for the sake of a gesture mice do not make.
    const still = Math.hypot(ev.clientX - t.x0, ev.clientY - t.y0) <= TAP_SLOP && t.moved <= TAP_SLOP;
    if (still && Date.now() - t.at <= TAP_MS && touches.size === 0 && !gesture) {
      const p = toCanvas(ev);
      pointer = { ...p, inside: true };
      lastWorld = camera.screenToWorld(p.x, p.y);
      // There is no hover on a touchscreen, so the tap has to do that job too.
      onHover?.(lastWorld, p);
      onClick?.(lastWorld, p, ev);
    }
  };
  on(canvas, 'pointerup', endTouch);
  on(canvas, 'pointercancel', endTouch);

  on(canvas, 'dblclick', (ev) => {
    const p = toCanvas(ev);
    onDoubleClick?.(camera.screenToWorld(p.x, p.y), p, ev);
  });

  // Zoom is rung-to-rung, not continuous: the art is only pixel-exact at
  // integer multiples of its 16 px/m resolution. Wheel deltas are accumulated
  // so a trackpad's many small events still make one clean step.
  let wheelAcc = 0;
  on(
    canvas,
    'wheel',
    (ev) => {
      ev.preventDefault();
      wheelAcc += ev.deltaY;
      if (Math.abs(wheelAcc) < 40) return;
      const dir = wheelAcc < 0 ? 1 : -1;
      wheelAcc = 0;
      const p = toCanvas(ev);
      camera.zoomAt(p.x, p.y, dir);
      bus.emit(EV.CAMERA_ZOOM, camera.zoom);
    },
    { passive: false },
  );

  // Right-drag pans, for looking around without walking.
  let panning = null;
  on(canvas, 'contextmenu', (ev) => ev.preventDefault());
  on(canvas, 'pointerdown', (ev) => {
    if (ev.button !== 2) return;
    panning = { x: ev.clientX, y: ev.clientY, e: camera.e, n: camera.n };
  });
  on(window, 'pointermove', (ev) => {
    if (!panning) return;
    camera.e = panning.e - (ev.clientX - panning.x) / camera.zoom;
    camera.n = panning.n + (ev.clientY - panning.y) / camera.zoom;
    camera.clampToBounds();
  });
  on(window, 'pointerup', () => {
    panning = null;
  });

  return {
    /** Movement intent for this frame, in world axes. */
    intent() {
      let e = 0;
      let n = 0;
      for (const code of held) {
        const v = MOVE_KEYS[code];
        if (!v) continue;
        e += v[0];
        n += v[1];
      }
      // The stick joins the keyboard rather than replacing it, so a tablet with
      // a keyboard attached behaves like both at once and neither has to win.
      let running = run;
      if (stick.active) {
        e += stick.e;
        n += stick.n;
        if (Math.hypot(stick.e, stick.n) >= RUN_DEFLECTION) running = true;
      }
      return { e, n, run: running };
    },
    /** True once this session has seen touch: the HUD hints change with it. */
    get touch() {
      return touchSeen;
    },
    get pointer() {
      return pointer;
    },
    get worldPointer() {
      return lastWorld;
    },
    clear() {
      held.clear();
      run = false;
      stick.active = false;
      stick.e = 0;
      stick.n = 0;
      setKnob();
      touches.clear();
      gesture = null;
    },
    destroy() {
      detach.forEach((fn) => fn());
      detach.length = 0;
    },
  };
}

/**
 * The thumbstick.
 *
 * A fixed pad rather than one that materialises wherever a thumb lands: the
 * floating kind steals taps from the map, and on this game a tap on the map is
 * how you sight a corner and how you send Ligeirinho somewhere. Bottom-left,
 * because the ≤720 px layout already puts the tool rail bottom-centre.
 */
function makeStick(root) {
  const node = document.createElement('div');
  node.className = 'thumbstick';
  node.setAttribute('aria-hidden', 'true');
  const knob = document.createElement('div');
  knob.className = 'thumbstick-knob';
  node.append(knob);
  root.append(node);
  return { node, knob };
}
