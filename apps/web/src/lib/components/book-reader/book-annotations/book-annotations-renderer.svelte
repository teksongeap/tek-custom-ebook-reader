<script lang="ts">
  import { BookReaderAvailableKeybind } from '$lib/data/book-reader-keybind';
  import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
  import { bookReaderKeybindMap$ } from '$lib/data/store';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import {
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
  import { getAnnotationHighlightKey } from './annotation-index';
  import { getAnnotationColorPurposeLabel, getAnnotationColorValue } from './annotation-colors';
  import { formatAnnotationTimestamp, getAnnotationEditedAt } from './annotation-time';
  import AnnotationLinkifiedText from './annotation-linkified-text.svelte';
  import AnnotationSaveReturnIcon from './annotation-save-return-icon.svelte';
  import {
    annotationCommentCollapsedLineCount,
    hasAnnotationCommentOverflow,
    shouldOfferAnnotationCommentExpansionBeforeMeasurement
  } from './annotation-comment-expansion';

  export let contentEl: HTMLElement | undefined;
  export let annotations: ReadonlyArray<BooksDbAnnotation> = [];
  export let annotationsById: ReadonlyMap<string, BooksDbAnnotation> = new Map();
  export let activeAnnotationId = '';
  export let editAnnotationId = '';
  export let fontSize = 20;
  export let fontColor = '';
  export let backgroundColor = '';
  export let renderRevision = 0;
  export let annotationPopoverResetKey = 0;
  export let annotationHoverEnabled = true;
  export let annotationHoverDelay = 240;

  const dispatch = createEventDispatcher<{
    activate: string;
    update: { annotation: BooksDbAnnotation; comment: string; isInitialComment?: boolean };
    delete: BooksDbAnnotation;
    editHandled: string;
  }>();

  let renderedSpans: RenderedAnnotationSpan[] = [];
  let activeAnnotation: BooksDbAnnotation | undefined;
  let popoverEl: HTMLElement | undefined;
  let focusReturnEl: HTMLElement | undefined;
  let closeTimer: number | undefined;
  let hoverOpenTimer: number | undefined;
  let isPinned = false;
  let popoverStyle = '';
  let handledActiveAnnotationId = '';
  let popoverReady = false;
  let redrawToken = 0;
  let previousActiveAnnotationId = '';
  let previousAnnotationPopoverResetKey = annotationPopoverResetKey;
  let handledEditAnnotationId = '';
  let initialCommentEditAnnotationId = '';
  let pendingLocalActivationId = '';
  let editingAnnotationId = '';
  let draftComment = '';
  let draftTextAreaEl: HTMLTextAreaElement | undefined;
  let manualPopoverLeft: number | undefined;
  let manualPopoverTop: number | undefined;
  let editingPopoverWidth = 0;
  let editingPopoverHeight = 0;
  let isEditingPopoverManuallySized = false;
  let isAnnotationPopoverDragging = false;
  let isEditing = false;
  let commentEl: HTMLElement | undefined;
  let commentCanExpand = false;
  let isCommentExpanded = false;
  let hoveredAnnotationId = '';
  const cleanupBySpan = new WeakMap<HTMLSpanElement, () => void>();
  const draftTextAreaMinHeight = 38;
  const editingPopoverMinHeight = 164;
  const collapsedCommentLineCount = annotationCommentCollapsedLineCount;

  $: renderedAnnotationIds = new Set(annotations.map((annotation) => annotation.id));
  $: annotationKey = JSON.stringify(annotations.map(getAnnotationHighlightKey));
  $: commentCanExpandBeforeMeasurement = activeAnnotation?.comment
    ? shouldOfferAnnotationCommentExpansionBeforeMeasurement(
        activeAnnotation.comment,
        collapsedCommentLineCount
      )
    : false;

  $: if (contentEl && annotationKey !== undefined && renderRevision >= 0) {
    redrawAnnotations();
  }

  $: if (pendingLocalActivationId && activeAnnotationId === pendingLocalActivationId) {
    pendingLocalActivationId = '';
  }

  $: if (
    activeAnnotationId &&
    activeAnnotationId !== handledActiveAnnotationId &&
    !pendingLocalActivationId &&
    renderedAnnotationIds.has(activeAnnotationId)
  ) {
    const nextAnnotation = annotationsById.get(activeAnnotationId);

    if (nextAnnotation) {
      handledActiveAnnotationId = activeAnnotationId;
      openAnnotation(nextAnnotation, true);
    }
  }

  $: if (
    editAnnotationId &&
    editAnnotationId !== handledEditAnnotationId &&
    renderedAnnotationIds.has(editAnnotationId)
  ) {
    const nextAnnotation = annotationsById.get(editAnnotationId);

    if (nextAnnotation) {
      handledEditAnnotationId = editAnnotationId;
      initialCommentEditAnnotationId = isPendingInitialCommentEdit(nextAnnotation)
        ? editAnnotationId
        : '';
      dispatch('editHandled', editAnnotationId);
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
  $: if (activeAnnotation && !isEditing) {
    const nextActiveAnnotation = renderedAnnotationIds.has(activeAnnotation.id)
      ? annotationsById.get(activeAnnotation.id)
      : undefined;

    if (nextActiveAnnotation && nextActiveAnnotation !== activeAnnotation) {
      void refreshActiveAnnotation(nextActiveAnnotation);
    }
  }
  $: if (isEditing && draftComment !== undefined) {
    void fitDraftTextAreaToComment();
  }

  $: if (!contentEl && activeAnnotation) {
    if (isEditing && annotationsById.has(activeAnnotation.id)) {
      void saveActiveAnnotation(true);
    } else {
      closeAnnotationCard();
    }
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

  $: if (!annotationHoverEnabled && typeof window !== 'undefined') {
    window.clearTimeout(hoverOpenTimer);

    if (hoveredAnnotationId) {
      hoveredAnnotationId = '';
      updateActiveHighlight();
    }

    if (activeAnnotation && !isPinned && !editingAnnotationId) {
      closeAnnotationCard();
    }
  }

  onDestroy(() => {
    window.clearTimeout(hoverOpenTimer);
    window.clearTimeout(closeTimer);
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
      const nextActiveAnnotation = renderedAnnotationIds.has(activeAnnotation.id)
        ? annotationsById.get(activeAnnotation.id)
        : undefined;

      if (!nextActiveAnnotation) {
        if (isEditing && annotationsById.has(activeAnnotation.id)) {
          await saveActiveAnnotation(true);
        } else {
          closeAnnotationCard();
        }
        return;
      }

      activeAnnotation = nextActiveAnnotation;
      updateActiveHighlight();
      await updatePopoverPosition();
      await updateCommentExpansionState();
    }
  }

  async function refreshActiveAnnotation(annotation: BooksDbAnnotation) {
    activeAnnotation = annotation;

    await tick();

    if (activeAnnotation !== annotation) {
      return;
    }

    await updatePopoverPosition();
    await updateCommentExpansionState();
  }

  function attachSpanListeners(annotation: BooksDbAnnotation, span: HTMLSpanElement) {
    const getCurrentAnnotation = () => annotationsById.get(annotation.id);
    const pointerEnter = () => {
      const currentAnnotation = getCurrentAnnotation();

      if (currentAnnotation) {
        queueHoverOpen(currentAnnotation);
      }
    };
    const pointerLeave = () => clearHoverOpen(annotation);
    const click = (event: MouseEvent) => {
      const currentAnnotation = getCurrentAnnotation();

      if (!currentAnnotation) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openAnnotation(currentAnnotation, true, span);
    };
    const doubleClick = (event: MouseEvent) => {
      const currentAnnotation = getCurrentAnnotation();

      if (!currentAnnotation) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openAnnotationForEditing(currentAnnotation, span);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const currentAnnotation = getCurrentAnnotation();

      if (!currentAnnotation) {
        return;
      }

      event.preventDefault();
      void openAnnotation(currentAnnotation, true, span);
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

  async function openAnnotation(
    annotation: BooksDbAnnotation,
    pinned: boolean,
    triggerEl?: HTMLElement
  ) {
    window.clearTimeout(hoverOpenTimer);

    if (!pinned && isPinned) {
      window.clearTimeout(closeTimer);
      return;
    }

    if (activeAnnotation?.id !== annotation.id) {
      resetManualPopoverPosition();
    }

    if (editingAnnotationId) {
      if (!pinned || editingAnnotationId === annotation.id) {
        return;
      }

      await saveActiveAnnotation(true);
    }

    window.clearTimeout(closeTimer);

    const preserveExpandedState =
      pinned && activeAnnotation?.id === annotation.id && isCommentExpanded;
    const preserveCommentCanExpand = preserveExpandedState && commentCanExpand;

    activeAnnotation = annotation;
    isPinned = pinned;
    focusReturnEl = pinned ? triggerEl : undefined;
    isCommentExpanded = preserveExpandedState;
    commentCanExpand =
      shouldOfferAnnotationCommentExpansionBeforeMeasurement(
        annotation.comment,
        collapsedCommentLineCount
      ) || preserveCommentCanExpand;
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
      popoverEl?.focus({ preventScroll: true });
      document.removeEventListener('pointerdown', closePinnedPopover, true);
      document.addEventListener('pointerdown', closePinnedPopover, true);
    }
  }

  function queueHoverOpen(annotation: BooksDbAnnotation) {
    if (!annotationHoverEnabled) {
      return;
    }

    hoveredAnnotationId = annotation.id;
    updateActiveHighlight();

    window.clearTimeout(closeTimer);
    window.clearTimeout(hoverOpenTimer);

    if (isPinned || editingAnnotationId) {
      return;
    }

    hoverOpenTimer = window.setTimeout(() => {
      hoverOpenTimer = undefined;

      if (hoveredAnnotationId !== annotation.id) {
        return;
      }

      const currentAnnotation = renderedAnnotationIds.has(annotation.id)
        ? annotationsById.get(annotation.id)
        : undefined;

      if (currentAnnotation) {
        void openAnnotation(currentAnnotation, false);
      }
    }, getAnnotationHoverDelay());
  }

  function clearHoverOpen(annotation: BooksDbAnnotation) {
    if (!annotationHoverEnabled) {
      return;
    }

    window.clearTimeout(hoverOpenTimer);

    if (hoveredAnnotationId === annotation.id) {
      hoveredAnnotationId = '';
      updateActiveHighlight();
    }

    scheduleClose();
  }

  async function openAnnotationForEditing(annotation: BooksDbAnnotation, triggerEl?: HTMLElement) {
    await openAnnotation(annotation, true, triggerEl);
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
    const { minHeight, maxHeight } = getEditingPopoverSizeBounds(viewportWidth, viewportHeight);
    const nextEditingWidth =
      isEditing && editingPopoverWidth ? Math.min(maxWidth, editingPopoverWidth) : undefined;
    const nextEditingHeight =
      isEditing && editingPopoverHeight
        ? limitToRange(minHeight, maxHeight, editingPopoverHeight)
        : undefined;
    const measuredWidth = Math.min(maxWidth, popoverRect.width || maxWidth);
    const width = nextEditingWidth || (isCommentExpanded && !isEditing ? maxWidth : measuredWidth);
    const fallbackHeight = isEditing && isEditingPopoverManuallySized ? minHeight : 140;
    const height = nextEditingHeight || popoverRect.height || fallbackHeight;
    const anchorCenterX = rect.left + rect.width / 2;
    const hasRoomAbove = rect.top - viewportTop > height + gap + 12;
    const anchoredTop = hasRoomAbove
      ? rect.top - height - gap
      : Math.min(viewportTop + viewportHeight - height - 12, rect.bottom + gap);
    const top =
      manualPopoverTop !== undefined
        ? limitToRange(
            viewportTop + 12,
            viewportTop + viewportHeight - height - 12,
            manualPopoverTop
          )
        : preserveTop && popoverReady
          ? limitToRange(
              viewportTop + 12,
              viewportTop + viewportHeight - height - 12,
              popoverRect.top
            )
          : anchoredTop;
    const left =
      manualPopoverLeft !== undefined
        ? limitToRange(
            viewportLeft + 12,
            viewportLeft + viewportWidth - width - 12,
            manualPopoverLeft
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
      `max-height: ${maxHeight}px`,
      isEditing ? `--annotation-popover-min-height: ${minHeight}px` : '',
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

  function closeAnnotationCard(restoreFocus = false) {
    window.clearTimeout(hoverOpenTimer);
    window.clearTimeout(closeTimer);
    const returnFocusEl = focusReturnEl;
    focusReturnEl = undefined;
    if (activeAnnotation?.id === initialCommentEditAnnotationId) {
      initialCommentEditAnnotationId = '';
    }
    activeAnnotation = undefined;
    isPinned = false;
    popoverReady = false;
    editingAnnotationId = '';
    draftComment = '';
    editingPopoverWidth = 0;
    editingPopoverHeight = 0;
    resetManualPopoverPosition();
    isEditingPopoverManuallySized = false;
    isCommentExpanded = false;
    commentCanExpand = false;
    hoveredAnnotationId = '';
    updateActiveHighlight();
    document.removeEventListener('pointerdown', closePinnedPopover, true);

    if (restoreFocus && returnFocusEl?.isConnected) {
      void tick().then(() => returnFocusEl.focus({ preventScroll: true }));
    }
  }

  async function editActiveAnnotation() {
    if (!activeAnnotation) {
      return;
    }

    window.clearTimeout(closeTimer);
    focusReturnEl ??= renderedSpans.find(
      ({ annotation, span }) => annotation.id === activeAnnotation?.id && span.tabIndex === 0
    )?.span;

    editingAnnotationId = activeAnnotation.id;
    draftComment = activeAnnotation.comment;
    editingPopoverWidth = popoverEl?.getBoundingClientRect().width || 0;
    editingPopoverHeight = 0;
    isEditingPopoverManuallySized = false;
    isCommentExpanded = false;
    isPinned = true;
    popoverReady = false;
    activateAnnotation(activeAnnotation.id);

    document.removeEventListener('pointerdown', closePinnedPopover, true);
    document.addEventListener('pointerdown', closePinnedPopover, true);

    await tick();
    await updatePopoverPosition();
    await tick();
    await fitDraftTextAreaToComment();
    draftTextAreaEl?.focus();
    await updatePopoverPosition();
  }

  async function saveActiveAnnotation(closeAfterSave = false, restoreFocus = false) {
    if (!activeAnnotation) {
      return;
    }

    const annotation = activeAnnotation;
    const isInitialComment = initialCommentEditAnnotationId === annotation.id;
    const comment = draftComment.trim();
    editingAnnotationId = '';
    draftComment = '';
    editingPopoverWidth = 0;
    editingPopoverHeight = 0;
    isEditingPopoverManuallySized = false;

    if (comment !== annotation.comment) {
      dispatch('update', { annotation, comment, isInitialComment });
    }

    if (isInitialComment) {
      initialCommentEditAnnotationId = '';
    }

    if (closeAfterSave) {
      closeAnnotationCard(restoreFocus);
      return;
    }

    await tick();
    await updatePopoverPosition();
  }

  function cancelActiveEdit() {
    if (activeAnnotation?.id === initialCommentEditAnnotationId) {
      initialCommentEditAnnotationId = '';
    }

    closeAnnotationCard(true);
  }

  function isPendingInitialCommentEdit(annotation: BooksDbAnnotation) {
    return (
      !annotation.comment &&
      Object.prototype.hasOwnProperty.call(annotation, 'editedAt') &&
      (annotation.editedAt || 0) <= 0 &&
      (annotation.updatedAt || 0) <= (annotation.createdAt || 0)
    );
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

    const nextCanExpand =
      shouldOfferAnnotationCommentExpansionBeforeMeasurement(
        activeAnnotation.comment,
        collapsedCommentLineCount
      ) || hasAnnotationCommentOverflow(commentEl, collapsedCommentLineCount);

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

    if (isCommentExpanded && isPinned) {
      activateAnnotation(activeAnnotation.id);
      document.removeEventListener('pointerdown', closePinnedPopover, true);
      document.addEventListener('pointerdown', closePinnedPopover, true);
    }

    await tick();
    await updatePopoverPosition();
  }

  function handleDraftCommentKeydown(event: KeyboardEvent) {
    event.stopPropagation();

    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        cancelActiveEdit();
      }

      return;
    }

    event.preventDefault();
    void saveActiveAnnotation(true, true);
  }

  function handleAnnotationCardKeydown(event: KeyboardEvent) {
    if (!activeAnnotation || event.defaultPrevented || event.repeat || event.isComposing) {
      return;
    }

    if (isAnnotationNavigationKey(event)) {
      if (isEditing) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      closeAnnotationCard();
      return;
    }

    if (isEditing && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelActiveEdit();
      return;
    }

    if (!isEditing && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAnnotationCard(true);
      return;
    }

    if (
      isEditing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      isEditableEventTarget(event.target)
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'e') {
      event.preventDefault();
      event.stopPropagation();
      void editActiveAnnotation();
      return;
    }

    if (
      key === 's' &&
      (commentCanExpand || commentCanExpandBeforeMeasurement || isCommentExpanded)
    ) {
      event.preventDefault();
      event.stopPropagation();
      void toggleCommentExpanded();
    }
  }

  function handleAnnotationCardNavigationWheel() {
    if (activeAnnotation && !isEditing) {
      closeAnnotationCard();
    }
  }

  function handleAnnotationCardNavigationScroll() {
    if (activeAnnotation && !isEditing) {
      closeAnnotationCard();
    }
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
      const isActive = annotation.id === activeAnnotation?.id;
      const isHovered = annotation.id === hoveredAnnotationId;

      span.classList.toggle('book-annotation-highlight--active', isActive);
      span.classList.toggle(
        'book-annotation-highlight--hovered',
        isHovered && !isActive && !isPinned && !editingAnnotationId
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
      getReaderChromeStyle({ fontSize, fontColor, backgroundColor }),
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

  function resetManualPopoverPosition() {
    manualPopoverLeft = undefined;
    manualPopoverTop = undefined;
  }

  function getAnnotationHoverDelay() {
    const delay = Number(annotationHoverDelay);

    if (!Number.isFinite(delay)) {
      return 240;
    }

    return limitToRange(0, 2000, Math.round(delay));
  }

  function getEditingPopoverSizeBounds(
    viewportWidth = window.visualViewport?.width || window.innerWidth,
    viewportHeight = window.visualViewport?.height || window.innerHeight
  ) {
    const maxWidth = getPopoverMaxWidth(viewportWidth);
    const maxHeight = Math.max(120, viewportHeight - 24);

    return {
      minWidth: Math.min(360, maxWidth),
      maxWidth,
      minHeight: Math.min(editingPopoverMinHeight, maxHeight),
      maxHeight
    };
  }

  async function fitDraftTextAreaToComment() {
    if (!draftTextAreaEl || !isEditing || isEditingPopoverManuallySized) {
      return;
    }

    await tick();

    if (!draftTextAreaEl || !isEditing || isEditingPopoverManuallySized) {
      return;
    }

    resizeDraftTextArea(draftTextAreaEl);

    await tick();
    await updatePopoverPosition({ preserveTop: true });
  }

  function handleDraftCommentInput(event: Event) {
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) {
      return;
    }

    resizeDraftTextArea(event.currentTarget);
    void fitDraftTextAreaToComment();
  }

  function resizeDraftTextArea(textArea: HTMLTextAreaElement) {
    textArea.style.height = 'auto';

    const maxHeight = getDraftTextAreaMaxHeight();
    const nextHeight = limitToRange(draftTextAreaMinHeight, maxHeight, textArea.scrollHeight + 2);

    textArea.style.height = `${nextHeight}px`;
  }

  function getDraftTextAreaMaxHeight() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportMaxHeight = Math.max(120, viewportHeight - 24);
    const popoverHeight = popoverEl?.getBoundingClientRect().height || 0;
    const textAreaHeight = draftTextAreaEl?.getBoundingClientRect().height || 0;
    const popoverChromeHeight = Math.max(0, popoverHeight - textAreaHeight);

    return Math.max(draftTextAreaMinHeight, viewportMaxHeight - popoverChromeHeight);
  }

  function beginAnnotationPopoverDrag(event: PointerEvent) {
    if (
      !popoverEl ||
      !activeAnnotation ||
      (!isPinned && !isEditing) ||
      event.button !== 0 ||
      isAnnotationPopoverDragIgnoredTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(closeTimer);

    const startRect = popoverEl.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    manualPopoverLeft = startRect.left;
    manualPopoverTop = startRect.top;
    isAnnotationPopoverDragging = true;

    const finishDrag = () => {
      isAnnotationPopoverDragging = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();

      if (!popoverEl || !activeAnnotation) {
        finishDrag();
        return;
      }

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      manualPopoverLeft = limitToRange(
        viewportLeft + 12,
        viewportLeft + viewportWidth - startRect.width - 12,
        startRect.left + moveEvent.clientX - startX
      );
      manualPopoverTop = limitToRange(
        viewportTop + 12,
        viewportTop + viewportHeight - startRect.height - 12,
        startRect.top + moveEvent.clientY - startY
      );
      void updatePopoverPosition({ preserveTop: true });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag, { once: true });
    window.addEventListener('pointercancel', finishDrag, { once: true });
  }

  function isAnnotationPopoverDragIgnoredTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      !!target.closest('button,a,input,textarea,select,[contenteditable]')
    );
  }

  function beginEditingPopoverResize(event: PointerEvent) {
    if (!popoverEl || !isEditing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startRect = popoverEl.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    manualPopoverLeft = startRect.left;
    manualPopoverTop = startRect.top;
    editingPopoverWidth = startRect.width;
    editingPopoverHeight = startRect.height;
    isEditingPopoverManuallySized = true;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const { minWidth, maxWidth, minHeight, maxHeight } = getEditingPopoverSizeBounds();
      editingPopoverWidth = limitToRange(
        minWidth,
        maxWidth,
        startRect.width + moveEvent.clientX - startX
      );
      editingPopoverHeight = limitToRange(
        minHeight,
        maxHeight,
        startRect.height + moveEvent.clientY - startY
      );
      void updatePopoverPosition({ preserveTop: true });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  function handleEditingPopoverResizeKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 32 : 16;
    const deltas: Record<string, [number, number]> = {
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step]
    };
    const delta = deltas[event.key];

    if (!delta) {
      return;
    }

    event.preventDefault();
    resizeEditingPopoverBy(delta[0], delta[1]);
  }

  function resizeEditingPopoverBy(deltaWidth: number, deltaHeight: number) {
    if (!popoverEl || !isEditing) {
      return;
    }

    const rect = popoverEl.getBoundingClientRect();
    const { minWidth, maxWidth, minHeight, maxHeight } = getEditingPopoverSizeBounds();
    manualPopoverLeft = rect.left;
    manualPopoverTop = rect.top;
    editingPopoverWidth = limitToRange(
      minWidth,
      maxWidth,
      (editingPopoverWidth || rect.width) + deltaWidth
    );
    editingPopoverHeight = limitToRange(
      minHeight,
      maxHeight,
      (editingPopoverHeight || rect.height) + deltaHeight
    );
    isEditingPopoverManuallySized = true;
    void updatePopoverPosition({ preserveTop: true });
  }

  function isEditableEventTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  function isAnnotationNavigationKey(event: KeyboardEvent) {
    const readerKeybind = $bookReaderKeybindMap$[event.code || event.key?.toLowerCase()];

    return (
      readerKeybind === BookReaderAvailableKeybind.JUMP_TO_BOOKMARK ||
      readerKeybind === BookReaderAvailableKeybind.NEXT_CHAPTER ||
      readerKeybind === BookReaderAvailableKeybind.NEXT_PAGE ||
      readerKeybind === BookReaderAvailableKeybind.PREV_CHAPTER ||
      readerKeybind === BookReaderAvailableKeybind.PREV_PAGE ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'PageUp' ||
      event.code === 'PageDown' ||
      event.code === 'Home' ||
      event.code === 'End' ||
      event.code === 'KeyA' ||
      event.code === 'KeyD'
    );
  }
</script>

<svelte:document
  on:keydown={handleAnnotationCardKeydown}
  on:wheel={handleAnnotationCardNavigationWheel}
/>
<svelte:window on:scroll={handleAnnotationCardNavigationScroll} />

{#if activeAnnotation}
  <div
    data-ttu-annotation-card
    bind:this={popoverEl}
    class="book-annotation-card writing-horizontal-tb fixed z-40"
    class:book-annotation-card--expanded={isCommentExpanded && !isEditing}
    class:book-annotation-card--editing={isEditing}
    class:book-annotation-card--manual-size={isEditingPopoverManuallySized}
    style={popoverStyle}
    role="dialog"
    tabindex={isPinned ? -1 : undefined}
    aria-modal="false"
    aria-label={isEditing
      ? `Edit ${getAnnotationColorPurposeLabel(activeAnnotation.color)} note`
      : `${getAnnotationColorPurposeLabel(activeAnnotation.color)} note`}
    on:pointerenter={() => window.clearTimeout(closeTimer)}
    on:pointerleave={scheduleClose}
    on:touchmove|stopPropagation={() => {}}
    on:wheel|stopPropagation={() => {}}
  >
    <div class="book-annotation-card-accent" aria-hidden="true"></div>
    <div
      class="book-annotation-card-header"
      class:book-annotation-card-header--draggable={isPinned || isEditing}
      class:book-annotation-card-header--dragging={isAnnotationPopoverDragging}
      on:pointerdown={beginAnnotationPopoverDrag}
    >
      <span class="book-annotation-card-heading">
        <span class="book-annotation-card-kicker">
          <span class="book-annotation-card-color-dot" aria-hidden="true"></span>
          <span class="book-annotation-card-title">
            {getAnnotationColorPurposeLabel(activeAnnotation.color)}
          </span>
        </span>
        <span class="book-annotation-card-meta">
          {#if getAnnotationEditedAt(activeAnnotation)}
            Edited {formatAnnotationTimestamp(getAnnotationEditedAt(activeAnnotation))}
          {:else}
            Added {formatAnnotationTimestamp(activeAnnotation.createdAt)}
          {/if}
        </span>
      </span>
      {#if !isEditing}
        <span class="book-annotation-card-actions">
          {#if activeAnnotation.comment}
            <button
              type="button"
              class="book-annotation-card-action book-annotation-card-action--labeled"
              title="Edit note (E)"
              aria-label="Edit annotation note"
              aria-keyshortcuts="E"
              on:click|stopPropagation={editActiveAnnotation}
            >
              <Fa icon={faPen} />
              <span>Edit</span>
            </button>
          {/if}
          <button
            type="button"
            class="book-annotation-card-action book-annotation-card-action--icon"
            title="Close annotation"
            aria-label="Close annotation"
            aria-keyshortcuts="Escape"
            on:click|stopPropagation={() => closeAnnotationCard(true)}
          >
            <Fa icon={faXmark} />
          </button>
        </span>
      {:else}
        <span class="book-annotation-card-actions">
          <button
            type="button"
            class="book-annotation-card-action"
            title="Cancel editing"
            aria-label="Cancel editing"
            aria-keyshortcuts="Escape"
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
          rows="1"
          placeholder="Write a note…"
          aria-label="Annotation note"
          on:input={handleDraftCommentInput}
          on:keydown={handleDraftCommentKeydown}
        ></textarea>
        <div class="book-annotation-card-editor-actions">
          <span class="book-annotation-card-editor-secondary-actions">
            <button
              type="button"
              class="book-annotation-card-editor-action book-annotation-card-editor-action--danger"
              title="Delete annotation"
              aria-label="Delete annotation"
              on:click|stopPropagation={deleteActiveAnnotation}
            >
              <Fa icon={faTrash} />
            </button>
          </span>
          <span class="book-annotation-card-editor-primary-actions">
            <button
              type="button"
              class="book-annotation-card-editor-action book-annotation-card-editor-action--cancel"
              on:click|stopPropagation={cancelActiveEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              class="book-annotation-card-editor-action book-annotation-card-editor-action--primary"
              title="Save annotation"
              aria-label="Save annotation"
              aria-keyshortcuts="Enter"
              on:click|stopPropagation={() => saveActiveAnnotation(true, true)}
            >
              <span>Save</span>
              <AnnotationSaveReturnIcon />
            </button>
          </span>
          <span class="book-annotation-card-editor-resize-actions">
            <button
              type="button"
              class="book-annotation-card-editor-action book-annotation-card-editor-action--resize"
              title="Resize edit popup"
              aria-label="Resize edit popup"
              on:pointerdown={beginEditingPopoverResize}
              on:keydown|stopPropagation={handleEditingPopoverResizeKeydown}
            >
              <span class="book-annotation-card-editor-resize-grip" aria-hidden="true"></span>
            </button>
          </span>
        </div>
      </div>
    {:else if activeAnnotation.comment}
      <div class="book-annotation-card-body">
        <div
          bind:this={commentEl}
          class="book-annotation-card-comment"
          class:book-annotation-card-comment--clamped={!isCommentExpanded}
          class:book-annotation-card-comment--expanded={isCommentExpanded}
          id={`annotation-comment-${activeAnnotation.id}`}
          style:--book-annotation-card-comment-line-clamp={collapsedCommentLineCount}
        >
          <AnnotationLinkifiedText text={activeAnnotation.comment} />
        </div>
        {#if commentCanExpand || commentCanExpandBeforeMeasurement}
          <button
            type="button"
            class="book-annotation-card-expand"
            aria-expanded={isCommentExpanded}
            aria-controls={`annotation-comment-${activeAnnotation.id}`}
            aria-keyshortcuts="S"
            title={`${isCommentExpanded ? 'Show less' : 'Show more'} (S)`}
            on:click|stopPropagation={toggleCommentExpanded}
          >
            <span class="book-annotation-card-expand-label">
              {isCommentExpanded ? 'Less' : 'More'}
            </span>
            <span class="book-annotation-card-expand-icon" aria-hidden="true">
              <Fa icon={isCommentExpanded ? faChevronUp : faChevronDown} />
            </span>
          </button>
        {/if}
      </div>
    {:else}
      <button
        type="button"
        class="book-annotation-card-empty"
        title="Add note (E)"
        aria-label="Add a note to this highlight"
        aria-keyshortcuts="E"
        on:click|stopPropagation={editActiveAnnotation}
      >
        <Fa icon={faPen} />
        <span>Add a note to this highlight</span>
      </button>
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
      color-mix(in srgb, var(--book-annotation-base) 64%, transparent) 0 62%,
      transparent 62%
    );
    filter: saturate(1.06);
  }

  :global(.book-content--writing-vertical-rl .book-annotation-highlight) {
    background: color-mix(in srgb, var(--book-annotation-base) 44%, transparent);
  }

  :global(.book-content--writing-vertical-rl .book-annotation-highlight:hover),
  :global(.book-content--writing-vertical-rl .book-annotation-highlight:focus-visible) {
    background: color-mix(in srgb, var(--book-annotation-base) 64%, transparent);
  }

  :global(.book-annotation-highlight--active),
  :global(.book-annotation-highlight--hovered) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 72%, transparent),
      0 8px 24px color-mix(in srgb, var(--book-annotation-base) 22%, transparent);
  }

  .book-annotation-card {
    --book-annotation-card-border: color-mix(
      in srgb,
      var(--reader-page-text) 18%,
      var(--reader-page-bg)
    );
    box-sizing: border-box;
    width: min(22.5rem, var(--annotation-popover-max-width, calc(100vw - 1.5rem)));
    max-height: calc(100vh - 1.5rem);
    overflow: hidden;
    overscroll-behavior: contain;
    isolation: isolate;
    border: 1px solid var(--book-annotation-card-border);
    border-radius: 0.875rem;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--reader-page-bg) 96%, var(--reader-page-text)),
        color-mix(in srgb, var(--reader-page-bg) 99%, var(--reader-page-text))
      ),
      var(--reader-page-bg);
    box-shadow:
      0 18px 44px rgba(5, 7, 10, 0.22),
      0 4px 12px rgba(5, 7, 10, 0.1),
      inset 0 1px 0 color-mix(in srgb, #ffffff 14%, transparent);
    color: var(--reader-page-text);
    font-size: var(--reader-ui-font-size);
    backdrop-filter: blur(20px) saturate(125%);
  }

  .book-annotation-card--editing {
    display: flex;
    flex-direction: column;
    min-width: min(22.5rem, calc(100vw - 1.5rem));
    overflow: hidden;
    resize: none;
  }

  .book-annotation-card--expanded {
    width: var(--annotation-popover-max-width, min(34rem, calc(100vw - 1.5rem)));
  }

  .book-annotation-card--manual-size {
    min-height: var(--annotation-popover-min-height, 10.25rem);
  }

  .book-annotation-card-accent {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 1;
    width: 0.2rem;
    background: var(--book-annotation-base);
    box-shadow: 1px 0 0 color-mix(in srgb, var(--book-annotation-base) 26%, transparent);
  }

  .book-annotation-card-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 10%, var(--reader-page-bg));
    background: color-mix(in srgb, var(--reader-page-text) 2.5%, transparent);
    padding: 0.62rem 0.65rem 0.58rem 0.9rem;
  }

  .book-annotation-card-header--draggable {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .book-annotation-card-header--dragging {
    cursor: grabbing;
  }

  .book-annotation-card-heading {
    display: inline-flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.18rem;
  }

  .book-annotation-card-kicker {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: 0.42rem;
    color: var(--reader-page-text);
    font-size: var(--reader-ui-small-font-size);
    font-weight: 750;
    line-height: 1.15;
  }

  .book-annotation-card-color-dot {
    width: 0.5rem;
    height: 0.5rem;
    flex: 0 0 auto;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
    border-radius: 50%;
    background: var(--book-annotation-base);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 16%, transparent);
  }

  .book-annotation-card-actions {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.18rem;
  }

  .book-annotation-card-title,
  .book-annotation-card-meta {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-annotation-card-meta {
    color: color-mix(in srgb, var(--reader-page-text) 70%, transparent);
    font-size: var(--reader-ui-xsmall-font-size);
    font-weight: 500;
    line-height: 1.2;
  }

  .book-annotation-card-action {
    display: inline-flex;
    height: 2rem;
    min-width: 2rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 66%, transparent);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 650;
    outline: none;
    padding: 0 0.5rem;
    white-space: nowrap;
    transition:
      background-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .book-annotation-card-action--labeled {
    color: color-mix(in srgb, var(--app-accent) 72%, var(--reader-page-text));
  }

  .book-annotation-card-action--icon {
    width: 2rem;
    padding: 0;
  }

  .book-annotation-card-action:hover,
  .book-annotation-card-action:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 10%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-action:focus-visible,
  .book-annotation-card-expand:focus-visible,
  .book-annotation-card-empty:focus-visible,
  .book-annotation-card-editor-action:focus-visible {
    box-shadow: var(--app-focus-ring);
  }

  .book-annotation-card-body {
    display: flex;
    min-height: 0;
    flex-direction: column;
    padding: 0.78rem 0.9rem 0.76rem 1rem;
  }

  .book-annotation-card-comment {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-size: var(--reader-reading-font-size);
    font-weight: 400;
    line-height: 1.5;
  }

  .book-annotation-card-comment--clamped {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--book-annotation-card-comment-line-clamp, 2);
    line-clamp: var(--book-annotation-card-comment-line-clamp, 2);
  }

  .book-annotation-card-comment--expanded {
    max-height: min(18rem, calc(100vh - 11rem));
    overflow: auto;
    overscroll-behavior: contain;
    padding-right: 0.4rem;
    scrollbar-gutter: stable;
  }

  .book-annotation-card-expand {
    display: inline-flex;
    min-height: 1.8rem;
    align-self: flex-end;
    align-items: center;
    justify-content: center;
    gap: 0.32rem;
    margin: 0.35rem -0.25rem -0.18rem 0;
    cursor: pointer;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 72%, transparent);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 650;
    outline: none;
    padding: 0.18rem 0.48rem;
    white-space: nowrap;
    transition:
      background-color 140ms ease,
      box-shadow 140ms ease,
      color 140ms ease;
  }

  .book-annotation-card-expand:hover,
  .book-annotation-card-expand:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-expand-icon {
    display: inline-flex;
    align-items: center;
    color: color-mix(in srgb, var(--book-annotation-base) 72%, var(--reader-page-text));
    font-size: var(--reader-ui-xsmall-font-size);
  }

  .book-annotation-card-empty {
    display: flex;
    width: calc(100% - 1.8rem);
    min-height: 2.7rem;
    cursor: pointer;
    align-items: center;
    gap: 0.55rem;
    margin: 0.75rem 0.8rem 0.8rem 1rem;
    border: 1px dashed color-mix(in srgb, var(--reader-page-text) 18%, transparent);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--reader-page-text) 3%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 70%, transparent);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 600;
    outline: none;
    padding: 0.55rem 0.7rem;
    text-align: left;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .book-annotation-card-empty:hover,
  .book-annotation-card-empty:focus-visible {
    border-color: color-mix(in srgb, var(--app-accent) 42%, transparent);
    background: color-mix(in srgb, var(--app-accent) 8%, transparent);
    color: color-mix(in srgb, var(--app-accent) 76%, var(--reader-page-text));
  }

  .book-annotation-card-editor {
    display: flex;
    min-height: 0;
    flex: 0 0 auto;
    flex-direction: column;
    padding: 0.8rem 0.8rem 0.72rem 1rem;
  }

  .book-annotation-card--manual-size .book-annotation-card-editor {
    flex: 1 1 auto;
  }

  .book-annotation-card-textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: calc(1.45em + 1rem + 2px);
    flex: 0 0 auto;
    max-height: max(4.75rem, calc(100vh - 6rem));
    max-width: 100%;
    resize: none;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--reader-page-bg) 94%, var(--reader-page-text));
    color: var(--reader-page-text);
    font: inherit;
    font-size: var(--reader-reading-font-size);
    line-height: 1.45;
    outline: none;
    overflow-y: auto;
    padding: 0.5rem 0.65rem;
  }

  .book-annotation-card--manual-size .book-annotation-card-textarea {
    flex: 1 1 auto;
  }

  .book-annotation-card-textarea:focus {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .book-annotation-card-textarea::selection {
    background: var(--app-accent);
    color: #ffffff;
  }

  .book-annotation-card-editor-actions {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.62rem;
  }

  .book-annotation-card-editor-secondary-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: auto;
  }

  .book-annotation-card-editor-primary-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .book-annotation-card-editor-resize-actions {
    display: inline-flex;
    align-items: center;
  }

  .book-annotation-card-editor-action {
    display: inline-flex;
    height: 2rem;
    min-width: 2rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 66%, transparent);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 650;
    outline: none;
    padding: 0 0.58rem;
    white-space: nowrap;
    transition:
      background-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .book-annotation-card-editor-action:hover,
  .book-annotation-card-editor-action:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-editor-action--resize {
    cursor: nwse-resize;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    padding: 0;
  }

  .book-annotation-card-editor-action--resize:hover,
  .book-annotation-card-editor-action--resize:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 10%, transparent);
    color: var(--reader-page-text);
  }

  .book-annotation-card-editor-resize-grip {
    display: block;
    width: calc(var(--reader-ui-control-font-size) + 0.22rem);
    height: calc(var(--reader-ui-control-font-size) + 0.22rem);
    opacity: 0.52;
    background:
      linear-gradient(135deg, transparent 0 52%, currentColor 52% 59%, transparent 59%),
      linear-gradient(135deg, transparent 0 68%, currentColor 68% 75%, transparent 75%),
      linear-gradient(135deg, transparent 0 84%, currentColor 84% 91%, transparent 91%);
  }

  .book-annotation-card-editor-action--resize:hover .book-annotation-card-editor-resize-grip,
  .book-annotation-card-editor-action--resize:focus-visible
    .book-annotation-card-editor-resize-grip {
    opacity: 0.78;
  }

  .book-annotation-card-editor-action--primary {
    min-width: 4.6rem;
    background: var(--app-accent);
    color: #ffffff;
  }

  .book-annotation-card-editor-action--primary:hover,
  .book-annotation-card-editor-action--primary:focus-visible {
    background: color-mix(in srgb, var(--app-accent) 88%, #000000);
    color: #ffffff;
  }

  .book-annotation-card-editor-action--cancel:hover,
  .book-annotation-card-editor-action--cancel:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
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

  @media (pointer: coarse) {
    .book-annotation-card-action,
    .book-annotation-card-editor-action {
      min-width: 2.5rem;
      height: 2.5rem;
    }

    .book-annotation-card-action--icon {
      width: 2.5rem;
    }

    .book-annotation-card-expand {
      min-height: 2.25rem;
      padding-right: 0.62rem;
      padding-left: 0.62rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.book-annotation-highlight),
    .book-annotation-card-action,
    .book-annotation-card-expand,
    .book-annotation-card-empty,
    .book-annotation-card-editor-action {
      transition: none;
    }
  }
</style>
