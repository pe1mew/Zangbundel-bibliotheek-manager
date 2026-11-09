# SC-01 header check: zangbundel.nl

Run 2026-11-09 21:19 UTC via `zangbundel.nl:443`.
Result: **PASS**.

| Check | Request | Result |
|---|---|---|
| HTTP to HTTPS | `GET http://…/some/path?q=1` | pass |
| security.txt | `GET /.well-known/security.txt` | pass |
| HTML page | `GET /` | pass |
| HTML page | `GET /nl/privacy.html` | pass |
| HTML page | `GET /en/privacy.html` | pass |
| HTML page | `GET /de/privacy.html` | pass |
| asset | `GET /assets/app.eaff984a151b.css` | pass |
| asset | `GET /assets/backdrop-3200x1440.5774f081859e.webp` | pass |
| asset | `GET /assets/f-droid-badge-nl.9c7c2ccb3228.png` | pass |
| asset | `GET /assets/main.eb764dd2a713.js` | pass |
| asset | `GET /assets/style.908341a4f5c3.css` | pass |
| asset | `GET /assets/zangbundel-icon.0a9658551684.svg` | pass |
| range ignored, headers once | `GET /` | pass |
| not found | `GET /no-such-page` | pass |
| POST refused | `POST /` | pass |
| PUT refused | `PUT /x` | pass |
| dot file | `GET /.git/config` | pass |
| backup file | `GET /index.html~` | pass |
| release manifest hidden | `GET /release-manifest.json` | pass |
| manifest signature hidden | `GET /release-manifest.json.sig` | pass |
| no directory listing | `GET /assets/` | pass |
