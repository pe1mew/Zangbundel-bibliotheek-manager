// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/idle.js (webappGUI GD-40, securityAssessment SR-46; implementationPlan
// M6.4) with a fake clock, a hand-driven timer and a stand-in for the page's input events.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleWatch, IDLE_MS, WARN_S } from '../../src/app/idle.js';

const MIN = 60 * 1000;
function rig(initial = 'saved') {
  let clock = 0;
  let state = initial;
  const log = [];
  const target = new EventTarget();
  const watch = createIdleWatch({
    keyState: () => state,
    onWarn: (w) => log.push(['warn', w.unsaved, w.seconds]),
    onTick: (s) => log.push(['tick', s]),
    onExpire: () => { log.push(['expire']); state = null; },
    now: () => clock,
    every: () => () => {},                                // the test calls tick() itself
    target,
  });
  return { watch, log, target, at: (ms) => { clock = ms; watch.tick(); }, setState: (s) => { state = s; }, input: (type = 'keydown') => target.dispatchEvent(new Event(type)) };
}

test('GD-40: 30 minutes without input warn; 60 seconds later a downloaded key is forgotten', () => {
  assert.deepEqual([IDLE_MS, WARN_S], [30 * MIN, 60]);
  const r = rig();
  r.at(29 * MIN);
  assert.deepEqual(r.log, []);
  r.at(30 * MIN);
  assert.deepEqual(r.log, [['warn', false, 60]]);
  r.at(30 * MIN + 1000);
  r.at(30 * MIN + 59 * 1000);
  assert.deepEqual(r.log.slice(1), [['tick', 59], ['tick', 1]]);
  r.at(31 * MIN);
  assert.deepEqual(r.log.at(-1), ['expire']);
  assert.equal(r.watch.warning, false);
});

test('GD-40: input before the warning starts the 30 minutes again; input during it does not answer it', () => {
  const r = rig();
  r.at(20 * MIN);
  r.input('pointermove');
  r.at(45 * MIN);
  assert.deepEqual(r.log, []);                            // 25 minutes since the last input
  r.at(50 * MIN);
  assert.deepEqual(r.log, [['warn', false, 60]]);
  r.input('keydown');                                     // a key press is no answer: Sleutel houden is
  r.at(51 * MIN);
  assert.deepEqual(r.log.at(-1), ['expire']);
});

test('GD-40: Sleutel houden keeps the key and starts the 30 minutes again', () => {
  const r = rig();
  r.at(30 * MIN);
  r.watch.keep();
  r.at(31 * MIN);
  r.at(59 * MIN);
  assert.deepEqual(r.log, [['warn', false, 60]]);
  r.at(60 * MIN);
  assert.deepEqual(r.log.at(-1), ['warn', false, 60]);
});

test('GD-39, GD-40: a key not yet downloaded is warned about but never forgotten by itself', () => {
  const r = rig('unsaved');
  r.at(30 * MIN);
  r.at(40 * MIN);
  r.at(600 * MIN);
  assert.deepEqual(r.log, [['warn', true, 60]]);
  r.setState('saved');                                    // downloaded from the warning: the countdown is fresh
  r.watch.keep();
  r.at(630 * MIN);
  assert.deepEqual(r.log.at(-1), ['warn', false, 60]);
});

test('without a key nothing happens, and time without a key does not count', () => {
  const r = rig(null);
  r.at(120 * MIN);
  assert.deepEqual(r.log, []);
  r.setState('saved');                                    // a key loaded now
  r.at(121 * MIN);
  r.at(149 * MIN);
  assert.deepEqual(r.log, []);
  r.at(151 * MIN);
  assert.deepEqual(r.log, [['warn', false, 60]]);
});

test('a background tab whose timer runs late still keeps the rule: time is measured, not counted', () => {
  const r = rig();
  r.at(45 * MIN);                                         // the first tick in a long while
  assert.deepEqual(r.log, [['warn', false, 60]]);
  r.at(47 * MIN);                                         // the next one, two minutes later
  assert.deepEqual(r.log.at(-1), ['expire']);
});

test('stop() ends the timer and the input listeners', () => {
  let stopped = false;
  const target = new EventTarget();
  let clock = 0;
  const w = createIdleWatch({ keyState: () => 'saved', onWarn() {}, onTick() {}, onExpire() {}, now: () => clock,
    every: () => () => { stopped = true; }, target });
  w.stop();
  assert.equal(stopped, true);
  clock = 10 * MIN;
  target.dispatchEvent(new Event('keydown'));             // no longer heard, so the last input stays at 0
  clock = 30 * MIN;
  w.tick();                                               // by hand: 30 minutes since 0, not 20 since the keydown
  assert.equal(w.warning, true);
});
