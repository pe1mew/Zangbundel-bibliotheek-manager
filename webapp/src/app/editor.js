// SPDX-License-Identifier: Apache-2.0
// The song editor in *Blokken* mode (webappGUI GD-06, GD-07, GD-19, GD-20, GD-33; implementationPlan
// M5.3a). It edits the block form the worker made (core/blocks.js, M2.3): sections with their kind,
// label and text, remarks locked in their place inside a section, chorus repeats and locked blocks.
// Metadata lines are kept as they are (the left bar edits them, M5.3c). Nothing is parsed here: typed
// text is only kept free of characters a lyric line cannot hold (GD-07), and the worker writes the song
// back (fromBlocks), refusing what would change meaning.

import { el, icon, listen, setAttrs } from './dom.js';
import { t } from './i18n.js';

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

/**
 * createSongEditor({ lang, form, title, onApply(form), onCancel(), onDelete() }) → { node, form(),
 * changed(), showProblem(text) }. form is the worker's block form; it is edited in a copy.
 */
export function createSongEditor({ lang, form: initial, title, onApply, onCancel, onDelete }) {
  let form = structuredClone(initial);
  const start = JSON.stringify(initial);
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
    return el('div', { class: 'secbar' }, [kind, label, el('span', { class: 'grow' }, []),
      btn('up', t(lang, 'up'), pos === 0, () => { form = moveBlock(form, i, -1); draw(i, 'up'); }),
      btn('down', t(lang, 'down'), pos === shown.length - 1, () => { form = moveBlock(form, i, 1); draw(i, 'down'); }),
      btn('delete', t(lang, 'deleteBlock'), false, () => { form = { ...form, blocks: form.blocks.filter((x, n) => n !== i) }; draw(); }),
    ]);
  }

  function blockNode(i, shown) {
    const block = form.blocks[i];
    const cls = block.type === 'section' ? `section ${block.kind}` : block.type === 'repeat' ? 'section repeat' : 'section locked';
    const body = block.type === 'section' ? sectionBody(block)
      : block.type === 'repeat' ? [el('div', { class: 'repeatinfo muted' }, [((first) => (first === null ? t(lang, 'repeatsNone')
        : t(lang, 'repeats', { t: `${first} …` })))(repeatedChorus(form, i, block.label))])]
        : [el('pre', { class: 'lockedtext' }, [block.lines.join('\n')]), el('div', { class: 'muted small' }, [t(lang, 'lockedNote')])];
    return el('div', { class: cls, 'data-block': i }, [bar(i, block, shown), ...body]);
  }

  // draw the blocks again after a change of structure; focus follows a moved block's button
  function draw(movedFrom, dir) {
    const shown = shownIndexes(form);
    sections.replaceChildren(...shown.map((i) => blockNode(i, shown)));
    if (movedFrom !== undefined) {
      const target = shownIndexes(form)[shown.indexOf(movedFrom) + (dir === 'up' ? -1 : 1)];
      const card = [...sections.children].find((c) => c.getAttribute('data-block') === String(target));
      const button = card && card.querySelector(`button[aria-label="${t(lang, dir === 'up' ? 'up' : 'down')}"]`);
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

  const node = el('div', { class: 'editwrap' }, [
    el('div', { class: 'edit' }, [
      el('div', { class: 'edithead' }, [el('h2', {}, [t(lang, 'editing', { t: title })])]),
      problem,
      sections,
      addRow,
    ]),
    el('div', { class: 'editfoot' }, [
      el('button', { type: 'button', class: 'btn btn-text delsong', on: { click: () => onDelete() } }, [icon('delete'), t(lang, 'deleteSong')]),
      el('button', { type: 'button', class: 'btn btn-text', on: { click: () => onCancel() } }, [t(lang, 'cancel')]),
      el('button', { type: 'button', class: 'btn btn-primary', on: { click: () => onApply(form) } }, [icon('check'), t(lang, 'apply')]),
    ]),
  ]);
  draw();

  return {
    node,
    form: () => form,
    /** GD-36: whether there is anything to apply or throw away. */
    changed: () => JSON.stringify(form) !== start,
    /** A block form the worker could not write (fromBlocks): shown above the blocks. */
    showProblem(text) {
      problem.replaceChildren(...(text ? [text] : []));
      problem.hidden = !text;
      if (text) problem.scrollIntoView?.({ block: 'nearest' });
    },
  };
}
