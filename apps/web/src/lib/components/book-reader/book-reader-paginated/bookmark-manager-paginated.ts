/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  filter,
  firstValueFrom,
  merge,
  skip,
  take,
  takeUntil,
  type BehaviorSubject,
  type Observable
} from 'rxjs';

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
    private setIntendedCharCount: (count: number) => void,
    private destroy$: Observable<void>
  ) {}

  async scrollToBookmark(bookmarkData: BooksDbBookmarkData) {
    const charCount = bookmarkData.exploredCharCount;
    if (charCount === undefined || !Number.isFinite(charCount) || charCount < 0) return;

    const index = this.calculator.getSectionIndexByCharCount(charCount);
    const savedIndex = bookmarkData.sectionId
      ? this.pageManager.getSectionIndexById(bookmarkData.sectionId)
      : -1;

    if (savedIndex >= 0) {
      await this.restoreSection(savedIndex, bookmarkData);
      return;
    }

    // Older bookmarks only have a count and scroll position. At a shared boundary,
    // verify the saved column in the previous section before assuming the next one.
    const previousIndex = this.calculator.getSectionIndexByCharCount(Math.max(0, charCount - 1));
    if (
      !bookmarkData.sectionId &&
      (this.getStoredBookmarkPosition(bookmarkData) ?? 0) > 0 &&
      previousIndex < index
    ) {
      const outcome = await this.restoreSection(previousIndex, bookmarkData, true);
      if (outcome !== 'unmatched') return;
    }

    await this.restoreSection(index, bookmarkData);
  }

  private async restoreSection(
    index: number,
    bookmarkData: BooksDbBookmarkData,
    storedPositionOnly = false
  ) {
    const charCount = bookmarkData.exploredCharCount as number;

    const scroll = (calc: SectionCharacterStatsCalculator) => {
      const scrollPos = this.getBookmarkPosition(bookmarkData, calc, storedPositionOnly);

      if (scrollPos < 0) {
        return 'unmatched' as const;
      }

      this.pageManager.scrollToBookmarkPosition(scrollPos, false);
      this.setIntendedCharCount(charCount);
      return 'restored' as const;
    };

    const currentSectionIndex = this.sectionIndex$.getValue();

    if (currentSectionIndex === index) {
      return scroll(this.calculator);
    }

    const ready = firstValueFrom(
      this.sectionReady$.pipe(
        filter(({ index: readyIndex }) => readyIndex === index),
        take(1),
        takeUntil(
          merge(
            this.destroy$,
            this.sectionIndex$.pipe(
              skip(1),
              filter((activeIndex) => activeIndex !== index)
            )
          )
        )
      ),
      { defaultValue: undefined }
    );
    this.sectionIndex$.next(index);
    const result = await ready;
    if (result && this.sectionIndex$.getValue() === index) {
      return scroll(result.calculator);
    }
    return 'cancelled' as const;
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
      sectionId: this.calculator.containerEl.id || undefined,
      exploredCharCount,
      progress: bookCharCount > 0 ? exploredCharCount / bookCharCount : 0,
      [this.calculator.verticalMode ? 'scrollY' : 'scrollX']: bookmarkPosition,
      lastBookmarkModified: new Date().getTime()
    };
  }

  getBookmarkScrollPosition(bookmarkData: BooksDbBookmarkData) {
    if (bookmarkData.sectionId && bookmarkData.sectionId !== this.calculator.containerEl.id) {
      return -1;
    }
    return this.getBookmarkPosition(bookmarkData, this.calculator);
  }

  private getBookmarkPosition(
    bookmarkData: BooksDbBookmarkData,
    calc: SectionCharacterStatsCalculator,
    storedPositionOnly = false
  ) {
    const charCount = bookmarkData.exploredCharCount;
    const storedPosition = this.getStoredBookmarkPosition(bookmarkData);

    if (
      charCount !== undefined &&
      storedPosition !== undefined &&
      storedPosition >= 0 &&
      storedPosition <= this.pageManager.getLastBookmarkPosition() &&
      calc.getCharCountByBookmarkScrollPos(storedPosition) === charCount
    ) {
      return storedPosition;
    }

    if (storedPositionOnly) return -1;

    // A reflow may invalidate the pixel position, while the section end is stable.
    if (charCount !== undefined && calc.isCurrentSectionEnd(charCount)) {
      return this.pageManager.getLastBookmarkPosition();
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
