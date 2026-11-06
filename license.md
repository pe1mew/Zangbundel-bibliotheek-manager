# License Information

Five kinds of material meet in this project, and each is licensed differently.

## Code license: Apache License 2.0

The code in this repository (the bibliotheek-manager in whichever form it is built: a web app, a native Windows or Linux app, or an Android app, and any scripts under `scripts/`) is licensed under the **Apache License 2.0**, without the Commons Clause, like the [Zangbundel app](https://github.com/pe1mew/Zangbundel). In short:

- **Use, modify and redistribute** the code, also commercially, under the terms of the Apache License 2.0.
- **Attribution**: keep the licence text, the [NOTICE](NOTICE) file and the copyright notices in any copy or derivative, and mark files you changed.
- **No warranty**: the code is provided as is.

The full text is in the [LICENSE file](LICENSE).

## Content license: Creative Commons BY-NC 4.0

The writing and other non-code content in this repository, including the design documents under `design/` and this documentation, are licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You may:

- **Share**: copy and redistribute the content in any medium or format for non-commercial purposes.
- **Adapt**: remix, transform and build upon the content for non-commercial purposes.

Under these conditions:

- **Attribution**: give appropriate credit, provide a link to the licence and indicate if changes were made, but not in any way that suggests the licensor endorses you or your use.
- **Non-commercial**: the content may not be used for commercial purposes.

Full text: https://creativecommons.org/licenses/by-nc/4.0/

## Artwork from the Zangbundel app: CC BY-SA 4.0 and Apache 2.0

The web app reuses the look of the Zangbundel app (`design/webappGUI.md` GD-01):

| File | What it is | Licence |
|---|---|---|
| `webapp/mock/img/zangbundel-icon.svg` | The Zangbundel app icon, copied unchanged from the app's `design/icon/zangbundel-icon.svg` | CC BY-SA 4.0, credit "Remko Welling, PE1MEW" |
| `webapp/mock/img/backdrop-3200x1440.webp` | The app's background photograph, landscape export, copied unchanged from the app's `design/gui/backdrop-3200x1440.webp`; taken by the owner (app guiDesign D-09) | CC BY-SA 4.0, credit "Remko Welling, PE1MEW" |
| The icon paths in `webapp/mock/mock.js` (`ICONS`) | Google Material Icons path data, as the app uses them | Apache License 2.0 |

Copies of these in the web app carry the same licences. The app icon may be shared and adapted for any purpose, also commercially, with attribution and under the same licence (https://creativecommons.org/licenses/by-sa/4.0/). The Material Icons follow the Apache License 2.0 of the code, see [NOTICE](NOTICE).

## Third-party store badges

The mock's *Android-app* panel (`design/webappGUI.md` GD-15) shows two official badges, unchanged, as links to the app's pages in those stores. They are not covered by this project's licences:

| File | Source (downloaded 2026-11-06) | Terms |
|---|---|---|
| `webapp/mock/img/google-play-badge-nl.png` | `play.google.com/intl/en_us/badges/static/images/badges/nl_badge_web_generic.png` | Google's badge guidelines (`play.google.com/intl/en_us/badges/`): used unaltered, linking to the app on Google Play, with the notice "Google Play and the Google Play logo are trademarks of Google LLC." |
| `webapp/mock/img/f-droid-badge-nl.png` | `fdroid.gitlab.io/artwork/badge/get-it-on-nl.png` | CC BY-SA 3.0, as F-Droid's badge page states (`f-droid.org/docs/Badges/`, checked 2026-11-06: "The badges are licensed CC-BY-SA-3.0 and the scripts GPL-3.0-or-later"); credit "F-Droid". Used unaltered; F-Droid intends the badges to link to apps in its main repository (GD-35: no link until the app is there). |

The placeholder of `zangbundel.nl` (`webapp/placeholder/assets/`) uses the same two badge files and the app icon, unchanged as files; the page shows the badges greyed with *binnenkort* and without a link (GD-35), and names the trademark and the F-Droid licence in its footer. The test holding page (`webapp/test-holding/assets/`) uses the app icon. The web app (`webapp/src/assets/`) uses the app icon and the background photograph, unchanged, under CC BY-SA 4.0 as above.

## Song lyrics: not in this repository

This repository contains **no song lyrics** and does not accept any. The bibliotheek-manager edits libraries that users open on their own device; their songs never become part of this project. Test libraries in this repository contain only songs that are public domain or written for the tests. The maintainers of a library are responsible for having the right to distribute its contents; this project's licences say nothing about the lyrics.

---

*By using this repository, you agree to comply with the licensing terms described above.*
