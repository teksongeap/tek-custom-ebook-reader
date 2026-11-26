/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export const collectionBookSortOptions = [
  { value: 'title', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'recent', label: 'Recently opened' },
  { value: 'added', label: 'Recently added' },
  { value: 'progress', label: 'Progress' }
] as const;

export type CollectionBookSort = (typeof collectionBookSortOptions)[number]['value'];

export interface LibraryCollection {
  id: string;
  name: string;
  bookIds: number[];
  sort?: CollectionBookSort;
}

type LibraryBook = {
  id: number;
  title: string;
  isPlaceholder: boolean;
  lastBookOpen: number;
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
