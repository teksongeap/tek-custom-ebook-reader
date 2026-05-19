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
  import { clickOutside } from '$lib/functions/use-click-outside';

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
    const previewElement = targetElement ? getFootnotePreviewElement(targetElement) : undefined;
    const previewHtml = previewElement ? clonePreviewHtml(previewElement) : '';

    tempContainer.textContent = '';

    return previewHtml;
  }

  function getFootnotePreviewElement(element: Element) {
    const noteContainer = element.closest(
      '[role="doc-footnote"],[epub\\:type~="footnote"],[epub\\:type~="endnote"],.fnote,.footnote,.endnote,p,li,aside,div'
    );

    if (!noteContainer || noteContainer === element || element.tagName.toLowerCase() !== 'a') {
      return element;
    }

    return hasContainerTextBeyondMarker(noteContainer, element) ? noteContainer : element;
  }

  function hasContainerTextBeyondMarker(container: Element, marker: Element) {
    const containerText = normalizePreviewText(container.textContent || '');
    const markerText = normalizePreviewText(marker.textContent || '');

    return containerText.length > markerText.length;
  }

  function normalizePreviewText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function clonePreviewHtml(element: Element) {
    const clone = element.cloneNode(true) as Element;
    const clonedElements = [clone, ...Array.from(clone.querySelectorAll('*'))];

    clonedElements.forEach((item) => {
      item.removeAttribute('id');
      item.removeAttribute('name');
    });

    clonedElements
      .filter((item) => item.tagName.toLowerCase() === 'a')
      .forEach((item) => {
        const linkKind = item.getAttribute('data-ttu-link-kind');

        if (linkKind !== 'external') {
          item.removeAttribute('href');
          item.setAttribute('aria-disabled', 'true');
        }
      });

    return clone.outerHTML;
  }

  function handleFootnoteKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && footnotePreviewHtml) {
      event.preventDefault();
      closeFootnotePreview();
    }
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
    class="book-footnote-preview-root writing-horizontal-tb"
    class:book-footnote-preview-root--vertical={verticalMode}
    use:clickOutside={closeFootnotePreview}
    on:touchmove|stopPropagation={() => {}}
    on:wheel|stopPropagation={() => {}}
  >
    <section
      class="book-footnote-preview-card"
      role="dialog"
      aria-label="Footnote"
      style:color={fontColor}
      style:background-color={backgroundColor}
      style:border-color={fontColor}
    >
      <div class="book-footnote-preview-header" style:border-color={fontColor}>
        <div class="book-footnote-preview-title">Footnote</div>
        <div class="book-footnote-preview-actions">
          <button
            type="button"
            class="book-footnote-preview-action"
            title="Jump to Footnote"
            aria-label="Jump to Footnote"
            on:click={jumpToFootnotePreviewTarget}
          >
            <Fa icon={faArrowUpRightFromSquare} />
          </button>
          <button
            type="button"
            class="book-footnote-preview-action"
            title="Close Footnote"
            aria-label="Close Footnote"
            on:click={closeFootnotePreview}
          >
            <Fa icon={faXmark} />
          </button>
        </div>
      </div>
      <div
        class="book-footnote-preview-content"
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
<svelte:document bind:visibilityState on:keydown={handleFootnoteKeydown} />

<style lang="scss">
  .book-footnote-preview-root {
    pointer-events: none;
    position: fixed;
    inset: auto 0 0 0;
    z-index: 50;
    padding: 0 0.75rem 0.75rem;
  }

  .book-footnote-preview-root--vertical {
    right: auto;
    bottom: 1rem;
    left: 50%;
    width: min(48rem, calc(100vw - 2rem));
    transform: translateX(-50%);
    padding: 0;
  }

  .book-footnote-preview-card {
    pointer-events: auto;
    box-sizing: border-box;
    max-height: min(45vh, 26rem);
    max-width: 48rem;
    overflow: hidden;
    margin: 0 auto;
    border: 1px solid;
    border-radius: 0.75rem 0.75rem 0 0;
    box-shadow: 0 20px 52px rgba(5, 7, 10, 0.3);
  }

  .book-footnote-preview-root--vertical .book-footnote-preview-card {
    width: 100%;
    max-width: none;
    border-radius: 0.75rem;
  }

  .book-footnote-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid;
    padding: 0.5rem 0.85rem 0.5rem 1rem;
  }

  .book-footnote-preview-title {
    min-width: 0;
    overflow: hidden;
    font-size: 0.9rem;
    font-weight: 760;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-footnote-preview-actions {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.25rem;
  }

  .book-footnote-preview-action {
    display: inline-flex;
    height: 2rem;
    min-width: 2rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: inherit;
    opacity: 0.78;
    outline: none;
    padding: 0 0.55rem;
  }

  .book-footnote-preview-action:hover,
  .book-footnote-preview-action:focus-visible {
    background: color-mix(in srgb, currentColor 10%, transparent);
    opacity: 1;
  }

  .book-footnote-preview-content {
    max-height: calc(min(45vh, 26rem) - 3rem);
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0.85rem 1rem 1rem;
  }

  .book-footnote-preview-content :global(a[aria-disabled='true']) {
    cursor: default;
    text-decoration: none;
  }
</style>
