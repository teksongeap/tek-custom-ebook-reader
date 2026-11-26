<script lang="ts">
  import { faCheckCircle, faInfo } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import Popover from '$lib/components/popover/popover.svelte';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[] = [];
  export let currentBookId: number | undefined;
  export let selectedBookIds: ReadonlySet<number>;
  export let selectMode = false;
  export let visibleCount = Infinity;

  const dispatch = createEventDispatcher<{
    bookClick: {
      id: number;
    };
  }>();

  function onBookCardClick(id: number) {
    dispatch('bookClick', { id });
  }

  function getCardDateInfo(dateTime: number) {
    return dateTime ? new Date(dateTime).toLocaleString() : 'No Data';
  }
</script>

<div
  class="book-card-grid grid grid-cols-3 justify-between gap-x-4 gap-y-6 pb-6 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:gap-x-6"
>
  {#each bookCards as bookCard, index (bookCard.id)}
    <div
      inert={index >= visibleCount}
      aria-hidden={index >= visibleCount ? 'true' : undefined}
      class="book-card-item relative"
      class:book-card-item--placeholder={bookCard.isPlaceholder}
      class:opacity-60={bookCard.isPlaceholder}
    >
      <div
        class="book-card-shell relative"
        class:book-card-shell--selected={selectedBookIds.has(bookCard.id)}
        class:book-card-shell--current={bookCard.id === currentBookId}
      >
        <BookCard
          {...bookCard}
          selected={selectMode ? selectedBookIds.has(bookCard.id) : undefined}
          on:click={() => onBookCardClick(bookCard.id)}
        />

        {#if selectedBookIds.has(bookCard.id)}
          <div aria-hidden="true" class="book-card-selected-overlay absolute inset-0">
            <Fa
              class="book-card-selected-icon absolute left-2 top-2 flex text-xl"
              icon={faCheckCircle}
            />
          </div>
        {/if}
      </div>
      {#if !selectMode}
        <div class="absolute top-2 right-2">
          <Popover
            placement="right-start"
            fallbackPlacements={['left-start', 'bottom-start', 'top-start']}
            yOffset={5}
            portal
          >
            <button
              slot="icon"
              type="button"
              title="Book details"
              aria-label={`Details for ${bookCard.title}`}
              class="book-card-floating-action book-card-floating-action--info h-8 w-8"
              ><Fa icon={faInfo} /></button
            >
            <div class="book-card-detail-popover p-4" slot="content">
              <div class="book-card-detail-label">Characters:</div>
              <div class="w-40">{bookCard.characters || 'No Data'}</div>
              <div class="book-card-detail-label mt-4">Last Read:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookOpen)}</div>
              <div class="book-card-detail-label mt-4">Bookmarked:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookmarkModified)}</div>
              <div class="book-card-detail-label mt-4">Last Update:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookModified)}</div>
            </div>
          </Popover>
        </div>
      {/if}
    </div>
  {/each}
</div>
