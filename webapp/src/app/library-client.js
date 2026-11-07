// SPDX-License-Identifier: Apache-2.0
// The main thread's side of the library worker (securityAssessment SR-30, SR-31; implementationPlan
// M2.8). Library bytes go to the worker and only structured data comes back. A request that takes
// longer than 20 s ends the worker: the answer is PKG-02 (message M-02), and the next request
// starts a new worker.

import { workerURL } from './trusted.js';

export const TIMEOUT_MS = 20000;                        // SR-31: per file

function defaultCreateWorker() {
  // The build bundles ../workers/library-worker.js separately and puts its hashed name here (TD-22).
  return new Worker(workerURL(new URL('../workers/library-worker.js', import.meta.url).href), { type: 'module' });
}

/** The finding that stands for a read that was stopped: the limits of FDS 3.5 (PKG-02, M-02). */
export function timeoutResult(seconds) {
  return {
    findings: [{ code: 'PKG-02', severity: 'Fatal', detail: `reading took longer than ${seconds} s` }],
    fatal: true,
    timedOut: true,
  };
}

/**
 * A client for the library worker. createWorker and timeoutMs are for tests.
 * request(op, payload) resolves with the worker's result; a stopped read resolves with
 * timeoutResult(); a worker error rejects.
 */
export function createLibraryClient({ createWorker = defaultCreateWorker, timeoutMs = TIMEOUT_MS } = {}) {
  let worker = null;
  let seq = 0;
  const pending = new Map();                            // id -> { resolve, reject, timer }

  function stop(answer) {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      answer(p);
      pending.delete(id);
    }
  }

  function start() {
    worker = createWorker();
    worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data || {};
      const p = pending.get(id);
      if (!p) {
        return;
      }
      clearTimeout(p.timer);
      pending.delete(id);
      if (ok) {
        p.resolve(result);
      } else {
        p.reject(new Error(error));
      }
    };
    worker.onerror = (event) => {
      stop((p) => p.reject(new Error(`library worker failed: ${event && event.message ? event.message : 'unknown error'}`)));
    };
  }

  return {
    request(op, payload, transfer = []) {
      if (worker === null) {
        start();
      }
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // SR-31: the worker is ended, not asked; every request in it is answered as stopped
          stop((p) => p.resolve(timeoutResult(Math.round(timeoutMs / 1000))));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, op, payload }, transfer);
      });
    },
    terminate() {
      stop((p) => p.reject(new Error('library worker closed')));
    },
  };
}
