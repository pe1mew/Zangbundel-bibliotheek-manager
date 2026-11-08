// SPDX-License-Identifier: Apache-2.0
// The language menu of the bottom bar (webappGUI GD-17, amended after the owner's M5 review, F4; as the mock).
// A click on the language button opens a small menu above it: every interface language in its own name, the
// current one checked. A choice closes the menu and applies the language at once. Escape, Tab, a second click
// on the button or a click outside close it unchanged. Arrow keys, Home and End move through it.

import { el, icon, listen, setAttrs, setVar } from './dom.js';
import { LANGUAGES, t } from './i18n.js';

let open = null;                                          // { close(refocus) } of the menu that is open

/** The item that a key moves to from item i of n (round), or i for any other key. */
export function nextIndex(i, n, key) {
  if (key === 'ArrowDown') return (i + 1) % n;
  if (key === 'ArrowUp') return (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return i;
}

/** Whether the menu is open (tests). */
export const languageMenuOpen = () => open !== null;

/**
 * Open the menu for button, or close it when it is open. lang is the interface language; onPick(l) is called with
 * the chosen language when it differs. After a choice the focus goes to the language button of the redrawn bar.
 */
export function toggleLanguageMenu(lang, button, onPick) {
  if (open) {
    open.close(true);
    return;
  }
  const stops = [];
  const items = LANGUAGES.map((l) => el('button', { type: 'button', role: 'menuitemradio', lang: l,
    'aria-checked': String(l === lang), tabindex: -1, on: { click: () => pick(l) } },
  [l === lang ? icon('check') : el('span', { class: 'sp', 'aria-hidden': 'true' }, []), t(l, 'languageName')]));
  const menu = el('div', { class: 'langmenu', role: 'menu', 'aria-label': t(lang, 'languageMenu') }, items);

  function close(refocus) {
    stops.forEach((stop) => stop());
    menu.remove();
    open = null;
    if (button.isConnected) {
      setAttrs(button, { 'aria-expanded': 'false' });
      if (refocus) button.focus();
    }
  }
  function pick(l) {
    close(false);
    if (l !== lang) onPick(l);
    const again = document.querySelector('.langbtn');      // the bar is drawn again in the new language
    if (again) again.focus();
  }

  document.body.append(menu);
  // above the button, inside the window
  const r = button.getBoundingClientRect();
  setVar(menu, '--mx', `${Math.max(8, Math.min(globalThis.innerWidth - menu.offsetWidth - 8, r.left))}px`);
  setVar(menu, '--my', `${Math.max(8, r.top - menu.offsetHeight - 6)}px`);
  setAttrs(button, { 'aria-expanded': 'true' });
  open = { close };

  stops.push(listen(menu, 'keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      items[nextIndex(Math.max(0, items.indexOf(document.activeElement)), items.length, event.key)].focus();
    }
  }));
  // a click outside closes it; a click on the button itself toggles it (above)
  stops.push(listen(document, 'pointerdown', (event) => {
    if (!menu.contains(event.target) && !button.contains(event.target)) close(false);
  }, true));
  stops.push(listen(globalThis, 'resize', () => close(false)));
  items[Math.max(0, LANGUAGES.indexOf(lang))].focus();
}
