// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/zip.js and names.js: the forms of PKG-01 to PKG-04 and the name
// rules that the shared test libraries cannot hold (test-libraries/README.md, "Not covered").
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from '../../vendor/fflate-0.8.3.js';
import { crc32, LIMITS, readCentralDirectory, readEntry, ZipError } from '../../src/core/zip.js';
import { caseClashes, isIgnored, isSongId, nameProblem, pathTooLong } from '../../src/core/names.js';
import { fingerprint } from '../../src/core/fingerprint.js';

const enc = new TextEncoder();

/** A minimal ZIP writer for tests: entries { name, data, deflate?, flags?, madeBy?, external?, size?, crc? }. */
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = e.data ?? new Uint8Array(0);
    const body = e.deflate ? deflateSync(data) : data;
    const crc = e.crc ?? crc32(data);
    const size = e.size ?? data.length;
    const flags = (e.flags ?? 0) | 0x800;
    const method = e.deflate ? 8 : 0;
    const local = new Uint8Array(30 + name.length + body.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, flags, true); lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, body.length, true); lv.setUint32(22, size, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(body, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, ((e.madeBy ?? 3) << 8) | 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true); cv.setUint16(10, method, true); cv.setUint32(16, crc, true); cv.setUint32(20, body.length, true);
    cv.setUint32(24, size, true); cv.setUint16(28, name.length, true); cv.setUint32(38, e.external ?? (0o100644 << 16) >>> 0, true);
    cv.setUint32(42, offset, true); central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

const fatal = (bytes, code, where) => {
  assert.throws(() => {
    const entries = readCentralDirectory(bytes);
    for (const e of entries) if (!e.dir) readEntry(bytes, e);
  }, (err) => err instanceof ZipError && err.code === code && (where === undefined || err.where === where));
};

test('a well-formed ZIP reads back, stored and deflated', () => {
  const text = enc.encode('Vader Jacob\n'.repeat(40));
  const zip = makeZip([{ name: 'lib/a.txt', data: text }, { name: 'lib/b.txt', data: text, deflate: true }]);
  const entries = readCentralDirectory(zip);
  assert.deepEqual(entries.map((e) => e.name), ['lib/a.txt', 'lib/b.txt']);
  for (const e of entries) assert.deepEqual(readEntry(zip, e), text);
});

test('PKG-01: not a ZIP, a cut-off ZIP, a CRC mismatch', () => {
  fatal(enc.encode('not a zip at all'), 'PKG-01');
  const zip = makeZip([{ name: 'lib/a.txt', data: enc.encode('x') }]);
  fatal(zip.subarray(0, zip.length - 5), 'PKG-01');
  fatal(makeZip([{ name: 'lib/a.txt', data: enc.encode('x'), crc: 12345 }]), 'PKG-01', 'lib/a.txt');
});

test('PKG-01: a bomb that declares a small size is never inflated past it', () => {
  const big = new Uint8Array(4 * 1024 * 1024);              // 4 MiB of zeros, deflates to a few KiB
  fatal(makeZip([{ name: 'lib/bomb.txt', data: big, deflate: true, size: 1000 }]), 'PKG-01', 'lib/bomb.txt');
});

test('PKG-02: the ratio, from the central directory, before inflating', () => {
  const big = new Uint8Array(2 * 1024 * 1024);
  fatal(makeZip([{ name: 'lib/a.txt', data: big, deflate: true }]), 'PKG-02');
  assert.equal(LIMITS.ratio, 20);
});

test('PKG-02: more than 10,000 entries', () => {
  const entries = Array.from({ length: LIMITS.entries + 1 }, (_, i) => ({ name: `lib/f${i}` }));
  fatal(makeZip(entries), 'PKG-02');
});

test('PKG-03: absolute path, drive letter, backslash, .. segment, symbolic link', () => {
  fatal(makeZip([{ name: '/etc/passwd', data: enc.encode('x') }]), 'PKG-03', '/etc/passwd');
  fatal(makeZip([{ name: 'C:/windows/x', data: enc.encode('x') }]), 'PKG-03', 'C:/windows/x');
  fatal(makeZip([{ name: 'lib\\a.txt', data: enc.encode('x') }]), 'PKG-03', 'lib\\a.txt');
  fatal(makeZip([{ name: 'lib/../../x', data: enc.encode('x') }]), 'PKG-03', 'lib/../../x');
  fatal(makeZip([{ name: 'lib/LICENSE', data: enc.encode('/etc/passwd'), external: (0o120777 << 16) >>> 0 }]), 'PKG-03', 'lib/LICENSE');
  // the same mode bits from a non-Unix host are not a link
  const zip = makeZip([{ name: 'lib/LICENSE', data: enc.encode('x'), madeBy: 0, external: (0o120777 << 16) >>> 0 }]);
  assert.equal(readCentralDirectory(zip).length, 1);
});

test('PKG-04: the encryption flag', () => {
  fatal(makeZip([{ name: 'lib/a.txt', data: enc.encode('x'), flags: 0x1 }]), 'PKG-04', 'lib/a.txt');
});

test('names: PF-20 to PF-23, PF-14, ignored system files', () => {
  assert.equal(nameProblem('Kampvuur'), null);
  for (const bad of ['a<b', 'a:b', 'a|b', 'tab\there', 'dot.', 'space ', 'AUX', 'com1.txt', 'x'.repeat(101)]) {
    assert.notEqual(nameProblem(bad), null, bad);
  }
  assert.equal(pathTooLong('a/'.repeat(128)), true);
  assert.deepEqual(caseClashes(['LICENSE', 'License', 'songs']), [['LICENSE', 'License']]);
  assert.equal(isSongId('vader-jacob'), true);
  for (const bad of ['Vader', 'a--b', '-a', 'a-', 'a'.repeat(65), 'a_b']) assert.equal(isSongId(bad), false, bad);
  assert.equal(isIgnored('__MACOSX/lib/._a'), true);
  assert.equal(isIgnored('lib/songs/x/Thumbs.db'), true);
  assert.equal(isIgnored('lib/.ds_store'), false);        // case-sensitive (FDS O-11 reading)
});

test('fingerprint of the RFC 8032 test 1 key is 21FE-31DF-A154-A261 (SG-05, SG-20)', async () => {
  const key = Uint8Array.from(atob('11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo='), (c) => c.charCodeAt(0));
  assert.equal(await fingerprint(key), '21FE-31DF-A154-A261');
});
