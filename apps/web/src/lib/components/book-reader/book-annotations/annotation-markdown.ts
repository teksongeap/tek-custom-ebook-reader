/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Marked } from 'marked';

const linkProtocols = new Set(['http:', 'https:', 'mailto:']);
const imageProtocols = new Set(['http:', 'https:']);

// All HTML comes from Markdown tokens. User-authored HTML is displayed as text,
// and URL-bearing tokens must pass the protocol allowlist before becoming markup.
const annotationMarkdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const safeHref = getSafeUrl(href, linkProtocols);

      if (!safeHref) {
        return label;
      }

      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a data-annotation-panel-control href="${escapeHtml(safeHref)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
    image({ href, title, text }) {
      const safeSrc = getSafeUrl(href, imageProtocols);

      if (!safeSrc) {
        return escapeHtml(text);
      }

      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(text)}"${titleAttribute} loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    }
  }
});

export function renderAnnotationMarkdown(text: string) {
  return annotationMarkdown.parse(text, { async: false });
}

function getSafeUrl(value: string, protocols: ReadonlySet<string>) {
  try {
    const url = new URL(value);
    return protocols.has(url.protocol) ? url.href : undefined;
  } catch (_) {
    return undefined;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
