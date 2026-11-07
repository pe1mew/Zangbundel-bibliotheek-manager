// SPDX-License-Identifier: Apache-2.0
// Entry point of the crypto worker (securityAssessment SR-40, SR-41; webappTDS TD-22, TD-23).
// Bundled on its own by the build, without the library engine; started by app/crypto-client.js
// through the Trusted Types policy zbm-worker. The private key exists in this worker only.

import { createCryptoHandler } from './crypto-handler.js';

const handleMessage = createCryptoHandler();
handleMessage({ op: 'selftest' });                      // SR-15: the self-test runs on start

self.onmessage = async (event) => {
  self.postMessage(await handleMessage(event.data));
};
