// SPDX-License-Identifier: Apache-2.0
// Fuzzing of the ZIP and ChordPro readers (securityAssessment SR-35, SC-11; implementationPlan M2.9).
//
//   node webapp/tests/fuzz.mjs [--iterations 20000] [--seed 1] [--limit-ms 2000]
//
// Starts from the shared test libraries and mutates them: bytes, cuts, inserts, splices between
// libraries, central-directory and local-header fields, song text and manifest JSON (rebuilt into a
// valid ZIP so the deeper readers are reached). For every input the engine must answer with findings
// and not throw (validate, open and, when opened, save), within the time limit; memory is reported.
// A failing input is written to the system temp folder with its seed and iteration, so it can be
// replayed. Deterministic: the same seed gives the same inputs. tests/unit/fuzz.test.mjs runs a short
// version on every `node --test`; run this long version before a release and after any change to
// zip.js, chordpro.js, manifest.js or validate.js.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLibrary } from '../src/core/validate.js';
import { openLibrary, saveLibrary } from '../src/core/library.js';
import { canonicalize, parseSong, songView } from '../src/core/chordpro.js';
import { fromBlocks, toBlocks } from '../src/core/blocks.js';
import { readCentralDirectory, readEntry, writeZip } from '../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, '..', '..', 'test-libraries');
const CODE = /^(PKG|STR|MAN|SIG|SNG|SET|VIEW)-\d{2}$/;
const SEVERITIES = new Set(['Fatal', 'Error', 'Warning', 'Info']);
const enc = new TextEncoder();
const dec = new TextDecoder();

/** mulberry32: a small, deterministic PRNG. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadCorpus() {
  return readdirSync(CORPUS).filter((f) => f.endsWith('.zbl')).sort().map((f) => new Uint8Array(readFileSync(join(CORPUS, f))));
}

const SONG_TOKENS = ['{', '}', '[', ']', '\\', '{title: x}', '{t:}', '{meta: id a}', '{meta: language nl}', '{soc}', '{eoc}', '{sov}',
  '{eov}', '{start_of_tab}', '{end_of_tab}', '{chorus}', '{chorus: R}', '{soc: R}', '{new_song}', '{x_zb_time: 1 0}', '[G]', '[*a]',
  '[H]', '#', '\n', '\r\n', '\r', '\t', ' ', '   ', 'tekst', 'é', 'é', '﻿', '\u0085', '\u0000', '\u009b', '‮',
  '😀', '{meta: tag a b}', '{year: 12}', '{redistribute: ja}', '{key: F}', '{key: G}', '{album: x}', '{comment: x'];
const JSON_TOKENS = ['{', '}', '[', ']', '"', ':', ',', 'null', 'true', '1e400', '-0', '0', '1.5', '"__proto__"', '"\\u0000"',
  '"x"', ' ', '\n', '"files"', '"sets"', '"author"', '"publicKey"'];

function pick(r, list) {
  return list[Math.floor(r() * list.length)];
}

function randomText(r, tokens, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += pick(r, tokens);
  return s;
}

/** Rebuild a ZIP from its entries after changing one of them (keeps the structure valid). */
function rebuild(base, change) {
  const entries = readCentralDirectory(base).filter((e) => !e.dir);
  const files = entries.map((e) => ({ name: e.name, data: readEntry(base, e) }));
  change(files);
  return writeZip(files, '2026-11-07T00:00:00Z');
}

const MUTATORS = {
  flip(r, b) {
    const out = b.slice();
    for (let i = 0, n = 1 + Math.floor(r() * 8); i < n && out.length; i++) out[Math.floor(r() * out.length)] ^= 1 << Math.floor(r() * 8);
    return out;
  },
  truncate(r, b) {
    return b.slice(0, Math.floor(r() * b.length));
  },
  insert(r, b) {
    const at = Math.floor(r() * (b.length + 1));
    const add = Uint8Array.from({ length: 1 + Math.floor(r() * 64) }, () => Math.floor(r() * 256));
    return Uint8Array.from([...b.subarray(0, at), ...add, ...b.subarray(at)]);
  },
  remove(r, b) {
    const at = Math.floor(r() * b.length);
    const n = 1 + Math.floor(r() * 256);
    return Uint8Array.from([...b.subarray(0, at), ...b.subarray(at + n)]);
  },
  splice(r, b, corpus) {
    const other = pick(r, corpus);
    const at = Math.floor(r() * b.length);
    const from = Math.floor(r() * other.length);
    const n = Math.floor(r() * 512);
    return Uint8Array.from([...b.subarray(0, at), ...other.subarray(from, from + n), ...b.subarray(at + n)]);
  },
  header(r, b) {
    // a field of a central-directory or local header set to a boundary value
    const out = b.slice();
    const v = new DataView(out.buffer);
    const sigs = [];
    for (let i = 0; i + 4 <= out.length; i++) {
      const s = v.getUint32(i, true);
      if (s === 0x02014b50 || s === 0x04034b50 || s === 0x06054b50) sigs.push([i, s]);
    }
    if (!sigs.length) return out;
    const [at, sig] = pick(r, sigs);
    const fields = sig === 0x02014b50 ? [[4, 2], [8, 2], [10, 2], [16, 4], [20, 4], [24, 4], [28, 2], [30, 2], [32, 2], [38, 4], [42, 4]]
      : sig === 0x04034b50 ? [[6, 2], [8, 2], [14, 4], [18, 4], [22, 4], [26, 2], [28, 2]]
        : [[8, 2], [10, 2], [12, 4], [16, 4], [20, 2]];
    const [off, width] = pick(r, fields);
    if (at + off + width > out.length) return out;
    const old = width === 2 ? v.getUint16(at + off, true) : v.getUint32(at + off, true);
    const max = width === 2 ? 0xffff : 0xffffffff;
    const value = pick(r, [0, 1, max, max - 1, old + 1, Math.max(0, old - 1), old * 2, Math.floor(r() * max)]) >>> 0;
    if (width === 2) v.setUint16(at + off, value & 0xffff, true);
    else v.setUint32(at + off, value, true);
    return out;
  },
  song(r, b) {
    return rebuild(b, (files) => {
      const songs = files.filter((f) => f.name.endsWith('.cho'));
      if (!songs.length) return;
      const s = pick(r, songs);
      const text = dec.decode(s.data);
      const at = Math.floor(r() * (text.length + 1));
      s.data = enc.encode(text.slice(0, at) + randomText(r, SONG_TOKENS, 1 + Math.floor(r() * 40)) + text.slice(at));
    });
  },
  manifest(r, b) {
    return rebuild(b, (files) => {
      const m = files.find((f) => f.name.endsWith('/manifest.json'));
      if (!m) return;
      const text = dec.decode(m.data);
      const at = Math.floor(r() * (text.length + 1));
      const cut = Math.floor(r() * 20);
      m.data = enc.encode(text.slice(0, at) + randomText(r, JSON_TOKENS, 1 + Math.floor(r() * 8)) + text.slice(at + cut));
    });
  },
};

function checkFindings(result) {
  if (!result || !Array.isArray(result.findings)) return 'no findings array';
  for (const f of result.findings) {
    if (!CODE.test(f.code) || !SEVERITIES.has(f.severity)) return `bad finding ${JSON.stringify(f)}`;
  }
  return null;
}

/** Run the fuzzer; returns { iterations, failures, converted, maxMs, maxRssMB, byMutator, byCode }. */
export async function runFuzz({ iterations = 20000, seed = 1, limitMs = 2000, log = () => {} } = {}) {
  const corpus = loadCorpus();
  const r = prng(seed);
  const names = Object.keys(MUTATORS);
  const failures = [];
  const byMutator = {};
  const byCode = {};
  let maxMs = 0;
  let maxRss = 0;
  let converted = 0;                                     // inputs without a manifest, opened through convert.js (M2.7)
  for (let i = 0; i < iterations; i++) {
    const mutator = pick(r, names);
    let input;
    try {
      input = MUTATORS[mutator](r, pick(r, corpus), corpus);
    } catch {
      continue;                                          // the mutator could not apply (e.g. a corpus file that does not open)
    }
    byMutator[mutator] = (byMutator[mutator] || 0) + 1;
    const t0 = performance.now();
    let problem = null;
    try {
      const v = await validateLibrary(input);
      problem = checkFindings(v);
      const first = v.findings.find((f) => f.severity === 'Fatal' || f.severity === 'Error') || v.findings[0];
      if (first) byCode[first.code] = (byCode[first.code] || 0) + 1;
      const o = await openLibrary(input);
      problem = problem || checkFindings(o);
      if (o.converted) converted++;
      if (!problem && o.library) {
        const s = await saveLibrary(o.library, { changed: true, now: new Date('2026-11-07T00:00:00Z') });
        problem = s.refused && !s.reason ? 'refused without a reason' : null;
      }
    } catch (e) {
      problem = `threw: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)}`;
    }
    const ms = performance.now() - t0;
    maxMs = Math.max(maxMs, ms);
    if (!problem && ms > limitMs) problem = `took ${Math.round(ms)} ms (limit ${limitMs})`;
    if (problem) {
      const file = join(tmpdir(), `zbm-fuzz-seed${seed}-it${i}.zbl`);
      writeFileSync(file, input);
      failures.push({ iteration: i, mutator, problem, file });
      log(`FAIL it ${i} (${mutator}): ${problem} -> ${file}`);
    }
    if (i % 500 === 0) maxRss = Math.max(maxRss, process.memoryUsage().rss);
  }
  maxRss = Math.max(maxRss, process.memoryUsage().rss);
  return { iterations, failures, converted, maxMs: Math.round(maxMs), maxRssMB: Math.round(maxRss / 1048576), byMutator, byCode };
}

/** ChordPro alone: random token text must parse, in time that grows with the input, not faster. */
export function fuzzChordPro({ iterations = 2000, seed = 1 } = {}) {
  const r = prng(seed);
  const failures = [];
  let maxMs = 0;
  for (let i = 0; i < iterations; i++) {
    const text = randomText(r, SONG_TOKENS, Math.floor(r() * 4000));
    const t0 = performance.now();
    try {
      const c = canonicalize(enc.encode(text));
      if (c.text !== null) {
        parseSong(c.text);
        songView(c.text);                                 // M5.2: the song view reads the same text
        if (fromBlocks(toBlocks(c.text)) !== c.text) {    // M2.3: the block form loses nothing
          failures.push({ iteration: i, problem: 'block form round trip differs' });
        }
      }
    } catch (e) {
      failures.push({ iteration: i, problem: `threw: ${e.message}` });
    }
    maxMs = Math.max(maxMs, performance.now() - t0);
  }
  return { iterations, failures, maxMs: Math.round(maxMs) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (name, dflt) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : dflt;
  };
  const options = { iterations: arg('iterations', 20000), seed: arg('seed', 1), limitMs: arg('limit-ms', 2000), log: console.log };
  const t0 = performance.now();
  const lib = await runFuzz(options);
  const cp = fuzzChordPro({ iterations: Math.max(1000, Math.floor(options.iterations / 10)), seed: options.seed });
  console.log(JSON.stringify({ library: lib, chordpro: cp, seconds: Math.round((performance.now() - t0) / 1000) }, null, 1));
  process.exit(lib.failures.length || cp.failures.length ? 1 : 0);
}
