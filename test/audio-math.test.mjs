import test from 'node:test'; import assert from 'node:assert/strict';
import { resonanceHz, truckMix, musicLevel, babblePlan, charTimes } from '../src/audio-math.js';
import { T } from '../src/tuning.js';
import { makeRng } from '../src/rng.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
test('resonance rises toward the brim', () => {
  assert.equal(resonanceHz(0), 260); near(resonanceHz(.75), 520);
  let last = 0; for (let f = 0; f <= 1.0001; f += .01) { const hz = resonanceHz(f); assert.ok(hz >= last); last = hz; }
  near(resonanceHz(1), 1300); near(resonanceHz(1.05), 1300);
});
test('truck is centred, loudest and brightest at .5', () => {
  const m = truckMix(.5); near(m.pan, 0); near(m.gain, 1); near(m.cutoff, 8000);
  const e = truckMix(0); assert.equal(e.pan, -1); near(e.gain, .4); near(e.cutoff, 1200);
});
test('music ducks to 30 %', () => { near(musicLevel(true).target, .189); assert.equal(musicLevel(false).fade, T.DUCK_FADE_OUT); });
test('babble: one blip per vowel group', () => { assert.equal(babblePlan('Gracias, jefe', T.FRIEND_VOICES[1], makeRng(1)).length, 4); }); // gr[a]c[ia]s j[e]f[e]
test('driver babble is slower', () => {
  const last = v => babblePlan('Una mano, maestro, ¿me convidás uno?', v, makeRng(2)).at(-1).t;
  assert.ok(last(T.DRIVER_VOICE) > 1.5 * last(T.FRIEND_VOICES[1]));
});
test('jitter within ±8 %', () => {
  for (const b of babblePlan('Che, no es cadena nacional otra vez', T.FRIEND_VOICES[0], makeRng(5))) {
    assert.ok(Math.abs(b.hz / 320 - 1) <= .08 + 1e-9);
  }
});
test('charTimes is non-decreasing and ends before the last blip ends', () => {
  for (const text of ['Gracias, jefe', '¿Es cuadrado ese mate que no gira?', 'y']) {
    const plan = babblePlan(text, T.FRIEND_VOICES[2], makeRng(3)), times = charTimes(text, plan);
    assert.equal(times.length, text.length);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1]);
    const end = plan.at(-1); assert.ok(times.at(-1) <= end.t + end.dur);
  }
});
