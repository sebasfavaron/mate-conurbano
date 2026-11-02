// Boot and frame loop: input → sim → scene.
import { createRun, step } from './sim.js';
import { bindInput } from './input.js';
import { bakeScene, drawScene } from './scene.js';

const canvas = document.getElementById('c');
const input = bindInput(canvas);
let state = createRun({ seed: Date.now() >>> 0 });
let started = false, last = performance.now();

const mate = window.__mate = {
  get state() { return state; },
  drawn: 0,
  step(dt, tilt) { const r = step(state, dt, tilt); drawScene(state, state.time); mate.drawn++; return r.events; },
};

addEventListener('resize', fit);
fit();
bakeScene();

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  const tilt = input.read(dt);
  if (!started && input.raw.pressedEdge) started = true;
  if (started) step(state, dt, tilt);
  drawScene(state, now / 1000);
  mate.drawn++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
