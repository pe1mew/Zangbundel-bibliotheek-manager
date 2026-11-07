// SPDX-License-Identifier: Apache-2.0
// The element builder: the only module that touches the DOM directly (securityAssessment 7.3, SR-24,
// SR-32; implementationPlan M4.1). Text goes in through text nodes, never as HTML; there is no HTML
// string anywhere, and the build refuses one (build.py dom_sink). Styles come from app.css classes;
// a dynamic value goes through style.setProperty on a custom property (CSP allows no style attribute).

import { ICONS } from './icons.js';

const SVG = 'http://www.w3.org/2000/svg';
// Attributes that can carry no script. Event handlers come through `on`, never as attributes;
// style, srcdoc and every on* attribute are absent on purpose.
const ALLOWED = new Set(['class', 'id', 'src', 'alt', 'href', 'lang', 'dir', 'role', 'tabindex', 'type', 'title',
  'rel', 'name', 'value', 'for', 'placeholder', 'autocomplete', 'spellcheck', 'inputmode', 'maxlength', 'min', 'max',
  'step', 'rows', 'cols', 'accept', 'download', 'draggable', 'disabled', 'checked', 'selected', 'readonly',
  'multiple', 'hidden', 'open', 'width', 'height', 'scope', 'colspan', 'inert']);
// A link may point to this site, to https:, mailto: or to a blob: download (SR-32, SR-36); never javascript:.
const SAFE_URL = /^(?:https:\/\/|mailto:|blob:|#|\.{0,2}\/|[a-z0-9._-]+(?:[/?#]|$))/i;

function allowed(name) {
  return ALLOWED.has(name) || /^aria-[a-z]+$/.test(name) || /^data-[a-z][a-z0-9-]*$/.test(name);
}

/** Set one attribute after the checks above; a boolean true sets it empty, false or null leaves it out. */
function setAttr(node, name, value) {
  if (!allowed(name)) throw new Error(`dom: attribute not allowed: ${name}`);
  if (value === false || value === null || value === undefined) return;
  const v = value === true ? '' : String(value);
  if ((name === 'href' || name === 'src') && !SAFE_URL.test(v.trim())) throw new Error(`dom: unsafe ${name}: ${v.slice(0, 40)}`);
  node.setAttribute(name, v);
}

function fill(node, attrs, children) {
  for (const [name, value] of Object.entries(attrs || {})) {
    if (name === 'on') {
      for (const [type, fn] of Object.entries(value || {})) {
        if (typeof fn !== 'function') throw new TypeError(`dom: handler for ${type} is not a function`);
        node.addEventListener(type, fn);
      }
    } else {
      setAttr(node, name, value);
    }
  }
  for (const child of children || []) {
    if (child === null || child === undefined || child === false) continue;   // conditional children
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return node;
}

/**
 * Build an element: el('button', { class: 'btn', on: { click: go } }, [icon('add'), 'Nieuw']).
 * Strings and numbers become text nodes; null, undefined and false children are skipped.
 */
export function el(tag, attrs, children) {
  if (!/^[a-z][a-z0-9]*$/.test(tag) || tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
    throw new Error(`dom: element not allowed: ${tag}`);
  }
  return fill(document.createElement(tag), attrs, children);
}

/** A Material icon (icons.js) as inline SVG, hidden from screen readers: the button's text names it. */
export function icon(name, cls) {
  const d = ICONS[name];
  if (!d) throw new Error(`dom: no icon ${name}`);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (cls) svg.setAttribute('class', cls);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/** Replace all children of a node. */
export function replace(node, ...children) {
  node.replaceChildren(...children.filter((c) => c !== null && c !== undefined && c !== false));
}

/** Update attributes of an existing element, with the same checks as el(); null or false removes one. */
export function setAttrs(node, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) {
      if (!allowed(name)) throw new Error(`dom: attribute not allowed: ${name}`);
      node.removeAttribute(name);
    } else {
      setAttr(node, name, value);
    }
  }
}

/** Add or remove a class. */
export function toggleClass(node, cls, on) {
  node.classList.toggle(cls, Boolean(on));
}

/** GD-10: a folded bar is inert, so its content cannot be reached by keyboard or pointer. */
export function setInert(node, on) {
  node.inert = Boolean(on);
}

/** Listen for an event; returns the function that stops listening (drag handlers of GD-10). */
export function listen(node, type, fn, options) {
  node.addEventListener(type, fn, options);
  return () => node.removeEventListener(type, fn, options);
}

/** A CSS custom property on an element (GD-10 bar widths): the only way a computed style is set. */
export function setVar(node, name, value) {
  if (!/^--[a-z][a-z0-9-]*$/.test(name)) throw new Error(`dom: not a custom property: ${name}`);
  node.style.setProperty(name, String(value));
}
