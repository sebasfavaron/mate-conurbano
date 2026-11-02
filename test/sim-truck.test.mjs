import test from 'node:test'; import assert from 'node:assert/strict';
import { createRun, step } from '../src/sim.js';
import { T } from '../src/tuning.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
// Auto-serving bot: pours gently to .9, lets trap turns pass, keeps the yerba topped up.
const bot = s => (s.phase === 'pour' && !s.turn.trap && s.turn.fill < .9 ? .5 : 0);
function play(seed, secs, dt = .05) {
  const s = createRun({ seed, skipTutorial: true }); const log = [];
  while (s.rondaTime < secs && s.phase !== 'over') {
    s.yerba = 1;
    for (const e of step(s, dt, bot(s)).events) log.push({ ...e, at: s.rondaTime, progress: s.truck.progress });
  }
  return { s, log };
}

test('first pass between 60 and 150 s of ronda, then every 90–150 s', () => {
  for (let seed = 0; seed < 100; seed++) {
    const enters = play(seed, 600).log.filter(e => e.type === 'truckEnter');
    assert.ok(enters[0].at >= 60 && enters[0].at <= 150.1, `first at ${enters[0].at}`);
    for (let i = 1; i < enters.length; i++) {
      const gap = enters[i].at - enters[i - 1].at;
      assert.ok(gap >= 89.9, `gap ${gap}`);
      if (!enters[i - 1].guest) assert.ok(gap <= 150.1, `gap ${gap}`); // a guest stop can hold the next pass back
    }
  }
});
test('a pass lasts 30.3 s', () => {
  const { log } = play(4, 600, .01);
  let checked = 0;
  for (let i = 0; i < log.length; i++) {
    if (log[i].type !== 'truckEnter' || log[i].guest) continue;
    const leave = log.slice(i).find(e => e.type === 'truckLeave');
    near(leave.at - log[i].at, 30.3, .05); checked++;
  }
  assert.ok(checked > 0);
});
test('guest at most once, never before 180 s', () => {
  let runs = 0;
  for (let seed = 0; seed < 200; seed++) {
    const arrivals = play(seed, 900).log.filter(e => e.type === 'guestArrive');
    assert.ok(arrivals.length <= 1);
    if (arrivals.length) { runs++; assert.ok(arrivals[0].at >= 180); }
  }
  near(runs / 200, .25, .08);
});
function guestRun() {
  for (let seed = 0; seed < 100; seed++) { const s = createRun({ seed, skipTutorial: true }); if (s.guest.planned) return seed; }
}
test('guest telegraph precedes the stop by 3 s and stops at .5', () => {
  const { s, log } = play(guestRun(), 600, .01);
  const sig = log.find(e => e.type === 'guestSignal'), stop = log.find(e => e.type === 'truckStop');
  near(stop.at - sig.at, 3.0, .03); assert.equal(stop.progress, .5);
  const arrive = log.findIndex(e => e.type === 'guestArrive'), leave = log.findIndex(e => e.type === 'guestLeave');
  assert.ok(log.slice(arrive, leave).every(e => e.progress === .5));
});
test('guest mate counts 2 and he leaves', () => {
  const { s, log } = play(guestRun(), 600, .01);
  const h = log.find(e => e.type === 'handoff' && e.seat === 6);
  assert.equal(h.value, 2);
  const i = log.findIndex(e => e.type === 'gracias' && e.seat === 6);
  assert.ok(i > log.indexOf(h));
  assert.equal(log[i + 1].type, 'guestLeave');
  assert.ok(log.slice(i).some(e => e.type === 'truckLeave'));
  assert.equal(s.seats[6], null); assert.equal(s.guest.done, true);
});
test('guest patience is 8 s', () => {
  const seed = guestRun(); const s = createRun({ seed, skipTutorial: true });
  let start = null;
  while (s.phase !== 'over' && s.rondaTime < 600) {
    s.yerba = 1;
    const guestTurn = s.phase === 'pour' && s.turn.seat === 6;
    const ev = step(s, .01, guestTurn ? 0 : bot(s)).events;
    if (ev.some(e => e.type === 'turn' && e.seat === 6)) start = s.time;
    const h = ev.find(e => e.type === 'handoff' && e.seat === 6);
    if (h) { assert.equal(h.grabbed, true); near(s.time - start, 8, .02); return; }
  }
  assert.fail('guest never had a turn');
});
test('the driver never says a lavado line', () => {
  const { log } = (() => {
    const s = createRun({ seed: guestRun(), skipTutorial: true }); const log = [];
    while (s.rondaTime < 600 && s.phase !== 'over' && !s.guest.done) {
      s.yerba = .25;
      for (const e of step(s, .05, bot(s)).events) log.push(e);
    }
    return { log };
  })();
  assert.ok(log.some(e => e.type === 'guestLeave'));
  assert.ok(!log.some(e => e.type === 'lavado' && e.seat === 6));
});
