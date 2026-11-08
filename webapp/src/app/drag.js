// SPDX-License-Identifier: Apache-2.0
// Reordering by dragging (webappGUI GD-08, GD-11, GD-21; implementationPlan M5.3e, M5.5): a card is
// dragged by its handle within its list; near the top or bottom of the scroll area the list scrolls
// along, faster the closer the pointer is. The cards it passes slide aside to open a gap where it will
// land, and on release it slides into that gap; the buttons *Omhoog* and *Omlaag* (GD-33) slide the same
// way (the owner's M5 review, F5 and F7). Used by the song editor's blocks and by a set's songs. Offsets
// are the custom properties --dy and --shift (SR-24, SR-32): no style attribute is ever written. With
// prefers-reduced-motion nothing slides.

import { listen, setVar, toggleClass } from './dom.js';

export const EDGE = 72;                                  // px from an edge, above the Toepassen bar
export const MAX_SPEED = 18;                             // px per frame at the very edge

/**
 * GD-11: how far the list scrolls in one frame with the pointer at y, in a scroll area from top to
 * bottom (bottom already above a sticky footer): within edge px of an edge, towards it, faster the
 * closer the pointer is, at most max; elsewhere not at all.
 */
export function edgeSpeed(y, top, bottom, edge = EDGE, max = MAX_SPEED) {
  if (y < top + edge) return -max * Math.min(1, (top + edge - y) / edge);
  if (y > bottom - edge) return max * Math.min(1, (y - (bottom - edge)) / edge);
  return 0;
}

/**
 * F5, F7: where each card of a list stands while card from is on its way to place to (its index in the new
 * order), and how far that card moves to get there. The cards it passes make room by its height plus the gap.
 * heights are the cards' heights in list order; gap is the space between two cards.
 */
export function shiftPlan(heights, gap, from, to) {
  const size = heights[from] + gap;
  const shifts = heights.map(() => 0);
  let dy = 0;
  for (let i = from + 1; i <= to; i++) {
    shifts[i] = -size;
    dy += heights[i] + gap;
  }
  for (let i = to; i < from; i++) {
    shifts[i] = size;
    dy -= heights[i] + gap;
  }
  return { shifts, dy };
}

export const SETTLE_MS = 160;                            // a little longer than the .15 s of app.css

const still = () => Boolean(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
const gapOf = (cards) => (cards.length > 1 ? Math.max(0, cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom) : 0);

/** Every card at its shift of plan, card itself excepted. */
function applyShifts(cards, card, plan) {
  cards.forEach((c, i) => { if (c !== card) setVar(c, '--shift', `${plan.shifts[i]}px`); });
}

/**
 * The card slides by dy into its place, then done() makes the change. While the list is settling it takes no new
 * move. Once done() has finished (it may return a promise), whatever is still drawn is put back: a list drawn again
 * has gone, and a change that was refused leaves the old order as it was.
 */
function settle(list, cards, card, dy, done) {
  const finish = () => Promise.resolve().then(done).finally(() => {
    toggleClass(list, 'sorting', false);
    toggleClass(list, 'settling', false);
    cards.forEach((c) => { setVar(c, '--shift', '0px'); toggleClass(c, 'settle', false); toggleClass(c, 'dragging', false); setVar(c, '--dy', '0px'); });
  });
  if (still()) {
    finish();
    return;
  }
  toggleClass(list, 'settling', true);
  toggleClass(card, 'settle', true);
  setVar(card, '--dy', `${dy}px`);
  setTimeout(finish, SETTLE_MS);
}

/**
 * GD-33 (F5, F7): *Omhoog* or *Omlaag*: card, at from in list, and its neighbour change places by sliding, then
 * done() makes the change. Nothing happens while the list is still settling from the move before.
 */
export function slideMove(list, card, to, done) {
  if (list.classList.contains('settling')) return;
  const cards = [...list.children];
  const from = cards.indexOf(card);
  if (from < 0 || to < 0 || to >= cards.length || to === from) return;
  const plan = shiftPlan(cards.map((c) => c.offsetHeight), gapOf(cards), from, to);
  toggleClass(list, 'sorting', true);
  applyShifts(cards, card, plan);
  settle(list, cards, card, plan.dy, done);
}

/**
 * Start dragging card (a child of list) by handle, from the pointerdown event e. scroller is the
 * scrolling area, foot a sticky footer above whose top the bottom edge lies (or null). On release,
 * onDrop(from, to) gets the card's place and its place in the new order (0: first; the number of the
 * other cards: last); it is not called when the card stays where it was.
 */
export function startDrag(e, { handle, card, list, scroller, foot = null, onDrop }) {
  if (e.button !== 0 || list.classList.contains('settling')) return;
  e.preventDefault();
  const cards = [...list.children];
  const from = cards.indexOf(card);
  if (from < 0) return;
  try { handle.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
  toggleClass(card, 'dragging', true);
  toggleClass(list, 'sorting', true);
  const startY = e.clientY;
  const startScroll = scroller.scrollTop;
  const box = list.getBoundingClientRect();
  const own = card.getBoundingClientRect();
  const minDy = box.top - own.top;                       // the card cannot leave its list
  const maxDy = box.bottom - own.bottom;
  const heights = cards.map((c) => c.offsetHeight);
  const gap = gapOf(cards);
  // the others' middles, once and in the list's own coordinates, so the cards sliding aside do not move them
  const mids = cards.filter((c) => c !== card).map((c) => {
    const r = c.getBoundingClientRect();
    return r.top + r.height / 2 + startScroll;
  });
  let y = e.clientY;
  let to = from;
  let frame = 0;
  const place = () => {
    const dy = Math.max(minDy, Math.min(maxDy, y - startY + scroller.scrollTop - startScroll));
    setVar(card, '--dy', `${dy}px`);
    const k = mids.findIndex((m) => y + scroller.scrollTop < m);
    to = k === -1 ? mids.length : k;
    applyShifts(cards, card, shiftPlan(heights, gap, from, to));     // the gap opens where it will land
  };
  const tick = () => {
    const r = scroller.getBoundingClientRect();
    const bottom = r.bottom - (foot ? foot.offsetHeight : 0);
    const max = scroller.scrollHeight - scroller.clientHeight;
    const next = Math.max(0, Math.min(max, scroller.scrollTop + edgeSpeed(y, r.top, bottom)));   // stops at the ends
    if (next !== scroller.scrollTop) {
      scroller.scrollTop = next;
      place();
    }
    frame = requestAnimationFrame(tick);
  };
  const stops = [];
  const end = () => {
    cancelAnimationFrame(frame);
    stops.forEach((stop) => stop());
    // the card slides into its gap (or back to its place), then the change is made
    settle(list, cards, card, shiftPlan(heights, gap, from, to).dy, () => (to !== from ? onDrop(from, to) : undefined));
  };
  stops.push(listen(handle, 'pointermove', (ev) => { y = ev.clientY; place(); }));
  stops.push(listen(handle, 'pointerup', end));
  stops.push(listen(handle, 'pointercancel', end));
  frame = requestAnimationFrame(tick);
}
