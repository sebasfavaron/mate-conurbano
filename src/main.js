// Boot and frame loop: input → sim → (scene, ui, audio).
import { createRun, step } from './sim.js';
import { bindInput } from './input.js';
import { bakeScene, drawScene, sceneEvents, resetScene, headScreen, rigAnchor } from './scene.js';
import { createAudio } from './audio.js';
import { createUi, canRestart } from './ui.js';
import { createStore } from './store.js';
import { T } from './tuning.js';
import { createAmbience } from './ambience.js';

const canvas = document.getElementById('c');
const store = createStore();
const input = bindInput(canvas);
const audio = createAudio({ truckUrl: 'audio/camion.mp3', store, onTrack: (track, phase) => ui.nowPlaying(track, phase) });
let state = createRun({ seed: Date.now() >>> 0 });
let started = false, paused = false, overFor = 0, last = performance.now();
let lessonFor = 0, swallow = false, lessonClicked = false;
const ambience = createAmbience();
let ambientEvents = [];

const ui = createUi({ store, audio, canvas, headScreen, rigAnchor, onRestart: () => restart() });
ui.intro();

function dispatch(events) {
  if (!events.length) return;
  ambientEvents.push(...events);
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

// pause: the button, P or Escape; also when the rules open or the tab is hidden
const pauseButton = document.getElementById('pause'), pausedNote = document.getElementById('paused');
function setPaused(on) {
  if (on === paused || (on && (!started || state.phase === 'over'))) return;
  paused = on;
  input.releaseAll();
  if (on) audio.pause(); else audio.resume();
  pausedNote.hidden = !on;
  pauseButton.textContent = on ? 'seguir' : 'pausa';
  pauseButton.setAttribute('aria-pressed', String(on));
  if (!on) canvas.focus({ preventScroll: true });
}
pauseButton.addEventListener('click', () => setPaused(!paused));
addEventListener('keydown', e => {
  if (e.code === 'KeyP' || (e.code === 'Escape' && paused)) { e.preventDefault(); setPaused(!paused); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
document.getElementById('rules').addEventListener('close', () => setPaused(false));
document.getElementById('rules-open').addEventListener('click', () => setPaused(true));

// a lesson card holds the game; any fresh press (after a short guard) or a click dismisses it,
// and the press that dismissed it never pours: input is ignored until everything is let go
document.getElementById('lesson').addEventListener('pointerdown', e => { e.preventDefault(); lessonClicked = true; });
function lessonFrame(dt, edge) {
  lessonFor += dt;
  if (!((edge || lessonClicked) && lessonFor > .5)) return true;
  const was = ui.lesson;
  ui.hideLesson();
  lessonClicked = false;
  input.reset();
  swallow = true;
  if (was === 'start' && !started) { started = true; audio.start(); }
  return false;
}

const mate = window.__mate = {
  get state() { return state; },
  drawn: 0,
  step(dt, tilt) { const r = step(state, dt, tilt); dispatch(r.events); ambience.update(state, dt, ambientEvents); ambientEvents = []; drawScene(state, state.time, ambience); mate.drawn++; return r.events; },
  ambience,
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
  if (paused) { drawScene(state, now / 1000, ambience); mate.drawn++; requestAnimationFrame(frame); return; }
  if (!ui.lesson && ui.lessonPending && state.phase !== 'over') { ui.showLesson(); lessonFor = 0; lessonClicked = false; input.reset(); }
  if (ui.lesson && lessonFrame(dt, edge)) {
    audio.update({ ...state, flow: 0 }, dt);
    drawScene(state, now / 1000, ambience);
    mate.drawn++;
    requestAnimationFrame(frame);
    return;
  }
  if (swallow) { if (input.idle) { swallow = false; input.reset(); } }
  const tiltIn = swallow ? 0 : tilt;
  if (!started && edge && !swallow) {
    started = true;
    audio.start();
  }
  if (started && state.phase !== 'over') dispatch(step(state, dt, tiltIn).events);
  else if (state.phase === 'over') {
    overFor += dt;
    if (canRestart(overFor, edge)) restart();
  }
  for (const cue of ambience.update(state, dt, ambientEvents)) {
    if (cue.type === 'bark') audio.bark(project(cue.x, cue.y, 0).sx / 180 - 1, cue.delay);
    else if (cue.type === 'bird') audio.bird(cue.pan);
  }
  ambientEvents = [];
  audio.update(state, dt);
  ui.frame(state, dt);
  drawScene(state, now / 1000, ambience);
  mate.drawn++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
