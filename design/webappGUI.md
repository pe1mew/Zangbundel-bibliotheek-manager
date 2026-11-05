# GUI Design — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | GUI design of the web app: screens, behaviour, look |
| **Status** | Draft 0.2 |
| **Date** | 2026-11-05 |
| **Depends on** | `design/FDS.md` draft 0.4; the Zangbundel app's `design/guiDesign.md` v0.66 (section 9 colour reference) |
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

### 2.1 Colours (from GD-01)

The manager uses the app's configuration-screen scheme (app `Theme.kt`, `ConfigurationScheme`):

| Role | Name | Value |
|---|---|---|
| Background | Night blue dark | `#0B2545` |
| Surface (panels, cards) | Night blue | `#13315C` |
| Primary (main buttons, focus) | Fire orange | `#FF8A3D` |
| Text on primary | Night blue dark | `#0B2545` |
| Secondary accent | Fire orange light | `#FFB36B` |
| Links, tertiary accent | Sky blue | `#4FC3F7` |
| Text | White | `#FFFFFF` |
| Secondary text | Off-white | `#CFE6FF` |

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

### 2.3 Icons (from GD-01)

The app's icons are Google Material Icons path data (Apache License 2.0), tinted by the caller: `ic_about`, `ic_library`, `ic_list`, `ic_settings`, `ic_memories`, `ic_chevron_*` in `android/app/src/main/res/drawable/`. The manager uses the same icons, converted to SVG with the same path data, for the same meanings. Further icons come from the same set. The app icon (`design/icon/zangbundel-icon.svg`, CC BY-SA 4.0) may be used as the manager's logo and favicon (GQ-03).

Reusing these files brings their licences into this repository: the Material Icons under Apache 2.0, the app artwork under CC BY-SA 4.0 with credit to Remko Welling, PE1MEW. `NOTICE` and `license.md` must name them in the change that first copies them.

---

## 3. Screens and behaviour

The owner's GUI notes of 2026-11-05 are recorded below as decisions GD-03 to GD-09, in the owner's words where possible. The notes call the product *Songbook Dictionary Manager* and a library a *dictionary*; this document uses the FDS term **library** (*bibliotheek*), and the product name is GQ-06. Where a note meets an FDS requirement it does not cover, or departs from one, the point is an open question in section 4 (GQ-06 to GQ-15), not a change to the FDS.

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
- **Right bar:** the library's song list. It shows every song by name (its title), with buttons per song, for example *view* and *edit*.
- **Left bar:** the tags and metadata fields of the selected song, to the left of the editor.
- **Centre area:** above the bottom bar, between the left and right bars. It shows the selected song in view mode or in edit mode.

Not yet placed in this layout: the library's own fields (title, description, licence, maintainer), the sets, the validation panel, signing and keys, and the language choice (GQ-10 to GQ-12).

### 3.3 Edit mode

**GD-05 — Song information in separate fields in the left bar.** *(Owner, 2026-11-05.)* Metadata, copyright data, tags and other song information are separate fields in the left bar. This is the form of FDS EDT-34: each field reads and writes its directive in the song (song format §6.1).

**GD-06 — The song is edited as a sequence of sections.** *(Owner, 2026-11-05.)* The song editor in the centre consists of two kinds of section: **chorus** (*refrein*) and **verse** (*couplet*). The user adds as many choruses and verses as needed; together and in order they define the song's structure. Which other parts of the ChordPro profile the editor must represent is GQ-13; how this relates to editing the ChordPro text directly (FDS EDT-33) is GQ-14.

**GD-07 — Each section has a small WYSIWYG editor.** *(Owner, 2026-11-05.)* Each section has its own small editor that shows the text as it will look, and accepts only the characters allowed in songs (song format §5.1: UTF-8, no control characters other than line ends; braces and brackets only as the profile allows, §5.3 and §5.4).

**GD-08 — Sections are reordered by dragging.** *(Owner, 2026-11-05.)* Sections are moved up and down by dragging them with the mouse. A keyboard alternative is GQ-15.

### 3.4 Applying changes

**GD-09 — Apply checks, then shows.** *(Owner, 2026-11-05.)*

- Before changes to a song are applied, an automatic check verifies that all required fields are filled in correctly (FDS SNG-02, SNG-11, SNG-12 and the other song rules of §6.6).
- After applying, the user sees the song as it will appear (view mode in the centre area).

How *apply* relates to the FDS's validation while typing (EDT-42) and to Save being blocked only by Errors (EDT-50) is GQ-12.

---

## 4. Open questions

| ID | Date | Question |
|---|---|---|
| GQ-01 | 2026-11-05 | Does the manager use the app's background photograph (app guiDesign section 5) on its start screen, as the app's configuration screens do, or only the plain night-blue background? |
| GQ-02 | 2026-11-05 | Which colours and icons mark the severities Fatal, Error, Warning and Info in the validation panel? The app's palette has no red or yellow; a choice must stay readable on night blue and must not rely on colour alone. |
| GQ-03 | 2026-11-05 | Is the app icon the manager's logo and favicon, or does the manager get its own mark in the same style? |
| GQ-04 | 2026-11-05 | Which font: the platform's system font stack (as the app uses the platform font, app guiDesign D-18), or a web font served from the project's own server? |
| GQ-05 | 2026-11-05 | Which screen widths are designed for: desktop and laptop only, or also tablet and phone? Editing ChordPro text is a desktop task, but FDS 1.4 says every implementation behaves identically. The four-area layout of GD-04 needs a desktop width; on a narrow screen the bars would have to fold away. |
| GQ-06 | 2026-11-05 | The product name on the splash and in the browser tab. The notes say *Songbook Dictionary Manager*; the repository and README say *Zangbundel bibliotheek-manager*, and the FDS calls a song collection a *library* (*bibliotheek*). Proposal: *Zangbundel bibliotheek-manager* in Dutch, *Zangbundel library manager* in English and *Zangbundel Bibliotheksverwaltung* in German, following the app's glossary (EDT-83). |
| GQ-07 | 2026-11-05 | How long the splash stays. The notes say "a few seconds"; the app shows its welcome screen for at most 1.5 s, or until a tap (app guiDesign D-05), so that it never delays the user. Follow the app (GD-01)? |
| GQ-08 | 2026-11-05 | The words for opening a library. The notes say *upload and open*, but TD-06 means nothing is uploaded: the file is read in the browser. *Upload* would tell the user the opposite of what happens. Proposal: *Open library* (*Bibliotheek openen*), with a line that the file stays on this computer. |
| GQ-09 | 2026-11-05 | Where *Save as copy* (EDT-70 to EDT-73) and *Close* without saving (EDT-01, EDT-03, M-60) appear, next to *Close and download*. Does *Close and download* save and then end the session, or can the user download and keep editing? |
| GQ-10 | 2026-11-05 | Where the library's own fields (title, description, licence, maintainer: EDT-13, EDT-14, EDT-30), signing and keys (§7.7, including the notice M-64 and the fingerprint SG-21) and the language choice (EDT-81) go. The left bar holds the selected song's fields; does it switch to the library's fields when no song is selected, or does the bottom bar open them? |
| GQ-11 | 2026-11-05 | Where the sets go and how they are edited (EDT-31: add, rename, reorder, delete; add and reorder songs in a set; a song in several sets). The right bar shows the library's songs; a second list, a tab in the right bar, or a view in the centre? |
| GQ-12 | 2026-11-05 | Where the validation panel goes (EDT-40, EDT-41: all messages grouped by severity, each leading to its location), and how *apply* (GD-09) relates to the FDS. The FDS validates while typing (EDT-42) and blocks only Save, only on Errors (EDT-50), so a half-finished song may stay in the library while the user works. Does *apply* refuse a song with an Error, or apply it and show the Error in the panel? |
| GQ-13 | 2026-11-05 | Which parts of the ChordPro profile the section editor (GD-06) represents besides verse and chorus: bridge (song format §7.1), repeating a chorus with `{chorus}` (§7.2), section labels, implicit verses (§7.3), `{comment}` remarks (§7.4), chords in brackets (§5.4), tab, grid and ABC blocks, `#` maintainer comments and unknown directives (§10.1). A song opened from a file may contain any of them; the editor must keep what it cannot show unchanged, or the song's content hash changes and the app sees a new song. |
| GQ-14 | 2026-11-05 | FDS EDT-33 says the song text is edited "as ChordPro text directly". The section editor (GD-06, GD-07) replaces that with a structured editor. Keep a plain-text view as a second mode for users who know ChordPro, or amend EDT-33 to allow the section editor alone? |
| GQ-15 | 2026-11-05 | A keyboard alternative to dragging sections (GD-08), for users who cannot use a mouse well: for example *move up* and *move down* buttons on each section. |

---

## 5. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-05 | First draft: the app's colours, buttons and icons reused (GD-01, sections 2.1 to 2.3); behaviour is part of this document (GD-02); list of screens to write; open questions GQ-01 to GQ-05. |
| Draft 0.2 | 2026-11-05 | The owner's GUI notes: startup like the app's (GD-03), one main screen in four areas (GD-04), song fields in the left bar (GD-05), the song edited as verse and chorus sections (GD-06) with a small WYSIWYG editor each (GD-07), reordered by dragging (GD-08), a check before applying and a view after (GD-09). Open questions GQ-06 to GQ-15 for what the notes leave open or where they meet the FDS; GQ-05 extended. |
