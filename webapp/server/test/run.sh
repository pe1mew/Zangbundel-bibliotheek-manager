#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# M0 test in a container like contabo6 (Ubuntu 24.04, nginx 1.24): build and sign both static
# sites with a THROWAWAY key made here, install the server files the way server/README.md says,
# then try good and bad uploads, the integrity check, and SC-01 for both hosts.
#
#   docker build -t zbm-m0test webapp/server/test
#   docker run --rm -v "$PWD:/repo:ro" zbm-m0test bash /repo/webapp/server/test/run.sh
#
# (Git Bash on Windows: prefix docker run with MSYS_NO_PATHCONV=1.) Self-signed certificates;
# nothing here touches DNS, certbot, systemd or sshd. Exit status 0 only if every check passed.
set -u
pass=0; fail=0
ok()  { echo "PASS  $*"; pass=$((pass+1)); }
bad() { echo "FAIL  $*"; fail=$((fail+1)); }
expect_fail() { if "$@" >/tmp/out 2>&1; then bad "should have been refused: $*"; cat /tmp/out; else ok "refused: $(grep -v '^ok ' /tmp/out | tail -1)"; fi; }

# --- build and sign with a throwaway key (never the owner's release key) ---
W=/work; mkdir -p $W/rk $W/dist $W/tools
ssh-keygen -q -t ed25519 -N '' -C 'THROWAWAY test key' -f $W/rk/test-release
cp /repo/webapp/tools/build.py /repo/webapp/tools/sign-release.sh $W/tools/
cp $W/rk/test-release.pub $W/tools/release-key.pub
for n in placeholder test-holding; do
  (cd /repo && python3 webapp/tools/build.py build --src webapp/$n --name $n --version 0.1.0 --out $W/dist/$n-0.1.0 --allow-dirty)     && bash $W/tools/sign-release.sh $W/dist/$n-0.1.0 $W/rk/test-release >/dev/null 2>&1 && [ -f $W/dist/$n-0.1.0.tar ]     && ok "built and signed $n" || bad "build or sign $n"
done

S=/repo/webapp/server
nginx -v 2>&1; python3 --version; ssh -V 2>&1

# --- install (README steps 4-7) ---
install -m 0644 $S/nginx/conf.d/zangbundel.conf /etc/nginx/conf.d/
install -m 0644 $S/nginx/snippets/zbm-*.conf /etc/nginx/snippets/
install -m 0644 $S/nginx/sites-available/*.conf /etc/nginx/sites-available/
for f in zangbundel-http.conf zangbundel.nl.conf test.zangbundel.nl.conf; do ln -sf ../sites-available/$f /etc/nginx/sites-enabled/$f; done
install -m 0755 $S/bin/zbm-receive /usr/local/bin/zbm-receive
install -m 0755 $S/bin/zbm-release /usr/local/sbin/zbm-release
mkdir -p /var/www/acme /etc/zangbundel /srv/zangbundel/releases /srv/zangbundel-test/releases /srv/zangbundel-staging/incoming
useradd --system --create-home --shell /bin/bash zbm-deploy
chown zbm-deploy:zbm-deploy /srv/zangbundel-staging/incoming; chmod 0750 /srv/zangbundel-staging/incoming
printf 'release@zangbundel.nl namespaces="zangbundel-release" %s\n' "$(cut -d' ' -f1,2 /work/rk/test-release.pub)" > /etc/zangbundel/allowed_signers
chmod 0644 /etc/zangbundel/allowed_signers
htpasswd -B -b -c /etc/nginx/zangbundel-test.htpasswd tester 'test-only-pw' 2>/dev/null
chown root:www-data /etc/nginx/zangbundel-test.htpasswd; chmod 0640 /etc/nginx/zangbundel-test.htpasswd
for h in zangbundel.nl test.zangbundel.nl; do
  mkdir -p /etc/letsencrypt/live/$h
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=$h" -addext "subjectAltName=DNS:$h" \
    -keyout /etc/letsencrypt/live/$h/privkey.pem -out /etc/letsencrypt/live/$h/fullchain.pem 2>/dev/null
done

# --- upload as the deploy user through the forced command, activate as root ---
su zbm-deploy -c '/usr/local/bin/zbm-receive' < /work/dist/placeholder-0.1.0.tar && ok "zbm-receive stored the placeholder upload"
up=$(ls /srv/zangbundel-staging/incoming/upload-*.tar | head -1)
zbm-release activate zangbundel.nl "$up" && ok "activate zangbundel.nl"
zbm-release activate test.zangbundel.nl /work/dist/test-holding-0.1.0.tar && ok "activate test.zangbundel.nl"
zbm-release activate zangbundel.nl "$up" && ok "re-activating the same release is harmless"
zbm-release list
[ "$(stat -c '%U %a' /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html)" = "root 644" ] && ok "release files root-owned 0644" || bad "release file owner/mode"
su www-data -s /bin/sh -c 'touch /srv/zangbundel/live/x' 2>/dev/null && bad "www-data can write the release" || ok "www-data cannot write the release"
su zbm-deploy -c 'touch /srv/zangbundel/live/x' 2>/dev/null && bad "deploy user can write the release" || ok "deploy user cannot write the release"
su zbm-deploy -c 'zbm-release activate zangbundel.nl /dev/null' >/dev/null 2>&1 && bad "deploy user could activate" || ok "deploy user cannot activate"

# --- refused uploads ---
T=/tmp/evil; rm -rf $T; mkdir -p $T
python3 - <<'PY'
import io, tarfile, json, shutil
src = '/work/dist/placeholder-0.1.0.tar'
def rewrite(dst, mutate):
    with tarfile.open(src) as t, tarfile.open(dst, 'w') as o:
        for m in t.getmembers():
            data = t.extractfile(m).read()
            m, data = mutate(m, data)
            if m is None: continue
            m.size = len(data); o.addfile(m, io.BytesIO(data))
        extra = getattr(mutate, 'extra', None)
        if extra: extra(o)
def tamper_file(m, d):
    return (m, d.replace(b'In aanbouw', b'Gehackt!!!')) if m.name == 'nl/index.html' else (m, d)
def tamper_manifest(m, d):
    return (m, d.replace(b'"version": "0.1.0"', b'"version": "0.1.1"')) if m.name == 'release-manifest.json' else (m, d)
def drop_sig(m, d):
    return (None, d) if m.name.endswith('.sig') else (m, d)
def keep(m, d): return (m, d)
def add_traversal(o):
    i = tarfile.TarInfo('../../etc/evil'); b = b'x'; i.size = 1; o.addfile(i, io.BytesIO(b))
def add_symlink(o):
    i = tarfile.TarInfo('nl/link.html'); i.type = tarfile.SYMTYPE; i.linkname = '/etc/shadow'; o.addfile(i)
def add_extra(o):
    i = tarfile.TarInfo('nl/extra.html'); b = b'<p>extra</p>'; i.size = len(b); o.addfile(i, io.BytesIO(b))
rewrite('/tmp/evil/changed-file.tar', tamper_file)
rewrite('/tmp/evil/changed-manifest.tar', tamper_manifest)
rewrite('/tmp/evil/no-signature.tar', drop_sig)
keep.extra = add_traversal; rewrite('/tmp/evil/traversal.tar', keep)
k2 = lambda m, d: (m, d); k2.extra = add_symlink; rewrite('/tmp/evil/symlink.tar', k2)
k3 = lambda m, d: (m, d); k3.extra = add_extra; rewrite('/tmp/evil/extra-file.tar', k3)
PY
for f in changed-file changed-manifest no-signature traversal symlink extra-file; do
  echo "-- $f"; expect_fail zbm-release activate test.zangbundel.nl $T/$f.tar
done
[ ! -e /etc/evil ] && ok "no file written outside the release" || bad "/etc/evil exists"
# a release signed by another key
ssh-keygen -q -t ed25519 -N '' -f /tmp/otherkey
python3 - <<'PY'
import tarfile, shutil, os
d = '/tmp/other'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
with tarfile.open('/work/dist/placeholder-0.1.0.tar') as t:
    for m in t.getmembers():
        if m.isfile() and not m.name.endswith('.sig'):
            p = os.path.join(d, m.name); os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(t.extractfile(m).read())
PY
ssh-keygen -q -Y sign -f /tmp/otherkey -n zangbundel-release /tmp/other/release-manifest.json
tar -C /tmp/other -cf /tmp/evil/other-key.tar .
echo "-- other-key"; expect_fail zbm-release activate test.zangbundel.nl /tmp/evil/other-key.tar
# oversized upload through the forced command
head -c $((50*1024*1024 + 10)) /dev/zero | su zbm-deploy -c '/usr/local/bin/zbm-receive' >/tmp/out 2>&1 && bad "oversize upload accepted" || ok "zbm-receive refused: $(tail -1 /tmp/out)"

# --- integrity check (SR-73) ---
zbm-release verify && ok "verify: both sites intact"
chmod u+w /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html
cp /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html /tmp/keep.html
echo '<!-- changed -->' >> /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html
echo "-- verify after a changed live file"; expect_fail zbm-release verify
cp /tmp/keep.html /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html; chmod 0644 /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html
touch /srv/zangbundel/releases/placeholder-0.1.0/planted.html
echo "-- verify after a planted file"; expect_fail zbm-release verify
rm /srv/zangbundel/releases/placeholder-0.1.0/planted.html
zbm-release verify >/dev/null 2>&1 && ok "verify: intact again after restore"
# push to a local stand-in for Uptime Kuma
python3 -c "
import http.server, threading
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        open('/tmp/push.log','a').write(self.path+'\n'); self.send_response(200); self.end_headers(); self.wfile.write(b'{\"ok\":true}')
    def log_message(self,*a): pass
http.server.HTTPServer(('127.0.0.1',3001),H).serve_forever()" &
sleep 1
echo 'http://127.0.0.1:3001/api/push/TESTTOKEN?status=up&msg=OK&ping=' > /etc/zangbundel/kuma-push-url; chmod 600 /etc/zangbundel/kuma-push-url
zbm-release verify --push-url-file /etc/zangbundel/kuma-push-url >/dev/null 2>&1
grep -q 'status=up' /tmp/push.log && ok "push: up sent ($(tail -1 /tmp/push.log | cut -c1-60))" || bad "push up not sent"

# --- nginx ---
nginx -t 2>&1 | tail -2
nginx -t >/dev/null 2>&1 && ok "nginx -t" || bad "nginx -t"
nginx
sleep 1
echo; echo "=== SC-01 zangbundel.nl ==="
python3 /repo/webapp/tools/check_headers.py zangbundel.nl --connect 127.0.0.1:443 --http-connect 127.0.0.1:80 --insecure && ok "SC-01 zangbundel.nl" || bad "SC-01 zangbundel.nl"
echo; echo "=== SC-01 test.zangbundel.nl ==="
python3 /repo/webapp/tools/check_headers.py test.zangbundel.nl --connect 127.0.0.1:443 --http-connect 127.0.0.1:80 --insecure --auth tester:test-only-pw && ok "SC-01 test.zangbundel.nl" || bad "SC-01 test.zangbundel.nl"
# language choice and wrong password
for l in "de-DE,de;q=0.9" "en-GB" "fr-FR,fr" "nl"; do
  echo "Accept-Language $l -> $(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' -H "Accept-Language: $l" --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/)"
done
code=$(curl -sk -o /dev/null -w '%{http_code}' -u tester:wrong --resolve test.zangbundel.nl:443:127.0.0.1 https://test.zangbundel.nl/)
[ "$code" = 401 ] && ok "wrong password: 401" || bad "wrong password gave $code"
code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: other.example' https://127.0.0.1/ )
echo "unknown Host on 443 -> $code (served by whichever server is default; on contabo6 not ours)"
# rate limit
codes=$(for i in $(seq 1 80); do curl -sk -o /dev/null -w '%{http_code}\n' --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/nl/ & done; wait)
n429=$(echo "$codes" | grep -c 429); echo "80 parallel requests: $n429 got 429"
[ "$n429" -gt 0 ] && ok "rate limit answers 429" || bad "no 429 under load"
echo; echo "access log (shortened addresses):"; tail -3 /var/log/nginx/zangbundel.access.log
grep -qE '^127\.0\.0\.0 ' /var/log/nginx/zangbundel.access.log && ok "access log shortens the address" || bad "address not shortened"
grep -q 'zbm-check-headers\|curl' /var/log/nginx/zangbundel.access.log && bad "user agent in the log" || ok "no user agent in the log"
echo; echo "TOTAL: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
