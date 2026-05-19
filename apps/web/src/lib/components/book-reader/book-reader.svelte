<script lang="ts">
  import {
    animationFrameScheduler,
    combineLatest,
    debounceTime,
    filter,
    fromEvent,
    map,
    mergeMap,
    of,
    ReplaySubject,
    share,
    shareReplay,
    startWith,
    Subject,
    tap
  } from 'rxjs';
  import BookReaderContinuous from '$lib/components/book-reader/book-reader-continuous/book-reader-continuous.svelte';
  import { pxReader } from '$lib/components/book-reader/css-classes';
  import type {
    BooksDbAnnotation,
    BooksDbBookmarkData
  } from '$lib/data/database/books-db/versions/books-db';
  import type { FuriganaStyle } from '$lib/data/furigana-style';
  import type { PaginationTransitionMode } from '$lib/data/pagination-transition-mode';
  import { ViewMode } from '$lib/data/view-mode';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import {
    findReaderTargetElement,
    type ReaderTarget
  } from '$lib/functions/reader-reference-layer/epub-reference';
  import { readerFootnoteRequest$ } from '$lib/functions/reader-reference-layer/footnote';
  import { readerTargetNavigation$ } from '$lib/functions/reader-reference-layer/navigation';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { convertRemToPixels } from '$lib/functions/utils';
  import { logger } from '$lib/data/logger';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager, SectionNavigator } from './types';
  import BookReaderPaginated from './book-reader-paginated/book-reader-paginated.svelte';
  import { hoverFocus } from './hover-focus';
  import { enableReaderWakeLock$, enableTapEdgeToFlip$, hoverFocusEnabled$ } from '$lib/data/store';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import BookAnnotationsRenderer from './book-annotations/book-annotations-renderer.svelte';
  import { faArrowUpRightFromSquare, faXmark } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

  export let fontFeatureSettings: string;

  export let verticalTextOrientation: string;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let textIndentation: number;

  export let textMarginValue: number;

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

  export let hideSpoilerImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let bottomChromeClearance = 0;

  export let autoPositionOnResize: boolean;

  export let avoidPageBreak: boolean;

  export let pageColumns: number;

  export let paginationTransitionMode: PaginationTransitionMode;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let viewMode: ViewMode;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  export let sectionNavigator: SectionNavigator | undefined;

  export let isBookmarkScreen: boolean;

  export let customReadingPoint: number;

  export let customReadingPointTop: number;

  export let customReadingPointLeft: number;

  export let customReadingPointScrollOffset: number;

  export let customReadingPointRange: Range | undefined;

  export let showCustomReadingPoint: boolean;

  export let annotations: BooksDbAnnotation[] = [];

  export let activeAnnotationId = '';

  export let activeAnnotationEditId = '';

  export let annotationPopoverResetKey = 0;

  let showBlurMessage = false;

  let wakeLock: WakeLockSentinel | undefined;

  let wakeLockRequestTimer: ReturnType<typeof setTimeout> | undefined;

  let wakeLockRequestInFlight = false;

  let destroyed = false;

  let visibilityState: DocumentVisibilityState;

  let contentEl: HTMLElement | undefined;

  let footnotePreviewHtml = '';

  let footnotePreviewTarget: ReaderTarget | undefined;

  let annotationRenderRevision = 0;

  const dispatch = createEventDispatcher<{
    annotationActivate: string;
    annotationUpdate: { annotation: BooksDbAnnotation; comment: string };
    annotationDelete: BooksDbAnnotation;
  }>();

  const mutationObserver: MutationObserver = new MutationObserver(handleMutation);

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const containerEl$ = writableSubject<HTMLElement | null>(null);

  $: heightModifer =
    firstDimensionMargin && ViewMode.Paginated === viewMode && !verticalMode
      ? firstDimensionMargin * 2
      : 0;

  $: syncWakeLock($enableReaderWakeLock$, visibilityState);

  onDestroy(() => {
    destroyed = true;
    clearWakeLockRequestTimer();
    mutationObserver.disconnect();

    releaseWakeLock();
  });

  const computedStyle$ = combineLatest([
    containerEl$.pipe(filter((el): el is HTMLElement => !!el)),
    combineLatest([width$, height$]).pipe(startWith(0))
  ]).pipe(
    debounceTime(0, animationFrameScheduler),
    map(([el]) => getComputedStyle(el)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const contentEl$ = new ReplaySubject<HTMLElement>(1);

  const contentViewportWidth$ = computedStyle$.pipe(
    map((style) =>
      getAdjustedWidth(
        width -
          parsePx(style.paddingLeft) -
          parsePx(style.paddingRight) -
          ($enableTapEdgeToFlip$ && ViewMode.Paginated === viewMode && !verticalMode
            ? convertRemToPixels(window, 1.75)
            : 0)
      )
    )
  );

  const contentViewportHeight$ = computedStyle$.pipe(
    map((style) =>
      getAdjustedHeight(
        height - parsePx(style.paddingTop) - parsePx(style.paddingBottom) - heightModifer
      )
    )
  );

  const reactiveElements$ = iffBrowser(() => of(document)).pipe(
    mergeMap((document) => {
      const reactiveElementsFn = reactiveElements(
        document,
        furiganaStyle,
        hideSpoilerImage,
        navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches
      );
      return contentEl$.pipe(mergeMap((contentEl) => reactiveElementsFn(contentEl)));
    }),
    reduceToEmptyString()
  );

  const imageLoadingState$ = contentEl$.pipe(
    mergeMap((contentEl) => imageLoadingState(contentEl)),
    share()
  );

  const blurListener$ = contentEl$.pipe(
    tap((contentEl) => {
      mutationObserver.disconnect();
      mutationObserver.observe(contentEl, { attributes: true });
    }),
    reduceToEmptyString()
  );

  const hoverFocusKeybind$ = iffBrowser(() =>
    fromEvent<KeyboardEvent>(document, 'keydown', { capture: true })
  ).pipe(
    filter(
      (event) =>
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'h' &&
        !isEditableEventTarget(event.target)
    ),
    tap((event) => {
      event.preventDefault();
      hoverFocusEnabled$.next(!$hoverFocusEnabled$);
    }),
    reduceToEmptyString()
  );

  const footnoteRequest$ = iffBrowser(() => readerFootnoteRequest$).pipe(
    tap(({ target }) => {
      openFootnotePreview(target);
    }),
    reduceToEmptyString()
  );

  $: width$.next(width);

  $: height$.next(height);

  function getAdjustedWidth(widthValue: number) {
    if (ViewMode.Paginated === viewMode && !verticalMode && secondDimensionMaxValue) {
      return Math.min(secondDimensionMaxValue, widthValue);
    }
    return widthValue;
  }

  function getAdjustedHeight(heightValue: number) {
    if (ViewMode.Paginated === viewMode && verticalMode && secondDimensionMaxValue) {
      return Math.min(secondDimensionMaxValue, heightValue);
    }
    return heightValue;
  }

  function parsePx(px: string) {
    return Number(px.replace(/px$/, ''));
  }

  function handleMutation([mutation]: MutationRecord[]) {
    if (!(mutation.target instanceof HTMLElement)) {
      showBlurMessage = false;
      return;
    }

    showBlurMessage = mutation.target.style.filter.includes('blur');
  }

  function handleContentChange({ detail }: CustomEvent<HTMLElement>) {
    contentEl = detail;
    annotationRenderRevision += 1;
    contentEl$.next(detail);
  }

  function openFootnotePreview(target: ReaderTarget) {
    const previewHtml = getFootnotePreviewHtml(target);

    if (!previewHtml) {
      readerTargetNavigation$.next({ target });
      return;
    }

    footnotePreviewTarget = target;
    footnotePreviewHtml = previewHtml;
  }

  function closeFootnotePreview() {
    footnotePreviewHtml = '';
    footnotePreviewTarget = undefined;
  }

  function jumpToFootnotePreviewTarget() {
    if (footnotePreviewTarget) {
      readerTargetNavigation$.next({ target: footnotePreviewTarget });
    }

    closeFootnotePreview();
  }

  function getFootnotePreviewHtml(target: ReaderTarget) {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;

    const targetElement = findReaderTargetElement(tempContainer, target);
    const previewHtml = targetElement ? clonePreviewHtml(targetElement) : '';

    tempContainer.textContent = '';

    return previewHtml;
  }

  function clonePreviewHtml(element: Element) {
    const clone = element.cloneNode(true) as Element;

    [clone, ...Array.from(clone.querySelectorAll('[id],[name]'))].forEach((item) => {
      item.removeAttribute('id');
      item.removeAttribute('name');
    });

    return clone.outerHTML;
  }

  function isEditableEventTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  async function requestWakeLock() {
    if (
      destroyed ||
      wakeLockRequestInFlight ||
      (wakeLock && !wakeLock.released) ||
      typeof navigator === 'undefined' ||
      !('wakeLock' in navigator)
    ) {
      return;
    }

    wakeLockRequestInFlight = true;

    const nextWakeLock = await navigator.wakeLock.request().catch(({ message }) => {
      logger.error(`failed to request wakelock: ${message}`);

      return undefined;
    });

    wakeLockRequestInFlight = false;

    if (!nextWakeLock) {
      return;
    }

    if (destroyed || !$enableReaderWakeLock$ || visibilityState !== 'visible') {
      await nextWakeLock.release().catch(() => {
        // no-op
      });
      return;
    }

    wakeLock = nextWakeLock;
    wakeLock.addEventListener('release', releaseWakeLock, false);
  }

  async function releaseWakeLock() {
    const activeWakeLock = wakeLock;

    wakeLock = undefined;

    if (!activeWakeLock) {
      return;
    }

    activeWakeLock.removeEventListener('release', releaseWakeLock, false);

    if (!activeWakeLock.released) {
      await activeWakeLock.release().catch(() => {
        // no-op
      });
    }
  }

  function syncWakeLock(enabled: boolean, state: DocumentVisibilityState) {
    if (!enabled || state !== 'visible') {
      clearWakeLockRequestTimer();
      releaseWakeLock();
      return;
    }

    if (wakeLock || wakeLockRequestTimer || wakeLockRequestInFlight) {
      return;
    }

    wakeLockRequestTimer = setTimeout(() => {
      wakeLockRequestTimer = undefined;
      requestWakeLock();
    }, 500);
  }

  function clearWakeLockRequestTimer() {
    if (!wakeLockRequestTimer) {
      return;
    }

    clearTimeout(wakeLockRequestTimer);
    wakeLockRequestTimer = undefined;
  }
</script>

{#if showBlurMessage}
  <div
    class="fixed top-12 right-4 p-2 border max-w-[90vw] z-[1]"
    style:writing-mode="horizontal-tb"
    style:color={fontColor}
    style:background-color={backgroundColor}
    style:border-color={fontColor}
  >
    The reader is currently blurred due to an external application (e. g. exstatic)
  </div>
{/if}
<div
  bind:this={$containerEl$}
  class={pxReader}
  style:padding-top="2.375rem"
  style:padding-bottom={`calc(2rem + ${bottomChromeClearance}px)`}
  use:hoverFocus={$hoverFocusEnabled$}
>
  {#if viewMode === ViewMode.Continuous}
    <BookReaderContinuous
      {htmlContent}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {verticalMode}
      {fontFeatureSettings}
      {verticalTextOrientation}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {selectionFontColor}
      {selectionBackgroundColor}
      {hintFuriganaFontColor}
      {hintFuriganaShadowColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginValue}
      {hideSpoilerImage}
      {hideFurigana}
      {furiganaStyle}
      {secondDimensionMaxValue}
      {firstDimensionMargin}
      {autoPositionOnResize}
      {autoBookmark}
      {autoBookmarkTime}
      {multiplier}
      loadingState={$imageLoadingState$ ?? true}
      bind:exploredCharCount
      bind:bookCharCount
      bind:bookmarkData
      bind:autoScroller
      bind:bookmarkManager
      bind:pageManager
      bind:sectionNavigator
      bind:customReadingPoint
      bind:customReadingPointTop
      bind:customReadingPointLeft
      bind:customReadingPointScrollOffset
      on:contentChange={handleContentChange}
      on:bookmark
      on:trackerPause
    />
  {:else}
    <BookReaderPaginated
      {htmlContent}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {verticalMode}
      {fontFeatureSettings}
      {verticalTextOrientation}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {selectionFontColor}
      {selectionBackgroundColor}
      {hintFuriganaFontColor}
      {hintFuriganaShadowColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginValue}
      {hideSpoilerImage}
      {hideFurigana}
      {furiganaStyle}
      loadingState={$imageLoadingState$ ?? true}
      {avoidPageBreak}
      {pageColumns}
      {paginationTransitionMode}
      {autoBookmark}
      {autoBookmarkTime}
      {firstDimensionMargin}
      bind:exploredCharCount
      bind:bookCharCount
      bind:isBookmarkScreen
      bind:bookmarkData
      bind:bookmarkManager
      bind:pageManager
      bind:sectionNavigator
      bind:customReadingPointRange
      bind:showCustomReadingPoint
      on:contentChange={handleContentChange}
      on:bookmark
      on:trackerPause
    />
  {/if}
</div>
{#if footnotePreviewHtml}
  <div
    class="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6"
    on:touchmove|stopPropagation={() => {}}
    on:wheel|stopPropagation={() => {}}
  >
    <section
      class="mx-auto max-h-[45vh] max-w-3xl overflow-hidden rounded-t-lg border shadow-2xl"
      role="dialog"
      aria-label="Footnote"
      style:color={fontColor}
      style:background-color={backgroundColor}
      style:border-color={fontColor}
    >
      <div
        class="flex items-center justify-between border-b px-4 py-2"
        style:border-color={fontColor}
      >
        <div class="text-sm font-semibold">Footnote</div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded px-3 py-2 opacity-80 hover:opacity-100"
            title="Jump to Footnote"
            aria-label="Jump to Footnote"
            on:click={jumpToFootnotePreviewTarget}
          >
            <Fa icon={faArrowUpRightFromSquare} />
          </button>
          <button
            type="button"
            class="rounded px-3 py-2 opacity-80 hover:opacity-100"
            title="Close Footnote"
            aria-label="Close Footnote"
            on:click={closeFootnotePreview}
          >
            <Fa icon={faXmark} />
          </button>
        </div>
      </div>
      <div
        class="max-h-[calc(45vh-3rem)] overflow-auto overscroll-contain px-4 py-3"
        style:font-family="var(--font-family-serif, 'Lora', 'Noto Serif JP', serif)"
        style:font-size="{fontSize}px"
        style:line-height={lineHeight}
        on:touchmove|stopPropagation={() => {}}
        on:wheel|stopPropagation={() => {}}
      >
        {@html footnotePreviewHtml}
      </div>
    </section>
  </div>
{/if}
<BookAnnotationsRenderer
  {contentEl}
  {annotations}
  {activeAnnotationId}
  editAnnotationId={activeAnnotationEditId}
  {annotationPopoverResetKey}
  {fontColor}
  {backgroundColor}
  renderRevision={annotationRenderRevision}
  on:activate={({ detail }) => dispatch('annotationActivate', detail)}
  on:update={({ detail }) => dispatch('annotationUpdate', detail)}
  on:delete={({ detail }) => dispatch('annotationDelete', detail)}
/>
{$blurListener$ ?? ''}
{$reactiveElements$ ?? ''}
{$hoverFocusKeybind$ ?? ''}
{$footnoteRequest$ ?? ''}
<svelte:document bind:visibilityState />
