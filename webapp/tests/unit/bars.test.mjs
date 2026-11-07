// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/bars.js: the side bars' widths and folding (webappGUI GD-10, GD-34;
// implementationPlan M4.3). layout.js draws them; the browser check covers the drawing.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterKey, clampWidth, defaultBars, KEY_STEP, LIMITS, parseBars, serializeBars, shownWidth, toggled, withWidth } from '../../src/app/bars.js';

test('GD-10 limits: left 220 to 480 px, right 240 to 520 px; the edge stops at the limit', () => {
  assert.deepEqual([LIMITS.left.min, LIMITS.left.max, LIMITS.right.min, LIMITS.right.max], [220, 480, 240, 520]);
  assert.equal(clampWidth('left', 100), 220);
  assert.equal(clampWidth('left', 999), 480);
  assert.equal(clampWidth('right', 300.6), 301);
  assert.equal(clampWidth('right', 'nonsense'), LIMITS.right.initial);
});

test('GD-34: stored widths and folding come back; anything malformed falls back per field', () => {
  const bars = withWidth(toggled(defaultBars(), 'right'), 'left', 400);
  assert.deepEqual(parseBars(serializeBars(bars)), bars);
  assert.deepEqual(parseBars(null), defaultBars());
  assert.deepEqual(parseBars('{not json'), defaultBars());
  assert.deepEqual(parseBars('{"left":{"w":9999,"folded":"yes"},"right":7}'),
    { left: { w: 480, folded: false }, right: defaultBars().right });
  assert.deepEqual(Object.keys(JSON.parse(serializeBars(bars))), ['left', 'right']);   // widths and folding only
});

test('GD-10: the tab folds and unfolds to the width the bar had; a folded bar takes no width', () => {
  const folded = toggled(withWidth(defaultBars(), 'left', 260), 'left');
  assert.equal(shownWidth(folded, 'left'), 0);
  assert.equal(folded.left.w, 260);
  assert.equal(shownWidth(toggled(folded, 'left'), 'left'), 260);
});

test('GD-10: dragging unfolds and clamps; the arrow keys move the edge 16 px, not on a folded bar', () => {
  assert.deepEqual(withWidth(toggled(defaultBars(), 'right'), 'right', 9), { ...defaultBars(), right: { w: 240, folded: false } });
  const b = defaultBars();
  assert.equal(afterKey(b, 'left', 'ArrowRight').left.w, b.left.w + KEY_STEP);   // the left bar grows to the right
  assert.equal(afterKey(b, 'left', 'ArrowLeft').left.w, b.left.w - KEY_STEP);
  assert.equal(afterKey(b, 'right', 'ArrowLeft').right.w, b.right.w + KEY_STEP);  // the right bar grows to the left
  assert.equal(afterKey(b, 'right', 'Enter'), b);
  const f = toggled(b, 'left');
  assert.equal(afterKey(f, 'left', 'ArrowRight'), f);
  assert.equal(afterKey(withWidth(b, 'left', 478), 'left', 'ArrowRight').left.w, 480);
});
