<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { faCheck, faMinus, faXmark } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Modal from '$lib/components/modal.svelte';
  import BookThumbnail from './book-thumbnail.svelte';
  import { libraryCollections$ } from '$lib/data/library-collections';
  import type { BookCardProps } from './book-card-props';
  import { getLanguageKey, getLanguageLabel } from './book-language';
  import {
    collectionBookSortOptions,
    getCollectionBooks,
    type CollectionBookSort,
    type LibraryCollection
  } from './library-organization';

  export let books: BookCardProps[];
  export let collection: LibraryCollection;

  const dispatch = createEventDispatcher<{ close: void }>();
  const existing = $libraryCollections$.some((item) => item.id === collection.id);
  let modal: Modal;
  let name = collection.name;
  let selectedIds = new Set(collection.bookIds);
  let query = '';
  let language = 'all';
  let sort: CollectionBookSort = collection.sort || 'title';
  let error = '';
  let showDiscardConfirmation = false;
  let discardDialog: Modal;
  const originalBookIds = new Set(collection.bookIds);
  $: hasChanges =
    name.trim() !== collection.name.trim() ||
    sort !== (collection.sort || 'title') ||
    selectedIds.size !== originalBookIds.size ||
    [...selectedIds].some((id) => !originalBookIds.has(id));

  function confirmClose() {
    if (!hasChanges) return true;
    showDiscardConfirmation = true;
    return false;
  }

  async function discardChanges() {
    // Unmount the nested dialog first so its scroll/focus cleanup runs before the editor's.
    showDiscardConfirmation = false;
    await tick();
    modal.close();
  }

  $: languages = [...new Set(books.map((book) => getLanguageKey(book.language)))].sort(
    (a, b) => Number(!a) - Number(!b) || getLanguageLabel(a).localeCompare(getLanguageLabel(b))
  );
  $: matchingBooks = books.filter(
    (book) =>
      book.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (language === 'all' || getLanguageKey(book.language) === language)
  );
  $: sortedBooks = getCollectionBooks(matchingBooks, {
    ...collection,
    bookIds: matchingBooks.map((book) => book.id),
    sort
  });
  $: selectedBooks = getCollectionBooks(books, {
    ...collection,
    bookIds: [...selectedIds],
    sort
  });
  $: selectedMatchingCount = matchingBooks.filter((book) => selectedIds.has(book.id)).length;
  $: allMatchingSelected =
    matchingBooks.length > 0 && selectedMatchingCount === matchingBooks.length;
  $: partlySelected = selectedMatchingCount > 0 && !allMatchingSelected;
  $: filtered = !!query.trim() || language !== 'all';
  $: resultLabel = filtered
    ? `${matchingBooks.length} ${matchingBooks.length === 1 ? 'result' : 'results'}`
    : `${matchingBooks.length} ${matchingBooks.length === 1 ? 'book' : 'books'}`;

  function indeterminate(input: HTMLInputElement, value: boolean) {
    input.indeterminate = value;
    return { update: (next: boolean) => (input.indeterminate = next) };
  }

  function toggleBook(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function toggleMatching() {
    const next = new Set(selectedIds);
    for (const book of matchingBooks) {
      if (allMatchingSelected) next.delete(book.id);
      else next.add(book.id);
    }
    selectedIds = next;
  }

  function persist(collections: LibraryCollection[]) {
    try {
      localStorage.setItem('libraryCollections', JSON.stringify(collections));
      libraryCollections$.next(collections);
      modal.close();
    } catch {
      error = 'Unable to save your collections. Your browser storage may be full.';
    }
  }

  function save() {
    if (!name.trim()) return;
    const saved = { ...collection, name: name.trim(), bookIds: [...selectedIds], sort };
    persist(
      existing
        ? $libraryCollections$.map((item) => (item.id === saved.id ? saved : item))
        : [...$libraryCollections$, saved]
    );
  }
</script>

<Modal
  bind:this={modal}
  id="collection-editor"
  title={existing ? 'Edit collection' : 'New collection'}
  width="64rem"
  contained
  beforeClose={confirmClose}
  on:close={() => dispatch('close')}
>
  <form id="collection-editor-form" on:submit|preventDefault={save}>
    <section class="collection-details" aria-label="Your collection">
      <label class="field collection-name"
        >Collection name
        <input
          data-modal-autofocus
          required
          maxlength="80"
          bind:value={name}
          placeholder="e.g., Evening reading"
        />
      </label>
      <div class="selection-preview">
        <div class="selected-heading">
          <h3>Selected books</h3>
          <span aria-live="polite">{selectedIds.size} selected</span>
        </div>
        {#if selectedBooks.length}
          <ul class="selected-books" aria-label="Selected books">
            {#each selectedBooks as book (book.id)}
              <li>
                <BookThumbnail imagePath={book.imagePath} />
                <span class="selected-title" title={book.title}>{book.title}</span>
                <button
                  type="button"
                  class="remove-book"
                  aria-label={`Remove ${book.title} from collection`}
                  on:click={() => toggleBook(book.id)}><Fa icon={faXmark} /></button
                >
              </li>
            {/each}
          </ul>
        {:else}
          <p class="selection-hint">Choose the books you want to keep together.</p>
        {/if}
      </div>
    </section>
    <section class="book-browser" aria-label="Browse books">
      <div class="picker-toolbar">
        <label class="field search-field">
          <span class="sr-only">Search books</span>
          <input type="search" bind:value={query} placeholder="Search your books" />
        </label>
        <label class="field">
          <span class="sr-only">Language</span>
          <select aria-label="Language" title="Language" bind:value={language}>
            <option value="all">All languages</option>
            {#each languages as code}<option value={code}>{getLanguageLabel(code)}</option>{/each}
          </select>
        </label>
        <label class="field">
          <span class="sr-only">Sort books</span>
          <select aria-label="Sort books" title="Sort books" bind:value={sort}>
            {#each collectionBookSortOptions as option}<option value={option.value}
                >{option.label}</option
              >{/each}
          </select>
        </label>
      </div>
      <div class="picker-summary">
        <label class="results-selection" class:disabled={!matchingBooks.length}>
          <input
            type="checkbox"
            aria-label={`Select all ${resultLabel}`}
            checked={allMatchingSelected}
            use:indeterminate={partlySelected}
            disabled={!matchingBooks.length}
            on:change={toggleMatching}
          />
          <span class="checkmark" aria-hidden="true"
            ><Fa icon={partlySelected ? faMinus : faCheck} /></span
          >
          <span aria-live="polite">{resultLabel}</span>
        </label>
      </div>
      <div class="book-picker" role="group" aria-label="Choose books">
        {#each sortedBooks as book (book.id)}
          <label class="book-option" class:book-option--selected={selectedIds.has(book.id)}>
            <input
              type="checkbox"
              aria-label={book.title}
              checked={selectedIds.has(book.id)}
              on:change={() => toggleBook(book.id)}
            />
            <span class="checkmark" aria-hidden="true"><Fa icon={faCheck} /></span>
            <BookThumbnail imagePath={book.imagePath} />
            <span class="book-copy">
              <span class="book-title" title={book.title}>{book.title}</span>
              <span class="book-language">{getLanguageLabel(book.language)}</span>
            </span>
          </label>
        {/each}
        {#if !matchingBooks.length}<p class="empty">No matching books.</p>{/if}
      </div>
    </section>
    <div class="collection-save">
      {#if error}<p role="alert" class="error">{error}</p>{/if}
      <button type="submit" class="app-button app-button--primary" disabled={!name.trim()}
        >Save collection</button
      >
      {#if existing}
        <button
          type="button"
          class="app-button remove"
          on:click={() => persist($libraryCollections$.filter((item) => item.id !== collection.id))}
          >Remove collection</button
        >
      {/if}
    </div>
  </form>
</Modal>

{#if showDiscardConfirmation}
  <Modal
    bind:this={discardDialog}
    id="discard-collection"
    title="Discard changes?"
    description="Your changes to this collection haven’t been saved."
    on:close={() => (showDiscardConfirmation = false)}
  >
    <svelte:fragment slot="footer">
      <button
        type="button"
        class="app-button app-button--primary"
        data-modal-autofocus
        on:click={() => discardDialog.close()}>Keep editing</button
      >
      <button type="button" class="app-button discard" on:click={discardChanges}>Discard</button>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, clamp(12rem, 28%, 17rem));
    grid-template-rows: minmax(0, 1fr) auto;
    column-gap: 1.5rem;
    height: min(40rem, calc(100dvh - 6rem));
    min-height: 0;
  }
  .collection-details,
  .book-browser {
    container-type: inline-size;
    container-name: collection-browser;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .collection-details {
    grid-column: 2;
    grid-row: 1;
    padding-left: 1.5rem;
    border-left: 1px solid var(--app-surface-border);
  }
  .selection-preview {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .collection-name {
    flex-shrink: 0;
  }
  .collection-save {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem 0 0 1.5rem;
    border-left: 1px solid var(--app-surface-border);
  }
  .field {
    display: grid;
    gap: 0.4rem;
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
  }
  .field input,
  .field select {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.5rem;
    color: var(--font-color);
    background-color: var(--background-color);
    font-size: 0.85rem;
  }
  .field select {
    padding-right: 2rem;
  }
  .field input::placeholder {
    color: var(--app-chrome-muted);
  }
  .field input:focus,
  .field select:focus {
    box-shadow: none;
    border-color: var(--app-accent);
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--app-accent);
    outline-offset: 2px;
  }
  .selected-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 1.75rem 0 0.75rem;
    flex-shrink: 0;
  }
  h3 {
    font-size: 0.8rem;
    font-weight: 550;
  }
  .selected-heading span {
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
  }
  .selection-hint {
    color: var(--app-chrome-muted);
    font-size: 0.8rem;
    line-height: 1.6;
  }
  .selected-books {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 3px;
    margin: -3px;
  }
  .selected-books li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0;
    --book-thumbnail-width: 28px;
  }
  .selected-title {
    min-width: 0;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .remove-book {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 32px;
    height: 36px;
    border-radius: 0.4rem;
    color: var(--app-chrome-muted);
  }
  .remove-book:hover {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  .remove-book:focus-visible {
    outline: 2px solid var(--app-accent);
    outline-offset: 2px;
  }
  .book-browser {
    grid-column: 1;
    grid-row: 1 / -1;
    gap: 0.75rem;
  }
  .picker-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 9rem) minmax(0, 9rem);
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .picker-summary {
    padding-inline: 0.75rem;
    flex-shrink: 0;
    border-bottom: 1px solid var(--app-surface-border);
  }
  .results-selection {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    gap: 0.85rem;
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
    cursor: pointer;
    border-radius: 0.3rem;
  }
  .results-selection.disabled {
    opacity: 0.5;
    cursor: default;
  }
  .book-picker {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 3px;
    margin: -3px;
  }
  .book-option {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-height: 72px;
    padding: 0.6rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .book-option:hover {
    background: var(--app-chrome-hover);
  }
  .book-option--selected {
    background: var(--app-accent-soft);
  }
  .book-option input,
  .results-selection input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .book-option:has(input:focus-visible),
  .results-selection:has(input:focus-visible) {
    outline: 2px solid var(--app-accent);
    outline-offset: 2px;
  }
  .checkmark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border: 1px solid color-mix(in srgb, var(--font-color) 35%, transparent);
    border-radius: 0.3rem;
    font-size: 0.65rem;
    background: var(--background-color);
  }
  .checkmark :global(svg) {
    opacity: 0;
  }
  input:checked + .checkmark,
  input:indeterminate + .checkmark {
    background: var(--app-accent);
    color: var(--app-accent-contrast);
    border-color: var(--app-accent);
  }
  input:checked + .checkmark :global(svg),
  input:indeterminate + .checkmark :global(svg) {
    opacity: 1;
  }
  .book-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .book-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .book-language {
    color: var(--app-chrome-muted);
    font-size: 0.7rem;
  }
  .empty {
    color: var(--app-chrome-muted);
    padding: 1rem;
    text-align: center;
    font-size: 0.85rem;
  }
  .remove {
    color: var(--app-danger);
  }
  .error {
    color: var(--app-danger);
    font-size: 0.8rem;
  }
  .discard {
    color: var(--app-danger);
    border-color: color-mix(in srgb, var(--app-danger) 35%, transparent);
  }
  .discard:hover {
    background: color-mix(in srgb, var(--app-danger) 10%, var(--background-color));
  }
  @container collection-browser (max-width: 32rem) {
    .picker-toolbar {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .search-field {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 599px), (max-width: 799px) and (min-height: 600px) {
    form {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 0.75rem;
    }
    .collection-details {
      display: contents;
    }
    .collection-name {
      grid-row: 1;
    }
    .selection-preview {
      grid-row: 2;
      max-height: 8.5rem;
    }
    .selected-heading {
      margin-top: 0.25rem;
      margin-bottom: 0.5rem;
    }
    .book-browser {
      grid-column: 1;
      grid-row: 3;
    }
    .collection-save {
      grid-column: 1;
      grid-row: 4;
      padding: 0.25rem 0 0;
      border-left: 0;
    }
    .picker-toolbar {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .search-field {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 599px) and (max-height: 599px) {
    form {
      grid-template-rows: auto minmax(0, 1fr) auto;
    }
    .selection-preview {
      display: none;
    }
    .book-browser {
      grid-row: 2;
      gap: 0.5rem;
    }
    .collection-save {
      grid-row: 3;
    }
    .field input,
    .field select {
      min-height: 36px;
      padding-block: 0.4rem;
    }
    .results-selection {
      min-height: 24px;
    }
    .book-option {
      min-height: 56px;
      padding-block: 0.35rem;
      --book-thumbnail-width: 28px;
    }
  }
  @media (max-width: 420px) {
    .book-option {
      padding-inline: 0.4rem;
      gap: 0.6rem;
    }
    .picker-summary {
      padding-inline: 0.4rem;
    }
    .results-selection {
      gap: 0.6rem;
    }
  }
</style>
