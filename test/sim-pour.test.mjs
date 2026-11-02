import test from 'node:test'; import assert from 'node:assert/strict';
import { createRun, step, pourAt } from '../src/sim.js';
import { T } from '../src/tuning.js';
import { pourFor, until, types, find } from './helpers.mjs';

const near = (a, b, tol = .01) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const fillTo = (s, f, tilt = .5) => until(s, tilt, st => st.turn.fill >= f);

test('no flow below TILT_FLOW_MIN', () => {
  assert.equal(pourAt(.11).flow, 0); assert.equal(pourAt(.12).flow, 0); assert.ok(pourAt(.13).flow > 0);
});
test('full tilt flows FLOW_MAX and lands on the top', () => {
  const p = pourAt(1); assert.equal(p.flow, .55); assert.equal(p.land, 1); assert.equal(p.topFrac, 1);
});
test('gentle tilt lands in the hole', () => { assert.equal(pourAt(.4).topFrac, 0); });
test('fill integrates flow', () => { const s = createRun({ seed: 1 }); pourFor(s, 1, 1); near(s.turn.fill, .55); });
test('hand-off after 0.4 s of stillness at ≥ .85', () => {
  const s = createRun({ seed: 1 }); fillTo(s, .9);
  assert.ok(!types(pourFor(s, .39, 0)).includes('handoff')); assert.equal(s.phase, 'pour');
  const h = find(pourFor(s, .02, 0), 'handoff');
  assert.ok(h); assert.equal(h.seat, 0); assert.notEqual(s.phase, 'pour');
});
test('re-tilting inside the delay cancels hand-off', () => {
  const s = createRun({ seed: 1 }); fillTo(s, .9);
  const ev = [...pourFor(s, .3, 0), ...pourFor(s, .1, .3), ...pourFor(s, .3, 0)];
  assert.ok(!types(ev).includes('handoff'));
});
test('under FILL_OK the mate stays', () => {
  const s = createRun({ seed: 1 }); fillTo(s, .6);
  assert.ok(!types(pourFor(s, 2, 0)).includes('handoff')); assert.equal(s.phase, 'pour');
});
test('top wash', () => { const s = createRun({ seed: 1 }); pourFor(s, 1, 1); near(s.yerba, 1 - .10 * .55, .005); });
test('overflow spills once and washes', () => {
  const s = createRun({ seed: 1 }); pourFor(s, 1.6, 1);
  const before = s.yerba, fill0 = s.turn.fill;
  const ev = pourFor(s, 1, 1);
  assert.equal(ev.filter(e => e.type === 'spill').length, 1);
  const overflow = s.turn.overflow, top = .10 * .55 * 1;
  assert.ok(fill0 < 1 && overflow > 0);
  near(before - s.yerba, top + .05 + .20 * overflow, .005);
});
test('wetTop rises with water on top and dries at .05/s', () => {
  const s = createRun({ seed: 1 }); pourFor(s, .3, 1); assert.ok(s.wetTop > .3);
  const w = s.wetTop; pourFor(s, 1, 0); near(s.wetTop, w - T.WET_DRY_RATE, .002);
});
test('yerba at 0 ends the run', () => {
  const s = createRun({ seed: 1 }); s.yerba = .001;
  const g = find(pourFor(s, .5, 1), 'gameOver');
  assert.equal(g.reason, 'lavado'); assert.equal(s.phase, 'over');
  assert.deepEqual(step(s, .1, 1).events, []);
});
test('big dt equals many small steps', () => {
  const a = createRun({ seed: 9 }), b = createRun({ seed: 9 });
  const ea = step(a, 1.0, 1).events; const eb = [];
  for (let i = 0; i < 20; i++) eb.push(...step(b, .05, 1).events);
  assert.equal(a.turn.fill, b.turn.fill); assert.equal(a.yerba, b.yerba); assert.deepEqual(types(ea), types(eb));
});
