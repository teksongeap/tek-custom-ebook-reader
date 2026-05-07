<script lang="ts">
  import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
  import {
    clearAnnotationHighlights,
    getAnnotationClientRect,
    renderAnnotationHighlights,
    type RenderedAnnotationSpan
  } from './annotation-range';
  import { getAnnotationColorValue } from './annotation-colors';

  export let contentEl: HTMLElement | undefined;
  export let annotations: BooksDbAnnotation[] = [];
  export let activeAnnotationId = '';
  export let fontColor = '';
  export let backgroundColor = '';
  export let renderRevision = 0;
  export let annotationPopoverResetKey = 0;

  const dispatch = createEventDispatcher<{
    activate: string;
  }>();

  let renderedSpans: RenderedAnnotationSpan[] = [];
  let activeAnnotation: BooksDbAnnotation | undefined;
  let popoverEl: HTMLElement | undefined;
  let closeTimer: number | undefined;
  let isPinned = false;
  let popoverStyle = '';
  let handledActiveAnnotationId = '';
  let popoverReady = false;
  let redrawToken = 0;
  let previousActiveAnnotationId = '';
  let previousAnnotationPopoverResetKey = annotationPopoverResetKey;
  const cleanupBySpan = new WeakMap<HTMLSpanElement, () => void>();

  $: annotationKey = annotations
    .map((annotation) => `${annotation.id}:${annotation.updatedAt}`)
    .join('|');

  $: if (contentEl && annotationKey !== undefined && renderRevision >= 0) {
    redrawAnnotations();
  }

  $: if (activeAnnotationId && activeAnnotationId !== handledActiveAnnotationId) {
    const nextAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId);

    if (nextAnnotation) {
      handledActiveAnnotationId = activeAnnotationId;
      openAnnotation(nextAnnotation, true);
    }
  }

  $: if (annotationPopoverResetKey !== previousAnnotationPopoverResetKey) {
    previousAnnotationPopoverResetKey = annotationPopoverResetKey;
    closeAnnotationCard();
  }

  $: {
    if (previousActiveAnnotationId && !activeAnnotationId) {
      closeAnnotationCard();
    }

    if (!activeAnnotationId) {
      handledActiveAnnotationId = '';
    }

    previousActiveAnnotationId = activeAnnotationId;
  }

  onDestroy(() => {
    detachSpanListeners();
    document.removeEventListener('pointerdown', closePinnedPopover, true);

    if (contentEl) {
      clearAnnotationHighlights(contentEl);
    }
  });

  async function redrawAnnotations() {
    if (!contentEl) {
      return;
    }

    const currentRedrawToken = ++redrawToken;

    await tick();

    if (!contentEl || currentRedrawToken !== redrawToken) {
      return;
    }

    detachSpanListeners();
    renderedSpans = renderAnnotationHighlights(document, contentEl, annotations);
    renderedSpans.forEach(({ annotation, span }) => attachSpanListeners(annotation, span));

    if (activeAnnotation) {
      activeAnnotation = annotations.find((annotation) => annotation.id === activeAnnotation?.id);

      if (activeAnnotation) {
        updateActiveHighlight();
        await updatePopoverPosition();
      }
    }
  }

  function attachSpanListeners(annotation: BooksDbAnnotation, span: HTMLSpanElement) {
    const pointerEnter = () => openAnnotation(annotation, false);
    const pointerLeave = () => scheduleClose();
    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openAnnotation(annotation, true);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      openAnnotation(annotation, true);
    };

    span.addEventListener('pointerenter', pointerEnter, false);
    span.addEventListener('pointerleave', pointerLeave, false);
    span.addEventListener('click', click, false);
    span.addEventListener('keydown', keydown, false);

    cleanupBySpan.set(span, () => {
      span.removeEventListener('pointerenter', pointerEnter, false);
      span.removeEventListener('pointerleave', pointerLeave, false);
      span.removeEventListener('click', click, false);
      span.removeEventListener('keydown', keydown, false);
    });
  }

  function detachSpanListeners() {
    renderedSpans.forEach(({ span }) => cleanupBySpan.get(span)?.());
    renderedSpans = [];
  }

  async function openAnnotation(annotation: BooksDbAnnotation, pinned: boolean) {
    window.clearTimeout(closeTimer);

    activeAnnotation = annotation;
    isPinned = pinned;
    popoverReady = false;
    popoverStyle = getBasePopoverStyle(annotation, true);

    if (pinned) {
      handledActiveAnnotationId = annotation.id;
      dispatch('activate', annotation.id);
    }

    updateActiveHighlight();

    await tick();
    await updatePopoverPosition();

    if (pinned) {
      document.removeEventListener('pointerdown', closePinnedPopover, true);
      document.addEventListener('pointerdown', closePinnedPopover, true);
    }
  }

  async function updatePopoverPosition() {
    if (!activeAnnotation || !popoverEl) {
      return;
    }

    const rect = getAnnotationClientRect(activeAnnotation.id);

    if (!rect) {
      popoverReady = false;
      return;
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const gap = 14;
    const maxWidth = Math.min(360, viewportWidth - 24);
    const popoverRect = popoverEl.getBoundingClientRect();
    const width = Math.min(maxWidth, popoverRect.width || maxWidth);
    const height = popoverRect.height || 140;
    const anchorCenterX = rect.left + rect.width / 2;
    const anchorCenterY = rect.top + rect.height / 2;
    const hasRoomAbove = rect.top - viewportTop > height + gap + 12;
    const top = hasRoomAbove
      ? rect.top - height - gap
      : Math.min(viewportTop + viewportHeight - height - 12, rect.bottom + gap);
    const left = limitToRange(
      viewportLeft + 12,
      viewportLeft + viewportWidth - width - 12,
      anchorCenterX - width / 2
    );

    popoverStyle = [
      getBasePopoverStyle(activeAnnotation, false),
      `top: ${top}px`,
      `left: ${left}px`,
      `max-width: ${maxWidth}px`
    ].join('; ');
    popoverReady = true;
  }

  function scheduleClose() {
    if (isPinned) {
      return;
    }

    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      closeAnnotationCard();
    }, 140);
  }

  function closePinnedPopover(event: PointerEvent) {
    if (!activeAnnotation) {
      return;
    }

    const target = event.target;
    const clickedPopover = target instanceof Element && target.closest('[data-ttu-annotation-card]');
    const clickedHighlight =
      target instanceof Element &&
      target.closest(`[data-ttu-annotation-id="${activeAnnotation.id}"]`);

    if (clickedPopover || clickedHighlight) {
      return;
    }

    closeAnnotationCard();
  }

  function closeAnnotationCard() {
    activeAnnotation = undefined;
    isPinned = false;
    popoverReady = false;
    updateActiveHighlight();
    document.removeEventListener('pointerdown', closePinnedPopover, true);
  }

  function updateActiveHighlight() {
    renderedSpans.forEach(({ annotation, span }) => {
      span.classList.toggle(
        'book-annotation-highlight--active',
        annotation.id === activeAnnotation?.id
      );
    });
  }

  function getBasePopoverStyle(annotation: BooksDbAnnotation, hidden: boolean) {
    return [
      `--book-annotation-base: ${getAnnotationColorValue(annotation.color)}`,
      `--reader-page-text: ${fontColor || 'var(--font-color)'}`,
      `--reader-page-bg: ${backgroundColor || 'var(--background-color)'}`,
      hidden ? 'visibility: hidden' : 'visibility: visible',
      hidden ? 'top: 0' : '',
      hidden ? 'left: 0' : ''
    ]
      .filter(Boolean)
      .join('; ');
  }

  function limitToRange(min: number, max: number, value: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
</script>

{#if activeAnnotation}
  <div
    data-ttu-annotation-card
    bind:this={popoverEl}
    class="book-annotation-card writing-horizontal-tb fixed z-40"
    style={popoverStyle}
    on:pointerenter={() => window.clearTimeout(closeTimer)}
    on:pointerleave={scheduleClose}
  >
    <div class="book-annotation-card-accent" aria-hidden="true"></div>
    <div class="book-annotation-card-header">
      <span class="book-annotation-card-icon"><Fa icon={faCommentDots} /></span>
      <span class="book-annotation-card-title">Annotation</span>
    </div>
    {#if activeAnnotation.comment}
      <div class="book-annotation-card-comment">{activeAnnotation.comment}</div>
    {/if}
    <div class="book-annotation-card-quote">{activeAnnotation.selectedText}</div>
  </div>
{/if}

<style lang="scss">
  :global(.book-annotation-highlight) {
    --book-annotation-base: #f5c84b;
    border-radius: 0.18em;
    background:
      linear-gradient(
        to top,
        color-mix(in srgb, var(--book-annotation-base) 44%, transparent) 0 62%,
        transparent 62%
      );
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    cursor: pointer;
    margin: 0 -0.02em;
    outline: none;
    padding: 0 0.02em;
    transition:
      background-color 140ms ease,
      box-shadow 140ms ease,
      filter 140ms ease;
  }

  :global(.book-annotation-highlight:hover),
  :global(.book-annotation-highlight:focus-visible) {
    background:
      linear-gradient(
        to top,
        color-mix(in srgb, var(--book-annotation-base) 64%, transparent) 0 72%,
        color-mix(in srgb, var(--book-annotation-base) 16%, transparent) 72%
      );
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 42%, transparent);
    filter: saturate(1.1);
  }

  :global(.book-annotation-highlight--active) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 72%, transparent),
      0 8px 24px color-mix(in srgb, var(--book-annotation-base) 22%, transparent);
  }

  .book-annotation-card {
    width: min(22.5rem, calc(100vw - 1.5rem));
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--book-annotation-base) 38%, var(--reader-page-text));
    border-radius: 0.75rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 24%, var(--reader-page-bg)),
        color-mix(in srgb, var(--reader-page-bg) 92%, transparent)
      ),
      var(--reader-page-bg);
    box-shadow:
      0 20px 48px rgba(5, 7, 10, 0.28),
      inset 0 1px 0 color-mix(in srgb, #ffffff 18%, transparent);
    color: var(--reader-page-text);
    padding: 0.875rem;
    backdrop-filter: blur(18px) saturate(135%);
  }

  .book-annotation-card-accent {
    position: absolute;
    inset: 0 auto 0 0;
    width: 0.25rem;
    background: var(--book-annotation-base);
  }

  .book-annotation-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: color-mix(in srgb, var(--reader-page-text) 72%, transparent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
  }

  .book-annotation-card-icon {
    color: var(--book-annotation-base);
  }

  .book-annotation-card-comment {
    margin-top: 0.75rem;
    white-space: pre-wrap;
    font-size: 0.95rem;
    font-weight: 520;
    line-height: 1.45;
  }

  .book-annotation-card-quote {
    margin-top: 0.75rem;
    max-height: 8rem;
    overflow: hidden;
    border-left: 2px solid color-mix(in srgb, var(--book-annotation-base) 72%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 66%, transparent);
    font-size: 0.82rem;
    line-height: 1.4;
    padding-left: 0.625rem;
  }
</style>
