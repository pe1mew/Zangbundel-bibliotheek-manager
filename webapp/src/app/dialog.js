// SPDX-License-Identifier: Apache-2.0
// Modal dialogs (webappGUI GD-14, GD-15, GD-23; implementationPlan M4.4), on the browser's own
// <dialog> with showModal(): it keeps keyboard focus inside, closes on Escape and draws its own
// backdrop. Built with dom.js like everything else; one dialog at a time. Focus returns to the
// element that opened it.

import { el, icon, listen } from './dom.js';

let currentClose = null;

/** Close the open dialog, if any. */
export function closeDialog() {
  if (currentClose) currentClose();
}

/**
 * Open a modal dialog: openDialog({ title, sub, logo, wide, closeLabel, actions }, children). A click
 * on the backdrop closes it, as Escape does. actions: [{ label, primary, onClick(close) }], drawn after
 * the close button; with actions, closeLabel is the cancel button. Focus starts in the first field, else
 * on the primary button. Returns { dlg, close }: close() takes the dialog out of the page at once, so a
 * dialog opened next never finds this one still there (the browser's own close event comes later).
 */
export function openDialog({ title, sub, logo = false, wide = false, closeLabel, actions = [] }, children) {
  closeDialog();
  const opener = document.activeElement;
  const head = el('div', { class: 'dlghead' }, [
    logo ? el('div', { class: 'logo small', 'aria-hidden': 'true' }) : null,
    el('div', {}, [el('h2', { id: 'dlgtitle' }, [title]), sub ? el('p', { class: 'muted' }, [sub]) : null]),
  ]);
  const closeBtn = el('button', { type: 'button', class: actions.length ? 'btn btn-text' : 'btn btn-primary', on: { click: () => close() } }, [closeLabel]);
  const actionBtns = actions.map((a) => el('button', { type: 'button', class: a.primary ? 'btn btn-primary' : 'btn btn-outline',
    on: { click: () => a.onClick(close) } }, [a.label]));
  const corner = el('button', { type: 'button', class: 'iconbtn dlgx', 'aria-label': closeLabel, title: closeLabel,
    on: { click: () => close() } }, [icon('close')]);
  // the content sits in .dlgbody, which carries the padding, so only the backdrop has the dialog as target
  const dlg = el('dialog', { class: wide ? 'dialog wide' : 'dialog', 'aria-labelledby': 'dlgtitle' }, [
    el('div', { class: 'dlgbody' }, [corner, head, ...children, el('div', { class: 'buttons' }, [closeBtn, ...actionBtns])]),
  ]);
  let done = false;
  const cleanup = () => {                                // once, whether closed here or by Escape
    if (done) return;
    done = true;
    stops.forEach((stop) => stop());
    dlg.remove();
    if (currentClose === close) currentClose = null;
    if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
  };
  function close() {
    if (dlg.open) dlg.close();
    cleanup();
  }
  const stops = [
    // a click whose target is the <dialog> itself landed on the backdrop, outside its content
    listen(dlg, 'click', (event) => { if (event.target === dlg) close(); }),
    listen(dlg, 'close', cleanup),                     // Escape closes it the browser's way
  ];
  document.body.append(dlg);
  currentClose = close;
  dlg.showModal();
  const field = dlg.querySelector('input:not([type=file]), textarea');
  (field || actionBtns.find((b, i) => actions[i].primary) || closeBtn).focus();
  return { dlg, close };
}
