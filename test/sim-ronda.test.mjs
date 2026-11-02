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
  for (const mark of [.79, .81, 3.79, 3.81, 4.59, 4.61]) { while (t < mark - 1e-9) { step(s, .01, 0); t += .01; } at.push(s.phase); }
  assert.deepEqual(at, ['out', 'drink', 'drink', 'back', 'back', 'pour']);
});
test('one tease per turn at 90 %, then grab', () => {
  const s = afterTutorial(); s.turn.speaks = true;
  near(firstAt(s, 'tease'), 5.58);
  const ev = until(s, 0, (st, e) => e.some(x => x.type === 'handoff')), h = find(ev, 'handoff');
  assert.ok(!types(ev).includes('tease'));
  assert.deepEqual([h.grabbed, h.good, h.value], [true, false, 0]);
  near(s.turn.waited, 6.2);
});
test('grab happens exactly at the patience window', () => {
  const s = afterTutorial(); const start = s.time;
  until(s, 0, (st, ev) => ev.some(e => e.type === 'handoff'));
  near(s.time - start, 6.2);
});
test('patience shrinks to 5 s by mate 40', () => {
  const s = afterTutorial(); s.served = 40; const start = s.time;
  until(s, 0, (st, ev) => ev.some(e => e.type === 'handoff'));
  near(s.time - start, 5.0);
});
test('grab with a full mate still counts', () => {
  const s = afterTutorial();
  const h = find(until(s, .45, (st, ev) => ev.some(e => e.type === 'handoff')), 'handoff');
  assert.deepEqual([h.grabbed, h.good, h.value], [true, true, 1]);
});
test('the first three arrivals come every 5 mates, in ARRIVE_ORDER', () => {
  const s = afterTutorial(); const at = [];
  while (s.served < 15) {
    until(s, st => (st.phase === 'pour' && !st.turn.trap && st.turn.fill < .9 ? .5 : 0), (st, ev) => {
      for (const e of ev) if (e.type === 'arrive') at.push([e.seat, st.served]);
      return ev.some(e => e.type === 'turn');
    });
    s.yerba = 1;
  }
  assert.deepEqual(at, [[3, 5], [1, 10], [5, 15]]);
});
test('later arrivals only fill chairs a gracias friend left', () => {
  const s = afterTutorial(); const ev = [];
  while (s.served < 40 && s.phase !== 'over') { ev.push(...serve(s)); s.yerba = 1; }
  const later = ev.filter(e => e.type === 'arrive').slice(3), left = ev.filter(e => e.type === 'leave');
  assert.ok(later.length <= left.length);
  for (const a of later) assert.ok(left.some(l => l.seat === a.seat));
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
  assert.equal(find(ev, 'gameOver').reason, 'gastada'); assert.ok(!types(ev).includes('arrive'));
});
test('a slightly brave early pour beats the tease', () => {
  const s = afterTutorial(); let start = 0;
  const ev = until(s, st => (st.phaseTime > .4 && st.turn.fill < .86 ? .6 : 0), (st, e) => e.some(x => x.type === 'handoff'));
  assert.ok(!types(ev).includes('tease')); assert.equal(find(ev, 'handoff').good, true);
});
test('contextual tips: aim on a washing pour, foam on a short grab, washing at 60 %', () => {
  const s = afterTutorial();
  const a = until(s, st => (st.phase === 'pour' && st.turn.fill < .5 ? 1 : 0), (st, e) => e.some(x => x.type === 'handoff'));
  const names = a.filter(e => e.type === 'tip').map(e => e.name);
  assert.ok(names.includes('aim')); assert.ok(names.includes('foam'));
  assert.equal(s.stats.shortGrabs, 1); assert.ok(s.stats.washTop > .02);
  until(s, 0, (st, e) => e.some(x => x.type === 'turn'));
  s.yerba = .61;
  const b = until(s, 1, (st, e) => e.some(x => x.type === 'tip'));
  assert.deepEqual(b.filter(e => e.type === 'tip').map(e => e.name), ['washing']);
});
test('each contextual tip fires once per run', () => {
  const s = afterTutorial(); const names = [];
  for (let i = 0; i < 4; i++) names.push(...until(s, st => (st.phase === 'pour' && st.turn.fill < .4 ? 1 : 0), (st, e) => e.some(x => x.type === 'turn')).filter(e => e.type === 'tip').map(e => e.name));
  assert.equal(names.filter(n => n === 'aim').length, 1);
  assert.equal(names.filter(n => n === 'foam').length, 1);
});
test('three dry mates in a row end the ronda', () => {
  const s = afterTutorial(); const ev = [];
  for (let i = 0; i < 3 && s.phase !== 'over'; i++) ev.push(...until(s, 0, (st, e) => e.some(x => x.type === 'turn') || st.phase === 'over'));
  assert.equal(find(ev, 'gameOver').reason, 'seco');
  assert.ok(ev.some(e => e.type === 'tip' && e.name === 'seco'));
});
test('a good mate resets the dry streak', () => {
  const s = afterTutorial();
  for (let i = 0; i < 2; i++) until(s, 0, (st, e) => e.some(x => x.type === 'turn'));
  assert.equal(s.secos, 2);
  serve(s, .9, .55); assert.equal(s.secos, 0);
});
test('teases come on about half the turns, at random', () => {
  let said = 0, turns = 0;
  for (let seed = 0; seed < 200; seed++) {
    const s = afterTutorial(seed); turns++;
    if (until(s, 0, (st, e) => e.some(x => x.type === 'handoff')).some(e => e.type === 'tease')) said++;
  }
  near(said / turns, .5, .1);
});
test('a silent turn still ends the quick bonus at 90 %', () => {
  const s = afterTutorial(); s.turn.speaks = false;
  const ev = pourFor(s, 5.7, 0);
  assert.ok(!ev.some(e => e.type === 'tease'));
  assert.equal(s.turn.teases, 1); // the hand-off reads this as "teased": no quick bonus
});
