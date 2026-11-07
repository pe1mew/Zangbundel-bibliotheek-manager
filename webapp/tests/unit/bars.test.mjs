// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/bars.js: the side bars' widths and folding (webappGUI GD-10, GD-34;
// implementationPlan M4.3). layout.js draws them; the browser check covers the drawing.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterKey, CENTRE_MIN, clampWidth, defaultBars, KEY_STEP, LIMITS, parseBars, serializeBars, shownWidth, shownWidths, toggled, withWidth } from '../../src/app/bars.js';

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

test('GD-41: the centre keeps 360 px; a drag or a key stops there, next to the other bar as shown', () => {
  assert.equal(CENTRE_MIN, 360);
  const b = withWidth(defaultBars(), 'right', 520);                 // no frame width: the limits only
  assert.equal(b.right.w, 520);
  // in 1024 px the right bar shows 364 px (1024 - 300 - 360), so the left bar has room for 300 px
  assert.equal(withWidth(b, 'left', 480, 1024).left.w, 1024 - 364 - 360);
  assert.equal(withWidth(b, 'left', 480, 800).left.w, LIMITS.left.min);   // 800 - 240 - 360 = 200 < 220: its minimum
  assert.equal(withWidth(defaultBars(), 'left', 480, 1200).left.w, 480);   // 500 px room, capped by its maximum
  assert.equal(withWidth(defaultBars(), 'left', 480, 1100).left.w, 1100 - 340 - 360);   // 400
  const k = afterKey(defaultBars(), 'left', 'ArrowRight', 1000);    // room 1000 - 340 - 360 = 300: at the edge already
  assert.equal(k.left.w, 300);
  const folded = toggled(defaultBars(), 'right');                   // a folded bar leaves its room to the other
  assert.equal(withWidth(folded, 'left', 480, 1000).left.w, 480);
});

test('GD-41: in a narrow window the shown bars give way, right first, down to their minimums; the chosen widths stay', () => {
  const b = withWidth(withWidth(defaultBars(), 'left', 480), 'right', 520);   // chosen on a wide screen
  assert.deepEqual(shownWidths(b, 1600), { left: 480, right: 520 });
  assert.deepEqual(shownWidths(b, 1200), { left: 480, right: 1200 - 480 - 360 });   // right gives 160
  assert.deepEqual(shownWidths(b, 1024), { left: 1024 - 240 - 360, right: 240 });   // right at its minimum, then left
  assert.deepEqual(shownWidths(b, 980), { left: 380, right: 240 });
  assert.equal(b.left.w, 480);                                      // nothing stored changes
  const s = shownWidths(b, 1024);
  assert.ok(1024 - s.left - s.right >= CENTRE_MIN);
  assert.deepEqual(shownWidths(toggled(b, 'left'), 980), { left: 0, right: 520 });
  assert.equal(shownWidth(b, 'right'), 520);                        // without a frame width: as chosen
});
