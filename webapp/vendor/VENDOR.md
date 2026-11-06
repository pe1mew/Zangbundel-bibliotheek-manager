# Vendored packages

Written by `webapp/tools/vendor.py` (securityAssessment SR-12, SR-14; webappTDS TD-17, TD-22). Do not edit
by hand: `vendor.py add` replaces a package's row, `vendor.py check` and `build.py` compare every file with
its SHA-256 here. Each file is one file of the npm package, unchanged; its licence is next to it.

| File | Package | Version | Source | Tarball SHA-512 (npm `dist.integrity`) | File SHA-256 | Provenance | Licence |
|---|---|---|---|---|---|---|---|
| `fflate-0.8.3.js` | `fflate` | 0.8.3 | https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz → `esm/browser.js` | `sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==` | `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1` | **none published** (accepted with `--accept-missing-provenance`) | MIT |
| `noble-ed25519-3.2.0.js` | `@noble/ed25519` | 3.2.0 | https://registry.npmjs.org/@noble/ed25519/-/ed25519-3.2.0.tgz → `index.js` | `sha512-criDgRlnUA09hchYrTy/JUWPIEap5rZxQe6wDWzRx51oWWpDRcUpuNzlgPxDJaOK6AsW9c0wKcj3rKRv6t+bPQ==` | `a4f631d1876b5d9e43a86cd71194ca27b5e1451edf4ba4db9a418f40a475569a` | SLSA provenance, verified (`npm audit signatures`) | MIT |
