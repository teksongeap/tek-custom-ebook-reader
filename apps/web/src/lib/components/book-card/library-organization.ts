/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { compareBookLanguages } from './book-language.ts';
import type { BooksDbBookmarkData } from '../../data/database/books-db/versions/books-db';

export const collectionBookSortOptions = [
  { value: 'title', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'recent', label: 'Recently opened' },
  { value: 'added', label: 'Recently added' },
  { value: 'progress', label: 'Progress' },
  { value: 'language', label: 'Language' }
] as const;

export type CollectionBookSort = (typeof collectionBookSortOptions)[number]['value'];

export interface LibraryCollection {
  id: string;
  name: string;
  bookIds: number[];
  sort?: CollectionBookSort;
}

/** Ignore malformed saved entries without preventing the library from opening. */
export function parseLibraryCollections(value: string): LibraryCollection[] {
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries)) return [];
    const ids = new Set<string>();
    return entries.flatMap((entry) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.id !== 'string' ||
        !entry.id ||
        ids.has(entry.id) ||
        typeof entry.name !== 'string' ||
        !Array.isArray(entry.bookIds)
      )
        return [];
      ids.add(entry.id);
      return [
        {
          id: entry.id,
          name: entry.name,
          bookIds: [
            ...new Set<number>(
              entry.bookIds.filter(
                (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
              )
            )
          ],
          sort: collectionBookSortOptions.find((option) => option.value === entry.sort)?.value
        }
      ];
    });
  } catch {
    return [];
  }
}

export function getBookCardProgress(bookmark: BooksDbBookmarkData | undefined) {
  const value = bookmark?.progress;
  const progress =
    typeof value === 'string'
      ? value.trim().endsWith('%')
        ? Number(value.trim().slice(0, -1)) / 100
        : Number(value)
      : value;
  return {
    progress:
      typeof progress === 'number' && Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0,
    lastBookmarkModified: bookmark?.lastBookmarkModified || 0
  };
}

type LibraryBook = {
  id: number;
  title: string;
  isPlaceholder: boolean;
  lastBookOpen: number;
  language?: string;
};

export function getUpNext<T extends LibraryBook>(books: T[], completedTitles: Set<string>): T[] {
  return books
    .filter(
      (book) => !book.isPlaceholder && book.lastBookOpen > 0 && !completedTitles.has(book.title)
    )
    .sort((a, b) => b.lastBookOpen - a.lastBookOpen || compareTitles(a, b))
    .slice(0, 5);
}

function compareTitles(a: { title: string }, b: { title: string }) {
  return (
    a.title.localeCompare(b.title, 'ja-JP', { numeric: true }) || a.title.localeCompare(b.title)
  );
}

export function getCollectionBooks<T extends LibraryBook & { progress: number }>(
  books: T[],
  collection: LibraryCollection
): T[] {
  const ids = new Set(collection.bookIds);
  return books
    .filter((book) => ids.has(book.id))
    .sort((a, b) => {
      switch (collection.sort) {
        case 'language':
          return compareBookLanguages(a, b) || compareTitles(a, b) || a.id - b.id;
        case 'title-desc':
          return compareTitles(b, a) || a.id - b.id;
        case 'recent':
          return b.lastBookOpen - a.lastBookOpen || compareTitles(a, b) || a.id - b.id;
        case 'added':
          return b.id - a.id;
        case 'progress':
          return b.progress - a.progress || compareTitles(a, b) || a.id - b.id;
        default:
          return compareTitles(a, b) || a.id - b.id;
      }
    });
}

export function moveCollection(collections: LibraryCollection[], id: string, direction: -1 | 1) {
  const index = collections.findIndex((collection) => collection.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= collections.length) return collections;
  const reordered = [...collections];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}

export function moveCollectionToIndex(
  collections: LibraryCollection[],
  id: string,
  target: number
) {
  const index = collections.findIndex((collection) => collection.id === id);
  if (
    index < 0 ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= collections.length ||
    target === index
  )
    return collections;
  const reordered = [...collections];
  const [collection] = reordered.splice(index, 1);
  reordered.splice(target, 0, collection);
  return reordered;
}
