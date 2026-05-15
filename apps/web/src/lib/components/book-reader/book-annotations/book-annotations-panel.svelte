<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import {
    faCheck,
    faChevronRight,
    faHighlighter,
    faPen,
    faTrash,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
  import type { SectionWithProgress } from '$lib/components/book-reader/book-toc/book-toc';
  import { getAnnotationColorValue } from './annotation-colors';

  export let annotations: BooksDbAnnotation[] = [];
  export let sectionData: SectionWithProgress[] = [];
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

  $: panelStyle = `--reader-page-text: ${
    fontColor || 'var(--font-color)'
  }; --reader-page-bg: ${backgroundColor || 'var(--background-color)'};`;
  $: sectionOrder = new Map(sectionData.map((section, index) => [section.reference, index]));
  $: sortedAnnotations = annotations
    .slice()
    .sort(
      (a, b) =>
        getAnnotationSectionOrder(a) - getAnnotationSectionOrder(b) ||
        a.anchor.startOffset - b.anchor.startOffset ||
        a.createdAt - b.createdAt
    );
  $: if (
    editingAnnotationId &&
    !annotations.some((annotation) => annotation.id === editingAnnotationId)
  ) {
    cancelEditing();
  }

  function getAnnotationSectionOrder(annotation: BooksDbAnnotation) {
    return (
      sectionOrder.get(annotation.anchor.sectionId) ??
      sectionData.length + annotation.exploredCharCount
    );
  }

  function getChapterLabel(annotation: BooksDbAnnotation) {
    const mainChapters = sectionData.filter((section) => !section.parentChapter);
    const annotationSection = sectionData.find(
      (section) => section.reference === annotation.anchor.sectionId
    );
    const anchorChapter = annotationSection?.parentChapter
      ? mainChapters.find((section) => section.reference === annotationSection.parentChapter)
      : annotationSection && !annotationSection.parentChapter
        ? annotationSection
        : undefined;
    const fallbackChapter = mainChapters
      .slice()
      .reverse()
      .find((section) => (section.startCharacter || 0) <= annotation.exploredCharCount);

    return anchorChapter?.label || fallbackChapter?.label || 'Current Book';
  }

  function handleAnnotationClick(annotation: BooksDbAnnotation) {
    if (editingAnnotationId === annotation.id) {
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
    dispatch('update', {
      annotation,
      comment: draftComment.trim()
    });
    cancelEditing();
  }
</script>

<div class="annotations-panel" style={panelStyle}>
  <div class="annotations-panel-header">
    <div class="annotations-panel-title">
      <span class="annotations-panel-title-icon"><Fa icon={faHighlighter} /></span>
      <div>
        <div class="annotations-panel-title-main">Annotations</div>
        <div class="annotations-panel-title-sub">{annotations.length} saved</div>
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

  <div class="annotations-panel-list">
    {#if sortedAnnotations.length}
      {#each sortedAnnotations as annotation (annotation.id)}
        <div
          role="button"
          tabindex="0"
          class="annotation-item"
          class:annotation-item--editing={editingAnnotationId === annotation.id}
          style:--book-annotation-base={getAnnotationColorValue(annotation.color)}
          on:click={() => handleAnnotationClick(annotation)}
          on:keydown={(event) => handleAnnotationKeydown(event, annotation)}
        >
          <span class="annotation-item-swatch" aria-hidden="true"></span>
          <span class="annotation-item-content">
            <span class="annotation-item-meta">
              <span>{getChapterLabel(annotation)}</span>
            </span>
            {#if annotation.comment && editingAnnotationId !== annotation.id}
              <span class="annotation-item-comment">{annotation.comment}</span>
            {/if}
            {#if editingAnnotationId === annotation.id}
              <span class="annotation-item-editor">
                <textarea
                  class="annotation-item-textarea"
                  bind:value={draftComment}
                  rows="3"
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
                    <Fa icon={faCheck} />
                    <span>Save</span>
                  </button>
                </span>
              </span>
            {/if}
            <span class="annotation-item-quote">{annotation.selectedText}</span>
          </span>
          <span class="annotation-item-actions">
            <span class="annotation-item-go" aria-hidden="true"><Fa icon={faChevronRight} /></span>
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
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--reader-page-bg) 96%, transparent),
        color-mix(in srgb, var(--reader-page-bg) 82%, var(--reader-page-text))
      ),
      var(--reader-page-bg);
    color: var(--reader-page-text);
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
    font-size: 1rem;
    font-weight: 850;
    line-height: 1.1;
  }

  .annotations-panel-title-sub {
    margin-top: 0.15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: 0.78rem;
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

  .annotations-panel-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
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
    gap: 0.45rem;
  }

  .annotation-item-meta {
    display: flex;
    min-width: 0;
    justify-content: space-between;
    gap: 0.75rem;
    color: color-mix(in srgb, var(--reader-page-text) 54%, transparent);
    font-size: 0.72rem;
    font-weight: 760;
    line-height: 1;
  }

  .annotation-item-meta span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .annotation-item-comment {
    display: -webkit-box;
    overflow: hidden;
    font-size: 0.9rem;
    font-weight: 720;
    line-height: 1.25;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .annotation-item-quote {
    display: -webkit-box;
    overflow: hidden;
    color: color-mix(in srgb, var(--reader-page-text) 62%, transparent);
    font-size: 0.78rem;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
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
    width: 100%;
    resize: vertical;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 86%, transparent);
    color: var(--reader-page-text);
    font: inherit;
    font-size: 0.86rem;
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
    font-weight: 800;
    outline: none;
  }

  .annotation-item-editor-save {
    border: 1px solid color-mix(in srgb, var(--app-accent) 44%, transparent);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--app-accent) 86%, #ffffff),
      color-mix(in srgb, #25a7a0 78%, var(--app-accent))
    );
    color: #ffffff;
  }

  .annotation-item-editor-secondary {
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 76%, transparent);
  }

  .annotation-item-editor-save:hover,
  .annotation-item-editor-save:focus-visible,
  .annotation-item-editor-secondary:hover,
  .annotation-item-editor-secondary:focus-visible {
    box-shadow: 0 14px 28px color-mix(in srgb, var(--app-accent) 24%, transparent);
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
    font-size: 1rem;
    font-weight: 820;
  }

  .annotations-panel-empty-copy {
    margin-top: 0.35rem;
    max-width: 15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: 0.86rem;
    line-height: 1.35;
  }
</style>
