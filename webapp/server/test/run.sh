#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# M0 test in a container like contabo6 (Ubuntu 24.04, nginx 1.24): build both static sites (the
# placeholder from a signed git tag, the holding page as a trial build), sign them with a THROWAWAY
# key made here, install the server files the way server/README.md says, then try good and bad
# uploads, the integrity check as its own user, and SC-01 for both hosts.
#
#   docker build -t zbm-m0test webapp/server/test
#   docker run --rm -v "$PWD:/repo:ro" zbm-m0test bash /repo/webapp/server/test/run.sh
#
# (Git Bash on Windows: prefix docker run with MSYS_NO_PATHCONV=1.) Self-signed certificates;
# nothing here touches DNS, certbot, systemd or sshd. Every check either passes or fails and is
# counted; the exit status is 0 only if every check passed.
set -u
pass=0; fail=0
ok()  { echo "PASS  $*"; pass=$((pass+1)); }
bad() { echo "FAIL  $*"; fail=$((fail+1)); }
# check NAME CMD...           : CMD must succeed
check() { local n="$1"; shift; if "$@" >/tmp/out 2>&1; then ok "$n"; else bad "$n"; sed 's/^/        /' /tmp/out | tail -5; fi; }
# refused NAME PATTERN CMD... : CMD must fail AND say PATTERN (a traceback or a missing file is not a refusal)
refused() { local n="$1" p="$2"; shift 2
  if "$@" >/tmp/out 2>&1; then bad "$n: was accepted"
  elif grep -q -- "$p" /tmp/out && ! grep -q Traceback /tmp/out; then ok "$n: $(grep -m1 -- "$p" /tmp/out | cut -c1-90)"
  else bad "$n: failed, but not with '$p'"; sed 's/^/        /' /tmp/out | tail -5; fi; }
cleanup() { [ -n "${kuma_pid:-}" ] && kill "$kuma_pid" 2>/dev/null; nginx -s stop 2>/dev/null; }
trap cleanup EXIT
wait_for() { for _ in $(seq 1 50); do "$@" >/dev/null 2>&1 && return 0; sleep 0.1; done; return 1; }

S=/repo/webapp/server
W=/work; mkdir -p $W/rk $W/dist $W/tools
nginx -v 2>&1; python3 --version; ssh -V 2>&1

# --- keys: a throwaway release key and a throwaway tag-signing key ---
ssh-keygen -q -t ed25519 -N '' -C 'THROWAWAY release key' -f $W/rk/test-release
ssh-keygen -q -t ed25519 -N '' -C 'THROWAWAY tag key' -f $W/rk/tag-key
git config --global user.name 'Test Owner'; git config --global user.email 'owner@example.invalid'
git config --global gpg.format ssh; git config --global user.signingkey $W/rk/tag-key.pub
echo "owner@example.invalid $(cut -d' ' -f1,2 $W/rk/tag-key.pub)" > $W/rk/tag-signers
git config --global gpg.ssh.allowedSignersFile $W/rk/tag-signers
cp /repo/webapp/tools/build.py /repo/webapp/tools/bundle.py /repo/webapp/tools/vendor.py /repo/webapp/tools/sign-release.sh $W/tools/
cp $W/rk/test-release.pub $W/tools/release-key.pub

check "build.py refuses unsafe pages, builds a valid one" python3 /repo/webapp/tests/test_build.py /repo/webapp/tools/build.py
check "bundler: same as native ES modules, refusals (test_bundle.py)" python3 /repo/webapp/tests/test_bundle.py
check "vendored packages match VENDOR.md and work bundled (test_vendor.py)" sh -c "cp -r /repo/webapp /tmp/webapp-rw && python3 /tmp/webapp-rw/tests/test_vendor.py"
check "bundled library engine = native engine on all 56 test libraries" sh -c "[ -d /tmp/test-libraries ] || cp -r /repo/test-libraries /tmp/test-libraries; NODE_OPTIONS=--experimental-global-webcrypto python3 /tmp/webapp-rw/tests/test_engine_bundle.py"
check "node --test: unit tests and the test-library corpus" sh -c "{ [ -d /tmp/test-libraries ] || cp -r /repo/test-libraries /tmp/test-libraries; } && mkdir -p /tmp/design && cp /repo/design/FDS.md /tmp/design/ && node --experimental-global-webcrypto --test /tmp/webapp-rw/tests/"   # Node 18 (apt): crypto is global from Node 19

# --- build: placeholder from a signed tag (SR-10, SR-90), holding page as a trial build ---
mkdir -p $W/src/webapp && cp -r /repo/webapp/placeholder /repo/webapp/test-holding /repo/webapp/maintenance /repo/webapp/tools /repo/webapp/src /repo/webapp/vendor $W/src/webapp/
rm -rf $W/src/webapp/tools/release-key.pub $W/src/webapp/tools/__pycache__
git -C $W/src init -q -b main && git -C $W/src add -A && git -C $W/src commit -q -m 'test source'
refused "build without a signed tag" "no tag with a valid signature" \
  python3 $W/src/webapp/tools/build.py build --src $W/src/webapp/placeholder --name placeholder --version 0.1.0 --out $W/dist/x
git -C $W/src tag -s v0.1.0 -m 'test tag'
check "build placeholder from signed tag" \
  python3 $W/src/webapp/tools/build.py build --src $W/src/webapp/placeholder --name placeholder --version 0.1.0 --out $W/dist/placeholder-0.1.0
check "manifest names the tag" grep -q '"source_tag": "v0.1.0"' $W/dist/placeholder-0.1.0/release-manifest.json
check "build the maintenance page from the signed tag (SR-93)" \
  python3 $W/src/webapp/tools/build.py build --src $W/src/webapp/maintenance --name maintenance --version 0.1.0 --out $W/dist/maintenance-0.1.0
# the manager as a release for zangbundel.nl (v0.2.0 on): from the same signed tag, never a trial
check "build the manager from the signed tag" \
  python3 $W/src/webapp/tools/build.py build --src $W/src/webapp/src --name manager --version "$(sed -n "s/^export const VERSION = '\(.*\)';/\1/p" /repo/webapp/src/app/version.js)" --out $W/dist/manager-release
check "the manager's manifest names the tag" grep -q '"source_tag": "v0.1.0"' $W/dist/manager-release/release-manifest.json
check "the manager release holds the privacy pages" sh -c "ls $W/dist/manager-release/nl/privacy.html $W/dist/manager-release/en/privacy.html $W/dist/manager-release/de/privacy.html" 
check "trial build of test-holding" \
  python3 /repo/webapp/tools/build.py build --src /repo/webapp/test-holding --name test-holding --version 0.1.0 --out $W/dist/test-holding-0.1.0 --allow-dirty
check "trial build of the manager (bundled, TD-22)" \
  python3 /repo/webapp/tools/build.py build --src /repo/webapp/src --name manager --version "$(sed -n "s/^export const VERSION = '\\(.*\\)';/\\1/p" /repo/webapp/src/app/version.js)" --out $W/dist/manager --allow-dirty
check "manager release holds bundles only, no JS source (main + workers, hashed names in assets/)" sh -c "ls $W/dist/manager/assets/main.*.js && test -z \"\$(find $W/dist/manager -name '*.js' | grep -Ev '/assets/[a-z-]+\.[0-9a-f]{12}\.js\$')\""
check "a second build of the manager is byte-identical (SR-10)" sh -c "python3 /repo/webapp/tools/build.py build --src /repo/webapp/src --name manager --version \$(sed -n \"s/^export const VERSION = '\\\\(.*\\\\)';/\\\\1/p\" /repo/webapp/src/app/version.js) --out /tmp/manager2 --allow-dirty >/dev/null && diff -r $W/dist/manager /tmp/manager2"
check "sign and pack manager" bash $W/tools/sign-release.sh $W/dist/manager $W/rk/test-release
check "sign and pack the manager release" bash $W/tools/sign-release.sh $W/dist/manager-release $W/rk/test-release
for n in placeholder test-holding maintenance; do
  check "sign and pack $n" bash $W/tools/sign-release.sh $W/dist/$n-0.1.0 $W/rk/test-release
done

# --- install (README steps 4, 6, 8) ---
install -m 0644 $S/nginx/conf.d/zangbundel.conf /etc/nginx/conf.d/
install -m 0644 $S/nginx/snippets/zbm-*.conf /etc/nginx/snippets/
install -m 0644 $S/nginx/sites-available/*.conf /etc/nginx/sites-available/
for f in zangbundel-http.conf zangbundel.nl.conf test.zangbundel.nl.conf; do ln -sf ../sites-available/$f /etc/nginx/sites-enabled/$f; done
install -m 0755 $S/bin/zbm-receive /usr/local/bin/zbm-receive
install -m 0755 $S/bin/zbm-release /usr/local/sbin/zbm-release
install -m 0644 $S/logrotate/zangbundel /etc/logrotate.d/zangbundel
install -d -m 0755 -o root -g adm /var/log/nginx/zangbundel
mkdir -p /var/www/acme /etc/zangbundel /srv/zangbundel/releases /srv/zangbundel-test/releases /srv/zangbundel-staging/incoming
useradd --system --create-home --shell /bin/bash zbm-deploy
useradd --system --no-create-home --shell /usr/sbin/nologin zbm-verify
chown zbm-deploy:zbm-deploy /srv/zangbundel-staging/incoming; chmod 0750 /srv/zangbundel-staging/incoming
printf 'release@zangbundel.nl namespaces="zangbundel-release" %s\n' "$(cut -d' ' -f1,2 $W/rk/test-release.pub)" > /etc/zangbundel/allowed_signers
chmod 0644 /etc/zangbundel/allowed_signers
htpasswd -B -b -c /etc/nginx/zangbundel-test.htpasswd tester 'test-only-pw' 2>/dev/null
chown root:www-data /etc/nginx/zangbundel-test.htpasswd; chmod 0640 /etc/nginx/zangbundel-test.htpasswd
mkdir -p /etc/zbmtest
for h in zangbundel.nl test.zangbundel.nl snakeoil; do
  d=/etc/letsencrypt/live/$h; [ $h = snakeoil ] && d=/etc/zbmtest/snakeoil; mkdir -p $d
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=$h" -addext "subjectAltName=DNS:$h" \
    -keyout $d/privkey.pem -out $d/fullchain.pem 2>/dev/null
done
# contabo6's neighbours: a default 443 server that drops unknown names (return 444) and another
# vhost that switches HTTP/2 on for the whole socket (as console.rfsee.net does).
cat > /etc/nginx/sites-enabled/00-contabo-like <<'EOF'
server { listen 443 ssl default_server; listen [::]:443 ssl default_server;
         ssl_certificate /etc/zbmtest/snakeoil/fullchain.pem; ssl_certificate_key /etc/zbmtest/snakeoil/privkey.pem; return 444; }
server { listen 443 ssl http2; server_name console.example;
         ssl_certificate /etc/zbmtest/snakeoil/fullchain.pem; ssl_certificate_key /etc/zbmtest/snakeoil/privkey.pem; return 200 "other site\n"; }
EOF

# --- upload as the deploy user through the forced command, activate as root ---
check "zbm-receive stores an upload" su zbm-deploy -c '/usr/local/bin/zbm-receive' < $W/dist/placeholder-0.1.0.tar
up=$(ls /srv/zangbundel-staging/incoming/upload-*.tar | head -1)
check "activate zangbundel.nl (signed tag)" zbm-release activate zangbundel.nl "$up"
refused "trial build to zangbundel.nl" "trial build" zbm-release activate --trial zangbundel.nl $W/dist/test-holding-0.1.0.tar
refused "trial build without --trial" "trial build" zbm-release activate test.zangbundel.nl $W/dist/test-holding-0.1.0.tar
check "activate --trial test.zangbundel.nl" zbm-release activate --trial test.zangbundel.nl $W/dist/test-holding-0.1.0.tar
check "re-activating the same release" zbm-release activate zangbundel.nl "$up"
check "live points at the release" test -f /srv/zangbundel/live/nl/index.html
check "release files root-owned 0644" test "$(stat -c '%U %a' /srv/zangbundel/releases/placeholder-0.1.0/nl/index.html)" = "root 644"
refused "www-data cannot write the release" "Permission denied" su www-data -s /bin/sh -c 'touch /srv/zangbundel/live/nl/x'
refused "deploy user cannot write the release" "Permission denied" su zbm-deploy -c 'touch /srv/zangbundel/live/nl/x'
refused "deploy user cannot activate" "runs as root" su zbm-deploy -c "zbm-release activate zangbundel.nl $up"

# --- refused uploads ---
T=/tmp/evil; rm -rf $T; mkdir -p $T
check "make the bad uploads" python3 - <<'PY'
import io, tarfile, os
src = '/work/dist/placeholder-0.1.0.tar'
def rewrite(dst, mutate=lambda m, d: (m, d), extra=None):
    with tarfile.open(src) as t, tarfile.open(dst, 'w') as o:
        for m in t.getmembers():
            m2, data = mutate(m, t.extractfile(m).read())
            if m2 is None: continue
            m2.size = len(data); o.addfile(m2, io.BytesIO(data))
        if extra: extra(o)
def add(o, name, body=b'x', typ=tarfile.REGTYPE, link=''):
    i = tarfile.TarInfo(name); i.type = typ; i.linkname = link; i.size = len(body) if typ == tarfile.REGTYPE else 0
    o.addfile(i, io.BytesIO(body) if typ == tarfile.REGTYPE else None)
rewrite('/tmp/evil/changed-file.tar', lambda m, d: (m, d.replace(b'In aanbouw', b'Gehackt!!!')) if m.name == 'nl/index.html' else (m, d))
rewrite('/tmp/evil/changed-manifest.tar', lambda m, d: (m, d.replace(b'"version": "0.1.0"', b'"version": "0.1.1"')) if m.name == 'release-manifest.json' else (m, d))
rewrite('/tmp/evil/no-signature.tar', lambda m, d: (None, d) if m.name.endswith('.sig') else (m, d))
rewrite('/tmp/evil/traversal.tar', extra=lambda o: add(o, '../../etc/evil'))
rewrite('/tmp/evil/symlink.tar', extra=lambda o: add(o, 'nl/link.html', typ=tarfile.SYMTYPE, link='/etc/shadow'))
rewrite('/tmp/evil/hardlink.tar', extra=lambda o: add(o, 'nl/hard.html', typ=tarfile.LNKTYPE, link='nl/index.html'))
rewrite('/tmp/evil/extra-file.tar', extra=lambda o: add(o, 'nl/extra.html', b'<p>extra</p>'))
rewrite('/tmp/evil/file-then-dir.tar', extra=lambda o: (add(o, 'zz'), add(o, 'zz/index.html')))
for f in os.listdir('/tmp/evil'): assert os.path.getsize('/tmp/evil/' + f) > 0
PY
refused "changed file"       "file differs from the manifest" zbm-release activate test.zangbundel.nl $T/changed-file.tar
refused "changed manifest"   "does not verify"                zbm-release activate test.zangbundel.nl $T/changed-manifest.tar
refused "no signature"       "missing release-manifest.json.sig" zbm-release activate test.zangbundel.nl $T/no-signature.tar
refused "path traversal"     "unsafe path"                    zbm-release activate test.zangbundel.nl $T/traversal.tar
refused "symbolic link"      "not a regular file"             zbm-release activate test.zangbundel.nl $T/symlink.tar
refused "hard link"          "not a regular file"             zbm-release activate test.zangbundel.nl $T/hardlink.tar
refused "unlisted file"      "files not in the manifest"      zbm-release activate test.zangbundel.nl $T/extra-file.tar
refused "file, then dir"     "cannot unpack"                  zbm-release activate test.zangbundel.nl $T/file-then-dir.tar
# a mistyped upload name is refused plainly and names what is waiting, so the owner can copy the right one
refused "no such upload"     "no such upload"                 zbm-release activate --trial test.zangbundel.nl /tmp/REPLACE-ME.tar
refused "it lists the waiting uploads" "newest first: upload-" zbm-release activate --trial test.zangbundel.nl /tmp/REPLACE-ME.tar
printf 'no tar here\n' > $T/junk.tar
refused "not a tar archive"  "not a readable uncompressed tar" zbm-release activate --trial test.zangbundel.nl $T/junk.tar
refused "upload is a directory" "not a regular file"          zbm-release activate --trial test.zangbundel.nl /tmp
check "nothing named evil written anywhere" test -z "$(find / -xdev -type f -name evil -not -path '/proc/*' 2>/dev/null)"
ssh-keygen -q -t ed25519 -N '' -f /tmp/otherkey
mkdir -p /tmp/other && tar -C /tmp/other -xf $W/dist/placeholder-0.1.0.tar && rm /tmp/other/release-manifest.json.sig
ssh-keygen -q -Y sign -f /tmp/otherkey -n zangbundel-release /tmp/other/release-manifest.json
tar -C /tmp/other -cf $T/other-key.tar .
refused "signed by another key" "does not verify" zbm-release activate test.zangbundel.nl $T/other-key.tar
check "live unchanged after the refusals" test "$(readlink /srv/zangbundel-test/live)" = releases/test-holding-0.1.0

# --- the forced command's limits ---
refused "oversize upload" "larger than" sh -c "head -c $((50*1024*1024 + 10)) /dev/zero | su zbm-deploy -c /usr/local/bin/zbm-receive"
I=/srv/zangbundel-staging/incoming
rx() { su zbm-deploy -c /usr/local/bin/zbm-receive; }
refused "truncated upload" "cut short" sh -c "head -c 3000 $W/dist/placeholder-0.1.0.tar | su zbm-deploy -c /usr/local/bin/zbm-receive"
python3 -c "
import io, tarfile
b = io.BytesIO()
with tarfile.open(fileobj=b, mode='w', format=tarfile.USTAR_FORMAT) as t:
    for n in ('a', 'b', 'c'):
        d = n.encode() * 600; i = tarfile.TarInfo(n); i.size = len(d); t.addfile(i, io.BytesIO(d))
open('/tmp/cut.tar', 'wb').write(b.getvalue()[:2048])   # header + data of 'a' only: lists fine, no end marker
"
refused "tar cut at a member boundary" "cut short" sh -c "su zbm-deploy -c /usr/local/bin/zbm-receive < /tmp/cut.tar"
refused "compressed upload" "not an uncompressed tar" sh -c "gzip -c $W/dist/placeholder-0.1.0.tar | su zbm-deploy -c /usr/local/bin/zbm-receive"
refused "zbm-receive run as root" "not as root" sh -c "/usr/local/bin/zbm-receive < $W/dist/placeholder-0.1.0.tar"
mkdir -p /tmp/held && mv $I/upload-*.tar /tmp/held/          # quota tests start from an empty staging dir
for i in $(seq 1 20); do su zbm-deploy -c "touch $I/upload-q$i.tar"; done
refused "20 uploads waiting" "uploads are waiting" sh -c "su zbm-deploy -c /usr/local/bin/zbm-receive < $W/dist/placeholder-0.1.0.tar"
rm -f $I/upload-q*.tar
su zbm-deploy -c "truncate -s 200M $I/upload-big.tar"
refused "200 MB waiting" "bytes are waiting" sh -c "su zbm-deploy -c /usr/local/bin/zbm-receive < $W/dist/placeholder-0.1.0.tar"
su zbm-deploy -c "truncate -s $((200*1024*1024 - 50*1024)) $I/upload-big.tar"
refused "upload would pass 200 MB" "would hold more" sh -c "su zbm-deploy -c /usr/local/bin/zbm-receive < $W/dist/placeholder-0.1.0.tar"
rm -f $I/upload-big.tar
mv /tmp/held/upload-*.tar $I/
( { sleep 2; cat $W/dist/placeholder-0.1.0.tar; } | su zbm-deploy -c /usr/local/bin/zbm-receive >/tmp/slow.out 2>&1 ) &
slow=$!
check "the slow upload holds the lock" wait_for sh -c "! flock -n $I/.lock true"
refused "second upload while one runs" "another upload is in progress" sh -c "su zbm-deploy -c /usr/local/bin/zbm-receive < $W/dist/placeholder-0.1.0.tar"
wait $slow; check "the slow upload completed" grep -q '^received' /tmp/slow.out

# --- root's umask does not matter (round-2 review) ---
rm -rf /srv/zangbundel-test/releases/test-holding-0.1.0 /srv/zangbundel-test/live
check "activate with root umask 002" sh -c "umask 002; zbm-release activate --trial test.zangbundel.nl $W/dist/test-holding-0.1.0.tar"
rm -rf /srv/zangbundel-test/releases /srv/zangbundel-test/live
check "activate with root umask 077" sh -c "umask 077; zbm-release activate --trial test.zangbundel.nl $W/dist/test-holding-0.1.0.tar"
check "release dirs readable after umask 077" test "$(stat -c %a /srv/zangbundel-test/releases)" = 755

# --- integrity check as its own user (SR-73), with the push to a stand-in for Uptime Kuma ---
python3 -c "
import http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        open('/tmp/push.log','a').write(self.path+'\n'); self.send_response(200); self.end_headers(); self.wfile.write(b'{\"ok\":true}')
    def log_message(self,*a): pass
http.server.HTTPServer(('127.0.0.1',3001),H).serve_forever()" >/dev/null 2>&1 &
kuma_pid=$!
wait_for curl -s http://127.0.0.1:3001/ready
mkdir -p /run/zbmcreds && echo 'http://127.0.0.1:3001/api/push/TESTTOKEN?status=up&msg=OK&ping=' > /run/zbmcreds/kuma-push-url
chown -R zbm-verify /run/zbmcreds && chmod 0500 /run/zbmcreds && chmod 0400 /run/zbmcreds/kuma-push-url
as_verify() { setpriv --reuid=zbm-verify --regid=zbm-verify --clear-groups env CREDENTIALS_DIRECTORY=/run/zbmcreds "$@"; }
R=/srv/zangbundel/releases/placeholder-0.1.0
check "verify as zbm-verify: intact" as_verify zbm-release verify
check "push: up sent" grep -q 'status=up' /tmp/push.log
cp $R/nl/index.html /tmp/keep.html; echo '<!-- changed -->' >> $R/nl/index.html
refused "verify: changed live file" "file differs from the manifest" as_verify zbm-release verify
check "push: down sent with the reason" grep -q 'status=down.*differs' /tmp/push.log
cp /tmp/keep.html $R/nl/index.html
mkdir -m 0711 $R/evil && echo '<h1>phish</h1>' > $R/evil/login.html && chmod 0644 $R/evil/login.html
refused "verify: file hidden in an unreadable dir" "cannot read" as_verify zbm-release verify
rm -r $R/evil
touch $R/planted.html
refused "verify: planted file" "files not in the manifest" as_verify zbm-release verify
rm $R/planted.html
chmod 0666 $R/nl/privacy.html
refused "verify: world-writable file" "writable by others" as_verify zbm-release verify
chmod 0644 $R/nl/privacy.html
check "verify: intact again after restore" as_verify zbm-release verify

# --- nginx ---
check "nginx -t" nginx -t
nginx
check "nginx answers" wait_for curl -fsk --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/
# v0.2.0: the manager replaces the placeholder on zangbundel.nl, as a signed release, not a trial
check "activate the manager release on zangbundel.nl" zbm-release activate zangbundel.nl $W/dist/manager-release.tar
check "live on zangbundel.nl is the manager" sh -c "readlink /srv/zangbundel/live | grep -q '^releases/manager-'"
check "/ is the manager's page, no front door" sh -c "curl -sk --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/ | grep -q 'assets/main\.'"
echo; echo "=== SC-01 zangbundel.nl ==="
check "SC-01 zangbundel.nl with the manager (--app)" python3 /repo/webapp/tools/check_headers.py zangbundel.nl --connect 127.0.0.1:443 --http-connect 127.0.0.1:80 --insecure --app
grep -E '^(PASS|FAIL)|^        -' /tmp/out | grep -v '^PASS' | head -20
# SR-93: the incident step. The maintenance page goes live in one command and the manager comes back with switch
MV="$(sed -n "s/^export const VERSION = '\(.*\)';/\1/p" /repo/webapp/src/app/version.js)"
check "incident: the maintenance page goes live on zangbundel.nl" zbm-release activate zangbundel.nl $W/dist/maintenance-0.1.0.tar
check "incident: / says unavailable and loads no script" sh -c "curl -sk --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/ > /tmp/maint.html && grep -q 'Tijdelijk niet beschikbaar' /tmp/maint.html && ! grep -qi '<script' /tmp/maint.html"
check "incident: the privacy statement stays reachable" sh -c "curl -sfk --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/en/privacy.html | grep -q 'Privacy'"
check "incident: verify as zbm-verify with the maintenance page live" as_verify zbm-release verify
check "incident: switch back to the manager" zbm-release switch zangbundel.nl manager-$MV
check "incident: / is the manager again" sh -c "curl -sk --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/ | grep -q 'assets/main\.'"
echo; echo "=== SC-01 test.zangbundel.nl ==="
check "SC-01 test.zangbundel.nl (holding page, app CSP)" python3 /repo/webapp/tools/check_headers.py test.zangbundel.nl --connect 127.0.0.1:443 --http-connect 127.0.0.1:80 --insecure --auth tester:test-only-pw --app --report /tmp/report/sc01.md
grep -E '^(PASS|FAIL)|^        -' /tmp/out | grep -v '^PASS' | head -20
check "SC-01 report written" test -s /tmp/report/sc01.md
# M1.4: the minimal manager on the test instance
check "activate --trial the manager on test.zangbundel.nl" zbm-release activate --trial test.zangbundel.nl $W/dist/manager.tar
check "live on test.zangbundel.nl is the manager" sh -c "readlink /srv/zangbundel-test/live | grep -q '^releases/manager-'"
check "SC-01 test.zangbundel.nl with the manager (--app)" python3 /repo/webapp/tools/check_headers.py test.zangbundel.nl --connect 127.0.0.1:443 --http-connect 127.0.0.1:80 --insecure --auth tester:test-only-pw --app --report /tmp/report/sc01-manager.md
check "verify as zbm-verify with the manager live" as_verify zbm-release verify
grep -E '^(PASS|FAIL)|^        -' /tmp/out | grep -v '^PASS' | head -20
b=$(grep -o '<script[^>]*>' /srv/zangbundel-test/live/index.html | grep -o 'src="[^"]*"' | cut -d'"' -f2)
curl -sk -u tester:test-only-pw --resolve test.zangbundel.nl:443:127.0.0.1 "https://test.zangbundel.nl/$b" -o /tmp/bundle.js
check "the bundle is served with its SRI hash" python3 -c "
import re, base64, hashlib
html = open('/srv/zangbundel-test/live/index.html', encoding='utf-8').read()
want = re.search(r'<script[^>]*integrity=\"([^\"]+)\"', html).group(1)
got = 'sha384-' + base64.b64encode(hashlib.sha384(open('/tmp/bundle.js', 'rb').read()).digest()).decode()
assert want == got and len(open('/tmp/bundle.js', 'rb').read()) > 1000, (want, got)"
curl -skI --http2 --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/ > /tmp/h2.txt
check "HTTP/2 on the shared socket, headers intact" sh -c "grep -q '^HTTP/2 200' /tmp/h2.txt && grep -qi '^content-security-policy: default-src' /tmp/h2.txt && grep -qi '^cross-origin-embedder-policy: require-corp' /tmp/h2.txt"
code=$(curl -sk -o /dev/null -w '%{http_code}' -u tester:wrong --resolve test.zangbundel.nl:443:127.0.0.1 https://test.zangbundel.nl/)
check "wrong password: 401" test "$code" = 401
check "a failed login is in the error log (privacy statement says so)" grep -q 'password mismatch' /var/log/nginx/zangbundel/test.error.log
curl -sk -o /dev/null --resolve other.example:443:127.0.0.1 https://other.example/; rc=$?
check "unknown name: default server closes (444), nginx still up" sh -c "case $rc in 52|92|16) pgrep -x nginx >/dev/null ;; *) echo curl exit $rc; exit 1 ;; esac"
codes=$(for i in $(seq 1 80); do curl -sk -o /dev/null -w '%{http_code}\n' --resolve zangbundel.nl:443:127.0.0.1 https://zangbundel.nl/ & done; wait)
check "rate limit answers 429 under 80 parallel requests" test "$(echo "$codes" | grep -c 429)" -gt 0
check "access log written" test -s /var/log/nginx/zangbundel/access.log
check "access log shortens the address" grep -qE '^127\.0\.0\.0 ' /var/log/nginx/zangbundel/access.log
check "no full address in the access log" sh -c "! grep -q '127\.0\.0\.1' /var/log/nginx/zangbundel/access.log"
check "no user agent in the access log" sh -c "! grep -qE 'curl|zbm-check-headers|python' /var/log/nginx/zangbundel/access.log"

# --- logrotate keeps 14 days, quiet logs included (SR-51) ---
check "logrotate stanza parses" logrotate -d /etc/logrotate.d/zangbundel
for i in $(seq 1 16); do logrotate -f -s /tmp/lr.state /etc/logrotate.d/zangbundel >/dev/null 2>&1; done
check "16 forced rotations leave the log and 13 old copies" test "$(ls /var/log/nginx/zangbundel/ | grep -c '^access\.log')" -eq 14

echo; echo "TOTAL: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
