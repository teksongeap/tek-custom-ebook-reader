<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { faHighlighter, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { annotationColorOptions, type AnnotationColor } from './annotation-colors';

  export let selectionRect: DOMRect | undefined;
  export let fontColor = '';
  export let backgroundColor = '';

  const dispatch = createEventDispatcher<{
    save: { color: AnnotationColor; comment: string };
    cancel: void;
  }>();

  let toolbarEl: HTMLElement | undefined;
  let selectedColor: AnnotationColor | undefined;
  let comment = '';
  let toolbarStyle = '';

  $: chromeStyle = `--reader-page-text: ${
    fontColor || 'var(--font-color)'
  }; --reader-page-bg: ${backgroundColor || 'var(--background-color)'};`;

  $: if (selectionRect || selectedColor) {
    updatePosition();
  }

  $: if (!selectionRect) {
    selectedColor = undefined;
    comment = '';
  }

  async function updatePosition() {
    await tick();

    if (!selectionRect || !toolbarEl) {
      return;
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const toolbarRect = toolbarEl.getBoundingClientRect();
    const width = Math.min(toolbarRect.width || 360, viewportWidth - 24);
    const height = toolbarRect.height || 180;
    const gap = 12;
    const anchorCenter = selectionRect.left + selectionRect.width / 2;
    const top =
      selectionRect.top - viewportTop > height + gap
        ? selectionRect.top - height - gap
        : Math.min(viewportTop + viewportHeight - height - 12, selectionRect.bottom + gap);
    const left = limitToRange(
      viewportLeft + 12,
      viewportLeft + viewportWidth - width - 12,
      anchorCenter - width / 2
    );

    toolbarStyle = `${chromeStyle}; top: ${top}px; left: ${left}px; max-width: ${viewportWidth - 24}px`;
  }

  function selectColor(color: AnnotationColor) {
    selectedColor = color;
  }

  function saveAnnotation(commentValue = comment.trim()) {
    if (!selectedColor) {
      return;
    }

    dispatch('save', {
      color: selectedColor,
      comment: commentValue
    });
    selectedColor = undefined;
    comment = '';
  }

  function limitToRange(min: number, max: number, value: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
</script>

{#if selectionRect}
  <div
    bind:this={toolbarEl}
    class="annotation-toolbar writing-horizontal-tb fixed z-50"
    class:annotation-toolbar--expanded={!!selectedColor}
    style={toolbarStyle || chromeStyle}
    on:keydown|stopPropagation={() => {}}
    on:pointerdown|stopPropagation={() => {}}
  >
    <div class="annotation-toolbar-main">
      <div class="annotation-toolbar-title">
        <Fa icon={faHighlighter} />
        <span>Highlight</span>
      </div>
      <div class="annotation-toolbar-colors" aria-label="Highlight color">
        {#each annotationColorOptions as colorOption (colorOption.id)}
          <button
            type="button"
            class="annotation-toolbar-swatch"
            class:annotation-toolbar-swatch--active={selectedColor === colorOption.id}
            title={colorOption.label}
            aria-label={colorOption.label}
            style:--book-annotation-base={colorOption.value}
            on:click={() => selectColor(colorOption.id)}
          ></button>
        {/each}
      </div>
      <button
        type="button"
        class="annotation-toolbar-icon"
        title="Cancel"
        aria-label="Cancel annotation"
        on:click={() => dispatch('cancel')}
      >
        <Fa icon={faXmark} />
      </button>
    </div>
    {#if selectedColor}
      <div class="annotation-toolbar-comment-shell">
        <textarea
          class="annotation-toolbar-comment"
          bind:value={comment}
          rows="3"
          placeholder="Add an optional comment"
        ></textarea>
        <div class="annotation-toolbar-actions">
          <button
            type="button"
            class="annotation-toolbar-secondary"
            on:click={() => saveAnnotation('')}
          >
            Highlight Only
          </button>
          <button type="button" class="annotation-toolbar-save" on:click={() => saveAnnotation()}>
            Save
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .annotation-toolbar {
    width: max-content;
    max-width: calc(100vw - 1.5rem);
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
    border-radius: 0.65rem;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--reader-page-bg) 94%, transparent),
        color-mix(in srgb, var(--reader-page-bg) 78%, var(--reader-page-text))
      ),
      var(--reader-page-bg);
    box-shadow:
      0 22px 58px rgba(5, 7, 10, 0.3),
      inset 0 1px 0 color-mix(in srgb, #ffffff 16%, transparent);
    color: var(--reader-page-text);
    padding: 0.42rem;
    backdrop-filter: blur(20px) saturate(140%);
    transition:
      width 160ms ease,
      padding 160ms ease,
      border-radius 160ms ease;
  }

  .annotation-toolbar--expanded {
    width: min(21rem, calc(100vw - 1.5rem));
    border-radius: 0.75rem;
    padding: 0.65rem;
  }

  .annotation-toolbar-main {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .annotation-toolbar-title {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: color-mix(in srgb, var(--reader-page-text) 78%, transparent);
    font-size: 0.8rem;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
  }

  .annotation-toolbar:not(.annotation-toolbar--expanded) .annotation-toolbar-title {
    height: 1.65rem;
    width: 1.65rem;
    justify-content: center;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
  }

  .annotation-toolbar:not(.annotation-toolbar--expanded) .annotation-toolbar-title span {
    display: none;
  }

  .annotation-toolbar--expanded .annotation-toolbar-main {
    justify-content: space-between;
    gap: 0.65rem;
  }

  .annotation-toolbar-icon {
    display: inline-flex;
    height: 1.65rem;
    width: 1.65rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 64%, transparent);
    outline: none;
  }

  .annotation-toolbar-icon:hover,
  .annotation-toolbar-icon:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
  }

  .annotation-toolbar-colors {
    display: flex;
    flex: 1 1 auto;
    justify-content: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .annotation-toolbar-swatch {
    --book-annotation-base: #f5c84b;
    height: 1.35rem;
    width: 1.35rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 18%, transparent);
    border-radius: 999px;
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.55), transparent 36%),
      var(--book-annotation-base);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--book-annotation-base) 20%, transparent);
    outline: none;
    transition:
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .annotation-toolbar--expanded .annotation-toolbar-swatch {
    height: 1.5rem;
    width: 1.5rem;
  }

  .annotation-toolbar-swatch:hover,
  .annotation-toolbar-swatch:focus-visible,
  .annotation-toolbar-swatch--active {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--reader-page-bg) 82%, transparent),
      0 0 0 4px var(--book-annotation-base),
      0 12px 24px color-mix(in srgb, var(--book-annotation-base) 24%, transparent);
    transform: translateY(-1px);
  }

  .annotation-toolbar-comment-shell {
    margin-top: 0.65rem;
    border-top: 1px solid color-mix(in srgb, var(--reader-page-text) 10%, transparent);
    padding-top: 0.65rem;
  }

  .annotation-toolbar-comment {
    width: 100%;
    resize: vertical;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 84%, transparent);
    color: var(--reader-page-text);
    font: inherit;
    font-size: 0.88rem;
    line-height: 1.35;
    outline: none;
    padding: 0.55rem 0.65rem;
  }

  .annotation-toolbar-comment:focus {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .annotation-toolbar-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.5rem;
    margin-top: 0.65rem;
  }

  .annotation-toolbar-save,
  .annotation-toolbar-secondary {
    width: 100%;
    min-height: 2.25rem;
    cursor: pointer;
    font-weight: 800;
    outline: none;
  }

  .annotation-toolbar-save {
    border: 1px solid color-mix(in srgb, var(--app-accent) 44%, transparent);
    border-radius: 0.5rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--app-accent) 86%, #ffffff),
      color-mix(in srgb, #25a7a0 78%, var(--app-accent))
    );
    color: #ffffff;
  }

  .annotation-toolbar-secondary {
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 14%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 76%, transparent);
  }

  .annotation-toolbar-save:hover,
  .annotation-toolbar-save:focus-visible,
  .annotation-toolbar-secondary:hover,
  .annotation-toolbar-secondary:focus-visible {
    box-shadow: 0 14px 28px color-mix(in srgb, var(--app-accent) 26%, transparent);
  }
</style>
