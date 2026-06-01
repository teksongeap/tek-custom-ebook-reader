<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import Fa from 'svelte-fa';
  import { faHighlighter } from '@fortawesome/free-solid-svg-icons';
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
      <div class="annotation-toolbar-title">
        <Fa icon={faHighlighter} />
        <span>Highlight</span>
      </div>
      <div class="annotation-toolbar-colors" aria-label="Highlight color">
        {#each annotationColorOptions as colorOption, index (colorOption.id)}
          <button
            type="button"
            class="annotation-toolbar-swatch"
            title={`${colorOption.label} (${index + 1})`}
            aria-label={`${colorOption.label} highlight, shortcut ${index + 1}`}
            style:--book-annotation-base={colorOption.value}
            on:click={() => saveAnnotation(colorOption.id)}
            on:keydown|stopPropagation={() => {}}
          >
            <span class="annotation-toolbar-swatch-number">{index + 1}</span>
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
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 26%, var(--reader-page-bg));
    border-radius: 0.65rem;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--reader-page-bg) 91%, var(--reader-page-text)),
        color-mix(in srgb, var(--reader-page-bg) 97%, var(--reader-page-text))
      ),
      var(--reader-page-bg);
    box-shadow:
      0 18px 42px rgba(5, 7, 10, 0.32),
      inset 0 1px 0 color-mix(in srgb, #ffffff 12%, transparent);
    color: var(--reader-page-text);
    font-size: var(--reader-ui-font-size);
    padding: 0.42rem;
    backdrop-filter: blur(20px) saturate(140%);
    transition:
      width 160ms ease,
      padding 160ms ease,
      border-radius 160ms ease;
  }

  .annotation-toolbar-main {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .annotation-toolbar--vertical {
    max-height: calc(100vh - 1.5rem);
    writing-mode: vertical-rl;
  }

  .annotation-toolbar-title {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: color-mix(in srgb, var(--reader-page-text) 78%, transparent);
    font-size: var(--reader-ui-small-font-size);
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
  }

  .annotation-toolbar-title {
    height: 1.65rem;
    width: 1.65rem;
    justify-content: center;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
  }

  .annotation-toolbar-title span {
    display: none;
  }

  .annotation-toolbar--vertical .annotation-toolbar-title,
  .annotation-toolbar--vertical .annotation-toolbar-swatch-number {
    writing-mode: horizontal-tb;
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
    position: relative;
    height: 1.5rem;
    width: 1.5rem;
    flex: 0 0 auto;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 18%, transparent);
    border-radius: 999px;
    appearance: none;
    background: var(--book-annotation-base);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, #ffffff 10%, transparent),
      0 8px 18px color-mix(in srgb, var(--book-annotation-base) 20%, transparent);
    outline: none;
    transition:
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .annotation-toolbar-swatch::before {
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.34),
      rgba(255, 255, 255, 0.08) 42%,
      transparent 56%,
      rgba(0, 0, 0, 0.18)
    );
    content: '';
    pointer-events: none;
  }

  .annotation-toolbar-swatch:hover,
  .annotation-toolbar-swatch:focus-visible {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, #ffffff 16%, transparent),
      0 0 0 2px color-mix(in srgb, var(--reader-page-bg) 82%, transparent),
      0 0 0 4px var(--book-annotation-base),
      0 12px 24px color-mix(in srgb, var(--book-annotation-base) 24%, transparent);
    transform: translateY(-1px);
  }

  .annotation-toolbar-swatch-number {
    position: absolute;
    inset: 50% auto auto 50%;
    display: inline-flex;
    height: 0.95rem;
    min-width: 0.95rem;
    transform: translate(-50%, -50%);
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: rgba(0, 0, 0, 0.84);
    font-size: var(--reader-ui-xsmall-font-size);
    font-weight: 900;
    line-height: 1;
    pointer-events: none;
    z-index: 1;
    text-shadow:
      0 1px 0 rgba(255, 255, 255, 0.54),
      0 -1px 0 rgba(255, 255, 255, 0.28);
  }
</style>
