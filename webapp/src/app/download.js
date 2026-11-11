// SPDX-License-Identifier: Apache-2.0
// Offering a file for download (FDS EDT-59, PF-04; securityAssessment SR-36; implementationPlan M6.2).
// The bytes become a blob: URL of the given MIME type, a temporary link downloads it under the given
// name, and the URL is revoked right after. Nothing goes to the server (TD-06). Assigning a blob: URL
// to a link is not a Trusted Types sink, so no policy is needed here (securityAssessment SF-25).

import { el } from './dom.js';

export const LIBRARY_MIME = 'application/vnd.zangbundel.library+zip';   // PF-04
export const KEY_MIME = 'application/json';                             // SR-36, the key file (M6.4)
const REVOKE_MS = 10000;                                                // long enough for the browser to start the download

/** SR-36: a generated name only, ending in the extension the manager fixes. */
const NAME = /^[^<>:"/\\|?*\u0000-\u001f\u007f-\u009f]{1,200}\.(zbl|zbkey)$/;

/** Download bytes as a file; returns the name used. */
export function offerDownload(bytes, fileName, mime) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('download: bytes are needed');
  if (!NAME.test(fileName)) throw new Error(`download: not a generated file name: ${fileName}`);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = el('a', { href: url, download: fileName, hidden: true }, []);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
  return fileName;
}

/** EDT-56: a size the way people read it. */
export function sizeText(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
