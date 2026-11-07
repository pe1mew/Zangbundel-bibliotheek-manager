// SPDX-License-Identifier: Apache-2.0
// The only module that touches browser storage (securityAssessment SR-42; webappGUI GD-34). Local
// storage may hold the interface language and the side-bar layout of this computer, nothing else:
// never anything about a library or a key (FDS EDT-02, EDT-64). Where storage is not available
// (private window, blocked), reads give null and writes are dropped: the manager starts with defaults.

const ALLOWED = Object.freeze(['zbm.lang', 'zbm.bars']);

function check(key) {
  if (!ALLOWED.includes(key)) throw new Error(`storage: ${key} is not allowed (SR-42)`);
}

/** The stored value, or null when absent or when storage is not available. */
export function load(key, store = globalThis.localStorage) {
  check(key);
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Store a value; silently nothing when storage is not available. */
export function save(key, value, store = globalThis.localStorage) {
  check(key);
  try {
    if (store) store.setItem(key, String(value));
  } catch {
    // not available: the default is used next time (GD-34)
  }
}

export const STORAGE_KEYS = ALLOWED;
