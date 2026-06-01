<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import {
    faArrowDownWideShort,
    faArrowUpShortWide,
    faChevronDown,
    faChevronRight,
    faChevronUp,
    faFilter,
    faFloppyDisk,
    faHighlighter,
    faMagnifyingGlass,
    faPen,
    faTrash,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
  import {
    getChapterSections,
    type SectionWithProgress
  } from '$lib/components/book-reader/book-toc/book-toc';
  import {
    AnnotationSortMode,
    annotationSortOptions,
    getAnnotationSortDirection,
    getAnnotationSortLabel,
    getAnnotationSortMode
  } from '$lib/data/annotation-sort';
  import { SortDirection } from '$lib/data/sort-types';
  import { lastAnnotationSortDirection$, lastAnnotationSortMode$ } from '$lib/data/store';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import {
    annotationColorOptions,
    getAnnotationColorLabel,
    getAnnotationColorValue,
    type AnnotationColor
  } from './annotation-colors';
  import { formatAnnotationTimestamp, getAnnotationEditedAt } from './annotation-time';
  import AnnotationLinkifiedText from './annotation-linkified-text.svelte';

  type AnnotationColorFilter = AnnotationColor | 'all';

  export let annotations: BooksDbAnnotation[] = [];
  export let sectionData: SectionWithProgress[] = [];
  export let fontSize = 20;
  export let fontColor = '';
  export let backgroundColor = '';

  const dispatch = createEventDispatcher<{
    close: void;
    jump: BooksDbAnnotation;
    update: { annotation: BooksDbAnnotation; comment: string };
    delete: BooksDbAnnotation;
  }>();

  let editingAnnotationId = '';
  let draftComment = '';
  let draftTextAreaEl: HTMLTextAreaElement | undefined;
  let searchQuery = '';
  let selectedAnnotationColor: AnnotationColorFilter = 'all';
  let expandedCommentIds = new Set<string>();

  $: panelStyle = getReaderChromeStyle({ fontSize, fontColor, backgroundColor });
  $: activeSortMode = getAnnotationSortMode($lastAnnotationSortMode$);
  $: activeSortDirection = getAnnotationSortDirection(
    $lastAnnotationSortDirection$,
    activeSortMode
  );
  $: activeSortDirectionLabel =
    activeSortDirection === SortDirection.ASC ? 'Ascending' : 'Descending';
  $: nextSortDirectionLabel =
    activeSortDirection === SortDirection.ASC ? 'descending' : 'ascending';
  $: chapterSections = getChapterSections(sectionData);
  $: sectionOrder = new Map(sectionData.map((section, index) => [section.reference, index]));
  $: searchTerms = normalizeForSearch(searchQuery).split(/\s+/).filter(Boolean);
  $: colorFilteredAnnotations =
    selectedAnnotationColor === 'all'
      ? annotations
      : annotations.filter((annotation) => annotation.color === selectedAnnotationColor);
  $: filteredAnnotations = searchTerms.length
    ? colorFilteredAnnotations.filter((annotation) =>
        matchesAnnotationSearch(annotation, searchTerms)
      )
    : colorFilteredAnnotations;
  $: sortedAnnotations = filteredAnnotations
    .slice()
    .sort((a, b) => compareAnnotationsForPanel(a, b, activeSortMode, activeSortDirection));
  $: isFilteringAnnotations = searchTerms.length > 0 || selectedAnnotationColor !== 'all';
  $: panelSubtitle = isFilteringAnnotations
    ? `${sortedAnnotations.length} of ${annotations.length} shown`
    : `${annotations.length} saved`;
  $: if (
    editingAnnotationId &&
    !annotations.some((annotation) => annotation.id === editingAnnotationId)
  ) {
    cancelEditing();
  }
  $: void resizeDraftTextArea(draftTextAreaEl, editingAnnotationId, draftComment);

  function compareAnnotationsForPanel(
    annotationA: BooksDbAnnotation,
    annotationB: BooksDbAnnotation,
    sortMode: AnnotationSortMode,
    sortDirection: SortDirection
  ) {
    const directionMultiplier = sortDirection === SortDirection.ASC ? 1 : -1;

    switch (sortMode) {
      case AnnotationSortMode.UPDATED:
        return (
          (getAnnotationUpdatedAt(annotationA) - getAnnotationUpdatedAt(annotationB)) *
            directionMultiplier || compareAnnotationsByLocation(annotationA, annotationB)
        );
      case AnnotationSortMode.CREATED:
        return (
          (annotationA.createdAt - annotationB.createdAt) * directionMultiplier ||
          compareAnnotationsByLocation(annotationA, annotationB)
        );
      case AnnotationSortMode.NOTES:
        return (
          (Number(hasAnnotationComment(annotationA)) - Number(hasAnnotationComment(annotationB))) *
            directionMultiplier || compareAnnotationsByLocation(annotationA, annotationB)
        );
      case AnnotationSortMode.LOCATION:
      default:
        return compareAnnotationsByLocation(annotationA, annotationB) * directionMultiplier;
    }
  }

  function compareAnnotationsByLocation(
    annotationA: BooksDbAnnotation,
    annotationB: BooksDbAnnotation
  ) {
    return (
      getAnnotationSectionOrder(annotationA) - getAnnotationSectionOrder(annotationB) ||
      annotationA.anchor.startOffset - annotationB.anchor.startOffset ||
      annotationA.anchor.endOffset - annotationB.anchor.endOffset ||
      annotationA.exploredCharCount - annotationB.exploredCharCount ||
      annotationA.createdAt - annotationB.createdAt ||
      annotationA.id.localeCompare(annotationB.id)
    );
  }

  function getAnnotationUpdatedAt(annotation: BooksDbAnnotation) {
    return annotation.updatedAt || annotation.createdAt || 0;
  }

  function hasAnnotationComment(annotation: BooksDbAnnotation) {
    return !!annotation.comment.trim();
  }

  function getAnnotationSectionOrder(annotation: BooksDbAnnotation) {
    return (
      sectionOrder.get(annotation.anchor.sectionId) ??
      sectionData.length + annotation.exploredCharCount
    );
  }

  function getChapterLabel(annotation: BooksDbAnnotation) {
    const annotationSection = sectionData.find(
      (section) => section.reference === annotation.anchor.sectionId
    );
    const anchorChapter = getNearestLabeledSection(annotationSection);
    const fallbackChapter = chapterSections
      .slice()
      .reverse()
      .find((section) => (section.startCharacter || 0) <= annotation.exploredCharCount);

    return anchorChapter?.label || fallbackChapter?.label || 'Current Book';
  }

  function getNearestLabeledSection(section: SectionWithProgress | undefined) {
    let currentSection = section;

    while (currentSection) {
      if (currentSection.label) {
        return currentSection;
      }

      currentSection = currentSection.parentChapter
        ? sectionData.find((item) => item.reference === currentSection?.parentChapter)
        : undefined;
    }

    return undefined;
  }

  function matchesAnnotationSearch(annotation: BooksDbAnnotation, terms: string[]) {
    const searchableText = normalizeForSearch(
      [
        annotation.comment,
        annotation.selectedText,
        annotation.anchor.text,
        getChapterLabel(annotation),
        formatAnnotationTimestamp(annotation.createdAt),
        getAnnotationEditedAt(annotation)
          ? formatAnnotationTimestamp(getAnnotationEditedAt(annotation))
          : '',
        getAnnotationColorLabel(annotation.color),
        annotation.color
      ].join(' ')
    );

    return terms.every((term) => searchableText.includes(term));
  }

  function normalizeForSearch(value: string) {
    return value.trim().toLocaleLowerCase();
  }

  function setAnnotationSortMode(event: Event) {
    if (!(event.currentTarget instanceof HTMLSelectElement)) {
      return;
    }

    $lastAnnotationSortMode$ = getAnnotationSortMode(event.currentTarget.value);
  }

  function toggleAnnotationSortDirection() {
    $lastAnnotationSortDirection$ =
      activeSortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
  }

  function setAnnotationColorFilter(event: Event) {
    if (!(event.currentTarget instanceof HTMLSelectElement)) {
      return;
    }

    const nextColor = event.currentTarget.value;
    selectedAnnotationColor = isAnnotationColor(nextColor) ? nextColor : 'all';
  }

  function isAnnotationColor(value: string): value is AnnotationColor {
    return annotationColorOptions.some((colorOption) => colorOption.id === value);
  }

  function handleAnnotationClick(event: MouseEvent, annotation: BooksDbAnnotation) {
    if (editingAnnotationId === annotation.id) {
      return;
    }

    if (isAnnotationPanelControl(event.target)) {
      return;
    }

    dispatch('jump', annotation);
  }

  function handleAnnotationKeydown(event: KeyboardEvent, annotation: BooksDbAnnotation) {
    if (editingAnnotationId === annotation.id) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch('jump', annotation);
    }
  }

  function editAnnotation(annotation: BooksDbAnnotation) {
    editingAnnotationId = annotation.id;
    draftComment = annotation.comment;
  }

  function cancelEditing() {
    editingAnnotationId = '';
    draftComment = '';
  }

  function saveAnnotation(annotation: BooksDbAnnotation) {
    const comment = draftComment.trim();

    if (comment === annotation.comment) {
      cancelEditing();
      return;
    }

    dispatch('update', {
      annotation,
      comment
    });
    cancelEditing();
  }

  function canExpandComment(comment: string) {
    const trimmedComment = comment.trim();

    return trimmedComment.split(/\r?\n/).length > 2 || trimmedComment.length > 150;
  }

  function toggleCommentExpanded(annotationId: string) {
    const nextExpandedCommentIds = new Set(expandedCommentIds);

    if (nextExpandedCommentIds.has(annotationId)) {
      nextExpandedCommentIds.delete(annotationId);
    } else {
      nextExpandedCommentIds.add(annotationId);
    }

    expandedCommentIds = nextExpandedCommentIds;
  }

  function isAnnotationPanelControl(target: EventTarget | null) {
    return (
      target instanceof Element &&
      !!target.closest('a, button, input, select, textarea, [data-annotation-panel-control]')
    );
  }

  async function resizeDraftTextArea(
    textArea: HTMLTextAreaElement | undefined,
    annotationId: string,
    comment: string
  ) {
    if (!textArea || !annotationId) {
      return;
    }

    await tick();

    if (!textArea || editingAnnotationId !== annotationId || draftComment !== comment) {
      return;
    }

    textArea.style.height = 'auto';
    textArea.style.height = `${textArea.scrollHeight}px`;
  }
</script>

<div
  class="annotations-panel"
  style={panelStyle}
  on:touchmove|stopPropagation={() => {}}
  on:wheel|stopPropagation={() => {}}
>
  <div class="annotations-panel-header">
    <div class="annotations-panel-title">
      <span class="annotations-panel-title-icon"><Fa icon={faHighlighter} /></span>
      <div>
        <div class="annotations-panel-title-main">Annotations</div>
        <div class="annotations-panel-title-sub">{panelSubtitle}</div>
      </div>
    </div>
    <button
      type="button"
      class="annotations-panel-close"
      title="Close annotations"
      aria-label="Close annotations"
      on:click={() => dispatch('close')}
    >
      <Fa icon={faXmark} />
    </button>
  </div>

  <div class="annotations-panel-controls">
    <div class="annotations-panel-search">
      <span class="annotations-panel-control-icon" aria-hidden="true">
        <Fa icon={faMagnifyingGlass} />
      </span>
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search annotations"
        aria-label="Search annotations"
        on:keydown|stopPropagation={() => {}}
      />
      {#if searchQuery}
        <button
          type="button"
          class="annotations-panel-search-clear"
          title="Clear search"
          aria-label="Clear search"
          on:click={() => (searchQuery = '')}
          on:keydown|stopPropagation={() => {}}
        >
          <Fa icon={faXmark} />
        </button>
      {/if}
    </div>
    <label class="annotations-panel-filter">
      <span class="annotations-panel-control-icon" aria-hidden="true">
        <Fa icon={faFilter} />
      </span>
      <select
        value={selectedAnnotationColor}
        aria-label="Filter annotations by color"
        on:change={setAnnotationColorFilter}
        on:keydown|stopPropagation={() => {}}
      >
        <option value="all">All colors</option>
        {#each annotationColorOptions as colorOption (colorOption.id)}
          <option value={colorOption.id}>{colorOption.label}</option>
        {/each}
      </select>
    </label>
    <div class="annotations-panel-sort">
      <button
        type="button"
        class="annotations-panel-sort-direction"
        title={`${activeSortDirectionLabel}. Click to switch ${nextSortDirectionLabel}.`}
        aria-label={`Sort direction: ${activeSortDirectionLabel}. Click to switch ${nextSortDirectionLabel}.`}
        aria-pressed={activeSortDirection === SortDirection.DESC}
        on:click|stopPropagation={toggleAnnotationSortDirection}
        on:keydown|stopPropagation={() => {}}
      >
        <Fa
          icon={activeSortDirection === SortDirection.ASC
            ? faArrowUpShortWide
            : faArrowDownWideShort}
        />
      </button>
      <select
        value={activeSortMode}
        aria-label="Sort annotations"
        on:change={setAnnotationSortMode}
        on:keydown|stopPropagation={() => {}}
      >
        {#each annotationSortOptions as sortOption (sortOption.id)}
          <option value={sortOption.id}>
            {getAnnotationSortLabel(sortOption.id, activeSortDirection)}
          </option>
        {/each}
      </select>
    </div>
  </div>

  <div class="annotations-panel-list">
    {#if sortedAnnotations.length}
      {#each sortedAnnotations as annotation (annotation.id)}
        {@const chapterLabel = getChapterLabel(annotation)}
        <div
          role="button"
          tabindex="0"
          class="annotation-item"
          class:annotation-item--editing={editingAnnotationId === annotation.id}
          style:--book-annotation-base={getAnnotationColorValue(annotation.color)}
          on:click={(event) => handleAnnotationClick(event, annotation)}
          on:keydown={(event) => handleAnnotationKeydown(event, annotation)}
        >
          <span class="annotation-item-swatch" aria-hidden="true"></span>
          <span class="annotation-item-content">
            <span class="annotation-item-meta">
              <span class="annotation-item-location" title={chapterLabel}>{chapterLabel}</span>
              <span class="annotation-item-time-stack">
                <span class="annotation-item-created-time">
                  Added {formatAnnotationTimestamp(annotation.createdAt)}
                </span>
                {#if getAnnotationEditedAt(annotation)}
                  <span class="annotation-item-edited-time">
                    Edited {formatAnnotationTimestamp(getAnnotationEditedAt(annotation))}
                  </span>
                {/if}
              </span>
            </span>
            <span class="annotation-item-quote">{annotation.selectedText}</span>
            {#if annotation.comment && editingAnnotationId !== annotation.id}
              <span class="annotation-item-comment-shell">
                <span
                  class="annotation-item-comment"
                  class:annotation-item-comment--clamped={!expandedCommentIds.has(annotation.id)}
                  class:annotation-item-comment--expanded={expandedCommentIds.has(annotation.id)}
                >
                  <AnnotationLinkifiedText text={annotation.comment} />
                </span>
                {#if canExpandComment(annotation.comment)}
                  <button
                    type="button"
                    class="annotation-item-comment-expand"
                    data-annotation-panel-control
                    aria-expanded={expandedCommentIds.has(annotation.id)}
                    on:pointerdown|stopPropagation={() => {}}
                    on:click|stopPropagation={() => toggleCommentExpanded(annotation.id)}
                    on:keydown|stopPropagation={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleCommentExpanded(annotation.id);
                      }
                    }}
                  >
                    <span>{expandedCommentIds.has(annotation.id) ? 'Show less' : 'Show more'}</span>
                    <span class="annotation-item-comment-expand-icon" aria-hidden="true">
                      <Fa
                        icon={expandedCommentIds.has(annotation.id) ? faChevronUp : faChevronDown}
                      />
                    </span>
                  </button>
                {/if}
              </span>
            {/if}
            {#if editingAnnotationId === annotation.id}
              <span class="annotation-item-editor">
                <textarea
                  bind:this={draftTextAreaEl}
                  class="annotation-item-textarea"
                  bind:value={draftComment}
                  rows={canExpandComment(annotation.comment) ? 6 : 3}
                  placeholder="Add an optional comment"
                  on:click|stopPropagation={() => {}}
                  on:keydown|stopPropagation={() => {}}
                ></textarea>
                <span class="annotation-item-editor-actions">
                  <button
                    type="button"
                    class="annotation-item-editor-secondary"
                    on:click|stopPropagation={cancelEditing}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="annotation-item-editor-save"
                    on:click|stopPropagation={() => saveAnnotation(annotation)}
                  >
                    <span>Save</span>
                    <Fa icon={faFloppyDisk} />
                  </button>
                </span>
              </span>
            {/if}
          </span>
          <span class="annotation-item-actions">
            <span class="annotation-item-go" aria-hidden="true">
              <Fa icon={faChevronRight} />
            </span>
            <button
              type="button"
              class="annotation-item-edit"
              title="Edit annotation"
              aria-label="Edit annotation"
              on:click|stopPropagation={() => editAnnotation(annotation)}
              on:keydown|stopPropagation={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  editAnnotation(annotation);
                }
              }}
            >
              <Fa icon={faPen} />
            </button>
            <button
              type="button"
              class="annotation-item-delete"
              title="Delete annotation"
              aria-label="Delete annotation"
              on:click|stopPropagation={() => dispatch('delete', annotation)}
              on:keydown|stopPropagation={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  dispatch('delete', annotation);
                }
              }}
            >
              <Fa icon={faTrash} />
            </button>
          </span>
        </div>
      {/each}
    {:else if annotations.length}
      <div class="annotations-panel-empty">
        <div class="annotations-panel-empty-icon"><Fa icon={faMagnifyingGlass} /></div>
        <div class="annotations-panel-empty-title">No matches</div>
        <div class="annotations-panel-empty-copy">Try another word, chapter, note, or color.</div>
      </div>
    {:else}
      <div class="annotations-panel-empty">
        <div class="annotations-panel-empty-icon"><Fa icon={faHighlighter} /></div>
        <div class="annotations-panel-empty-title">No annotations yet</div>
        <div class="annotations-panel-empty-copy">
          Select text in the reader to save a highlight.
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .annotations-panel {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    overscroll-behavior: contain;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--reader-page-bg) 94%, var(--reader-page-text) 6%),
        color-mix(in srgb, var(--reader-page-bg) 88%, var(--reader-page-text) 12%)
      ),
      var(--reader-page-bg);
    color: var(--reader-page-text);
    font-size: var(--reader-ui-font-size);
  }

  .annotations-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, transparent);
    padding: 1rem;
  }

  .annotations-panel-title {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
  }

  .annotations-panel-title-icon,
  .annotations-panel-empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--app-accent) 16%, transparent);
    color: var(--app-accent);
  }

  .annotations-panel-title-icon {
    height: 2.35rem;
    width: 2.35rem;
    flex: 0 0 auto;
  }

  .annotations-panel-title-main {
    font-size: var(--reader-ui-title-font-size);
    font-weight: 850;
    line-height: 1.1;
  }

  .annotations-panel-title-sub {
    margin-top: 0.15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: var(--reader-ui-xsmall-font-size);
    line-height: 1.1;
  }

  .annotations-panel-close {
    display: inline-flex;
    height: 2.2rem;
    width: 2.2rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 66%, transparent);
    outline: none;
  }

  .annotations-panel-close:hover,
  .annotations-panel-close:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
  }

  .annotations-panel-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8.5rem, auto) minmax(9.25rem, auto);
    gap: 0.625rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    padding: 0.75rem 1rem;
  }

  .annotations-panel-search,
  .annotations-panel-filter,
  .annotations-panel-sort {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 86%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 74%, transparent);
    min-height: 2.25rem;
    padding: 0 0.65rem;
  }

  .annotations-panel-search:focus-within,
  .annotations-panel-filter:focus-within,
  .annotations-panel-sort:focus-within {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .annotations-panel-control-icon {
    display: inline-flex;
    flex: 0 0 auto;
    font-size: var(--reader-ui-small-font-size);
  }

  .annotations-panel-search input,
  .annotations-panel-filter select,
  .annotations-panel-sort select {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--reader-page-text);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 720;
    outline: none;
  }

  .annotations-panel-search input::placeholder {
    color: color-mix(in srgb, var(--reader-page-text) 44%, transparent);
  }

  .annotations-panel-filter select,
  .annotations-panel-sort select {
    cursor: pointer;
  }

  .annotations-panel-filter option,
  .annotations-panel-sort option {
    background-color: var(--reader-page-bg);
    color: var(--reader-page-text);
  }

  .annotations-panel-search-clear,
  .annotations-panel-sort-direction {
    display: inline-flex;
    height: 1.5rem;
    width: 1.5rem;
    flex: 0 0 auto;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.4rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font: inherit;
    outline: none;
  }

  .annotations-panel-sort-direction {
    color: color-mix(in srgb, var(--reader-page-text) 68%, transparent);
  }

  .annotations-panel-sort-direction[aria-pressed='true'] {
    color: var(--reader-page-text);
  }

  .annotations-panel-search-clear:hover,
  .annotations-panel-search-clear:focus-visible,
  .annotations-panel-sort-direction:hover,
  .annotations-panel-sort-direction:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
  }

  .annotations-panel-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0.75rem;
  }

  .annotation-item {
    --book-annotation-base: #f5c84b;
    display: grid;
    width: 100%;
    grid-template-columns: 0.45rem minmax(0, 1fr) auto;
    gap: 0.75rem;
    margin-bottom: 0.625rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 11%, transparent);
    border-radius: 0.75rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 13%, transparent),
        color-mix(in srgb, var(--reader-page-bg) 74%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 90%, transparent);
    color: inherit;
    padding: 0.75rem;
    text-align: left;
    outline: none;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .annotation-item:hover,
  .annotation-item:focus-visible {
    border-color: color-mix(in srgb, var(--book-annotation-base) 52%, transparent);
    box-shadow: 0 16px 34px rgba(5, 7, 10, 0.16);
    transform: translateY(-1px);
  }

  .annotation-item--editing {
    border-color: color-mix(in srgb, var(--book-annotation-base) 58%, transparent);
    box-shadow: 0 16px 34px rgba(5, 7, 10, 0.14);
  }

  .annotation-item-swatch {
    height: 100%;
    min-height: 4.5rem;
    border-radius: 999px;
    background: var(--book-annotation-base);
    box-shadow: 0 0 18px color-mix(in srgb, var(--book-annotation-base) 32%, transparent);
  }

  .annotation-item-content {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.45rem; /* appears to make everything look less smooshed */
    line-height: 1.25;
  }

  .annotation-item-meta {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    color: color-mix(in srgb, var(--reader-page-text) 54%, transparent);
    font-size: var(--reader-ui-small-font-size);
    font-weight: 620;
    line-height: 1.25;
  }

  .annotation-item-time-stack {
    display: inline-flex;
    max-width: 100%;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.14rem;
  }

  .annotation-item-location {
    display: -webkit-box;
    min-width: 0;
    max-width: 100%;
    color: color-mix(in srgb, var(--reader-page-text) 48%, transparent);
    font-weight: 500;
    line-height: 1.25;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .annotation-item-created-time {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .annotation-item-edited-time {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    color: color-mix(in srgb, var(--reader-page-text) 46%, transparent);
    font-weight: 500;
    line-height: 1;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .annotation-item-quote {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    font-size: var(--reader-reading-font-size);
    font-weight: 500;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .annotation-item-comment-shell {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.45rem;
    border: 1px solid color-mix(in srgb, var(--book-annotation-base) 16%, transparent);
    border-radius: 0.55rem;
    background: color-mix(in srgb, var(--reader-page-bg) 72%, transparent);
    padding: 0.55rem;
  }

  .annotation-item-comment {
    color: color-mix(in srgb, var(--reader-page-text) 68%, transparent);
    overflow-wrap: anywhere;
    font-size: var(--reader-reading-font-size);
    font-weight: 250;
    line-height: 1.35;
    white-space: pre-wrap;
  }

  .annotation-item-comment--clamped {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .annotation-item-comment--expanded {
    display: block;
  }

  .annotation-item-comment-expand {
    display: inline-flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--book-annotation-base) 26%, transparent);
    border-radius: 0.5rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 13%, transparent),
        color-mix(in srgb, var(--reader-page-text) 5%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 78%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 76%, var(--book-annotation-base));
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 820;
    outline: none;
    padding: 0.36rem 0.55rem;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      color 140ms ease,
      transform 140ms ease;
  }

  .annotation-item-comment-expand:hover,
  .annotation-item-comment-expand:focus-visible {
    border-color: color-mix(in srgb, var(--book-annotation-base) 54%, transparent);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--book-annotation-base) 20%, transparent),
        color-mix(in srgb, var(--reader-page-text) 8%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 72%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--book-annotation-base) 16%, transparent);
    color: var(--reader-page-text);
  }

  .annotation-item-comment-expand:active {
    transform: translateY(1px);
  }

  .annotation-item-comment-expand-icon {
    display: inline-flex;
    align-items: center;
    color: var(--book-annotation-base);
    font-size: var(--reader-ui-xsmall-font-size);
  }

  .annotation-item-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: color-mix(in srgb, var(--reader-page-text) 48%, transparent);
  }

  .annotation-item-go,
  .annotation-item-edit,
  .annotation-item-delete {
    display: inline-flex;
    height: 1.8rem;
    width: 1.8rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.4rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }

  .annotation-item-edit:hover,
  .annotation-item-edit:focus-visible {
    background: color-mix(in srgb, var(--app-accent) 14%, transparent);
    color: var(--app-accent);
    outline: none;
  }

  .annotation-item-delete:hover,
  .annotation-item-delete:focus-visible {
    background: color-mix(in srgb, var(--app-danger) 14%, transparent);
    color: var(--app-danger);
    outline: none;
  }

  .annotation-item-editor {
    display: block;
    margin-top: 0.1rem;
  }

  .annotation-item-textarea {
    box-sizing: border-box;
    width: 100%;
    resize: vertical;
    overflow: hidden;
    overscroll-behavior: contain;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 86%, transparent);
    color: var(--reader-page-text);
    font: inherit;
    font-size: var(--reader-reading-font-size);
    line-height: 1.35;
    outline: none;
    padding: 0.55rem 0.65rem;
  }

  .annotation-item-textarea:focus {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .annotation-item-editor-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .annotation-item-editor-save,
  .annotation-item-editor-secondary {
    display: inline-flex;
    min-height: 2.1rem;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.5rem;
    font: inherit;
    font-weight: 760;
    outline: none;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      color 140ms ease,
      transform 140ms ease;
  }

  .annotation-item-editor-save {
    border: 1px solid color-mix(in srgb, var(--app-accent) 68%, transparent);
    background: var(--app-accent);
    color: #ffffff;
    box-shadow: 0 10px 22px color-mix(in srgb, var(--app-accent) 18%, transparent);
  }

  .annotation-item-editor-secondary {
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
    background: color-mix(in srgb, var(--reader-page-bg) 82%, var(--reader-page-text) 8%);
    color: color-mix(in srgb, var(--reader-page-text) 72%, transparent);
  }

  .annotation-item-editor-save:hover,
  .annotation-item-editor-save:focus-visible {
    border-color: color-mix(in srgb, var(--app-accent) 82%, #ffffff 18%);
    background: color-mix(in srgb, var(--app-accent-strong) 82%, var(--app-accent));
    box-shadow: 0 12px 24px color-mix(in srgb, var(--app-accent) 24%, transparent);
    transform: translateY(-1px);
  }

  .annotation-item-editor-secondary:hover,
  .annotation-item-editor-secondary:focus-visible {
    border-color: color-mix(in srgb, var(--reader-page-text) 26%, transparent);
    background: color-mix(in srgb, var(--reader-page-bg) 76%, var(--reader-page-text) 12%);
    color: color-mix(in srgb, var(--reader-page-text) 86%, transparent);
  }

  .annotation-item-editor-save:focus-visible {
    box-shadow:
      var(--app-focus-ring),
      0 12px 24px color-mix(in srgb, var(--app-accent) 24%, transparent);
  }

  .annotation-item-editor-secondary:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--reader-page-text) 18%, transparent);
  }

  .annotation-item-editor-save:active,
  .annotation-item-editor-secondary:active {
    transform: translateY(0);
  }

  .annotations-panel-empty {
    display: grid;
    min-height: 70%;
    place-content: center;
    justify-items: center;
    padding: 2rem;
    text-align: center;
  }

  .annotations-panel-empty-icon {
    height: 3rem;
    width: 3rem;
    font-size: 1.2rem;
  }

  .annotations-panel-empty-title {
    margin-top: 1rem;
    font-size: var(--reader-ui-title-font-size);
    font-weight: 820;
  }

  .annotations-panel-empty-copy {
    margin-top: 0.35rem;
    max-width: 15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: var(--reader-ui-small-font-size);
    line-height: 1.35;
  }

  @media (max-width: 28rem) {
    .annotations-panel-controls {
      grid-template-columns: minmax(0, 1fr);
    }

    .annotation-item {
      grid-template-columns: 0.4rem minmax(0, 1fr);
    }

    .annotation-item-actions {
      grid-column: 2;
      justify-content: flex-end;
    }
  }
</style>
