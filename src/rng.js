// Seeded RNG (mulberry32). The state lives in a plain object so a run can be copied or inspected.
export function makeRng(seed) {
  return { s: seed >>> 0 };
}

export function nextRandom(r) {
  r.s = (r.s + 0x6D2B79F5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomBetween(r, a, b) {
  return a + (b - a) * nextRandom(r);
}
