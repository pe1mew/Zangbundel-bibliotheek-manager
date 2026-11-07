// SPDX-License-Identifier: Apache-2.0
// GD-42 (FDS EDT-03): closing or reloading the page while there is work that would be lost — changes
// not yet downloaded, or a key made in this session whose file was not downloaded (GD-14) — asks
// the browser's own "leave this page?" question. The browser words it; a page cannot. The listener
// is there only while it is needed, so a page with nothing to lose stays eligible for the
// back-forward cache.

/**
 * createLeaveGuard({ target, atRisk, listenWhen }) → { sync() }: call sync() after every change of the
 * session. listenWhen (atRisk by default) says when to listen; atRisk decides at the moment of leaving,
 * for work whose state the guard does not see change (typing in the song editor).
 */
export function createLeaveGuard({ target = globalThis, atRisk, listenWhen = atRisk }) {
  let on = false;
  const ask = (event) => {
    if (!atRisk()) return;
    event.preventDefault();
    event.returnValue = '';                               // older browsers need it set to ask at all
  };
  return {
    sync() {
      const need = Boolean(listenWhen());
      if (need === on) return;
      on = need;
      if (need) target.addEventListener('beforeunload', ask);
      else target.removeEventListener('beforeunload', ask);
    },
    get active() {
      return on;
    },
  };
}
