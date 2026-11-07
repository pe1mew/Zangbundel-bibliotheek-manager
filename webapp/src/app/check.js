// SPDX-License-Identifier: Apache-2.0
// *Controle*, the validation panel (FDS EDT-40, EDT-41; webappGUI GD-20, GD-29; implementationPlan
// M4.5): every finding of the library grouped by severity with its count, each with its location
// (set, song, line) and its message, and a click on one goes there. Error and Fatal are both *Fout*.
// The findings come from the library worker (validate.js); nothing here reads library bytes.

import { el, icon } from './dom.js';
import { openDialog } from './dialog.js';
import { t } from './i18n.js';
import { MESSAGES, RULE_MESSAGE } from './messages.js';

/** GD-29: Error and Fatal are shown as *Fout*; Warning and Info as themselves. */
export const severityGroup = (severity) => (severity === 'Fatal' || severity === 'Error' ? 'error' : severity === 'Warning' ? 'warning' : 'info');
const GROUPS = [['error', 'errors', 'sevError'], ['warning', 'warnings', 'sevWarning'], ['info', 'infos', 'sevInfo']];

/** GD-29: the severity's icon, which carries its colour; the word is always shown next to it. */
export const severityIcon = (group) => icon(group === 'error' ? 'error' : group === 'warning' ? 'warning' : 'info', `sev sev-${group}`);

/** The numbers on the *Controle* button: errors (Error and Fatal) and warnings. */
export function counts(findings) {
  let e = 0;
  let w = 0;
  for (const f of findings) {
    const g = severityGroup(f.severity);
    if (g === 'error') e += 1;
    if (g === 'warning') w += 1;
  }
  return { e, w };
}

/** The last path segment: songs/vuur/vuur.cho -> vuur.cho; songs/vuur -> vuur. */
const lastSegment = (where) => String(where).split('/').filter(Boolean).pop() || String(where);

/**
 * The message of a finding in a language (FDS section 9), placeholders filled from its params, else
 * from its location; a detail the engine does not know is shown as "…", never as a placeholder.
 */
export function messageFor(lang, finding) {
  const id = RULE_MESSAGE[finding.code];
  const text = id ? (MESSAGES[lang] || MESSAGES.en)[id] : null;
  if (!text) return finding.code;
  const p = { ...(finding.params || {}) };
  const where = finding.where;
  if (where !== undefined) {
    for (const k of ['path', 'set']) if (p[k] === undefined) p[k] = where;
    if (p.name === undefined) p.name = lastSegment(where);
    if (p.folder === undefined) p.folder = lastSegment(where);
    if (p.song === undefined) p.song = where;
  }
  if (p.field) p.field = t(lang, p.field);
  if (Array.isArray(p.what)) p.what = p.what.map((w) => t(lang, `what${w[0].toUpperCase()}${w.slice(1)}`)).join(', ');
  return text.replace(/\{(\w+)\}/g, (_, k) => (p[k] === undefined || p[k] === null ? '…' : String(p[k])));
}

/** EDT-40: where a finding is: a song (with its line), a set, a file, or the library itself. */
export function locationOf(lang, finding) {
  const p = finding.params || {};
  if (p.song && /^SNG-/.test(finding.code)) return p.line ? `${p.song} · ${p.line}` : p.song;
  if (p.set) return p.set;
  if (finding.where !== undefined) return String(finding.where);
  return t(lang, 'libraryLevel');
}

/** The panel's content: the groups with their counts, or the all-clear (GD-20). */
export function checkContent(lang, findings, onGoto) {
  if (!findings.length) {
    return [el('p', { class: 'allclear' }, [icon('check', 'sev sev-ok'), t(lang, 'checkNone')])];
  }
  return GROUPS.map(([group, title, word]) => {
    const items = findings.filter((f) => severityGroup(f.severity) === group);
    if (!items.length) return null;
    return el('section', { class: 'vgroup', 'aria-label': `${t(lang, title)} (${items.length})` }, [
      el('h3', {}, [severityIcon(group), `${t(lang, title)} (${items.length})`]),
      ...items.map((f) => el('button', { type: 'button', class: 'vitem', 'data-code': f.code,
        on: { click: () => onGoto && onGoto(f) } }, [
        el('span', { class: 'vsev' }, [severityIcon(group), t(lang, word)]),
        el('span', { class: 'vwhere' }, [locationOf(lang, f)]),
        el('span', { class: 'vmsg' }, [messageFor(lang, f)]),
        el('span', { class: 'vgo', 'aria-hidden': 'true' }, [`${t(lang, 'goTo')} ›`]),
      ])),
    ]);
  }).filter(Boolean);
}

/** Open *Controle*. onGoto(finding) closes it and goes to the finding's place (EDT-41). */
export function checkDialog(lang, findings, onGoto) {
  let dlg = null;
  dlg = openDialog({ title: t(lang, 'checkTitle'), sub: t(lang, 'checkCounts', counts(findings)), wide: true, closeLabel: t(lang, 'close') },
    checkContent(lang, findings, (f) => { dlg.close(); if (onGoto) onGoto(f); }));
  return dlg;
}
