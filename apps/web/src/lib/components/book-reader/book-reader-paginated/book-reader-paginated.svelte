<script lang="ts">
  import { browser } from '$app/environment';
  import { nextChapter$ } from '$lib/components/book-reader/book-toc/book-toc';
  import HtmlRenderer from '$lib/components/html-renderer.svelte';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { SECTION_CHANGE } from '$lib/data/events';
  import { isStoredFont } from '$lib/data/fonts';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { PaginationTransitionMode } from '$lib/data/pagination-transition-mode';
  import { logger } from '$lib/data/logger';
  import { getCharacterCount } from '$lib/functions/get-character-count';
  import {
    disableWheelNavigation$,
    firstDimensionMargin$,
    selectionToBookmarkEnabled$,
    skipKeyDownListener$,
    swipeThreshold$,
    userFonts$
  } from '$lib/data/store';
  import { clearRange, createRange, pulseElement } from '$lib/functions/range-util';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { getExternalTargetElement, isMobile$ } from '$lib/functions/utils';
  import { faBookmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import {
    BehaviorSubject,
    combineLatest,
    debounceTime,
    distinctUntilChanged,
    filter,
    fromEvent,
    map,
    skip,
    Subject,
    switchMap,
    take,
    takeUntil,
    throttleTime
  } from 'rxjs';
  import Fa from 'svelte-fa';
  import { swipe } from 'svelte-gestures';
  import type { BookmarkManager, PageManager, SectionNavigator } from '../types';
  import { BookmarkManagerPaginated } from './bookmark-manager-paginated';
  import { PageManagerPaginated } from './page-manager-paginated';
  import { SectionCharacterStatsCalculator } from './section-character-stats-calculator';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { getParagraphNodes } from '../get-paragraph-nodes';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

  export let fontFeatureSettings: string;

  export let verticalTextOrientation: string;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let fontColor: string;

  export let backgroundColor: string;

  export let selectionFontColor = '';

  export let selectionBackgroundColor = '';

  export let hintFuriganaFontColor: string;

  export let hintFuriganaShadowColor: string;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontSize: number;

  export let lineHeight: number;

  export let textIndentation: number;

  export let textMarginValue: number;

  export let hideSpoilerImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let loadingState: boolean;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let pageManager: PageManager | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let sectionNavigator: SectionNavigator | undefined;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let isBookmarkScreen = false;

  export let avoidPageBreak = true;

  export let pageColumns: number;

  export let paginationTransitionMode: PaginationTransitionMode;

  export let firstDimensionMargin: number;

  export let autoBookmark = false;

  export let autoBookmarkTime: number;

  export let customReadingPointRange: Range | undefined;

  export let showCustomReadingPoint: boolean;

  const dispatch = createEventDispatcher<{
    bookmark: void;
    contentChange: HTMLElement;
    trackerPause: void;
  }>();

  let scrollEl: HTMLElement | undefined;

  let contentEl: HTMLElement | undefined;

  let tailSpacerEl: HTMLElement | undefined;

  let calculator: SectionCharacterStatsCalculator | undefined;

  let calculatorSectionIndex = -1;

  type ReaderSection = {
    id: string;
    html: string;
    characterCount: number;
  };

  let sections: ReaderSection[] = [];

  let concretePageManager: PageManagerPaginated | undefined;

  let concreteBookmarkManager: BookmarkManagerPaginated | undefined;

  let scrollWhenReady: boolean;

  let allowDisplay = false;

  let displayedHtml = '';

  let displayedSectionIndex = -1;

  let displayedSectionRenderToken = 0;

  let skipFirstHtmlLoad = true;

  let previousIntendedCount = 0;

  let useExploredCharCount = false;

  let isResizing = false;

  let bookmarkTopAdjustment: string | undefined;

  let bookmarkLeftAdjustment: string | undefined;

  let bookmarkRightAdjustment: string | undefined;

  let fontLoadingAdded = false;

  let fontLoadTimer: ReturnType<typeof setTimeout> | undefined;

  let fontLoadingDoneHandler: (() => void) | undefined;

  let currentSectionId = '';

  let swipeStartedWithTouch = false;

  let sectionJumpToken = 0;

  let sectionJumpPending = false;

  let wheelNavigationLocked = false;

  let wheelNavigationUnlockTimer: ReturnType<typeof setTimeout> | undefined;

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const sectionIndex$ = new BehaviorSubject<number>(-1);

  const pageChange$ = new Subject<boolean>();

  const virtualScrollPos$ = new BehaviorSubject(0);

  const sectionRenderComplete$ = new Subject<number>();

  const sectionReady$ = new Subject<SectionCharacterStatsCalculator>();

  const sectionReadyWithIndex$ = new Subject<{
    index: number;
    calculator: SectionCharacterStatsCalculator;
  }>();

  const currentSection$ = sectionIndex$.pipe(
    map((index) => ({
      index,
      html: sections[index]?.html || ''
    }))
  );

  const cssClassOverflowHidden = 'overflow-hidden';

  const gap = 40;

  const destroy$ = new Subject<void>();

  $: bookmarkData.then((data) => {
    useExploredCharCount = false;
    updateBookmarkScreen(data);
  });

  $: if (width) width$.next(width);

  $: if (height) height$.next(height);

  $: columnCount = verticalMode ? 1 : pageColumns || Math.ceil(width / 1000);

  $: {
    if (htmlContent) {
      scrollWhenReady = true;
    }
  }

  $: {
    if (browser) {
      sections = createReaderSections(htmlContent);
      sectionIndex$.next(0);
    }
  }

  $: {
    if (contentEl && scrollEl && tailSpacerEl && sections) {
      setPageManager(
        new PageManagerPaginated(
          contentEl,
          scrollEl,
          tailSpacerEl,
          sections.map((section) => section.id),
          sectionIndex$,
          virtualScrollPos$,
          width,
          height,
          gap,
          columnCount,
          verticalMode,
          paginationTransitionMode,
          pageChange$,
          sectionRenderComplete$
        )
      );
    }
  }

  $: {
    if (calculator && width && height && !loadingState) {
      const c = calculator;
      const sectionIndex = calculatorSectionIndex;

      requestAnimationFrame(() => {
        if (c !== calculator || sectionIndex !== calculatorSectionIndex) {
          return;
        }

        onContentDisplayChange(c, sectionIndex);
      });
    }
  }

  $: {
    if (calculator && !loadingState) {
      const sectionIndex = displayedSectionIndex;
      const section = sections[sectionIndex];

      if (section) {
        currentSectionId = section.id;
      }
    }
  }

  $: {
    if (calculator && concretePageManager) {
      concreteBookmarkManager = new BookmarkManagerPaginated(
        calculator,
        concretePageManager,
        sectionReadyWithIndex$,
        sectionIndex$,
        (c) => (previousIntendedCount = c),
        destroy$
      );
      bookmarkManager = concreteBookmarkManager;
    }
  }

  $: if (browser) {
    // because Yomitan popup creates overflow on vertical-rl
    document.body.classList.add(cssClassOverflowHidden);
  }

  $: updateAfterCustomReadingPointUpdate(customReadingPointRange);

  /** Experimental Code - May be removed any time without warning */
  onMount(() => {
    sectionNavigator = {
      jumpToSectionTarget
    };

    document.addEventListener('ttu-action', handleAction, false);
  });

  async function handleAction({ detail }: any) {
    if (!detail.type || !calculator || !concretePageManager) {
      return;
    }

    if (detail.type === 'cue') {
      const targetSection = getTargetSection(detail.selector);

      if (targetSection === -1) {
        return;
      }

      const currentSection = sectionIndex$.getValue();
      let activeCalculator: SectionCharacterStatsCalculator | undefined = calculator;

      if (currentSection !== targetSection) {
        activeCalculator = await jumpToSectionStart(targetSection, false);
      }

      if (!activeCalculator) {
        return;
      }

      const scrollPos = getTargetScrollPos(activeCalculator, detail.selector);

      if (scrollPos < 0) {
        return;
      }

      concretePageManager.scrollTo(scrollPos, true);

      if (currentSection !== targetSection) {
        document.dispatchEvent(new CustomEvent(SECTION_CHANGE));
      }
    } else if (detail.type === 'pauseTracker') {
      const targetSection = getTargetSection(detail.selector);

      if (targetSection === -1) {
        return;
      }

      if (targetSection !== sectionIndex$.getValue()) {
        dispatch('trackerPause');
        return;
      }

      const scrollPos = getTargetScrollPos(calculator, detail.selector);

      if (scrollPos < 0) {
        return;
      }

      const currentScrollPos = calculator.getScrollPosByCharCount(
        calculator.calcExploredCharCount(customReadingPointRange)
      );

      if (scrollPos !== currentScrollPos) {
        dispatch('trackerPause');
      }
    }
  }

  function getTargetSection(selector: string) {
    let targetSection = -1;

    for (let index = 0, { length } = sections; index < length; index += 1) {
      if (sectionContainsSelector(sections[index], selector)) {
        targetSection = index;
        break;
      }
    }

    return targetSection;
  }

  function getTargetScrollPos(
    calculatorInstance: SectionCharacterStatsCalculator,
    selector: string
  ) {
    const targetElement = getExternalTargetElement(document, selector);
    const nodeRange = document.createRange();

    if (!targetElement) {
      return -1;
    }

    nodeRange.setStart(targetElement, 0);
    nodeRange.setEnd(targetElement, targetElement.childNodes.length);

    return calculatorInstance.getScrollPosByCharCount(
      calculatorInstance.calcExploredCharCount(nodeRange)
    );
  }

  function createReaderSections(bookHtmlContent: string): ReaderSection[] {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = bookHtmlContent;

    const readerSections = Array.from(tempContainer.children).map((section) => ({
      id: section.id,
      html: section.innerHTML,
      characterCount: getSectionCharacterCount(section)
    }));

    tempContainer.textContent = '';

    return readerSections;
  }

  function getSectionCharacterCount(section: Element) {
    return getParagraphNodes(section).reduce(
      (characterCount, node) => characterCount + getCharacterCount(node),
      0
    );
  }

  function sectionContainsSelector(section: ReaderSection, selector: string) {
    const tempContainer = document.createElement('div');
    tempContainer.id = section.id;
    tempContainer.innerHTML = section.html;

    const hasMatch = !!getExternalTargetElement(tempContainer, selector);
    tempContainer.textContent = '';

    return hasMatch;
  }
  /** Experimental Code - May be removed or changed any time without warning */

  onDestroy(() => {
    document.removeEventListener('ttu-action', handleAction, false);
    sectionNavigator = undefined;
    clearFontLoadingListener();
    clearWheelNavigationLock();

    document.body.classList.remove(cssClassOverflowHidden);

    calculator?.destroy();
    concretePageManager?.destroy();
    pageManager = undefined;

    destroy$.next();
    destroy$.complete();
  });

  combineLatest([width$, height$])
    .pipe(
      skip(1),
      switchMap(() => sectionReady$.pipe(take(1))),
      takeUntil(destroy$)
    )
    .subscribe(() => {
      if (!calculator || !concretePageManager) return;

      concretePageManager.scrollTo(0, false);
      calculator.updateParagraphPos();

      const scrollPos = calculator.getScrollPosByCharCount(previousIntendedCount);

      if (scrollPos < 0) return;

      concretePageManager.scrollTo(scrollPos, false);
      isResizing = false;
    });

  pageChange$.pipe(takeUntil(destroy$)).subscribe((isUser) => {
    if (!calculator) return;

    if (!isResizing) {
      showCustomReadingPoint = false;

      pulseElement(customReadingPointRange?.endContainer?.parentElement, 'remove', 1);

      customReadingPointRange = undefined;
    }

    exploredCharCount = calculator.calcExploredCharCount(customReadingPointRange);

    if (isUser) {
      previousIntendedCount = exploredCharCount;

      if ($selectionToBookmarkEnabled$) {
        clearRange(window);
      }
    }

    bookmarkData.then((data) => {
      useExploredCharCount = isUser || !!customReadingPointRange;
      updateBookmarkScreen(data);
    });
  });

  if (autoBookmark) {
    pageChange$
      .pipe(debounceTime(autoBookmarkTime * 1000), takeUntil(destroy$))
      .subscribe((isUser) => {
        if (isUser) {
          dispatch('bookmark');
        }
      });
  }

  currentSection$
    .pipe(
      distinctUntilChanged(
        (previous, current) => previous.index === current.index && previous.html === current.html
      ),
      takeUntil(destroy$)
    )
    .subscribe(() => {
      allowDisplay = false;
    });

  currentSection$.pipe(takeUntil(destroy$)).subscribe(({ index, html }) => {
    const renderToken = ++displayedSectionRenderToken;

    const nestAnimationFrame = (fn: () => void, count: number) => {
      if (count === 0) {
        fn();
        return;
      }
      requestAnimationFrame(() => nestAnimationFrame(fn, count - 1));
    };

    // 2x for loading screen to render
    nestAnimationFrame(() => {
      if (renderToken !== displayedSectionRenderToken || sectionIndex$.getValue() !== index) {
        return;
      }

      displayedSectionIndex = index;
      displayedHtml = html;
    }, 2);
  });

  iffBrowser(() => fromEvent<WheelEvent>(document.body, 'wheel', { passive: true }))
    .pipe(
      filter(
        () =>
          !sectionJumpPending &&
          !wheelNavigationLocked &&
          !$disableWheelNavigation$ &&
          !$skipKeyDownListener$
      ),
      throttleTime(50),
      takeUntil(destroy$)
    )
    .subscribe((ev) => {
      let multiplier = (ev.deltaX < 0 ? -1 : 1) * (verticalMode ? -1 : 1);
      if (!ev.deltaX) {
        multiplier = ev.deltaY < 0 ? -1 : 1;
      }

      if (paginationTransitionMode === PaginationTransitionMode.Glide) {
        concretePageManager?.flipColumn(multiplier as -1 | 1);
      } else {
        concretePageManager?.flipPage(multiplier as -1 | 1);
      }

      if (concretePageManager?.isSectionTransitionPending()) {
        lockWheelNavigation();
      }
    });

  function updateAfterCustomReadingPointUpdate(updatedCustomReadingPosition: Range | undefined) {
    if (!calculator) {
      return;
    }

    exploredCharCount = calculator.calcExploredCharCount(updatedCustomReadingPosition);
    previousIntendedCount = exploredCharCount;

    updateSectionData(updatedCustomReadingPosition);
  }

  function updateSectionData(updatedCustomReadingRange: Range | undefined) {
    if (!concretePageManager || !calculator) {
      return;
    }

    concretePageManager.updateSectionDataByOffset(
      calculator.getOffsetToRange(updatedCustomReadingRange, columnCount)
    );
  }

  function waitForSectionReady(sectionIndex: number) {
    return new Promise<SectionCharacterStatsCalculator | undefined>((resolve) => {
      let resolved = false;

      sectionReadyWithIndex$
        .pipe(
          filter(({ index }) => index === sectionIndex),
          take(1),
          takeUntil(destroy$)
        )
        .subscribe({
          next: ({ calculator: readyCalculator }) => {
            resolved = true;
            resolve(readyCalculator);
          },
          complete: () => {
            if (!resolved) {
              resolve(undefined);
            }
          }
        });
    });
  }

  function setPageManager(nextPageManager: PageManagerPaginated) {
    sectionJumpToken += 1;
    sectionJumpPending = false;
    concretePageManager?.destroy();
    concretePageManager = nextPageManager;
    pageManager = nextPageManager;
  }

  function lockWheelNavigation() {
    wheelNavigationLocked = true;

    if (wheelNavigationUnlockTimer) {
      clearTimeout(wheelNavigationUnlockTimer);
    }

    wheelNavigationUnlockTimer = setTimeout(() => {
      wheelNavigationLocked = false;
      wheelNavigationUnlockTimer = undefined;
    }, 700);
  }

  function clearWheelNavigationLock() {
    if (wheelNavigationUnlockTimer) {
      clearTimeout(wheelNavigationUnlockTimer);
      wheelNavigationUnlockTimer = undefined;
    }

    wheelNavigationLocked = false;
  }

  async function jumpToSectionStart(sectionIndex: number, isUser: boolean) {
    const pageManagerInstance = concretePageManager;

    if (!pageManagerInstance || sectionIndex < 0 || sectionIndex >= sections.length) {
      return undefined;
    }

    const jumpToken = ++sectionJumpToken;
    sectionJumpPending = true;

    try {
      pageManagerInstance.beginSectionTransition(sectionIndex);

      if (
        sectionIndex$.getValue() !== sectionIndex ||
        displayedSectionIndex !== sectionIndex ||
        calculatorSectionIndex !== sectionIndex
      ) {
        const sectionReadyPromise = waitForSectionReady(sectionIndex);

        sectionIndex$.next(sectionIndex);

        const updatedCalculator = await sectionReadyPromise;

        if (
          !updatedCalculator ||
          jumpToken !== sectionJumpToken ||
          sectionIndex$.getValue() !== sectionIndex
        ) {
          return undefined;
        }

        pageManagerInstance.jumpTo(0, isUser);
        updatedCalculator.updateParagraphPos();
        return updatedCalculator;
      }

      pageManagerInstance.jumpTo(0, isUser);
      calculator?.updateParagraphPos();
      return calculator;
    } finally {
      if (jumpToken === sectionJumpToken) {
        pageManagerInstance.completeSectionTransition(sectionIndex);
        sectionJumpPending = false;
      }
    }
  }

  async function jumpToSectionTarget(targetId: string, isUser = true) {
    const nextSectionIndex = sections.findIndex(
      (section) => section.id === targetId || sectionContainsSelector(section, `[id="${targetId}"]`)
    );

    if (nextSectionIndex < 0) {
      return false;
    }

    return !!(await jumpToSectionStart(nextSectionIndex, isUser));
  }

  function onHtmlLoad() {
    if (skipFirstHtmlLoad) {
      skipFirstHtmlLoad = false;
      return;
    }
    if (!scrollEl || displayedSectionIndex < 0) return;

    const loadedSectionIndex = displayedSectionIndex;
    const nextCalculator = new SectionCharacterStatsCalculator(
      scrollEl,
      sections.map((section) => section.characterCount),
      virtualScrollPos$,
      () => width,
      () => height,
      () => gap,
      verticalMode,
      scrollEl,
      document
    );
    calculator?.destroy();
    calculator = nextCalculator;
    calculatorSectionIndex = loadedSectionIndex;
    exploredCharCount = 0;
    previousIntendedCount = 0;
    bookCharCount = nextCalculator.charCount;

    let fontLoaded = false;

    try {
      fontLoaded = document.fonts.check(`${fontSize}px ${fontFamilyGroupOne || 'Noto Serif JP'}`);
    } catch (error: any) {
      logger.error(`Error checking Font Load: ${error.message}`);
      fontLoaded = true;
    }

    if (fontLoaded || fontLoadingAdded) {
      triggerContentChange(nextCalculator, loadedSectionIndex);
    } else if (!fontLoadingAdded) {
      fontLoadingAdded = true;

      const timeout = isStoredFont(fontFamilyGroupOne, $userFonts$) ? 30000 : 10000;
      fontLoadTimer = setTimeout(() => {
        clearFontLoadingListener();
        logger.error(`Error loading primary Font: ${fontFamilyGroupOne}`);
        triggerContentChange(nextCalculator, loadedSectionIndex);
      }, timeout);

      fontLoadingDoneHandler = () => {
        clearFontLoadingListener();
        triggerContentChange(nextCalculator, loadedSectionIndex);
      };

      document.fonts.addEventListener('loadingdone', fontLoadingDoneHandler);
    }
  }

  function clearFontLoadingListener() {
    if (fontLoadTimer) {
      clearTimeout(fontLoadTimer);
      fontLoadTimer = undefined;
    }

    if (fontLoadingDoneHandler) {
      document.fonts.removeEventListener('loadingdone', fontLoadingDoneHandler);
      fontLoadingDoneHandler = undefined;
    }
  }

  function triggerContentChange(
    calculatorInstance = calculator,
    sectionIndex = calculatorSectionIndex
  ) {
    if (
      !calculatorInstance ||
      !scrollEl ||
      sectionIndex < 0 ||
      calculatorInstance !== calculator ||
      sectionIndex !== calculatorSectionIndex
    )
      return;

    calculatorInstance.updateCurrentSection(sectionIndex);
    dispatch('contentChange', scrollEl);
  }

  function onContentDisplayChange(
    _calculator: SectionCharacterStatsCalculator,
    sectionIndex: number
  ) {
    if (
      sectionIndex < 0 ||
      _calculator !== calculator ||
      sectionIndex !== calculatorSectionIndex ||
      displayedSectionIndex !== sectionIndex
    ) {
      return;
    }

    _calculator.updateParagraphPos();
    exploredCharCount = _calculator.calcExploredCharCount(customReadingPointRange);
    sectionReady$.next(_calculator);
    sectionReadyWithIndex$.next({
      index: sectionIndex,
      calculator: _calculator
    });
    sectionRenderComplete$.next(sectionIndex);

    if (scrollWhenReady) {
      scrollWhenReady = false;
      bookmarkData.then((data) => {
        if (!data || !bookmarkManager) return;
        exploredCharCount = data.exploredCharCount || 0;
        bookmarkManager.scrollToBookmark(data);
      });
    } else {
      bookmarkData.then(updateBookmarkScreen);
    }
    allowDisplay = true;
  }

  function updateBookmarkScreen(data: BooksDbBookmarkData | undefined) {
    const bookmarkCharCount = data?.exploredCharCount;
    if (!calculator || !bookmarkCharCount) return;

    const result = calculator.checkBookmarkOnScreen(bookmarkCharCount);

    if (scrollEl && result.isBookmarkScreen) {
      const dimentionAdjustment = Number(
        getComputedStyle(scrollEl)[verticalMode ? 'marginTop' : 'marginRight'].replace(/px$/, '')
      );

      if (!result.bookmarkPos) {
        setDefaultBookmarkPositions(dimentionAdjustment);
      } else if (verticalMode) {
        bookmarkTopAdjustment = dimentionAdjustment ? `${dimentionAdjustment}px` : '0.5rem';
        bookmarkLeftAdjustment = `${result.bookmarkPos.left}px`;
        bookmarkRightAdjustment = undefined;
      } else {
        bookmarkTopAdjustment = `${result.bookmarkPos.top}px`;
        bookmarkRightAdjustment = undefined;
        bookmarkLeftAdjustment =
          result.bookmarkPos.left > 0
            ? `calc(${result.bookmarkPos.left}px - ${$isMobile$ ? '15' : '20'}px)`
            : `calc(${Math.max($isMobile$ ? 15 : 20, dimentionAdjustment)}px)`;
      }
    } else {
      setDefaultBookmarkPositions(0);
    }

    if (result.isBookmarkScreen && data.exploredCharCount) {
      if (result.node && !useExploredCharCount && !result.isFirstNode) {
        updateSectionData(createRange(result.node));
      } else if (result.isFirstNode) {
        updateSectionData(undefined);
      }

      exploredCharCount = useExploredCharCount ? exploredCharCount : data.exploredCharCount;
      previousIntendedCount = exploredCharCount;
    }

    useExploredCharCount = true;
    isBookmarkScreen = result.isBookmarkScreen;
  }

  function setDefaultBookmarkPositions(dimensionAdjustment: number) {
    if (verticalMode) {
      bookmarkTopAdjustment = dimensionAdjustment ? `${dimensionAdjustment}px` : '0.5rem';
      bookmarkLeftAdjustment = $firstDimensionMargin$
        ? `${width - $firstDimensionMargin$}px`
        : undefined;
      bookmarkRightAdjustment = $firstDimensionMargin$ ? undefined : '0.75rem';
    } else {
      bookmarkTopAdjustment = $firstDimensionMargin$ ? `${$firstDimensionMargin$}px` : '0.5rem';
      bookmarkLeftAdjustment = dimensionAdjustment
        ? `calc(${dimensionAdjustment}px + 0.75rem)`
        : '0.75rem';
      bookmarkRightAdjustment = undefined;
    }
  }

  function onSwipe(ev: CustomEvent<{ direction: 'top' | 'right' | 'left' | 'bottom' | null }>) {
    if (!concretePageManager || sectionJumpPending || $skipKeyDownListener$) return;
    if (!swipeStartedWithTouch) return;
    if (ev.detail.direction !== 'left' && ev.detail.direction !== 'right') return;
    const swipeLeft = ev.detail.direction === 'left';
    const nextPage = verticalMode ? !swipeLeft : swipeLeft;
    concretePageManager.flipPage(nextPage ? 1 : -1);
  }

  function onSwipePointerDown(ev: PointerEvent) {
    swipeStartedWithTouch = ev.pointerType === 'touch';
  }

  function onSwipeTouchStart() {
    swipeStartedWithTouch = true;
  }

  function onSwipeMouseDown() {
    swipeStartedWithTouch = false;
  }

  function onKeydown(ev: KeyboardEvent) {
    if (
      !concretePageManager ||
      sectionJumpPending ||
      $skipKeyDownListener$ ||
      ev.defaultPrevented ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.shiftKey ||
      ev.metaKey ||
      ev.repeat
    )
      return;
    switch (ev.code) {
      case 'ArrowLeft':
      case 'KeyA':
        concretePageManager[verticalMode ? 'nextPage' : 'prevPage']();
        break;
      case 'ArrowRight':
      case 'KeyD':
        concretePageManager[verticalMode ? 'prevPage' : 'nextPage']();
        break;
      case 'ArrowUp':
        concretePageManager.prevPage();
        break;
      case 'ArrowDown':
        concretePageManager.nextPage();
        break;
      default:
        return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();
  }

  nextChapter$.pipe(takeUntil(destroy$)).subscribe((chapterId) => {
    void jumpToSectionTarget(chapterId, true);
  });
</script>

<div
  bind:this={scrollEl}
  style:color={fontColor}
  style:font-size="{fontSize}px"
  style:line-height={lineHeight}
  style:padding-top={!verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-bottom={!verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-left={verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-right={verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:max-width={width ? `${width}px` : undefined}
  style:max-height={verticalMode && height ? `${height}px` : undefined}
  style:--font-family-serif={fontFamilyGroupOne}
  style:--font-family-sans-serif={fontFamilyGroupTwo}
  style:--book-content-hint-furigana-font-color={hintFuriganaFontColor}
  style:--book-content-hint-furigana-shadow-color={hintFuriganaShadowColor}
  style:--book-content-selection-color={selectionFontColor || undefined}
  style:--book-content-selection-background-color={selectionBackgroundColor || undefined}
  style:--book-content-child-width="{width}px"
  style:--book-content-child-height="{height}px"
  style:--book-content-child-column-width={!verticalMode && columnCount === 1 ? `${width}px` : ''}
  style:--book-content-column-count={columnCount}
  style:--book-content-image-max-width="{verticalMode
    ? width
    : (width + gap) / columnCount - gap}px"
  style:--book-content-text-margin="{textMarginValue ?? 0}rem"
  style:--book-content-text-intendation="{textIndentation ?? 0}rem"
  style:font-feature-settings={fontFeatureSettings}
  style:text-orientation={verticalTextOrientation}
  class:book-content--avoid-page-break={avoidPageBreak}
  class:book-content--writing-vertical-rl={verticalMode}
  class:book-content--writing-horizontal-rl={!verticalMode}
  class:book-content--hide-furigana={hideFurigana}
  class:book-content--hide-spoiler-image={hideSpoilerImage}
  class:book-content--furigana-style-hide={furiganaStyle === FuriganaStyle.Hide}
  class:book-content--furigana-style-partial={furiganaStyle === FuriganaStyle.Partial}
  class:book-content--furigana-style-toggle={furiganaStyle === FuriganaStyle.Toggle}
  class:book-content--furigana-style-full={furiganaStyle === FuriganaStyle.Full}
  class:ttu-apply-important={prioritizeReaderStyles}
  class:ttu-apply-justification={enableTextJustification}
  class:ttu-text-wrap-pretty={enableTextWrapPretty}
  class="book-content m-auto"
  use:swipe={{ timeframe: 500, minSwipeDistance: $swipeThreshold$, touchAction: 'pan-y' }}
  on:pointerdown={onSwipePointerDown}
  on:touchstart={onSwipeTouchStart}
  on:mousedown={onSwipeMouseDown}
  on:swipe={onSwipe}
>
  <div class="book-content-container" id={currentSectionId || null} bind:this={contentEl}>
    <HtmlRenderer html={displayedHtml} on:load={onHtmlLoad} />
  </div>
  <div class="book-content-tail-spacer" bind:this={tailSpacerEl} aria-hidden="true"></div>
</div>

{#if !allowDisplay}
  <div
    class="reader-loading-screen fixed inset-0 flex h-full w-full items-center justify-center text-7xl"
    style:color={fontColor}
    style:background-color={backgroundColor}
  >
    <Fa class="reader-loading-icon" icon={faSpinner} spin />
  </div>
{/if}

{#if isBookmarkScreen}
  <div
    class="fixed h-3 w-3 text-base opacity-25 sm:text-xl"
    style:color={fontColor}
    style:top={bookmarkTopAdjustment}
    style:left={bookmarkLeftAdjustment}
    style:right={bookmarkRightAdjustment}
  >
    <Fa icon={faBookmark} />
  </div>
{/if}

<svelte:window on:keydown={onKeydown} on:resize={() => (isResizing = true)} />

<style lang="scss">
  @use '../styles';

  @mixin ruby-edge-clearance($property) {
    :global(
      .book-content-container
        > *:not(.ttu-book-html-wrapper)
        > *:has(ruby):has(rt):not(:has(> :is(p, div, section, article, blockquote, ul, ol)))
    ),
    :global(
      .book-content-container
        > div.ttu-book-html-wrapper
        > div.ttu-book-body-wrapper
        > *:has(ruby):has(rt):not(:has(> :is(p, div, section, article, blockquote, ul, ol)))
    ),
    :global(
      .book-content-container
        > div.ttu-book-html-wrapper
        > div.ttu-book-body-wrapper
        > *
        > *:has(ruby):has(rt)
    ) {
      #{$property}: var(--book-content-ruby-edge-clearance) !important;
    }
  }

  .book-content {
    overflow: hidden;
    width: var(--book-content-child-width, 95vh);
  }

  .book-content-container {
    column-count: var(--book-content-column-count, 1);
    column-width: var(
      --book-content-child-column-width,
      auto
    ); // required for WebKit + column-count 1
    column-gap: 40px;
    column-fill: auto;
    height: var(--book-content-child-height, 95vh);

    :global(.ttu-illustration-container) {
      max-width: var(--book-content-image-max-width, 95vh) !important;
      max-height: var(--book-content-child-height, 95vh) !important;
    }
  }

  .book-content-tail-spacer {
    visibility: hidden;
    pointer-events: none;
    width: 0;
    height: 0;
  }

  .book-content {
    :global(svg),
    :global(img) {
      max-width: var(--book-content-image-max-width, 100vw);
      max-height: var(--book-content-child-height, 100vh);
    }

    &.book-content--avoid-page-break {
      :global(p) {
        break-inside: avoid;
      }
    }

    :global(.ttu-img-container) {
      // Needed for Blink rendering engine
      break-inside: avoid;
    }
  }

  .book-content--writing-vertical-rl {
    .book-content-container {
      column-width: var(--book-content-child-height, 100vh);
      width: 100%;
      height: auto;
    }

    @include ruby-edge-clearance('padding-right');
  }

  .book-content--writing-horizontal-rl {
    @include ruby-edge-clearance('padding-top');
  }
</style>
