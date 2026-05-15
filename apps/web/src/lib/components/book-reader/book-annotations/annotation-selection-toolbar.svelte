<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { faHighlighter } from '@fortawesome/free-solid-svg-icons';
  import { annotationColorOptions, type AnnotationColor } from './annotation-colors';

  export let selectionRect: DOMRect | undefined;
  export let fontColor = '';
  export let backgroundColor = '';

  const dispatch = createEventDispatcher<{
    save: { color: AnnotationColor; comment: string };
    cancel: void;
  }>();

  let toolbarEl: HTMLElement | undefined;
  let toolbarStyle = '';

  $: chromeStyle = `--reader-page-text: ${
    fontColor || 'var(--font-color)'
  }; --reader-page-bg: ${backgroundColor || 'var(--background-color)'};`;

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
      (event.target instanceof Node && toolbarEl.contains(event.target))
    ) {
      return;
    }

    dispatch('cancel');
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
    class="annotation-toolbar writing-horizontal-tb fixed z-50"
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
    height: 1.55rem;
    width: 1.55rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 18%, transparent);
    border-radius: 999px;
    background: var(--book-annotation-base);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--book-annotation-base) 20%, transparent);
    outline: none;
    transition:
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .annotation-toolbar-swatch:hover,
  .annotation-toolbar-swatch:focus-visible {
    box-shadow:
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
    font-size: 0.65rem;
    font-weight: 900;
    line-height: 1;
    pointer-events: none;
    text-shadow:
      0 1px 0 rgba(255, 255, 255, 0.54),
      0 -1px 0 rgba(255, 255, 255, 0.28);
  }
</style>
