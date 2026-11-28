<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import { annotationColorOptions, type AnnotationColor } from './annotation-colors';

  export let selectionRect: DOMRect | undefined;
  export let anchorRect: DOMRect | undefined;
  export let verticalMode = false;
  export let fontSize = 20;
  export let fontColor = '';
  export let backgroundColor = '';

  const dispatch = createEventDispatcher<{
    save: { color: AnnotationColor; comment: string };
    dismiss: void;
  }>();

  let toolbarEl: HTMLElement | undefined;
  let toolbarStyle = '';

  $: chromeStyle = getReaderChromeStyle({ fontSize, fontColor, backgroundColor });

  $: if (selectionRect) {
    updatePosition();
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
    const anchor = anchorRect ?? selectionRect;
    const toolbarRect = toolbarEl.getBoundingClientRect();
    const width = Math.min(toolbarRect.width || 360, viewportWidth - 24);
    const height = toolbarRect.height || 180;
    const gap = 12;

    if (!anchor) {
      return;
    }

    const { top, left } = verticalMode
      ? getVerticalToolbarPosition(
          anchor,
          width,
          height,
          viewportLeft,
          viewportTop,
          viewportWidth,
          viewportHeight,
          gap
        )
      : getHorizontalToolbarPosition(
          anchor,
          width,
          height,
          viewportLeft,
          viewportTop,
          viewportWidth,
          viewportHeight,
          gap
        );

    toolbarStyle = `${chromeStyle}; top: ${top}px; left: ${left}px; max-width: ${viewportWidth - 24}px`;
  }

  function getHorizontalToolbarPosition(
    anchor: DOMRect,
    width: number,
    height: number,
    viewportLeft: number,
    viewportTop: number,
    viewportWidth: number,
    viewportHeight: number,
    gap: number
  ) {
    const anchorCenter = anchor.left + anchor.width / 2;
    const top =
      anchor.top - viewportTop > height + gap
        ? anchor.top - height - gap
        : Math.min(viewportTop + viewportHeight - height - 12, anchor.bottom + gap);
    const left = limitToRange(
      viewportLeft + 12,
      viewportLeft + viewportWidth - width - 12,
      anchorCenter - width / 2
    );

    return { top, left };
  }

  function getVerticalToolbarPosition(
    anchor: DOMRect,
    width: number,
    height: number,
    viewportLeft: number,
    viewportTop: number,
    viewportWidth: number,
    viewportHeight: number,
    gap: number
  ) {
    const minLeft = viewportLeft + 12;
    const maxLeft = viewportLeft + viewportWidth - width - 12;
    const preferredRight = anchor.right + gap;
    const preferredLeft = anchor.left - width - gap;
    const left =
      preferredRight <= maxLeft
        ? preferredRight
        : preferredLeft >= minLeft
          ? preferredLeft
          : limitToRange(minLeft, maxLeft, preferredRight);
    const top = limitToRange(
      viewportTop + 12,
      viewportTop + viewportHeight - height - 12,
      anchor.top + anchor.height / 2 - height / 2
    );

    return { top, left };
  }

  function saveAnnotation(color: AnnotationColor) {
    if (!selectionRect) {
      return;
    }

    dispatch('save', {
      color,
      comment: ''
    });
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (
      !selectionRect ||
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isEditableEventTarget(event.target)
    ) {
      return;
    }

    const colorIndex = Number(event.key) - 1;
    const colorOption = annotationColorOptions[colorIndex];

    if (!colorOption) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    saveAnnotation(colorOption.id);
  }

  function handleDocumentPointerdown(event: PointerEvent) {
    if (
      !selectionRect ||
      !toolbarEl ||
      (event.pointerType === 'mouse' && event.button !== 0) ||
      (event.target instanceof Node && toolbarEl.contains(event.target))
    ) {
      return;
    }

    dispatch('dismiss');
  }

  function limitToRange(min: number, max: number, value: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function isEditableEventTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }
</script>

<svelte:document on:keydown={handleDocumentKeydown} on:pointerdown={handleDocumentPointerdown} />

{#if selectionRect}
  <div
    bind:this={toolbarEl}
    class="annotation-toolbar fixed z-50 {verticalMode
      ? 'annotation-toolbar--vertical'
      : 'writing-horizontal-tb'}"
    role="dialog"
    aria-label="Create annotation"
    style={toolbarStyle || chromeStyle}
  >
    <div class="annotation-toolbar-main">
      <div class="annotation-toolbar-colors" aria-label="Highlight color">
        {#each annotationColorOptions as colorOption, index (colorOption.id)}
          <button
            type="button"
            class="annotation-toolbar-swatch"
            title={`${colorOption.label} (${index + 1})`}
            aria-label={`${colorOption.label} highlight, shortcut ${index + 1}`}
            data-sound="none"
            style:--book-annotation-base={colorOption.value}
            on:click={() => saveAnnotation(colorOption.id)}
            on:keydown|stopPropagation={() => {}}
          >
            <span class="annotation-toolbar-swatch-color" aria-hidden="true"></span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .annotation-toolbar {
    width: max-content;
    max-width: calc(100vw - 1.5rem);
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, var(--reader-page-bg));
    border-radius: 999px;
    background: color-mix(in srgb, var(--reader-page-bg) 98%, var(--reader-page-text));
    box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
    color: var(--reader-page-text);
    font-size: var(--reader-ui-font-size);
    padding: 0.25rem;
  }

  .annotation-toolbar--vertical {
    max-height: calc(100vh - 1.5rem);
    writing-mode: vertical-rl;
  }

  .annotation-toolbar-colors {
    display: flex;
    justify-content: center;
    gap: 0.125rem;
    min-width: 0;
  }

  .annotation-toolbar-swatch {
    display: inline-flex;
    height: 2.5rem;
    width: 2.5rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    border: 0;
    border-radius: 999px;
    appearance: none;
    background: transparent;
    outline: none;
    transition: background-color 140ms ease;
  }

  .annotation-toolbar-swatch-color {
    height: 1.35rem;
    width: 1.35rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--book-annotation-base) 78%, var(--reader-page-bg));
    pointer-events: none;
  }

  .annotation-toolbar-swatch:hover {
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
  }

  .annotation-toolbar-swatch:focus-visible {
    outline: 2px solid var(--reader-page-text);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .annotation-toolbar-swatch {
      transition: none;
    }
  }
</style>
