/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { BookmarkManagerContinuous } from '../../src/lib/components/book-reader/book-reader-continuous/bookmark-manager-continuous.ts';
import { createRestartBookmark } from '../../src/lib/data/database/books-db/reading-state.ts';

for (const verticalMode of [false, true]) {
  test(`scrolling reader restores a zero bookmark (${verticalMode ? 'vertical' : 'horizontal'} text)`, () => {
    type Args = ConstructorParameters<typeof BookmarkManagerContinuous>;
    const scrolls: ScrollToOptions[] = [];
    const calculator = {
      verticalMode,
      direction: verticalMode ? 'rtl' : 'ltr',
      getCharCountByScrollPos: (position: number) => (position === 0 ? 0 : 100),
      getScrollPosByCharCount: () => {
        assert.fail('zero saved scroll position should be used');
      }
    } as unknown as Args[0];
    const manager = new BookmarkManagerContinuous(
      calculator,
      {
        scrollTo: (options: ScrollToOptions) => scrolls.push(options)
      } as unknown as Window,
      16
    );
    const bookmark = createRestartBookmark(7);
    manager.scrollToBookmark(bookmark);
    assert.deepEqual(scrolls, [
      verticalMode ? { left: 0, behavior: 'instant' } : { top: 0, behavior: 'instant' }
    ]);
    assert.deepEqual(
      manager.getBookmarkBarPosition(bookmark),
      verticalMode ? { right: '16px' } : { top: '16px' }
    );
  });
}

test('invalid character counts never scroll the continuous reader', () => {
  type Args = ConstructorParameters<typeof BookmarkManagerContinuous>;
  const manager = new BookmarkManagerContinuous(
    {} as Args[0],
    { scrollTo: () => assert.fail('invalid bookmark scrolled') } as unknown as Window,
    16
  );
  for (const exploredCharCount of [NaN, Infinity, -Infinity, -1]) {
    manager.scrollToBookmark({ ...createRestartBookmark(7), exploredCharCount });
  }
});

test('empty continuous books save finite progress', () => {
  type Args = ConstructorParameters<typeof BookmarkManagerContinuous>;
  const manager = new BookmarkManagerContinuous(
    {
      charCount: 0,
      calcExploredCharCount: () => 0,
      verticalMode: false
    } as unknown as Args[0],
    { scrollY: 0 } as Window,
    16
  );
  assert.equal(manager.formatBookmarkData(7).progress, 0);
});
