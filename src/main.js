// Boot and frame loop: input → sim → (scene, ui, audio).
import { createRun, step } from './sim.js';
import { bindInput } from './input.js';
import { bakeScene, drawScene, sceneEvents, resetScene, headScreen } from './scene.js';
import { createAudio } from './audio.js';
import { createUi, canRestart } from './ui.js';
import { createStore } from './store.js';
import { T } from './tuning.js';

const canvas = document.getElementById('c');
const store = createStore();
const input = bindInput(canvas);
const audio = createAudio({ musicUrl: 'audio/musica.mp3', truckUrl: 'audio/camion.mp3', store });
let state = createRun({ seed: Date.now() >>> 0 });
let started = false, overFor = 0, last = performance.now();

const ui = createUi({ store, audio, canvas, headScreen, onRestart: () => restart() });
ui.intro();

function dispatch(events) {
  if (!events.length) return;
  sceneEvents(events, state);
  ui.handle(events, state);
  audio.handle(events, state);
}

function restart() {
  if (state.phase !== 'over' || overFor < T.RESTART_GUARD) return;
  state = createRun({ seed: Date.now() >>> 0, skipTutorial: true });
  overFor = 0;
  resetScene();
  ui.reset();
  dispatch([{ type: 'turn', seat: state.turn.seat, trap: false }]);
  canvas.focus({ preventScroll: true });
}

document.getElementById('rules').addEventListener('close', () => canvas.focus({ preventScroll: true }));
document.getElementById('rules-open').addEventListener('click', () => input.releaseAll());

const mate = window.__mate = {
  get state() { return state; },
  drawn: 0,
  step(dt, tilt) { const r = step(state, dt, tilt); dispatch(r.events); drawScene(state, state.time); mate.drawn++; return r.events; },
  feed(events) { dispatch(events); },
  reset(seed, opts = {}) { state = createRun({ seed, ...opts }); resetScene(); ui.reset(); drawScene(state, 0); },
  ui,
};

addEventListener('resize', fit);
fit();
bakeScene();
canvas.focus({ preventScroll: true });

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  const tilt = input.read(dt);
  const edge = input.raw.pressedEdge;
  if (!started && edge) {
    started = true;
    audio.start();
  }
  if (started && state.phase !== 'over') dispatch(step(state, dt, tilt).events);
  else if (state.phase === 'over') {
    overFor += dt;
    if (canRestart(overFor, edge)) restart();
  }
  audio.update(state, dt);
  ui.frame(state, dt);
  drawScene(state, now / 1000);
  mate.drawn++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
