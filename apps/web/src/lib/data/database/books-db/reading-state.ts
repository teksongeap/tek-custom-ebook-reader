/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import type BooksDb from './versions/books-db';
import type { BooksDbBookmarkData, BooksDbStatistic } from './versions/books-db';

export function createRestartBookmark(dataId: number, modified = Date.now()): BooksDbBookmarkData {
  return {
    dataId,
    exploredCharCount: 0,
    progress: 0,
    scrollX: 0,
    scrollY: 0,
    lastBookmarkModified: modified
  };
}

export async function clearBookCompletion(
  db: IDBPDatabase<BooksDb>,
  title: string,
  restartBookmark?: BooksDbBookmarkData,
  modified = Date.now()
): Promise<BooksDbStatistic[]> {
  const tx = db.transaction(['statistic', 'lastModified', 'bookmark'], 'readwrite');
  try {
    const store = tx.objectStore('statistic');
    const entries = await store.getAll(IDBKeyRange.bound([title], [title, []]));
    const changed: BooksDbStatistic[] = [];
    for (const entry of entries) {
      if (!entry.completedBook && !entry.completedData) continue;
      const updated = { ...entry, lastStatisticModified: modified };
      delete updated.completedBook;
      delete updated.completedData;
      await store.put(updated);
      changed.push(updated);
    }
    if (changed.length) {
      await tx
        .objectStore('lastModified')
        .put({ title, dataType: 'statistic', lastModifiedValue: modified });
    }
    if (restartBookmark) await tx.objectStore('bookmark').put(restartBookmark);
    await tx.done;
    return changed;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* The failed request may already have aborted it. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
