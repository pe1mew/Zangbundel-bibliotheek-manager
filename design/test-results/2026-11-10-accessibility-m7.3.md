# Accessibility pass, M7.3 (2026-11-10)

| | |
|---|---|
| **Scope** | The manager at commit `3168701` plus the fixes below, as a trial build served with the production CSP (`connect-src 'none'`, Trusted Types) |
| **Yardstick** | WCAG 2.2, level AA. The project names no target of its own; this pass uses AA as the usual one. |
| **Why** | implementationPlan M7.3, completion plan C7: keyboard paths, focus, contrast, labels (GD-10, GD-33, GD-44) |
| **Run by** | The agent, in Chromium (the browser pane) at 1400 × 850 |

## How

- **An automated sweep, run in the page on each screen:**
  - every visible control has an accessible name;
  - no `tabindex` above 0;
  - every `aria-labelledby`, `aria-describedby` and `aria-controls` points at an element that exists;
  - no duplicate ids;
  - text contrast against its actual background (4.5:1, or 3:1 for large text), with disabled controls left out as WCAG allows;
  - landmarks and headings;
  - dialogs that are modal and named.
- **A keyboard walk with real key presses:**
  - every focus change logged, with whether a visible focus ring shows;
  - after each action, where the focus went.
- **Screens covered:**
  - the splash and the home screen;
  - the *Nieuwe bibliotheek* dialog;
  - the library's home with its fields;
  - a new song in the editor: *Blokken*, the switch to *Code (ChordPro)* with the arrow keys, the song's fields and the language list;
  - *Toepassen* and *Annuleren*;
  - the song in the list, and its pen;
  - *Controle* and *Over*.

## Found and fixed

| # | WCAG | Found | Fix |
|---|---|---|---|
| A1 | 2.4.3 Focus order | After an action that redraws a part of the screen, the focus fell to the page itself, so a keyboard user had to start again from the top. Affected: *Lied toevoegen*, *Toepassen*, *Annuleren*, *Maken*, and every bottom-bar button, since the bottom bar is redrawn each time. *Toepassen* lost it first, because the button is disabled while the worker applies. | `app/focus.js`: `render` notes the focused control and afterwards puts the focus on its new form (by id, tab, `data-key` or label). If the control is gone, the focus goes to the heading of that part. Checked: after *Maken* → the library's title; *Lied toevoegen* → *Nieuw lied*; *Toepassen* → the song's title; *Annuleren* → the library's or the song's title; *Controle*, then Escape → *Controle*. |
| A2 | 2.4.3, 3.2 | The list's pen opened the editor in the centre, but the focus stayed on the pen, so a screen reader did not say the editor had opened. | Opening the editor puts the focus on its heading (*Bewerken: …*), from wherever it was opened. |
| A3 | 4.1.3 Status messages | Each toast arrived as a new `role="status"` element with its text already in it, which screen readers often do not announce. | One hidden status region stays in the page, and each notice is written into it (`app/dialog.js`). Checked: *Wijzigingen toegepast* appears in the region. |
| A4 | 4.1.2 Name, role, value | The tab panels of both side bars had no name, and the tabs did not say which panel they control. | `aria-controls` on the tabs, and an `aria-labelledby` on the panel that follows the selected tab. |
| A5 | 1.4.3 Contrast | Placeholder text was the browser's `#757575`: 4.56:1 on black, but about 4.1:1 on the sheet grey of the block cards. | `::placeholder` is `#8F8F8F`: 6.5:1 on black, 5.8:1 on `#121212`. |
| A6 | 2.4.7 Focus visible | The block-type select in the editor showed only the browser's thin default ring, unlike every other control. | The sky-blue ring of 3 px, as everywhere. |

## Met as found

- **Every control has a name.** No positive `tabindex`, no broken references, no duplicate ids.
- **Text contrast:** no failures. The centre's boxes are solid black over the photograph.
- **Landmarks:** `aside` (left), `main`, `aside` (right) and `nav` (bottom). One `h1` per view, except in the editor, which has an `h2`.
- **The focus ring** is the sky-blue 3 px on every control. The bar edges light up their own line, and text fields have an orange border.
- **Dialogs** are native modal `<dialog>` elements. They have a name, put the focus in their first field or primary button, and give it back to the button that opened them.
- **The editing mode** (*Blokken*, *Code (ChordPro)*) is a radio group with one Tab stop; the arrow keys switch it (GD-38).
- **Moving without a mouse:** sections and the songs of a set have *Omhoog* and *Omlaag* besides dragging (GD-33). *Omhoog* and *Omlaag* were not pressed in this pass.
- **Tab order:** the bar edges, the left bar, the centre, the right bar, then the bottom bar.

## Not covered by this pass

- **A real screen reader** (NVDA, VoiceOver): only the roles, names and live regions were checked.
- **Firefox, Edge and Safari** (C5).
- **Zoom to 200 % and the reflow at 320 px:** below 900 px the manager shows its narrow page (GD-32).
- **Screens not walked:** the set view, the key dialogs, *Ga naar*, and *Omhoog*/*Omlaag* in use.

## Decided by the owner, and built: the ⓘ help from the keyboard (A7)

**The problem (GD-44):** Tab skips the ⓘ, as decided after the owner's look at dev.6, so a keyboard user could not open the explanations.

**The owner chose both remedies** ("Read out, plus a key"):
- **Read out:** every input, select and textarea of the song's fields and of the library form refers to its explanation (`aria-describedby`), so a screen reader reads it when the field gets the focus. Unit tests check every field of both.
- **A key:** **F1** in a field opens or closes its explanation; the ⓘ's tooltip names the key.

**Checked in Chromium:** in *Titel* of the library, F1 opened *De naam van de bibliotheek…*, and a second F1 closed it. The focus stayed in the field, and the browser opened no help of its own.

**Still to check** with the other browsers (C5): whether Firefox, Edge or Safari keep F1 for themselves.

## Second walk: the screens not walked (2026-11-11)

**Setup:** the trial source `0.3.0-dev.3` (commit `4f65fe4`) plus the fixes below, in Chromium at 1400 × 850, with the production CSP. The public test files were opened through a test hook in place of the file picker: `valid-unsigned.zbl`, `song-chorus-early.zbl` and `test-key-rfc8032.zbkey`. Real key presses throughout.

| # | WCAG | Found | Fix |
|---|---|---|---|
| A8 | 2.4.3, 2.4.6 | **An open set, *Omlaag*:** after the move, the focus went to the *Omlaag* of the first song, not to the song that moved. Every song's buttons had the same label, so the focus took the first match, and a second Enter moved a different song. | Each button names its song: *Omhoog: Vader Jacob*, *Omlaag: …*, *Uit de set: …* (`app/sets.js`). The focus stays on the moved song's button. Checked: two presses moved the same song twice. |
| A9 | 2.4.3 | When that song reached the bottom, its *Omlaag* was disabled, and the focus fell back to the set's heading. | `focus.js`: if the same control is still there but disabled, the focus goes to the first usable control beside it, here *Omhoog: Vader Jacob*. *Sleutel vergeten*, disabled once the key is forgotten, likewise passes the focus to *Sleutel maken*. |
| A10 | 1.3.1, 3.3.2 | ***Sleutel maken*:** the note under the name field (the name is not checked; the key stays in the browser) was not tied to the field, and the field was not marked required. | `aria-describedby` to the note, and `aria-required="true"` (`app/library-ui.js`). |

**Met as found:**
- ***Sleutel laden*** with the keyboard: the notice *Sleutel geladen: …* is read out, and the focus stays on the button.
- ***Sleutel vergeten*** gives its notice.
- **The *Sleutel maken* dialog** is modal and named, the focus goes into the labelled name field, and Escape gives the focus back to the button.
- ***Controle*** opens on *Sluiten*. Each finding is a button.
- ***Ga naar*:**
  - On an error in a song, it opens that song in *Code (ChordPro)* with the cursor on the line (41).
  - On a warning, it opens the song with the focus in the field to fill (*Tekst*), which carries its explanation.
- **Opening a set** keeps the focus on its row in the list, the same list-and-detail pattern as a song.
- No console errors.

**Still not covered:** a real screen reader, the other browsers (C5), and making a key all the way to its download, which would save a file to the owner's disk.
