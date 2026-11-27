<script lang="ts">
  import { faBook } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let imagePath: string | Blob;
  let failed = false;

  function imageSource(image: HTMLImageElement, value: string | Blob) {
    let objectUrl = '';
    const update = (source: string | Blob) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = typeof source === 'string' ? '' : URL.createObjectURL(source);
      failed = false;
      image.src = objectUrl || (source as string);
    };
    update(value);
    return {
      update,
      destroy: () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
  }
</script>

<span class="book-thumbnail" aria-hidden="true">
  {#if !imagePath || failed}<Fa icon={faBook} />{/if}
  {#if imagePath}
    <img
      use:imageSource={imagePath}
      class:failed
      alt=""
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      on:error={() => (failed = true)}
    />
  {/if}
</span>

<style>
  .book-thumbnail {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--book-thumbnail-width, 34px);
    aspect-ratio: 2 / 3;
    overflow: hidden;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.2rem;
    background: var(--app-chrome-hover);
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .failed {
    display: none;
  }
</style>
