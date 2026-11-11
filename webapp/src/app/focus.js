// SPDX-License-Identifier: Apache-2.0
// Keeping the keyboard's place across a redraw (implementationPlan M7.3; WCAG 2.4.3). main.js redraws
// the centre, the bars and the bottom bar from the session's state. When that removes the control that
// had the focus, the browser drops the focus to the page itself, and a keyboard user has to start again
// from the top. markFocus notes the control before the redraw. restoreFocus then finds its new
// counterpart in the same region: by id, by tab (data-tab), by key (data-key, the bottom bar's buttons,
// whose labels carry counts), or by tag and label. If the control is gone, the focus goes to the
// region's first heading, which is made focusable without a ring (.focusdest), so a screen reader names
// where the user now is. Never by position: another screen's first button is not the same control.
// A control that is disabled while it works (*Toepassen* while the worker applies) drops the focus
// before the redraw; trackFocus remembers the last control, so that case is kept as well. A control
// the user left on purpose, by clicking elsewhere, is left alone.

import { setAttrs } from './dom.js';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const label = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ');
const shown = (e) => e.getClientRects().length > 0 && !e.closest('[hidden], [inert]');
const controls = (region) => [...region.querySelectorAll(FOCUSABLE)].filter(shown);

const usable = (e) => e.isConnected && !e.disabled && shown(e);
let last = null;                                          // the last control that had the focus, in a region

function describe(e, regions) {
  const region = regions.find((r) => r && r.contains(e));
  if (!region) return null;                               // a dialog or a menu looks after its own focus
  return { node: e, region, id: e.id, tab: e.getAttribute('data-tab'), key: e.getAttribute('data-key'), tag: e.tagName, text: label(e) };
}

/** Remember the last focused control in the regions (once, at start). */
export function trackFocus(regions, doc = document) {
  doc.addEventListener('focusin', (event) => { last = describe(event.target, regions) || last; }, true);
}

/** The focused control and where it is, when it is inside one of the regions; otherwise null. */
export function markFocus(regions, doc = document) {
  const e = doc.activeElement;
  if (!e || e === doc.body) return last && !usable(last.node) ? last : null;   // taken away by the app, not left by the user
  return describe(e, regions);
}

/** After a redraw: put the focus back on the control's counterpart, or on the region's heading. */
export function restoreFocus(mark, doc = document) {
  if (!mark) return;
  const now = doc.activeElement;
  if (now === mark.region && now.classList.contains('focusdest')) {   // the region stood in while it had no heading
    const heading = [...now.querySelectorAll('h1, h2, h3')].find(shown);
    if (heading) toHeading(heading);
    return;
  }
  if (now && now !== doc.body && now.isConnected) return; // it kept the focus, or the redraw put it somewhere on purpose
  if (usable(mark.node)) {                                // still in place and usable again
    mark.node.focus({ preventScroll: true });
    return;
  }
  const all = controls(mark.region);
  const found = (mark.id && doc.getElementById(mark.id))
    || (mark.tab && all.find((c) => c.getAttribute('data-tab') === mark.tab))
    || (mark.key && all.find((c) => c.getAttribute('data-key') === mark.key))
    || all.find((c) => c.tagName === mark.tag && label(c) === mark.text);
  if (found && shown(found)) {
    found.focus({ preventScroll: true });
    return;
  }
  // the same control, now disabled (*Omlaag* of a song that reached the bottom): a usable control beside it
  const same = [...mark.region.querySelectorAll('button:disabled')].find((c) => label(c) === mark.text && shown(c));
  const beside = same && [...same.parentElement.querySelectorAll(FOCUSABLE)].find(shown);
  if (beside) {
    beside.focus({ preventScroll: true });
    return;
  }
  toHeading([...mark.region.querySelectorAll('h1, h2, h3')].find(shown) || mark.region);
}

/** A new view opened in a region (the editor): the focus goes to its heading, wherever it was opened from. */
export function focusHeading(region) {
  toHeading([...region.querySelectorAll('h1, h2, h3')].find(shown) || region);
}

/** Focus a heading (or the region itself), made focusable for this without a ring. */
function toHeading(target) {
  if (!target.hasAttribute('tabindex')) setAttrs(target, { tabindex: -1 });
  target.classList.add('focusdest');
  target.focus({ preventScroll: true });
}
