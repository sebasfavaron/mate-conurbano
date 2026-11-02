import test from 'node:test'; import assert from 'node:assert/strict';
import { bubblePosition, formatEnd, canRestart } from '../src/ui.js';
test('bubblePosition maps canvas px to CSS px at 3×', () => {
  assert.deepEqual(bubblePosition(180, 140, { left: 10, top: 20, width: 1080, height: 840 }), { left: 550, top: 440 });
});
test('formatEnd for lavado and gracias, singular mate', () => {
  assert.deepEqual(formatEnd({ reason: 'lavado', score: 14, points: 2340, minutes: 9 }, 2900), ['2.340 puntos', '14 mates · la yerba aguantó 9 min', 'se lavó', 'récord: 2.900', 'otra ronda']);
  assert.deepEqual(formatEnd({ reason: 'gracias', score: 1, points: 230, minutes: 0 }, 230).slice(0, 3), ['230 puntos', '1 mate · la yerba aguantó 0 min', 'le cebaste al que dijo gracias']);
});
test('canRestart needs both the guard and a fresh press', () => {
  assert.equal(canRestart(.5, true), false); assert.equal(canRestart(1, false), false); assert.equal(canRestart(1, true), true);
});
import { endHint } from '../src/ui.js';
test('endHint names the main cause', () => {
  assert.match(endHint({ reason: 'lavado' }, { washTop: .5, washSpill: .2, spills: 2 }), /montañita/);
  assert.equal(endHint({ reason: 'lavado' }, { washTop: .1, washSpill: .5, spills: 3 }), 'se rebalsó 3 veces: soltá cuando aparece la espuma');
  assert.match(endHint({ reason: 'lavado' }, { washTop: 0, washSpill: .5, spills: 1 }), /una vez/);
  assert.match(endHint({ reason: 'gracias' }, {}), /gracias/);
});
test('formatEnd and endHint for the dry-mate ending', () => {
  assert.equal(formatEnd({ reason: 'seco', score: 3, minutes: 1 }, 9)[2], 'se cansaron de los mates secos');
  assert.match(endHint({ reason: 'seco' }, {}), /secos/);
});
import { popupText } from '../src/ui.js';
test('popupText names the result and the bonuses, and flags an early grab', () => {
  assert.deepEqual(popupText({ rating: 'perfecto', points: 230, tags: ['al ras', 'limpio', 'rápido'] }), { title: '¡Perfecto!', detail: '+230 · al ras · limpio · rápido', kind: 'great' });
  assert.deepEqual(popupText({ rating: 'sacado', points: 75, tags: ['limpio'] }), { title: '¡Te lo sacaron!', detail: '+75 · limpio', kind: 'bad' });
  assert.equal(popupText({ rating: 'seco', points: 0, tags: [] }).title, '¡Te lo sacaron! · seco');
});
