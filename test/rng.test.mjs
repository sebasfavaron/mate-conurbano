import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng, nextRandom, randomBetween } from '../src/rng.js';
test('same seed gives the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const sa = [1,2,3,4,5].map(() => nextRandom(a)), sb = [1,2,3,4,5].map(() => nextRandom(b));
  assert.deepEqual(sa, sb);
  assert.ok(sa.every(v => v >= 0 && v < 1));
});
test('randomBetween stays in range', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) { const v = randomBetween(r, 90, 150); assert.ok(v >= 90 && v < 150); }
});
