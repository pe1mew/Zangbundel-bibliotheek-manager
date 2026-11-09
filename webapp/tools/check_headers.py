#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""SC-01: fetch every kind of response of a site and compare its headers with the
security requirements (securityAssessment SR-02, SR-20 to SR-25, SR-60, SR-61, SR-80, SR-81).

    check_headers.py zangbundel.nl
    check_headers.py test.zangbundel.nl --auth tester        (asks for the password; it stays out of shell history)
    check_headers.py zangbundel.nl --connect 127.0.0.1:8443 --http-connect 127.0.0.1:8080 --insecure

--connect sends the requests to another address while keeping the host name for TLS (SNI) and
the Host header: for a local test, or for a host whose DNS does not point at it yet.
--insecure skips certificate checks (self-signed test certificates only).
--report FILE writes the result as Markdown (design/test-results/).

The site's kind follows from its name: test.zangbundel.nl is the test instance, behind basic
auth; zangbundel.nl is the placeholder, or with --app the manager (v0.2.0 on: its page at /, the
privacy pages nl/en/de). Standard library only.
"""
import argparse
import base64
import datetime
import getpass
import http.client
import os
import re
import socket
import ssl
import sys

COMMON = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Permissions-Policy': 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), '
                          'fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), '
                          'midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), '
                          'usb=(), xr-spatial-tracking=()',
}
CSP_STATIC = ("default-src 'none'; script-src 'none'; worker-src 'none'; style-src 'self'; img-src 'self'; "
              "manifest-src 'none'; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; "
              "frame-src 'none'; child-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
              "upgrade-insecure-requests")
CSP_APP = ("default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
           "manifest-src 'self'; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; "
           "frame-src 'none'; child-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
           "upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types zbm-download zbm-worker")
CSP_FILE = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox"
HTML = {
    'Cache-Control': 'no-cache',
    'Integrity-Policy': 'blocked-destinations=(script)',
}
TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8',
         '.png': 'image/png', '.webp': 'image/webp', '.js': 'application/javascript; charset=utf-8',
         '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
         '.webmanifest': 'application/manifest+json'}


class Conn(http.client.HTTPSConnection):
    """HTTPS to a chosen address, with SNI and certificate check for the real host name."""
    def __init__(self, host, addr, ctx):
        super().__init__(host, context=ctx, timeout=15)
        self._addr, self._ctx = addr, ctx

    def connect(self):
        sock = socket.create_connection(self._addr, self.timeout)
        self.sock = self._ctx.wrap_socket(sock, server_hostname=self.host)


def split_addr(s, port):
    if not s:
        return None
    host, _, p = s.rpartition(':') if s.count(':') == 1 or s.startswith('[') else (s, '', '')
    return (host.strip('[]') or s, int(p) if p else port)


def normpath(path):
    parts = []
    for seg in path.split('/'):
        if seg == '..':
            parts and parts.pop()
        elif seg not in ('', '.'):
            parts.append(seg)
    return '/' + '/'.join(parts)


class Checker:
    def __init__(self, a):
        self.a = a
        self.host = a.host
        self.test = a.host.startswith('test.')
        self.ctx = ssl.create_default_context()
        if a.insecure:
            self.ctx.check_hostname = False
            self.ctx.verify_mode = ssl.CERT_NONE
        self.addr = split_addr(a.connect, 443) or (a.host, 443)
        self.http_addr = split_addr(a.http_connect, 80) or (a.host, 80)
        self.rows, self.failed = [], 0
        self.csp_html = CSP_APP if a.app else CSP_STATIC

    def fetch(self, path, method='GET', auth=True, req=None):
        c = Conn(self.host, self.addr, self.ctx)
        headers = {'Host': self.host, 'User-Agent': 'zbm-check-headers'}
        lang = getattr(self, 'lang', None)
        if lang != '':
            headers['Accept-Language'] = lang or 'nl-NL,nl;q=0.9,en;q=0.5'
        if auth and self.a.auth:
            headers['Authorization'] = 'Basic ' + base64.b64encode(self.a.auth.encode()).decode()
        headers.update(req or {})
        c.request(method, path, body=b'' if method == 'POST' else None, headers=headers)
        r = c.getresponse()
        body = r.read()
        c.close()
        return r.status, {k.lower(): v for k, v in r.getheaders()}, body, r.getheaders()

    def check(self, label, path, status, kind, method='GET', auth=True, ctype=None, extra=None, req=None):
        problems = []
        try:
            got, h, body, raw = self.fetch(path, method, auth, req)
        except (OSError, http.client.HTTPException) as e:
            self.record(label, path, [f'request failed: {e}'])
            return None
        if got != status:
            problems.append(f'status {got}, expected {status}')
        names = [k.lower() for k, _ in raw]
        for k in set(names):
            if names.count(k) > 1 and k not in ('set-cookie',):
                problems.append(f'{k} sent {names.count(k)} times')
        expect = dict(COMMON)
        if kind == 'html':
            expect.update(HTML)
            expect['Content-Security-Policy'] = self.csp_html
        else:   # 'file', and nginx's own error pages ('common'), which are HTML documents too (SR-20)
            expect['Content-Security-Policy'] = CSP_FILE
        for k, v in expect.items():
            if h.get(k.lower()) != v:
                problems.append(f'{k}: {h.get(k.lower())!r}, expected {v!r}')
        hsts = h.get('strict-transport-security', '')
        m = re.match(r'^max-age=(\d+); includeSubDomains(; preload)?$', hsts)
        if not m or int(m.group(1)) < self.a.hsts_min:
            problems.append(f'Strict-Transport-Security: {hsts!r}, expected max-age>={self.a.hsts_min}; includeSubDomains')
        robots = h.get('x-robots-tag')
        if self.test and robots != 'noindex, nofollow':
            problems.append(f'X-Robots-Tag: {robots!r}, expected noindex, nofollow (SR-81)')
        if not self.test and robots is not None:
            problems.append(f'X-Robots-Tag present on the public site: {robots!r}')
        server = h.get('server', '')
        if re.search(r'\d', server):
            problems.append(f'Server header shows a version: {server!r}')
        for k in ('x-powered-by', 'set-cookie'):
            if k in h:
                problems.append(f'{k} present')
        if ctype and h.get('content-type') != ctype:
            problems.append(f'Content-Type: {h.get("content-type")!r}, expected {ctype!r}')
        for k, v in (extra or {}).items():
            if h.get(k.lower()) != v:
                problems.append(f'{k}: {h.get(k.lower())!r}, expected {v!r}')
        self.record(label, f'{method} {path}', problems)
        return body

    def record(self, label, what, problems):
        self.rows.append((label, what, problems))
        if problems:
            self.failed += 1
        print(('PASS  ' if not problems else 'FAIL  ') + f'{label:<26} {what}')
        for p in problems:
            print('        - ' + p)

    def check_http(self):
        problems = []
        try:
            c = http.client.HTTPConnection(*self.http_addr, timeout=15)
            c.request('GET', '/some/path?q=1', headers={'Host': self.host})
            r = c.getresponse()
            r.read()
            loc = r.getheader('Location')
            c.close()
            if r.status != 301 or loc != f'https://{self.host}/some/path?q=1':
                problems.append(f'{r.status} {loc!r}, expected 301 to https://{self.host}/some/path?q=1')
            if re.search(r'\d', r.getheader('Server') or ''):
                problems.append('Server header shows a version')
        except OSError as e:
            problems.append(f'request failed: {e}')
        self.record('HTTP to HTTPS', 'GET http://…/some/path?q=1', problems)

    def run(self):
        print(f'SC-01 header check of {self.host} via {self.addr[0]}:{self.addr[1]}')
        self.check_http()
        assets = set()
        if self.test:
            self.check('no credentials: 401', '/', 401, 'common', auth=False)
            self.check('security.txt, no auth', '/.well-known/security.txt', 200, 'file', auth=False, ctype=TYPES['.txt'])
            self.check('robots.txt, no auth', '/robots.txt', 200, 'file', auth=False)
            if not self.a.auth:
                self.record('pages behind auth', '(skipped)', ['pass --auth user:password to check the pages'])
                return
            pages = ['/']
        elif self.a.app:
            # the manager on zangbundel.nl (v0.2.0): its page at /, the privacy statement it took over from the placeholder
            self.check('security.txt', '/.well-known/security.txt', 200, 'file', ctype=TYPES['.txt'])
            pages = ['/', '/nl/privacy.html', '/en/privacy.html', '/de/privacy.html']
        else:
            for lang, where in (('nl-NL,nl;q=0.9,en;q=0.5', '/nl/'), ('de-DE,de;q=0.9', '/de/'),
                                ('en-GB', '/en/'), ('fr-FR,fr;q=0.9', '/en/'), ('', '/en/')):
                self.lang = lang
                self.check(f'front door: {lang or "no language"}', '/', 302, 'file',
                           extra={'Location': where, 'Vary': 'Accept-Language'})
            self.lang = None
            self.check('security.txt', '/.well-known/security.txt', 200, 'file', ctype=TYPES['.txt'])
            pages = ['/nl/', '/en/', '/de/', '/nl/privacy.html', '/en/privacy.html', '/de/privacy.html']
        for p in pages:
            body = self.check('HTML page', p, 200, 'html', ctype=TYPES['.html'])
            if body:
                base = p if p.endswith('/') else p.rsplit('/', 1)[0] + '/'
                for ref in re.findall(r'(?:href|src)="([^"#?]+)"', body.decode('utf-8', 'replace')):
                    if '://' in ref or not re.search(r'/assets/', base + ref if not ref.startswith('/') else ref):
                        continue
                    assets.add(ref if ref.startswith('/') else normpath(base + ref))
        done = set()
        while assets - done:
            p = sorted(assets - done)[0]
            done.add(p)
            ext = p[p.rfind('.'):]
            if ext not in TYPES:
                self.record('asset', p, [f'no expected Content-Type known for {ext}; add it to TYPES'])
                continue
            body = self.check('asset', p, 200, 'file', ctype=TYPES[ext],
                              extra={'Cache-Control': 'public, max-age=31536000, immutable'})
            if body and ext == '.css':                    # assets referenced from the stylesheet
                base = p.rsplit('/', 1)[0] + '/'
                for ref in re.findall(r'''url\(\s*["']?([^"')?#]+)''', body.decode('utf-8', 'replace')):
                    if '://' not in ref and not ref.startswith('data:'):
                        assets.add(ref if ref.startswith('/') else normpath(base + ref))
        page = '/' if self.test or self.a.app else '/nl/'
        self.check('range ignored, headers once', page, 200, 'html', req={'Range': 'bytes=999999-'})
        self.check('not found', '/no-such-page', 404, 'common')
        self.check('POST refused', '/', 405, 'common', method='POST')
        self.check('PUT refused', '/x', 405, 'common', method='PUT')
        self.check('dot file', '/.git/config', 404, 'common')
        self.check('backup file', '/index.html~', 404, 'common')
        self.check('release manifest hidden', '/release-manifest.json', 404, 'common')
        self.check('manifest signature hidden', '/release-manifest.json.sig', 404, 'common')
        self.check('no directory listing', '/assets/', 403, 'file')

    def report(self, path):
        now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
        lines = [f'# SC-01 header check: {self.host}', '',
                 f'Run {now} via `{self.addr[0]}:{self.addr[1]}`' + (' (certificate not checked)' if self.a.insecure else '') + '.',
                 f'Result: **{"PASS" if not self.failed else f"FAIL ({self.failed} of {len(self.rows)})"}**.', '',
                 '| Check | Request | Result |', '|---|---|---|']
        for label, what, problems in self.rows:
            lines.append(f'| {label} | `{what}` | ' + ('pass' if not problems else 'FAIL: ' + '; '.join(problems).replace('|', '\\|')) + ' |')
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write('\n'.join(lines) + '\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('host')
    ap.add_argument('--connect', help='address[:port] for HTTPS instead of the DNS name')
    ap.add_argument('--http-connect', help='address[:port] for plain HTTP')
    ap.add_argument('--insecure', action='store_true', help='do not check the certificate (self-signed test only)')
    ap.add_argument('--auth', help='user for the test instance; the password is asked for (user:password also works, but lands in shell history)')
    ap.add_argument('--app', action='store_true', help='the manager is deployed: expect the CSP of SR-20')
    ap.add_argument('--hsts-min', type=int, default=300, help='lowest acceptable HSTS max-age (ramp step)')
    ap.add_argument('--report', help='write a Markdown report to this file')
    a = ap.parse_args()
    if a.auth and ':' not in a.auth:                      # a password typed on the command line ends up in history
        a.auth = f'{a.auth}:{getpass.getpass(f"Password for {a.auth} on {a.host}: ")}'
    c = Checker(a)
    c.run()
    print(f'\n{len(c.rows) - c.failed} passed, {c.failed} failed')
    if a.report:
        c.report(a.report)
    sys.exit(1 if c.failed else 0)


if __name__ == '__main__':
    main()
