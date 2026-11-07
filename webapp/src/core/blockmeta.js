// SPDX-License-Identifier: Apache-2.0
// The metadata part of the block form (core/blocks.js; FDS EDT-34, webappGUI GD-05; implementationPlan
// M5.3c): reading and setting a song's metadata fields, and whether a value fits in a directive. No
// imports and no parsing, so the page can use it to edit the song's fields in the left bar (SR-30).

/** Why a section label, a repeat label or a metadata value cannot be written in a directive, or null (5.3). */
export function valueProblem(value) {
  if (typeof value !== 'string') return 'not text';
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return 'control character';
  if (/[{}]/.test(value)) return 'brace';
  if (value !== value.trim()) return 'spaces at an end';
  return null;
}

/** EDT-34, GD-05: the values of a metadata field, in file order. */
export function metaValues({ blocks }, name) {
  return blocks.filter((b) => b.type === 'meta' && b.name === name).map((b) => b.value);
}

/**
 * EDT-34, GD-05: set a metadata field to values (none removes it). The first existing line of the field
 * keeps its place and the others follow it; a new field goes after the last metadata line of the
 * song's head (the metadata before the first other block), or first.
 */
export function setMeta(form, name, values) {
  const blocks = form.blocks.slice();
  const at = blocks.findIndex((b) => b.type === 'meta' && b.name === name);
  const kept = blocks.filter((b) => !(b.type === 'meta' && b.name === name));
  let insert;
  if (at >= 0) insert = blocks.slice(0, at).filter((b) => !(b.type === 'meta' && b.name === name)).length;
  else {
    insert = 0;
    while (insert < kept.length && kept[insert].type === 'meta') insert += 1;
  }
  const fresh = values.map((value, k) => {
    const old = at >= 0 && k === 0 ? blocks[at] : null;
    return old ? { ...old, value } : { type: 'meta', name, value, blank: 0 };
  });
  kept.splice(insert, 0, ...fresh);
  return { ...form, blocks: kept };
}
