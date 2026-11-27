/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { franc } from 'franc';
import { normalizeLanguageCode } from './language-metadata.ts';

/** Franc reads at most 2,048 characters. Sample throughout the book, not just its front matter. */
export function sampleBookText(text: string): string[] {
  const normalized = text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized) return [];
  const count = Math.min(7, Math.max(1, Math.floor(normalized.length / 1024)));
  const size = Math.min(2048, Math.floor(normalized.length / count));
  return Array.from({ length: count }, (_, index) => {
    const start = count === 1 ? 0 : Math.floor(((normalized.length - size) * index) / (count - 1));
    return normalized.slice(start, start + size);
  });
}

export function detectBookLanguage(samples: string[]): string {
  const votes = new Map<string, number>();
  let totalLetters = 0;
  for (const sample of samples) {
    const letters = sample.match(/\p{L}/gu)?.length || 0;
    if (letters < 80) continue;
    totalLetters += letters;
    const code = normalizeLanguageCode(franc(sample, { minLength: 80 }));
    if (!code) continue;
    const language = new Intl.Locale(code).language;
    votes.set(language, (votes.get(language) || 0) + letters);
  }
  const ranked = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
  // Require a clear majority; a few extra letters must not decide a balanced bilingual book.
  return ranked[0] && ranked[0][1] >= totalLetters * 0.6 ? ranked[0][0] : 'und';
}

export function sampleBookHtml(html: string, document: Document): string[] {
  // Template content is inert: publisher markup must not load images or execute scripts.
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content
    .querySelectorAll(
      'script, style, nav, rt, rp, svg, math, [hidden], [aria-hidden="true"], .ttu-no-text'
    )
    .forEach((element) => element.remove());
  // TextContent joins adjacent paragraphs without spaces; retain those word boundaries.
  template.content
    .querySelectorAll('p, div, section, article, li, h1, h2, h3, h4, br, td')
    .forEach((element) => element.append(' '));
  return sampleBookText(template.content.textContent || '');
}
