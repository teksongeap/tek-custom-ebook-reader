/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export interface BookLanguageMetadata {
  language?: string;
  declaredLanguage?: string;
  languageSource?: 'metadata' | 'detected' | 'undetermined';
  languageDetectionVersion?: number;
}

export const languageDetectionVersion = 1;
const names = new Intl.DisplayNames(['en'], { type: 'language' });

export function normalizeLanguageCode(value?: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const locale = new Intl.Locale(value.trim().replace(/_/g, '-'));
    return locale.language === 'und' || names.of(locale.language) === locale.language
      ? ''
      : locale.toString();
  } catch {
    return '';
  }
}

export function needsBookLanguageResolution(book: BookLanguageMetadata & { elementHtml: string }) {
  if (!book.elementHtml) return false;
  return (
    book.languageSource === 'metadata' || book.languageDetectionVersion !== languageDetectionVersion
  );
}
