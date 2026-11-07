// SPDX-License-Identifier: Apache-2.0
// Entry point of the library worker (securityAssessment SR-30; webappTDS TD-22, TD-23). Bundled on
// its own by the build; started by app/library-client.js through the Trusted Types policy
// zbm-worker. It has no DOM; it answers each message with structured data.

import { handleMessage } from './library-handler.js';

self.onmessage = async (event) => {
  self.postMessage(await handleMessage(event.data));
};
