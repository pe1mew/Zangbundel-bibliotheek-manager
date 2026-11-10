# GUI Design — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | GUI design of the web app: screens, behaviour, look |
| **Status** | Draft 0.35 |
| **Date** | 2026-11-10 |
| **Depends on** | `design/FDS.md` draft 0.7; the Zangbundel app's `design/guiDesign.md` v0.66 (section 9 colour reference) |
| **Companion** | `design/webappTDS.md` (how the web app is built and deployed) |

---

## 1. Introduction

### 1.1 Purpose

This document describes the bibliotheek-manager web app as the user sees it and uses it:

- **Screens:** what each screen shows and how it is laid out.
- **Behaviour:** what happens on every action, in every state: which control is available when, what is confirmed, what is validated while typing, where a message appears and where selecting it leads, and what happens on errors.
- **Look:** colours, buttons, icons and type.

*What* the manager must do is the FDS; this document turns it into screens and behaviour and must not contradict it. A wish that collides with an FDS requirement is recorded as an open question, not designed around. Every design is checked in the mock before it is built (`design/webappTDS.md` TD-04).

### 1.2 Notation

- Decisions are `GD-nn`, open questions `GQ-nn`. IDs are never reused; a superseded decision is marked *Superseded by GD-nn* and kept.
- FDS IDs (`EDT-nn`, `M-nn`, …) refer to `design/FDS.md`; app decisions (`D-nn` of the app) are written as "app guiDesign D-nn".
- Requirement key words follow RFC 2119. English prose, Dutch UI terms in parentheses.
- A behaviour description names, per action: the trigger, the precondition, the result, the FDS requirement it implements and the message (`M-nn`) shown, if any.

---

## 2. Decisions

| ID | Date | Decision |
|---|---|---|
| GD-01 | 2026-11-05 | **Same look as the Songbook app.** The manager reuses the app's colour scheme, buttons and icons, so that a scout leader recognises the same family in both. The source is the app: `design/guiDesign.md` section 9 and `android/app/src/main/kotlin/nl/pe1mew/zangbundel/app/ui/theme/Theme.kt`. A change of palette in the app is followed here. |
| GD-02 | 2026-11-05 | **This document also describes behaviour**, not only screens and look (section 1.1). The behaviour of a screen is specified with the screen, before it is built in the mock. |
| GD-12 | 2026-11-06 | **The colours are those of the app's screens as users see them: black, dark grey and orange.** *(Owner, feedback on the mock.)* The first mock used the app's configuration scheme (night blue), which the app's songbook and campfire screens do not show; the owner found it "blue, not the app's colour scheme". Section 2.1 now follows the app's night theme. Supersedes the table of draft 0.1 to 0.3 in section 2.1. |

### 2.1 Colours (from GD-01)

The manager uses the app's night theme, as its songbook, setlist and campfire screens show it (GD-12). Sources in the app: `LyricColors.Night` (`ui/LyricBody.kt`), `SheetNight` and `ButtonNight` (`ui/gathering/RoundButtons.kt`), `Palette` (`ui/theme/Theme.kt`); the store screenshots in `docs/store-listing/graphics/` show the result.

| Role | In the app | Value |
|---|---|---|
| Background of the centre area | Lyric view background (night) | `#000000` |
| Side bars, bottom bar, panels, dialogs | Sheets (`SheetNight`) | `#121212` |
| Round and icon buttons | `ButtonNight` | `#1A1A1A` |
| Dividers, disabled buttons | Divider (night) | `#2A2A2A` |
| Input outlines, inactive tracks | Grey | `#444444` |
| Text | Lyric text (night) | `#FFFFFF` |
| Labels, secondary text | Secondary (night), as *Couplet 1* | `#BFBFBF` |
| Primary buttons, outlines, text buttons, focus | Fire orange | `#FF8A3D` |
| Text on an orange button | Night blue dark | `#0B2545` |
| Error and attention text (until GQ-02) | Fire orange light | `#FFB36B` |
| The selected row, as the leader's current-song bar | Night blue | `#13315C` |
| Links, keyboard focus ring | Sky blue | `#4FC3F7` |

The configuration scheme of the app (night blue background, `ConfigurationScheme`) is not used; whether the app's background photograph has a place, for example on the splash, is GQ-01.

Reception green (`#4CC36A`) and the eight library colours of app guiDesign D-51 have app-specific meanings and are not used, unless a decision here gives them a meaning in the manager. Colours for the severities of the validation panel (Fatal, Error, Warning, Info, FDS §6.1) are open (GQ-02).

### 2.2 Buttons (from GD-01)

| Kind | Look in the app | In the manager |
|---|---|---|
| Primary | Filled fire orange, text in night blue dark (Material 3 default shape) | The one main action of a screen, e.g. *Save* (*Opslaan*) |
| Secondary | Outlined button (Material 3 `OutlinedButton`) | Other actions of equal weight, e.g. *Save as copy* |
| Text | Text button (Material 3 `TextButton`), the app's most used kind | Minor actions, *Cancel* in dialogs, links within a screen |
| Panels | Night blue dark at 85 % on the background, corners 12 px (`textPanel`); sheets and dialogs with corners 16 px | Same |
| Round buttons | Circle buttons of the app's gathering screens | Only where a decision here calls for them |

Every control is at least 48 × 48 px (app guiDesign D-18, NFR-ACC-01 there).

A block in the section editor has the same inner spacing on every side: 12 px inside its border, also below the text and next to the coloured border of a chorus or bridge. A hint under the text takes space only while it is shown. *(Owner, 2026-11-06, feedback on the mock.)*

### 2.3 Icons (from GD-01)

The app's icons are Google Material Icons path data (Apache License 2.0), tinted by the caller: `ic_about`, `ic_library`, `ic_list`, `ic_settings`, `ic_memories`, `ic_chevron_*` in `android/app/src/main/res/drawable/`. The manager uses the same icons, converted to SVG with the same path data, for the same meanings. Further icons come from the same set. The app icon (`design/icon/zangbundel-icon.svg`, CC BY-SA 4.0) may be used as the manager's logo and favicon (GQ-03).

Reusing these files brings their licences into this repository: the Material Icons under Apache 2.0, the app artwork under CC BY-SA 4.0 with credit to Remko Welling, PE1MEW. `NOTICE` and `license.md` must name them in the change that first copies them.

---

## 3. Screens and behaviour

The owner's GUI notes of 2026-11-05 are recorded below as decisions GD-03 to GD-09, in the owner's words where possible. The notes call the product *Songbook Dictionary Manager* and a library a *dictionary*; this document uses the FDS term **library** (*bibliotheek*), and the product name is GQ-06. Where a note meets an FDS requirement it does not cover, or departs from one, the point is an open question in section 4 (GQ-06 to GQ-15), not a change to the FDS. Most of these questions were answered on 2026-11-06; the decisions are in section 3.6.

### 3.1 Startup

**GD-03 — Startup looks like the Songbook app's.** *(Owner, 2026-11-05.)*

- At startup the screen looks the same as when the Songbook app starts (app guiDesign section 3, D-04 to D-06).
- The main screen's areas (section 3.2) are already drawn. The left bar, right bar and bottom bar show minimal information and may be greyed out.
- The centre area shows a splash with the manager's name, its version number and the same icon or logo as the app (GQ-03, GQ-06).
- After a few seconds the splash gives way to the main page with the manager's primary actions (GQ-07 for the exact time):
  - Open an existing library (the notes say *upload and open*; see GQ-08).
  - Create a new library.
  - Edit the library.
  - Close the library and download it.

| Action | FDS |
|---|---|
| Open an existing library | EDT-01, §7.3 (EDT-20 to EDT-26) |
| Create a new library | EDT-01, §7.2 (EDT-10 to EDT-14) |
| Edit the library | §7.4 |
| Close and download | §7.6 Save, EDT-03 (confirmation with unsaved changes), EDT-59 (download); *Save as copy* and *Close* without saving: GQ-09 |

### 3.2 Main screen layout

**GD-04 — One main screen in four areas.** *(Owner, 2026-11-05.)*

```
┌──────────┬──────────────────────────────┬──────────┐
│          │                              │          │
│  Left    │          Centre              │  Right   │
│  bar     │                              │  bar     │
│          │  the selected song,          │          │
│  tags and│  in view mode or edit mode   │  the     │
│  metadata│                              │  library │
│  of the  │                              │  songs   │
│  selected│                              │          │
│  song    │                              │          │
│          │                              │          │
├──────────┴──────────────────────────────┴──────────┤
│  Bottom bar: primary navigation icons              │
└────────────────────────────────────────────────────┘
```

- **Bottom bar:** the primary navigation icons, in the same style as the icons of the Songbook app (GD-01, section 2.3).
- **Right bar:** the library's song list. It shows every song by name (its title). Clicking a song shows it in the centre (view mode); each row has one button, *Bewerken* (GD-13). Above the list: search, sort and filters as in the app's songbook (GD-13).
- **Left bar:** the tags and metadata fields of the selected song, to the left of the editor.
- **Centre area:** above the bottom bar, between the left and right bars. It shows the selected song in view mode or in edit mode.

Not yet placed in this layout: the library's own fields (title, description, licence, maintainer), the sets, the validation panel, signing and keys, and the language choice (GQ-10 to GQ-12).

**GD-10 — The side bars can be resized and folded.** *(Owner, 2026-11-06, feedback on the mock.)* The left bar and the right bar can each be made wider or narrower, and folded in and out. A small tab in the middle of each bar's inner edge shows that the bar can be folded, and folds or unfolds it.

| Action | Behaviour |
|---|---|
| Drag a bar's inner edge | The bar follows the pointer; the centre area takes the rest of the width. Left bar 220 to 480 px, right bar 240 to 520 px; the edge stops at the limit. |
| Click or tap the tab | The bar folds in to nothing but its edge with the tab, or unfolds to the width it had. The tab's chevron points the way the bar will move. |
| Keyboard | The tab is a button (Enter or Space folds and unfolds). The edge is a separator: the left and right arrow keys resize in steps of 16 px. |
| Folded bar | Its content is hidden and not reachable by keyboard; the centre area uses the space. Selecting a song in a folded right bar is not possible until it is unfolded. |
| Splash (GD-03) | The tabs and edges are greyed out with the bars, and do nothing. |

Whether the widths and folded state are remembered for the next visit is GQ-16.

**GD-13 — The song list: a click shows the song; search, sort and filters as in the app.** *(Owner, 2026-11-06, feedback on the mock.)*

- **No *Bekijken* button.** A click on a song row selects it and shows it in the centre area in view mode. Each row keeps one button, *Bewerken*, which opens the song in edit mode. *Amended 2026-11-08 (the owner's look at dev.5):* it is a pen icon in orange, beside the bin, named *Bewerken: \<title\>* by its tooltip and for screen readers. The song view's own *Bewerken* keeps its text.
- **Search and filters above the list, the same as the app's songbook** (app guiDesign D-52; built in the app as `ui/songbook/SongbookScreen.kt` and `library/SongbookFilter.kt`):

| Control (Dutch UI) | Behaviour, as in the app |
|---|---|
| Search field *Zoeken* | A song is shown when its title holds every typed word, compared without case or accents (*Één* finds *een*). The list follows while typing. |
| Switch *Ook in de tekst* | Off by default. On: the typed words are looked for in the lyrics instead of the title (the app's full-text search, FR-LIB-31 there). |
| Sort button *A–Z* / *Z–A* | Toggles the order. Sorting uses the sort title when the song has one (`{sorttitle}`), otherwise the title, compared without case or accents. |
| Filter chips | One row of chips, scrolling sideways: the languages of the library's songs (only when there is more than one) and its tags. Within a group any chosen chip matches; the groups all apply. A chosen chip shows a check mark. *Amended 2026-11-08 (the owner's M5 review, F1):* the row has no scrollbar. While chips do not all fit, a triangle at each end (◀ ▶) shows that more chips are hidden on that side; it is invisible, its place kept, when none are. A click brings the next hidden chip on that side fully into view. The triangles are not in the tab order: a chip reached with Tab scrolls into view itself. |
| Chip *Zelfde titel: “…”* | *Added 2026-11-08 (GD-20).* Only while *Ga naar* on SNG-10 shows the songs that share a title, subtitle and language: the list holds just those songs, the chip is first in the row and shown chosen, and a click on it, or *Wis filters*, takes it away. It goes by itself when none of its songs is left. |
| *Wis filters* | Shown only while search, switch, sort or a chip differs from the default; clears them all at once. |
| No match | The list reads *Geen liederen gevonden.* |

The app's library chips and colour squares are left out, since the manager has one library open. The app's orders and filters by use (*vaakst gezongen*, *nog nooit gezongen*, …) are left out too: the manager has no campfire memories. Search, sort and filters are not part of the library, and are cleared when another library is opened. Whether they also reset when a song is added that the filter hides, and how a song that is being edited is kept visible, is GQ-17.

**GD-14 — The identity (signing key) is managed from the bottom bar.** *(Owner, 2026-11-06.)* The bottom bar has a group of buttons for the user's identity, the Ed25519 key that signs a library (FDS §5, §7.7):

| Button (Dutch UI) | Behaviour | FDS |
|---|---|---|
| *Sleutel maken* | Asks for the author's name, makes a new key pair, and shows the name and the fingerprint (`AB12-CD34-EF56-7890`, SG-20). Before the key file can be downloaded, the user must tick that they have read notice M-64. Then *Sleutelbestand downloaden* saves it as `sleutel-<name>.zbkey`; *Later* keeps the key in memory only. If a key is already in memory, the user confirms replacing it first. | EDT-61, SG-12, SG-20, M-64 |
| *Sleutel downloaden* | Available only while a key made in this session has not been downloaded yet, and only once (*amended 2026-11-07 by the owner*: after the download, and right after loading, the crypto worker keeps the key non-extractable, securityAssessment SR-16, so no key file can be made again; the button then says the file is already on the computer). Shows its name and fingerprint and the same notice, then saves the key file. While a key made in this session has not been downloaded yet, the button carries a dot: without the file, the key is lost when the page closes (EDT-02, EDT-64). | EDT-61, EDT-64 |
| *Sleutel laden* | Not in the owner's request, added because the FDS needs it: opens a key file (`.zbkey`), checks it (SG-11, M-31) and keeps it in memory for this session. The file stays on the user's computer (TD-06). | EDT-60, EDT-62, SG-11 |

The key lives in the page's memory only; closing the page forgets it, and nothing about it is stored in the browser (EDT-64, TD-06). Signing the open library with this key (*Bibliotheek ondertekenen*, EDT-60, EDT-53) and checking a loaded key against a signed library (EDT-62, M-30) are not designed yet (GQ-18).

**GD-15 — The bottom bar offers the Zangbundel app for Android.** *(Owner, 2026-11-06.)* A button *Android-app* opens a panel with:

- the official store badges, as images served by the manager itself (TD-08): *Ontdek het op Google Play* (Google's Dutch badge) and *Verkrijg op F-Droid* (F-Droid's Dutch badge), each linking to the app's page in that store;
- a text link to the signed APK on GitHub Releases (`github.com/pe1mew/Zangbundel/releases/latest`);
- links to the source code of the app (`github.com/pe1mew/Zangbundel`) and of the manager (`github.com/pe1mew/Zangbundel-bibliotheek-manager`);
- links to the app's manual on the wiki (*Handleiding* in Dutch, *Manual* in English) and to the manager's manual.

Links open in a new browser tab. The owner asked for "the same images as on the wiki"; the wiki has no images (checked 2026-11-06), and the owner chose the official store badges instead. Open points: the app is not yet public on Google Play and not yet on F-Droid (resubmission from 2027-01-18), and the manager has no manual yet (GQ-19).

### 3.3 Edit mode

**GD-05 — Song information in separate fields in the left bar.** *(Owner, 2026-11-05.)* Metadata, copyright data, tags and other song information are separate fields in the left bar. This is the form of FDS EDT-34: each field reads and writes its directive in the song (song format §6.1).

*Amended 2026-11-09 (the owner's look at dev.6):* in the editor every recommended field that is empty (SNG-16: words or music, copyright, licence, source, tag) shows its advice at once, with a dashed border and a warning line, so none has to be found one by one through *Controle*. Words and music are advised together, and either one clears both. Required fields (title, language) keep their asterisk and their error.

**GD-06 — The song is edited as a sequence of sections.** *(Owner, 2026-11-05.)* The song editor in the centre consists of two kinds of section: **chorus** (*refrein*) and **verse** (*couplet*). The user adds as many choruses and verses as needed; together and in order they define the song's structure. Which other parts of the ChordPro profile the editor must represent is GQ-13; how this relates to editing the ChordPro text directly (FDS EDT-33) is GQ-14.

**GD-07 — Each section has a small WYSIWYG editor.** *(Owner, 2026-11-05.)* Each section has its own small editor that shows the text as it will look, and accepts only the characters allowed in songs (song format §5.1: UTF-8, no control characters other than line ends; braces and brackets only as the profile allows, §5.3 and §5.4).

**GD-08 — Sections are reordered by dragging.** *(Owner, 2026-11-05.)* Sections are moved up and down by dragging them with the mouse. A keyboard alternative is GQ-15.

*Amended 2026-11-08 (the owner's M5 review, F7):* while a section is dragged, the sections it passes slide aside to open a gap where it will land. On release it slides into that gap. This replaces the line that marked the drop place.

**GD-11 — The song scrolls along while a section is dragged.** *(Owner, 2026-11-06, feedback on the mock.)* While a verse or chorus is dragged, the dragged block follows the pointer, and when the pointer comes near the top or bottom of the centre area (within 72 px, above the *Toepassen* bar), the song scrolls in that direction, faster the closer the pointer is to the edge. The dragged block stays in view. Scrolling stops at the start and end of the song, and the block cannot be dragged outside the song. A line shows where the block will land; on release it lands there and stays in view.

### 3.4 Applying changes

**GD-09 — Apply checks, then shows.** *(Owner, 2026-11-05.)*

- Before changes to a song are applied, an automatic check verifies that all required fields are filled in correctly (FDS SNG-02, SNG-11, SNG-12 and the other song rules of §6.6).
- After applying, the user sees the song as it will appear (view mode in the centre area).

How *apply* relates to the FDS's validation while typing (EDT-42) and to Save being blocked only by Errors (EDT-50) is GQ-12.

### 3.5 Mock

`webapp/mock/` shows GD-03 to GD-09 as a clickable mock (TD-04): open `index.html` through the preview server `webapp-mock` in `.claude/launch.json`, or any static file server. It reads and writes no files; *Openen* loads a built-in example library with songs that are traditional or written for the mock. A strip at the top, not part of the design, jumps to each state and shows or hides the open-question badges.

Where the notes leave a point open, the mock makes an assumption and marks it with the question's badge. None of these is a decision. *Since 2026-11-06 all of these questions are answered (section 3.6); the table shows what the first mocks assumed. The mock of draft 0.7 follows section 3.6:* it is in Dutch, English and German (`webapp/mock/i18n.js`), and the mock bar jumps to the splash, home, a song, the library fields, edit mode, the ChordPro text, the check panel, a set and a signed library. Two example libraries: an unsigned one with a song that has an Error and one with Warnings, and one signed by *Akela* with two key files to try (one matching, one not). The design-ID badges show which decision a part implements.

| Open question | What the mock assumes |
|---|---|
| GQ-03, GQ-06 | The app icon as logo; the name *Zangbundel bibliotheek-manager*. |
| GQ-04 | The platform's system font. |
| GQ-05 | A desktop width of at least 980 px. |
| GQ-07 | The splash stays 1.5 s, or until a click, as in the app. |
| GQ-08 | *Bibliotheek openen*, with the line that the file stays on this computer. |
| GQ-09 | *Sluiten en downloaden* opens a dialog with the proposed file name, the change note (EDT-58), *Opslaan als kopie* and *Downloaden en sluiten*. |
| GQ-10 | With no song selected, the left bar shows the library's fields. |
| GQ-11 | Sets are not shown. |
| GQ-12 | *Toepassen* refuses a song with an Error and lists the problems above the sections, each with a link to the field; a field loses its mark once it is filled. |
| GQ-13, GQ-14 | Only verse and chorus; no plain-text view. |
| GQ-15 | Up and down buttons on each section, next to the drag handle. |
| GQ-16 | Bar widths and folding last only while the page is open. |
| GQ-17 | A newly applied song that the filter hides clears the filter. |
| GQ-18 | Keys can be made, downloaded and loaded; signing the library with one is not in the mock. |
| GQ-19 | Both badges are shown and link to the store pages; the manager's manual links to this repository's wiki, which does not exist yet. |
| GQ-02 | Errors in fire orange light with a ⚠ and a sentence, so that colour is not the only sign. |
| GQ-01 | No background photograph; the splash is black like the rest. |

Further behaviour the mock shows: the bottom bar's *Bewerken* is available only with a song selected, and *Sluiten en downloaden* only with a library open, with a dot after an applied change. While a song is being edited, the song list and *Sluiten en downloaden* ask the user to apply or cancel first. *Openen* and *Nieuw* ask for confirmation when there are unsaved changes (M-60). A new song's ID is proposed from its title on apply (EDT-36). Typing `{` or `}` in a section is refused with a hint, and pasted text loses such characters (GD-07).

### 3.6 Decisions of the walk-through of 2026-11-06

The owner's answers to the open questions, and two further requests made during the walk-through. *(Owner, 2026-11-06.)*

**GD-16 — Deleting a song.** A song is deleted with the bin icon to the right of *Bewerken* on its row in the song list, with *Verwijderen* next to *Bewerken* above the song in view mode, or with *Lied verwijderen* in the edit footer. Each asks for confirmation (FDS M-62, *"<titel>" verwijderen? Dit kan in deze sessie niet ongedaan worden gemaakt.*). The song is removed from every set as well (EDT-32). Afterwards the neighbouring song in the list is selected, or none when the list is empty. A song that is new and not yet applied has no delete button; *Annuleren* discards it.

**GD-17 — The interface follows the browser's language, and the bottom bar can change it.** On opening, the manager takes the first of the browser's preferred languages (`navigator.languages`) that it offers: Dutch, English or German (EDT-80); otherwise English (EDT-81). A language button in the bottom bar shows the current language (*NL*, *EN*, *DE*) and switches it at once, without losing work. Whether the choice is remembered for the next visit is GQ-16 (EDT-82 allows it). This replaces the proposal of GQ-10 to put the language choice in *Over*.

*Amended 2026-11-08 (the owner's M5 review, F4; as the mock):* the language button opens a menu instead of going to the next language.
- **The menu:** it opens above the button and lists every interface language in its own name (*Nederlands*, *English*, *Deutsch*), with the current one checked and focused.
- **A choice:** closes the menu and applies the language at once. The focus returns to the language button.
- **Closing unchanged:** Escape, Tab, a second click on the button, or a click outside.
- **Keys:** the arrow keys move through the menu and go round; Home and End go to the first and last language.

**GD-18 — Sections first, ChordPro text as a second view.** *(Resolves GQ-14.)* The section editor (GD-06) is the default. A switch *ChordPro-tekst* shows the same song as plain ChordPro text, editable, with validation while typing (FDS EDT-33 stands). Switching back rebuilds the sections from the text. Both views edit the same song; nothing is lost by switching.

**GD-19 — The section editor knows the common parts and keeps the rest unchanged.** *(Resolves GQ-13.)*

| Part | In the section editor |
|---|---|
| Verse, chorus, bridge | Section types *Couplet*, *Refrein*, *Brug* (song format §7.1). |
| Repeating a chorus (`{chorus}`, §7.2) | A section *Refrein herhalen*, without text of its own, showing which chorus it repeats. |
| Section label (`{start_of_verse: Couplet 1}`) | An optional label field per section; empty means the app generates the label. |
| Chords (`[G]`, §5.4) | Typed inline in the text; shown highlighted. |
| Everything else: `{comment}`, tab, grid and ABC blocks, `#` maintainer notes, unknown directives, implicit verses | A locked block in its place, showing its text greyed with *Alleen te wijzigen in de ChordPro-tekst*. It is written back exactly as it was, so the song's content hash does not change by accident. |

*Clarified 2026-11-07 by the owner:* a locked line inside a verse, chorus or bridge (a `{comment}` such as *zachter*, a `#` note, an unknown directive) stays in its place within the section, and the section stays editable around it in *Blokken*; the locked line may be removed but is never changed. Only a broken structure (an environment not closed by its own end) and tab, grid, ABC and unknown environments are locked as a whole.

**GD-20 — *Toepassen* always applies; problems are marked and listed.** *(Resolves GQ-12.)* *Toepassen* takes the song into the library also when it has an Error. A song with an Error or Warning gets the severity icon of GD-29 on its row in the song list. A button *Controle* in the bottom bar shows the number of Errors and Warnings and opens the validation panel (FDS EDT-40 to EDT-42): all messages grouped by severity, each with its location (set, song, line), and a click on one goes there. *Downloaden* stays blocked while any Error is present (EDT-50, M-63) and says so. This supersedes the refusal shown in the first mock.

*Amended 2026-11-09 (the owner's look at dev.6):*
- ***Toepassen* refuses a song with an Error:** for example no title, no language or no lyrics. The song is not applied; the editor says *Nog niet toegepast* with the first error and puts the cursor on its field or line. This supersedes *Toepassen always applies* above. Warnings, such as the recommended fields, never stop it.
- ***Ga naar*:** before it puts the cursor in a field of the left bar, it opens that bar on the right tab (*Liedgegevens* or *Bibliotheek*). On *De bibliotheek heeft nog geen liedjes* (STR-02) it goes to *Lied toevoegen*.

*Amended 2026-11-08 (the owner's M5 review, F2):* where a click on a message goes.
- **A song:** a message about a song opens it, at its field or line where it names one.
- **A song folder:** a structure message about a song's folder (`songs/<id>/…`) also opens that song.
- **SNG-10:** this message names several songs. The *Liedjes* tab then shows just those songs, with the chip *Zelfde titel* of GD-13, and the right bar unfolds if it was folded.
- **A song that is not in the library:** the library's home is shown instead, so a click always shows something.

**GD-21 — Sets are a tab in the right bar.** *(Resolves GQ-11.)* The right bar has two tabs, *Liedjes* and *Sets*, like the app's *Setlist* and *Zangbundel* tabs. *Sets* lists the sets (add, rename, delete with M-62, drag to reorder; EDT-31). Opening a set shows its songs in order in the centre area, with drag and up/down reordering as in the section editor (GD-08, GD-11) and a bin per entry that removes the song from the set only. Songs are added to the open set from the *Liedjes* tab with a *+ Set* button on each row while a set is open. A song can be in several sets (D-22).

*Amended 2026-11-08 (the owner's look at dev.6):* the *Sets* tab has no *Omhoog* and *Omlaag*; each set keeps *Naam wijzigen* and *Set verwijderen*. The owner chose to remove them without a replacement, so the order of the sets cannot be changed in the manager for now. FDS EDT-31's *reorder* of sets is therefore unmet (implementationPlan M5.6). The songs inside a set are still reordered by dragging and with their buttons.

*Amended 2026-11-08 (F5):* a set's songs move as the sections do (GD-08, GD-33): the others slide aside to open the gap, and the moved song slides into it.

**GD-22 — The library's own fields are in the left bar when no song is selected.** *(Resolves GQ-10.)* With no song selected, the left bar shows the library's title, description, licence and maintainer (EDT-13, EDT-14, EDT-30), editable there. Clicking the library's title at the top of the right bar deselects the song and shows them. The language choice is in the bottom bar (GD-17).

*Amended 2026-11-09 (the owner's look at dev.6):* a field's mark from the check goes as soon as that field itself is right, checked when the user leaves it. This holds also while a rule over several fields still fails for another one: a filled name loses its mark while the contact is still missing (MAN-08), and a filled summary while no licence is chosen (MAN-07).

*Amended 2026-11-08 (the owner's second look):*
- **F12, two tabs:** the library's fields were reachable only through the library's title in the right bar, which the owner could not find. The left bar now has two tabs while a library is open, *Liedgegevens* and *Bibliotheek*, like the right bar's.
  - **The song's tab:** only while a song is selected or edited. Choosing another song goes back to its data.
  - **The library's tab:** reachable while a song is shown or edited, without leaving the editor. Changes typed in the song's fields stay.
  - **The title in the right bar:** still deselects the song and shows the library.
- **F13, a read-only library:** one opened read-only (GD-24, EDT-23) shows its fields as values, as the song's data does in view mode, instead of greyed-out inputs.

**GD-23 — *Downloaden* keeps the library open; *Sluiten* is separate.** *(Resolves GQ-09.)* The bottom bar's *Sluiten en downloaden* becomes *Downloaden*: it saves the `.zbl` and the user keeps working. Each download after a change raises the version (EDT-51). Its dialog offers *Opslaan als kopie* (EDT-70 to EDT-73) as well. A separate *Sluiten* ends the session, asking first when there are changes not yet downloaded (M-60, EDT-03).

**GD-24 — Signing is a tick box in the download dialog; a signed library asks for its key.** *(Resolves GQ-18.)* While a key is in memory (GD-14), the download dialog has *Ondertekenen als <naam> · <vingerafdruk>* (EDT-60, EDT-53); for a library that is already signed with that key, it is ticked and cannot be unticked (EDT-63). A signed library shows a lock and the author in the right bar's header. Opened without its key, it is read-only (EDT-23): a bar above the centre area says *Alleen lezen: ondertekend door <naam> · <vingerafdruk>. Laad de sleutel om te wijzigen*, with *Sleutel laden*; a key that does not match is refused with M-30.

*Amended 2026-11-08 (the owner's look at dev.5):* the lock beside the library's title means *read-only*. It shows only while a signed library is open without its key. With the key loaded, the library can be edited, so there is no lock; the state line under the title still says *ondertekend door …*. Before this, the lock showed for every signed library, which the owner found confusing.

**GD-25 — A new song is never hidden by the filter.** *(Resolves GQ-17.)* When a song is applied that the current search or filter hides, the filter is cleared, with the message *Filters gewist om het nieuwe lied te tonen*.

**GD-26 — The product name is *Zangbundel bibliotheek-manager*.** *(Resolves GQ-06.)* English *Zangbundel library manager*, German *Zangbundel Bibliotheksverwaltung*, following the app's glossary (EDT-83).

**GD-27 — The splash stays 3 seconds, or until a click.** *(Resolves GQ-07.)* Deliberately longer than the app's 1.5 s (app guiDesign D-05), so that the name and the version are seen.

**GD-28 — Opening is *Bibliotheek openen*.** *(Resolves GQ-08.)* With the line *Het bestand wordt in je browser gelezen en blijft op deze computer*; the word *uploaden* is not used, since nothing is uploaded (TD-06).

**GD-29 — Severities are shown with an icon, a word and a palette colour.** *(Resolves GQ-02.)* *Fout* (Error and Fatal): fire orange `#FF8A3D` with a filled triangle; *Waarschuwing*: fire orange light `#FFB36B` with an outlined triangle; *Info*: grey `#BFBFBF` with an *i*. The word is always shown, so colour is never the only sign.

**GD-30 — The app icon is the logo and favicon; the splash shows the app's campfire photograph.** *(Resolves GQ-01 and GQ-03.)* The splash shows the app's background photograph (app guiDesign section 5, `design/gui/backdrop-3200x1440.webp`, CC BY-SA 4.0) under a dark scrim, with the icon, name and version on top, like the app's welcome screen. Everywhere else the background is the black of the app's screens.

*Amended 2026-11-08 (the owner's M5 review, F10):* the photograph is also the centre's background, behind every screen of the centre. It is darkened slightly. *Changed the same day, the owner's third look:* the photograph is fixed to the window, so resizing or folding a side bar never moves or rescales it; the bars only cover more or less of it. *Refined the same day, with the owner's sketch:* the photograph is centred in the window and as high as the window above the bottom bar, so the children's open book, low in the picture, stays in view; black fills the rest. Before, it was sized to the centre and anchored at its right, so it moved with the right bar. The home screen, a song, the editor and a set sit on a box above it, black with the set cards' border and rounded corners. Inside the box the contrast is as before. The editor's *Toepassen* bar stays inside its box.

**GD-31 — The system font.** *(Resolves GQ-04.)* The platform's own font, as the app uses the platform font; no font is downloaded.

**GD-32 — Desktop and laptop only.** *(Resolves GQ-05.)* The manager is designed for a window of at least 980 px wide. In a narrower window it shows only the message *De bibliotheek-manager heeft een groter scherm nodig: gebruik een computer of maak het venster breder*, with the Android-app links of GD-15.

*Fixed 2026-11-10 (the owner's phone):* the narrow page's box is centred by its own margins, so on a screen lower than the box it starts at the top and scrolls down. Before, it was centred by the flex container and its top was cut off.

**GD-33 — Sections also move with up and down buttons.** *(Resolves GQ-15.)* Each section keeps its *Omhoog* and *Omlaag* buttons next to the drag handle, reachable with Tab and usable with Enter, as the keyboard alternative to dragging (GD-08).

*Amended 2026-11-08 (F5, F7):* a section, or a song of a set, moved with *Omhoog* or *Omlaag* slides past its neighbour before the order changes. Focus stays on the button. With the system's *reduce motion* setting nothing slides.

**GD-41 — The centre area keeps at least 360 px.** *(Resolves GQ-21; the owner, 2026-11-07.)*
- **Dragging and the arrow keys (GD-10):** a bar's edge stops where the centre would get narrower than 360 px, next to the other bar as it is shown.
- **A window too narrow for both bars at their chosen widths:**
  - the bars are shown narrower, the right bar first, down to their minimums of GD-10;
  - the chosen widths stay remembered (GD-34) and come back when the window is wide enough again;
  - at the 980 px of GD-32, both bars at their minimums leave the centre 520 px.

**GD-42 — Leaving the page with work that would be lost asks first.** *(Owner, 2026-11-07; FDS EDT-03.)* Closing or reloading the page while the library has changes not yet downloaded gives the browser's own question (*Deze site verlaten?* or similar, worded by the browser; a page cannot word it). So does a key made in this session whose file was not downloaded (GD-14), since closing the page loses it for good. Without such work the page closes without a question. *Openen* and *Nieuw* ask M-60 in the page itself, as *Sluiten* does.

**GD-43 — A folded side bar keeps a strip of icons.** *(Owner, 2026-11-08, M5 review F6.)* A folded bar does not vanish.
- **The strip:** a 48 px strip stays at the window's edge, with one icon per part of the bar.
- **The icons:** the right bar shows *Liedjes* and *Sets* (only *Liedjes* without a library). The left bar shows the part it would show: *Liedgegevens* while a song is selected or edited, otherwise *Bibliotheek*.
- **A click:** opens the bar at that part, with the right bar on that tab. The bar stays open until it is folded again, and that is remembered (GD-34).
- **The fold tab:** stays at the strip's inner edge.
- **The left strip (amended 2026-11-08, F12):** it shows both *Liedgegevens* (while there is a song) and *Bibliotheek*, each opening its tab.

**GD-44 — Each song-data field explains itself on request.** *(Owner, 2026-11-08, M5 review F8; R2.)*
- **The button:** an ⓘ beside each label of the song's data, in view mode and in the editor's *Blokken* fields alike: title, language, words, music, copyright, licence, source, tags and song ID.
- **The explanation:** a click opens a short explanation under the field, and a second click closes it. It says what the field means and the rule that applies to it, from the song format's fields (6.1) and EDT-36 for the song ID.
- **While the page is open:** which explanations are open lasts until the page closes, also when the bar is drawn again. Nothing is stored.
- **Later:** each explanation gets a link to its page of the manual on `zangbundel.nl` once that exists (implementationPlan M7.6).
- **Not in the tab order (amended 2026-11-09, the owner's look at dev.6):** Tab goes from input to input; the ⓘ opens with the mouse.
- **The library's fields (amended 2026-11-08, F11):** the same ⓘ and explanation on each field of *Bibliotheek*, in the form and in a read-only library alike: title, description, licence, the SPDX code of another licence, licence summary, licence text, maintainer's name and contact. The texts follow FDS 4.1, EDT-13, EDT-14, MAN-07 and MAN-08.

**GD-45 — *Over* names the manager's only address.** *(2026-11-10; securityAssessment SR-08, SF-24.)* The *Over* dialog says, below the link to the privacy statement, *Alleen https://zangbundel.nl is de bibliotheek-manager.* (*Only https://zangbundel.nl is the library manager.*, *Nur https://zangbundel.nl ist die Bibliotheksverwaltung.*). It is plain text, not a link, so users can compare it with the address bar. The key notice of M-64 says the same (SR-44).

**GD-34 — Bar widths, folding and the language are remembered on this computer.** *(Resolves GQ-16.)* They are kept in the browser's local storage, on that computer only, and restored on the next visit (EDT-82). Nothing about a library or a key is kept there (EDT-02, EDT-64). If local storage is not available, the manager starts with the defaults.

**GD-35 — Store badges say *binnenkort* until the app is there; the manager's manual is on its GitHub wiki.** *(Resolves GQ-19.)* In the Android panel (GD-15), a badge is shown greyed with *binnenkort* (*coming soon*) and no link while the app is not public in that store, except the Google Play badge, which is left out until the app is listed there: Google's badge guidelines allow it only unaltered (*amended 2026-11-07* by the owner, on the placeholder first); the GitHub APK link works now. The manager's manual lives on this repository's GitHub wiki (`github.com/pe1mew/Zangbundel-bibliotheek-manager/wiki`), like the app's.

**GD-36 — An action elsewhere while a song is being edited asks what to do with the changes, and names the song.** *(Owner, 2026-11-06, feedback on the mock.)* The short message *Pas eerst toe of annuleer* did not say what would be applied or cancelled. Instead, a click outside the song editor that would leave it (a song or set in the right bar, adding a song to a set, *Downloaden*, *Openen*, *Nieuw*, *Sluiten*) opens a dialog *Je bent een lied aan het bewerken*: *Je wijzigingen in "<titel>" zijn nog niet toegepast. Wat wil je ermee doen voordat je verdergaat?*, with three buttons:

| Button | Result |
|---|---|
| *Wijzigingen in "<titel>" toepassen* (primary) | The song is applied as with *Toepassen* (GD-20), and the click the user made is then carried out. |
| *Wijzigingen in "<titel>" weggooien* | The changes are discarded, a message says so, and the click is carried out. |
| *Verder bewerken* | Nothing happens; the editor stays open. |

The title is the song's name before editing, so the user recognises it; a new song is named by its typed title, or *Nieuw lied*. Searching, sorting, filtering, switching tabs in the right bar, the language, *Controle*, the key buttons, *Android-app* and *Over* do not leave the editor and need no question. This replaces the message of GD-09's first mock.

**GD-37 — Following FDS drafts 0.5 and 0.6.** *(2026-11-06.)* Three FDS changes reach the screens:

- **The maintainer is required** (FDS D-36, EDT-14, MAN-08). In the library fields of GD-22 the maintainer's name and an e-mail address or website are marked as required; until they are filled in, *Controle* lists the Error M-39 (*Vul in wie deze bibliotheek beheert …*) and *Downloaden* is blocked. The note says that a group address or website serves as well as a personal one. This supersedes "the maintainer is optional" in GD-14's dialog text and in the first mocks.
- **The title is at most 80 characters** (D-38, EDT-10), in the *Nieuwe bibliotheek* dialog and the library fields.
- **The fixed terms are *signed by* and *not signed*** (D-43, EDT-83): *ondertekend door* / *niet ondertekend*, *signed by* / *not signed*, *signiert von* / *nicht signiert*; never a bare *signed* or *unsigned*.

The 1.1 view that the Editor now writes on every save (FDS §3.7) is not shown in the interface: nobody edits it (PF-45).

**GD-38 — Two named editing modes: *Blokken* and *Code (ChordPro)*.** *(Owner, 2026-11-06, feedback on the mock.)* The switch *ChordPro-tekst* of GD-18 was not recognised as a choice between two ways of editing. Above the song, *Bewerken als* is followed by a segmented control with two options, *Blokken* (the section editor, the default) and *Code (ChordPro)* (the song as raw ChordPro code, editable, with line checks while typing). The current mode is filled orange. The user switches at any moment during an edit; every change made in one mode is in the other, and switching without changes leaves the song exactly as it was. *Toepassen* applies the song in whichever mode is open. Keyboard: the control is a radio group, reachable with Tab. This replaces the switch of GD-18; the rest of GD-18 stands.

**Follow-ups from the security assessment** (`design/securityAssessment.md`, 2026-11-06), not yet decided here: the extra key texts of SR-44; the privacy statement page reachable from *Over* and the narrow-window page (SR-52); the test instance's fixed *TESTVERSIE* banner (SR-81). The implementation renders without `innerHTML` and without `style` attributes (SR-24, SR-32), unlike the mock.

**GD-39 — *Sleutel vergeten*.** *(Owner, 2026-11-06; securityAssessment SQ-08, SR-46.)* The identity group of the bottom bar has a fourth button, *Sleutel vergeten* (*Forget key*, *Schlüssel vergessen*), available while a key is loaded. It removes the key from memory at once and says so (*Sleutel vergeten. Laad hem opnieuw om te ondertekenen.*). If a key made in this session has not been downloaded yet, it first asks, because the key would then be lost for good. The open library and its changes are not touched; a signed library becomes read-only again (GD-24).

**GD-40 — The key is forgotten after 30 minutes without input.** *(Owner, 2026-11-06; SQ-08, SR-46.)* While a key is loaded, 30 minutes without mouse, keyboard or touch input open a dialog: *Je sleutel wordt over 60 seconden vergeten*, with a countdown, *Sleutel houden* (primary) and *Nu vergeten*. Without an answer the key is forgotten as in GD-39. A key not yet downloaded is never forgotten silently: the dialog then says the key will be lost and keeps it until the user chooses. Library work is never affected.

---

## 4. Open questions

| ID | Date | Question |
|---|---|---|
| GQ-01 | 2026-11-05 | *Resolved 2026-11-06 by GD-30.* Does the manager use the app's background photograph (app guiDesign section 5) on its start screen, as the app's configuration screens do, or only the plain night-blue background? |
| GQ-02 | 2026-11-05 | *Resolved 2026-11-06 by GD-29.* Which colours and icons mark the severities Fatal, Error, Warning and Info in the validation panel? The app's palette has no red or yellow; a choice must stay readable on night blue and must not rely on colour alone. |
| GQ-03 | 2026-11-05 | *Resolved 2026-11-06 by GD-30.* Is the app icon the manager's logo and favicon, or does the manager get its own mark in the same style? |
| GQ-04 | 2026-11-05 | *Resolved 2026-11-06 by GD-31.* Which font: the platform's system font stack (as the app uses the platform font, app guiDesign D-18), or a web font served from the project's own server? |
| GQ-05 | 2026-11-05 | *Resolved 2026-11-06 by GD-32.* Which screen widths are designed for: desktop and laptop only, or also tablet and phone? Editing ChordPro text is a desktop task, but FDS 1.4 says every implementation behaves identically. The four-area layout of GD-04 needs a desktop width; on a narrow screen the bars would have to fold away. |
| GQ-06 | 2026-11-05 | *Resolved 2026-11-06 by GD-26.* The product name on the splash and in the browser tab. The notes say *Songbook Dictionary Manager*; the repository and README say *Zangbundel bibliotheek-manager*, and the FDS calls a song collection a *library* (*bibliotheek*). Proposal: *Zangbundel bibliotheek-manager* in Dutch, *Zangbundel library manager* in English and *Zangbundel Bibliotheksverwaltung* in German, following the app's glossary (EDT-83). |
| GQ-07 | 2026-11-05 | *Resolved 2026-11-06 by GD-27.* How long the splash stays. The notes say "a few seconds"; the app shows its welcome screen for at most 1.5 s, or until a tap (app guiDesign D-05), so that it never delays the user. Follow the app (GD-01)? |
| GQ-08 | 2026-11-05 | *Resolved 2026-11-06 by GD-28.* The words for opening a library. The notes say *upload and open*, but TD-06 means nothing is uploaded: the file is read in the browser. *Upload* would tell the user the opposite of what happens. Proposal: *Open library* (*Bibliotheek openen*), with a line that the file stays on this computer. |
| GQ-09 | 2026-11-05 | *Resolved 2026-11-06 by GD-23.* Where *Save as copy* (EDT-70 to EDT-73) and *Close* without saving (EDT-01, EDT-03, M-60) appear, next to *Close and download*. Does *Close and download* save and then end the session, or can the user download and keep editing? |
| GQ-10 | 2026-11-05 | *Resolved 2026-11-06 by GD-22 (language: GD-17).* Where the library's own fields (title, description, licence, maintainer: EDT-13, EDT-14, EDT-30), signing and keys (§7.7, including the notice M-64 and the fingerprint SG-21) and the language choice (EDT-81) go. The left bar holds the selected song's fields; does it switch to the library's fields when no song is selected, or does the bottom bar open them? |
| GQ-11 | 2026-11-05 | *Resolved 2026-11-06 by GD-21.* Where the sets go and how they are edited (EDT-31: add, rename, reorder, delete; add and reorder songs in a set; a song in several sets). The right bar shows the library's songs; a second list, a tab in the right bar, or a view in the centre? |
| GQ-12 | 2026-11-05 | *Resolved 2026-11-06 by GD-20.* Where the validation panel goes (EDT-40, EDT-41: all messages grouped by severity, each leading to its location), and how *apply* (GD-09) relates to the FDS. The FDS validates while typing (EDT-42) and blocks only Save, only on Errors (EDT-50), so a half-finished song may stay in the library while the user works. Does *apply* refuse a song with an Error, or apply it and show the Error in the panel? |
| GQ-13 | 2026-11-05 | *Resolved 2026-11-06 by GD-19.* Which parts of the ChordPro profile the section editor (GD-06) represents besides verse and chorus: bridge (song format §7.1), repeating a chorus with `{chorus}` (§7.2), section labels, implicit verses (§7.3), `{comment}` remarks (§7.4), chords in brackets (§5.4), tab, grid and ABC blocks, `#` maintainer comments and unknown directives (§10.1). A song opened from a file may contain any of them; the editor must keep what it cannot show unchanged, or the song's content hash changes and the app sees a new song. |
| GQ-14 | 2026-11-05 | *Resolved 2026-11-06 by GD-18.* FDS EDT-33 says the song text is edited "as ChordPro text directly". The section editor (GD-06, GD-07) replaces that with a structured editor. Keep a plain-text view as a second mode for users who know ChordPro, or amend EDT-33 to allow the section editor alone? |
| GQ-15 | 2026-11-05 | *Resolved 2026-11-06 by GD-33.* A keyboard alternative to dragging sections (GD-08), for users who cannot use a mouse well: for example *move up* and *move down* buttons on each section. |
| GQ-16 | 2026-11-06 | *Resolved 2026-11-06 by GD-34.* Are the bar widths and folded state (GD-10) remembered between visits? They are not tied to a library, so EDT-02 allows it, like the language choice (EDT-82); they would be kept in the browser's local storage on the user's computer only. Or does every visit start with both bars open at their default width? The same question applies to the language chosen in the bottom bar (GD-17). |
| GQ-17 | 2026-11-06 | *Resolved 2026-11-06 by GD-25.* When a new song is applied (GD-09) that the current search or filter hides, does the list clear the filter, or show the song anyway with a note? The mock clears the filter, so that the new song is never invisible. |
| GQ-18 | 2026-11-06 | *Resolved 2026-11-06 by GD-24.* Where and how the open library is signed with the key in memory (*Bibliotheek ondertekenen*, EDT-60, EDT-53), how a signed library that opens read-only (EDT-23) asks for its key (EDT-62, M-30), and where the identity in use (name and fingerprint, SG-21) is shown. |
| GQ-19 | 2026-11-06 | *Resolved 2026-11-06 by GD-35.* The links of GD-15 while the app is not public: hide the Google Play and F-Droid badges until the app is in the store, or show them with a line *binnenkort* (*coming soon*)? And where does the manager's manual live: this repository's GitHub wiki, or pages on `zangbundel.nl`? |
| GQ-20 | 2026-11-07 | Where and how the author edits the labels of tags (FDS EDT-30, `tags` in §4.1, D-44): a *Labels* part of the library fields of GD-22, listing each tag the songs use with a label per language (nl, en, de), and also the tags that have labels but no songs? Or from the tag chips of the song list (GD-13)? |
| GQ-21 | 2026-11-07 | *Resolved 2026-11-07 by GD-41: at least 360 px.* Should the centre area keep a minimum width? GD-10 limits each side bar on its own (left 220–480 px, right 240–520 px). In a window of 1024 px with both bars at their maximum, the centre shrinks to 24 px; at the 980 px minimum of GD-32 it disappears. Proposal: the centre keeps at least 360 px, and a bar's edge stops where the centre would get narrower. Found while building M4.3. |

---

## 5. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-05 | First draft: the app's colours, buttons and icons reused (GD-01, sections 2.1 to 2.3); behaviour is part of this document (GD-02); list of screens to write; open questions GQ-01 to GQ-05. |
| Draft 0.2 | 2026-11-05 | The owner's GUI notes: startup like the app's (GD-03), one main screen in four areas (GD-04), song fields in the left bar (GD-05), the song edited as verse and chorus sections (GD-06) with a small WYSIWYG editor each (GD-07), reordered by dragging (GD-08), a check before applying and a view after (GD-09). Open questions GQ-06 to GQ-15 for what the notes leave open or where they meet the FDS; GQ-05 extended. |
| Draft 0.3 | 2026-11-06 | Section 3.5: the first mock in `webapp/mock/`, with the assumptions it makes on open questions. |
| Draft 0.4 | 2026-11-06 | The owner's feedback on the mock: the side bars can be resized and folded, with a tab in the middle of each inner edge (GD-10, GQ-16); the song scrolls along while a section is dragged (GD-11); the colours are the app's night theme (black, dark grey, orange) instead of its night-blue configuration scheme (GD-12, section 2.1 rewritten). The mock follows all three. |
| Draft 0.5 | 2026-11-06 | The owner's feedback on the mock: no *Bekijken* in the song list, a click shows the song; search, sort and filter chips above the list as in the app's songbook (GD-13). GQ-17 added. |
| Draft 0.6 | 2026-11-06 | The owner's requests: identity buttons in the bottom bar to make, download and load a signing key (GD-14); an *Android-app* button with the official Google Play and F-Droid badges, the GitHub APK, the source code and the manuals of the app and the manager (GD-15). GQ-18 and GQ-19 added. |
| Draft 0.7 | 2026-11-06 | Walk-through of the open questions with the owner (section 3.6): deleting a song (GD-16), language from the browser and the bottom bar (GD-17), sections plus ChordPro text (GD-18), the common ChordPro parts with the rest kept locked (GD-19), apply always with a validation panel (GD-20), sets as a tab (GD-21), library fields in the left bar (GD-22), *Downloaden* and *Sluiten* (GD-23), signing in the download dialog and read-only signed libraries (GD-24), filter cleared for a new song (GD-25), name (GD-26), 3-second splash (GD-27), *Bibliotheek openen* (GD-28), severity icons (GD-29), logo and splash photograph (GD-30), system font (GD-31), desktop only (GD-32). Up/down buttons as keyboard alternative (GD-33), widths, folding and language remembered on the computer (GD-34), *binnenkort* badges and the manager's manual on its GitHub wiki (GD-35). All open questions GQ-01 to GQ-19 resolved. |
| Draft 0.8 | 2026-11-06 | The mock follows section 3.6 (GD-16 to GD-35); section 3.5 says how to use it. No decision changed. |
| Draft 0.9 | 2026-11-06 | The owner's feedback on the mock: leaving the song editor asks what to do with the changes and names the song (GD-36), instead of *Pas eerst toe of annuleer*. |
| Draft 0.10 | 2026-11-06 | Depends on FDS draft 0.6: the maintainer is required, the title at most 80 characters, and the terms *signed by* and *not signed* (GD-37); the mock follows. Equal spacing in the section editor (section 2.2). This draft is the design of version 0.1.0 (webappTDS TD-16). |
| Draft 0.11 | 2026-11-06 | The owner's feedback on the mock: the two editing modes are a named segmented control, *Blokken* and *Code (ChordPro)* (GD-38), instead of the switch of GD-18. |
| Draft 0.12 | 2026-11-06 | From the security assessment's SQ-08: *Sleutel vergeten* (GD-39) and forgetting the key after 30 minutes without input (GD-40); the mock follows. |
| Draft 0.13 | 2026-11-07 | FDS draft 0.10 adds tag labels to the library (EDT-30, D-44): where they are edited is open (GQ-20). |
| Draft 0.16 | 2026-11-07 | GD-41 (resolves GQ-21): the centre keeps at least 360 px; bars give way, the right first, and come back in a wider window. |
| Draft 0.15 | 2026-11-07 | GQ-21: a minimum width for the centre area, found while building the layout (M4.3). |
| Draft 0.14 | 2026-11-07 | GD-35 amended by the owner: the Google Play badge is left out until the app is listed. Google's badge guidelines ask for the badge unaltered, so it cannot be shown greyed. The F-Droid badge stays greyed with *binnenkort*. |
| Draft 0.17 | 2026-11-07 | GD-14 amended by the owner: *Sleutel downloaden* only for a new key not yet downloaded, once, because the key is non-extractable afterwards (SR-16). The key stays in memory until the page closes, through *Sluiten* (securityAssessment SR-41). |
| Draft 0.18 | 2026-11-07 | GD-37 as built in M5.4, the owner's choice: the maintainer's contact is one field *E-mail of website*, as in the mock; a value with a scheme (`https://…`) is the website, anything else the e-mail address. A library that has both shows the e-mail address, with the website under the field (*Ook: …*), so neither is dropped. Beyond the mock, from FDS EDT-13: *Andere licentie (SPDX-code)* with its own field, and an optional full licence text; the mock does not show them yet. |
| Draft 0.19 | 2026-11-07 | GD-42 (the owner): leaving the page with changes not yet downloaded, or a new key not yet downloaded, gives the browser's question; *Openen* and *Nieuw* ask M-60 first. |
| Draft 0.35 | 2026-11-10 | GD-45: *Over* states that only `https://zangbundel.nl` is the manager (securityAssessment SR-08, SF-24). |
| Draft 0.34 | 2026-11-10 | GD-32: the narrow page no longer cuts off its top on a phone. |
| Draft 0.33 | 2026-11-09 | After the owner's look at dev.6:
- **GD-20:** *Toepassen* refuses a song with an Error, and *Ga naar* opens the left bar on the right tab.
- **GD-05:** every empty recommended field is advised in the editor at once.
- **GD-22:** a library field's mark goes when that field is right.
- **GD-44:** the ⓘ is out of the tab order.

Added to the mock first and checked there. |
| Draft 0.32 | 2026-11-08 | GD-21 amended: no *Omhoog* and *Omlaag* in the *Sets* tab (the owner's choice); reordering sets is open (EDT-31). |
| Draft 0.31 | 2026-11-08 | GD-13 amended: *Bewerken* in a song row is a pen icon. |
| Draft 0.30 | 2026-11-08 | GD-24 amended: the lock beside the library's title shows only while the library is read-only, not for a signed library whose key is loaded. |
| Draft 0.29 | 2026-11-08 | GD-30 refined from the owner's sketch: the photograph is centred in the window and as high as the window above the bottom bar, the children's open book in view. |
| Draft 0.28 | 2026-11-08 | GD-30 amended (the owner's third look): the centre's photograph is fixed to the window and centred, so the side bars never move it. |
| Draft 0.27 | 2026-11-08 | GD-44 amended (F11): the library's fields have their ⓘ and explanation too, so every field of the left bar explains itself. Added to the mock first and checked there. |
| Draft 0.26 | 2026-11-08 | GD-22 amended after the owner's second look: the left bar's tabs *Liedgegevens* and *Bibliotheek* (F12), and a read-only library shown as values (F13). GD-43: the left strip shows both. Added to the mock first and checked there. |
| Draft 0.25 | 2026-11-08 | GD-44 (F8): an ⓘ beside each song-data field opens its explanation under it, in view mode and in the editor. Added to the mock first and checked there. |
| Draft 0.24 | 2026-11-08 | GD-43 (F6): a folded bar keeps a strip of icons that open it at that part. GD-30 amended (F10): the splash photograph behind the centre, its screens on a box. Both added to the mock first and checked there. |
| Draft 0.23 | 2026-11-08 | GD-08, GD-21 and GD-33 amended (F5, F7): dragging opens a gap where the card lands, and the card slides into it; *Omhoog* and *Omlaag* slide too. Added to the mock first and checked there. |
| Draft 0.22 | 2026-11-08 | GD-17 amended (F4): the language button opens a menu, as the mock already had. GD-13 amended (F1): the chip row's triangles replace its scrollbar, added to the mock first and checked there. |
| Draft 0.21 | 2026-11-08 | GD-20 and GD-13 amended after the owner's M5 review (F2): *Ga naar* on SNG-10 filters the song list to its songs with a chip *Zelfde titel*; a structure message on a song folder opens that song; a song not in the library leads to the library's home. The chip has the look of a chosen filter chip, so the mock is unchanged. |
| Draft 0.20 | 2026-11-07 | GD-19 clarified by the owner: a locked line inside a section keeps its place there, and the section stays editable around it. |
