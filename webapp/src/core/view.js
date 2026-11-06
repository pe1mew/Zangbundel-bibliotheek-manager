// SPDX-License-Identifier: Apache-2.0
// The format 1.1 view of a library (FDS 3.7, PF-40 to PF-44), written from the manifest. The same
// functions give the bytes VIEW-02 compares against, so writing and checking cannot drift apart.
// Pure functions.

const enc = new TextEncoder();

/** PF-41: zangbundel.json, fields in this order, UTF-8 without BOM, LF, two-space indent. */
export function viewLibrary(m) {
  const lic = m.license || {};
  return {
    format: 'zangbundel-library',
    format_version: '1.1',
    id: m.libraryId,
    name: m.title,
    description: m.description || m.title,
    maintainer: m.maintainer,
    license: { id: lic.id, file: 'LICENSE', summary: lic.summary },
    min_app_version: '0.1.0',
  };
}

/** PF-42: LICENSE holds license.text, or license.summary, with exactly one final LF. */
export function licenseBytes(license) {
  const lic = license || {};
  const source = typeof lic.text === 'string' && lic.text ? lic.text : lic.summary;
  return typeof source === 'string' ? enc.encode(`${source.replace(/\n+$/, '')}\n`) : null;
}

/** PF-43: setlists/set-<n>.zbs. An empty set has no empty line (canonical form, FDS O-11). */
export function setlistBytes(libraryId, set, n) {
  const lines = [`{title: ${set.name}}`, `{meta: id set-${n}}`];
  if (set.songs.length) {
    lines.push('', ...set.songs.map((id) => `${libraryId}/${id}`));
  }
  return enc.encode(`${lines.join('\n')}\n`);
}

/** PF-40: every view file for a manifest-shaped object, as [path, bytes] in path order. */
export function viewFiles(m) {
  const files = [
    ['LICENSE', licenseBytes(m.license)],
    ['zangbundel.json', enc.encode(`${JSON.stringify(viewLibrary(m), null, 2)}\n`)],
  ];
  m.sets.forEach((set, i) => files.push([`setlists/set-${i + 1}.zbs`, setlistBytes(m.libraryId, set, i + 1)]));
  return files;
}
