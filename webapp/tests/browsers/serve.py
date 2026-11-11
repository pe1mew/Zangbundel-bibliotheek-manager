#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Serve a built release for the browser check (completion plan C5, C12; drive.mjs starts it).

    serve.py <release dir>      prints "PORT <n>" once it listens on 127.0.0.1, then serves until killed

The CSP is the one `webapp/server/nginx/conf.d/zangbundel.conf` sends on zangbundel.nl, read from that file so the
check always uses the policy the server sends, with one change: `connect-src 'self'` in place of 'none', so the
test hook in the page can fetch the public test library from /__test/. Only the files in TEST_FILES are served
there, from test-libraries/. Never for anything but this check: the release itself is served by nginx.
"""
import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CONF = os.path.join(ROOT, 'webapp', 'server', 'nginx', 'conf.d', 'zangbundel.conf')
TEST_FILES = {'valid-unsigned.zbl'}


def production_csp():
    text = open(CONF, encoding='utf-8').read()
    m = re.search(r'^\s*zangbundel\.nl\s+"([^"]+)";', text, re.M)
    if not m:
        sys.exit(f'serve.py: no CSP for zangbundel.nl in {CONF}')
    csp = m.group(1)
    if "connect-src 'none'" not in csp:
        sys.exit("serve.py: the production CSP no longer has connect-src 'none'; check this harness")
    return csp.replace("connect-src 'none'", "connect-src 'self'")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.zbl': 'application/vnd.zangbundel.library+zip', '.zbkey': 'application/json'}
    csp = ''

    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        if clean.startswith('/__test/'):
            name = clean[len('/__test/'):]
            return os.path.join(ROOT, 'test-libraries', name) if name in TEST_FILES else os.path.join(ROOT, 'no-such-file')
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Content-Security-Policy', self.csp)
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):                        # quiet: drive.mjs prints the report
        pass


def main():
    if len(sys.argv) != 2 or not os.path.isfile(os.path.join(sys.argv[1], 'index.html')):
        sys.exit('usage: serve.py <release dir with index.html>')
    Handler.csp = production_csp()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=os.path.abspath(sys.argv[1])))
    print(f'PORT {server.server_address[1]}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
