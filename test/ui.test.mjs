import test from 'node:test'; import assert from 'node:assert/strict';
import { bubblePosition, formatEnd, canRestart } from '../src/ui.js';
test('bubblePosition maps canvas px to CSS px at 3×', () => {
  assert.deepEqual(bubblePosition(180, 140, { left: 10, top: 20, width: 1080, height: 840 }), { left: 550, top: 440 });
});
test('formatEnd for lavado and gracias, singular mate', () => {
  assert.deepEqual(formatEnd({ reason: 'lavado', score: 14, minutes: 9 }, 17), ['14 mates', 'la yerba aguantó 9 min', 'se lavó', 'récord: 17', 'otra ronda']);
  assert.deepEqual(formatEnd({ reason: 'gracias', score: 1, minutes: 0 }, 1).slice(0, 3), ['1 mate', 'la yerba aguantó 0 min', 'le cebaste al que dijo gracias']);
});
test('canRestart needs both the guard and a fresh press', () => {
  assert.equal(canRestart(.5, true), false); assert.equal(canRestart(1, false), false); assert.equal(canRestart(1, true), true);
});
