// SPDX-License-Identifier: Apache-2.0
// Unit tests of the library worker's handler and the main thread's client (securityAssessment SR-30,
// SR-31; implementationPlan M2.8). A fake worker runs the real handler, as the browser's worker would;
// other fakes never answer or fail, for the 20-second limit and recovery. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMessage } from '../../src/workers/library-handler.js';
import { createLibraryClient, TIMEOUT_MS } from '../../src/app/library-client.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));

/** A stand-in for new Worker(): structured-clones like postMessage and runs the real handler. */
function fakeWorker(log) {
  const w = {
    onmessage: null,
    onerror: null,
    terminated: false,
    postMessage(data) {
      const copy = structuredClone(data);
      setTimeout(async () => {
        const answer = structuredClone(await handleMessage(copy));
        if (!w.terminated) w.onmessage({ data: answer });
      }, 0);
    },
    terminate() { w.terminated = true; log.push('terminate'); },
  };
  log.push('start');
  return w;
}

test('the handler answers with structured data only', async () => {
  const r = await handleMessage({ id: 1, op: 'validate', payload: { bytes: corpus('file-changed') } });
  assert.equal(r.ok, true);
  assert.deepEqual(structuredClone(r), r);                   // survives postMessage unchanged
  assert.ok(r.result.findings.some((f) => f.code === 'MAN-06'));
  assert.equal(r.result.files, undefined);                   // no bytes of every file go back
  const bad = await handleMessage({ id: 2, op: 'nonsense' });
  assert.equal(bad.ok, false);
  const broken = await handleMessage({ id: 3, op: 'open', payload: null });
  assert.equal(broken.ok, false);                            // an exception becomes an answer, not a crash
});

test('the client opens and saves through the worker; the timeout default is 20 s (SR-31)', async () => {
  assert.equal(TIMEOUT_MS, 20000);
  const log = [];
  const client = createLibraryClient({ createWorker: () => fakeWorker(log) });
  const opened = await client.request('open', { bytes: corpus('valid-unsigned') });
  assert.equal(opened.library.songs.size, 4);
  const saved = await client.request('save', { library: opened.library, changed: false });
  assert.equal(saved.unchanged, true);
  assert.deepEqual(saved.bytes, corpus('valid-unsigned'));   // EDT-51 through the worker
  const fatal = await client.request('validate', { bytes: corpus('zip-ratio') });
  assert.deepEqual(fatal.findings.map((f) => f.code), ['PKG-02']);
  client.terminate();
  assert.deepEqual(log, ['start', 'terminate']);
});

test('SR-31: a read that takes too long ends the worker with PKG-02 (M-02); the next request starts a new one', async () => {
  const log = [];
  let silent = true;
  const client = createLibraryClient({
    timeoutMs: 50,
    createWorker: () => (silent ? { postMessage() {}, terminate() { log.push('terminate'); }, onmessage: null, onerror: null } : fakeWorker(log)),
  });
  const [a, b] = await Promise.all([client.request('validate', { bytes: corpus('valid-unsigned') }),
    client.request('validate', { bytes: corpus('valid-signed') })]);
  for (const r of [a, b]) {
    assert.equal(r.timedOut, true);
    assert.deepEqual(r.findings.map((f) => [f.code, f.severity]), [['PKG-02', 'Fatal']]);
  }
  assert.deepEqual(log, ['terminate']);
  silent = false;
  const r = await client.request('validate', { bytes: corpus('valid-unsigned') });
  assert.equal(r.fatal, false);
  client.terminate();
});

test('a worker that fails rejects its requests, and the client recovers', async () => {
  let failing = true;
  const log = [];
  const client = createLibraryClient({
    createWorker: () => {
      if (!failing) return fakeWorker(log);
      const w = { onmessage: null, onerror: null, terminate() {}, postMessage() { setTimeout(() => w.onerror({ message: 'boom' }), 0); } };
      return w;
    },
  });
  await assert.rejects(client.request('validate', { bytes: corpus('valid-unsigned') }), /library worker failed: boom/);
  failing = false;
  const r = await client.request('validate', { bytes: corpus('valid-unsigned') });
  assert.equal(r.fatal, false);
  client.terminate();
});
