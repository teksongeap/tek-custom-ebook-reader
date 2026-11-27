/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';
import type BooksDb from '../../src/lib/data/database/books-db/versions/books-db.ts';
import type { BooksDbStatistic } from '../../src/lib/data/database/books-db/versions/books-db.ts';
import {
  clearBookCompletion,
  createRestartBookmark
} from '../../src/lib/data/database/books-db/reading-state.ts';
import { mergeStatistics } from '../../src/lib/functions/statistic-util.ts';

function statistic(dateKey: string, title = 'Book'): BooksDbStatistic {
  return {
    title,
    dateKey,
    charactersRead: 1200,
    readingTime: 60,
    minReadingSpeed: 20,
    altMinReadingSpeed: 25,
    lastReadingSpeed: 30,
    maxReadingSpeed: 40,
    lastStatisticModified: 100
  };
}

async function setup(t: TestContext) {
  const name = `reading-state-${crypto.randomUUID()}`;
  const db = await openDB<BooksDb>(name, 1, {
    upgrade(db) {
      const statistics = db.createObjectStore('statistic', { keyPath: ['title', 'dateKey'] });
      statistics.createIndex('completedBook', ['completedBook', 'title']);
      db.createObjectStore('lastModified', { keyPath: ['title', 'dataType'] });
      db.createObjectStore('bookmark', { keyPath: 'dataId' });
      db.createObjectStore('annotation', { keyPath: 'id' });
    }
  });
  t.after(async () => {
    db.close();
    await deleteDB(name);
  });
  const history = statistic('2026-10-01');
  const completed = { ...statistic('2026-11-01'), completedBook: 1, completedData: history };
  const other = { ...statistic('2026-11-01', 'Other book'), completedBook: 1 };
  const bookmark = {
    dataId: 7,
    sectionId: 'last-chapter',
    exploredCharCount: 950,
    progress: 0.95,
    scrollX: 1200,
    lastBookmarkModified: 100
  };
  const annotation = {
    id: 'note',
    dataId: 7,
    selectedText: 'Keep this',
    comment: 'My note'
  } as BooksDb['annotation']['value'];
  await db.put('statistic', history);
  await db.put('statistic', completed);
  await db.put('statistic', other);
  await db.put('bookmark', bookmark);
  await db.put('annotation', annotation);
  return { db, history, completed, other, bookmark, annotation };
}

test('marking unfinished preserves position, annotations, reading totals and other books', async (t) => {
  const { db, history, completed, other, bookmark, annotation } = await setup(t);
  const changed = await clearBookCompletion(db, 'Book', undefined, 200);
  const { completedBook: _completedBook, completedData: _completedData, ...retained } = completed;
  assert.deepEqual(changed, [{ ...retained, lastStatisticModified: 200 }]);
  assert.deepEqual(await db.get('statistic', ['Book', history.dateKey]), history);
  assert.deepEqual(await db.get('statistic', ['Other book', other.dateKey]), other);
  assert.deepEqual(await db.get('bookmark', 7), bookmark);
  assert.deepEqual(await db.get('annotation', 'note'), annotation);
  assert.equal(await db.getFromIndex('statistic', 'completedBook', [1, 'Book']), undefined);
  assert.deepEqual(await db.get('lastModified', ['Book', 'statistic']), {
    title: 'Book',
    dataType: 'statistic',
    lastModifiedValue: 200
  });
  assert.deepEqual(mergeStatistics(changed, [completed]), changed);
  assert.deepEqual(mergeStatistics([completed], changed), changed);
});

test('restart saves the beginning without stale section identity and clears every completion flag', async (t) => {
  const { db, history, annotation } = await setup(t);
  await db.put('statistic', {
    ...statistic('2026-11-02'),
    completedBook: 1,
    completedData: history
  });
  const firstPage = createRestartBookmark(7, 300);
  assert.deepEqual(firstPage, {
    dataId: 7,
    exploredCharCount: 0,
    progress: 0,
    scrollX: 0,
    scrollY: 0,
    lastBookmarkModified: 300
  });
  assert.equal((await clearBookCompletion(db, 'Book', firstPage, 300)).length, 2);
  assert.deepEqual(await db.get('bookmark', 7), firstPage);
  assert.deepEqual(await db.get('annotation', 'note'), annotation);
  assert.deepEqual(await db.get('statistic', ['Book', history.dateKey]), history);
  assert.equal(
    (await db.getAll('statistic')).filter(
      (s) => s.title === 'Book' && (s.completedBook || s.completedData)
    ).length,
    0
  );
});

test('a failed restart rolls back completion and bookmark changes together', async (t) => {
  const { db, completed, bookmark } = await setup(t);
  const invalidBookmark = {
    ...createRestartBookmark(7),
    dataId: undefined
  } as unknown as typeof bookmark;
  await assert.rejects(clearBookCompletion(db, 'Book', invalidBookmark, 400));
  assert.deepEqual(await db.get('statistic', ['Book', completed.dateKey]), completed);
  assert.deepEqual(await db.get('bookmark', 7), bookmark);
  assert.equal(await db.get('lastModified', ['Book', 'statistic']), undefined);
});
