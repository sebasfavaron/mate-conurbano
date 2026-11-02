import test from 'node:test'; import assert from 'node:assert/strict';
import { createRun, step } from '../src/sim.js';
import { T } from '../src/tuning.js';
import { makeRng } from '../src/rng.js';
import { pourFor, serve, types, find } from './helpers.mjs';

const near = (a, b, tol = .02) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const ronda = (seed = 1, friends = [2, 4]) => {
  const s = createRun({ seed, skipTutorial: true });
  s.seats = s.seats.map((x, i) => (i === 0 ? x : null));
  friends.forEach((seat, i) => { s.seats[seat] = { look: i, saidGracias: false, guest: false }; });
  s.turn.armed = true;
  return s;
};
// Puts the state one tick before a friend's `back` phase starts and returns that tick's events.
const forceBack = (s, seat) => {
  s.phase = 'drink'; s.phaseTime = T.DRINK_TIME - .005; s.turn.seat = seat;
  return step(s, .01, 0).events;
};
const trapTurn = (tiltHeld = 0) => {
  const s = ronda(3, [1, 2, 4]); s.seats[2].saidGracias = true;
  s.tilt = tiltHeld; s.lastSeat = 1;
  s.phase = 'back'; s.phaseTime = T.PASS_TIME - .005; s.turn.seat = 1;
  const ev = step(s, .01, tiltHeld).events;
  assert.equal(find(ev, 'turn').trap, true);
  return s;
};

test('no gracias before the 5th mate', () => {
  for (let seed = 0; seed < 50; seed++) {
    const s = ronda(seed, [1, 2, 3, 4]);
    for (let i = 0; i < 4; i++) assert.ok(!types(serve(s)).includes('gracias'));
  }
});
test('never below 2 active friends', () => {
  for (let seed = 0; seed < 20; seed++) {
    const s = ronda(seed);
    for (let i = 0; i < 200; i++) { s.served = 40; assert.ok(!types(forceBack(s, 2)).includes('gracias')); }
  }
  const s = ronda(5, [1, 2, 4]); let said = 0;
  for (let i = 0; i < 300; i++) { s.served = 40; s.seats.forEach((x, j) => { if (j && x) x.saidGracias = false; }); said += types(forceBack(s, 1)).includes('gracias'); }
  assert.ok(said > 0, 'three friends can still produce a gracias');
});
test('probability doubles while the truck passes', () => {
  const rate = truck => {
    const s = ronda(11, [1, 2, 3, 4]); let n = 0;
    for (let i = 0; i < 2000; i++) {
      s.served = 30; s.truck.active = truck; s.truck.progress = .1; s.truck.nextAt = 1e9;
      s.seats[1].saidGracias = false;
      n += types(forceBack(s, 1)).includes('gracias');
    }
    return n / 2000;
  };
  near(rate(false), .20, .04); near(rate(true), .40, .04);
});
test('palm only during the truck', () => {
  const s = ronda(2, [1, 2, 3, 4]); let g;
  for (let i = 0; i < 500 && !g; i++) {
    s.served = 30; s.truck.active = true; s.truck.progress = .1; s.seats[1].saidGracias = false;
    g = find(forceBack(s, 1), 'gracias');
  }
  assert.equal(g.palmOnly, true);
  s.truck.active = false; g = null;
  for (let i = 0; i < 500 && !g; i++) { s.served = 30; s.seats[1].saidGracias = false; g = find(forceBack(s, 1), 'gracias'); }
  assert.equal(g.palmOnly, false);
});
test('trap turn skips after 1.2 s of no water', () => {
  const s = trapTurn(); const served = s.served; let at = null; const ev = [];
  for (let t = .01; t < 3; t += .01) { const e = step(s, .01, 0).events; ev.push(...e); if (!at && e.some(x => x.type === 'skip')) { at = t; assert.equal(find(e, 'turn').seat, 4); } }
  near(at, 1.2); assert.equal(s.served, served); assert.ok(!types(ev).includes('tease'));
  assert.equal(find(ev, 'skip').points, 50); assert.equal(s.points, 50);
});
test('holding the trigger into a trap turn is safe', () => {
  const s = trapTurn(.8); assert.equal(s.turn.armed, false);
  const ev = pourFor(s, 2, .8);
  assert.ok(types(ev).includes('skip')); assert.ok(!types(ev).includes('gameOver'));
});
test('any water on a trap turn is game over', () => {
  const s = trapTurn(); step(s, .01, 0);
  const g = find(step(s, .01, .13).events, 'gameOver');
  assert.equal(g.reason, 'gracias'); assert.equal(g.seat, 2); assert.equal(s.phase, 'over');
});
test('trap check survives a big dt', () => {
  const s = trapTurn(); step(s, .01, 0);
  assert.equal(find(step(s, .5, .9).events, 'gameOver')?.reason, 'gracias');
});
