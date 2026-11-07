// SPDX-License-Identifier: Apache-2.0
// The song editor in *Blokken* mode (webappGUI GD-06, GD-07, GD-19, GD-20, GD-33; implementationPlan
// M5.3a). It edits the block form the worker made (core/blocks.js, M2.3): sections with their kind,
// label and text, remarks locked in their place inside a section, chorus repeats and locked blocks.
// Metadata lines are kept as they are (the left bar edits them, M5.3c). Nothing is parsed here: typed
// text is only kept free of characters a lyric line cannot hold (GD-07), and the worker writes the song
// back (fromBlocks), refusing what would change meaning.

import { el, icon, listen, setAttrs } from './dom.js';
import { startDrag } from './drag.js';
import { t, tParts } from './i18n.js';
import { messageFor, severityGroup, severityIcon } from './check.js';
import { createSongFields } from './songfields.js';
import { metaValues } from '../core/blockmeta.js';

const KINDS = ['verse', 'chorus', 'bridge'];
const KIND_TEXT = { verse: 'kVerse', chorus: 'kChorus', bridge: 'kBridge' };
const PLACEHOLDER = { verse: 'phVerse', chorus: 'phChorus', bridge: 'phBridge' };
// GD-07: braces belong to directives and are not typed in lyrics; control characters never are (SNG-01)
const FORBIDDEN = /[{}\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** GD-07: typed or pasted text without the characters a lyric line cannot hold; CR LF becomes LF. */
export function cleanTyped(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(FORBIDDEN, '');
}

/** GD-07: the lines (from 1) that start with #, which would make them maintainer notes, not lyrics (5.2). */
export function notLyricLines(text) {
  return text.split('\n').flatMap((line, k) => (line.startsWith('#') ? [k + 1] : []));
}

/** A section's lines as parts: runs of lyric lines (one text each) and locked lines between them. */
export function partsOf(lines) {
  const parts = [];
  for (const line of lines) {
    if (typeof line !== 'string') parts.push({ locked: line.locked });
    else if (parts.length && parts[parts.length - 1].text !== undefined) parts[parts.length - 1].text += `\n${line}`;
    else parts.push({ text: line });
  }
  if (!parts.some((p) => p.text !== undefined)) parts.push({ text: '' });
  return parts;
}

/** And back: the section's lines from its parts. */
export function linesOf(parts) {
  return parts.flatMap((p) => (p.locked !== undefined ? [{ locked: p.locked }] : p.text.split('\n')));
}

/** The blocks the editor shows: all but metadata lines, with their index in the form. */
export const shownIndexes = (form) => form.blocks.flatMap((b, i) => (b.type === 'meta' ? [] : [i]));

/** GD-33: move the shown block at form index i one shown place up (-1) or down (+1); metadata stays put. */
export function moveBlock(form, i, dir) {
  const shown = shownIndexes(form);
  const k = shown.indexOf(i);
  const other = shown[k + dir];
  if (k < 0 || other === undefined) return form;
  const blocks = form.blocks.slice();
  [blocks[i], blocks[other]] = [blocks[other], blocks[i]];
  return { ...form, blocks };
}

/**
 * GD-08: move block to place `to` among the other shown blocks (0 is before the first of them; their
 * count is after the last). Metadata lines keep their place.
 */
export function moveToPosition(form, block, to) {
  const rest = form.blocks.filter((b) => b !== block);
  const others = rest.filter((b) => b.type !== 'meta');
  if (!form.blocks.includes(block) || to < 0 || to > others.length) return form;
  const at = to < others.length ? rest.indexOf(others[to]) : rest.indexOf(others[others.length - 1]) + 1;
  rest.splice(others.length ? at : rest.length, 0, block);
  return { ...form, blocks: rest };
}

/** The first lyric line of the chorus a repeat at form index i repeats (7.2: the most recent above it). */
function repeatedChorus(form, i, label) {
  const above = form.blocks.slice(0, i).filter((b) => b.type === 'section' && b.kind === 'chorus');
  const labelled = label ? above.filter((b) => b.label === label) : [];
  const c = labelled.length ? labelled[labelled.length - 1] : above[above.length - 1];
  if (!c) return null;
  const first = c.lines.find((x) => typeof x === 'string' && x.trim() !== '');
  return first ? first.replace(/\[[^\]]*\]/g, '') : '';
}

const rowsFor = (text) => Math.max(2, text.split('\n').length);

/** The song code as it compares: no spaces or tabs at line ends, no blank lines at the end (song format 8.1). */
export const sameCode = (a, b) => {
  const trimEnd = (s) => {                                // linear, unlike /[ \t]+$/ on a long run (SR-33)
    let i = s.length;
    while (i > 0 && (s[i - 1] === ' ' || s[i - 1] === '\t')) i--;
    return s.slice(0, i);
  };
  const norm = (s) => {
    const lines = s.replace(/\r\n?/g, '\n').split('\n').map(trimEnd);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
  };
  return norm(a) === norm(b);
};
// code mode: no control characters but tab and line ends (SNG-01); braces are directives there
const CODE_FORBIDDEN = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;
export const cleanCode = (text) => String(text).replace(/\r\n?/g, '\n').replace(CODE_FORBIDDEN, '');
const CODE_MAX = 64 * 1024;                               // FDS 3.5: a larger song is refused anyway (SNG-18)

/**
 * createSongEditor({ lang, id, text, form, title, onApply(state), onCancel(), onDelete(), onMode(mode),
 * toText(form), toForm(text), checkCode(text) }) → { node, fieldsNode(), state(), mode(), changed(), showProblem(text) }.
 * fieldsNode() is the song's fields for the left bar in *Blokken* (songfields.js, M5.3c).
 * text and form are the song as opened, as text and as the worker's block form; the form is edited in a
 * copy. state() is { mode: 'blocks', form } or { mode: 'code', text }. toText, toForm and checkCode go to
 * the worker: blocks to text ({ text } or { problem }), canonical text to blocks, the song rules over code.
 * GD-38: switching keeps every change, and switching without changes leaves the song exactly as it was.
 */
export function createSongEditor({ lang, id, isNew = false, text: original, form: initial, title, onApply, onCancel, onDelete,
  onMode = () => {}, toText, toForm, checkCode }) {
  let form = structuredClone(initial);
  const start = JSON.stringify(initial);
  let mode = 'blocks';
  let code = '';
  let codeFrom = '';                                      // the code as the code mode opened it
  let formAtCode = null;                                  // the blocks as they were then
  let switching = false;
  const sections = el('div', { class: 'sections' }, []);
  const problem = el('p', { class: 'blocked', role: 'alert', hidden: true }, []);

  const hint = (box, message) => {
    box.replaceChildren(...(message ? [icon('warning', 'sev sev-warning'), message] : []));
    box.hidden = !message;
  };

  function textEditor(block, parts, k, hintBox) {
    const ta = el('textarea', { class: 'editor', rows: rowsFor(parts[k].text), spellcheck: 'true',
      placeholder: t(lang, PLACEHOLDER[block.kind]), 'aria-label': t(lang, KIND_TEXT[block.kind]) }, [parts[k].text]);
    const check = () => {
      const bad = notLyricLines(ta.value);
      hint(hintBox, bad.length ? bad.map((n) => t(lang, 'lineNotLyric', { n })).join(' ') : null);
    };
    listen(ta, 'input', () => {
      const clean = cleanTyped(ta.value);
      if (clean !== ta.value) {
        const at = Math.max(0, ta.selectionStart - (ta.value.length - clean.length));
        ta.value = clean;
        ta.setSelectionRange(at, at);
        hint(hintBox, t(lang, 'braces'));
      } else {
        check();
      }
      parts[k].text = ta.value;
      block.lines = linesOf(parts);
      setAttrs(ta, { rows: rowsFor(ta.value) });
    });
    check();
    return ta;
  }

  function sectionBody(block) {
    const parts = partsOf(block.lines);
    const hintBox = el('div', { class: 'hint', hidden: true }, []);
    const body = parts.map((p, k) => (p.locked !== undefined
      ? el('div', { class: 'lockedline' }, [
        el('pre', {}, [p.locked]),
        el('button', { type: 'button', class: 'iconbtn', title: t(lang, 'removeLocked'), 'aria-label': t(lang, 'removeLocked'),
          on: { click: () => { parts.splice(k, 1); block.lines = linesOf(parts); draw(); } } }, [icon('close')]),
      ])
      : textEditor(block, parts, k, hintBox)));
    return [...body, hintBox];
  }

  // ---- GD-08, GD-11: drag a block by its handle (drag.js); near the top or bottom the song scrolls along
  function dragBlock(e, block, handle) {
    startDrag(e, { handle, card: handle.closest('.section'), list: sections, scroller: node.closest('.centre') || node.parentElement || node,
      foot: node.querySelector('.editfoot'),
      onDrop: (from, to) => {
        const scroller = node.closest('.centre') || node;
        const keep = scroller.scrollTop;
        form = moveToPosition(form, block, to);
        draw();
        scroller.scrollTop = keep;                        // it lands where it was dropped and stays in view
        sections.children[to]?.scrollIntoView?.({ block: 'nearest' });
      } });
  }

  function bar(i, block, shown) {
    const pos = shown.indexOf(i);
    const kind = block.type === 'section'
      ? el('select', { 'aria-label': t(lang, 'blockKind'), on: { change: (e) => { block.kind = e.target.value; draw(); } } },
        KINDS.map((k) => el('option', { value: k, selected: block.kind === k }, [t(lang, KIND_TEXT[k])])))
      : block.type === 'repeat' ? el('span', { class: 'kindlbl' }, [t(lang, 'kRepeat')])
        : el('span', { class: 'kindlbl locked' }, [icon('lock', 'inl'), t(lang, 'kLocked')]);
    const label = block.type === 'section' || block.type === 'repeat'
      ? el('input', { class: 'labelin', type: 'text', value: block.label || '', maxlength: 60, autocomplete: 'off',
        placeholder: t(lang, 'labelPh'), 'aria-label': t(lang, 'labelPh'),
        on: { input: (e) => {
          const clean = cleanTyped(e.target.value).replace(/\n/g, ' ');
          if (clean !== e.target.value) e.target.value = clean;
          block.label = clean.trim() || null;
        } } }, [])
      : null;
    const btn = (name, text, disabled, click) => el('button', { type: 'button', class: 'iconbtn', title: text, 'aria-label': text, disabled,
      on: disabled ? undefined : { click } }, [icon(name)]);
    // the block's place is looked up when a button is used: a metadata field written from the left bar
    // (M5.3c) adds or removes lines above it without drawing the blocks again
    const move = (dir) => () => { form = moveBlock(form, form.blocks.indexOf(block), dir); draw(block, dir); };
    // GD-08: the handle is for the pointer; the keyboard has Omhoog and Omlaag (GD-33)
    const handle = el('span', { class: 'handle', title: t(lang, 'dragTitle'), 'aria-hidden': 'true' }, [icon('drag')]);
    if (shown.length > 1) listen(handle, 'pointerdown', (e) => dragBlock(e, block, handle));
    return el('div', { class: 'secbar' }, [handle, kind, label, el('span', { class: 'grow' }, []),
      btn('up', t(lang, 'up'), pos === 0, move(-1)),
      btn('down', t(lang, 'down'), pos === shown.length - 1, move(1)),
      btn('delete', t(lang, 'deleteBlock'), false, () => { form = { ...form, blocks: form.blocks.filter((x) => x !== block) }; draw(); }),
    ]);
  }

  function blockNode(i, shown) {
    const block = form.blocks[i];
    const cls = block.type === 'section' ? `section ${block.kind}` : block.type === 'repeat' ? 'section repeat' : 'section locked';
    const body = block.type === 'section' ? sectionBody(block)
      : block.type === 'repeat' ? [el('div', { class: 'repeatinfo muted' }, [((first) => (first === null ? t(lang, 'repeatsNone')
        : t(lang, 'repeats', { t: `${first} …` })))(repeatedChorus(form, i, block.label))])]
        : [el('pre', { class: 'lockedtext' }, [block.lines.join('\n')]), el('div', { class: 'muted small' }, [t(lang, 'lockedNote')])];
    return el('div', { class: cls }, [bar(i, block, shown), ...body]);
  }

  // draw the blocks again after a change of structure; focus follows a moved block's button
  function draw(moved, dir) {
    const shown = shownIndexes(form);
    sections.replaceChildren(...shown.map((i) => blockNode(i, shown)));
    if (moved) {
      const card = sections.children[shown.indexOf(form.blocks.indexOf(moved))];
      const button = card && card.querySelector(`button[aria-label="${t(lang, dir < 0 ? 'up' : 'down')}"]`);
      if (button && !button.disabled) button.focus();
      else if (card) card.querySelector('button:not([disabled])')?.focus();
    }
  }

  const add = (block) => {
    form = { ...form, blocks: [...form.blocks, block] };
    draw();
    const last = sections.lastElementChild;
    if (last) {
      (last.querySelector('textarea') || last.querySelector('input') || last).focus?.();
      last.scrollIntoView?.({ block: 'nearest' });
    }
  };
  const addRow = el('div', { class: 'addrow' }, [
    ...KINDS.map((k) => el('button', { type: 'button', class: 'btn btn-outline',
      on: { click: () => add({ type: 'section', kind: k, label: null, lines: [''], implicit: false }) } }, [icon('add'), t(lang, KIND_TEXT[k])])),
    el('button', { type: 'button', class: 'btn btn-outline', on: { click: () => add({ type: 'repeat', label: null }) } }, [icon('add'), t(lang, 'kRepeat')]),
  ]);

  // GD-05, EDT-34: the song's fields write into the same form; no redraw of the blocks is needed for that
  let fields = null;
  const makeFields = () => {
    fields = createSongFields({ lang, id, getForm: () => form, setForm: (next) => { form = next; } });
  };

  const showProblem = (text) => {
    problem.replaceChildren(...(text ? [text] : []));
    problem.hidden = !text;
    if (text) problem.scrollIntoView?.({ block: 'nearest' });
  };

  // ---- the code mode (GD-38, EDT-33): the song as ChordPro code, with the song rules while typing
  const codeArea = el('textarea', { class: 'cptext', spellcheck: 'false', autocomplete: 'off', maxlength: CODE_MAX,
    'aria-label': t(lang, 'modeCode'), 'aria-describedby': 'code-checks' }, []);
  const checks = el('ul', { class: 'problems', id: 'code-checks', 'aria-live': 'polite' }, []);
  const codeHint = el('div', { class: 'hint', hidden: true }, []);
  let checkSeq = 0;
  let checkTimer = null;
  const runChecks = () => {
    const mine = ++checkSeq;
    checkCode(code).then((findings) => {
      if (mine !== checkSeq) return;                      // a newer check is on its way
      const shown = findings || [];                       // as Controle shows them, Info included
      checks.replaceChildren(...(shown.length
        ? shown.map((f) => el('li', {}, [severityIcon(severityGroup(f.severity)), messageFor(lang, f)]))
        : [el('li', { class: 'ok' }, [icon('check'), t(lang, 'checkNone')])]));
    }, () => {});
  };
  listen(codeArea, 'input', () => {
    const clean = cleanCode(codeArea.value);
    if (clean !== codeArea.value) {
      const at = Math.max(0, codeArea.selectionStart - (codeArea.value.length - clean.length));
      codeArea.value = clean;
      codeArea.setSelectionRange(at, at);
      hint(codeHint, t(lang, 'pasted'));
    }
    code = codeArea.value;
    setAttrs(codeArea, { rows: Math.max(12, code.split('\n').length + 1) });
    clearTimeout(checkTimer);
    checkTimer = setTimeout(runChecks, 300);              // EDT-42: as the user types, without a check per key
  });
  const codeBody = el('div', { class: 'codebody' }, [el('p', { class: 'muted small' }, [t(lang, 'textHelp')]), codeArea, codeHint, checks]);
  // GD-08, GD-33: how blocks move, with the handle and the buttons as they look
  const small = (name) => icon(name, 'inl');
  const help = el('p', { class: 'muted small edithelp' }, tParts(lang, 'editHelp', { drag: small('drag'), up: small('up'), down: small('down') }));
  const blocksBody = el('div', { class: 'blocksbody' }, [help, sections, addRow]);

  // ---- the two modes (GD-38): a radio group, one Tab stop, the arrow keys move between them
  const radios = {};
  const radio = (name, iconName, text) => {
    const b = el('button', { type: 'button', role: 'radio', 'data-mode': name, on: {
      click: () => switchTo(name),
      keydown: (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const other = name === 'blocks' ? 'code' : 'blocks';
        switchTo(other).then(() => radios[other].focus());
      },
    } }, [icon(iconName), text]);
    radios[name] = b;
    return b;
  };
  const modes = el('div', { class: 'modes' }, [
    el('span', { class: 'muted small', id: 'mode-label' }, [t(lang, 'modeLabel')]),
    el('div', { class: 'segmented', role: 'radiogroup', 'aria-labelledby': 'mode-label' }, [
      radio('blocks', 'list', t(lang, 'modeBlocks')), radio('code', 'edit', t(lang, 'modeCode'))]),
  ]);
  const body = el('div', {}, [blocksBody]);
  const markMode = () => {
    for (const [name, b] of Object.entries(radios)) {
      setAttrs(b, { 'aria-checked': name === mode ? 'true' : 'false', tabindex: name === mode ? 0 : -1, class: name === mode ? 'on' : null });
    }
  };

  async function switchTo(next) {
    if (next === mode || switching) return;
    switching = true;
    try {
      showProblem(null);
      if (next === 'code') {
        const r = await toText(form);
        if (r.problem) {
          showProblem(t(lang, 'switchProblem'));         // a line or label the blocks cannot write: fix it first
          return;
        }
        code = r.text;
        codeFrom = r.text;
        formAtCode = form;
        codeArea.value = code;
        setAttrs(codeArea, { rows: Math.max(12, code.split('\n').length + 1) });
        hint(codeHint, null);
        mode = 'code';
        body.replaceChildren(codeBody);
        runChecks();
        codeArea.focus();
      } else {
        // GD-38: code that was not changed gives back exactly the blocks it came from
        form = code === codeFrom ? formAtCode : structuredClone(await toForm(code));
        makeFields();                                     // the fields read the form as it is now
        mode = 'blocks';
        body.replaceChildren(blocksBody);
        draw();
        sections.querySelector('textarea')?.focus();
      }
      markMode();
      onMode(mode);
    } finally {
      switching = false;
    }
  }

  const node = el('div', { class: 'editwrap' }, [
    el('div', { class: 'edit' }, [
      el('div', { class: 'edithead' }, [el('h2', {}, [isNew ? t(lang, 'newSongTitle') : t(lang, 'editing', { t: title })]), modes]),
      problem,
      body,
    ]),
    el('div', { class: 'editfoot' }, [
      // GD-16: a new song not yet applied has no delete button; Annuleren throws it away
      isNew ? el('span', { class: 'delsong' }, []) : el('button', { type: 'button', class: 'btn btn-text delsong', on: { click: () => onDelete() } },
        [icon('delete'), t(lang, 'deleteSong')]),
      el('button', { type: 'button', class: 'btn btn-text', on: { click: () => onCancel() } }, [t(lang, 'cancel')]),
      el('button', { type: 'button', class: 'btn btn-primary', on: { click: () => onApply(mode === 'code' ? { mode, text: code } : { mode, form }) } },
        [icon('check'), t(lang, 'apply')]),
    ]),
  ]);
  markMode();
  draw();
  makeFields();

  return {
    node,
    /** What Toepassen applies, in the mode that is open (GD-38). */
    state: () => (mode === 'code' ? { mode, text: code } : { mode, form }),
    mode: () => mode,
    /** GD-36: the title typed in the fields, to name a new song in the leave question (none in the code mode). */
    currentTitle: () => (mode === 'blocks' ? metaValues(form, 'title')[0] || null : null),
    fieldsNode: () => fields.node,
    /** GD-36: whether there is anything to apply or throw away. */
    changed: () => (mode === 'code' ? !sameCode(code, original) : JSON.stringify(form) !== start),
    /** What the worker could not write: shown above the song. */
    showProblem,
  };
}
