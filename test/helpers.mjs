// Shared drivers for the sim tests.
import { step } from '../src/sim.js';

export function pourFor(s, secs, tilt, dt = .01) {
  const events = [];
  for (let t = 0; t < secs - 1e-9; t += dt) events.push(...step(s, dt, tilt).events);
  return events;
}

export function until(s, tilt, done, max = 60, dt = .01) {
  const events = [];
  for (let t = 0; t < max; t += dt) {
    const ev = step(s, dt, typeof tilt === 'function' ? tilt(s) : tilt).events;
    events.push(...ev);
    if (done(s, ev)) break;
  }
  return events;
}

// Plays one turn as a careful player: pour gently to `fill`, release, or let a trap turn pass.
export function serve(s, fill = .9, tilt = .5) {
  return until(s, st => (st.phase === 'pour' && !st.turn.trap && st.turn.armed !== false && st.turn.fill < fill ? tilt : 0),
    (st, ev) => ev.some(e => e.type === 'turn') || st.phase === 'over');
}

export const types = events => events.map(e => e.type);
export const find = (events, type) => events.find(e => e.type === type);
