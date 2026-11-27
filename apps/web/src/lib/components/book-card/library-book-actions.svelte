<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import SortArrow from './sort-arrow.svelte';
  import {
    faArrowDownShortWide,
    faArrowDownWideShort,
    faCheckDouble,
    faTimes,
    faCloudArrowUp,
    faChartLine,
    faCalendarXmark,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import { booklistSortOptions$ } from '$lib/data/store';
  import { storageSource$ } from '$lib/data/storage/storage-view';
  import { SortDirection } from '$lib/data/sort-types';
  import type { BookCardProps } from './book-card-props';

  export let selectMode = false;
  export let selectedCount = 0;
  export let hasBooks = true;
  export let showSelect = true;
  const dispatch = createEventDispatcher<{
    selectAllClick: void;
    removeClick: void;
    selectionToStatistics: void;
    deleteStatistics: void;
    replicateData: void;
  }>();
  let sortMenu: Popover;
  const sortItems = [
    { property: 'id', label: 'Added' },
    { property: 'title', label: 'Title' },
    { property: 'characters', label: 'Characters' },
    { property: 'lastBookModified', label: 'Last update' },
    { property: 'lastBookOpen', label: 'Recently opened' },
    { property: 'progress', label: 'Progress' },
    { property: 'lastBookmarkModified', label: 'Bookmarked' }
  ];
  function sort(property: string, direction: SortDirection) {
    booklistSortOptions$.next({
      ...$booklistSortOptions$,
      [$storageSource$]: {
        property: property as Exclude<keyof BookCardProps, 'imagePath' | 'isPlaceholder'>,
        direction
      }
    });
    sortMenu.toggleOpen();
  }
</script>

<div
  class="book-actions"
  class:book-actions--selection={selectMode}
  aria-label="Book actions"
  role="group"
>
  {#if showSelect}
    <button
      type="button"
      class="action-button"
      title={selectMode ? 'Done selecting books' : 'Select books'}
      aria-label={selectMode ? 'Done selecting books' : 'Select books'}
      aria-pressed={selectMode}
      disabled={!hasBooks}
      on:click={() => (selectMode = !selectMode)}
      ><Fa icon={selectMode ? faTimes : faCheckDouble} /><span class="action-label"
        >{selectMode ? 'Done' : 'Select'}</span
      ></button
    >
  {/if}
  {#if selectMode}
    <button
      type="button"
      class="action-button"
      title="Select all books"
      aria-label="Select all books"
      on:click={() => dispatch('selectAllClick')}
      ><Fa icon={faCheckDouble} /><span class="action-label">Select all</span></button
    >
    <button
      type="button"
      class="action-button"
      title="Delete selected books"
      aria-label="Delete selected books"
      disabled={!selectedCount}
      on:click={() => dispatch('removeClick')}
      ><Fa icon={faTrash} /><span class="action-label">Delete selected</span></button
    >
    <button
      type="button"
      class="action-button"
      title="Export selected books"
      aria-label="Export selected books"
      disabled={!selectedCount}
      on:click={() => dispatch('replicateData')}
      ><Fa icon={faCloudArrowUp} /><span class="action-label secondary-label">Export</span></button
    >
    <button
      type="button"
      class="action-button"
      title="Statistics for selected books"
      aria-label="Statistics for selected books"
      disabled={!selectedCount}
      on:click={() => dispatch('selectionToStatistics')}
      ><Fa icon={faChartLine} /><span class="action-label secondary-label">Statistics</span></button
    >
    <button
      type="button"
      class="action-button"
      title="Delete selected statistics"
      aria-label="Delete selected statistics"
      disabled={!selectedCount}
      on:click={() => dispatch('deleteStatistics')}
      ><Fa icon={faCalendarXmark} /><span class="action-label secondary-label">Delete stats</span
      ></button
    >
  {/if}
  <div class="sort-control">
    <Popover
      placement="bottom-end"
      fallbackPlacements={['bottom-end', 'bottom-start']}
      yOffset={6}
      bind:this={sortMenu}
    >
      <button
        slot="icon"
        type="button"
        class="action-button"
        title="Sort library"
        aria-label="Sort library"
        ><Fa
          icon={$booklistSortOptions$[$storageSource$].direction === SortDirection.ASC
            ? faArrowDownShortWide
            : faArrowDownWideShort}
        /><span class="action-label">Sort</span></button
      >
      <div slot="content" class="app-menu w-64">
        {#each sortItems as item (item.property)}
          {@const current = $booklistSortOptions$[$storageSource$]}
          <div
            class="library-sort-row"
            class:app-menu-item--selected={current.property === item.property}
          >
            <span>{item.label}</span>
            <button
              type="button"
              class="app-menu-item"
              title={`${item.label}: ascending`}
              aria-label={`${item.label}: ascending`}
              aria-pressed={current.property === item.property &&
                current.direction === SortDirection.ASC}
              on:click={() => sort(item.property, SortDirection.ASC)}><SortArrow up /></button
            >
            <button
              type="button"
              class="app-menu-item"
              title={`${item.label}: descending`}
              aria-label={`${item.label}: descending`}
              aria-pressed={current.property === item.property &&
                current.direction === SortDirection.DESC}
              on:click={() => sort(item.property, SortDirection.DESC)}><SortArrow /></button
            >
          </div>
        {/each}
      </div>
    </Popover>
  </div>
</div>

<style>
  .book-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .book-actions--selection {
    flex-wrap: wrap;
    max-width: 100%;
  }
  .action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    min-width: 44px;
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.6rem;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .action-button:hover,
  .action-button[aria-pressed='true'] {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  .action-button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  .sort-control {
    margin-left: auto;
  }
  .secondary-label {
    display: none;
  }
  .action-button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  @media (min-width: 1280px) {
    .secondary-label {
      display: inline;
    }
  }
  @media (max-width: 1023px) {
    .action-label {
      display: none;
    }
    .action-button {
      padding: 0.5rem;
    }
    .book-actions {
      gap: 0.25rem;
    }
  }
  @media (max-width: 639px) {
    .book-actions--selection {
      flex: 1 0 100%;
      justify-content: flex-start;
    }
  }
  @media (max-width: 359px) {
    .book-actions--selection .action-button {
      min-width: 36px;
      padding-inline: 0.375rem;
    }
  }
</style>
