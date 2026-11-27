<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import BookCardList from './book-card-list.svelte';
  import type { BookCardProps } from './book-card-props';
  import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let id: string;
  export let title: string;
  export let books: BookCardProps[];
  export let currentBookId: number | undefined;
  export let editable = false;
  export let collapsible = true;
  export let showCount = true;
  export let showHeading = true;
  export let emptyMessage = 'Add a few books to make this shelf yours.';

  const dispatch = createEventDispatcher<{ bookClick: { id: number }; edit: void }>();
  const noSelection = new Set<number>();
  let heading: HTMLHeadingElement;
  let toggle: HTMLButtonElement;
  let expanded = false;
  let columns = 3;
  let closedHeight = 0;
  let fullHeight = 0;
  $: hasMore = collapsible && books.length > columns;
  $: viewportHeight = expanded || !hasMore ? fullHeight : closedHeight;

  function measureShelf(content: HTMLDivElement) {
    const measure = () => {
      const grid = content.querySelector<HTMLElement>('.book-card-grid');
      const first = grid?.firstElementChild as HTMLElement | null;
      if (!grid || !first) return;
      columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 24;
      closedHeight = first.getBoundingClientRect().height + gap / 2;
      fullHeight = content.getBoundingClientRect().height;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return { destroy: () => observer.disconnect() };
  }

  async function toggleShelf() {
    const headingInset = parseFloat(getComputedStyle(heading).scrollMarginTop) || 128;
    const returnToHeading = expanded && heading.getBoundingClientRect().top < headingInset;
    expanded = !expanded;
    await tick();
    toggle?.focus({ preventScroll: true });
    if (returnToHeading) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      heading.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
    }
  }
</script>

<section class="library-shelf" aria-labelledby="{id}-heading">
  {#if showHeading}
    <header class:editable>
      {#if editable}<button class="quiet-button" on:click={() => dispatch('edit')}
          >Edit collection</button
        >{/if}
      <h2 id="{id}-heading" bind:this={heading}>
        {title}{#if showCount}{' '}<span
            class="library-book-count"
            aria-label={`${books.length} ${books.length === 1 ? 'book' : 'books'}`}
            >{books.length}</span
          >{/if}
      </h2>
      <div class="shelf-actions">
        <slot name="controls" />
      </div>
    </header>
  {:else}
    <h2 class="sr-only" id="{id}-heading" bind:this={heading}>{title}</h2>
  {/if}
  {#if books.length}
    <div
      class="shelf-viewport"
      style:height={fullHeight ? `${viewportHeight}px` : undefined}
      id="{id}-books"
    >
      <div class="shelf-content" use:measureShelf>
        <BookCardList
          bookCards={books}
          {currentBookId}
          selectedBookIds={noSelection}
          visibleCount={expanded || !hasMore ? Infinity : columns}
          on:bookClick={(event) => dispatch('bookClick', event.detail)}
        />
      </div>
    </div>
    {#if hasMore}
      <button
        bind:this={toggle}
        class="shelf-fold"
        aria-expanded={expanded}
        aria-controls="{id}-books"
        on:click={toggleShelf}
      >
        <span>{expanded ? 'Show less' : `Show ${books.length - columns} more`}</span>
        <span class="chevron" class:up={expanded} aria-hidden="true"
          ><Fa icon={faChevronDown} /></span
        >
      </button>
    {/if}
  {:else}
    <p class="empty-shelf">{emptyMessage}</p>
  {/if}
</section>

<style>
  .library-shelf {
    position: relative;
    margin-bottom: 2.5rem;
  }
  :global(.library-shelf) + .library-shelf::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    top: -1.25rem;
    height: 1px;
    background: color-mix(in srgb, var(--font-color) 10%, transparent);
    pointer-events: none;
  }
  header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .shelf-actions {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .quiet-button {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    min-height: 44px;
    white-space: nowrap;
  }
  header h2 {
    grid-column: 2;
    grid-row: 1;
    text-align: center;
  }
  @media (max-width: 639px) {
    header {
      gap: 0.6rem;
    }
    header h2 {
      grid-column: 1 / -1;
    }
    header.editable .quiet-button {
      grid-row: 2;
    }
    header.editable .shelf-actions {
      grid-row: 2;
      grid-column: 2 / -1;
    }
  }
  h2 {
    min-width: 0;
    overflow-wrap: anywhere;
    scroll-margin-top: calc(var(--library-header-height, 112px) + 16px);
    font-size: 1.15rem;
    font-weight: 550;
    letter-spacing: -0.025em;
  }
  .quiet-button,
  .shelf-fold {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.6rem;
    background: transparent;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
  }
  button:hover {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 5px;
  }
  .shelf-viewport {
    overflow: clip;
    overflow-clip-margin: 8px;
    transition: height 440ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .shelf-fold {
    width: fit-content;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    margin: 0.25rem auto 0;
    transition: background-color 160ms ease;
  }
  .shelf-fold:hover {
    background: var(--app-chrome-hover);
  }
  .chevron {
    display: inline-block;
    font-size: 0.6rem;
    margin-left: 0.15rem;
    transition: transform 440ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chevron.up {
    transform: rotate(180deg);
  }
  .empty-shelf {
    padding: 1rem 0 1.5rem;
    color: var(--app-chrome-muted);
    font-size: 0.875rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .shelf-viewport,
    .chevron {
      transition: none;
    }
  }
</style>
