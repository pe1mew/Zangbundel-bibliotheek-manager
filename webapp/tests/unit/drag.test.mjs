// SPDX-License-Identifier: Apache-2.0
// Unit tests of the sliding cards (webapp/src/app/drag.js; webappGUI GD-08, GD-21, GD-33; the owner's M5
// review F5 and F7): where the cards stand while one moves, and how Omhoog/Omlaag slide before the change.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(height = 0, top = 0) {
    Object.assign(this, { children: [], classes: new Set(), vars: {}, offsetHeight: height, top, parentElement: null });
    this.style = { setProperty: (n, v) => { this.vars[n] = v; } };
    this.classList = { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)), contains: (c) => this.classes.has(c) };
  }
  getBoundingClientRect() { return { top: this.top, bottom: this.top + this.offsetHeight, height: this.offsetHeight }; }
}
globalThis.document = { createElement: () => new FakeNode(), createElementNS: () => new FakeNode(), createTextNode: (s) => ({ text: s }) };
let reduced = false;
globalThis.matchMedia = () => ({ matches: reduced });

const { shiftPlan, slideMove, SETTLE_MS } = await import('../../src/app/drag.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A list of cards of these heights, 12 px apart. */
function list(heights) {
  const l = new FakeNode();
  let top = 0;
  l.children = heights.map((h) => { const c = new FakeNode(h, top); c.parentElement = l; top += h + 12; return c; });
  return l;
}

test('F5, F7: moving down, the cards passed slide up by its size; it moves by theirs', () => {
  assert.deepEqual(shiftPlan([98, 74, 98], 12, 0, 2), { shifts: [0, -110, -110], dy: 86 + 110 });
  assert.deepEqual(shiftPlan([313, 202, 50], 12, 0, 1), { shifts: [0, -325, 0], dy: 214 });
});

test('F5, F7: moving up, the cards passed slide down; staying put moves nothing', () => {
  assert.deepEqual(shiftPlan([98, 74, 98], 12, 2, 0), { shifts: [110, 110, 0], dy: -(110 + 86) });
  assert.deepEqual(shiftPlan([98, 74, 98], 12, 1, 1), { shifts: [0, 0, 0], dy: 0 });
});

test('GD-33 (F5, F7): Omlaag slides the card and its neighbour, then makes the change, then puts the old cards back', async () => {
  reduced = false;
  const l = list([98, 74, 98]);
  const [a, b, c] = l.children;
  let changed = 0;
  slideMove(l, a, 1, () => { changed += 1; });
  assert.ok(l.classes.has('sorting') && l.classes.has('settling') && a.classes.has('settle'));
  assert.equal(a.vars['--dy'], '86px');                      // past b: b's height and the gap
  assert.equal(b.vars['--shift'], '-110px');                 // b makes room: a's height and the gap
  assert.equal(c.vars['--shift'], '0px');
  slideMove(l, b, 2, () => { changed += 10; });              // still settling: no second move
  assert.equal(changed, 0, 'the change waits for the slide');
  await wait(SETTLE_MS + 40);
  assert.equal(changed, 1);
  assert.ok(!l.classes.has('sorting') && !l.classes.has('settling') && !a.classes.has('settle'));
  assert.equal(b.vars['--shift'], '0px');
  assert.equal(a.vars['--dy'], '0px');
});

test('GD-33: with prefers-reduced-motion the change is made at once; a move off the list does nothing', async () => {
  reduced = true;
  const l = list([40, 40]);
  let changed = 0;
  slideMove(l, l.children[1], 0, () => { changed += 1; });
  await wait(0);
  assert.equal(changed, 1);
  slideMove(l, l.children[1], 2, () => { changed += 1; });
  slideMove(l, l.children[0], -1, () => { changed += 1; });
  await wait(0);
  assert.equal(changed, 1);
  reduced = false;
});
