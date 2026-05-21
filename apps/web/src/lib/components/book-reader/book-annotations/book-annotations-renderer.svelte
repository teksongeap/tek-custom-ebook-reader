<script lang="ts">
  import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faPen,
    faTrash,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import {
    clearAnnotationHighlights,
    getAnnotationClientRect,
    renderAnnotationHighlights,
    type RenderedAnnotationSpan
  } from './annotation-range';
  import { getAnnotationColorValue } from './annotation-colors';
  import { formatAnnotationTimestamp, getAnnotationEditedAt } from './annotation-time';
  import AnnotationLinkifiedText from './annotation-linkified-text.svelte';

  export let contentEl: HTMLElement | undefined;
  export let annotations: BooksDbAnnotation[] = [];
  export let activeAnnotationId = '';
  export let editAnnotationId = '';
  export let fontColor = '';
  export let backgroundColor = '';
  export let renderRevision = 0;
  export let annotationPopoverResetKey = 0;

  const dispatch = createEventDispatcher<{
    activate: string;
    update: { annotation: BooksDbAnnotation; comment: string };
    delete: BooksDbAnnotation;
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
  let handledEditAnnotationId = '';
  let pendingLocalActivationId = '';
  let editingAnnotationId = '';
  let draftComment = '';
  let draftTextAreaEl: HTMLTextAreaElement | undefined;
  let observedDraftTextAreaEl: HTMLTextAreaElement | undefined;
  let draftTextAreaResizeObserver: ResizeObserver | undefined;
  let editingPopoverWidth = 0;
  let editingPopoverMinWidth = 0;
  let editingPopoverHeight = 0;
  let editingPopoverLeft: number | undefined;
  let editingPopoverTop: number | undefined;
  let isEditing = false;
  let commentEl: HTMLElement | undefined;
  let commentCanExpand = false;
  let isCommentExpanded = false;
  const cleanupBySpan = new WeakMap<HTMLSpanElement, () => void>();

  $: annotationKey = annotations
    .map((annotation) => `${annotation.id}:${annotation.updatedAt}`)
    .join('|');

  $: if (contentEl && annotationKey !== undefined && renderRevision >= 0) {
    redrawAnnotations();
  }

  $: if (pendingLocalActivationId && activeAnnotationId === pendingLocalActivationId) {
    pendingLocalActivationId = '';
  }

  $: if (
    activeAnnotationId &&
    activeAnnotationId !== handledActiveAnnotationId &&
    !pendingLocalActivationId
  ) {
    const nextAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId);

    if (nextAnnotation) {
      handledActiveAnnotationId = activeAnnotationId;
      openAnnotation(nextAnnotation, true);
    }
  }

  $: if (editAnnotationId && editAnnotationId !== handledEditAnnotationId) {
    const nextAnnotation = annotations.find((annotation) => annotation.id === editAnnotationId);

    if (nextAnnotation) {
      handledEditAnnotationId = editAnnotationId;
      void openAnnotationForEditing(nextAnnotation);
    }
  }

  $: if (annotationPopoverResetKey !== previousAnnotationPopoverResetKey) {
    previousAnnotationPopoverResetKey = annotationPopoverResetKey;
    if (isEditing) {
      void saveActiveAnnotation(true);
    } else {
      closeAnnotationCard();
    }
  }

  $: isEditing = !!activeAnnotation && editingAnnotationId === activeAnnotation.id;
  $: syncDraftTextAreaResizeObserver(draftTextAreaEl, isEditing);

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
    disconnectDraftTextAreaResizeObserver();
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
        await updateCommentExpansionState();
      }
    }
  }

  function attachSpanListeners(annotation: BooksDbAnnotation, span: HTMLSpanElement) {
    const pointerEnter = () => openAnnotation(annotation, false);
    const pointerLeave = () => scheduleClose();
    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void openAnnotation(annotation, true);
    };
    const doubleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void openAnnotationForEditing(annotation);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      void openAnnotation(annotation, true);
    };

    span.addEventListener('pointerenter', pointerEnter, false);
    span.addEventListener('pointerleave', pointerLeave, false);
    span.addEventListener('click', click, false);
    span.addEventListener('dblclick', doubleClick, false);
    span.addEventListener('keydown', keydown, false);

    cleanupBySpan.set(span, () => {
      span.removeEventListener('pointerenter', pointerEnter, false);
      span.removeEventListener('pointerleave', pointerLeave, false);
      span.removeEventListener('click', click, false);
      span.removeEventListener('dblclick', doubleClick, false);
      span.removeEventListener('keydown', keydown, false);
    });
  }

  function detachSpanListeners() {
    renderedSpans.forEach(({ span }) => cleanupBySpan.get(span)?.());
    renderedSpans = [];
  }

  async function openAnnotation(annotation: BooksDbAnnotation, pinned: boolean) {
    if (!pinned && isPinned) {
      window.clearTimeout(closeTimer);
      return;
    }

    if (editingAnnotationId) {
      if (!pinned || editingAnnotationId === annotation.id) {
        return;
      }

      await saveActiveAnnotation(true);
    }

    window.clearTimeout(closeTimer);

    activeAnnotation = annotation;
    isPinned = pinned;
    isCommentExpanded = false;
    commentCanExpand = false;
    popoverReady = false;
    popoverStyle = getBasePopoverStyle(annotation, true);

    if (pinned) {
      activateAnnotation(annotation.id);
    }

    updateActiveHighlight();

    await tick();
    await updatePopoverPosition();
    await updateCommentExpansionState();

    if (pinned) {
      document.removeEventListener('pointerdown', closePinnedPopover, true);
      document.addEventListener('pointerdown', closePinnedPopover, true);
    }
  }

  async function openAnnotationForEditing(annotation: BooksDbAnnotation) {
    await openAnnotation(annotation, true);
    await editActiveAnnotation();
  }

  async function updatePopoverPosition({ preserveTop = false } = {}) {
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
    const maxWidth = getPopoverMaxWidth(viewportWidth);
    const popoverRect = popoverEl.getBoundingClientRect();
    const editingWidth = Math.max(editingPopoverWidth, editingPopoverMinWidth);
    const nextEditingWidth =
      isEditing && editingWidth ? Math.min(maxWidth, editingWidth) : undefined;
    const nextEditingHeight = isEditing && editingPopoverHeight ? editingPopoverHeight : undefined;
    const width = nextEditingWidth || Math.min(maxWidth, popoverRect.width || maxWidth);
    const height = Math.max(nextEditingHeight || 0, popoverRect.height || 140);
    const anchorCenterX = rect.left + rect.width / 2;
    const hasRoomAbove = rect.top - viewportTop > height + gap + 12;
    const anchoredTop = hasRoomAbove
      ? rect.top - height - gap
      : Math.min(viewportTop + viewportHeight - height - 12, rect.bottom + gap);
    const top =
      isEditing && editingPopoverTop !== undefined
        ? limitToRange(
            viewportTop + 12,
            viewportTop + viewportHeight - height - 12,
            editingPopoverTop
          )
        : preserveTop && popoverReady
          ? limitToRange(
              viewportTop + 12,
              viewportTop + viewportHeight - height - 12,
              popoverRect.top
            )
          : anchoredTop;
    const left =
      isEditing && editingPopoverLeft !== undefined
        ? limitToRange(
            viewportLeft + 12,
            viewportLeft + viewportWidth - width - 12,
            editingPopoverLeft
          )
        : limitToRange(
            viewportLeft + 12,
            viewportLeft + viewportWidth - width - 12,
            anchorCenterX - width / 2
          );

    popoverStyle = [
      getBasePopoverStyle(activeAnnotation, false),
      `top: ${top}px`,
      `left: ${left}px`,
      `--annotation-popover-max-width: ${maxWidth}px`,
      `max-width: ${maxWidth}px`,
      nextEditingWidth ? `width: ${nextEditingWidth}px` : '',
      nextEditingHeight ? `height: ${nextEditingHeight}px` : ''
    ].join('; ');
    popoverReady = true;
  }

  function getPopoverMaxWidth(viewportWidth: number) {
    const viewportWidthWithMargin = Math.max(0, viewportWidth - 24);

    if (!isCommentExpanded && !isEditing) {
      return Math.min(360, viewportWidthWithMargin);
    }

    const contentWidth = contentEl?.getBoundingClientRect().width || 544;

    return Math.min(Math.max(360, contentWidth), 544, viewportWidthWithMargin);
  }

  function scheduleClose() {
    if (isPinned || editingAnnotationId) {
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
    const clickedPopover =
      target instanceof Element ? target.closest('[data-ttu-annotation-card]') : null;
    const clickedAnyHighlight =
      target instanceof Element ? target.closest('[data-ttu-annotation-id]') : null;
    const clickedHighlight =
      clickedAnyHighlight?.getAttribute('data-ttu-annotation-id') === activeAnnotation.id;

    if (clickedPopover || clickedHighlight) {
      return;
    }

    if (isEditing) {
      if (clickedAnyHighlight) {
        return;
      }

      void saveActiveAnnotation(true);
      return;
    }

    closeAnnotationCard();
  }

  function closeAnnotationCard() {
    activeAnnotation = undefined;
    isPinned = false;
    popoverReady = false;
    editingAnnotationId = '';
    draftComment = '';
    editingPopoverWidth = 0;
    editingPopoverMinWidth = 0;
    editingPopoverHeight = 0;
    editingPopoverLeft = undefined;
    editingPopoverTop = undefined;
    isCommentExpanded = false;
    commentCanExpand = false;
    updateActiveHighlight();
    document.removeEventListener('pointerdown', closePinnedPopover, true);
  }

  async function editActiveAnnotation() {
    if (!activeAnnotation) {
      return;
    }

    window.clearTimeout(closeTimer);

    const annotationId = activeAnnotation.id;
    const preserveExpandedLayout = isCommentExpanded || commentCanExpand;

    if (preserveExpandedLayout && !isCommentExpanded) {
      isCommentExpanded = true;
      isPinned = true;
      activateAnnotation(annotationId);
      await tick();

      if (!activeAnnotation || activeAnnotation.id !== annotationId) {
        return;
      }

      await updatePopoverPosition({ preserveTop: true });
    }

    const expandedPopoverRect = preserveExpandedLayout
      ? popoverEl?.getBoundingClientRect()
      : undefined;

    editingAnnotationId = activeAnnotation.id;
    draftComment = activeAnnotation.comment;
    editingPopoverWidth = expandedPopoverRect?.width || 0;
    editingPopoverMinWidth = expandedPopoverRect?.width || 0;
    editingPopoverHeight = expandedPopoverRect?.height || 0;
    editingPopoverLeft = expandedPopoverRect?.left;
    editingPopoverTop = expandedPopoverRect?.top;
    isCommentExpanded = false;
    isPinned = true;
    activateAnnotation(activeAnnotation.id);

    document.removeEventListener('pointerdown', closePinnedPopover, true);
    document.addEventListener('pointerdown', closePinnedPopover, true);

    await tick();
    draftTextAreaEl?.focus();
    if (!editingPopoverWidth) {
      updateEditingPopoverWidth();
    }
    await updatePopoverPosition({ preserveTop: preserveExpandedLayout });
  }

  async function saveActiveAnnotation(closeAfterSave = false) {
    if (!activeAnnotation) {
      return;
    }

    const annotation = activeAnnotation;
    const comment = draftComment.trim();
    editingAnnotationId = '';
    draftComment = '';
    editingPopoverWidth = 0;
    editingPopoverMinWidth = 0;
    editingPopoverHeight = 0;
    editingPopoverLeft = undefined;
    editingPopoverTop = undefined;

    if (comment !== annotation.comment) {
      dispatch('update', { annotation, comment });
    }

    if (closeAfterSave) {
      closeAnnotationCard();
      return;
    }

    await tick();
    await updatePopoverPosition();
  }

  function cancelActiveEdit() {
    closeAnnotationCard();
  }

  async function updateCommentExpansionState() {
    const annotationId = activeAnnotation?.id;

    if (!activeAnnotation?.comment || isEditing || isCommentExpanded) {
      return;
    }

    await tick();

    if (!activeAnnotation || activeAnnotation.id !== annotationId || !commentEl) {
      return;
    }

    const nextCanExpand = commentEl.scrollHeight > commentEl.clientHeight + 1;

    if (commentCanExpand !== nextCanExpand) {
      commentCanExpand = nextCanExpand;
      await tick();
      await updatePopoverPosition();
    }
  }

  async function toggleCommentExpanded() {
    if (!activeAnnotation) {
      return;
    }

    isCommentExpanded = !isCommentExpanded;

    if (isCommentExpanded) {
      isPinned = true;
      activateAnnotation(activeAnnotation.id);
      document.removeEventListener('pointerdown', closePinnedPopover, true);
      document.addEventListener('pointerdown', closePinnedPopover, true);
    }

    await tick();
    await updatePopoverPosition({ preserveTop: isCommentExpanded });
  }

  function handleDraftCommentKeydown(event: KeyboardEvent) {
    event.stopPropagation();

    if (
      event.key === 'Delete' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.isComposing &&
      !draftComment.trim()
    ) {
      event.preventDefault();
      deleteActiveAnnotation();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();
    void saveActiveAnnotation(true);
  }

  function deleteActiveAnnotation() {
    if (!activeAnnotation) {
      return;
    }

    const annotation = activeAnnotation;
    closeAnnotationCard();
    dispatch('delete', annotation);
  }

  function updateActiveHighlight() {
    renderedSpans.forEach(({ annotation, span }) => {
      span.classList.toggle(
        'book-annotation-highlight--active',
        annotation.id === activeAnnotation?.id
      );
    });
  }

  function activateAnnotation(annotationId: string) {
    pendingLocalActivationId = annotationId;
    activeAnnotationId = annotationId;
    handledActiveAnnotationId = annotationId;
    dispatch('activate', annotationId);
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

  function syncDraftTextAreaResizeObserver(
    element: HTMLTextAreaElement | undefined,
    shouldObserve: boolean
  ) {
    if (!shouldObserve || !element || typeof ResizeObserver === 'undefined') {
      disconnectDraftTextAreaResizeObserver();
      return;
    }

    if (observedDraftTextAreaEl === element) {
      return;
    }

    disconnectDraftTextAreaResizeObserver();
    observedDraftTextAreaEl = element;
    draftTextAreaResizeObserver = new ResizeObserver(() => {
      updateEditingPopoverWidth();
      void updatePopoverPosition({ preserveTop: true });
    });
    draftTextAreaResizeObserver.observe(element);
    if (!editingPopoverWidth) {
      updateEditingPopoverWidth();
    }
  }

  function disconnectDraftTextAreaResizeObserver() {
    draftTextAreaResizeObserver?.disconnect();
    draftTextAreaResizeObserver = undefined;
    observedDraftTextAreaEl = undefined;
  }

  function updateEditingPopoverWidth() {
    if (!draftTextAreaEl || !popoverEl || !isEditing) {
      return;
    }

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const maxWidth = getPopoverMaxWidth(viewportWidth);
    const popoverComputedStyle = window.getComputedStyle(popoverEl);
    const horizontalPadding =
      parseFloat(popoverComputedStyle.paddingLeft || '0') +
      parseFloat(popoverComputedStyle.paddingRight || '0');
    const minWidth = Math.min(editingPopoverMinWidth || 360, maxWidth);
    const nextWidth = limitToRange(
      minWidth,
      maxWidth,
      draftTextAreaEl.getBoundingClientRect().width + horizontalPadding
    );

    if (Math.abs(nextWidth - editingPopoverWidth) > 0.5) {
      editingPopoverWidth = nextWidth;
    }
  }
</script>

{#if activeAnnotation}
  <div
    data-ttu-annotation-card
    bind:this={popoverEl}
    class="book-annotation-card writing-horizontal-tb fixed z-40"
    class:book-annotation-card--editing={isEditing}
    class:book-annotation-card--expanded={isCommentExpanded}
    style={popoverStyle}
    on:pointerenter={() => window.clearTimeout(closeTimer)}
    on:pointerleave={scheduleClose}
    on:touchmove|stopPropagation={() => {}}
    on:wheel|stopPropagation={() => {}}
  >
    <div class="book-annotation-card-accent" aria-hidden="true"></div>
    <div class="book-annotation-card-header">
      <span class="book-annotation-card-heading">
        <span class="book-annotation-card-title">
          Added {formatAnnotationTimestamp(activeAnnotation.createdAt)}
        </span>
        {#if getAnnotationEditedAt(activeAnnotation)}
          <span class="book-annotation-card-edited">
            Edited {formatAnnotationTimestamp(getAnnotationEditedAt(activeAnnotation))}
          </span>
        {/if}
      </span>
      {#if !isEditing}
        <span class="book-annotation-card-actions">
          <button
            type="button"
            class="book-annotation-card-action book-annotation-card-action--labeled"
            title="Edit annotation"
            aria-label="Edit annotation"
            on:click|stopPropagation={editActiveAnnotation}
          >
            <span>Edit</span>
            <Fa icon={faPen} />
          </button>
        </span>
      {:else}
        <span class="book-annotation-card-actions">
          <button
            type="button"
            class="book-annotation-card-action"
            title="Cancel editing"
            aria-label="Cancel editing"
            on:click|stopPropagation={cancelActiveEdit}
          >
            <Fa icon={faXmark} />
          </button>
        </span>
      {/if}
    </div>
    {#if isEditing}
      <div class="book-annotation-card-editor">
        <textarea
          bind:this={draftTextAreaEl}
          class="book-annotation-card-textarea"
          bind:value={draftComment}
          rows="3"
          placeholder="Add an optional comment"
          on:keydown={handleDraftCommentKeydown}
        ></textarea>
        <div class="book-annotation-card-editor-actions">
          <button
            type="button"
            class="book-annotation-card-editor-action book-annotation-card-editor-action--danger"
            title="Delete annotation"
            aria-label="Delete annotation"
            on:click|stopPropagation={deleteActiveAnnotation}
          >
            <Fa icon={faTrash} />
          </button>
          <span class="book-annotation-card-editor-primary-actions">
            <button
              type="button"
              class="book-annotation-card-editor-action book-annotation-card-editor-action--primary"
              title="Save annotation"
              aria-label="Save annotation"
              on:click|stopPropagation={() => saveActiveAnnotation()}
            >
              <span>Save</span>
              <Fa icon={faCheck} />
            </button>
          </span>
        </div>
      </div>
    {:else if activeAnnotation.comment}
      <div
        bind:this={commentEl}
        class="book-annotation-card-comment"
        class:book-annotation-card-comment--clamped={!isCommentExpanded}
        class:book-annotation-card-comment--expanded={isCommentExpanded}
      >
        <AnnotationLinkifiedText text={activeAnnotation.comment} />
      </div>
      {#if commentCanExpand}
        <button
          type="button"
          class="book-annotation-card-expand"
          aria-expanded={isCommentExpanded}
          on:click|stopPropagation={toggleCommentExpanded}
        >
          <span class="book-annotation-card-expand-label">
            {isCommentExpanded ? 'Show less' : 'Show more'}
          </span>
          <span class="book-annotation-card-expand-icon" aria-hidden="true">
            <Fa icon={isCommentExpanded ? faChevronUp : faChevronDown} />
          </span>
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style lang="scss">
  :global(.book-annotation-highlight) {
    --book-annotation-base: #f5c84b;
    border-radius: 0.18em;
    background: linear-gradient(
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
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--book-annotation-base) 64%, transparent) 0 72%,
      color-mix(in srgb, var(--book-annotation-base) 16%, transparent) 72%
    );
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 42%, transparent);
    filter: saturate(1.1);
  }

  :global(.book-content--writing-vertical-rl .book-annotation-highlight) {
    background: color-mix(in srgb, var(--book-annotation-base) 44%, transparent);
  }

  :global(.book-content--writing-vertical-rl .book-annotation-highlight:hover),
  :global(.book-content--writing-vertical-rl .book-annotation-highlight:focus-visible) {
    background: color-mix(in srgb, var(--book-annotation-base) 64%, transparent);
  }

  :global(.book-annotation-highlight--active) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 72%, transparent),
      0 8px 24px color-mix(in srgb, var(--book-annotation-base) 22%, transparent);
  }

  .book-annotation-card {
    box-sizing: border-box;
    width: min(22.5rem, var(--annotation-popover-max-width, calc(100vw - 1.5rem)));
    max-height: calc(100vh - 1.5rem);
    overflow: hidden;
    overscroll-behavior: contain;
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

  .book-annotation-card--expanded {
    width: var(--annotation-popover-max-width, min(34rem, calc(100vw - 1.5rem)));
  }

  .book-annotation-card--editing {
    display: flex;
    flex-direction: column;
    min-width: min(22.5rem, calc(100vw - 1.5rem));
  }

  .book-annotation-card-accent {
    position: absolute;
    inset: 0 auto 0 0;
    width: 0.25rem;
    background: var(--book-annotation-base);
  }

  .book-annotation-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    color: color-mix(in srgb, var(--reader-page-text) 72%, transparent);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.25;
  }

  .book-annotation-card-heading {
    display: inline-flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  .book-annotation-card-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .book-annotation-card-title,
  .book-annotation-card-edited {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-annotation-card-edited {
    color: color-mix(in srgb, var(--reader-page-text) 54%, transparent);
    font-size: 0.68rem;
    font-weight: 500;
  }

  .book-annotation-card-actions {
    flex: 0 0 auto;
  }

  .book-annotation-card-action {
    display: inline-flex;
    height: 1.75rem;
    width: 1.75rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.4rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 64%, transparent);
    font: inherit;
    outline: none;
  }

  .book-annotation-card-action--labeled {
    width: auto;
    min-width: 3.85rem;
    padding: 0 0.55rem;
  }

  .book-annotation-card-action:hover,
  .book-annotation-card-action:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 10%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-comment {
    margin-top: 0.75rem;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.45;
  }

  .book-annotation-card-comment--clamped {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .book-annotation-card-comment--expanded {
    max-height: min(20rem, calc(100vh - 14rem));
    overflow: auto;
    overscroll-behavior: contain;
    padding-right: 0.35rem;
  }

  .book-annotation-card-expand {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin-top: 0.65rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--book-annotation-base) 28%, transparent);
    border-radius: 0.55rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 15%, transparent),
        color-mix(in srgb, var(--reader-page-text) 6%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 78%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, #ffffff 13%, transparent),
      0 0 0 0 color-mix(in srgb, var(--book-annotation-base) 0%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 78%, var(--book-annotation-base));
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    outline: none;
    padding: 0.44rem 0.65rem;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      color 140ms ease,
      transform 140ms ease;
  }

  .book-annotation-card-expand:hover,
  .book-annotation-card-expand:focus-visible {
    border-color: color-mix(in srgb, var(--book-annotation-base) 56%, transparent);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 22%, transparent),
        color-mix(in srgb, var(--reader-page-text) 9%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 72%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, #ffffff 16%, transparent),
      0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 18%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-expand:active {
    transform: translateY(1px);
  }

  .book-annotation-card-expand-icon {
    display: inline-flex;
    align-items: center;
    color: var(--book-annotation-base);
    font-size: 0.72rem;
  }

  .book-annotation-card-editor {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    margin-top: 0.75rem;
  }

  .book-annotation-card-textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 4.75rem;
    min-width: min(
      calc(22.5rem - 1.75rem),
      calc(var(--annotation-popover-max-width, calc(100vw - 1.5rem)) - 1.75rem)
    );
    flex: 1 1 auto;
    max-width: calc(var(--annotation-popover-max-width, calc(100vw - 1.5rem)) - 1.75rem);
    resize: both;
    overscroll-behavior: contain;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 86%, transparent);
    color: var(--reader-page-text);
    font: inherit;
    font-size: 0.9rem;
    line-height: 1.35;
    outline: none;
    padding: 0.55rem 0.65rem;
  }

  .book-annotation-card-textarea:focus {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .book-annotation-card-editor-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.55rem;
  }

  .book-annotation-card-editor-primary-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .book-annotation-card-editor-action {
    display: inline-flex;
    height: 1.9rem;
    min-width: 1.9rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 0;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 68%, transparent);
    font: inherit;
    outline: none;
    padding: 0 0.55rem;
  }

  .book-annotation-card-editor-action:hover,
  .book-annotation-card-editor-action:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-editor-action--primary {
    min-width: 4.4rem;
    background: color-mix(in srgb, var(--app-accent) 18%, transparent);
    color: var(--app-accent);
  }

  .book-annotation-card-editor-action--primary:hover,
  .book-annotation-card-editor-action--primary:focus-visible {
    background: color-mix(in srgb, var(--app-accent) 26%, transparent);
    color: var(--app-accent);
  }

  .book-annotation-card-editor-action--danger {
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 56%, transparent);
  }

  .book-annotation-card-editor-action--danger:hover,
  .book-annotation-card-editor-action--danger:focus-visible {
    background: color-mix(in srgb, var(--app-danger) 14%, transparent);
    color: var(--app-danger);
  }
</style>
