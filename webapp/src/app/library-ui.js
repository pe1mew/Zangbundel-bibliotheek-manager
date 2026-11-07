// SPDX-License-Identifier: Apache-2.0
// The screens of opening, starting and closing a library (FDS 7.2, 7.3, M-41, M-42, M-60; webappGUI
// GD-23, GD-28; implementationPlan M6.1). They ask and report; session.js does the work.

import { el, listen } from './dom.js';
import { openDialog } from './dialog.js';
import { t, tParts } from './i18n.js';
import { messageFor } from './check.js';
import { sizeText } from './download.js';

/**
 * GD-28: the computer's file picker. The file is read in the browser and stays on this computer
 * (TD-06); onFile(file) gets the chosen File. No URL and no clipboard (SR-45 applies to keys alike).
 */
export function pickFile(onFile, accept = '.zbl,.zip,application/zip') {
  const input = el('input', { type: 'file', accept, hidden: true }, []);
  const stop = listen(input, 'change', () => {
    stop();
    input.remove();
    if (input.files && input.files[0]) onFile(input.files[0]);
  });
  document.body.append(input);                         // some browsers open the picker only for an attached input
  input.click();
}

/** EDT-20: what stopped the opening, in the FDS's messages (M-01 to M-05, M-21, M-22, ...). */
export function openFailedDialog(lang, fileName, findings) {
  return openDialog({ title: t(lang, 'openFailedTitle'), sub: fileName, closeLabel: t(lang, 'close') },
    findings.length ? findings.map((f) => el('p', {}, [messageFor(lang, f)])) : [el('p', {}, [t(lang, 'openError')])]);
}

/** EDT-25, EDT-26: what a conversion took over and what it left out (M-41, M-42). */
export function convertedDialog(lang, report) {
  const list = (names) => names.slice(0, 12).join(', ') + (names.length > 12 ? ', …' : '');
  return openDialog({ title: t(lang, 'convertedTitle'), closeLabel: t(lang, 'close') }, [
    el('p', {}, [t(lang, 'M41', { songs: report.songs, sets: report.sets })]),
    report.leftOut && report.leftOut.length ? el('p', {}, [t(lang, 'M42', { count: report.leftOut.length, names: list(report.leftOut) })]) : null,
    report.unresolved && report.unresolved.length
      ? el('p', {}, [t(lang, 'unresolvedLeftOut', { names: list(report.unresolved.map((u) => `${u.set}: ${u.entry}`)) })]) : null,
    report.tagsLeftOut && report.tagsLeftOut.length ? el('p', {}, [t(lang, 'tagsLeftOut', { names: list(report.tagsLeftOut) })]) : null,
    el('p', { class: 'muted small' }, [t(lang, 'licenseLater')]),
  ]);
}

/** EDT-10: a title of at most 80 characters (FDS 4.1) and an optional description. */
export function newLibraryDialog(lang, onCreate) {
  const title = el('input', { id: 'nl-title', type: 'text', maxlength: 80, autocomplete: 'off', placeholder: t(lang, 'phLibTitle') }, []);
  const desc = el('textarea', { id: 'nl-desc', rows: 3, maxlength: 1000 }, []);
  const go = (close) => {
    const value = title.value.trim();
    if (!value) {
      title.focus();
      return;
    }
    close();
    onCreate(value, desc.value.trim());
  };
  const opened = openDialog({ title: t(lang, 'newLibTitle'), closeLabel: t(lang, 'cancel'),
    actions: [{ label: t(lang, 'create'), primary: true, onClick: go }] }, [
    el('div', { class: 'field' }, [el('label', { for: 'nl-title' }, [t(lang, 'titleLabel')]), title]),
    el('div', { class: 'field' }, [el('label', { for: 'nl-desc' }, [`${t(lang, 'descLabel')} (${t(lang, 'optional')})`]), desc]),
    el('p', { class: 'muted small' }, [t(lang, 'licenseLater')]),
  ]);
  listen(title, 'keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); go(opened.close); } });
  return opened;
}

/** EDT-03, M-60: closing with changes not yet downloaded asks first. */
export function closeConfirm(lang, onClose) {
  return openDialog({ title: t(lang, 'closeTitle'), closeLabel: t(lang, 'cancel'),
    actions: [{ label: t(lang, 'closeAnyway'), primary: true, onClick: (close) => { close(); onClose(); } }] },
  [el('p', {}, [t(lang, 'closeText')])]);
}

/** EDT-22, M-61: a library whose files differ from its manifest is saved anew; ask first. */
export function manifestConfirm(lang, onContinue) {
  return openDialog({ title: t(lang, 'dlTitle'), closeLabel: t(lang, 'cancel'),
    actions: [{ label: t(lang, 'continue'), primary: true, onClick: (close) => { close(); onContinue(); } }] },
  [el('p', {}, [t(lang, 'M61')])]);
}

/**
 * GD-23, GD-24, FDS 7.6 to 7.8: the download dialog. preview comes from session.preview(); key is the
 * loaded key or null. onDownload(note) saves; onSign(on) asks for a new preview with signing on or off;
 * onCopy() starts *Opslaan als kopie*, always offered (EDT-70); onCheck opens *Controle*.
 */
export function downloadDialog(lang, preview, key, { onDownload, onCheck, onSign, onCopy }) {
  const note = preview.changed && !preview.blocked
    ? el('textarea', { id: 'dl-note', rows: 3, maxlength: 500, placeholder: t(lang, 'dlNotePh') }, []) : null;
  const sign = preview.canSign && key
    ? el('input', { type: 'checkbox', id: 'dl-sign', checked: preview.sign, disabled: preview.mustSign,
      on: { change: (event) => onSign(event.target.checked) } }, []) : null;
  const main = preview.readOnly ? []
    : preview.blocked ? [{ label: t(lang, 'openCheck'), primary: true, onClick: (close) => { close(); onCheck(); } }]
      : [{ label: t(lang, 'download'), primary: true, onClick: (close) => { const text = note ? note.value.trim() : ''; close(); onDownload(text); } }];
  const actions = [{ label: t(lang, 'saveCopy'), onClick: (close) => { close(); onCopy(); } }, ...main];
  return openDialog({ title: t(lang, 'dlTitle'), closeLabel: t(lang, 'cancel'), actions }, [
    el('p', {}, [...tParts(lang, 'dlFile', { file: el('b', {}, [preview.fileName]) }), ' ',
      t(lang, preview.changed ? 'dlVersion' : 'dlUnchanged', { v: preview.version })]),
    sign ? el('label', { class: 'ack', for: 'dl-sign' }, [sign, t(lang, 'dlSign', { name: key.name, fp: key.fingerprint })]) : null,
    preview.mustSign ? el('p', { class: 'muted small' }, [t(lang, 'dlSignedKeep')]) : null,
    note ? el('div', { class: 'field' }, [el('label', { for: 'dl-note' }, [t(lang, 'dlNote')]), note]) : null,
    preview.readOnly ? el('p', { class: 'blocked' }, [t(lang, 'dlReadOnly')])
      : preview.blocked ? el('p', { class: 'blocked' }, [t(lang, 'dlErrors')]) : null,
  ]);
}

/** EDT-70, EDT-71: *Opslaan als kopie*: the copy's title, proposed as <title> (kopie), at most 80 characters. */
export function copyDialog(lang, title, onCopy) {
  const proposed = `${[...title].slice(0, 80 - 1 - [...t(lang, 'copySuffix')].length).join('').trimEnd()} ${t(lang, 'copySuffix')}`;
  const input = el('input', { id: 'cp-title', type: 'text', maxlength: 80, autocomplete: 'off', value: proposed }, []);
  const go = (close) => {
    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }
    close();
    onCopy(value);
  };
  return openDialog({ title: t(lang, 'copyTitle'), closeLabel: t(lang, 'cancel'),
    actions: [{ label: t(lang, 'saveCopy'), primary: true, onClick: go }] }, [
    el('p', {}, [t(lang, 'copyText')]),
    el('div', { class: 'field' }, [el('label', { for: 'cp-title' }, [t(lang, 'titleLabel')]), input]),
  ]);
}

/** EDT-60, EDT-62: a key file that was refused, in the FDS's words (M-30, M-31). */
export function keyFailedDialog(lang, result) {
  const text = result.message === 'M-30' ? t(lang, 'M30') : result.message === 'selftest' ? t(lang, 'keySelftest') : t(lang, 'M31');
  return openDialog({ title: t(lang, 'keyFailedTitle'), closeLabel: t(lang, 'close') }, [el('p', {}, [text])]);
}

/** EDT-56: what was saved, its size, and above the sharing threshold M-08 (PKG-09). */
export function savedDialog(lang, saved) {
  const sharing = (saved.findings || []).find((f) => f.code === 'PKG-09');
  return openDialog({ title: t(lang, 'dlTitle'), closeLabel: t(lang, 'close') }, [
    el('p', {}, [t(lang, 'dlSaved', { file: saved.fileName, size: sizeText(saved.bytes.length) })]),
    sharing ? el('p', { class: 'blocked' }, [messageFor(lang, sharing)]) : null,
  ]);
}

/** A save the worker refused: its findings in the FDS's messages, or its reason. */
export function saveFailedDialog(lang, result) {
  const errors = (result.findings || []).filter((f) => f.severity === 'Error' || f.severity === 'Fatal');
  return openDialog({ title: t(lang, 'dlFailed'), closeLabel: t(lang, 'close') },
    errors.length ? errors.map((f) => el('p', {}, [messageFor(lang, f)])) : [el('p', {}, [String(result.reason || t(lang, 'openError'))])]);
}
