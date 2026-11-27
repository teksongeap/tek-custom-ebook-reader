<script lang="ts">
  import { tick } from 'svelte';
  import { libraryCollections$ as collections$ } from '$lib/data/library-collections';
  import type { LibraryCollection } from './library-organization';
  import {
    collectionBookSortOptions,
    getCollectionBooks,
    type CollectionBookSort
  } from './library-organization';
  import {
    faPlus,
    faArrowDownWideShort,
    faMagnifyingGlass,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import type { BookCardProps } from './book-card-props';
  import BookCardList from './book-card-list.svelte';
  import LibraryBookActions from './library-book-actions.svelte';
  import LibraryShelf from './library-shelf.svelte';
  import CollectionOrderDialog from './collection-order-dialog.svelte';
  import CollectionEditorDialog from './collection-editor-dialog.svelte';

  export let books: BookCardProps[];
  export let upNext: BookCardProps[];
  export let currentBookId: number | undefined;
  export let selectedBookIds: ReadonlySet<number> = new Set();
  export let selectMode = false;
  export let showAll = false;
  export let query = '';
  let searchInput: HTMLInputElement;
  $: searchTerm = query.trim().toLocaleLowerCase();
  let editing: LibraryCollection | undefined;
  let storageError = '';
  let arranging = false;
  let arrangeButton: HTMLButtonElement;

  async function closeArrangement() {
    arranging = false;
    await tick();
    arrangeButton?.focus({ preventScroll: true });
  }

  export async function arrangeCollections() {
    arranging = true;
    editing = undefined;
  }
  $: filteredBooks = books.filter((book) => book.title.toLocaleLowerCase().includes(searchTerm));
  export function editCollection(collection?: LibraryCollection) {
    arranging = false;
    editing = collection
      ? { ...collection, bookIds: [...collection.bookIds] }
      : { id: crypto.randomUUID(), name: '', bookIds: [] };
  }

  function persist(collections: LibraryCollection[]) {
    try {
      // Check storage before updating the reactive preference.
      localStorage.setItem('libraryCollections', JSON.stringify(collections));
      collections$.next(collections);
      storageError = '';
    } catch {
      storageError = 'Unable to save your collections. Your browser storage may be full.';
    }
  }

  function setCollectionSort(id: string, value: string) {
    if (!collectionBookSortOptions.some((option) => option.value === value)) return;
    const sort = value as CollectionBookSort;
    persist(
      $collections$.map((collection) =>
        collection.id === id ? { ...collection, sort } : collection
      )
    );
  }
</script>

<div class="library-home">
  <div class="library-tools" class:library-tools--selecting={selectMode}>
    <div class="library-search-group">
      <div class="library-search" role="search" aria-label="Library">
        <span class="search-icon" aria-hidden="true"><Fa icon={faMagnifyingGlass} /></span>
        <input
          bind:this={searchInput}
          type="search"
          bind:value={query}
          placeholder="Search books"
          aria-label="Search library"
          on:keydown={(event) => {
            if (event.key === 'Escape') query = '';
          }}
        />
        {#if searchTerm}<span class="search-results-count" role="status">
            {filteredBooks.length}
            {filteredBooks.length === 1 ? 'book' : 'books'} found
          </span>{/if}
        {#if query}
          <button
            type="button"
            class="search-clear"
            title="Clear search"
            aria-label="Clear search"
            on:click={() => {
              query = '';
              searchInput.focus();
            }}><Fa icon={faXmark} /></button
          >
        {/if}
      </div>
      {#if selectMode}<span class="selection-summary" aria-live="polite">
          {selectedBookIds.size} selected
        </span>{/if}
    </div>
    {#if showAll || selectMode || searchTerm}
      <LibraryBookActions
        bind:selectMode
        selectedCount={selectedBookIds.size}
        hasBooks={!!books.length}
        on:selectAllClick
        on:removeClick
        on:selectionToStatistics
        on:deleteStatistics
        on:replicateData
      />
    {:else}
      <div class="collection-actions" role="group" aria-label="Collection actions">
        <button
          type="button"
          class="collection-action"
          title="New collection"
          aria-label="New collection"
          on:click={() => editCollection()}><Fa icon={faPlus} /><span>New collection</span></button
        >
        <button
          bind:this={arrangeButton}
          type="button"
          class="collection-action"
          title="Arrange collections"
          aria-label="Arrange collections"
          disabled={!$collections$.length}
          on:click={arrangeCollections}
          ><Fa icon={faArrowDownWideShort} /><span>Arrange collections</span></button
        >
      </div>
    {/if}
  </div>
  {#if storageError}<p role="alert">{storageError}</p>{/if}
  {#if arranging && !showAll && !selectMode}
    <CollectionOrderDialog on:close={closeArrangement} />
  {/if}
  {#if editing && !selectMode}
    <CollectionEditorDialog {books} collection={editing} on:close={() => (editing = undefined)} />
  {/if}

  {#if showAll || searchTerm || selectMode}
    <BookCardList
      bookCards={filteredBooks}
      {currentBookId}
      {selectedBookIds}
      {selectMode}
      on:bookClick
    />
    {#if !filteredBooks.length}<p class="muted">No matching books.</p>{/if}
  {:else}
    <LibraryShelf
      id="up-next"
      title="Up next"
      showCount={false}
      showHeading={false}
      collapsible={false}
      books={upNext}
      {currentBookId}
      emptyMessage="Books you open appear here, most recent first. Finished books stay out of the way."
      on:bookClick
    />
    {#each $collections$ as collection (collection.id)}
      <LibraryShelf
        id="collection-{collection.id}"
        title={collection.name}
        books={getCollectionBooks(books, collection)}
        {currentBookId}
        editable
        on:edit={() => editCollection(collection)}
        on:bookClick
      >
        <select
          slot="controls"
          class="collection-sort"
          aria-label={`Sort ${collection.name}`}
          value={collection.sort || 'title'}
          on:change={(event) => setCollectionSort(collection.id, event.currentTarget.value)}
        >
          {#each collectionBookSortOptions as option (option.value)}<option value={option.value}
              >{option.label}</option
            >{/each}
        </select>
      </LibraryShelf>
    {/each}
    {#if !$collections$.length}
      <div class="shelves-invitation">
        <p>A little space for the books you want to keep together.</p>
        <button on:click={() => editCollection()}
          >Create your first collection <span aria-hidden="true">↗</span></button
        >
      </div>
    {/if}
  {/if}
</div>

<style>
  .library-home {
    padding-bottom: 3rem;
  }
  .library-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }
  .library-tools--selecting {
    flex-wrap: wrap;
  }
  .library-search-group {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 0.75rem;
    min-width: 0;
    max-width: 28rem;
  }
  .library-tools--selecting .library-search-group {
    min-width: min(100%, 16rem);
    max-width: 34rem;
  }
  @media (max-width: 639px) {
    .library-tools--selecting {
      flex-wrap: wrap;
    }
    .library-tools--selecting .library-search-group {
      flex-basis: 100%;
      max-width: none;
    }
  }
  .collection-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-left: auto;
  }
  .collection-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.6rem;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  .collection-action:hover:not(:disabled) {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  .collection-action:disabled {
    opacity: 0.4;
    cursor: default;
  }
  @media (max-width: 767px) {
    .collection-action span {
      display: none;
    }
    .collection-action {
      justify-content: center;
      min-width: 44px;
      padding-inline: 0.5rem;
    }
  }
  .muted {
    color: var(--app-chrome-muted);
  }
  button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 4px;
  }
  .selection-summary {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 0.8rem;
    color: var(--app-chrome-muted);
  }
  .collection-sort {
    min-width: 0;
    width: 9rem;
    max-width: 100%;
    padding: 0.4rem 1.4rem 0.4rem 0.5rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.5rem;
    background-color: var(--background-color);
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
  }
  .library-search {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 0.6rem;
    min-width: 0;
    min-height: 44px;
    padding: 0 0.75rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--background-color) 96%, var(--font-color) 4%);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }
  .library-search:focus-within {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--font-color) 32%, transparent);
  }
  .search-icon {
    display: inline-flex;
    flex-shrink: 0;
    font-size: 0.8rem;
    color: var(--app-chrome-muted);
  }
  .library-search input {
    min-width: 0;
    width: 100%;
    flex: 1;
    min-height: 42px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--font-color);
    font: inherit;
    font-size: 0.875rem;
    outline: none;
    box-shadow: none;
  }
  .library-search input:focus {
    border: 0;
    outline: none;
    box-shadow: none;
  }
  .library-search input::placeholder {
    color: color-mix(in srgb, var(--font-color) 48%, transparent);
  }
  .library-search input::-webkit-search-cancel-button {
    display: none;
  }
  .search-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 0.375rem;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
  }
  .search-clear:hover {
    color: var(--font-color);
    background: var(--app-chrome-hover);
  }
  .search-clear:focus-visible {
    outline-offset: -2px;
  }
  .search-results-count {
    flex-shrink: 0;
    white-space: nowrap;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
  }
  .shelves-invitation {
    padding: 1rem 0 3rem;
    color: var(--app-chrome-muted);
    font-size: 0.9rem;
  }
  .shelves-invitation button {
    margin-top: 1rem;
    min-height: 44px;
    color: var(--font-color);
  }
</style>
