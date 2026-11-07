// SPDX-License-Identifier: Apache-2.0
// GD-42 (FDS EDT-03): closing or reloading the page while there is work that would be lost — changes
// not yet downloaded, or a key made in this session whose file was not downloaded (GD-14) — asks
// the browser's own "leave this page?" question. The browser words it; a page cannot. The listener
// is there only while it is needed, so a page with nothing to lose stays eligible for the
// back-forward cache.

/** createLeaveGuard({ target, atRisk }) → { sync() }: call sync() after every change of the session. */
export function createLeaveGuard({ target = globalThis, atRisk }) {
  let on = false;
  const ask = (event) => {
    event.preventDefault();
    event.returnValue = '';                               // older browsers need it set to ask at all
  };
  return {
    sync() {
      const need = Boolean(atRisk());
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
