/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import type BooksDb from '../../data/database/books-db/versions/books-db';
import type { BooksDbBookData } from '../../data/database/books-db/versions/books-db';
import { needsBookLanguageResolution } from './language-metadata.ts';
import { yieldToMainThread } from '../yield-to-main-thread.ts';

export async function backfillBookLanguages(
  db: IDBPDatabase<BooksDb>,
  books: BooksDbBookData[],
  resolve: (book: BooksDbBookData) => Promise<BooksDbBookData>,
  onUpdated: (book: BooksDbBookData) => void
) {
  for (const book of books) {
    if (!needsBookLanguageResolution(book)) continue;
    await yieldToMainThread();
    const resolved = await resolve(book);
    // Detection happens outside the transaction. Re-read before writing to retain any
    // progress updates and avoid reviving a deleted or replaced book.
    const tx = db.transaction('data', 'readwrite');
    const current = await tx.store.get(book.id);
    let updated: BooksDbBookData | undefined;
    if (
      current &&
      current.elementHtml === book.elementHtml &&
      current.language === book.language &&
      current.declaredLanguage === book.declaredLanguage &&
      current.languageSource === book.languageSource &&
      current.languageDetectionVersion === book.languageDetectionVersion
    ) {
      updated = {
        ...current,
        language: resolved.language,
        declaredLanguage: resolved.declaredLanguage,
        languageSource: resolved.languageSource,
        languageDetectionVersion: resolved.languageDetectionVersion
      };
      await tx.store.put(updated);
    }
    await tx.done;
    if (updated) onUpdated(updated);
  }
}
