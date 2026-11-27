/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  languageDetectionVersion,
  needsBookLanguageResolution,
  normalizeLanguageCode,
  type BookLanguageMetadata
} from './language-metadata.ts';
import { yieldToMainThread } from '../yield-to-main-thread.ts';

export async function resolveBookLanguage<T extends BookLanguageMetadata & { elementHtml: string }>(
  book: T,
  document: Document
): Promise<T & BookLanguageMetadata> {
  if (!needsBookLanguageResolution(book)) return book;
  // Retain publisher/legacy metadata separately. It never decides the primary language.
  const declaredLanguage =
    normalizeLanguageCode(book.declaredLanguage || book.language) || undefined;
  await yieldToMainThread();
  const { detectBookLanguage, sampleBookHtml } = await import('./detect-book-language.ts');
  const detected = detectBookLanguage(sampleBookHtml(book.elementHtml, document));
  return {
    ...book,
    language: detected,
    declaredLanguage,
    languageSource: detected === 'und' ? 'undetermined' : 'detected',
    languageDetectionVersion
  };
}
