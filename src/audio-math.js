// Pure audio curves (spec §4.2–§4.3): gourd resonance, truck mix, ducking, voice babble timing.
import { T } from './tuning.js';
import { randomBetween } from './rng.js';

const lerp = (a, b, t) => a + (b - a) * t;
const VOWELS = /[aeiouáéíóúü]+/gi;

// A Helmholtz-like resonance: the smaller the air space left in the gourd, the higher it sings.
export function resonanceHz(fill, f0 = T.RES_F_EMPTY) {
  return f0 / Math.sqrt(Math.max(1 - fill, T.RES_MIN_AIR));
}

export function truckMix(progress, truckGain = T.TRUCK_GAIN) {
  const x = lerp(-1, 1, progress);
  return { pan: x, gain: truckGain * (1 - .6 * x * x), cutoff: lerp(8000, 1200, Math.abs(x) ** 1.5) };
}

export function musicLevel(truckActive, p = T) {
  return truckActive
    ? { target: p.MUSIC_GAIN * p.MUSIC_DUCK, fade: p.DUCK_FADE_IN }
    : { target: p.MUSIC_GAIN, fade: p.DUCK_FADE_OUT };
}

// One blip per vowel group of each word, Celeste-style. Each blip carries its word index for charTimes.
export function babblePlan(text, voice, rng) {
  const plan = [];
  const pause = voice.wordPause ?? T.WORD_PAUSE;
  let t = 0;
  text.split(/\s+/).filter(Boolean).forEach((word, w) => {
    const groups = Math.max(1, (word.match(VOWELS) || []).length);
    for (let i = 0; i < groups; i++) {
      const dur = randomBetween(rng, T.BLIP_MIN, T.BLIP_MAX) / voice.rate;
      const hz = voice.hz * (1 + randomBetween(rng, -T.VOICE_JITTER, T.VOICE_JITTER));
      plan.push({ t, hz, dur, word: w });
      t += dur + dur * .5 / voice.rate;
    }
    t += pause;
  });
  return plan;
}

// Reveal time of every character, so a bubble types in step with its blips.
export function charTimes(text, plan) {
  const times = [];
  let word = -1, inWord = false, prev = 0;
  const words = [];
  for (let i = 0; i < text.length; i++) {
    const space = /\s/.test(text[i]);
    if (!space && !inWord) { word++; words[word] = { start: i, len: 0 }; }
    if (!space) words[word].len++;
    inWord = !space;
  }
  word = -1; inWord = false;
  for (let i = 0; i < text.length; i++) {
    const space = /\s/.test(text[i]);
    if (!space && !inWord) word++;
    inWord = !space;
    if (space) { times.push(prev); continue; }
    const blips = plan.filter(b => b.word === word);
    const { start, len } = words[word];
    const pos = (i - start) * blips.length / len;
    const b = blips[Math.min(blips.length - 1, Math.floor(pos))];
    prev = Math.max(prev, b ? b.t + (pos - Math.floor(pos)) * b.dur : prev);
    times.push(prev);
  }
  return times;
}
