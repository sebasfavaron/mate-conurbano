import test from 'node:test'; import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };
test('round-trips values under the prefix', () => {
  const s = memory(), store = createStore(s);
  store.set('best', 17);
  assert.equal(store.get('best', 0), 17);
  assert.equal(s.getItem('cebar-mate:best'), '17');
});
test('throwing storage falls back silently', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const store = createStore(bad);
  assert.doesNotThrow(() => store.set('muted', true));
  assert.equal(store.get('muted', false), false);
});
test('corrupt JSON falls back', () => {
  const s = memory(); s.setItem('cebar-mate:best', '{oops'); assert.equal(createStore(s).get('best', 0), 0);
});
test('no storage at all (Node) falls back', () => {
  const store = createStore();
  assert.doesNotThrow(() => store.set('best', 3));
  assert.equal(typeof store.get('best', 0), 'number');
});
