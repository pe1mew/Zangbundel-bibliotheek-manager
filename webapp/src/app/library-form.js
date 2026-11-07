// SPDX-License-Identifier: Apache-2.0
// The library's own fields in the left bar (webappGUI GD-22, GD-37; FDS EDT-13, EDT-14, EDT-30;
// implementationPlan M5.4): title, description, licence and maintainer. A field is applied when it
// changes (on leaving it); the session rechecks the library, and the worker's findings mark the
// fields they are about, so the rules live in one place (the engine). The form is built once per
// library and language and then only updated, so a re-render never takes text from under the cursor.

import { el, icon, listen, toggleClass } from './dom.js';
import { LANGUAGES, t } from './i18n.js';
import { messageFor } from './check.js';
import { LICENSE_ID } from '../core/manifest.js';

/** EDT-13: the short list of common licences, each with its summary in the interface language. */
export const LICENSES = [
  { id: 'CC-BY-NC-4.0', summary: 'licCcByNc' },
  { id: 'CC-BY-SA-4.0', summary: 'licCcBySa' },
  { id: 'CC0-1.0', summary: 'licCc0' },
  { id: 'mixed', summary: 'licMixed' },
  { id: 'proprietary', summary: 'licProprietary' },
];
const OTHER = 'other';
const common = (id) => LICENSES.find((l) => l.id === id);

/** A summary the user has not written: empty, or a common licence's summary in any language. */
function isPresetSummary(summary) {
  return !summary || LICENSES.some((l) => LANGUAGES.some((lang) => t(lang, l.summary) === summary));
}

/**
 * EDT-13: the licence after choosing id in the list. A common licence brings its summary unless the
 * user wrote one; the full text, if any, stays. '' (no choice) is no licence.
 */
export function chooseLicense(current, id, lang) {
  if (!id) return null;
  const cur = current || {};
  const preset = common(id);
  const summary = preset && isPresetSummary(cur.summary) ? t(lang, preset.summary) : (cur.summary || '');
  return licenseOf(id, summary, cur.text);
}

/** The licence object in the manifest's order; an empty full text is left out. */
export function licenseOf(id, summary, text) {
  const lic = { id, summary };
  if (text) lic.text = text;
  return lic;
}

/** EDT-14: the maintainer from its three fields; an empty field is left out, all empty is none. */
export function maintainerOf(name, email, url) {
  if (!name && !email && !url) return null;
  const m = { name };
  if (email) m.email = email;
  if (url) m.url = url;
  return m;
}

/** The form fields a finding is about: MAN-07 the licence, MAN-08 the maintainer, MAN-02 by its reasons. */
export function fieldsOf(finding) {
  if (finding.code === 'MAN-07') return ['license'];
  if (finding.code === 'MAN-08') return ['maintainer'];
  if (finding.code !== 'MAN-02') return [];
  const out = [];
  for (const reason of String(finding.detail || '').split('; ')) {
    const m = /^(title|description|license\.id|license\.summary|license\.text|maintainer)\b/.exec(reason);
    if (m) out.push({ title: 'title', description: 'description', 'license.id': 'license', 'license.summary': 'summary',
      'license.text': 'licenseText', maintainer: 'maintainer' }[m[1]]);
  }
  return out;
}

/**
 * createLibraryForm({ lang, library, readOnly, onChange(patch) }) → { node, update(state) }.
 * onChange gets { title } | { description } | { license } | { maintainer }; undefined removes a field.
 */
export function createLibraryForm({ lang, library, readOnly, onChange }) {
  const lic = library.license || null;
  const mt = library.maintainer || {};
  const choice = !lic || !lic.id ? '' : common(lic.id) ? lic.id : OTHER;
  const disabled = Boolean(readOnly);
  const errors = {};                                      // field -> its error line
  const boxes = {};                                       // field -> its .field wrapper

  const errLine = (name) => (errors[name] = el('div', { class: 'err', role: 'alert' }, []));
  const box = (name, children) => (boxes[name] = el('div', { class: 'field' }, [...children, errLine(name)]));
  const label = (id, text, required) => el('label', { for: id }, [text, required ? el('span', { class: 'req', 'aria-hidden': 'true' }, [' *']) : null]);
  const input = (id, value, attrs = {}) => el('input', { id, type: 'text', value: value || '', disabled, autocomplete: 'off', ...attrs }, []);
  const area = (id, value, attrs = {}) => el('textarea', { id, disabled, ...attrs }, [value || '']);

  const title = input('lib-title', library.title, { maxlength: 80, 'aria-required': 'true' });
  const description = area('lib-description', library.description, { maxlength: 1000, rows: 3 });
  const select = el('select', { id: 'lib-license', disabled, 'aria-required': 'true' }, [
    el('option', { value: '', selected: choice === '' }, [t(lang, 'chooseLicense')]),
    ...LICENSES.map((l) => el('option', { value: l.id, selected: choice === l.id }, [l.id])),
    el('option', { value: OTHER, selected: choice === OTHER }, [t(lang, 'licenseOther')]),
  ]);
  const licenseId = input('lib-license-id', choice === OTHER ? lic.id : '', { spellcheck: 'false', maxlength: 100 });
  const otherBox = box('licenseId', [label('lib-license-id', t(lang, 'fLicenseId'), true), licenseId]);
  const summary = area('lib-summary', lic ? lic.summary : '', { maxlength: 200, rows: 2, 'aria-required': 'true' });
  const text = area('lib-license-text', lic ? lic.text : '', { maxlength: 32000, rows: 3 });
  const mName = input('lib-mname', mt.name, { maxlength: 100, 'aria-required': 'true' });
  const mEmail = input('lib-memail', mt.email, { type: 'email', maxlength: 254, inputmode: 'email' });
  const mUrl = input('lib-murl', mt.url, { type: 'url', maxlength: 2000, inputmode: 'url', placeholder: 'https://' });

  const showOther = (on) => { otherBox.hidden = !on; };
  showOther(choice === OTHER);
  const setError = (name, message) => {
    toggleClass(boxes[name], 'invalid', Boolean(message));
    errors[name].replaceChildren(...(message ? [icon('error', 'sev sev-error'), message] : []));
  };

  // the current licence from the fields, for a change of one of them
  const currentLicense = () => {
    const id = select.value === OTHER ? licenseId.value.trim() : select.value;
    if (!id && !summary.value.trim() && !text.value.trim()) return null;
    return licenseOf(id, summary.value.trim(), text.value.trim());
  };

  if (!disabled) {
    listen(title, 'change', () => {
      const v = title.value.trim();
      if (!v) {
        setError('title', t(lang, 'errTitleEmpty'));
        return;
      }
      setError('title', null);
      onChange({ title: v });
    });
    listen(description, 'change', () => onChange({ description: description.value.trim() || undefined }));
    listen(select, 'change', () => {
      if (select.value === OTHER) {
        showOther(true);
        licenseId.focus();
        return;
      }
      showOther(false);
      setError('licenseId', null);
      const next = chooseLicense(currentLicense(), select.value, lang);
      if (next) summary.value = next.summary;
      onChange({ license: next });
    });
    listen(licenseId, 'change', () => {
      const v = licenseId.value.trim();
      if (v && !LICENSE_ID.test(v)) {
        setError('licenseId', t(lang, 'errLicenseId'));
        return;
      }
      setError('licenseId', null);
      onChange({ license: currentLicense() });
    });
    for (const f of [summary, text]) listen(f, 'change', () => onChange({ license: currentLicense() }));
    for (const f of [mName, mEmail, mUrl]) {
      listen(f, 'change', () => onChange({ maintainer: maintainerOf(mName.value.trim(), mEmail.value.trim(), mUrl.value.trim()) }));
    }
  }

  const node = el('div', { class: 'libform' }, [
    el('h3', {}, [t(lang, 'library')]),
    box('title', [label('lib-title', t(lang, 'fTitle'), true), title]),
    box('description', [label('lib-description', t(lang, 'fDescription')), description]),
    box('license', [label('lib-license', t(lang, 'fLicense'), true), select]),
    otherBox,
    box('summary', [label('lib-summary', t(lang, 'fSummary'), true), summary]),
    box('licenseText', [label('lib-license-text', t(lang, 'fLicenseText')), text]),
    el('h3', {}, [t(lang, 'fMaintainer')]),
    box('maintainer', [label('lib-mname', t(lang, 'fMaintName'), true), mName]),
    el('div', { class: 'field' }, [label('lib-memail', t(lang, 'fMaintEmail')), mEmail]),
    el('div', { class: 'field' }, [label('lib-murl', t(lang, 'fMaintUrl')), mUrl]),
    el('p', { class: 'muted small' }, [t(lang, 'maintOneOf'), ' ', t(lang, 'maintNote')]),
  ]);

  return {
    node,
    /** The worker's findings mark their fields (EDT-42); the form's own input checks stay until fixed. */
    update(state) {
      const marked = {};
      for (const f of state.findings || []) for (const name of fieldsOf(f)) marked[name] ??= messageFor(lang, f);
      for (const name of ['description', 'license', 'summary', 'licenseText', 'maintainer']) setError(name, marked[name] || null);
      if (marked.title) setError('title', marked.title);
    },
  };
}
