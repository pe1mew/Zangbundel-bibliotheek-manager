// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/leave-guard.js (webappGUI GD-42, FDS EDT-03; implementationPlan M5.1).
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeaveGuard } from '../../src/app/leave-guard.js';

// as the browser's BeforeUnloadEvent: returnValue can be set (a plain Event's is read-only in Node 18)
class BeforeUnload extends Event {
  returnValue = true;
}
const leave = (target) => {
  const event = new BeforeUnload('beforeunload', { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;                        // true: the browser asks before leaving
};

test('GD-42: the browser asks before leaving only while work would be lost, and listens only then', () => {
  const target = new EventTarget();
  let risk = false;
  const guard = createLeaveGuard({ target, atRisk: () => risk });
  guard.sync();
  assert.deepEqual([guard.active, leave(target)], [false, false]);
  risk = true;
  guard.sync();
  guard.sync();                                         // twice: still one listener
  assert.deepEqual([guard.active, leave(target)], [true, true]);
  risk = false;
  guard.sync();
  assert.deepEqual([guard.active, leave(target)], [false, false]);
});

test('GD-36, GD-42: an open editor is listened for, but leaving asks only once it has changes', () => {
  const target = new EventTarget();
  let open = true;
  let changed = false;
  const guard = createLeaveGuard({ target, atRisk: () => open && changed, listenWhen: () => open });
  guard.sync();
  assert.deepEqual([guard.active, leave(target)], [true, false]);   // listening, nothing to lose yet
  changed = true;                                     // typing: no session change, no sync
  assert.equal(leave(target), true);
  open = false;
  guard.sync();
  assert.deepEqual([guard.active, leave(target)], [false, false]);
});
