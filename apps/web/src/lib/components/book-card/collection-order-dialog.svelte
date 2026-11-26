<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { faGripVertical, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { libraryCollections$ } from '$lib/data/library-collections';
  import {
    moveCollection,
    moveCollectionToIndex,
    type LibraryCollection
  } from './library-organization';

  const dispatch = createEventDispatcher<{ close: void }>();
  let dialog: HTMLDialogElement;
  let list: HTMLOListElement;
  let draft = [...$libraryCollections$];
  let grabbedId: string | undefined;
  let originalOrder: LibraryCollection[] = [];
  let pointerId: number | undefined;
  let x = 0;
  let y = 0;
  let previewLeft = 0;
  let previewWidth = 0;
  let grabOffset = 0;
  let animationFrame = 0;
  let message = '';
  let error = '';
  $: draggedCollection =
    pointerId !== undefined ? draft.find((item) => item.id === grabbedId) : undefined;

  onMount(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousGutter = root.style.scrollbarGutter;
    root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
    dialog.showModal();
    dialog.addEventListener('keydown', trapFocus);
    return () => {
      cancelAnimationFrame(animationFrame);
      dialog.removeEventListener('keydown', trapFocus);
      dialog.close();
      root.style.overflow = previousOverflow;
      root.style.scrollbarGutter = previousGutter;
    };
  });

  function close() {
    stopDrag();
    dialog.close();
  }

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function save() {
    try {
      // Apply only the order; retain any membership or sort changes made elsewhere.
      const current = $libraryCollections$;
      const byId = new Map(current.map((collection) => [collection.id, collection]));
      const reordered = draft.flatMap((collection) =>
        byId.has(collection.id) ? [byId.get(collection.id)!] : []
      );
      const knownIds = new Set(draft.map((collection) => collection.id));
      const result = [
        ...reordered,
        ...current.filter((collection) => !knownIds.has(collection.id))
      ];
      localStorage.setItem('libraryCollections', JSON.stringify(result));
      libraryCollections$.next(result);
      close();
    } catch {
      error = 'Unable to save this order. Your browser storage may be full.';
    }
  }

  function startDrag(event: PointerEvent, id: string) {
    if (event.button !== 0 || pointerId !== undefined) return;
    event.preventDefault();
    const row = (event.currentTarget as HTMLElement).closest('li')!;
    const rect = row.getBoundingClientRect();
    originalOrder = draft;
    grabbedId = id;
    pointerId = event.pointerId;
    x = event.clientX;
    y = event.clientY;
    previewLeft = rect.left;
    previewWidth = rect.width;
    grabOffset = y - rect.top;
    animationFrame = requestAnimationFrame(dragFrame);
  }

  function dragFrame() {
    if (pointerId === undefined) return;
    const rect = list.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const edge = 40;
      const speed = y < rect.top + edge ? -8 : y > rect.bottom - edge ? 8 : 0;
      if (speed) list.scrollTop += speed;
      const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-collection-id]');
      if (target && list.contains(target) && target.dataset.collectionId !== grabbedId) {
        const targetIndex = draft.findIndex(
          (collection) => collection.id === target.dataset.collectionId
        );
        draft = moveCollectionToIndex(draft, grabbedId!, targetIndex);
      }
    }
    animationFrame = requestAnimationFrame(dragFrame);
  }

  function movePointer(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    if (event.cancelable) event.preventDefault();
    x = event.clientX;
    y = event.clientY;
  }

  function stopDrag(cancel = false) {
    if (cancel) draft = originalOrder;
    if (grabbedId) {
      const index = draft.findIndex((collection) => collection.id === grabbedId);
      message = `${draft[index]?.name || 'Collection'} placed at position ${index + 1} of ${draft.length}.`;
    }
    cancelAnimationFrame(animationFrame);
    pointerId = undefined;
    grabbedId = undefined;
  }

  async function keyboardReorder(event: KeyboardEvent, id: string) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbedId === id) stopDrag();
      else {
        originalOrder = draft;
        grabbedId = id;
        message = 'Picked up. Use arrow keys to move, then Space to drop.';
      }
    } else if (grabbedId === id && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      draft = moveCollection(draft, id, event.key === 'ArrowUp' ? -1 : 1);
      message = `Position ${draft.findIndex((collection) => collection.id === id) + 1} of ${draft.length}.`;
      await tick();
      list
        .querySelector<HTMLButtonElement>(`[data-collection-id="${CSS.escape(id)}"] button`)
        ?.focus();
    } else if (event.key === 'Escape' && grabbedId) {
      event.preventDefault();
      event.stopPropagation();
      stopDrag(true);
    }
  }
</script>

<svelte:window
  on:pointermove|nonpassive={movePointer}
  on:pointerup={(event) => {
    if (event.pointerId === pointerId) stopDrag();
  }}
  on:pointercancel={(event) => {
    if (event.pointerId === pointerId) stopDrag(true);
  }}
/>

<dialog
  class="app-dialog collection-order-dialog"
  aria-labelledby="collection-order-title"
  aria-describedby="collection-order-help"
  bind:this={dialog}
  on:close={() => dispatch('close')}
  on:cancel|preventDefault={close}
>
  <header>
    <h2 id="collection-order-title">Arrange collections</h2>
    <button
      type="button"
      class="close-button"
      aria-label="Close collection ordering"
      on:click={close}><Fa icon={faXmark} /></button
    >
  </header>
  <p id="collection-order-help">Drag collections into the order you want.</p>
  <p class="sr-only" id="collection-drag-keys">
    Keyboard: press Space to pick up a collection, use arrow keys to move it, then Space to drop.
    Escape cancels the move.
  </p>
  <ol bind:this={list} aria-label="Collection order">
    {#each draft as collection, index (collection.id)}
      <li data-collection-id={collection.id} class:grabbed={grabbedId === collection.id}>
        <button
          type="button"
          class="reorder-row"
          aria-label={`Reorder ${collection.name}`}
          aria-describedby="collection-drag-keys"
          aria-pressed={grabbedId === collection.id}
          on:pointerdown={(event) => startDrag(event, collection.id)}
          on:keydown={(event) => keyboardReorder(event, collection.id)}
          ><span class="drag-grip" aria-hidden="true"><Fa icon={faGripVertical} /></span>
          <span class="collection-name">{collection.name}</span>
          <span class="position" aria-hidden="true">{index + 1}</span></button
        >
      </li>
    {/each}
  </ol>
  <span class="sr-only" aria-live="polite">{message}</span>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <footer>
    <button type="button" class="app-button" on:click={close}>Cancel</button>
    <button type="button" class="app-button app-button--primary" on:click={save}>Done</button>
  </footer>
  {#if draggedCollection}
    <div
      class="drag-preview"
      aria-hidden="true"
      style:left={`${previewLeft}px`}
      style:top={`${y - grabOffset}px`}
      style:width={`${previewWidth}px`}
    >
      <Fa icon={faGripVertical} /><span>{draggedCollection.name}</span>
    </div>
  {/if}
</dialog>

<style>
  .collection-order-dialog {
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(30rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
    overflow: visible;
  }
  .collection-order-dialog::backdrop {
    background: rgb(0 0 0 / 42%);
    backdrop-filter: blur(3px);
  }
  .collection-order-dialog[open] {
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.4rem;
  }
  h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }
  p {
    color: var(--app-chrome-muted);
    font-size: 0.85rem;
  }
  .close-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 0.4rem;
    color: var(--app-chrome-muted);
  }
  .close-button:hover,
  .reorder-row:hover {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  ol {
    min-height: 0;
    max-height: min(55dvh, 28rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1.25rem 0;
    padding: 3px;
  }
  .reorder-row,
  .drag-preview {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 56px;
    padding: 0.4rem 0.75rem 0.4rem 0.35rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.6rem;
    background: var(--app-surface-bg);
    color: var(--font-color);
  }
  li {
    flex-shrink: 0;
  }
  .grabbed .reorder-row {
    border-color: var(--app-accent);
    background: var(--app-accent-soft);
  }
  .reorder-row {
    width: 100%;
    text-align: left;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .drag-grip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 0.35rem;
    color: var(--app-chrome-muted);
  }
  .grabbed .reorder-row {
    cursor: grabbing;
  }
  .collection-name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.875rem;
  }
  .position {
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  .drag-preview {
    position: fixed;
    pointer-events: none;
    z-index: 1;
    box-shadow: var(--app-surface-shadow);
    border-color: var(--app-accent);
    padding-left: 1.25rem;
    font-size: 0.875rem;
  }
  .drag-preview span {
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .error {
    color: var(--app-danger);
    margin-bottom: 1rem;
  }
</style>
