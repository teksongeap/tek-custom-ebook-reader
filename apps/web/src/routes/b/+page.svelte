<script lang="ts">
  import {
    auditTime,
    debounceTime,
    EMPTY,
    filter,
    fromEvent,
    map,
    merge,
    NEVER,
    of,
    share,
    shareReplay,
    skip,
    startWith,
    Subject,
    switchMap,
    take,
    takeUntil,
    takeWhile,
    tap,
    timer
  } from 'rxjs';
  import { quintInOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { faCloudBolt, faPause, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import BookReader from '$lib/components/book-reader/book-reader.svelte';
  import type {
    AutoScroller,
    BookmarkManager,
    PageManager,
    SectionNavigator
  } from '$lib/components/book-reader/types';
  import LogReportDialog from '$lib/components/log-report-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import StyleSheetRenderer from '$lib/components/style-sheet-renderer.svelte';
  import {
    annotationHoverDelay$,
    autoBookmark$,
    autoBookmarkTime$,
    autoPositionOnResize$,
    avoidPageBreak$,
    bookReaderKeybindMap$,
    database,
    enableTapEdgeToFlip$,
    enableTextJustification$,
    enableTextWrapPretty$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    furiganaStyle$,
    hideFurigana$,
    hideSpoilerImage$,
    multiplier$,
    pageColumns$,
    paginationTransitionMode$,
    prioritizeReaderStyles$,
    secondDimensionMaxValue$,
    textIndentation$,
    textMarginValue$,
    theme$,
    trackerAutostartTime$,
    verticalMode$,
    writingMode$,
    viewMode$,
    selectionToBookmarkEnabled$,
    lineHeight$,
    syncTarget$,
    autoReplication$,
    skipKeyDownListener$,
    replicationSaveBehavior$,
    cacheStorageData$,
    confirmClose$,
    verticalCustomReadingPosition$,
    horizontalCustomReadingPosition$,
    customReadingPointEnabled$,
    statisticsEnabled$,
    openTrackerOnCompletion$,
    addCharactersOnCompletion$,
    statisticsMergeMode$,
    isOnline$,
    manualBookmark$,
    customThemes$,
    overwriteBookCompletion$,
    startDayHoursForTracker$,
    readingGoalsMergeMode$,
    pauseTrackerOnCustomPointChange$,
    hideSpoilerImageMode$,
    enableVerticalFontKerning$,
    enableFontVPAL$,
    verticalTextOrientation$,
    showCharacterCounter$
  } from '$lib/data/store';
  import BookCompletionConfetti from '$lib/components/book-reader/book-completion-confetti/book-completion-confetti.svelte';
  import AnnotationSelectionToolbar from '$lib/components/book-reader/book-annotations/annotation-selection-toolbar.svelte';
  import BookAnnotationsPanel from '$lib/components/book-reader/book-annotations/book-annotations-panel.svelte';
  import { serializeAnnotationRange } from '$lib/components/book-reader/book-annotations/annotation-range';
  import BookSearchPanel from '$lib/components/book-reader/book-search/book-search-panel.svelte';
  import BookReaderHeader from '$lib/components/book-reader/book-reader-header.svelte';
  import LoadingDialog from '$lib/components/loading-dialog.svelte';
  import {
    readerImageGalleryPictures$,
    toggleImageGalleryPictureSpoiler$,
    updateImageGalleryPictureSpoilers$
  } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import BookReaderImageGallery from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery.svelte';
  import {
    getDefaultStatistic,
    isTrackerMenuOpen$,
    isTrackerPaused$
  } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import BookReadingTracker from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker.svelte';
  import {
    flattenBookTocEntries,
    getChapterData,
    nextChapter$,
    sectionList$,
    sectionProgress$,
    setActiveTocItem,
    tocIsOpen$,
    tocTargets$,
    type SectionWithProgress
  } from '$lib/components/book-reader/book-toc/book-toc';
  import BookToc from '$lib/components/book-reader/book-toc/book-toc.svelte';
  import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
  import NumberDialog from '$lib/components/number-dialog.svelte';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import { preFilteredTitlesForStatistics$ } from '$lib/components/statistics/statistics-types';
  import {
    currentDbVersion,
    type BooksDbAnnotation,
    type BooksDbBookData,
    type BooksDbBookmarkData,
    type BooksDbStatistic
  } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { pagePath } from '$lib/data/env';
  import { DB_VERSION, PAGE_CHANGE, SKIPKEYLISTENER, SYNCED } from '$lib/data/events';
  import { fullscreenManager } from '$lib/data/fullscreen-manager';
  import { logger } from '$lib/data/logger';
  import { MergeMode } from '$lib/data/merge-mode';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
  import type { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
  import {
    StorageDataType,
    StorageSourceDefault,
    StorageKey
  } from '$lib/data/storage/storage-types';
  import { storageSource$ } from '$lib/data/storage/storage-view';
  import { availableThemes } from '$lib/data/theme-option';
  import { ViewMode } from '$lib/data/view-mode';
  import loadBookData from '$lib/functions/book-data-loader/load-book-data';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { getReaderChromeStyle, getReaderSurfaceStyle } from '$lib/functions/reader-typography';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import {
    AutoReplicationType,
    ReplicationSaveBehavior
  } from '$lib/functions/replication/replication-options';
  import { replicateData } from '$lib/functions/replication/replicator';
  import { readableToObservable } from '$lib/functions/rxjs/readable-to-observable';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { takeWhenBrowser } from '$lib/functions/rxjs/take-when-browser';
  import { tapDom } from '$lib/functions/rxjs/tap-dom';
  import { multiClickHandler } from '$lib/functions/multi-click-handler';
  import {
    executeReplicate$,
    type ReplicationContext
  } from '$lib/functions/replication/replication-progress';
  import { getDateKey } from '$lib/functions/statistic-util';
  import { clickOutside } from '$lib/functions/use-click-outside';
  import { convertRemToPixels, isMobile$, limitToRange } from '$lib/functions/utils';
  import {
    readerTargetNavigation$,
    type ReaderTargetNavigation
  } from '$lib/functions/reader-reference-layer/navigation';
  import {
    referenceTargetHighlightDuration,
    requestReaderTargetHoverFocus
  } from '$lib/functions/reader-reference-layer/highlight';
  import { onKeydownReader } from './on-keydown-reader';
  import { onDestroy, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import {
    clearRange,
    getParagraphToPoint,
    getRangeForUserSelection,
    getReferencePoints,
    pulseElement
  } from '$lib/functions/range-util';

  let showSpinner = true;
  let showHeader = false;
  let readerHeaderHotzoneEl: HTMLButtonElement | undefined;
  let isBookmarkScreen = false;
  let showFooter = true;
  let exploredCharCount = 0;
  let bookCharCount = 0;
  let autoScroller: AutoScroller | undefined;
  let bookmarkManager: BookmarkManager | undefined;
  let pageManager: PageManager | undefined;
  let sectionNavigator: SectionNavigator | undefined;
  let bookmarkData: Promise<BooksDbBookmarkData | undefined> = Promise.resolve(undefined);
  let customReadingPointTop = -2;
  let customReadingPointLeft = -2;
  let customReadingPoint = $verticalMode$
    ? $verticalCustomReadingPosition$
    : $horizontalCustomReadingPosition$;
  let customReadingPointScrollOffset = 0;
  let customReadingPointRange: Range | undefined;
  let lastSelectedRange: Range | undefined;
  let lastSelectedRangeWasEmpty = true;
  let annotationSelectionRect: DOMRect | undefined;
  let annotationSelectionAnchorRect: DOMRect | undefined;
  let annotationSelectionText = '';
  let annotations: BooksDbAnnotation[] = [];
  let showAnnotationsPanel = false;
  let showSearchPanel = false;
  let activeAnnotationId = '';
  let activeAnnotationEditId = '';
  let annotationPopoverResetKey = 0;
  let selectionPointerStart:
    | {
        x: number;
        y: number;
        inReader: boolean;
      }
    | undefined;
  let selectionPointerMovedInReader = false;
  let lastReaderSelectionPointerUp = 0;
  let isSelectingCustomReadingPoint = false;
  let showCustomReadingPoint = false;
  let localStorageHandler: BrowserStorageHandler;
  let dataToReplicate: StorageDataType[] = [];
  let dataToReplicateQueue: StorageDataType[] = [];
  let externalStorageHandler: BaseStorageHandler | undefined;
  let externalStorageErrors = 0;
  let isReplicating = false;
  let storedExploredCharacter = 0;
  let hasBookmarkData = false;
  let blockDataUpdates = false;
  let trackerElm: BookReadingTracker;
  let showTrackerIcon = false;
  let wasTrackerPaused = true;
  let frozenPosition = -1;
  let skipFirstFreezeChange = false;
  let bookCompleted = false;
  let confettiWidthModifier = 36;
  let confettiMaxRuns = 0;
  let showReaderImageGallery = false;
  let dismissDialogs = true;
  let syncedResolver: () => void;

  type ChapterTick = {
    key: string;
    label: string;
    position: number;
    startCharacter: number;
  };

  const syncedPromise = new Promise<void>((resolver) => {
    syncedResolver = resolver;
  });
  const routeDestroy$ = new Subject<void>();
  const queuedReaderImageGalleryPictures = new Map<string, boolean>();
  const fontFeatureSettings = [
    $enableVerticalFontKerning$ && '"vkrn"',
    $enableFontVPAL$ && '"vpal"'
  ]
    .filter((f) => !!f && $verticalMode$)
    .join(', ');
  const verticalTextOrientation = $verticalMode$ ? $verticalTextOrientation$ : '';

  const bookId$ = iffBrowser(() => readableToObservable(page)).pipe(
    map((pageObj) => Number(pageObj.url.searchParams.get('id'))),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const rawBookData$ = bookId$.pipe(
    switchMap(async (id) => {
      let bookData: BooksDbBookData | undefined;

      try {
        localStorageHandler = getStorageHandler(
          window,
          StorageKey.BROWSER,
          undefined,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        );

        localStorageHandler.startContext({ id, title: '' });
        bookData = await localStorageHandler.getBook();

        if (!bookData) {
          return bookData;
        }

        const currentContext = {
          id: bookData.id,
          title: bookData.title,
          imagePath: bookData.coverImage
        };

        localStorageHandler.startContext(currentContext);

        if (bookData.storageSource) {
          externalStorageHandler = await getStorageHandlerByName(bookData.storageSource, true);
        } else if ($autoReplication$ !== AutoReplicationType.Off) {
          externalStorageHandler = await getStorageHandlerByName($syncTarget$);
        }

        bookData.lastBookOpen = new Date().getTime();

        await localStorageHandler.updateLastRead(bookData);
        await syncDownData(externalStorageHandler, currentContext);

        if (!$statisticsEnabled$) {
          const wasNew = (
            await database.setFirstBookRead(currentContext.title, $startDayHoursForTracker$)
          )[1];

          if (wasNew) {
            scheduleReplication(StorageDataType.STATISTICS);
          }
        }

        bookData = await saveExternalLastRead(externalStorageHandler, bookData);

        if (bookData.language) {
          document.documentElement.lang = bookData.language;
        }
      } catch (error: any) {
        const message = `Error loading book: ${error.message}`;

        logger.warn(message);

        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message
            }
          }
        ]);
        return undefined;
      } finally {
        syncedResolver();

        showSpinner = false;
      }

      if (externalStorageHandler) {
        externalStorageHandler.updateSettings(
          window,
          true,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$,
          $cacheStorageData$,
          false,
          bookData.storageSource || $syncTarget$
        );
      }

      return bookData;
    }),
    share()
  );

  const leaveIfBookMissing$ = rawBookData$.pipe(
    tap((data) => {
      if (!data) {
        goto(`${pagePath}${mergeEntries.MANAGE.routeId}`);
      }
    }),
    reduceToEmptyString()
  );

  const initBookmarkData$ = rawBookData$.pipe(
    tap((rawBookData) => {
      if (!rawBookData) return;
      bookmarkData = database.getBookmark(rawBookData.id);
    }),
    reduceToEmptyString()
  );

  const initAnnotations$ = rawBookData$.pipe(
    switchMap((rawBookData) => (rawBookData ? database.getAnnotations(rawBookData.id) : of([]))),
    tap((bookAnnotations) => {
      annotations = bookAnnotations;
    }),
    reduceToEmptyString()
  );

  const bookData$ = rawBookData$.pipe(
    switchMap((rawBookData) => {
      if (!rawBookData) {
        setActiveTocItem(undefined);
        tocTargets$.next([]);
        return EMPTY;
      }

      sectionList$.next(rawBookData.sections || []);
      setActiveTocItem(undefined);
      tocTargets$.next(flattenBookTocEntries(rawBookData.toc || []));

      return loadBookData(
        rawBookData,
        '.book-content',
        document,
        $viewMode$ === ViewMode.Paginated,
        $hideSpoilerImageMode$
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const resize$ = iffBrowser(() =>
    visualViewport ? fromEvent(visualViewport, 'resize') : of()
  ).pipe(share());

  const containerViewportWidth$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.width || 0),
    takeWhenBrowser()
  );

  const containerViewportHeight$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.height || 0),
    takeWhenBrowser()
  );

  const themeOption$ = theme$.pipe(
    map(
      (theme) =>
        availableThemes.get(theme) || $customThemes$[theme] || availableThemes.get('light-theme')
    ),
    filter((o): o is NonNullable<typeof o> => !!o),
    takeWhenBrowser()
  );

  const backgroundColor$ = themeOption$.pipe(map((o) => o.backgroundColor));

  const collectReaderImageGallerySpoilerToggles$ = toggleImageGalleryPictureSpoiler$.pipe(
    tap((readerImageGalleryPicture) => {
      queuedReaderImageGalleryPictures.set(
        readerImageGalleryPicture.url,
        readerImageGalleryPicture.unspoilered
      );

      updateImageGalleryPictureSpoilers$.next();
    }),
    reduceToEmptyString()
  );

  const handleUpdateImageGalleryPictureSpoilers$ = updateImageGalleryPictureSpoilers$.pipe(
    debounceTime(250),
    tap(() => {
      $readerImageGalleryPictures$ = $readerImageGalleryPictures$.map((galleryPicture) => {
        const picture = galleryPicture;

        if (queuedReaderImageGalleryPictures.has(picture.url)) {
          picture.unspoilered = queuedReaderImageGalleryPictures.get(picture.url)!;
        }

        return picture;
      });

      queuedReaderImageGalleryPictures.clear();
    }),
    reduceToEmptyString()
  );

  const backgroundStyleName = 'background-color';
  const setBackgroundColor$ = backgroundColor$.pipe(
    tapDom(
      () => document.body,
      (backgroundColor, body) => body.style.setProperty(backgroundStyleName, backgroundColor),
      (body) => body.style.removeProperty(backgroundStyleName)
    ),
    reduceToEmptyString(),
    takeWhenBrowser()
  );

  const writingModeStyleName = 'writing-mode';
  const setWritingMode$ = writingMode$.pipe(
    tapDom(
      () => document.documentElement,
      (writingMode, documentElement) =>
        documentElement.style.setProperty(writingModeStyleName, writingMode),
      (documentElement) => documentElement.style.removeProperty(writingModeStyleName)
    ),
    reduceToEmptyString(),
    takeWhenBrowser()
  );

  const sectionData$ = iffBrowser(() => sectionProgress$).pipe(
    map((sectionProgress) => [...sectionProgress.values()])
  );

  const textSelector$ = iffBrowser(() => fromEvent(document, 'selectionchange')).pipe(
    debounceTime(200),
    tap(() => {
      const selection = window.getSelection();
      const currentSelected = selection?.toString().trim() || '';
      const isUserReaderSelection =
        (selectionPointerStart?.inReader && selectionPointerMovedInReader) ||
        new Date().getTime() - lastReaderSelectionPointerUp < 900;

      if (currentSelected && selection?.rangeCount && isUserReaderSelection) {
        const range = selection.getRangeAt(0).cloneRange();
        const selectionRects = getRangeViewportRects(range);

        if (!selectionRects) {
          hideAnnotationComposer();
          return;
        }

        lastSelectedRange = range;
        lastSelectedRangeWasEmpty = false;
        annotationSelectionRect = selectionRects.selectionRect;
        annotationSelectionAnchorRect = selectionRects.anchorRect;
        annotationSelectionText = currentSelected;
      } else {
        lastSelectedRangeWasEmpty = true;

        if (
          !(
            document.activeElement instanceof HTMLElement &&
            document.activeElement.closest('.annotation-toolbar')
          )
        ) {
          lastSelectedRange = undefined;
          hideAnnotationComposer();
        }
      }
    }),
    reduceToEmptyString()
  );

  const replicator$ = executeReplicate$.pipe(
    auditTime(60000),
    switchMap(() => executeReplication()),
    reduceToEmptyString()
  );

  const autoStartTracker$ = iffBrowser(() =>
    $statisticsEnabled$ && $trackerAutostartTime$ > 0 ? fromEvent(document, PAGE_CHANGE) : NEVER
  ).pipe(
    debounceTime($trackerAutostartTime$ * 1000),
    take(1),
    tap(() => {
      wasTrackerPaused = false;
      isTrackerPaused$.next(wasTrackerPaused);
    }),
    reduceToEmptyString()
  );

  $: if ($tocIsOpen$) {
    autoScroller?.off();
  }

  $: if (browser && bookCharCount) {
    document.dispatchEvent(new CustomEvent(PAGE_CHANGE, { detail: { exploredCharCount } }));
  }

  $: if (browser) {
    document.dispatchEvent(new CustomEvent(PAGE_CHANGE, { detail: { bookCharCount } }));
  }

  $: if (showCustomReadingPoint) {
    pauseTracker();

    pulseElement(customReadingPointRange?.endContainer?.parentElement, 'add', 1);

    fromEvent(document, 'click')
      .pipe(skip(1), take(1), takeUntil(routeDestroy$))
      .subscribe(() => {
        showCustomReadingPoint = false;
        pulseElement(customReadingPointRange?.endContainer?.parentElement, 'remove', 1);
        restartTrackerAfterCharacterChangeOrTime(1);
      });
  }

  $: if (frozenPosition !== -1 && exploredCharCount >= frozenPosition) {
    if (skipFirstFreezeChange) {
      skipFirstFreezeChange = false;
    } else {
      frozenPosition = -1;
    }
  }

  $: isPaginated = $viewMode$ === ViewMode.Paginated;

  $: firstDimensionMargin =
    browser && $enableTapEdgeToFlip$ && isPaginated && $verticalMode$
      ? limitToRange(convertRemToPixels(window, 0.5), window.innerWidth, $firstDimensionMargin$)
      : ($firstDimensionMargin$ ?? 0);

  $: tapButtonHeight = `calc(100% - ${showHeader ? 5 : 4}rem)`;

  $: tapButtonTop = `${showHeader ? 3 : 2}rem`;

  $: readerFooterClearance = 12;

  $: readerProgressPercent = bookCharCount
    ? limitToRange(0, 100, (exploredCharCount / bookCharCount) * 100)
    : 0;

  $: readerProgressText = `${readerProgressPercent.toFixed(2)}%`;

  $: readerProgressCounterText = `${formatCharacterCount(
    exploredCharCount
  )} / ${formatCharacterCount(bookCharCount)}`;

  $: readerProgressSummaryText = [
    $showCharacterCounter$ ? readerProgressCounterText : '',
    readerProgressText
  ]
    .filter(Boolean)
    .join(' ');

  $: footerChapterLabel = getCurrentChapterLabel(
    $sectionData$,
    exploredCharCount,
    $rawBookData$?.title ?? ''
  );

  $: footerChapterTicks = getChapterTicks($sectionData$, bookCharCount);

  $: readerChromeStyle = getReaderChromeStyle({
    fontSize: $fontSize$,
    fontColor: $themeOption$?.fontColor ?? '',
    backgroundColor: $backgroundColor$ ?? ''
  });
  $: readerSurfaceStyle = getReaderSurfaceStyle({
    fontSize: $fontSize$,
    fontColor: $themeOption$?.fontColor ?? '',
    backgroundColor: $backgroundColor$ ?? ''
  });

  $: upSyncEnabled =
    externalStorageHandler &&
    ($autoReplication$ === AutoReplicationType.Up || $autoReplication$ === AutoReplicationType.All);

  $: bookmarkData.then((data) => {
    hasBookmarkData = !!data;
    storedExploredCharacter = data?.exploredCharCount || 0;
  });

  /** Experimental Code - May be removed any time without warning */

  $: if (browser) {
    document.dispatchEvent(new CustomEvent(SKIPKEYLISTENER, { detail: $skipKeyDownListener$ }));
  }

  onMount(() => document.addEventListener('ttu-action', handleAction, false));

  function handleAction({ detail }: any) {
    if (!detail.type) {
      return;
    }

    if (detail.type === 'dbVersion') {
      document.dispatchEvent(new CustomEvent(DB_VERSION, { detail: currentDbVersion }));
    } else if (detail.type === 'waitForSync') {
      syncedPromise.finally(() => document.dispatchEvent(new CustomEvent(SYNCED)));
    } else if (detail.type === 'skipKeyDownListener') {
      skipKeyDownListener$.next(detail.params.value);
    } else if (
      detail.type === 'sync' &&
      (detail.syncType === StorageDataType.AUDIOBOOK ||
        detail.syncType === StorageDataType.SUBTITLE)
    ) {
      scheduleReplication(detail.syncType);
    }
  }
  /** Experimental Code - May be removed any time without warning */

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('ttu-action', handleAction, false);
      document.documentElement.lang = 'ja';
    }

    readerImageGalleryPictures$.next([]);

    if (dismissDialogs) {
      dialogManager.dialogs$.next([]);
    }

    routeDestroy$.next();
    routeDestroy$.complete();
  });

  function handleUnload(event: BeforeUnloadEvent) {
    if (
      $confirmClose$ &&
      (isReplicating ||
        storedExploredCharacter !== exploredCharCount ||
        (upSyncEnabled && dataToReplicate.length) ||
        (upSyncEnabled && dataToReplicateQueue.length))
    ) {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      return (event.returnValue = 'Are you sure you want to exit?');
    }

    return event;
  }

  function trackerSingleClickHandler() {
    if (!statisticsEnabled$) {
      return;
    }

    wasTrackerPaused = $isTrackerPaused$;
    isTrackerPaused$.next(true);
    isTrackerMenuOpen$.next(true);
  }

  function trackerDblClickHandler() {
    if (!statisticsEnabled$) {
      return;
    }

    dialogManager.dialogs$.next([]);
    wasTrackerPaused = !$isTrackerPaused$;
    isTrackerPaused$.next(wasTrackerPaused);
  }

  async function handleJump() {
    const dataId = getBookIdSync();

    if (!bookmarkManager || !dataId) {
      return;
    }

    pauseTracker();
    skipKeyDownListener$.next(true);

    const target = await new Promise<number | undefined>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: NumberDialog,
          props: {
            dialogHeader: 'Jump to Position',
            minValue: 1,
            maxValue: bookCharCount || 1,
            resolver
          }
        }
      ]);
    });

    skipKeyDownListener$.next(false);

    if (typeof target !== 'number') {
      restartTrackerAfterCharacterChangeOrTime(1);
      return;
    }

    restartTrackerAfterCharacterChangeOrTime(1000);

    bookmarkManager.scrollToBookmark(
      {
        dataId: dataId,
        exploredCharCount: target,
        lastBookmarkModified: new Date().getTime(),
        progress: 0
      },
      customReadingPointScrollOffset
    );
  }

  async function completeBook() {
    if (!$rawBookData$) {
      return;
    }

    const wasAutoscrollerEnabled = autoScroller?.wasAutoScrollerEnabled$.getValue();
    const wasTrackerPausedBefore = $statisticsEnabled$ ? $isTrackerPaused$ : true;

    showHeader = false;
    autoScroller?.off();

    if ($statisticsEnabled$) {
      wasTrackerPaused = true;
      isTrackerPaused$.next(true);
    }

    const diffToComplete =
      $statisticsEnabled$ && $addCharactersOnCompletion$
        ? Math.max(0, bookCharCount - exploredCharCount)
        : 0;
    const wasCanceled = await new Promise((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Complete Book',
            dialogMessage: `Would you like to complete this Book${
              diffToComplete ? ` and capture ${diffToComplete} characters read` : ''
            }?`,
            resolver
          }
        }
      ]);
    });

    if (wasCanceled) {
      if ($statisticsEnabled$ && !wasTrackerPausedBefore) {
        wasTrackerPaused = false;
        $isTrackerPaused$ = false;
      }

      if (wasAutoscrollerEnabled) {
        autoScroller?.toggle();
      }

      return;
    }

    await openActionBackdrop('Completing book');

    try {
      if (diffToComplete) {
        const [hadError] = await trackerElm.processStatistics(diffToComplete);

        if (hadError) {
          throw new Error('Character Update failed');
        }
      }

      const finishedStatistic = await database.getStatisticForCompletedBook($rawBookData$.title);
      const todayKey = getDateKey($startDayHoursForTracker$);
      const statisticsUntilToday = await database.getStatisticsUntilDate(
        $rawBookData$.title,
        todayKey
      );
      const todayStatistic =
        statisticsUntilToday.find((statistic) => statistic.dateKey === todayKey) ||
        getDefaultStatistic($rawBookData$.title, todayKey);
      const statisticsToStore: BooksDbStatistic[] = [];
      const lastStatisticModified = Date.now();

      todayStatistic.lastStatisticModified = lastStatisticModified;
      todayStatistic.completedBook = 1;
      todayStatistic.completedData = {
        ...{ dateKey: todayKey },
        ...BaseStorageHandler.getStatisticsMetadata(
          BaseStorageHandler.getStatisticsFileName(
            statisticsUntilToday,
            todayStatistic.lastStatisticModified
          )
        )
      };

      let updateFinishedStatistic = false;

      if (!finishedStatistic) {
        statisticsToStore.push(todayStatistic);
      } else if (
        $overwriteBookCompletion$ &&
        finishedStatistic.dateKey !== todayStatistic.dateKey
      ) {
        delete finishedStatistic.completedBook;
        delete finishedStatistic.completedData;
        finishedStatistic.lastStatisticModified = lastStatisticModified;
        statisticsToStore.push(todayStatistic, finishedStatistic);
        updateFinishedStatistic = true;
      } else if ($overwriteBookCompletion$) {
        statisticsToStore.push(todayStatistic);
      }

      if (statisticsToStore.length) {
        await database.storeStatistics(
          $rawBookData$.title,
          statisticsToStore,
          ReplicationSaveBehavior.Overwrite,
          MergeMode.LOCAL,
          lastStatisticModified
        );

        trackerElm?.updateCompletedBook(
          todayStatistic,
          updateFinishedStatistic ? finishedStatistic : undefined
        );

        scheduleReplication(StorageDataType.STATISTICS);
      }

      if (bookmarkManager) {
        const data = {
          ...bookmarkManager.formatBookmarkData($rawBookData$.id, customReadingPointScrollOffset),
          exploredCharCount: Math.max(0, bookCharCount - 1),
          progress: 1
        };

        await database.putBookmark(data);

        bookmarkData = Promise.resolve(data);

        scheduleReplication(StorageDataType.PROGRESS);
      }

      if ($statisticsEnabled$ && $openTrackerOnCompletion$) {
        confettiWidthModifier = 36;
        confettiMaxRuns = 6;
        bookCompleted = window.matchMedia('(min-width: 900px)').matches;
        isTrackerMenuOpen$.next(true);
      } else {
        dialogManager.dialogs$.next([]);
        confettiWidthModifier = 0;
        confettiMaxRuns = 3;
        bookCompleted = true;

        merge(fromEvent(document, 'pointerup'), timer(10000))
          .pipe(take(1), takeUntil(routeDestroy$))
          .subscribe(() => {
            bookCompleted = false;
          });
      }
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Error completing Book: ${message}`
          }
        }
      ]);
    }
  }

  function getCurrentChapterLabel(
    sectionData: SectionWithProgress[],
    characterPosition: number,
    fallback = ''
  ) {
    if (!sectionData?.length) {
      return fallback;
    }

    const [mainChapters, chapterIndex] = getChapterData(sectionData);
    const chaptersByCharacter = [...mainChapters]
      .filter((chapter) => typeof chapter.startCharacter === 'number')
      .sort((a, b) => (a.startCharacter as number) - (b.startCharacter as number));
    let chapterByCharacter: SectionWithProgress | undefined;

    for (const chapter of chaptersByCharacter) {
      if ((chapter.startCharacter as number) > characterPosition) {
        break;
      }

      chapterByCharacter = chapter;
    }

    return chapterByCharacter?.label || mainChapters[chapterIndex]?.label || fallback;
  }

  function getChapterTicks(sectionData: SectionWithProgress[], totalCharacters: number) {
    if (!sectionData?.length || !totalCharacters) {
      return [] as ChapterTick[];
    }

    const [mainChapters] = getChapterData(sectionData);

    return mainChapters.flatMap((chapter) => {
      const startCharacter = chapter.startCharacter;

      if (
        typeof startCharacter !== 'number' ||
        startCharacter <= 0 ||
        startCharacter >= totalCharacters
      ) {
        return [];
      }

      return [
        {
          key: chapter.reference,
          label: chapter.label || '',
          position: limitToRange(0, 100, (startCharacter / totalCharacters) * 100),
          startCharacter
        }
      ];
    });
  }

  function goToChapterTick(tick: ChapterTick) {
    if (tick.startCharacter !== exploredCharCount) {
      pauseTracker(true);
    }

    nextChapter$.next(tick.key);
  }

  function copyCurrentProgress(currentProgress: string) {
    try {
      navigator.clipboard.writeText(currentProgress);
    } catch (error: any) {
      logger.error(`Error writing Progress to Clipboard: ${error.message}`);
    }
  }

  function copyFooterProgress(currentProgress: string, currentTarget: EventTarget | null) {
    copyCurrentProgress(currentProgress);

    if (!(currentTarget instanceof HTMLElement)) {
      return;
    }

    pulseElement(currentTarget.closest<HTMLElement>('.reader-progress-card'), 'add', 0.5, 500);
  }

  function formatCharacterCount(characterCount: number) {
    return Math.max(0, Math.floor(characterCount || 0)).toLocaleString();
  }

  function freezeTrackerPosition() {
    if (!$statisticsEnabled$) {
      return;
    }

    if (frozenPosition > -1) {
      frozenPosition = -1;
    } else {
      skipFirstFreezeChange = true;
      frozenPosition = exploredCharCount;
    }
  }

  async function getStorageHandlerByName(storageSourceName: string, throwIfNotFound = false) {
    if (!storageSourceName) {
      if (throwIfNotFound) {
        throw new Error(`No storage source found`);
      }

      return undefined;
    }

    if (storageSourceName === StorageSourceDefault.GDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.GDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      );
    }
    if (storageSourceName === StorageSourceDefault.ONEDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.ONEDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      );
    }
    if (storageSourceName) {
      const db = await database.db;
      const storageSource = await db.get('storageSource', storageSourceName);

      if (storageSource) {
        if (storageSource.type !== StorageKey.FS && !$isOnline$) {
          dialogManager.dialogs$.next([
            {
              component: MessageDialog,
              props: {
                title: 'Load Error',
                message:
                  'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
              }
            }
          ]);

          return undefined;
        }

        return getStorageHandler(
          window,
          storageSource.type,
          storageSourceName,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        );
      }
      if (throwIfNotFound) {
        throw new Error(`No storage source with name ${storageSourceName} found`);
      }
    }

    const message = `No storage source with name ${storageSourceName} found - skipping auto import/export`;

    logger.warn(message);

    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Configuration Error',
          message
        }
      }
    ]);

    return undefined;
  }

  async function saveExternalLastRead(
    storageHandler: BaseStorageHandler | undefined,
    localBookData: BooksDbBookData
  ) {
    if (!storageHandler) {
      return localBookData;
    }

    // eslint-disable-next-line prefer-const
    let { id, ...bookData } = localBookData;

    if (localBookData.storageSource) {
      const externalBookData = await storageHandler.getBook();

      if (externalBookData && !(externalBookData instanceof File)) {
        bookData = {
          ...externalBookData,
          ...{
            id: localBookData.id,
            lastBookOpen: localBookData.lastBookOpen,
            storageSource: localBookData.storageSource
          }
        };
      }
    } else if (!localBookData.elementHtml) {
      throw new Error('Book has no data stored');
    }

    const dataToReturn = { id, ...bookData };

    await storageHandler.updateLastRead(dataToReturn).catch((error: any) => {
      const message = `Failed to update last read on external storage: ${error.message}`;

      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Update Error',
            message
          }
        }
      ]);
    });

    return dataToReturn;
  }

  async function syncDownData(
    storageHandler: BaseStorageHandler | undefined,
    context: ReplicationContext
  ) {
    if (localStorageHandler && storageHandler) {
      storageHandler.startContext(context);
    }

    if (
      localStorageHandler &&
      storageHandler &&
      ($autoReplication$ === AutoReplicationType.Down ||
        $autoReplication$ === AutoReplicationType.All)
    ) {
      const error = await replicateData(
        storageHandler,
        localStorageHandler,
        false,
        [context],
        [
          StorageDataType.PROGRESS,
          StorageDataType.STATISTICS,
          StorageDataType.READING_GOALS,
          StorageDataType.AUDIOBOOK,
          StorageDataType.SUBTITLE
        ]
      );

      if (error) {
        throw new Error(error);
      }
    }
  }

  function onKeydown(ev: KeyboardEvent) {
    if (
      $skipKeyDownListener$ ||
      ev.defaultPrevented ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.shiftKey ||
      ev.metaKey ||
      ev.repeat ||
      isEditableEventTarget(ev.target)
    ) {
      return;
    }

    const result = onKeydownReader(
      ev,
      bookReaderKeybindMap$.getValue(),
      bookmarkPage,
      scrollToBookmark,
      (x) => multiplier$.next(multiplier$.getValue() + x),
      autoScroller,
      pageManager,
      $verticalMode$,
      changeChapter,
      handleSetCustomReadingPoint,
      trackerDblClickHandler,
      freezeTrackerPosition
    );

    if (!result) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    ev.preventDefault();
  }

  function isEditableEventTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  function getBookIdSync() {
    let bookId: number | undefined;
    bookId$.subscribe((x) => (bookId = x)).unsubscribe();
    return bookId;
  }

  function getRangeViewportRects(range: Range) {
    if (!getRangeBookContent(range)) {
      return undefined;
    }

    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width || rect.height);

    if (rects.length) {
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      const left = Math.min(...rects.map((rect) => rect.left));

      return {
        selectionRect: new DOMRect(left, top, right - left, bottom - top),
        anchorRect: new DOMRect(rects[0].left, rects[0].top, rects[0].width, rects[0].height)
      };
    }

    const rect = range.getBoundingClientRect();

    return rect.width || rect.height
      ? {
          selectionRect: rect,
          anchorRect: rect
        }
      : undefined;
  }

  function getRangeBookContent(range: Range) {
    const container = range.commonAncestorContainer;
    const containerElement = container instanceof Element ? container : container.parentElement;

    return containerElement?.closest('.book-content') as HTMLElement | undefined;
  }

  function hideAnnotationComposer() {
    annotationSelectionRect = undefined;
    annotationSelectionAnchorRect = undefined;
    annotationSelectionText = '';
  }

  function handleSelectionPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    selectionPointerStart = {
      x: event.clientX,
      y: event.clientY,
      inReader: isReaderSelectionTarget(event.target)
    };
    selectionPointerMovedInReader = false;
  }

  function handleSelectionPointerMove(event: PointerEvent) {
    if (!selectionPointerStart?.inReader) {
      return;
    }

    const selectionDistance = Math.hypot(
      event.clientX - selectionPointerStart.x,
      event.clientY - selectionPointerStart.y
    );

    if (selectionDistance > 4) {
      selectionPointerMovedInReader = true;
    }
  }

  function handleSelectionPointerUp() {
    if (selectionPointerStart?.inReader && selectionPointerMovedInReader) {
      lastReaderSelectionPointerUp = new Date().getTime();
    }

    selectionPointerStart = undefined;
    selectionPointerMovedInReader = false;
  }

  function isReaderSelectionTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      !!target.closest('.book-content') &&
      !target.closest('.annotation-toolbar') &&
      !target.closest('[data-ttu-annotation-card]')
    );
  }

  async function createAnnotation({
    detail
  }: CustomEvent<{ color: BooksDbAnnotation['color']; comment: string }>) {
    const bookId = getBookIdSync();

    if (!bookId || !lastSelectedRange) {
      hideAnnotationComposer();
      return;
    }

    const contentRoot = getRangeBookContent(lastSelectedRange);
    const anchor = serializeAnnotationRange(lastSelectedRange, contentRoot);

    if (!anchor) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Annotation',
            message: 'Select text inside a single reader section to create an annotation.'
          }
        }
      ]);
      hideAnnotationComposer();
      return;
    }

    const now = new Date().getTime();
    const bookmarkPosition =
      isPaginated && bookmarkManager
        ? bookmarkManager.formatBookmarkDataByRange(bookId, lastSelectedRange)
        : bookmarkManager?.formatBookmarkData(bookId, customReadingPointScrollOffset);
    const annotationExploredCharCount = bookmarkPosition?.exploredCharCount || exploredCharCount;
    const annotation: BooksDbAnnotation = {
      id: createAnnotationId(),
      dataId: bookId,
      color: detail.color,
      comment: detail.comment,
      selectedText: annotationSelectionText || anchor.text,
      anchor,
      progress: bookCharCount ? annotationExploredCharCount / bookCharCount : 0,
      exploredCharCount: annotationExploredCharCount,
      createdAt: now,
      updatedAt: now
    };

    await database.putAnnotation(annotation);

    annotations = [...annotations, annotation];
    activeAnnotationId = annotation.id;
    activeAnnotationEditId = annotation.id;
    hideAnnotationComposer();
    clearRange(window, 0, false);
  }

  function createAnnotationId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function deleteAnnotation(annotation: BooksDbAnnotation) {
    await database.deleteAnnotation(annotation.id);

    annotations = annotations.filter((item) => item.id !== annotation.id);

    if (activeAnnotationId === annotation.id) {
      activeAnnotationId = '';
    }
    if (activeAnnotationEditId === annotation.id) {
      activeAnnotationEditId = '';
    }
  }

  async function updateAnnotationComment({
    detail
  }: CustomEvent<{ annotation: BooksDbAnnotation; comment: string }>) {
    if (detail.comment === detail.annotation.comment) {
      activeAnnotationId = detail.annotation.id;
      if (activeAnnotationEditId === detail.annotation.id) {
        activeAnnotationEditId = '';
      }
      return;
    }

    const updatedAnnotation: BooksDbAnnotation = {
      ...detail.annotation,
      comment: detail.comment,
      updatedAt: new Date().getTime()
    };

    await database.putAnnotation(updatedAnnotation);

    annotations = annotations.map((annotation) =>
      annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation
    );
    if (activeAnnotationEditId === updatedAnnotation.id) {
      activeAnnotationEditId = '';
    }
  }

  async function jumpToAnnotation(annotation: BooksDbAnnotation) {
    closeAnnotationsPanel();
    showHeader = false;
    activeAnnotationId = '';
    annotationPopoverResetKey += 1;
    await tick();

    if (annotation.exploredCharCount !== exploredCharCount) {
      pauseTracker(true);
    }

    const sectionLoaded = annotation.anchor.sectionId
      ? await sectionNavigator?.jumpToSectionTarget(annotation.anchor.sectionId, true)
      : false;

    if (!sectionLoaded && bookmarkManager) {
      bookmarkManager.scrollToBookmark(
        {
          dataId: annotation.dataId,
          exploredCharCount: annotation.exploredCharCount,
          progress: annotation.progress,
          lastBookmarkModified: annotation.updatedAt
        },
        customReadingPointScrollOffset
      );
    } else if (!sectionLoaded) {
      nextChapter$.next(annotation.anchor.sectionId);
    }

    await scrollToRenderedAnnotation(annotation.id);
  }

  async function scrollToRenderedAnnotation(annotationId: string) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (attempt) {
        await waitForAnnotationRenderAttempt();
      } else {
        await tick();
      }

      const annotationElements = getRenderedAnnotationElements(annotationId);
      const annotationElement = getAnnotationNavigationElement(annotationElements);

      if (!annotationElement) {
        continue;
      }

      if (isPaginated) {
        scrollPaginatedAnnotationIntoView(annotationElements);
      } else {
        annotationElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      }

      requestReaderTargetHoverFocus(annotationElement, referenceTargetHighlightDuration);
      pulseRenderedAnnotation(annotationId, referenceTargetHighlightDuration);
      return true;
    }

    return false;
  }

  function waitForAnnotationRenderAttempt() {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120);
    });
  }

  function getRenderedAnnotationElements(annotationId: string) {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-ttu-annotation-id]')).filter(
      (element) => element.dataset.ttuAnnotationId === annotationId
    );
  }

  function getAnnotationNavigationElement(annotationElements: HTMLElement[]) {
    return annotationElements[0];
  }

  function scrollPaginatedAnnotationIntoView(annotationElements: HTMLElement[]) {
    if (!pageManager) {
      return;
    }

    const annotationElement = getAnnotationNavigationElement(annotationElements);

    if (!annotationElement) {
      return;
    }

    const readerElement = annotationElement.closest<HTMLElement>('.book-content');

    if (!readerElement) {
      return;
    }

    const readerRect = readerElement.getBoundingClientRect();
    const annotationRect = getPaginatedAnnotationTargetRect(annotationElements);

    if (!annotationRect) {
      return;
    }

    const scrollProperty = $verticalMode$ ? 'scrollTop' : 'scrollLeft';
    const offset = $verticalMode$
      ? annotationRect.top - readerRect.top
      : annotationRect.left - readerRect.left;
    const targetScroll = Math.max(0, readerElement[scrollProperty] + offset);

    pageManager.scrollToColumn(targetScroll, false);
  }

  function getPaginatedAnnotationTargetRect(annotationElements: HTMLElement[]) {
    // Inline annotation spans can split across CSS columns, so use the final rendered
    // fragment instead of the union rect that may start in an earlier column.
    const rects = annotationElements.flatMap((element) =>
      Array.from(element.getClientRects()).filter((rect) => rect.width || rect.height)
    );

    if (!rects.length) {
      return annotationElements[0]?.getBoundingClientRect();
    }

    return rects.reduce((bestRect, rect) => {
      if ($verticalMode$) {
        return rect.top > bestRect.top ? rect : bestRect;
      }

      if (Math.abs(rect.left - bestRect.left) > 1) {
        return rect.left > bestRect.left ? rect : bestRect;
      }

      return rect.top > bestRect.top ? rect : bestRect;
    }, rects[0]);
  }

  function pulseRenderedAnnotation(
    annotationId: string,
    duration = referenceTargetHighlightDuration
  ) {
    const annotationElements = getRenderedAnnotationElements(annotationId);

    annotationElements.forEach((element) =>
      element.classList.add('book-annotation-highlight--active')
    );

    window.setTimeout(() => {
      annotationElements.forEach((element) =>
        element.classList.remove('book-annotation-highlight--active')
      );
    }, duration);
  }

  function closeAnnotationsPanel() {
    showAnnotationsPanel = false;

    if ($statisticsEnabled$ && !wasTrackerPaused) {
      isTrackerPaused$.next(false);
    }
  }

  function closeSearchPanel() {
    showSearchPanel = false;

    if ($statisticsEnabled$ && !wasTrackerPaused) {
      isTrackerPaused$.next(false);
    }
  }

  function jumpToSearchTarget(navigation: ReaderTargetNavigation) {
    closeSearchPanel();
    showHeader = false;
    pauseTracker(true);
    readerTargetNavigation$.next(navigation);
  }

  async function bookmarkPage({ hideHeader = true }: { hideHeader?: boolean } = {}) {
    const bookId = getBookIdSync();
    if (!bookId || !bookmarkManager) return;

    let data: BooksDbBookmarkData;

    if (hideHeader) {
      showHeader = false;
    }

    if (isPaginated) {
      const userSelectedRange = $selectionToBookmarkEnabled$
        ? getRangeForUserSelection(window, lastSelectedRange)
        : undefined;
      const bookmarkRange = userSelectedRange || customReadingPointRange;

      pulseElement(bookmarkRange?.endContainer?.parentElement, 'add', 0.5, 500);

      data = bookmarkManager.formatBookmarkDataByRange(bookId, bookmarkRange);

      if (userSelectedRange) {
        clearRange(window);
      }
    } else {
      data = bookmarkManager.formatBookmarkData(bookId, customReadingPointScrollOffset);
    }

    await database.putBookmark(data);

    bookmarkData = Promise.resolve(data);

    scheduleReplication(StorageDataType.PROGRESS);
  }

  async function scrollToBookmark() {
    const data = await bookmarkData;
    if (!data || !bookmarkManager) return;

    if (data.exploredCharCount !== exploredCharCount) {
      pauseTracker(true);
    }

    bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
  }

  function onFullscreenClick() {
    showHeader = false;

    if (!fullscreenManager.fullscreenElement) {
      fullscreenManager.requestFullscreen(document.documentElement);
      return;
    }
    fullscreenManager.exitFullscreen();
  }

  function onDomainHintClick() {
    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Old Domain',
          message:
            'You are currently using an old TTU Reader domain - consider switching to https://reader.ttsu.app to prevent issues and to ensure full features'
        },
        disableCloseOnClick: true
      }
    ]);
  }

  function changeChapter(offset: number) {
    if (!$sectionData$?.length) {
      return;
    }

    const [mainChapters, currentChapterIndex] = getChapterData($sectionData$);

    if (
      (!currentChapterIndex && offset === -1) ||
      (offset === 1 && currentChapterIndex === mainChapters.length - 1)
    ) {
      return;
    }

    const nextChapter = mainChapters[currentChapterIndex + offset];

    if (!nextChapter) {
      return;
    }

    if (nextChapter.startCharacter !== exploredCharCount) {
      pauseTracker(true);
    }

    nextChapter$.next(nextChapter.reference);
  }

  async function executeReplication(isSilent = true) {
    if (isReplicating || !dataToReplicate.length || !$rawBookData$ || !externalStorageHandler) {
      return;
    }

    isReplicating = true;

    if (!isSilent) {
      skipKeyDownListener$.next(true);
      logger.clearHistory();
      await openActionBackdrop('Syncing reader data');
    }

    const currentHandlerStorageSource = $rawBookData$.storageSource || $syncTarget$;

    externalStorageHandler.updateSettings(
      window,
      false,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$,
      $cacheStorageData$,
      !isSilent,
      currentHandlerStorageSource
    );

    const error = await replicateData(
      localStorageHandler,
      externalStorageHandler,
      !isSilent && $storageSource$ === externalStorageHandler.storageType,
      [
        {
          id: $rawBookData$.id,
          title: $rawBookData$.title,
          imagePath: $rawBookData$.coverImage
        }
      ],
      dataToReplicate
    ).catch((err: any) => err.message);

    externalStorageHandler.updateSettings(
      window,
      true,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$,
      $cacheStorageData$,
      false,
      currentHandlerStorageSource
    );

    isReplicating = false;

    if (error) {
      if (!isSilent) {
        const showReport = logger.errorCount > 1;

        logger.warn(error);

        dialogManager.dialogs$.next([
          {
            component: showReport ? LogReportDialog : MessageDialog,
            props: {
              title: 'Error Processing Data',
              message: showReport
                ? `Some or all data could not be stored on an external storage`
                : error
            }
          }
        ]);
      }

      externalStorageErrors += 1;
    } else {
      externalStorageErrors = 0;

      if (!isSilent) {
        dialogManager.dialogs$.next([]);
      }

      if (dataToReplicateQueue.length) {
        const isAudioBookOnly =
          dataToReplicate.length === 1 && dataToReplicate[0] === StorageDataType.AUDIOBOOK;
        dataToReplicate = JSON.parse(JSON.stringify(dataToReplicateQueue));
        dataToReplicateQueue = [];

        if (isSilent || isAudioBookOnly) {
          executeReplicate$.next();
        } else if (!isAudioBookOnly) {
          await executeReplication(false);
        } else {
          dataToReplicate = [];
        }
      } else {
        dataToReplicate = [];
      }
    }

    if (!isSilent) {
      skipKeyDownListener$.next(false);
    }
  }

  async function openActionBackdrop(label = 'Working') {
    dialogManager.dialogs$.next([
      {
        component: LoadingDialog,
        props: { label },
        disableCloseOnClick: true
      }
    ]);

    await tick();
    await waitForNextPaint();
  }

  function waitForNextPaint() {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      requestAnimationFrame(settle);
      setTimeout(settle, 80);
    });
  }

  function closeHeaderOnPointerDownOutside(node: HTMLElement) {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      const isInsideHeaderArea =
        target instanceof Node &&
        (node.contains(target) || !!readerHeaderHotzoneEl?.contains(target));

      if (event.defaultPrevented || isInsideHeaderArea) {
        return;
      }

      showHeader = false;
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return {
      destroy() {
        document.removeEventListener('pointerdown', onPointerDown, true);
      }
    };
  }

  async function leaveReader(routeId: string, deleteLastItem = true) {
    let message;

    try {
      blockDataUpdates = true;

      await tick();

      autoScroller?.off();
      wasTrackerPaused = true;
      isTrackerPaused$.next(true);

      if ($confirmClose$ && storedExploredCharacter !== exploredCharCount) {
        const wasCanceled = await new Promise((resolver) => {
          dialogManager.dialogs$.next([
            {
              component: ConfirmDialog,
              props: {
                dialogHeader: 'Confirm Exit',
                dialogMessage: 'Your current location was not bookmarked. Continue leaving?',
                resolver
              },

              disableCloseOnClick: true
            }
          ]);
        });

        if (wasCanceled) {
          blockDataUpdates = false;
          return;
        }

        await tick();
      }

      await openActionBackdrop('Opening page');

      if (deleteLastItem) {
        await database.deleteLastItem();
      }

      if (!$manualBookmark$) {
        await bookmarkPage();
      }

      if ($statisticsEnabled$ && trackerElm) {
        const [hadError, updated] = await trackerElm.flushUpdates(true);

        if (hadError) {
          throw new Error('Error updating Statistics');
        }

        if (updated) {
          scheduleReplication(StorageDataType.STATISTICS);
        }
      }

      dialogManager.dialogs$.next([]);

      if (upSyncEnabled) {
        await executeReplication(false);
      }
    } catch (error: any) {
      message = error.message;
    }

    if (message) {
      logger.error(message);

      dismissDialogs = false;
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message
          },
          disableCloseOnClick: true
        }
      ]);
    }

    goto(`${pagePath}${routeId}`);
  }

  function handleSetCustomReadingPoint() {
    if (!$customReadingPointEnabled$ && !isPaginated) {
      return;
    }

    const contentEl = document.querySelector('.book-content');

    if (!contentEl) {
      return;
    }

    autoScroller?.off();

    if ($pauseTrackerOnCustomPointChange$) {
      pauseTracker();
    }

    if (isPaginated) {
      customReadingPointTop = window.innerHeight / 2 - 2;
      customReadingPointLeft = window.innerWidth / 2 - 2;
    }

    showHeader = false;
    isSelectingCustomReadingPoint = true;
    document.body.classList.add('cursor-crosshair');

    const {
      elLeftReferencePoint,
      elTopReferencePoint,
      elRightReferencePoint,
      elBottomReferencePoint,
      pointGap
    } = getReferencePoints(window, contentEl, $verticalMode$, firstDimensionMargin);

    merge(fromEvent(document, 'pointerup'), fromEvent(document, 'pointermove'))
      // eslint-disable-next-line rxjs/no-ignored-takewhile-value
      .pipe(
        takeWhile(() => isSelectingCustomReadingPoint),
        takeUntil(routeDestroy$)
      )
      .subscribe((event: Event) => {
        if (!(event instanceof PointerEvent)) {
          return;
        }

        if (event.type === 'pointerup') {
          document.body.classList.remove('cursor-crosshair');
          isSelectingCustomReadingPoint = false;

          tick().then(() => {
            customReadingPointLeft = $verticalMode$ ? event.x : customReadingPointLeft;
            customReadingPointTop = $verticalMode$ ? customReadingPointTop : event.y;

            const result = getParagraphToPoint(customReadingPointLeft, customReadingPointTop);

            if (result) {
              pulseElement(result.parent, 'add', 0.5, 500);
            }

            if (isPaginated) {
              customReadingPointRange = result?.range;
            } else {
              let newPercentage = 0;

              if ($verticalMode$) {
                newPercentage = Math.ceil(
                  (Math.max(0, customReadingPointLeft - elLeftReferencePoint) /
                    (elRightReferencePoint - elLeftReferencePoint)) *
                    100
                );

                verticalCustomReadingPosition$.next(newPercentage);
              } else {
                newPercentage = Math.ceil(
                  (Math.max(0, customReadingPointTop - elTopReferencePoint) /
                    (elBottomReferencePoint - elTopReferencePoint)) *
                    100
                );

                horizontalCustomReadingPosition$.next(newPercentage);
              }

              customReadingPoint = newPercentage;
            }

            if ($pauseTrackerOnCustomPointChange$) {
              restartTrackerAfterCharacterChangeOrTime(1000);
            }
          });
        } else {
          const insideXBound =
            event.x >= elLeftReferencePoint + pointGap && event.x <= elRightReferencePoint;
          const insideYBound =
            event.y >= elTopReferencePoint && event.y <= elBottomReferencePoint - pointGap;

          if (isPaginated) {
            customReadingPointTop = insideYBound ? event.y : customReadingPointTop;
            customReadingPointLeft = insideXBound ? event.x : customReadingPointLeft;
          } else if ($verticalMode$ && insideXBound) {
            customReadingPointLeft = event.x;
          } else if (!$verticalMode$ && insideYBound) {
            customReadingPointTop = event.y;
          }
        }
      });
  }

  function pauseTracker(restartAfterCharacterChange = false) {
    if ($statisticsEnabled$ && !$isTrackerPaused$) {
      wasTrackerPaused = false;
      $isTrackerPaused$ = true;

      if (restartAfterCharacterChange) {
        restartTrackerAfterCharacterChangeOrTime();
      }
    }
  }

  function restartTrackerAfterCharacterChangeOrTime(timerAmount = 0) {
    if (!$statisticsEnabled$ || wasTrackerPaused) {
      return;
    }

    merge(fromEvent(document, PAGE_CHANGE), timerAmount ? timer(timerAmount) : NEVER)
      .pipe(debounceTime(200), take(1), takeUntil(routeDestroy$))
      .subscribe(() => {
        wasTrackerPaused = false;
        $isTrackerPaused$ = false;
      });
  }

  function scheduleReplication(dataType: StorageDataType) {
    if (upSyncEnabled) {
      const toReplicate = isReplicating ? dataToReplicateQueue : dataToReplicate;

      if (!toReplicate.includes(dataType)) {
        toReplicate.push(dataType);
      }

      if (!isReplicating) {
        dataToReplicate = [...dataToReplicate];
      }

      if (!blockDataUpdates) {
        executeReplicate$.next();
      }
    }
  }
</script>

<svelte:head>
  <title>{formatPageTitle($rawBookData$?.title ?? '')}</title>
</svelte:head>

{$collectReaderImageGallerySpoilerToggles$ ?? ''}
{$handleUpdateImageGalleryPictureSpoilers$ ?? ''}
<button
  bind:this={readerHeaderHotzoneEl}
  type="button"
  class="reader-header-hotzone fixed inset-x-0 top-0 z-[9] h-8 w-full"
  aria-label="Show reader controls"
  on:click|stopPropagation={() => (showHeader = true)}
></button>
{#if showHeader}
  <div
    class="writing-horizontal-tb fixed inset-x-0 top-0 z-40 w-full"
    transition:fly|local={{ y: -300, easing: quintInOut }}
    use:closeHeaderOnPointerDownOutside
  >
    <BookReaderHeader
      bookTitle={$rawBookData$?.title ?? ''}
      fontSize={$fontSize$}
      fontColor={$themeOption$?.fontColor ?? ''}
      backgroundColor={$backgroundColor$ ?? ''}
      hasChapterData={!!$sectionData$?.length}
      hasText={!!bookCharCount}
      hasCustomReadingPoint={!!(
        ($customReadingPointEnabled$ || isPaginated) &&
        ((isPaginated && customReadingPointRange) ||
          (!isPaginated && customReadingPointLeft > -1 && customReadingPointTop > -1))
      )}
      showFullscreenButton={fullscreenManager.fullscreenEnabled}
      autoScrollMultiplier={$multiplier$}
      {hasBookmarkData}
      annotationCount={annotations.length}
      bind:isBookmarkScreen
      on:tocClick={() => {
        pauseTracker();

        showHeader = false;
        tocIsOpen$.next(true);
      }}
      on:jumpClick={handleJump}
      on:completeBook={completeBook}
      on:setCustomReadingPoint={handleSetCustomReadingPoint}
      on:showCustomReadingPoint={() => {
        showHeader = false;
        showCustomReadingPoint = true;
      }}
      on:resetCustomReadingPoint={() => {
        showHeader = false;

        if ($pauseTrackerOnCustomPointChange$) {
          pauseTracker();
        }

        if (isPaginated) {
          customReadingPointRange = undefined;
        } else if ($verticalMode$) {
          verticalCustomReadingPosition$.next(100);
          customReadingPoint = 100;
        } else {
          horizontalCustomReadingPosition$.next(0);
          customReadingPoint = 0;
        }

        if ($pauseTrackerOnCustomPointChange$) {
          restartTrackerAfterCharacterChangeOrTime(1000);
        }
      }}
      on:fullscreenClick={onFullscreenClick}
      on:bookmarkClick={() => bookmarkPage()}
      on:scrollToBookmarkClick={() => {
        showHeader = false;
        scrollToBookmark();
      }}
      on:statisticsClick={() => {
        if ($rawBookData$) {
          $preFilteredTitlesForStatistics$ = new Set([$rawBookData$.title]);
        }

        leaveReader(mergeEntries.STATISTICS.routeId, false);
      }}
      on:readerImageGalleryClick={() => {
        showHeader = false;
        showReaderImageGallery = true;
      }}
      on:annotationsClick={() => {
        showHeader = false;
        pauseTracker();
        showAnnotationsPanel = true;
      }}
      on:searchClick={() => {
        showHeader = false;
        pauseTracker();
        showSearchPanel = true;
      }}
      on:settingsClick={() => leaveReader(mergeEntries.SETTINGS.routeId, false)}
      on:domainHintClick={onDomainHintClick}
      on:bookManagerClick={() => leaveReader(mergeEntries.MANAGE.routeId)}
    />
  </div>
{/if}

{#if $bookData$ && $rawBookData$}
  {#if $statisticsEnabled$}
    <BookReadingTracker
      fontColor={$themeOption$.fontColor}
      fontSize={$fontSize$}
      backgroundColor={$backgroundColor$}
      bookTitle={$rawBookData$.title}
      sectionData={$sectionData$}
      {frozenPosition}
      {exploredCharCount}
      {bookCharCount}
      {autoScroller}
      {blockDataUpdates}
      bind:wasTrackerPaused
      bind:this={trackerElm}
      on:freezeCurrentLocation={freezeTrackerPosition}
      on:statisticsSaved={() => {
        if (!blockDataUpdates) {
          scheduleReplication(StorageDataType.STATISTICS);
        }
      }}
      on:trackerAvailable={() => (showTrackerIcon = true)}
      on:trackerMenuClosed={() => {
        if (!wasTrackerPaused) {
          isTrackerPaused$.next(false);
        }

        isTrackerMenuOpen$.next(false);

        bookCompleted = false;
      }}
    />
  {/if}
  <StyleSheetRenderer styleSheet={$bookData$.styleSheet} />
  <BookReader
    htmlContent={$bookData$.htmlContent}
    width={$containerViewportWidth$ ?? 0}
    height={$containerViewportHeight$ ?? 0}
    {fontFeatureSettings}
    {verticalTextOrientation}
    prioritizeReaderStyles={$prioritizeReaderStyles$}
    enableTextJustification={$enableTextJustification$}
    enableTextWrapPretty={$enableTextWrapPretty$}
    verticalMode={$verticalMode$}
    fontColor={$themeOption$?.fontColor}
    backgroundColor={$backgroundColor$}
    selectionFontColor={$themeOption$?.selectionFontColor ?? ''}
    selectionBackgroundColor={$themeOption$?.selectionBackgroundColor ?? ''}
    hintFuriganaFontColor={$themeOption$?.hintFuriganaFontColor}
    hintFuriganaShadowColor={$themeOption$?.hintFuriganaShadowColor}
    fontFamilyGroupOne={$fontFamilyGroupOne$}
    fontFamilyGroupTwo={$fontFamilyGroupTwo$}
    fontSize={$fontSize$}
    lineHeight={$lineHeight$}
    textIndentation={$textIndentation$}
    textMarginValue={$textMarginValue$}
    hideSpoilerImage={$hideSpoilerImage$}
    hideFurigana={$hideFurigana$}
    furiganaStyle={$furiganaStyle$}
    viewMode={$viewMode$}
    secondDimensionMaxValue={$secondDimensionMaxValue$}
    {firstDimensionMargin}
    bottomChromeClearance={readerFooterClearance}
    autoPositionOnResize={$autoPositionOnResize$}
    avoidPageBreak={$avoidPageBreak$}
    pageColumns={$pageColumns$}
    paginationTransitionMode={$paginationTransitionMode$}
    autoBookmark={$autoBookmark$}
    autoBookmarkTime={$autoBookmarkTime$}
    multiplier={$multiplier$}
    bind:exploredCharCount
    bind:bookCharCount
    bind:isBookmarkScreen
    bind:bookmarkData
    bind:autoScroller
    bind:bookmarkManager
    bind:pageManager
    bind:sectionNavigator
    bind:customReadingPoint
    bind:customReadingPointTop
    bind:customReadingPointLeft
    bind:customReadingPointScrollOffset
    bind:customReadingPointRange
    bind:showCustomReadingPoint
    {annotations}
    {activeAnnotationId}
    {activeAnnotationEditId}
    {annotationPopoverResetKey}
    annotationHoverDelay={$annotationHoverDelay$}
    on:annotationActivate={({ detail }) => (activeAnnotationId = detail)}
    on:annotationUpdate={updateAnnotationComment}
    on:annotationDelete={({ detail }) => deleteAnnotation(detail)}
    on:bookmark={() => bookmarkPage({ hideHeader: false })}
    on:trackerPause={() => pauseTracker(true)}
  />
  <AnnotationSelectionToolbar
    selectionRect={annotationSelectionRect}
    anchorRect={annotationSelectionAnchorRect}
    verticalMode={$verticalMode$}
    fontSize={$fontSize$}
    fontColor={$themeOption$?.fontColor ?? ''}
    backgroundColor={$backgroundColor$ ?? ''}
    on:save={createAnnotation}
    on:dismiss={hideAnnotationComposer}
  />
  {$initBookmarkData$ ?? ''}
  {$initAnnotations$ ?? ''}
  {$setBackgroundColor$ ?? ''}
  {$setWritingMode$ ?? ''}
  {$textSelector$ ?? ''}
  {$replicator$ ?? ''}
  {$autoStartTracker$ ?? ''}
{:else}
  {$leaveIfBookMissing$ ?? ''}
{/if}

{#if $tocIsOpen$ && $sectionData$}
  <div
    class="reader-side-panel-shell writing-horizontal-tb fixed top-0 left-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between"
    style={readerSurfaceStyle}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    use:clickOutside={() => {
      if ($statisticsEnabled$ && !wasTrackerPaused) {
        isTrackerPaused$.next(false);
      }
      tocIsOpen$.next(false);
    }}
  >
    <BookToc
      sectionData={$sectionData$}
      tocEntries={$rawBookData$?.toc ?? []}
      verticalMode={$verticalMode$}
      {exploredCharCount}
      {wasTrackerPaused}
      fontSize={$fontSize$}
      fontColor={$themeOption$?.fontColor ?? ''}
      backgroundColor={$backgroundColor$ ?? ''}
    />
  </div>
{/if}

{#if showSearchPanel && $bookData$}
  <div
    class="reader-side-panel-shell writing-horizontal-tb fixed top-0 left-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between"
    style={readerSurfaceStyle}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    use:clickOutside={closeSearchPanel}
  >
    <BookSearchPanel
      htmlContent={$bookData$.htmlContent}
      sectionData={$sectionData$ ?? []}
      fontSize={$fontSize$}
      fontColor={$themeOption$?.fontColor ?? ''}
      backgroundColor={$backgroundColor$ ?? ''}
      on:close={closeSearchPanel}
      on:jump={({ detail }) => jumpToSearchTarget(detail)}
    />
  </div>
{/if}

{#if showAnnotationsPanel}
  <div
    class="reader-side-panel-shell writing-horizontal-tb fixed top-0 left-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between"
    style={readerSurfaceStyle}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    use:clickOutside={closeAnnotationsPanel}
  >
    <BookAnnotationsPanel
      {annotations}
      sectionData={$sectionData$ ?? []}
      fontSize={$fontSize$}
      fontColor={$themeOption$?.fontColor ?? ''}
      backgroundColor={$backgroundColor$ ?? ''}
      on:close={closeAnnotationsPanel}
      on:jump={({ detail }) => jumpToAnnotation(detail)}
      on:update={updateAnnotationComment}
      on:delete={({ detail }) => deleteAnnotation(detail)}
    />
  </div>
{/if}

{#if showReaderImageGallery}
  <BookReaderImageGallery
    fontColor={$themeOption$.fontColor}
    fontSize={$fontSize$}
    backgroundColor={$backgroundColor$}
    on:close={() => (showReaderImageGallery = false)}
  />
{/if}

{#if (isSelectingCustomReadingPoint && !$isMobile$) || (!isPaginated && showCustomReadingPoint)}
  <div
    class="fixed left-0 z-20 h-[1px] w-full border border-red-500"
    style:top={`${customReadingPointTop}px`}
  />
  <div
    class="fixed top-0 z-20 h-full w-[1px] border border-red-500"
    style:left={`${customReadingPointLeft}px`}
  />
{/if}

{#if $enableTapEdgeToFlip$ && isPaginated && !$skipKeyDownListener$}
  <button
    class="fixed left-0 z-10 w-5"
    on:click={$verticalMode$ ? () => pageManager?.nextPage() : () => pageManager?.prevPage()}
    style:height={tapButtonHeight}
    style:top={tapButtonTop}
  />
  <button
    class="fixed right-0 z-10 w-5"
    on:click={$verticalMode$ ? () => pageManager?.prevPage() : () => pageManager?.nextPage()}
    style:height={tapButtonHeight}
    style:top={tapButtonTop}
  />
{/if}

{#if showSpinner}
  <div
    class="reader-loading-screen fixed inset-0 flex h-full w-full items-center justify-center"
    style={readerChromeStyle}
  >
    <div class="reader-loading-indicator">
      <Fa class="reader-loading-icon" icon={faSpinner} spin />
      <div class="reader-loading-bar" aria-hidden="true"></div>
    </div>
  </div>
{/if}

<div
  id="ttu-page-footer"
  class="reader-footer writing-horizontal-tb fixed bottom-0 left-0 z-10 flex h-12 w-full items-end gap-2 px-3 pb-1.5 leading-none sm:px-4"
  style={readerChromeStyle}
>
  <button
    type="button"
    class="reader-footer-toggle absolute inset-0 z-0"
    aria-label="Toggle reader progress"
    on:click={() => (showFooter = !showFooter)}
  ></button>
  {#if showFooter && bookCharCount}
    {#if footerChapterLabel}
      <div
        class="reader-chapter-card writing-horizontal-tb relative z-10"
        title={footerChapterLabel}
      >
        <span class="reader-chapter-card-label">{footerChapterLabel}</span>
      </div>
    {/if}
  {/if}
  <div class="reader-footer-controls relative z-10 ml-auto flex min-w-0 items-center gap-2">
    {#if showTrackerIcon}
      <button
        type="button"
        title="Click to open Tracker Menu or Double Click to toggle Tracker"
        aria-label="Open or toggle reading tracker"
        class="reader-footer-pill flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
        class:reader-footer-pill--active={$isTrackerPaused$}
        class:animate-pulse={frozenPosition > -1}
        use:multiClickHandler={[trackerSingleClickHandler, trackerDblClickHandler]}
      >
        <Fa icon={$isTrackerPaused$ ? faPlay : faPause} />
      </button>
    {/if}
    {#if dataToReplicate.length}
      <button
        type="button"
        aria-label="Sync reader data"
        class="reader-footer-pill flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
        class:reader-footer-pill--danger={externalStorageErrors > 1}
        class:animate-pulse={externalStorageErrors > 1 || isReplicating}
        on:click|stopPropagation={() => {
          if ($statisticsEnabled$) {
            wasTrackerPaused = $isTrackerPaused$;
            isTrackerPaused$.next(true);
          }

          executeReplication(false).finally(() => {
            if ($statisticsEnabled$ && !wasTrackerPaused) {
              isTrackerPaused$.next(false);
            }
          });
        }}
      >
        <Fa icon={faCloudBolt} />
      </button>
    {/if}
  </div>
  {#if showFooter && bookCharCount}
    {@const footerCopyText = [footerChapterLabel, readerProgressSummaryText]
      .filter(Boolean)
      .join(' - ')}
    <div
      class="reader-progress-card writing-horizontal-tb relative z-10 px-3 py-1.5 text-left leading-none select-none sm:px-4"
      class:reader-progress-card--with-counter={$showCharacterCounter$}
    >
      <span class="reader-progress-layout">
        <span class="reader-progress-track">
          <span class="reader-progress-fill" style:width={`${readerProgressPercent}%`}></span>
          {#each footerChapterTicks as tick (tick.key)}
            <button
              type="button"
              class="reader-progress-tick"
              aria-label={`Go to ${tick.label || 'chapter'}`}
              style:left={`${tick.position}%`}
              on:click|stopPropagation={() => goToChapterTick(tick)}
            >
              <span class="reader-progress-tick-label">{tick.label || 'Chapter'}</span>
            </button>
          {/each}
        </span>
        <button
          type="button"
          class="reader-progress-percent"
          title="Copy reading progress"
          aria-label="Copy reading progress"
          on:click|stopPropagation={({ currentTarget }) =>
            copyFooterProgress(footerCopyText, currentTarget)}
        >
          {#if $showCharacterCounter$}
            <span class="reader-progress-counter">{readerProgressCounterText}</span>
          {/if}
          <span>{readerProgressText}</span>
        </button>
      </span>
    </div>
  {/if}
</div>

{#if bookCompleted}
  <BookCompletionConfetti {confettiWidthModifier} {confettiMaxRuns} {window} />
{/if}

<svelte:window
  on:keydown={onKeydown}
  on:pointerdown={handleSelectionPointerDown}
  on:pointermove={handleSelectionPointerMove}
  on:pointerup={handleSelectionPointerUp}
  on:pointercancel={handleSelectionPointerUp}
  on:beforeunload={handleUnload}
  on:resize={() => {
    if ($statisticsEnabled$ && !$isTrackerPaused$) {
      pauseTracker();

      merge(fromEvent(document, PAGE_CHANGE), timer(1000))
        .pipe(debounceTime(1000), take(1), takeUntil(routeDestroy$))
        .subscribe(() => {
          restartTrackerAfterCharacterChangeOrTime(1000);
        });
    }
  }}
/>
