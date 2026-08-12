<script lang="ts">
  import { faImage } from '@fortawesome/free-regular-svg-icons';
  import { faHighlighter } from '@fortawesome/free-solid-svg-icons';
  import { onDestroy } from 'svelte';
  import Fa from 'svelte-fa';

  export let imagePath: string | Blob;
  export let title: string;
  export let progress: number;
  export let annotationCount = 0;

  let objectUrl = '';

  onDestroy(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  });

  function convertImagePath(value: string | Blob) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
    if (typeof value !== 'string') {
      objectUrl = URL.createObjectURL(
        value.type ? value : new Blob([value], { type: 'image/jpeg' })
      );

      return objectUrl;
    }

    return value;
  }

  function mapImagePathFactory() {
    let prevValue: string | Blob | undefined;
    let prevResponse: string | undefined;

    const isEqual = (newValue: string | Blob) => {
      if (!prevValue) return false;
      if (prevValue instanceof Blob && newValue instanceof Blob) {
        return prevValue === newValue;
      }
      if (typeof prevValue !== 'object' || typeof newValue !== 'object') {
        return prevValue === newValue;
      }
      return false;
    };

    return (value: string | Blob) => {
      if (isEqual(value)) return prevResponse as string;

      prevValue = value;
      prevResponse = convertImagePath(value);

      return prevResponse;
    };
  }

  const mapImagePath = mapImagePathFactory();

  let imgEl: HTMLImageElement | undefined;
  let imageLoading = true;

  $: imageLoadComplete = imgEl?.complete && !imageLoading;
  $: alt = `${title}_cover`;
  $: annotationLabel = `${annotationCount} annotation${annotationCount === 1 ? '' : 's'}`;
</script>

<div
  tabindex="0"
  role="button"
  class="book-card-button aspect-w-2 aspect-h-3 group relative outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--app-accent-soft)]"
  on:click
  on:keyup
>
  <div class="book-card-media">
    <div class="book-card-cover-placeholder h-full w-full text-5xl sm:text-7xl">
      {#if !imageLoadComplete}
        <Fa
          class="book-card-placeholder-icon absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          icon={faImage}
        />
      {/if}

      {#if imagePath}
        <img
          decoding="async"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="book-cover book-card-cover relative h-full w-full object-cover transition delay-150 duration-700 ease-out group-hover:scale-[1.018]"
          class:book-card-cover--loading={!imageLoadComplete}
          src={mapImagePath(imagePath)}
          {alt}
          bind:this={imgEl}
          on:load={() => (imageLoading = false)}
        />
      {/if}
    </div>

    <div class="book-card-annotation-badge" title={annotationLabel} aria-label={annotationLabel}>
      <Fa class="book-card-annotation-icon" icon={faHighlighter} />
      <span>{annotationCount.toLocaleString()}</span>
    </div>

    <div class="absolute inset-x-0 bottom-0">
      <div
        class="book-card-title-scrim sm:h-21 h-16 p-0.5 px-1.5 text-sm text-white sm:p-1.5 sm:text-base"
      >
        <span class="book-card-title line-clamp-3">{title}</span>
      </div>
      <div class="book-progress-track h-2" aria-hidden="true">
        <div class="book-progress-fill h-full" style:width="{progress * 100}%" />
      </div>
    </div>
  </div>
</div>
