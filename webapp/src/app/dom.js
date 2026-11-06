// SPDX-License-Identifier: Apache-2.0
// The element builder: the only module that touches the DOM directly (securityAssessment 7.3).
// Text goes in through textContent, never as HTML; there is no innerHTML anywhere (SR-24).

const ALLOWED_ATTRS = new Set(['class', 'id', 'src', 'alt', 'href', 'lang', 'role', 'tabindex',
  'type', 'title', 'rel', 'aria-label', 'aria-live', 'aria-hidden', 'width', 'height']);

/** Build an element: el('p', { class: 'hint' }, ['text', otherElement]). */
export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (!ALLOWED_ATTRS.has(name)) {
      throw new Error(`dom.el: attribute not allowed: ${name}`);
    }
    node.setAttribute(name, String(value));
  }
  for (const child of children || []) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Replace all children of a node. */
export function replace(node, ...children) {
  node.replaceChildren(...children);
}
