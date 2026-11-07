// SPDX-License-Identifier: Apache-2.0
// The main thread's side of the crypto worker (securityAssessment SR-40, SR-41, SR-46; FDS 7.7;
// implementationPlan M3.1). The main thread never holds a private key: it sends key files and data
// to sign, and receives public keys, fingerprints, signatures and, once, the bytes of a new key file
// for its download.

import { workerURL } from './trusted.js';

function defaultCreateWorker() {
  // The build bundles ../workers/crypto-worker.js separately and puts its hashed name here (TD-22).
  return new Worker(workerURL(new URL('../workers/crypto-worker.js', import.meta.url).href), { type: 'module' });
}

/**
 * A client for the crypto worker. createWorker and pageEvents are for tests; pageEvents is the
 * object that fires 'pagehide' (the window in the app).
 *   request(op, payload, transfer) resolves with the worker's result, rejects on an error.
 *   signerPort() a MessagePort for the library worker's save (library-handler 'save', payload.signer.port).
 *   forget()     SR-41, SR-46: the key is overwritten and the worker ended.
 */
export function createCryptoClient({ createWorker = defaultCreateWorker, pageEvents = globalThis } = {}) {
  let worker = null;
  let seq = 0;
  const pending = new Map();                            // id -> { resolve, reject }

  function stop(why) {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    for (const [id, p] of pending) {
      p.reject(new Error(why));
      pending.delete(id);
    }
  }

  function start() {
    worker = createWorker();
    worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error));
    };
    worker.onerror = (event) => stop(`crypto worker failed: ${event && event.message ? event.message : 'unknown error'}`);
  }

  function request(op, payload = {}, transfer = []) {
    if (worker === null) start();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, op, payload }, transfer);
    });
  }

  async function forget() {
    if (worker === null) return;
    try {
      await request('forget');
    } finally {
      stop('key forgotten');
    }
  }

  // SR-41: on pagehide the worker is ended at once; ending it releases its memory with the key
  if (pageEvents && typeof pageEvents.addEventListener === 'function') {
    pageEvents.addEventListener('pagehide', () => {
      if (worker) {
        worker.postMessage({ id: 0, op: 'forget' });
        stop('page closed');
      }
    });
  }

  return {
    request,
    forget,
    async signerPort() {
      const channel = new MessageChannel();
      await request('serve', { port: channel.port2 }, [channel.port2]);
      return channel.port1;
    },
  };
}
