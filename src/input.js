// Every device becomes one tilt ∈ [0, 1] (spec §4.1). The pure model is Node-safe; bindInput touches the DOM.
import { T } from './tuning.js';

const clamp01 = v => Math.min(1, Math.max(0, v));

export function gamepadValue(l2, r2) {
  const v = Math.max(l2 || 0, r2 || 0);
  return v <= T.PAD_DEADZONE ? 0 : clamp01((v - T.PAD_DEADZONE) / (1 - T.PAD_DEADZONE));
}

export function pointerValue(dragCssPx) {
  return clamp01(dragCssPx / T.DRAG_PX);
}

export function createTilt() {
  return { tilt: 0, source: 'keyboard' };
}

export function updateTilt(model, dt, raw) {
  model.source = raw.source;
  if (raw.source === 'pointer') model.tilt = raw.pointer == null ? 0 : clamp01(raw.pointer);
  else if (raw.source === 'gamepad') model.tilt = raw.gamepad == null ? 0 : clamp01(raw.gamepad);
  else {
    const up = raw.shift ? T.FINE_UP : T.KEY_UP, down = raw.shift ? T.FINE_DOWN : T.KEY_DOWN;
    model.tilt = clamp01(model.tilt + (raw.space ? up : -down) * dt);
  }
  return model.tilt;
}

export function bindInput(target) {
  const raw = { space: false, shift: false, pointer: null, gamepad: null, source: 'keyboard', pressedEdge: false };
  const model = createTilt();
  let edge = false, dragStart = 0, padWasDown = false;
  const releaseAll = () => { raw.space = raw.shift = false; raw.pointer = null; };

  addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && !raw.space) edge = true;
      raw.space = true; raw.source = 'keyboard';
    } else if (e.key === 'Shift') { raw.shift = true; raw.source = 'keyboard'; }
  });
  addEventListener('keyup', e => {
    if (e.code === 'Space') raw.space = false;
    else if (e.key === 'Shift') raw.shift = false;
  });
  target.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    target.setPointerCapture?.(e.pointerId);
    dragStart = e.clientY; raw.pointer = 0; raw.source = 'pointer'; edge = true;
  });
  target.addEventListener('pointermove', e => { if (raw.pointer != null) raw.pointer = pointerValue(e.clientY - dragStart); });
  const end = () => { raw.pointer = null; };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  addEventListener('gamepaddisconnected', () => { raw.gamepad = null; });

  return {
    raw,
    read(dt) {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      if (pads.length) {
        const v = Math.max(...pads.map(p => gamepadValue(p.buttons[6]?.value, p.buttons[7]?.value)));
        const down = v > 0 || pads.some(p => p.buttons.some(b => b.pressed));
        if (down && !padWasDown) { edge = true; raw.source = 'gamepad'; }
        else if (v > 0) raw.source = 'gamepad';
        padWasDown = down;
        raw.gamepad = v;
      } else raw.gamepad = null;
      raw.pressedEdge = edge; edge = false;
      return updateTilt(model, dt, raw);
    },
    releaseAll,
  };
}
