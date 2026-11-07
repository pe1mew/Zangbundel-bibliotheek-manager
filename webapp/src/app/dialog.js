// SPDX-License-Identifier: Apache-2.0
// Modal dialogs (webappGUI GD-14, GD-15, GD-23; implementationPlan M4.4), on the browser's own
// <dialog> with showModal(): it keeps keyboard focus inside, closes on Escape and draws its own
// backdrop. Built with dom.js like everything else; one dialog at a time. Focus returns to the
// element that opened it.

import { el, icon, listen } from './dom.js';

let current = null;

/** Close the open dialog, if any. */
export function closeDialog() {
  if (current) current.close();
}

/**
 * Open a modal dialog: openDialog({ title, sub, logo, wide, closeLabel }, children). A click on the
 * backdrop closes it, as Escape does. Returns the <dialog> element.
 */
export function openDialog({ title, sub, logo = false, wide = false, closeLabel }, children) {
  closeDialog();
  const opener = document.activeElement;
  const head = el('div', { class: 'dlghead' }, [
    logo ? el('div', { class: 'logo small', 'aria-hidden': 'true' }) : null,
    el('div', {}, [el('h2', { id: 'dlgtitle' }, [title]), sub ? el('p', { class: 'muted' }, [sub]) : null]),
  ]);
  const closeBtn = el('button', { type: 'button', class: 'btn btn-primary', on: { click: () => dlg.close() } }, [closeLabel]);
  const corner = el('button', { type: 'button', class: 'iconbtn dlgx', 'aria-label': closeLabel, title: closeLabel,
    on: { click: () => dlg.close() } }, [icon('close')]);
  // the content sits in .dlgbody, which carries the padding, so only the backdrop has the dialog as target
  const dlg = el('dialog', { class: wide ? 'dialog wide' : 'dialog', 'aria-labelledby': 'dlgtitle' }, [
    el('div', { class: 'dlgbody' }, [corner, head, ...children, el('div', { class: 'buttons' }, [closeBtn])]),
  ]);
  const stops = [
    // a click whose target is the <dialog> itself landed on the backdrop, outside its content
    listen(dlg, 'click', (event) => { if (event.target === dlg) dlg.close(); }),
    listen(dlg, 'close', () => {
      stops.forEach((stop) => stop());
      dlg.remove();
      if (current === dlg) current = null;
      if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
    }),
  ];
  document.body.append(dlg);
  current = dlg;
  dlg.showModal();
  closeBtn.focus();
  return dlg;
}
