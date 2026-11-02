import test from 'node:test'; import assert from 'node:assert/strict';
import { createTilt, updateTilt, gamepadValue, pointerValue } from '../src/input.js';
const kb = (o) => ({ space: false, shift: false, pointer: null, gamepad: null, source: 'keyboard', ...o });
const run = (m, secs, raw) => { for (let t = 0; t < secs - 1e-9; t += .01) updateTilt(m, .01, raw); return m.tilt; };
test('space reaches full tilt in ~1 s', () => { const m = createTilt(); assert.ok(Math.abs(run(m, .5, kb({ space: true })) - .5) < .02); assert.equal(run(m, 1, kb({ space: true })), 1); });
test('release springs back at 2.5/s', () => { const m = createTilt(); m.tilt = 1; assert.ok(Math.abs(run(m, .2, kb()) - .5) < .02); });
test('shift switches to fine rates mid-hold, both ways', () => {
  const m = createTilt(); run(m, .4, kb({ space: true }));
  assert.ok(Math.abs(run(m, 1, kb({ space: true, shift: true })) - .75) < .02);
  assert.ok(Math.abs(run(m, .5, kb({ shift: true })) - .45) < .02);
});
test('gamepad dead zone and max of triggers', () => { assert.equal(gamepadValue(.04, 0), 0); assert.ok(Math.abs(gamepadValue(.2, .525) - .5) < 1e-9); });
test('pointer maps 120 px to full tilt', () => { assert.equal(pointerValue(60), .5); assert.equal(pointerValue(500), 1); assert.equal(pointerValue(-20), 0); });
test('unplugged gamepad falls to 0', () => { const m = createTilt(); updateTilt(m, .01, kb({ source: 'gamepad', gamepad: .9 })); assert.equal(updateTilt(m, .01, kb({ source: 'gamepad', gamepad: null })), 0); });
test('focus loss (all released) springs the thermos back', () => { const m = createTilt(); run(m, 1, kb({ space: true })); assert.ok(run(m, .5, kb()) < .01); });
test('latest source wins', () => {
  const m = createTilt(); run(m, 1, kb({ space: true }));
  assert.equal(updateTilt(m, .01, kb({ space: true, source: 'pointer', pointer: .25 })), .25);
});
