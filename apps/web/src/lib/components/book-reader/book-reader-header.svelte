<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faCrosshairs,
    faExpand,
    faFlag,
    faHighlighter,
    faList,
    faMagnifyingGlass,
    faRotateLeft,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    nTranslateXHeaderFa,
    translateXHeaderFa
  } from '$lib/css-classes';
  import { customReadingPointEnabled$, viewMode$ } from '$lib/data/store';
  import { ViewMode } from '$lib/data/view-mode';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import { isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let hasChapterData: boolean;
  export let hasText: boolean;
  export let autoScrollMultiplier: number;
  export let hasCustomReadingPoint: boolean;
  export let showFullscreenButton: boolean;
  export let isBookmarkScreen: boolean;
  export let hasBookmarkData: boolean;
  export let bookTitle = '';
  export let fontSize = 20;
  export let fontColor = '';
  export let backgroundColor = '';
  export let annotationCount = 0;

  const dispatch = createEventDispatcher<{
    tocClick: void;
    bookmarkClick: void;
    scrollToBookmarkClick: void;
    jumpClick: void;
    completeBook: void;
    fullscreenClick: void;
    showCustomReadingPoint: void;
    setCustomReadingPoint: void;
    resetCustomReadingPoint: void;
    statisticsClick: void;
    readerImageGalleryClick: void;
    annotationsClick: void;
    searchClick: void;
    settingsClick: void;
    domainHintClick: void;
    bookManagerClick: void;
  }>();

  let customReadingPointMenuItems: {
    label: string;
    action: any;
  }[] = [];

  let customReadingPointMenuElm: Popover;

  let menuItems: {
    routeId: string;
    label: string;
    icon: IconDefinition;
    title: string;
  }[] = [];

  $: isOldUrl = browser && isOnOldUrl(window);

  $: customReadingPointMenuItems = [
    ...(hasCustomReadingPoint ? [{ label: 'Show Point', action: 'showCustomReadingPoint' }] : []),
    { label: 'Set Point', action: 'setCustomReadingPoint' },
    ...(hasCustomReadingPoint ? [{ label: 'Reset Point', action: 'resetCustomReadingPoint' }] : [])
  ];

  $: readerHeaderStyle = getReaderChromeStyle({ fontSize, fontColor, backgroundColor });

  $: {
    const items = [];

    if (isOldUrl) {
      items.push(mergeEntries.DOMAIN_HINT);
    } else {
      items.push(mergeEntries.STATISTICS);
    }

    if (hasText) {
      items.push(mergeEntries.JUMP_TO_POSITION);
    }

    if ($readerImageGalleryPictures$.length) {
      items.push(mergeEntries.READER_IMAGE_GALLERY);
    }

    items.push(mergeEntries.SETTINGS, mergeEntries.MANAGE);

    menuItems = items;
  }

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm.toggleOpen();
  }
</script>

<div
  class="reader-header grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 md:px-8 {baseHeaderClasses}"
  style={readerHeaderStyle}
>
  <div class="flex min-w-0 transform-gpu {nTranslateXHeaderFa}">
    {#if hasChapterData}
      <button
        type="button"
        title="Open Table of Contents"
        aria-label="Open Table of Contents"
        class={baseIconClasses}
        on:click={() => dispatch('tocClick')}
      >
        <Fa icon={faList} />
      </button>
    {/if}
    {#if hasText}
      <button
        type="button"
        title="Search Book"
        aria-label="Search Book"
        class={baseIconClasses}
        on:click={() => dispatch('searchClick')}
      >
        <Fa icon={faMagnifyingGlass} />
      </button>
      <button
        type="button"
        title={annotationCount ? `Open Annotations (${annotationCount})` : 'Open Annotations'}
        aria-label="Open Annotations"
        class={baseIconClasses}
        on:click={() => dispatch('annotationsClick')}
      >
        <Fa icon={faHighlighter} />
      </button>
    {/if}
    <button
      type="button"
      title="Create Bookmark"
      aria-label="Create Bookmark"
      class={baseIconClasses}
      on:click={() => dispatch('bookmarkClick')}
    >
      <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
    </button>
    {#if hasBookmarkData}
      <button
        type="button"
        title="Return to Bookmark"
        aria-label="Return to Bookmark"
        class={baseIconClasses}
        on:click={() => dispatch('scrollToBookmarkClick')}
      >
        <Fa icon={faRotateLeft} />
      </button>
    {/if}
    {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
      <div
        class="reader-header-status flex items-center px-3 font-semibold xl:px-2"
        title="Current Autoscroll Speed"
      >
        {autoScrollMultiplier}x
      </div>
    {/if}
  </div>

  <div
    class="reader-header-title hidden max-w-[42vw] truncate px-3 text-center font-normal sm:block"
  >
    {bookTitle}
  </div>

  <div class="flex min-w-0 transform-gpu justify-end {translateXHeaderFa}">
    <button
      type="button"
      title="Complete Book"
      aria-label="Complete Book"
      class={baseIconClasses}
      on:click={() => dispatch('completeBook')}
    >
      <Fa icon={faFlag} />
    </button>
    {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
      <div class="flex">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={customReadingPointMenuElm}
        >
          <button
            type="button"
            slot="icon"
            title="Open Custom Point Actions"
            aria-label="Open Custom Point Actions"
            class={baseIconClasses}
          >
            <Fa icon={faCrosshairs} />
          </button>
          <div class="app-menu w-40 md:w-32" slot="content">
            {#each customReadingPointMenuItems as actionItem (actionItem.label)}
              <button
                type="button"
                class="app-menu-item"
                on:click={() => dispatchCustomReadingPointAction(actionItem.action)}
              >
                {actionItem.label}
              </button>
            {/each}
          </div>
        </Popover>
      </div>
    {/if}
    {#if showFullscreenButton}
      <button
        type="button"
        title="Toggle Fullscreen"
        aria-label="Toggle Fullscreen"
        class={baseIconClasses}
        on:click={() => dispatch('fullscreenClick')}
      >
        <Fa icon={faExpand} />
      </button>
    {/if}
    <MergedHeaderIcon
      disableRouteNavigation
      items={menuItems}
      on:action={({ detail }) => {
        if (detail === mergeEntries.STATISTICS.label) {
          dispatch('statisticsClick');
        } else if (detail === mergeEntries.JUMP_TO_POSITION.label) {
          dispatch('jumpClick');
        } else if (detail === mergeEntries.READER_IMAGE_GALLERY.label) {
          dispatch('readerImageGalleryClick');
        } else if (detail === mergeEntries.SETTINGS.label) {
          dispatch('settingsClick');
        } else if (detail === mergeEntries.DOMAIN_HINT.label) {
          dispatch('domainHintClick');
        } else if (detail === mergeEntries.MANAGE.label) {
          dispatch('bookManagerClick');
        }
      }}
    />
  </div>
</div>
