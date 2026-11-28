<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faArrowLeft,
    faBookmark as fasBookmark,
    faChevronUp,
    faCrosshairs,
    faGear,
    faEllipsisVertical,
    faExpand,
    faFlag,
    faHighlighter,
    faList,
    faMagnifyingGlass,
    faRotateLeft,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from './book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import SoundToggle from '$lib/components/sound-toggle.svelte';
  import { customReadingPointEnabled$, viewMode$ } from '$lib/data/store';
  import { ViewMode } from '$lib/data/view-mode';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';
  import { isOnOldUrl } from '$lib/functions/utils';
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
  export let isFinished = false;

  const dispatch = createEventDispatcher<{
    tocClick: void;
    bookmarkClick: void;
    scrollToBookmarkClick: void;
    jumpClick: void;
    completeBook: void;
    restartBook: void;
    markUnfinished: void;
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
    hideControls: void;
  }>();

  type Action = Exclude<Parameters<typeof dispatch>[0], 'hideControls'>;
  type MenuItem = { label: string; icon: IconDefinition; action: Action };
  let menu: Popover;
  $: readerHeaderStyle = getReaderChromeStyle({ fontSize, fontColor, backgroundColor });
  $: menuItems = [
    ...(hasText
      ? [
          {
            label: 'Jump to position',
            icon: mergeEntries.JUMP_TO_POSITION.icon,
            action: 'jumpClick'
          }
        ]
      : []),
    {
      label: 'Create bookmark',
      icon: isBookmarkScreen ? fasBookmark : farBookmark,
      action: 'bookmarkClick'
    },
    ...(hasBookmarkData
      ? [{ label: 'Return to bookmark', icon: faRotateLeft, action: 'scrollToBookmarkClick' }]
      : []),
    ...(isFinished
      ? [
          { label: 'Restart book', icon: faRotateLeft, action: 'restartBook' },
          { label: 'Mark as unfinished', icon: faFlag, action: 'markUnfinished' }
        ]
      : [{ label: 'Complete book', icon: faFlag, action: 'completeBook' }]),
    ...($customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated
      ? [
          ...(hasCustomReadingPoint
            ? [
                {
                  label: 'Show reading point',
                  icon: faCrosshairs,
                  action: 'showCustomReadingPoint'
                }
              ]
            : []),
          { label: 'Set reading point', icon: faCrosshairs, action: 'setCustomReadingPoint' },
          ...(hasCustomReadingPoint
            ? [
                {
                  label: 'Reset reading point',
                  icon: faCrosshairs,
                  action: 'resetCustomReadingPoint'
                }
              ]
            : [])
        ]
      : []),
    ...(browser && isOnOldUrl(window)
      ? [
          {
            label: 'Old domain information',
            icon: mergeEntries.DOMAIN_HINT.icon,
            action: 'domainHintClick'
          }
        ]
      : [{ label: 'Statistics', icon: mergeEntries.STATISTICS.icon, action: 'statisticsClick' }]),
    ...($readerImageGalleryPictures$.length
      ? [
          {
            label: 'Image gallery',
            icon: mergeEntries.READER_IMAGE_GALLERY.icon,
            action: 'readerImageGalleryClick'
          }
        ]
      : [])
  ] as MenuItem[];

  function runAction(action: Action) {
    // Navigation unmounts the menu and supplies its own sound.
    if (action !== 'statisticsClick') menu.toggleOpen();
    dispatch(action);
  }
</script>

<nav class="reader-header" style={readerHeaderStyle} aria-label="Reader controls">
  <div class="reader-toolbar">
    <div class="reader-toolbar-actions" role="group" aria-label="Book navigation and notes">
      <button
        type="button"
        class="app-toolbar-button"
        title="Back to library"
        aria-label="Back to library"
        data-sound="none"
        on:click={() => dispatch('bookManagerClick')}
      >
        <Fa icon={faArrowLeft} /><span class="app-toolbar-label">Library</span>
      </button>
      <span class="app-toolbar-divider" aria-hidden="true"></span>
      {#if hasChapterData}
        <button
          type="button"
          class="app-toolbar-button"
          title="Open table of contents"
          aria-label="Open table of contents"
          on:click={() => dispatch('tocClick')}
        >
          <Fa icon={faList} /><span class="app-toolbar-label">Contents</span>
        </button>
      {/if}
      {#if hasText}
        <button
          type="button"
          class="app-toolbar-button"
          title="Search book"
          aria-label="Search book"
          on:click={() => dispatch('searchClick')}
        >
          <Fa icon={faMagnifyingGlass} /><span class="app-toolbar-label">Search</span>
        </button>
        <button
          type="button"
          class="app-toolbar-button"
          title={annotationCount ? `Annotations (${annotationCount})` : 'Annotations'}
          aria-label={annotationCount ? `Annotations (${annotationCount})` : 'Annotations'}
          on:click={() => dispatch('annotationsClick')}
        >
          <Fa icon={faHighlighter} /><span class="app-toolbar-label">Annotations</span>
        </button>
      {/if}
    </div>
    <span class="reader-header-title reader-toolbar-title" title={bookTitle}>{bookTitle}</span>
    <div class="reader-toolbar-actions" role="group" aria-label="Reader settings and display">
      <SoundToggle />
      <button
        type="button"
        class="app-toolbar-button"
        title="Reader settings"
        aria-label="Reader settings"
        data-sound="none"
        on:click={() => dispatch('settingsClick')}
      >
        <Fa icon={faGear} /><span class="app-toolbar-label">Settings</span>
      </button>
      {#if showFullscreenButton}
        <button
          type="button"
          class="app-toolbar-button"
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
          on:click={() => dispatch('fullscreenClick')}
        >
          <Fa icon={faExpand} /><span class="app-toolbar-label">Fullscreen</span>
        </button>
      {/if}
      <Popover
        placement="bottom-end"
        fallbackPlacements={['bottom-end', 'bottom-start']}
        yOffset={4}
        bind:this={menu}
      >
        <button
          type="button"
          slot="icon"
          class="app-toolbar-button"
          title="More reader actions"
          aria-label="More reader actions"
        >
          <Fa icon={faEllipsisVertical} />
        </button>
        <div class="app-menu reader-toolbar-menu" slot="content">
          {#each menuItems as item (item.action)}
            <button
              type="button"
              class="app-menu-item"
              data-sound={item.action === 'statisticsClick' ? 'none' : undefined}
              on:click={() => runAction(item.action)}
            >
              <Fa icon={item.icon} /><span>{item.label}</span>
            </button>
          {/each}
          {#if $viewMode$ === ViewMode.Continuous}
            <div class="reader-toolbar-menu-status">Autoscroll speed: {autoScrollMultiplier}x</div>
          {/if}
        </div>
      </Popover>
      <button
        id="reader-header-toggle"
        type="button"
        class="reader-chrome-toggle"
        title="Hide controls"
        aria-label="Hide reader controls"
        aria-expanded="true"
        aria-controls="reader-controls"
        on:click={() => dispatch('hideControls')}
      >
        <Fa icon={faChevronUp} />
      </button>
    </div>
  </div>
</nav>
