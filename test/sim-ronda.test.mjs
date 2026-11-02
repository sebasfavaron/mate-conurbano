import test from 'node:test'; import assert from 'node:assert/strict';
import { createRun, step } from '../src/sim.js';
import { T } from '../src/tuning.js';
import { pourFor, until, serve, types, find } from './helpers.mjs';

const near = (a, b, tol = .02) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const afterTutorial = (seed = 1) => { const s = createRun({ seed }); serve(s); return s; };
const firstAt = (s, type, max = 10) => { for (let t = 0; t < max; t += .01) { if (step(s, .01, 0).events.some(e => e.type === type)) return s.turn.waited; } return null; };

test('tutorial mate is the cebador\'s', () => {
  const s = createRun({ seed: 1 }); const ev = serve(s);
  const ts = types(ev), i = ts.indexOf('drinkEnd');
  assert.equal(ev[i].seat, 0);
  assert.ok(ts.indexOf('tutorialDone') > i);
  assert.equal(find(ev, 'turn').seat, 2);
  assert.ok(ts.indexOf('turn') > ts.indexOf('tutorialDone'));
  assert.equal(s.score, 0); assert.equal(s.served, 0); assert.equal(s.yerba, 1);
});
test('ronda goes anticlockwise through occupied seats', () => {
  const s = afterTutorial();
  const seats = [s.turn.seat];
  for (let i = 0; i < 2; i++) { serve(s); seats.push(s.turn.seat); }
  assert.deepEqual(seats, [2, 4, 2]);
});
test('good mate scores 1 and wears WEAR_BASE', () => {
  const s = afterTutorial(); const y = s.yerba;
  const h = find(serve(s), 'handoff');
  assert.equal(h.good, true); assert.equal(h.value, 1); assert.equal(s.score, 1); near(y - s.yerba, T.WEAR_BASE, 1e-9);
});
test('phase timings', () => {
  const s = afterTutorial();
  until(s, st => (st.turn.fill < .9 ? .5 : 0), (st, ev) => ev.some(e => e.type === 'handoff'));
  const at = []; let t = 0;
  for (const mark of [.59, .61, 3.59, 3.61, 4.19, 4.21]) { while (t < mark - 1e-9) { step(s, .01, 0); t += .01; } at.push(s.phase); }
  assert.deepEqual(at, ['out', 'drink', 'drink', 'back', 'back', 'pour']);
});
test('one tease per turn at 83 %, then grab', () => {
  const s = afterTutorial();
  near(firstAt(s, 'tease'), 4.98);
  const ev = until(s, 0, (st, e) => e.some(x => x.type === 'handoff')), h = find(ev, 'handoff');
  assert.ok(!types(ev).includes('tease'));
  assert.deepEqual([h.grabbed, h.good, h.value], [true, false, 0]);
  near(s.turn.waited, 6.0);
});
test('grab happens exactly at the patience window', () => {
  const s = afterTutorial(); const start = s.time;
  until(s, 0, (st, ev) => ev.some(e => e.type === 'handoff'));
  near(s.time - start, 6.0);
});
test('patience shrinks to 4 s by mate 30', () => {
  const s = afterTutorial(); s.served = 30; const start = s.time;
  until(s, 0, (st, ev) => ev.some(e => e.type === 'handoff'));
  near(s.time - start, 4.0);
});
test('grab with a full mate still counts', () => {
  const s = afterTutorial();
  const h = find(until(s, .45, (st, ev) => ev.some(e => e.type === 'handoff')), 'handoff');
  assert.deepEqual([h.grabbed, h.good, h.value], [true, true, 1]);
});
test('arrival every 5 mates, in ARRIVE_ORDER, max 3 arrivals', () => {
  const s = afterTutorial(); const arrivals = [];
  while (s.served < 20 && s.phase !== 'over') {
    for (const e of serve(s)) if (e.type === 'arrive') arrivals.push([e.seat, s.served]);
    s.yerba = 1;
  }
  assert.deepEqual(arrivals.map(a => a[0]), [3, 1, 5]);
  assert.ok(arrivals.every(([, n], i) => n >= (i + 1) * 5));
  assert.equal(s.served, 20);
});
test('arrivals happen at served 5, 10, 15', () => {
  const s = afterTutorial(); const at = [];
  while (s.served < 20) {
    until(s, st => (st.phase === 'pour' && !st.turn.trap && st.turn.fill < .9 ? .5 : 0), (st, ev) => {
      for (const e of ev) if (e.type === 'arrive') at.push(st.served);
      return ev.some(e => e.type === 'turn');
    });
    s.yerba = 1;
  }
  assert.deepEqual(at, [5, 10, 15]);
});
test('re-arm: holding through hand-off does not pour', () => {
  const s = afterTutorial();
  until(s, st => (st.turn.fill < .9 ? .5 : 0), (st, ev) => ev.some(e => e.type === 'handoff'));
  until(s, .5, (st, ev) => ev.some(e => e.type === 'turn'));
  assert.equal(s.turn.armed, false);
  pourFor(s, .5, .5); assert.equal(s.turn.fill, 0);
  pourFor(s, .05, 0); pourFor(s, .3, .5); assert.ok(s.turn.fill > 0);
});
test('lavado line throttled to every 20 s', () => {
  const s = afterTutorial(); const at = [];
  for (let i = 0; i < 12; i++) {
    s.yerba = .25;
    for (const e of serve(s)) if (e.type === 'lavado') at.push(s.rondaTime);
  }
  assert.ok(at.length >= 2);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 20);
});
test('shift tip once', () => {
  const s = afterTutorial();
  const a = pourFor(s, 1.6, 1).concat(pourFor(s, .05, 0)); // 1.6 s at full tilt washes ≈ .088
  assert.equal(a.filter(e => e.type === 'tip').length, 1);
  const b = until(s, st => (st.phase === 'pour' && st.turn.fill < .5 ? 1 : 0), (st, ev) => ev.some(e => e.type === 'turn'));
  assert.equal(b.filter(e => e.type === 'tip').length, 0);
});
test('skipTutorial starts at the first friend turn unarmed', () => {
  const s = createRun({ seed: 1, skipTutorial: true });
  assert.equal(s.tutorial, false); assert.equal(s.turn.seat, 2); assert.equal(s.turn.armed, false); assert.equal(s.phase, 'pour');
});
test('one big dt across two grabs equals many small steps (Review Focus 1)', () => {
  const a = afterTutorial(), b = afterTutorial();
  const ea = step(a, 20, 0).events, eb = [];
  for (let i = 0; i < 2000; i++) eb.push(...step(b, .01, 0).events);
  assert.deepEqual(types(ea), types(eb));
  assert.ok(types(ea).filter(t => t === 'handoff').length >= 2);
});
test('the hand-off that washes the last yerba announces no arrival', () => {
  const s = afterTutorial(); s.served = 4; s.yerba = .015;
  const ev = serve(s);
  assert.equal(find(ev, 'gameOver').reason, 'lavado'); assert.ok(!types(ev).includes('arrive'));
});
test('a slightly brave early pour beats the tease', () => {
  const s = afterTutorial(); let start = 0;
  const ev = until(s, st => (st.phaseTime > .4 && st.turn.fill < .86 ? .6 : 0), (st, e) => e.some(x => x.type === 'handoff'));
  assert.ok(!types(ev).includes('tease')); assert.equal(find(ev, 'handoff').good, true);
});
