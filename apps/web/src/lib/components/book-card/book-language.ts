/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { normalizeLanguageCode } from '../../functions/book-language/language-metadata.ts';

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

/** Group regional variants together without guessing from a title or its script. */
export function getLanguageKey(language?: string): string {
  const code = normalizeLanguageCode(language);
  return code ? new Intl.Locale(code).language : '';
}

export function getLanguageLabel(language?: string): string {
  const code = getLanguageKey(language);
  return code ? languageNames.of(code) || code : 'Unknown';
}

export function compareBookLanguages(a: { language?: string }, b: { language?: string }) {
  const aKey = getLanguageKey(a.language);
  const bKey = getLanguageKey(b.language);
  if (!aKey || !bKey) return Number(!aKey) - Number(!bKey);
  return getLanguageLabel(aKey).localeCompare(getLanguageLabel(bKey), 'en');
}
