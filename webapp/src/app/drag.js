// SPDX-License-Identifier: Apache-2.0
// Reordering by dragging (webappGUI GD-08, GD-11, GD-21; implementationPlan M5.3e, M5.5): a card is
// dragged by its handle within its list; near the top or bottom of the scroll area the list scrolls
// along, faster the closer the pointer is; a line shows where the card will land. Used by the song
// editor's blocks and by a set's songs. The offset is the custom property --dy and the line a class
// (SR-24, SR-32): no style attribute is ever written.

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
 * Start dragging card (a child of list) by handle, from the pointerdown event e. scroller is the
 * scrolling area, foot a sticky footer above whose top the bottom edge lies (or null). On release,
 * onDrop(from, to) gets the card's place and the place among the other cards it lands at (0: before the
 * first; their count: after the last); it is not called when the card stays where it was.
 */
export function startDrag(e, { handle, card, list, scroller, foot = null, onDrop }) {
  if (e.button !== 0) return;
  e.preventDefault();
  const cards = [...list.children];
  const from = cards.indexOf(card);
  if (from < 0) return;
  try { handle.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
  toggleClass(card, 'dragging', true);
  const startY = e.clientY;
  const startScroll = scroller.scrollTop;
  const box = list.getBoundingClientRect();
  const own = card.getBoundingClientRect();
  const minDy = box.top - own.top;                       // the card cannot leave its list
  const maxDy = box.bottom - own.bottom;
  const others = cards.filter((c) => c !== card);
  let y = e.clientY;
  let to = from;
  let frame = 0;
  const clear = () => others.forEach((c) => { toggleClass(c, 'dropbefore', false); toggleClass(c, 'dropafter', false); });
  const place = () => {
    const dy = Math.max(minDy, Math.min(maxDy, y - startY + scroller.scrollTop - startScroll));
    setVar(card, '--dy', `${dy}px`);
    let k = others.findIndex((c) => y < c.getBoundingClientRect().top + c.offsetHeight / 2);
    if (k === -1) k = others.length;
    to = k;
    clear();                                             // a line shows where it will land
    if (k < others.length) toggleClass(others[k], 'dropbefore', true);
    else if (others.length) toggleClass(others[others.length - 1], 'dropafter', true);
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
    clear();
    toggleClass(card, 'dragging', false);
    setVar(card, '--dy', '0px');
    if (to !== from) onDrop(from, to);
  };
  stops.push(listen(handle, 'pointermove', (ev) => { y = ev.clientY; place(); }));
  stops.push(listen(handle, 'pointerup', end));
  stops.push(listen(handle, 'pointercancel', end));
  frame = requestAnimationFrame(tick);
}
