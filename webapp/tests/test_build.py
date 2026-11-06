#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests of webapp/tools/build.py: unsafe pages it must refuse (SR-12, SR-24, SR-32) and a valid
page it must build. Run: python webapp/tests/test_build.py [path/to/build.py]. Exit 0 = all pass."""
import os, shutil, subprocess, sys, tempfile
BUILD = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools", "build.py")
bad = {
    'single-quoted stylesheet': "<link rel='stylesheet' href='assets/a.css'>",
    'unquoted rel': '<link rel=stylesheet href="assets/a.css">',
    'img/onerror': '<img/onerror=alert(1) src="assets/i.svg">',
    'quoted > then onclick': '<a title=">" onclick="x()" href="#">x</a>',
    'p/style': '<p/style="color:red">x</p>',
    'script odd end tag': '<script>alert(3)</script x>',
    'integrity with space': '<link rel="stylesheet" href="assets/a.css" integrity ="sha384-x">',
    'javascript url with tab': '<a href="java\tscript:alert(1)">x</a>',
    'dangling local href': '<a href="nope.html">x</a>',
    'comment --!>': '<!-- x --!><script>alert(1)</script> -->',
    'comment <!-->': '<!--><script>alert(1)</script>-->',
    'comment <!--->': '<!---><script>alert(1)</script>-->',
    'CDATA': '<![CDATA[ x ><script>alert(1)</script> ]]>',
    'script/ end then img': '<script src="assets/a.css"></script/><img src="assets/i.svg" onerror="alert(1)">',
    'meta refresh': '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    'iframe srcdoc': '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
    'base href': '<base href="https://evil.example/">',
    'external img': '<img src="https://tracker.example/p.png" alt="">',
}
special = {'css import': ('@import url(b.css); body{}', None), 'css external url': ('body{background:url(https://t.example/x.png)}', None),
           'svg with script': ('body{}', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
           'js file': ('body{}', 'JS')}
good_html = ('<!doctype html><!-- SPDX-License-Identifier: Apache-2.0 --><html><head><link rel="stylesheet preload" href="assets/a.css"></head><body>'
             '<img src="assets/i.svg#logo" alt=""><a href="./">home</a><a href=".">h2</a><a href="nl/">nl</a><a href="nl/../">up</a>'
             '<a href="#">top</a><a href="mailto:x@example.invalid">m</a><a href="?x=1">q</a><p data-src="/nope">d</p></body></html>')
good_css = '/* @import is not used here */ body{background:url(i.svg)} p{background:url(data:image/png;base64,AAAA)}'
results = []


def run(name, html, css, svg='<svg xmlns="http://www.w3.org/2000/svg"/>', js=False, expect_ok=False):
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, 'assets')); os.makedirs(os.path.join(d, 'nl'))
    open(os.path.join(d, 'assets', 'i.svg'), 'w').write(svg)
    open(os.path.join(d, 'assets', 'b.css'), 'w').write('p{}')
    open(os.path.join(d, 'assets', 'a.css'), 'w').write(css)
    if js:
        open(os.path.join(d, 'assets', 'a.js'), 'w').write('import "./b.js";')
    open(os.path.join(d, 'index.html'), 'w').write(html)
    open(os.path.join(d, 'nl', 'index.html'), 'w').write('<!doctype html><html><body><a href="../">up</a><a href="..">up2</a></body></html>')
    r = subprocess.run([sys.executable, BUILD, 'build', '--src', d, '--name', 'x', '--version', '1.0.0',
                        '--out', d + '-out', '--allow-dirty'], capture_output=True, text=True)
    ok = (r.returncode == 0) == expect_ok
    msg = ((r.stderr or r.stdout).strip().splitlines() or [''])[-1][:100]
    print(('PASS ' if ok else 'FAIL ') + f'{name:26} {msg}')
    shutil.rmtree(d, ignore_errors=True); shutil.rmtree(d + '-out', ignore_errors=True)
    return ok


base = '<!doctype html><html><head><link rel="stylesheet" href="assets/a.css"></head><body><img src="assets/i.svg" alt=""></body></html>'
allok = True
for name, snip in bad.items():
    allok &= run(name, base.replace('</body>', snip + '</body>'), 'body{}')
for name, (css, extra) in special.items():
    if extra == 'JS':
        allok &= run(name, base, css, js=True)
    elif extra:
        allok &= run(name, base, css, svg=extra)
    else:
        allok &= run(name, base, css)
allok &= run('GOOD page (must build)', good_html, good_css, expect_ok=True)
print('ALL OK' if allok else 'SOME FAILED')
sys.exit(0 if allok else 1)
