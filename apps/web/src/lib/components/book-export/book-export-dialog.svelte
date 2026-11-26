<script lang="ts">
  import BookExportSelection from '$lib/components/book-export/book-export-selection.svelte';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { lastExportedTarget$, lastExportedTypes$ } from '$lib/data/store';
  import { executeReplicate$ } from '$lib/functions/replication/replication-progress';
  import { createEventDispatcher, onMount } from 'svelte';
  import { faXmark } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let dialog: HTMLElement;
  let closeButton: HTMLButtonElement;
  $: canExport = !!$lastExportedTypes$.length;

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const gutter = root.style.scrollbarGutter;
    root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
    closeButton.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch('close');
      }
      if (event.key !== 'Tab') return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      root.style.overflow = overflow;
      root.style.scrollbarGutter = gutter;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  });

  function replicateData() {
    if (!canExport) return;
    lastExportedTarget$.next(StorageKey.BACKUP);
    executeReplicate$.next();

    dispatch('close');
  }
</script>

<section
  class="app-dialog book-export-dialog"
  role="dialog"
  aria-modal="true"
  aria-labelledby="book-export-title"
  aria-describedby="book-export-description"
  bind:this={dialog}
>
  <header>
    <div>
      <h2 id="book-export-title">Export books</h2>
      <p id="book-export-description">Choose what to include.</p>
    </div>
    <button
      type="button"
      class="close-button"
      aria-label="Close export"
      bind:this={closeButton}
      on:click={() => dispatch('close')}><Fa icon={faXmark} /></button
    >
  </header>
  <div class="export-body">
    <BookExportSelection bind:dataToReplicate={$lastExportedTypes$} />
  </div>
  <footer>
    {#if !$lastExportedTypes$.length}<p role="status">Choose at least one item to export.</p>{/if}
    <div class="footer-actions">
      <button type="button" class="app-button" on:click={() => dispatch('close')}>Cancel</button>
      <button
        type="button"
        class="app-button app-button--primary"
        disabled={!canExport}
        on:click={replicateData}>Export</button
      >
    </div>
  </footer>
</section>

<style>
  .book-export-dialog {
    display: flex;
    flex-direction: column;
    width: min(32rem, 80vw);
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    padding-bottom: 1.25rem;
  }
  h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }
  header p {
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
    line-height: 1.5;
    margin-top: 0.35rem;
  }
  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 0.4rem;
    color: var(--app-chrome-muted);
  }
  .close-button:hover {
    color: var(--font-color);
    background: var(--app-chrome-hover);
  }
  .close-button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  .export-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 3px;
    margin: -3px;
  }
  footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-top: 1.25rem;
    margin-top: 1.25rem;
    border-top: 1px solid var(--app-surface-border);
  }
  footer p {
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
  }
  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
</style>
