// SPDX-License-Identifier: Apache-2.0
// The side bars' widths and folding (webappGUI GD-10, GD-34; implementationPlan M4.3): plain state,
// no DOM, so it can be tested. layout.js draws it; storage.js keeps it under zbm.bars.

export const LIMITS = Object.freeze({
  left: Object.freeze({ min: 220, max: 480, initial: 300 }),     // GD-10
  right: Object.freeze({ min: 240, max: 520, initial: 340 }),
});
export const KEY_STEP = 16;                                       // GD-10: arrow keys resize in steps of 16 px

/** The defaults: both bars open at their initial width. */
export function defaultBars() {
  return { left: { w: LIMITS.left.initial, folded: false }, right: { w: LIMITS.right.initial, folded: false } };
}

/** A width within the bar's limits, in whole pixels. */
export function clampWidth(side, w) {
  const { min, max, initial } = LIMITS[side];
  const n = Number(w);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : initial;
}

/** The stored zbm.bars value read back; anything malformed or out of range falls back per field. */
export function parseBars(text) {
  const bars = defaultBars();
  let saved;
  try {
    saved = JSON.parse(text);
  } catch {
    return bars;
  }
  for (const side of ['left', 'right']) {
    const s = saved && typeof saved === 'object' ? saved[side] : null;
    if (s && typeof s === 'object') {
      if (s.w !== undefined) bars[side].w = clampWidth(side, s.w);
      if (typeof s.folded === 'boolean') bars[side].folded = s.folded;
    }
  }
  return bars;
}

/** The value stored under zbm.bars: widths and folding only. */
export function serializeBars(bars) {
  return JSON.stringify({ left: { w: bars.left.w, folded: bars.left.folded }, right: { w: bars.right.w, folded: bars.right.folded } });
}

/** The width the bar takes on screen: 0 when folded. */
export function shownWidth(bars, side) {
  return bars[side].folded ? 0 : bars[side].w;
}

/** GD-10: dragging unfolds the bar and sets its width within the limits. */
export function withWidth(bars, side, w) {
  return { ...bars, [side]: { w: clampWidth(side, w), folded: false } };
}

/** GD-10: the tab folds or unfolds; the width is kept for unfolding. */
export function toggled(bars, side) {
  return { ...bars, [side]: { ...bars[side], folded: !bars[side].folded } };
}

/** GD-10: the arrow keys on an edge. The key that moves the edge outward widens the bar. */
export function afterKey(bars, side, key) {
  if (bars[side].folded) return bars;
  const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
  const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
  if (key === grow) return withWidth(bars, side, bars[side].w + KEY_STEP);
  if (key === shrink) return withWidth(bars, side, bars[side].w - KEY_STEP);
  return bars;
}
