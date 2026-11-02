import test from 'node:test'; import assert from 'node:assert/strict';
import { createRun, pourScore } from '../src/sim.js';
import { until, find } from './helpers.mjs';

test('a brim-full, clean, quick mate is perfect', () => {
  const r = pourScore({ fill: .98 });
  assert.equal(r.points, 230); assert.deepEqual(r.tags, ['al ras', 'limpio', 'rápido']); assert.equal(r.combo, 1);
});
test('streaks multiply, and break on a washing pour', () => {
  assert.equal(pourScore({ fill: .98, combo: 3 }).points, 300);
  const washed = pourScore({ fill: .98, washedTop: .03, combo: 3 });
  assert.equal(washed.combo, 0); assert.equal(washed.points, 180);
});
test('a spill costs and breaks the streak', () => {
  const r = pourScore({ fill: 1, overflow: .05, combo: 4 });
  assert.equal(r.points, 140); assert.ok(r.tags.includes('rebalsado')); assert.equal(r.combo, 0);
});
test('a grab halves a full mate and scores nothing for a short one', () => {
  const full = pourScore({ fill: .9, grabbed: true, teased: true });
  assert.equal(full.rating, 'sacado'); assert.equal(full.points, 75);
  assert.deepEqual([pourScore({ fill: .5, grabbed: true }).points, pourScore({ fill: .5, grabbed: true }).rating], [0, 'corto']);
  assert.equal(pourScore({ fill: .1, grabbed: true }).rating, 'seco');
});
test('the truck guest doubles the points', () => {
  assert.equal(pourScore({ fill: .98, guest: true }).points, 460);
});
test('hand-offs carry their points into the run total', () => {
  const s = createRun({ seed: 1, skipTutorial: true }); s.turn.armed = true; s.truck.nextAt = 1e9;
  const ev = until(s, st => (st.phase === 'pour' && st.turn.fill < .975 ? .5 : 0), (st, e) => e.some(x => x.type === 'handoff'));
  const h = find(ev, 'handoff');
  assert.ok(h.points > 0); assert.equal(s.points, h.points); assert.ok(h.tags.includes('al ras'));
});
