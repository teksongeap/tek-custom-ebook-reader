/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getUpNext,
  getCollectionBooks,
  moveCollection,
  moveCollectionToIndex
} from '../../src/lib/components/book-card/library-organization.ts';

const books = [
  { id: 1, title: 'Volume 10', lastBookOpen: 100, isPlaceholder: false, progress: 0.2 },
  { id: 2, title: 'Volume 2', lastBookOpen: 200, isPlaceholder: false, progress: 0.5 },
  { id: 3, title: 'Finished', lastBookOpen: 500, isPlaceholder: false, progress: 1 },
  { id: 4, title: 'Unopened', lastBookOpen: 0, isPlaceholder: false, progress: 0 },
  { id: 5, title: 'External', lastBookOpen: 600, isPlaceholder: true, progress: 0 }
];
const ids = (items: { id: number }[]) => items.map((book) => book.id);

test('Up next only needs an open timestamp and excludes finished or unavailable books', () => {
  assert.deepEqual(ids(getUpNext(books, new Set(['Finished']))), [2, 1]);
  assert.deepEqual(ids(getUpNext([...books].reverse(), new Set(['Finished']))), [2, 1]);
  assert.equal(books[0].id, 1);
});

test('reopening a book moves it first, and clearing completion restores eligibility', () => {
  const reopened = books.map((book) => (book.id === 1 ? { ...book, lastBookOpen: 700 } : book));
  assert.deepEqual(ids(getUpNext(reopened, new Set(['Finished']))), [1, 2]);
  assert.deepEqual(ids(getUpNext(books, new Set())), [3, 2, 1]);
});

test('collections use natural title order by default, independent of the library sort', () => {
  const collection = { id: 'series', name: 'Series', bookIds: [1, 2, 999] };
  assert.deepEqual(ids(getCollectionBooks(books, collection)), [2, 1]);
  assert.deepEqual(ids(getCollectionBooks([...books].reverse(), collection)), [2, 1]);
  assert.deepEqual(collection.bookIds, [1, 2, 999]);
  assert.deepEqual(ids(getCollectionBooks(books, { ...collection, sort: 'title-desc' })), [1, 2]);
});

test('each collection can choose recent, added, or progress order without changing membership', () => {
  const collection = { id: 'all', name: 'All', bookIds: [1, 2, 3, 4] };
  assert.deepEqual(ids(getCollectionBooks(books, { ...collection, sort: 'recent' })), [3, 2, 1, 4]);
  assert.deepEqual(ids(getCollectionBooks(books, { ...collection, sort: 'added' })), [4, 3, 2, 1]);
  assert.deepEqual(
    ids(getCollectionBooks(books, { ...collection, sort: 'progress' })),
    [3, 2, 1, 4]
  );
});

test('moving collections preserves their contents and does not wrap past either edge', () => {
  const collections = ['one', 'two', 'three'].map((id, i) => ({ id, name: id, bookIds: [i + 1] }));
  assert.deepEqual(
    moveCollection(collections, 'two', -1).map((c) => c.id),
    ['two', 'one', 'three']
  );
  const moved = moveCollection(collections, 'two', 1);
  assert.deepEqual(
    moved.map((c) => c.id),
    ['one', 'three', 'two']
  );
  assert.equal(moved[2], collections[1]);
  assert.equal(moveCollection(collections, 'one', -1), collections);
  assert.equal(moveCollection(collections, 'three', 1), collections);
  assert.equal(moveCollection(collections, 'missing', 1), collections);
  assert.deepEqual(
    collections.map((c) => c.id),
    ['one', 'two', 'three']
  );
});

test('Up next stops at five after excluding finished books and sorting by last open', () => {
  const manyBooks = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    title: `Book ${index + 1}`,
    lastBookOpen: index + 1,
    isPlaceholder: false
  }));
  assert.deepEqual(ids(getUpNext(manyBooks, new Set(['Book 12']))), [11, 10, 9, 8, 7]);
  assert.deepEqual(ids(manyBooks), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('dragging can insert a collection at any position without changing its contents', () => {
  const collections = ['one', 'two', 'three', 'four'].map((id, i) => ({
    id,
    name: id,
    bookIds: [i + 1]
  }));
  const moved = moveCollectionToIndex(collections, 'one', 3);
  assert.deepEqual(
    moved.map((c) => c.id),
    ['two', 'three', 'four', 'one']
  );
  assert.equal(moved[3], collections[0]);
  assert.deepEqual(
    moveCollectionToIndex(collections, 'four', 0).map((c) => c.id),
    ['four', 'one', 'two', 'three']
  );
  assert.equal(moveCollectionToIndex(collections, 'one', 0), collections);
  assert.equal(moveCollectionToIndex(collections, 'missing', 1), collections);
  for (const index of [-1, 4, 1.5, NaN])
    assert.equal(moveCollectionToIndex(collections, 'one', index), collections);
  assert.deepEqual(
    collections.map((c) => c.id),
    ['one', 'two', 'three', 'four']
  );
});

test('malformed saved collections cannot break the library or create duplicate shelves', async () => {
  const { parseLibraryCollections } = await import(
    '../../src/lib/components/book-card/library-organization.ts'
  );
  for (const value of ['{', 'null', '{}', 'true'])
    assert.deepEqual(parseLibraryCollections(value), []);
  assert.deepEqual(
    parseLibraryCollections(
      JSON.stringify([
        null,
        {},
        { id: 'bad', name: 'Bad', bookIds: null },
        { id: 'one', name: 'One', bookIds: [1, 1, 2, -1, 0, 1.5, '3', null], sort: 'unsupported' },
        { id: 'one', name: 'Duplicate', bookIds: [] },
        { id: 'two', name: 'Two', bookIds: [3], sort: 'recent' }
      ])
    ),
    [
      { id: 'one', name: 'One', bookIds: [1, 2], sort: undefined },
      { id: 'two', name: 'Two', bookIds: [3], sort: 'recent' }
    ]
  );
});

test('card progress retains zero-position timestamps and normalizes legacy percentages', async () => {
  const { getBookCardProgress } = await import(
    '../../src/lib/components/book-card/library-organization.ts'
  );
  for (const [value, expected] of [
    [0, 0],
    [0.25, 0.25],
    ['25%', 0.25],
    ['0%', 0],
    [' 50% ', 0.5],
    [undefined, 0],
    [NaN, 0],
    [Infinity, 0],
    ['bad', 0],
    [-1, 0],
    [2, 1]
  ] as const) {
    assert.deepEqual(
      getBookCardProgress({ dataId: 7, progress: value, lastBookmarkModified: 123 }),
      {
        progress: expected,
        lastBookmarkModified: 123
      }
    );
  }
});
