import test from 'node:test'; import assert from 'node:assert/strict';
import { createAmbience, DOG_FENCE, DOG_HOME } from '../src/ambience.js';
import { makeRng, nextRandom } from '../src/rng.js';
const state = (active = false) => ({ phase: 'pour', truck: { active } });
const run = (amb, secs, s, events = []) => { const cues = []; for (let t = 0; t < secs; t += .05) cues.push(...amb.update(s, .05, t === 0 ? events : [])); return cues; };
test('the dog barks now and then while the patio is quiet', () => {
  const r = makeRng(3), amb = createAmbience(() => nextRandom(r));
  const barks = run(amb, 300, state()).filter(c => c.type === 'bark');
  assert.ok(barks.length >= 4 && barks.length <= 30, `${barks.length} barks in 5 min`);
});
test('the truck sends the dog to the fence to bark, then home', () => {
  const r = makeRng(4), amb = createAmbience(() => nextRandom(r));
  const cues = run(amb, 10, state(true), [{ type: 'truckEnter' }]);
  assert.equal(amb.dog.mode, 'guard'); assert.deepEqual([amb.dog.x, amb.dog.y], [DOG_FENCE.x, DOG_FENCE.y]);
  assert.ok(cues.filter(c => c.type === 'bark').length >= 6);
  run(amb, 5, state(false));
  assert.equal(amb.dog.mode, 'lie'); assert.deepEqual([amb.dog.x, amb.dog.y], [DOG_HOME.x, DOG_HOME.y]);
});
test('birds sing every so often, not over the truck', () => {
  const r = makeRng(5), amb = createAmbience(() => nextRandom(r));
  assert.ok(run(amb, 120, state()).filter(c => c.type === 'bird').length >= 2);
  assert.equal(run(amb, 120, state(true)).filter(c => c.type === 'bird').length, 0);
});
