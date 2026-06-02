<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faCrosshairs,
    faEllipsisVertical,
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

  let customReadingPointMenuElm: Popover | undefined;
  let mobileMenuElm: Popover | undefined;

  let menuItems: {
    routeId: string;
    label: string;
    icon: IconDefinition;
    title: string;
  }[] = [];

  let mobileMenuItems: {
    label: string;
    icon: IconDefinition;
    title: string;
    action: string;
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

  $: mobileMenuItems = [
    ...(hasText
      ? [
          {
            label: annotationCount ? `Annotations (${annotationCount})` : 'Annotations',
            icon: faHighlighter,
            title: annotationCount ? `Open Annotations (${annotationCount})` : 'Open Annotations',
            action: 'annotationsClick'
          }
        ]
      : []),
    ...(hasBookmarkData
      ? [
          {
            label: 'Return to Bookmark',
            icon: faRotateLeft,
            title: 'Return to Bookmark',
            action: 'scrollToBookmarkClick'
          }
        ]
      : []),
    {
      label: 'Complete Book',
      icon: faFlag,
      title: 'Complete Book',
      action: 'completeBook'
    },
    ...($customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated
      ? customReadingPointMenuItems.map((item) => ({
          label: item.label,
          icon: faCrosshairs,
          title: `${item.label} Reading Point`,
          action: item.action
        }))
      : []),
    ...(showFullscreenButton
      ? [
          {
            label: 'Fullscreen',
            icon: faExpand,
            title: 'Toggle Fullscreen',
            action: 'fullscreenClick'
          }
        ]
      : []),
    ...menuItems.map((item) => ({
      label: item.label,
      icon: item.icon,
      title: item.title,
      action: item.label
    }))
  ];

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm?.close();
  }

  function dispatchMergedAction(action: string) {
    if (action === mergeEntries.STATISTICS.label) {
      dispatch('statisticsClick');
    } else if (action === mergeEntries.JUMP_TO_POSITION.label) {
      dispatch('jumpClick');
    } else if (action === mergeEntries.READER_IMAGE_GALLERY.label) {
      dispatch('readerImageGalleryClick');
    } else if (action === mergeEntries.SETTINGS.label) {
      dispatch('settingsClick');
    } else if (action === mergeEntries.DOMAIN_HINT.label) {
      dispatch('domainHintClick');
    } else if (action === mergeEntries.MANAGE.label) {
      dispatch('bookManagerClick');
    }
  }

  function dispatchMobileMenuAction(action: string) {
    mobileMenuElm?.close();

    if (menuItems.some((item) => item.label === action)) {
      dispatchMergedAction(action);
    } else {
      dispatch(action as any);
    }
  }
</script>

<div
  class="reader-header reader-header--mobile flex items-center justify-between px-2.5 md:hidden {baseHeaderClasses}"
  style={readerHeaderStyle}
>
  <div class="flex min-w-0 items-center">
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
  </div>

  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom-end', 'bottom-start']}
    yOffset={0}
    bind:this={mobileMenuElm}
  >
    <button
      type="button"
      slot="icon"
      title="Open Reader Actions"
      aria-label="Open Reader Actions"
      class={baseIconClasses}
    >
      <Fa icon={faEllipsisVertical} />
    </button>
    <div class="app-menu reader-header-mobile-menu w-56" slot="content">
      {#each mobileMenuItems as actionItem (actionItem.label)}
        <button
          type="button"
          class="app-menu-item"
          title={actionItem.title}
          on:click={() => dispatchMobileMenuAction(actionItem.action)}
        >
          <Fa class="reader-header-mobile-menu-icon" icon={actionItem.icon} />
          <span>{actionItem.label}</span>
        </button>
      {/each}
    </div>
  </Popover>
</div>

<div
  class="reader-header hidden items-center justify-between px-4 md:flex md:px-8 {baseHeaderClasses}"
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
    class="reader-header-title pointer-events-none absolute left-1/2 max-w-[42vw] -translate-x-1/2 truncate px-3 text-center font-normal"
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
      on:action={({ detail }) => dispatchMergedAction(detail)}
    />
  </div>
</div>
