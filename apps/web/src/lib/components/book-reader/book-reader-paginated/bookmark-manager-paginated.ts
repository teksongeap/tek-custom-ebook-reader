/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { filter, take, type BehaviorSubject, type Observable } from 'rxjs';

import type { BookmarkManager } from '$lib/components/book-reader/types';
import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import type { PageManagerPaginated } from './page-manager-paginated';
import type { SectionCharacterStatsCalculator } from './section-character-stats-calculator';

export class BookmarkManagerPaginated implements BookmarkManager {
  constructor(
    private calculator: SectionCharacterStatsCalculator,
    private pageManager: PageManagerPaginated,
    private sectionReady$: Observable<{
      index: number;
      calculator: SectionCharacterStatsCalculator;
    }>,
    private sectionIndex$: BehaviorSubject<number>,
    private setIntendedCharCount: (count: number) => void
  ) {}

  scrollToBookmark(bookmarkData: BooksDbBookmarkData) {
    const charCount = bookmarkData.exploredCharCount;
    if (charCount === undefined || charCount < 0) return;

    const index = this.calculator.getSectionIndexByCharCount(charCount);

    const scroll = (calc: SectionCharacterStatsCalculator) => {
      const scrollPos = this.getBookmarkPosition(bookmarkData, calc);

      if (scrollPos < 0) {
        return;
      }

      this.pageManager.scrollToBookmarkPosition(scrollPos, false);
      this.setIntendedCharCount(charCount);
    };

    const currentSectionIndex = this.sectionIndex$.getValue();

    if (currentSectionIndex === index) {
      scroll(this.calculator);
      return;
    }

    this.sectionReady$
      .pipe(
        filter(({ index: readyIndex }) => readyIndex === index),
        take(1)
      )
      .subscribe(({ calculator: updatedCalc }) => {
        scroll(updatedCalc);
      });
    this.sectionIndex$.next(index);
  }

  formatBookmarkData(bookId: number): BooksDbBookmarkData {
    return this.formatBookmarkDataByRange(bookId, undefined);
  }

  formatBookmarkDataByRange(
    bookId: number,
    customReadingPointRange: Range | undefined
  ): BooksDbBookmarkData {
    const exploredCharCount = this.calculator.calcExploredCharCount(customReadingPointRange);
    const bookCharCount = this.calculator.charCount;
    const bookmarkPosition = this.getPositionForBookmarkData(
      exploredCharCount,
      customReadingPointRange
    );

    return {
      dataId: bookId,
      exploredCharCount,
      progress: exploredCharCount / bookCharCount,
      [this.calculator.verticalMode ? 'scrollY' : 'scrollX']: bookmarkPosition,
      lastBookmarkModified: new Date().getTime()
    };
  }

  private getBookmarkPosition(
    bookmarkData: BooksDbBookmarkData,
    calc: SectionCharacterStatsCalculator
  ) {
    const charCount = bookmarkData.exploredCharCount;
    const storedPosition = this.getStoredBookmarkPosition(bookmarkData);

    if (
      charCount !== undefined &&
      storedPosition !== undefined &&
      calc.getCharCountByBookmarkScrollPos(storedPosition) === charCount
    ) {
      return storedPosition;
    }

    return charCount === undefined ? -1 : calc.getScrollPosByCharCount(charCount);
  }

  private getPositionForBookmarkData(
    exploredCharCount: number,
    customReadingPointRange: Range | undefined
  ) {
    if (!customReadingPointRange) {
      return this.pageManager.getCurrentBookmarkPosition();
    }

    const scrollPos = this.calculator.getScrollPosByCharCount(exploredCharCount);

    return scrollPos < 0 ? this.pageManager.getCurrentBookmarkPosition() : scrollPos;
  }

  private getStoredBookmarkPosition(bookmarkData: BooksDbBookmarkData) {
    const bookmarkPosition = bookmarkData[this.calculator.verticalMode ? 'scrollY' : 'scrollX'];

    return typeof bookmarkPosition === 'number' && Number.isFinite(bookmarkPosition)
      ? bookmarkPosition
      : undefined;
  }
}
