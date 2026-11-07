# Server set-up for zangbundel.nl and test.zangbundel.nl (milestone M0)

The owner's runbook for `design/implementationPlan.md` M0 on contabo6 (169.58.68.107, Ubuntu, nginx 1.24). Every step names the requirement it meets (`design/securityAssessment.md`). The files in this folder are the source; once installed, copy the live versions into `../contabo-vps-6` as for the other sites (SR-75).

Tested on 2026-11-06 in an Ubuntu 24.04 container with its nginx 1.24.0, Python 3.12, OpenSSH 9.6 and git, using self-signed certificates and throwaway keys; 81 of 81 checks passed. The test:

- builds the placeholder from a signed git tag and the holding page as a trial build, then signs both;
- runs `webapp/tests/test_build.py` (25 unsafe pages or modules refused, one valid page built), `test_bundle.py`, `test_vendor.py`, `test_engine_bundle.py` and `node --test webapp/tests/`;
- builds the manager (`webapp/src`) twice as a trial and compares the bytes, activates it on the test instance, runs SC-01 with `--app` and the hourly check, and checks the served bundle against its SRI hash;
- installs the nginx, script and logrotate files of steps 4 and 6 (not the systemd units, sshd, authorized_keys or the deploy user's password field);
- uploads through the forced command and activates as root;
- tries nine kinds of bad upload, two misplaced trial builds, eight upload limits of `zbm-receive` (size, cut short twice, compressed, run as root, 20 waiting, 200 MB waiting, 200 MB passed) and parallel uploads;
- activates with root umask 002 and 077;
- runs the integrity check as `zbm-verify`, with a push, against four kinds of tampering;
- serves both hosts next to a contabo6-like default server and an HTTP/2 neighbour, and runs SC-01 for both.

- runs logrotate on the new stanza 16 times and checks that 13 old copies remain.

Not tested there: DNS, real certificates, certbot, systemd itself, sshd, and the real host's other sites.

Rerun the test after any change in this folder or in `webapp/tools/` (needs Docker; on Git Bash, put `MSYS_NO_PATHCONV=1` before `docker run`):

```bash
docker build -t zbm-m0test webapp/server/test
```

```bash
docker run --rm -v "$PWD:/repo:ro" zbm-m0test bash /repo/webapp/server/test/run.sh
```

## What goes where

| File in this repository | On contabo6 | Owner, mode |
|---|---|---|
| `server/nginx/conf.d/zangbundel.conf` | `/etc/nginx/conf.d/zangbundel.conf` | root, 0644 |
| `server/nginx/snippets/zbm-*.conf` (5 files) | `/etc/nginx/snippets/` | root, 0644 |
| `server/nginx/sites-available/*.conf` (3 files) | `/etc/nginx/sites-available/`, linked from `sites-enabled/` | root, 0644 |
| `server/bin/zbm-receive` | `/usr/local/bin/zbm-receive` | root, 0755 |
| `server/bin/zbm-release` | `/usr/local/sbin/zbm-release` | root, 0755 |
| `server/systemd/zbm-verify.service`, `.timer` | `/etc/systemd/system/` | root, 0644 |
| `server/logrotate/zangbundel` | `/etc/logrotate.d/zangbundel` | root, 0644 |
| `tools/release-key.pub` (step 3) | inside `/etc/zangbundel/allowed_signers` | root, 0644 |
| (made on the server) | `/etc/nginx/zangbundel-test.htpasswd` | root:www-data, 0640 |
| (made on the server) | `/etc/zangbundel/kuma-push-url` | root, 0600 |

Directories: `/srv/zangbundel/releases/` and `/srv/zangbundel-test/releases/` (root, 0755; `live` is a symlink to one release), `/srv/zangbundel-staging/incoming/` (zbm-deploy, 0750), `/var/www/acme/` (root, 0755). Users: `zbm-deploy` (uploads only) and `zbm-verify` (runs the hourly check).

## 1. DNS at Openprovider (M0.1, SR-03, SR-07, SC-12)

| Name | Type | Value |
|---|---|---|
| `zangbundel.nl.` | A | `169.58.68.107` (replaces `127.0.0.1`) |
| `test.zangbundel.nl.` | A | `169.58.68.107` |
| `zangbundel.nl.` | MX | none: delete `10 mail.zangbundel.nl`. Openprovider refuses the null MX `0 .` (SR-07, deviation of 2026-11-07) |
| `zangbundel.nl.` | TXT | `v=spf1 -all` |
| `_dmarc.zangbundel.nl.` | TXT | `v=DMARC1; p=reject; adkim=s; aspf=s` |
| `*._domainkey.zangbundel.nl.` | TXT | `v=DKIM1; p=` |
| `zangbundel.nl.` | CAA | `0 issue "letsencrypt.org"`; the `accounturi` is added in step 5 |
| `zangbundel.nl.` | CAA | `0 issuewild ";"` |
| `zangbundel.nl.` | CAA | `0 iodef "mailto:<an address the owner reads>"` |

- **Delete the parked records** the domain came with: `mail` (A `127.0.0.1`), and the CNAMEs `ftp`, `webmail` and `www`. nginx serves no such names and the certificates do not cover them.
- **Port 25 must stay closed.** Without an MX, a sender tries the A record. Check from outside: `nc -vz -w 5 169.58.68.107 25` must be refused or time out.
- **AAAA only if IPv6 works.** contabo6 had no IPv6 address on 2026-11-06; on 2026-11-07 it showed `2a02:c207:2346:2578::1`, and nginx listens on `[::]:80` and `[::]:443`, so the check below decides. Add AAAA records only when `ip -6 addr show scope global` shows one and `curl -6 https://zangbundel.nl/` works from another network. A broken AAAA record is worse than none.
- **CAA covers `test.zangbundel.nl` as well**, because CAA is inherited by subdomains.
- **Check.** `dig +dnssec zangbundel.nl A MX TXT CAA`, `dig test.zangbundel.nl A`, `dig _dmarc.zangbundel.nl TXT`. Then check the DNSSEC chain at https://dnsviz.net/d/zangbundel.nl/dnssec/.

## 2. Registrar (M0.2, SR-05)

1. Confirm two-factor authentication on the registrar account; the DNS account already has it.
2. Make sure the registrant e-mail address is one you read: a transfer token goes there.
3. There is no transfer lock to set. A `.nl` domain has none, so `whois zangbundel.nl` keeps showing only `Status: active` (SR-05, deviation of 2026-11-07).

*Done 2026-11-07:* step 1 and step 2 (two-factor authentication on; DNS checked from outside).

## 3. Keys, on the owner's computer (M0.7, SR-11, SR-74)

There are three keys. A release key signs releases. A deploy key may only upload. Your git signing key signs release tags; the build refuses a tree without a signed tag (SR-10, SR-90). No private key ever goes to the server.

```bash
ssh-keygen -t ed25519 -C "zangbundel release key" -f ~/.ssh/zangbundel-release
```

```bash
ssh-keygen -t ed25519 -C "zangbundel deploy" -f ~/.ssh/zangbundel-deploy
```

*Done 2026-11-07:* both keys made on the owner's computer, both with a passphrase. The first pair had been made on contabo6 by mistake and was shredded there unused. `webapp/tools/release-key.pub` is the release key's public half. Git tag signing (item 3) is still to do.

Run these on **your own computer**, not on the server: the server must never hold either private key. In the Windows command prompt `~` does not work; use Git Bash, or `%USERPROFILE%\.ssh\…`.

1. Give the release key a passphrase. Keep a copy of `~/.ssh/zangbundel-release` offline, for example on a USB stick in a drawer: without it, no new release can be activated.
2. Copy `~/.ssh/zangbundel-release.pub` to `webapp/tools/release-key.pub` and commit it. `sign-release.sh` checks every signature against that file.
3. Let git sign tags with an SSH key, if it does not already. Your usual key works; the allowed-signers file lets `git verify-tag` check the signature:

   ```bash
   git config --global gpg.format ssh && git config --global user.signingkey ~/.ssh/id_ed25519.pub
   ```

   ```bash
   test -n "$(git config user.email)" && test -s ~/.ssh/id_ed25519.pub && echo "$(git config user.email) $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" >> ~/.ssh/allowed_signers && git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers || echo "set user.email and make the key first" >&2
   ```

## 4. Install on contabo6 (M0.4 to M0.6)

Copy this folder and `tools/release-key.pub` to the server, for example to `~/zbm/`. Then, as root:

```bash
apt install apache2-utils        # htpasswd, for step 6
install -m 0644 ~/zbm/nginx/conf.d/zangbundel.conf /etc/nginx/conf.d/
install -m 0644 ~/zbm/nginx/snippets/zbm-*.conf /etc/nginx/snippets/
install -m 0644 ~/zbm/nginx/sites-available/*.conf /etc/nginx/sites-available/
install -m 0755 ~/zbm/bin/zbm-receive /usr/local/bin/
install -m 0755 ~/zbm/bin/zbm-release /usr/local/sbin/
install -m 0644 ~/zbm/systemd/zbm-verify.service ~/zbm/systemd/zbm-verify.timer /etc/systemd/system/
install -m 0644 ~/zbm/logrotate/zangbundel /etc/logrotate.d/zangbundel
install -d -m 0755 -o root -g adm /var/log/nginx/zangbundel
mkdir -p /var/www/acme /etc/zangbundel /srv/zangbundel/releases /srv/zangbundel-test/releases /srv/zangbundel-staging/incoming
```

**The release key.** Store it as the only trusted signer:

```bash
test -s ~/zbm/release-key.pub && printf 'release@zangbundel.nl namespaces="zangbundel-release" %s\n' "$(cut -d' ' -f1,2 ~/zbm/release-key.pub)" > /etc/zangbundel/allowed_signers || echo "missing ~/zbm/release-key.pub" >&2
```

**The user of the hourly check (SR-73).** It is not root and not www-data, and has no login:

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin zbm-verify
```

**The deploy user (SR-74).** It has no password and can run only `zbm-receive`. It keeps `/bin/bash` as its shell because sshd runs a forced command through the user's shell; with `nologin` the forced command would not run. What denies it a shell is `command=` in `authorized_keys`: whatever the client asks, sshd runs `zbm-receive`. `restrict` takes away the terminal and forwarding. The password field is `*`, which no password matches, so password logins are ruled out (securityAssessment 7.4). Not `passwd -l`: that writes `!`, and sshd then refuses the account altogether, keys included (`account is locked`), as found on contabo6 on 2026-11-07.

```bash
useradd --system --create-home --shell /bin/bash zbm-deploy
usermod -p '*' zbm-deploy
chown zbm-deploy:zbm-deploy /srv/zangbundel-staging/incoming && chmod 0750 /srv/zangbundel-staging/incoming
install -d -m 0700 -o zbm-deploy -g zbm-deploy /home/zbm-deploy/.ssh
```

Put the deploy key in `/home/zbm-deploy/.ssh/authorized_keys` (owner zbm-deploy, mode 0600) as **one** line:

```
restrict,command="/usr/local/bin/zbm-receive" ssh-ed25519 AAAA…(contents of zangbundel-deploy.pub)… zangbundel deploy
```

If `sshd_config` has an `AllowUsers` or `AllowGroups` line, add `zbm-deploy` to it, then run `sshd -t && systemctl reload ssh`.

**The bootstrap vhost.** Enable only the port-80 vhost for now: the 443 vhosts need certificates that don't exist yet.

```bash
ln -s ../sites-available/zangbundel-http.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

*Done 2026-11-07, except what needs step 3.* The owner ran the commands above as one script (`sudo bash ~/zbm/install-step4.sh`, written from this step).
- **Checked afterwards:**
  - the installed files equal this folder byte for byte, with the modes and owners of *What goes where*;
  - both users exist;
  - `htpasswd` is present, and nginx reloaded cleanly.
- **From outside:**
  - `http://zangbundel.nl/` and `http://test.zangbundel.nl/` redirect to `https://` with path and query;
  - `/.well-known/acme-challenge/` is served from `/var/www/acme`;
  - `Server: nginx` shows no version;
  - the log keeps anonymised addresses only.
- **The key parts, done the same day after step 3** (`sudo bash ~/zbm/install-step4-keys.sh`):
  - `/etc/zangbundel/allowed_signers` holds the release key only;
  - the deploy key is in `authorized_keys`;
  - `/etc/ssh/sshd_config` now reads `AllowUsers remko zbm-deploy`, with a backup in `sshd_config.bak-zbm`.
- **Tested from the owner's computer:** `ssh -n -i …/zangbundel-deploy zbm-deploy@rfsee.net id` answers `refused: nothing received` and runs no `id`. sshd logs `Accepted publickey for zbm-deploy`; `remko` still logs in.

## 5. Certificates (M0.3, SR-01, SR-03)

`certonly --webroot` means certbot never edits an nginx file, so it cannot drop the security headers the way `certbot --nginx` would (plan R-08).

```bash
certbot certonly --webroot -w /var/www/acme -d zangbundel.nl --deploy-hook "systemctl reload nginx"
```

```bash
certbot certonly --webroot -w /var/www/acme -d test.zangbundel.nl --deploy-hook "systemctl reload nginx"
```

```bash
certbot renew --dry-run
```

Next, the CAA account binding (SR-03):

1. Run `certbot show_account`. It prints the account URL, `https://acme-v02.api.letsencrypt.org/acme/acct/<id>`.
2. At Openprovider, change the `issue` record to `0 issue "letsencrypt.org;accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/<id>"`.
   - **No space after the `;`:** Openprovider refuses the form with a space ("Invalid CAA-record").
   - **The bare `0 issue "letsencrypt.org"` must go:** while it stays, it allows every Let's Encrypt account, and the binding does nothing.
3. Add a second `issue` record for certbot's **staging** account. `certbot renew --dry-run` runs against Let's Encrypt's staging server, which checks CAA too, under its own account. Get its URL with `certbot show_account --server https://acme-staging-v02.api.letsencrypt.org/directory`, then add `0 issue "letsencrypt.org;accounturi=https://acme-staging-v02.api.letsencrypt.org/acme/acct/<staging id>"`.
4. Check that all three name servers serve both records: `dig +short CAA zangbundel.nl @ns1.openprovider.nl`, and the same for `ns2.openprovider.be` and `ns3.openprovider.eu`. Openprovider signs and publishes a change with a delay.
5. Run `certbot renew --dry-run --cert-name zangbundel.nl` and `--cert-name test.zangbundel.nl`: both must succeed with the bound CAA.

*2026-11-07:* both certificates issued (`sudo bash ~/zbm/install-step5.sh`, written from this step):
- ECDSA keys from the production server, through the existing account `acct/112577467`;
- the webroot method, with `renew_hook = systemctl reload nginx`;
- renewed by the host's `certbot.timer`. Its other deploy hook, `chirpstack.sh`, acts only on the `rfsee.net` certificate.

Both CAA bindings are live on all three name servers, DNSSEC-validated: production `acct/112577467` and staging `acct/24760018`. With them, `certbot renew --dry-run` succeeded for both certificates. **Step 5 done.**

## 6. Enable both sites (M0.4, M0.5, SR-80)

```bash
htpasswd -B -c /etc/nginx/zangbundel-test.htpasswd <tester name>
chown root:www-data /etc/nginx/zangbundel-test.htpasswd && chmod 0640 /etc/nginx/zangbundel-test.htpasswd
ln -s ../sites-available/zangbundel.nl.conf ../sites-available/test.zangbundel.nl.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

- **Testers' accounts.** Add one account per tester with `htpasswd -B /etc/nginx/zangbundel-test.htpasswd <name>` (without `-c`). Remove one with `htpasswd -D`. Pass passwords on by phone or in person, not in the GitHub issue.
- **The default server.** Run `nginx -T | grep -n default_server`. The default server of port 443 must be another site's or a catch-all, not one of ours. Our two vhosts carry no `default_server` and must keep it that way. That default server also fixes the TLS versions on offer (`snippets/zbm-tls.conf` explains why).

*Done 2026-11-07* (`sudo bash ~/zbm/install-step6.sh <tester name>`, written from this step). It checks that the certificates exist, creates or extends the password file, and reloads nginx only if `nginx -t` passes and neither of our vhosts is a `default_server`. Checked from outside:
- **Certificates:** both are Let's Encrypt (YE1), each for its own name only, valid until 2027-02-05, and the chain verifies.
- **TLS:** 1.2 and 1.3 are offered; 1.0 and 1.1 are refused.
- **`zangbundel.nl`:** `/` redirects by language (302 to `/en/`).
- **`test.zangbundel.nl`:** asks for the password (401, realm "Zangbundel test"). Its `robots.txt` is open and says `Disallow: /`, and `X-Robots-Tag: noindex, nofollow` is set.
- **Headers:** every response carries the headers of `zbm-common-headers.conf`, with HSTS at `max-age=300` (step 9).
- **Until step 7:** both sites answer 404, as neither has a `live` release yet.

## 7. First releases (M0.8, SR-11, SR-84)

These steps run on the owner's computer, from a clean checkout of `main` whose HEAD carries a signed tag (step 3), for example `git tag -s placeholder-0.1.0 -m "Placeholder 0.1.0"`. The tag names the repository state; `--version` names the release. `build.py` refuses a HEAD not on `main`, a HEAD without a verified signed tag, and uncommitted, untracked or ignored files in the source or in `webapp/tools/`.

`--allow-dirty` makes a trial build, without those checks. `zbm-release` accepts a trial build only on the test instance, and only with `activate --trial test.zangbundel.nl …`.

```bash
python webapp/tools/build.py build --src webapp/placeholder --name placeholder --version 0.1.0
```

```bash
python webapp/tools/build.py build --src webapp/test-holding --name test-holding --version 0.1.0
```

```bash
bash webapp/tools/sign-release.sh dist/placeholder-0.1.0
```

```bash
bash webapp/tools/sign-release.sh dist/test-holding-0.1.0
```

```bash
ssh -i ~/.ssh/zangbundel-deploy zbm-deploy@169.58.68.107 < dist/placeholder-0.1.0.tar
```

```bash
ssh -i ~/.ssh/zangbundel-deploy zbm-deploy@169.58.68.107 < dist/test-holding-0.1.0.tar
```

Building the manager needs Node.js on PATH: the build checks each bundle with `node --check` (webappTDS TD-21, TD-22). The manager is built the same way once it is tagged, from `webapp/src` with `--name manager` and the version in `webapp/src/app/version.js`. Before that, `--allow-dirty` makes a trial build of it for the test instance only (`zbm-release activate --trial test.zangbundel.nl …`).

Each upload prints its file name in the staging directory. Then, on the server as root:

```bash
zbm-release activate zangbundel.nl /srv/zangbundel-staging/incoming/upload-<…>.tar
```

```bash
zbm-release activate test.zangbundel.nl /srv/zangbundel-staging/incoming/upload-<…>.tar
```

```bash
zbm-release list
```

- **What activation does.** `activate` refuses an upload when:
  - its signature fails;
  - its files differ from the manifest;
  - it holds unlisted files, links or unsafe paths;
  - it is a trial build going anywhere but the test instance.

  A release goes in read-only under `releases/<name>-<version>/` and becomes live by an atomic symlink switch. `zbm-release switch <site> <release>` goes back to an earlier release.
- **Clearing staging.** Delete processed uploads from the staging directory. `zbm-receive` takes one upload at a time. It refuses an upload when 20 uploads are already waiting, when staging would hold more than 200 MB with this one, or when what arrives is not an uncompressed tar with its end marker.

## 8. Integrity check and monitoring (M0.6, M0.9, SR-06, SR-62, SR-73)

1. In Uptime Kuma, add a monitor of type **Push** named "zangbundel integrity", with a heartbeat interval of 3900 s (just over an hour) and one retry. The timer keeps the same random delay every hour (`FixedRandomDelay`), so pushes arrive 3600 s apart.
2. Store its push URL, the whole URL Kuma shows:

   ```bash
   install -m 0600 /dev/null /etc/zangbundel/kuma-push-url && nano /etc/zangbundel/kuma-push-url
   ```

3. Start the timer and run the check once:

   ```bash
   systemctl daemon-reload && systemctl enable --now zbm-verify.timer && systemctl start zbm-verify.service && journalctl -u zbm-verify.service -n 5
   ```

Once that works, the monitor turns green. It turns red when a live file no longer matches its signed manifest, or when the hourly push stops.

Uptime Kuma runs on contabo6 itself, so it cannot see the host go down. Add from outside:

- **Availability (SR-62).** An external monitor on `https://zangbundel.nl/nl/` (keyword `Zangbundel`) and on `https://test.zangbundel.nl/robots.txt`, for example a free UptimeRobot account or a Kuma on another machine. Use certificate-expiry alerts where offered.
- **Certificate Transparency (SR-06).** A watch on `zangbundel.nl` including subdomains, for example SSLMate Cert Spotter (free for one domain). Any certificate not issued by our own certbot is an incident.

## 9. HSTS ramp (SR-02, SQ-03)

`snippets/zbm-common-headers.conf` starts at `max-age=300`. Raise it only after a clean period at each step, run `nginx -t && systemctl reload nginx`, and check with `check_headers.py --hsts-min <new value>`:

| Step | max-age | After |
|---|---|---|
| 1 | 300 (5 minutes) | start |
| 2 | 604800 (1 week) | a day without problems on both hosts |
| 3 | 2592000 (1 month) | a week |
| 4 | 31536000 (1 year) | a month |
| 5 | add `; preload`, submit at hstspreload.org | three months at one year (SQ-03) |

`includeSubDomains` covers every name under `zangbundel.nl`. Before raising the ramp, make sure no subdomain will ever need plain HTTP.

## 10. Release gate for M0 (SC-01, SC-02, SC-09, SC-12, SC-13)

Run these from the owner's computer and save the results in `design/test-results/` (one file per run; `--report` creates the folder):

```bash
python webapp/tools/check_headers.py zangbundel.nl --report design/test-results/<date>-sc01-zangbundel.nl.md
```

```bash
python webapp/tools/check_headers.py test.zangbundel.nl --auth <tester>:<password> --report design/test-results/<date>-sc01-test.zangbundel.nl.md
```

| Check | How |
|---|---|
| SC-02 | `testssl.sh zangbundel.nl` and `testssl.sh test.zangbundel.nl`: only TLS 1.2 and 1.3, no weak suites, a valid chain, HSTS present |
| SC-09 | `zbm-release verify` on the server: both sites `ok` |
| SC-12 | The checks of step 1 and step 2 |
| SC-13 | `https://zangbundel.nl/.well-known/security.txt` is served and its `Expires` is in the future (renew it before 2027-11-01). The privacy statement matches the logging. The access log holds shortened addresses. The error log holds full addresses for server faults and, on the test instance, for failed logins (unknown user or wrong password) with the user name entered. `/etc/logrotate.d/zangbundel` rotates `/var/log/nginx/zangbundel/*.log` daily, also when empty, and keeps 13 old files, so no entry is older than 14 days. Check with `ls /var/log/nginx/zangbundel/` after two weeks |

Finally, copy the live files into `../contabo-vps-6` (SR-75): the three vhosts, `conf.d/zangbundel.conf`, the snippets, both scripts and both systemd units. Leave out the htpasswd file and the push URL, which are secrets.
