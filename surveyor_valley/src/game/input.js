// Keyboard, mouse and wheel.
//
// Movement keys are polled (held state), everything else is dispatched on the
// event. WASD and the arrow keys are both bound, and so are the Brazilian
// keyboard's usual suspects, because a student should not have to discover the
// control scheme by trial.

import { TOOL_KEYS } from './tools.js';

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

export function makeInput({ canvas, camera, bus, EV, onClick, onDoubleClick, onToolKey, onBatchKey, onHover, isModalOpen }) {
  const held = new Set();
  let run = false;
  let pointer = { x: 0, y: 0, inside: false };
  let lastWorld = { e: 0, n: 0 };

  const detach = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    detach.push(() => target.removeEventListener(type, fn, opts));
  };

  on(window, 'keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;

    if (MOVE_KEYS[ev.code]) {
      held.add(ev.code);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Shift') {
      run = true;
      return;
    }
    if (isModalOpen?.() && ev.key !== 'Escape') return;

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

  on(canvas, 'pointermove', (ev) => {
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
    if (ev.button !== 0) return;
    canvas.setPointerCapture?.(ev.pointerId);
    const p = toCanvas(ev);
    onClick?.(camera.screenToWorld(p.x, p.y), p, ev);
  });

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
      return { e, n, run };
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
    },
    destroy() {
      detach.forEach((fn) => fn());
      detach.length = 0;
    },
  };
}
