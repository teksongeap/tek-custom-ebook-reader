/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import createDOMPurify, { type DOMPurify } from 'dompurify';

const purifiers = new WeakMap<Window, DOMPurify>();

// Sanitize on import and on load so books already in local/remote storage are covered.
export function sanitizeBookHtml(html: string, document: Document): string {
  const window = document.defaultView;
  if (!window) throw new Error('Book HTML requires a browser document');

  let purifier = purifiers.get(window);
  if (!purifier) {
    purifier = createDOMPurify(window);
    purifier.addHook('uponSanitizeAttribute', (node, data) => {
      if (!['src', 'href', 'xlink:href'].includes(data.attrName)) return;
      if (node.nodeName.toLowerCase() === 'a') {
        // A blob may contain HTML, so only images may use reader-created blob URLs.
        try {
          const protocol = new URL(data.attrValue, 'https://reader.invalid/').protocol;
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)) data.keepAttr = false;
        } catch (_) {
          data.keepAttr = false;
        }
      } else if (!/^(?:blob:|data:image\/|#)/i.test(data.attrValue.trim())) {
        data.keepAttr = false;
      }
    });
    purifiers.set(window, purifier);
  }

  return purifier.sanitize(html, {
    USE_PROFILES: { html: true, svg: true },
    // Publisher styles are processed separately and scoped to the reader.
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'template'],
    FORBID_ATTR: ['srcset', 'autofocus', 'contenteditable'],
    ADD_ATTR: ['epub:type'],
    // Blob images are created by the reader; executable protocols remain excluded.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  });
}
