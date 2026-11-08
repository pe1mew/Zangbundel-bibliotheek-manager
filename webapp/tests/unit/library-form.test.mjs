// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/library-form.js (webappGUI GD-22, GD-37; FDS EDT-13, EDT-14, EDT-30;
// implementationPlan M5.4) with a stand-in document, as in dom.test.mjs, that also keeps values,
// classes and children. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag, ns) {
    Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {}, classes: new Set(), hidden: false, focused: false });
    this.classList = { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)) };
  }
  setAttribute(n, v) {
    this.attrs[n] = v;
    if (n === 'class') v.split(' ').forEach((c) => this.classes.add(c));
    if (n === 'value') this.value = v;
  }
  removeAttribute(n) { delete this.attrs[n]; }
  append(...c) {
    this.children.push(...c);
    if (this.tag === 'textarea') this.value = c.map((x) => x.text ?? '').join('');
  }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  focus() { this.focused = true; }
}
globalThis.document = {
  createElement: (t) => new FakeNode(t),
  createElementNS: (ns, t) => new FakeNode(t, ns),
  createTextNode: (s) => ({ text: s }),
};
const { chooseLicense, contactOf, createLibraryForm, fieldsOf, LICENSES, licenseOf, maintainerOf, otherContactOf } = await import('../../src/app/library-form.js');

function* walk(n) {
  yield n;
  for (const c of n.children || []) if (c && typeof c === 'object' && 'tag' in c) yield* walk(c);
}
const byId = (root, id) => [...walk(root)].find((n) => n.attrs.id === id);
const textOf = (n) => [...walk(n)].flatMap((x) => x.children).map((c) => (typeof c === 'string' ? c : c && c.text) || '').join('');
const boxOf = (root, id) => [...walk(root)].find((n) => n.classes.has('field') && n.children.some((c) => c.attrs && c.attrs.id === id));

test('EDT-13: the common licences bring their summary; a summary the user wrote stays; no choice is no licence', () => {
  assert.deepEqual(LICENSES.map((l) => l.id), ['CC-BY-NC-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'mixed', 'proprietary']);
  const cc0 = chooseLicense(null, 'CC0-1.0', 'nl');
  assert.deepEqual(cc0, { id: 'CC0-1.0', summary: 'Vrij van rechten: alles mag.' });
  assert.equal(chooseLicense(cc0, 'mixed', 'nl').summary, 'Elk lied heeft zijn eigen licentie.');   // a preset follows
  assert.equal(chooseLicense({ id: 'CC0-1.0', summary: 'No rights reserved: anything goes.' }, 'mixed', 'nl').summary,
    'Elk lied heeft zijn eigen licentie.');                                                         // in any language
  const own = { id: 'CC0-1.0', summary: 'Mag alles, behalve verkopen.', text: 'Volledige tekst.' };
  assert.deepEqual(chooseLicense(own, 'CC-BY-SA-4.0', 'nl'), { id: 'CC-BY-SA-4.0', summary: 'Mag alles, behalve verkopen.', text: 'Volledige tekst.' });
  assert.equal(chooseLicense(own, '', 'nl'), null);
  assert.deepEqual(licenseOf('MIT', 'Kort.', ''), { id: 'MIT', summary: 'Kort.' });
});

test('EDT-14, GD-37: one contact field; a scheme makes it the website, else the e-mail address; all empty is none', () => {
  assert.deepEqual(maintainerOf(null, 'Leiding', 'leiding@example.org'), { name: 'Leiding', email: 'leiding@example.org' });
  assert.deepEqual(maintainerOf(null, 'Leiding', 'https://example.org'), { name: 'Leiding', url: 'https://example.org' });
  assert.deepEqual(maintainerOf(null, 'Leiding', 'http://example.org'), { name: 'Leiding', url: 'http://example.org' });   // MAN-08 says https
  assert.deepEqual(maintainerOf(null, '', 'https://example.org'), { name: '', url: 'https://example.org' });   // MAN-08 says the name
  assert.equal(maintainerOf(null, '', ''), null);
  const email = { name: 'Leiding', email: 'a@example.org' };
  assert.deepEqual(maintainerOf(email, 'Leiding', 'https://example.org'), { name: 'Leiding', url: 'https://example.org' });   // replaced
});

test('GD-37: a maintainer with both contacts shows the e-mail address; the website stays and is listed, never dropped', () => {
  const both = { name: 'Leiding', email: 'a@example.org', url: 'https://example.org' };
  assert.equal(contactOf(both), 'a@example.org');
  assert.equal(otherContactOf(both), 'https://example.org');
  assert.equal(contactOf({ name: 'x', url: 'https://example.org' }), 'https://example.org');
  assert.equal(otherContactOf({ name: 'x', url: 'https://example.org' }), '');
  assert.deepEqual(maintainerOf(both, 'Leiding Troep 12', 'a@example.org'), { name: 'Leiding Troep 12', email: 'a@example.org', url: 'https://example.org' });
  assert.deepEqual(maintainerOf(both, 'Leiding', 'b@example.org'), { name: 'Leiding', email: 'b@example.org', url: 'https://example.org' });
  assert.deepEqual(maintainerOf(both, 'Leiding', 'https://new.example.org'), { name: 'Leiding', url: 'https://new.example.org' });
  assert.deepEqual(maintainerOf(both, 'Leiding', ''), { name: 'Leiding', url: 'https://example.org' });
});

test('the worker\'s findings say which field they are about', () => {
  assert.deepEqual(fieldsOf({ code: 'MAN-07' }), ['license']);
  assert.deepEqual(fieldsOf({ code: 'MAN-08' }), ['maintainer', 'contact']);
  assert.deepEqual(fieldsOf({ code: 'MAN-02', detail: 'title is not 1–80 characters; license.text is not a string of at most 32,000 characters' }),
    ['title', 'licenseText']);
  assert.deepEqual(fieldsOf({ code: 'MAN-02', detail: 'sets is not an array' }), []);
  assert.deepEqual(fieldsOf({ code: 'SNG-07' }), []);
});

const LIB = { title: 'Kampvuur', description: 'Voor de Bevers', license: null, maintainer: null };

test('GD-22, GD-37: the fields apply on change; an empty title or a bad SPDX code is refused in the field', () => {
  const patches = [];
  const form = createLibraryForm({ lang: 'nl', library: LIB, readOnly: false, onChange: (p) => patches.push(p) });
  const change = (id, value) => { const n = byId(form.node, id); n.value = value; n.listeners.change(); };
  change('lib-title', '  ');
  assert.deepEqual(patches, []);
  assert.ok(boxOf(form.node, 'lib-title').classes.has('invalid'));
  change('lib-title', ' Kampvuurliedjes ');
  assert.deepEqual(patches.at(-1), { title: 'Kampvuurliedjes' });
  assert.ok(!boxOf(form.node, 'lib-title').classes.has('invalid'));
  change('lib-description', '');
  assert.deepEqual(patches.at(-1), { description: undefined });
  change('lib-license', 'CC-BY-SA-4.0');
  assert.deepEqual(patches.at(-1), { license: { id: 'CC-BY-SA-4.0', summary: 'Vrij te delen en te bewerken, met naamsvermelding, onder dezelfde licentie.' } });
  assert.equal(byId(form.node, 'lib-summary').value, patches.at(-1).license.summary);   // the summary field follows
  const n = patches.length;
  change('lib-license', 'other');                            // EDT-13: another SPDX identifier
  assert.equal(patches.length, n);
  assert.ok(byId(form.node, 'lib-license-id').focused);
  change('lib-license-id', 'not an id');
  assert.equal(patches.length, n);
  change('lib-license-id', 'MIT');
  assert.deepEqual(patches.at(-1), { license: { id: 'MIT', summary: 'Vrij te delen en te bewerken, met naamsvermelding, onder dezelfde licentie.' } });
  change('lib-mname', 'Leiding Troep 12');
  change('lib-mcontact', 'https://troep12.example.org');
  assert.deepEqual(patches.at(-1), { maintainer: { name: 'Leiding Troep 12', url: 'https://troep12.example.org' } });
});

test('GD-37: findings mark their fields with the FDS message; fixed, the mark goes', () => {
  const form = createLibraryForm({ lang: 'nl', library: LIB, readOnly: false, onChange() {} });
  form.update({ findings: [{ code: 'MAN-07', severity: 'Error' }, { code: 'MAN-08', severity: 'Error' }] });
  const lic = boxOf(form.node, 'lib-license');
  const mt = boxOf(form.node, 'lib-mname');
  const contact = boxOf(form.node, 'lib-mcontact');
  assert.ok(lic.classes.has('invalid') && mt.classes.has('invalid') && contact.classes.has('invalid'));
  assert.match(textOf(mt), /Vul in wie deze bibliotheek beheert/);    // M-39
  form.update({ findings: [], library: { ...LIB, maintainer: { name: 'L', email: 'a@example.org', url: 'https://example.org' } } });
  assert.ok(!lic.classes.has('invalid') && !mt.classes.has('invalid') && !contact.classes.has('invalid'));
  assert.match(textOf(contact), /Ook: https:\/\/example\.org/);
});

test('EDT-23, F13: a read-only library shows its fields as values, as the song data does, with no inputs', () => {
  const library = { title: 'Ondertekend', description: 'Regel 1\nRegel 2', license: { id: 'MIT', summary: 'Kort.', text: 'De hele tekst.' },
    maintainer: { name: 'Akela', email: 'akela@example.org', url: 'https://example.org' } };
  const form = createLibraryForm({ lang: 'nl', library, readOnly: true, onChange() { throw new Error('no change expected'); } });
  assert.equal([...walk(form.node)].filter((x) => ['input', 'textarea', 'select', 'button'].includes(x.tag)).length, 0);
  const text = textOf(form.node);
  for (const v of ['Ondertekend', 'Regel 1\nRegel 2', 'MIT', 'Kort.', 'De hele tekst.', 'Akela', 'akela@example.org · https://example.org']) {
    assert.ok(text.includes(v), v);
  }
  form.update({ library, findings: [] });                                     // nothing to update
  const bare = createLibraryForm({ lang: 'nl', library: { title: 'Kaal' }, readOnly: true, onChange() {} });
  assert.match(textOf(bare.node), /niet ingevuld/);                           // an empty field says so
  assert.ok(!textOf(bare.node).includes('Volledige licentietekst'));          // no licence text: no field for it
});
