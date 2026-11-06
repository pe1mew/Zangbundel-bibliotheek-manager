# SPDX-License-Identifier: Apache-2.0
# Test image matching contabo6: Ubuntu 24.04 with its own nginx 1.24, Python 3.12, OpenSSH 9.6.
# Used by run.sh in this folder; see the comment there.
FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        nginx python3 openssh-client apache2-utils openssl ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*
