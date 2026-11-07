// SPDX-License-Identifier: Apache-2.0
// The side bars' widths and folding (webappGUI GD-10, GD-34, GD-41; implementationPlan M4.3): plain
// state, no DOM, so it can be tested. layout.js draws it; storage.js keeps it under zbm.bars.

export const LIMITS = Object.freeze({
  left: Object.freeze({ min: 220, max: 480, initial: 300 }),     // GD-10
  right: Object.freeze({ min: 240, max: 520, initial: 340 }),
});
export const KEY_STEP = 16;                                       // GD-10: arrow keys resize in steps of 16 px
export const CENTRE_MIN = 360;                                    // GD-41: the centre keeps at least this width

const other = (side) => (side === 'left' ? 'right' : 'left');

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

/**
 * The widths the bars take on screen in a frame `total` px wide: 0 for a folded bar; otherwise the
 * chosen width, reduced (the right bar first, down to its minimum) where the centre would get less
 * than CENTRE_MIN (GD-41). The chosen widths stay stored and come back when the window is wider.
 * Without a total, the chosen widths.
 */
export function shownWidths(bars, total) {
  const shown = { left: bars.left.folded ? 0 : bars.left.w, right: bars.right.folded ? 0 : bars.right.w };
  if (!Number.isFinite(total)) return shown;
  let excess = shown.left + shown.right + CENTRE_MIN - total;
  for (const side of ['right', 'left']) {
    if (excess <= 0 || shown[side] === 0) continue;
    const give = Math.min(excess, shown[side] - LIMITS[side].min);
    shown[side] -= give;
    excess -= give;
  }
  return shown;
}

/** The width one bar takes on screen (see shownWidths). */
export function shownWidth(bars, side, total) {
  return shownWidths(bars, total)[side];
}

/**
 * GD-10, GD-41: dragging unfolds the bar and sets its width within the limits, and never so wide
 * that the centre gets less than CENTRE_MIN next to the other bar as shown.
 */
export function withWidth(bars, side, w, total) {
  let width = clampWidth(side, w);
  if (Number.isFinite(total)) {
    const room = total - shownWidth(bars, other(side), total) - CENTRE_MIN;
    width = Math.max(LIMITS[side].min, Math.min(width, room));
  }
  return { ...bars, [side]: { w: width, folded: false } };
}

/** GD-10: the tab folds or unfolds; the width is kept for unfolding. */
export function toggled(bars, side) {
  return { ...bars, [side]: { ...bars[side], folded: !bars[side].folded } };
}

/** GD-10: the arrow keys on an edge. The key that moves the edge outward widens the bar. */
export function afterKey(bars, side, key, total) {
  if (bars[side].folded) return bars;
  const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
  const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
  const now = shownWidth(bars, side, total);
  if (key === grow) return withWidth(bars, side, now + KEY_STEP, total);
  if (key === shrink) return withWidth(bars, side, now - KEY_STEP, total);
  return bars;
}
