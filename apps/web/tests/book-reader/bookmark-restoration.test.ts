/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { BehaviorSubject, Subject } from 'rxjs';
import { BookmarkManagerPaginated } from '../../src/lib/components/book-reader/book-reader-paginated/bookmark-manager-paginated.ts';

function setup(currentIndex = 0) {
  type Args = ConstructorParameters<typeof BookmarkManagerPaginated>;
  const calculator = {
    containerEl: { id: `section-${currentIndex}` },
    charCount: 300,
    verticalMode: false,
    calcExploredCharCount: () => 120,
    getSectionIndexByCharCount: () => 2,
    getScrollPosByCharCount: () => 240,
    getCharCountByBookmarkScrollPos: () => 0,
    isCurrentSectionEnd: () => false
  } as unknown as Args[0];
  const scrolls: number[] = [];
  const pageManager = {
    scrollToBookmarkPosition: (position: number) => scrolls.push(position),
    getSectionIndexById: (id: string) => {
      const match = /^section-([0-2])$/.exec(id);
      return match ? Number(match[1]) : -1;
    },
    getCurrentBookmarkPosition: () => 4200,
    getLastBookmarkPosition: () => 5040
  } as unknown as Args[1];
  const ready = new Subject<{ index: number; calculator: Args[0] }>();
  const index = new BehaviorSubject(currentIndex);
  const destroy = new Subject<void>();
  const intendedCounts: number[] = [];
  const manager = new BookmarkManagerPaginated(
    calculator,
    pageManager,
    ready,
    index,
    (count) => intendedCounts.push(count),
    destroy
  );
  const bookmark = { exploredCharCount: 120 } as Parameters<typeof manager.scrollToBookmark>[0];
  return { manager, bookmark, calculator, scrolls, ready, index, destroy, intendedCounts };
}

test('restores immediately when the saved section is already ready', async () => {
  const state = setup(2);
  await state.manager.scrollToBookmark(state.bookmark);
  assert.deepEqual(state.scrolls, [240]);
});

test('legacy bookmarks at the book end restore to its final column', async (t) => {
  const state = setup(2);
  t.mock.method(state.calculator, 'isCurrentSectionEnd', () => true);
  await state.manager.scrollToBookmark(state.bookmark);
  assert.deepEqual(state.scrolls, [5040]);
});

test('invalid character counts never start a section restoration', async () => {
  for (const exploredCharCount of [NaN, Infinity, -Infinity, -1]) {
    const state = setup();
    await state.manager.scrollToBookmark({ ...state.bookmark, exploredCharCount });
    assert.equal(state.index.getValue(), 0);
    assert.deepEqual(state.scrolls, []);
  }
});

test('empty paginated books save finite progress', () => {
  const state = setup();
  Object.assign(state.calculator, { charCount: 0, calcExploredCharCount: () => 0 });
  assert.equal(state.manager.formatBookmarkData(7).progress, 0);
});

test('restoration completes only after the saved section is ready and positioned', async () => {
  const state = setup();
  let complete = false;
  const restoration = state.manager.scrollToBookmark(state.bookmark).then(() => {
    complete = true;
  });
  assert.equal(state.index.getValue(), 2);
  state.ready.next({ index: 1, calculator: state.calculator });
  await Promise.resolve();
  assert.equal(complete, false);
  assert.deepEqual(state.scrolls, []);
  state.ready.next({ index: 2, calculator: state.calculator });
  await restoration;
  assert.equal(complete, true);
  assert.deepEqual(state.scrolls, [240]);
});

test('closing the reader cancels a pending restoration', async () => {
  const state = setup();
  const restoration = state.manager.scrollToBookmark(state.bookmark);
  state.destroy.next();
  await restoration;
  state.ready.next({ index: 2, calculator: state.calculator });
  assert.deepEqual(state.scrolls, []);
});

test('a stale saved-section event does not reposition a different active section', async () => {
  const state = setup();
  const restoration = state.manager.scrollToBookmark(state.bookmark);
  state.index.next(3);
  state.ready.next({ index: 2, calculator: state.calculator });
  await restoration;
  assert.deepEqual(state.scrolls, []);
});

test('changing the target cancels restoration without waiting for the abandoned section', async () => {
  const state = setup();
  const restoration = state.manager.scrollToBookmark(state.bookmark);
  state.index.next(3);
  const outcome = await Promise.race([
    restoration.then(() => 'cancelled'),
    new Promise((resolve) => setTimeout(() => resolve('still waiting'), 100))
  ]);
  assert.equal(outcome, 'cancelled');
  assert.deepEqual(state.scrolls, []);
  assert.equal(state.ready.observed, false);
});

test('saving the end of a section retains its identity without subtracting reading progress', () => {
  const state = setup(1);
  const saved = state.manager.formatBookmarkData(7);
  assert.equal(saved.sectionId, 'section-1');
  assert.equal(saved.exploredCharCount, 120);
  assert.equal(saved.scrollX, 4200);
  assert.equal(saved.progress, 0.4);
});

test('a boundary bookmark loads its saved section and restores the exact ending column', async (t) => {
  const state = setup();
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 120);
  const bookmark = { ...state.bookmark, sectionId: 'section-1', scrollX: 4200 };
  const restore = state.manager.scrollToBookmark(bookmark);
  assert.equal(state.index.getValue(), 1);
  assert.deepEqual(state.scrolls, []);
  state.calculator.containerEl.id = 'section-1';
  state.ready.next({ index: 1, calculator: state.calculator });
  await restore;
  assert.deepEqual(state.scrolls, [4200]);
  assert.deepEqual(state.intendedCounts, [120]);
});

test('a section-end bookmark survives reflow without entering the following section', async (t) => {
  const state = setup(1);
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 119);
  t.mock.method(state.calculator, 'isCurrentSectionEnd', () => true);
  const bookmark = { ...state.bookmark, sectionId: 'section-1', scrollX: 4200 };
  await state.manager.scrollToBookmark(bookmark);
  assert.equal(state.index.getValue(), 1);
  assert.deepEqual(state.scrolls, [5040]);
  assert.equal(state.manager.getBookmarkScrollPosition(bookmark), 5040);
});

test('a bookmark at the start of the next section stays there despite the shared count', async (t) => {
  const state = setup(2);
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 120);
  await state.manager.scrollToBookmark({ ...state.bookmark, sectionId: 'section-2', scrollX: 0 });
  assert.equal(state.index.getValue(), 2);
  assert.deepEqual(state.scrolls, [0]);
  assert.equal(
    state.manager.getBookmarkScrollPosition({ ...state.bookmark, sectionId: 'section-1' }),
    -1
  );
});

test('a section-end bookmark cannot restore beyond the last column after shrinking the font', async (t) => {
  const state = setup(1);
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 120);
  t.mock.method(state.calculator, 'isCurrentSectionEnd', () => true);
  await state.manager.scrollToBookmark({
    ...state.bookmark,
    sectionId: 'section-1',
    scrollX: 9999
  });
  assert.deepEqual(state.scrolls, [5040]);
});

test('old boundary bookmarks are recovered when their saved column matches the previous section', async (t) => {
  const state = setup();
  t.mock.method(state.calculator, 'getSectionIndexByCharCount', (count: number) =>
    count < 120 ? 1 : 2
  );
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 120);
  const restore = state.manager.scrollToBookmark({ ...state.bookmark, scrollX: 4200 });
  assert.equal(state.index.getValue(), 1);
  state.ready.next({ index: 1, calculator: state.calculator });
  await restore;
  assert.deepEqual(state.scrolls, [4200]);
});

test('old bookmarks fall back to their character location when the previous section does not match', async (t) => {
  const state = setup();
  t.mock.method(state.calculator, 'getSectionIndexByCharCount', (count: number) =>
    count < 120 ? 1 : 2
  );
  t.mock.method(state.calculator, 'getCharCountByBookmarkScrollPos', () => 50);
  const restore = state.manager.scrollToBookmark({ ...state.bookmark, scrollX: 4200 });
  state.ready.next({ index: 1, calculator: state.calculator });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(state.index.getValue(), 2);
  state.ready.next({ index: 2, calculator: state.calculator });
  await restore;
  assert.deepEqual(state.scrolls, [240]);
});

test('cancelling an old-bookmark recovery does not trigger a second navigation', async (t) => {
  const state = setup();
  t.mock.method(state.calculator, 'getSectionIndexByCharCount', (count: number) =>
    count < 120 ? 1 : 2
  );
  const restore = state.manager.scrollToBookmark({ ...state.bookmark, scrollX: 4200 });
  assert.equal(state.index.getValue(), 1);
  state.index.next(0);
  await restore;
  assert.equal(state.index.getValue(), 0);
  assert.deepEqual(state.scrolls, []);
});

test('a bookmark at the end of the book does not request a nonexistent section', async (t) => {
  const state = setup(2);
  t.mock.method(state.calculator, 'getSectionIndexByCharCount', () => 3);
  t.mock.method(state.calculator, 'isCurrentSectionEnd', () => true);
  await state.manager.scrollToBookmark({ ...state.bookmark, sectionId: 'section-2' });
  assert.equal(state.index.getValue(), 2);
  assert.deepEqual(state.scrolls, [5040]);
});
