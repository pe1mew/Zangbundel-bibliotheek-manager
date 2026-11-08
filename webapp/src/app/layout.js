// SPDX-License-Identifier: Apache-2.0
// The main screen's frame (webappGUI GD-03, GD-04, GD-10, GD-32, GD-34; implementationPlan M4.3):
// the left bar, the centre, the right bar and the bottom bar, with the side bars' inner edges that
// resize them and the tabs that fold them. Widths and folding are remembered on this computer
// (zbm.bars). The centre keeps at least 360 px (GD-41). The screens put their content into the four
// areas; this module draws only the frame.

import { el, icon, listen, replace, setAttrs, setInert, setVar, toggleClass } from './dom.js';
import { afterKey, LIMITS, parseBars, serializeBars, shownWidths, toggled, withWidth } from './bars.js';
import { load, save } from './storage.js';
import { t } from './i18n.js';

/**
 * Build the frame. getLang() gives the current interface language; store is local storage (tests).
 * Returns { app, left, centre, right, bottom, setSplash(on), relabel(), unfold(side) }.
 */
export function createLayout({ getLang, store } = {}) {
  let bars = parseBars(load('zbm.bars', store));
  let splash = false;

  const left = el('aside', { class: 'left', id: 'left' }, []);
  const centre = el('main', { class: 'centre', id: 'centre' }, []);
  const right = el('aside', { class: 'right', id: 'right' }, []);
  const bottom = el('nav', { class: 'bottom', id: 'bottom' }, []);
  const area = { left, right };

  const tabs = {};
  const edges = {};
  for (const side of ['left', 'right']) {
    tabs[side] = el('button', { type: 'button', class: 'foldtab', 'aria-controls': side, on: {
      click: (event) => { event.stopPropagation(); if (!splash) update(toggled(bars, side)); },
      pointerdown: (event) => event.stopPropagation(),          // a click on the tab is not a drag
    } }, []);
    edges[side] = el('div', { class: `edge edge-${side}`, role: 'separator', tabindex: 0, 'aria-orientation': 'vertical',
      'aria-controls': side, 'aria-valuemin': LIMITS[side].min, 'aria-valuemax': LIMITS[side].max, on: {
        pointerdown: (event) => startDrag(side, event),
        keydown: (event) => {
          if (event.target !== edges[side] || splash) return;
          const next = afterKey(bars, side, event.key, frameWidth());
          if (next !== bars) {
            event.preventDefault();
            update(next);
          }
        },
      } }, [tabs[side]]);
  }

  const app = el('div', { class: 'app' }, [left, centre, right, bottom, edges.left, edges.right]);

  /** The frame's width, or undefined while it is not laid out (not yet in the page, or hidden by GD-32). */
  const frameWidth = () => app.clientWidth || undefined;

  /** Draw the bars' state: widths as custom properties, folded bars inert, labels on edges and tabs. */
  function draw() {
    const lang = getLang();
    const shown = shownWidths(bars, frameWidth());          // GD-41: the centre keeps 360 px
    for (const side of ['left', 'right']) {
      const folded = bars[side].folded;
      setVar(app, side === 'left' ? '--lw' : '--rw', `${shown[side]}px`);
      toggleClass(app, side === 'left' ? 'lfold' : 'rfold', folded);
      setInert(area[side], folded || splash);
      const name = side === 'left' ? 'Left' : 'Right';
      // GD-10: the chevron points the way the bar will move
      replace(tabs[side], icon((side === 'left') !== folded ? 'left' : 'right'));
      setAttrs(tabs[side], { 'aria-expanded': String(!folded), 'aria-label': t(lang, folded ? `unfold${name}` : `fold${name}`),
        title: t(lang, folded ? `unfold${name}` : `fold${name}`), disabled: splash });
      setAttrs(edges[side], { 'aria-valuenow': shown[side], 'aria-label': t(lang, `resize${name}`),
        tabindex: splash ? -1 : 0 });
    }
    toggleClass(app, 'onsplash', splash);
    setInert(bottom, splash);
  }

  function update(next) {
    bars = next;
    save('zbm.bars', serializeBars(bars), store);          // GD-34
    draw();
  }

  /** GD-10: the bar follows the pointer; the centre takes the rest. */
  function startDrag(side, event) {
    if (splash || bars[side].folded || event.button !== 0 || event.target !== edges[side]) return;
    event.preventDefault();
    const edge = edges[side];
    try {
      edge.setPointerCapture(event.pointerId);
    } catch {
      // a synthetic event has no pointer to capture
    }
    toggleClass(app, 'resizing', true);
    toggleClass(edge, 'active', true);
    const box = app.getBoundingClientRect();
    const stops = [];
    const end = () => {
      toggleClass(app, 'resizing', false);
      toggleClass(edge, 'active', false);
      stops.forEach((stop) => stop());
      save('zbm.bars', serializeBars(bars), store);
    };
    stops.push(listen(edge, 'pointermove', (ev) => {
      bars = withWidth(bars, side, side === 'left' ? ev.clientX - box.left : box.right - ev.clientX, box.width || undefined);
      draw();
    }));
    stops.push(listen(edge, 'pointerup', end), listen(edge, 'pointercancel', end));
  }

  draw();
  listen(globalThis, 'resize', draw);                     // GD-41: a narrower window narrows the bars, a wider one gives them back
  return {
    app, left, centre, right, bottom,
    /** GD-03: during the splash the bars are greyed and their edges do nothing. */
    setSplash(on) {
      splash = Boolean(on);
      draw();
    },
    /** Redraw the labels in the current language (GD-17). */
    relabel: draw,
    /** Open a folded bar, so what is shown there can be seen (*Ga naar*, GD-20); remembered as a click on its tab. */
    unfold(side) {
      if (bars[side].folded) update(toggled(bars, side));
    },
  };
}
