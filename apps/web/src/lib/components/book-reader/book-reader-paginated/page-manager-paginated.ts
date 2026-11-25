/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Observable, take, type Subject, type BehaviorSubject, type Subscription } from 'rxjs';
import {
  sectionProgress$,
  sectionList$,
  type SectionWithProgress
} from '$lib/components/book-reader/book-toc/book-toc';
import { PaginationTransitionMode } from '$lib/data/pagination-transition-mode';
import { setReaderAnimatedScrollPosition } from '$lib/functions/reader-viewport';
import type { PageManager } from '../types';

export class PageManagerPaginated implements PageManager {
  private animationFrame: number | undefined;

  private animationTargetPos: number | undefined;

  private animationVelocity = 0;

  private animationScrollSize: number | undefined;

  private animationIsUser = false;

  private sectionTransitionIndex: number | undefined;

  private sectionTransitionSubscription: Subscription | undefined;

  private trailingBlankSpace = 0;

  private sectionData: Map<string, SectionWithProgress> = new Map();

  constructor(
    private contentEl: HTMLElement,
    private scrollEl: HTMLElement,
    private trailingBlankEl: HTMLElement,
    private sectionIds: string[],
    private sectionIndex$: BehaviorSubject<number>,
    private virtualScrollPos$: BehaviorSubject<number>,
    private width: number,
    private height: number,
    private pageGap: number,
    private columnCount: number,
    private verticalMode: boolean,
    private transitionMode: PaginationTransitionMode,
    private pageChange$: Subject<boolean>,
    private sectionRenderComplete$: Subject<number>,
    private pageBleed = 0
  ) {
    this.clearTrailingBlankSpace();
    this.clearContentTransform();

    sectionList$.pipe(take(1)).subscribe((entries) => {
      if (!entries.length) {
        return;
      }

      entries.forEach((section) => {
        this.sectionData.set(section.reference, { ...section, progress: 0 });
      });

      sectionProgress$.next(this.sectionData);
    });
  }

  nextPage() {
    this.flipPage(1);
  }

  prevPage() {
    this.flipPage(-1);
  }

  updateSectionDataByOffset(offset = 0) {
    const viewportSize = this.verticalMode ? this.height : this.width;
    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const scrollSize = this.getMeasuredScrollSize(scrollSizeProp);
    const currentPercentage = this.getProgressPercentage(
      this.virtualScrollPos$.getValue(),
      scrollSize
    );

    if (offset) {
      const nextPageOffset = this.virtualScrollPos$.getValue() + viewportSize + this.pageGap;
      const diffPercentage =
        this.getProgressPercentage(nextPageOffset, scrollSize) - currentPercentage;

      this.updateSectionData(
        this.sectionIds[this.sectionIndex$.getValue()],
        currentPercentage + diffPercentage * offset
      );
    } else {
      this.updateSectionData(this.sectionIds[this.sectionIndex$.getValue()], currentPercentage);
    }
  }

  flipPage(multiplier: 1 | -1) {
    this.flipBy(this.getSpreadPitch(), multiplier);
  }

  flipColumn(multiplier: 1 | -1) {
    this.flipBy(this.getColumnPitch(), multiplier, this.getSpreadPitch());
  }

  scrollTo(scrollPos: number, isUser: boolean) {
    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const viewportSize = this.verticalMode ? this.height : this.width;
    this.moveToPos(
      this.snapToPageStart(scrollPos, viewportSize),
      this.getMeasuredScrollSize(scrollSizeProp),
      viewportSize,
      isUser
    );
  }

  scrollToBookmarkPosition(scrollPos: number, isUser: boolean) {
    this.jumpTo(this.snapToColumnStart(scrollPos), isUser);
  }

  scrollToColumn(scrollPos: number, isUser: boolean) {
    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const viewportSize = this.verticalMode ? this.height : this.width;
    this.moveToPos(
      this.snapToColumnStart(scrollPos),
      this.getMeasuredScrollSize(scrollSizeProp),
      viewportSize,
      isUser
    );
  }

  getCurrentBookmarkPosition() {
    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const currentPosition = this.getCurrentVisualPos(
      this.getMeasuredScrollSize(scrollSizeProp),
      this.getColumnPitch()
    );

    return this.snapToColumnStart(currentPosition);
  }

  beginSectionTransition(index: number) {
    this.cancelAnimation();
    this.clearSectionTransitionSubscription();
    this.clearTrailingBlankSpace();
    this.clearContentTransform();
    this.sectionTransitionIndex = index;
  }

  completeSectionTransition(index: number) {
    if (this.sectionTransitionIndex === index) {
      this.sectionTransitionIndex = undefined;
    }
  }

  isSectionTransitionPending() {
    return this.sectionTransitionIndex !== undefined;
  }

  destroy() {
    this.cancelAnimation();
    this.clearSectionTransitionSubscription();
    this.clearTrailingBlankSpace();
    this.clearContentTransform();
    this.sectionTransitionIndex = undefined;
  }

  jumpTo(scrollPos: number, isUser: boolean, scrollSize?: number) {
    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const viewportSize = this.verticalMode ? this.height : this.width;
    this.jumpToPos(
      scrollPos,
      scrollSize ?? this.getMeasuredScrollSize(scrollSizeProp),
      viewportSize,
      isUser
    );
  }

  private flipBy(offset: number, multiplier: 1 | -1, boundaryOffset = offset) {
    if (this.sectionTransitionIndex !== undefined) {
      return;
    }

    const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
    const viewportSize = this.verticalMode ? this.height : this.width;
    const isUser = true;

    const minValue = 0;
    const maxValue = this.getMeasuredScrollSize(scrollSizeProp);
    const currentValue = this.getCurrentVisualPos(maxValue, offset);
    const newValue = currentValue + offset * multiplier;
    const newValueCeil = Math.ceil(newValue);

    if (newValueCeil < minValue) {
      if (currentValue !== minValue) {
        this.moveToPos(minValue, maxValue, viewportSize, isUser);
        return;
      }

      this.prevSection(boundaryOffset, scrollSizeProp, viewportSize, isUser);
      return;
    }
    if (newValueCeil >= maxValue) {
      if (multiplier < 0) {
        this.moveToPos(this.getLastScrollPos(maxValue, offset), maxValue, viewportSize, isUser);
        return;
      }

      this.nextSection(isUser);
      return;
    }

    this.moveToPos(newValue, maxValue, viewportSize, isUser);
  }

  private prevSection(
    offset: number,
    scrollSizeProp: 'scrollWidth' | 'scrollHeight',
    viewportSize: number,
    isUser: boolean
  ) {
    const nextPage = this.sectionIndex$.getValue() - 1;
    if (nextPage < 0) return false;

    this.beginSectionTransition(nextPage);
    this.sectionTransitionSubscription = this.updateSectionIndex(nextPage).subscribe({
      next: () => {
        const scrollSize = this.getMeasuredScrollSize(scrollSizeProp);
        // Boundaries must use the newly rendered section's real scroll size.
        this.jumpToPos(this.getLastScrollPos(scrollSize, offset), scrollSize, viewportSize, isUser);
        this.completeSectionTransition(nextPage);
      },
      error: () => {
        this.completeSectionTransition(nextPage);
        this.clearSectionTransitionSubscription();
      },
      complete: () => {
        this.clearSectionTransitionSubscription();
      }
    });
    return true;
  }

  private nextSection(isUser: boolean) {
    const nextPage = this.sectionIndex$.getValue() + 1;
    if (nextPage >= this.sectionIds.length) return false;

    this.beginSectionTransition(nextPage);
    this.sectionTransitionSubscription = this.updateSectionIndex(nextPage).subscribe({
      next: () => {
        const scrollSizeProp = this.verticalMode ? 'scrollHeight' : 'scrollWidth';
        const viewportSize = this.verticalMode ? this.height : this.width;

        // Boundaries must use the newly rendered section's real scroll size.
        this.jumpToPos(0, this.getMeasuredScrollSize(scrollSizeProp), viewportSize, isUser);
        this.updateSectionData(this.sectionIds[nextPage - 1], 100, false);
        this.updateSectionData(this.sectionIds[nextPage], 0);
        this.completeSectionTransition(nextPage);
      },
      error: () => {
        this.completeSectionTransition(nextPage);
        this.clearSectionTransitionSubscription();
      },
      complete: () => {
        this.clearSectionTransitionSubscription();
      }
    });
    return true;
  }

  private moveToPos(pos: number, scrollSize: number, viewportSize: number, isUser: boolean) {
    const targetPos = Math.max(0, pos);

    if (this.transitionMode === PaginationTransitionMode.Glide) {
      this.animateToPos(targetPos, scrollSize, viewportSize, isUser);
      return;
    }

    this.jumpToPos(targetPos, scrollSize, viewportSize, isUser);
  }

  private jumpToPos(pos: number, scrollSize: number, viewportSize: number, isUser: boolean) {
    this.cancelAnimation();
    this.updateSectionData(
      this.sectionIds[this.sectionIndex$.getValue()],
      this.getProgressPercentage(pos, scrollSize)
    );
    this.setVisualPos(pos, scrollSize, viewportSize);
    this.pageChange$.next(isUser);
  }

  private animateToPos(pos: number, scrollSize: number, viewportSize: number, isUser: boolean) {
    const start = this.virtualScrollPos$.getValue();
    const distance = Math.abs(pos - start);

    if (
      distance < 1 ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      this.jumpToPos(pos, scrollSize, viewportSize, isUser);
      return;
    }

    this.animationTargetPos = pos;
    this.animationIsUser = isUser;
    this.animationScrollSize = scrollSize;
    // Reserve the final extent once, before any animation frames run.
    this.setTrailingBlankSpace(
      Math.max(0, Math.ceil(Math.max(start, pos) + viewportSize - scrollSize)),
      scrollSize
    );

    // Retarget the running spring without losing its position or velocity.
    if (this.animationFrame !== undefined) return;

    const nativeStart = this.scrollEl[this.verticalMode ? 'scrollTop' : 'scrollLeft'];
    let previousTimestamp = performance.now();
    this.contentEl.style.willChange = 'transform';

    const animate = (timestamp: number) => {
      const elapsed = Math.max(0, (timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      const target = this.animationTargetPos!;
      const displacement = this.virtualScrollPos$.getValue() - target;
      const stiffness = 18;
      const decay = Math.exp(-stiffness * elapsed);
      const coefficient = this.animationVelocity + stiffness * displacement;
      // Exact critically damped motion stays stable even when a frame is missed.
      const nextPos = Math.max(0, target + (displacement + coefficient * elapsed) * decay);
      this.animationVelocity = (this.animationVelocity - stiffness * coefficient * elapsed) * decay;

      if (Math.abs(nextPos - target) > 0.25 || Math.abs(this.animationVelocity) > 8) {
        const offset = nativeStart - nextPos;
        this.contentEl.style.transform = this.verticalMode
          ? `translate3d(0, ${offset}px, 0)`
          : `translate3d(${offset}px, 0, 0)`;
        this.virtualScrollPos$.next(nextPos);
        setReaderAnimatedScrollPosition(this.scrollEl, nextPos);
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

      this.animationFrame = undefined;
      this.animationTargetPos = undefined;
      this.animationVelocity = 0;
      this.animationScrollSize = undefined;
      // Commit native scrolling once, removing the temporary layer in the same frame.
      this.setVisualPos(target, scrollSize, viewportSize);
      this.updateSectionData(
        this.sectionIds[this.sectionIndex$.getValue()],
        this.getProgressPercentage(target, scrollSize)
      );
      this.pageChange$.next(this.animationIsUser);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  private setVisualPos(pos: number, scrollSize: number, viewportSize: number) {
    this.setTrailingBlankSpace(Math.max(0, Math.ceil(pos + viewportSize - scrollSize)), scrollSize);
    this.scrollToPos(pos);
  }

  private scrollToPos(pos: number) {
    this.clearContentTransform();
    this.virtualScrollPos$.next(pos);
    this.scrollEl.scrollTo({ [this.verticalMode ? 'top' : 'left']: pos });
  }

  private snapToPageStart(pos: number, viewportSize: number) {
    return this.snapToPitchStart(pos, viewportSize + this.pageGap);
  }

  private snapToColumnStart(pos: number) {
    return this.snapToPitchStart(pos, this.getColumnPitch());
  }

  private snapToPitchStart(pos: number, pitch: number) {
    if (pitch <= 0) {
      return Math.max(0, pos);
    }

    return Math.max(0, Math.floor((pos + 0.5) / pitch) * pitch);
  }

  private getSpreadPitch() {
    return (this.verticalMode ? this.height : this.width) + this.pageGap;
  }

  private getColumnPitch() {
    if (this.verticalMode) {
      return this.getSpreadPitch();
    }

    return this.getSpreadPitch() / Math.max(1, this.columnCount);
  }

  private getProgressPercentage(pos: number, scrollSize: number) {
    if (!scrollSize) {
      return 0;
    }

    return (pos / scrollSize) * 100;
  }

  private getMeasuredScrollSize(scrollSizeProp: 'scrollWidth' | 'scrollHeight') {
    if (this.animationScrollSize !== undefined) return this.animationScrollSize;
    if (this.pageBleed) {
      // The surrounding window is wider than the logical page. Measure only text.
      return this.contentEl[scrollSizeProp];
    }

    return Math.max(0, this.scrollEl[scrollSizeProp] - this.trailingBlankSpace);
  }

  private getCurrentVisualPos(scrollSize: number, offset: number) {
    const currentPos = this.animationTargetPos ?? this.virtualScrollPos$.getValue();

    if (currentPos > scrollSize) {
      return this.getLastScrollPos(scrollSize, offset);
    }

    return Math.max(0, currentPos);
  }

  private getLastScrollPos(scrollSize: number, offset: number) {
    if (offset <= 0) {
      return 0;
    }

    let scrollValue = offset * (Math.ceil(scrollSize / offset) - 1);
    if (Math.ceil(scrollValue) >= scrollSize) {
      scrollValue -= offset;
    }

    return Math.max(0, scrollValue);
  }

  private cancelAnimation() {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.animationFrame = undefined;
    this.animationTargetPos = undefined;
    this.animationVelocity = 0;
    this.animationScrollSize = undefined;
  }

  private clearSectionTransitionSubscription() {
    this.sectionTransitionSubscription?.unsubscribe();
    this.sectionTransitionSubscription = undefined;
  }

  private clearContentTransform() {
    if (this.contentEl.style.transform) this.contentEl.style.removeProperty('transform');
    if (this.contentEl.style.willChange) this.contentEl.style.removeProperty('will-change');
    setReaderAnimatedScrollPosition(this.scrollEl, undefined);
  }

  private setTrailingBlankSpace(size: number, scrollSize: number) {
    const nextSize = Math.max(0, size);
    this.trailingBlankSpace = nextSize;
    const extent = Math.ceil(scrollSize + nextSize + this.pageBleed * 2);

    if (nextSize || (this.pageBleed && scrollSize)) {
      this.trailingBlankEl.style.width = this.verticalMode ? '1px' : `${extent}px`;
      this.trailingBlankEl.style.height = this.verticalMode ? `${extent}px` : '1px';
      return;
    }

    this.trailingBlankEl.style.width = '';
    this.trailingBlankEl.style.height = '';
  }

  private clearTrailingBlankSpace() {
    this.setTrailingBlankSpace(0, 0);
  }

  /**
   * Updates the section index if necessary
   * @param index New section index
   * @returns An observable that emits when the section index equals to the new index
   */
  private updateSectionIndex(index: number) {
    return new Observable<void>((subscriber) => {
      if (this.sectionIndex$.getValue() === index) {
        subscriber.next();
        subscriber.complete();
        return undefined;
      }

      const subscription = this.sectionRenderComplete$.subscribe((newIndex) => {
        if (newIndex === index) {
          subscriber.next();
          subscriber.complete();
          subscription.unsubscribe();
        }
      });
      this.sectionIndex$.next(index);
      return subscription;
    });
  }

  private updateSectionData(ref: string, progress: number, emit = true) {
    if (!ref || !this.sectionData.has(ref)) return;

    const sections = [...this.sectionData.values()];
    let currentRefSeen = false;

    sections.forEach((section) => {
      const entry = this.sectionData.get(section.reference) as SectionWithProgress;
      const isCurrentRef = section.reference === ref;

      if (isCurrentRef) {
        entry.progress = progress;
      } else if (currentRefSeen) {
        entry.progress = 0;
      } else {
        entry.progress = 100;
      }

      if (!currentRefSeen && isCurrentRef) {
        currentRefSeen = true;
      }
      this.sectionData.set(section.reference, entry);
    });

    if (emit) {
      sectionProgress$.next(this.sectionData);
    }
  }
}
