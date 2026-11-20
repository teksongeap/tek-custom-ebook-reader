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
    getSectionIndexByCharCount: () => 2,
    getScrollPosByCharCount: () => 240
  } as unknown as Args[0];
  const scrolls: number[] = [];
  const pageManager = {
    scrollToBookmarkPosition: (position: number) => scrolls.push(position)
  } as unknown as Args[1];
  const ready = new Subject<{ index: number; calculator: Args[0] }>();
  const index = new BehaviorSubject(currentIndex);
  const destroy = new Subject<void>();
  const manager = new BookmarkManagerPaginated(
    calculator,
    pageManager,
    ready,
    index,
    () => {},
    destroy
  );
  const bookmark = { exploredCharCount: 120 } as Parameters<typeof manager.scrollToBookmark>[0];
  return { manager, bookmark, calculator, scrolls, ready, index, destroy };
}

test('restores immediately when the saved section is already ready', async () => {
  const state = setup(2);
  await state.manager.scrollToBookmark(state.bookmark);
  assert.deepEqual(state.scrolls, [240]);
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
