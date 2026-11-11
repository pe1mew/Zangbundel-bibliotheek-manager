// SPDX-License-Identifier: Apache-2.0
// Trusted Types policy zbm-worker (webappTDS TD-23; securityAssessment SR-20, SR-32). With
// require-trusted-types-for 'script', new Worker(url) needs a TrustedScriptURL; this policy creates
// one only for the release's two worker bundles on this origin. It is the only policy: a download's
// blob: URL on a link is not a sink (securityAssessment SF-25).

const WORKER_PATH = /^\/assets\/(library-worker|crypto-worker)\.[0-9a-f]{12}\.js$/;
let policy = null;

function check(url) {
  const u = new URL(url, location.href);
  if (u.origin !== location.origin || !WORKER_PATH.test(u.pathname) || u.search || u.hash) {
    throw new TypeError(`zbm-worker: not a worker bundle of this release: ${url}`);
  }
  return u.href;
}

/** The URL of a worker bundle, as a TrustedScriptURL where the browser has Trusted Types. */
export function workerURL(url) {
  const href = check(url);
  if (!globalThis.trustedTypes) {
    return href;                                         // browsers without Trusted Types (TD-15)
  }
  if (policy === null) {
    policy = globalThis.trustedTypes.createPolicy('zbm-worker', { createScriptURL: check });
  }
  return policy.createScriptURL(href);
}
