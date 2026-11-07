// SPDX-License-Identifier: Apache-2.0
// GD-40, SR-46: while a key is in memory, 30 minutes without mouse, keyboard or touch input open a
// warning; after 60 more seconds without an answer a downloaded key is forgotten. A key whose file has
// not been downloaded yet is never forgotten by itself: the warning then stays until the user chooses.
// Time is measured, not counted, so a background tab whose timers run late still keeps the rule.
// No DOM of its own: the caller draws the warning (library-ui.js idleDialog) and forgets the key.

export const IDLE_MS = 30 * 60 * 1000;
export const WARN_S = 60;
const INPUT = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

/**
 * keyState(): null (no key), 'saved' or 'unsaved'. onWarn({ unsaved, seconds }) opens the warning,
 * onTick(seconds) updates its countdown, onExpire() forgets the key. keep() after *Sleutel houden*
 * (or whenever the warning closes) starts the 30 minutes again. now, every and target are for tests.
 */
export function createIdleWatch({ keyState, onWarn, onTick, onExpire, now = () => Date.now(),
  every = (fn, ms) => { const h = setInterval(fn, ms); return () => clearInterval(h); }, target = globalThis,
  idleMs = IDLE_MS, warnS = WARN_S }) {
  let last = now();
  let warnedAt = null;                                   // when the warning opened, or null
  const input = () => { if (warnedAt === null) last = now(); };   // the open warning wants an answer, not a mouse move
  const opts = { passive: true, capture: true };
  if (target && typeof target.addEventListener === 'function') INPUT.forEach((type) => target.addEventListener(type, input, opts));

  function tick() {
    const state = keyState();
    if (!state) {
      warnedAt = null;
      last = now();
      return;
    }
    if (warnedAt === null) {
      if (now() - last >= idleMs) {
        warnedAt = now();
        onWarn({ unsaved: state === 'unsaved', seconds: warnS });
      }
      return;
    }
    if (state === 'unsaved') return;                     // never forgotten silently
    const left = Math.max(0, warnS - Math.floor((now() - warnedAt) / 1000));
    if (left > 0) {
      onTick(left);
      return;
    }
    warnedAt = null;
    last = now();
    onExpire();
  }
  const stopTimer = every(tick, 1000);

  return {
    tick,
    keep() {
      warnedAt = null;
      last = now();
    },
    get warning() {
      return warnedAt !== null;
    },
    stop() {
      stopTimer();
      if (target && typeof target.removeEventListener === 'function') INPUT.forEach((type) => target.removeEventListener(type, input, opts));
    },
  };
}
