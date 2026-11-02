import test from 'node:test'; import assert from 'node:assert/strict';
import { LINES, RULES, pickLine } from '../src/lines.js';
import { makeRng } from '../src/rng.js';
test('pickLine never repeats the previous line', () => {
  const r = makeRng(3); let last;
  for (let i = 0; i < 200; i++) { const l = pickLine('impatient', r, last); assert.notEqual(l, last); last = l; }
});
test('single-line category returns that line', () => {
  assert.equal(pickLine('guestThanks', makeRng(1), 'Gracias, jefe'), 'Gracias, jefe');
});
test('every category is non-empty strings', () => {
  for (const [k, v] of Object.entries(LINES)) {
    const list = Array.isArray(v) ? v : Object.values(v);
    assert.ok(list.length > 0, k);
    assert.ok(list.every(s => typeof s === 'string' && s.length > 0), k);
  }
  assert.equal(RULES.length, 4);
});
test("impatient contains the owner's four lines", () => {
  for (const l of ['¿Es cuadrado ese mate que no gira?', 'Tengo la garganta un poco seca…', 'Che, no es cadena nacional']) assert.ok(LINES.impatient.includes(l));
  assert.ok(LINES.lavado.includes('¿Armamos otro así gira más rápido?'));
});
