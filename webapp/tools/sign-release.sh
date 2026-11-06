#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Sign a built release and pack it for upload (securityAssessment 7.4, SR-11, SR-13).
#
#   webapp/tools/sign-release.sh dist/placeholder-0.1.0 [~/.ssh/zangbundel-release]
#
# Runs on the owner's computer, never on the server. The private release key stays there;
# ssh-keygen asks for its passphrase. The signature is checked against
# webapp/tools/release-key.pub before packing, so a wrong key fails here, not on the server.
set -euo pipefail

dir="${1:?usage: sign-release.sh <built release dir> [private key]}"
key="${2:-$HOME/.ssh/zangbundel-release}"
here="$(cd -- "$(dirname -- "$0")" >/dev/null && pwd)"
pub="$here/release-key.pub"
identity="release@zangbundel.nl"
namespace="zangbundel-release"

[ -f "$dir/release-manifest.json" ] || { echo "no release-manifest.json in $dir" >&2; exit 1; }
[ -f "$key" ] || { echo "no private key at $key" >&2; exit 1; }
[ -f "$pub" ] || { echo "no public key at $pub (server/README.md, step 3)" >&2; exit 1; }

# Find Python before asking for the passphrase. python3 on Linux; on Windows "python3" is often
# the Store stub, so fall back to "python". PYTHON overrides, and is checked the same way.
py=""
for c in ${PYTHON:+"$PYTHON"} python3 python; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys; sys.exit(sys.version_info < (3, 9))" 2>/dev/null; then
        py="$c"; break
    fi
done
[ -n "$py" ] || { echo "no Python 3.9 or newer found (PYTHON=${PYTHON:-unset})" >&2; exit 1; }

rm -f "$dir/release-manifest.json.sig"
ssh-keygen -Y sign -f "$key" -n "$namespace" "$dir/release-manifest.json"

signers="$(mktemp)"
trap 'rm -f "$signers"' EXIT
printf '%s namespaces="%s" %s\n' "$identity" "$namespace" "$(cut -d' ' -f1,2 "$pub")" > "$signers"
ssh-keygen -Y verify -f "$signers" -I "$identity" -n "$namespace" \
    -s "$dir/release-manifest.json.sig" < "$dir/release-manifest.json"

"$py" "$here/build.py" pack "$dir"
