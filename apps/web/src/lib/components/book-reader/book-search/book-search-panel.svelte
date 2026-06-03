<script lang="ts">
  import { browser } from '$app/environment';
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { faArrowRight, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
  import {
    getReaderSearchExcerpt,
    getCachedReaderSearchIndex,
    searchReaderIndex,
    type ReaderSearchBlock,
    type ReaderSearchResult
  } from '$lib/functions/reader-reference-layer/search';
  import type { ReaderTargetNavigation } from '$lib/functions/reader-reference-layer/navigation';
  import type { SectionWithProgress } from '$lib/components/book-reader/book-toc/book-toc';
  import { getReaderChromeStyle } from '$lib/functions/reader-typography';

  export let htmlContent = '';
  export let searchCacheKey: string | number | undefined;
  export let sectionData: SectionWithProgress[] = [];
  export let fontSize = 20;
  export let fontColor = '';
  export let backgroundColor = '';

  const dispatch = createEventDispatcher<{
    close: void;
    jump: ReaderTargetNavigation;
  }>();

  let searchInputEl: HTMLInputElement | undefined;
  let searchQuery = '';
  let searchIndex: ReaderSearchBlock[] = [];
  let searchIndexHtmlContent = '';
  let searchIndexLoading = false;
  let searchIndexBuildToken = 0;
  let hasLegacyReferenceMarkers = false;

  $: panelStyle = getReaderChromeStyle({ fontSize, fontColor, backgroundColor });
  $: searchResults = searchReaderIndex(searchIndex, searchQuery);
  $: panelSubtitle = getPanelSubtitle(
    searchQuery,
    searchResults,
    searchIndex.length,
    searchIndexLoading
  );
  $: if (browser && htmlContent !== searchIndexHtmlContent) {
    scheduleSearchIndexBuild(htmlContent);
  }

  onMount(async () => {
    await tick();
    searchInputEl?.focus();
  });

  onDestroy(() => {
    searchIndexBuildToken += 1;
  });

  function getPanelSubtitle(
    query: string,
    results: ReaderSearchResult[],
    searchableBlockCount: number,
    isLoading: boolean
  ) {
    if (isLoading) {
      return 'Preparing search...';
    }

    if (!query.trim()) {
      return `${searchableBlockCount} searchable passages`;
    }

    return `${results.length} ${results.length === 1 ? 'match' : 'matches'}`;
  }

  function scheduleSearchIndexBuild(nextHtmlContent: string) {
    const buildToken = ++searchIndexBuildToken;
    const cacheKey = searchCacheKey;

    searchIndexHtmlContent = nextHtmlContent;
    searchIndex = [];
    searchIndexLoading = !!nextHtmlContent;
    hasLegacyReferenceMarkers = false;

    if (!nextHtmlContent) {
      searchIndexLoading = false;
      return;
    }

    waitForSearchIndexSlot().then(() => {
      if (buildToken !== searchIndexBuildToken) {
        return;
      }

      searchIndex = getCachedReaderSearchIndex(nextHtmlContent, cacheKey);
      hasLegacyReferenceMarkers =
        !nextHtmlContent.includes('data-ttu-search-block-id') &&
        !nextHtmlContent.includes('data-ttu-link-kind');
      searchIndexLoading = false;
    });
  }

  function waitForSearchIndexSlot() {
    return new Promise<void>((resolve) => {
      const requestIdleCallback = (
        window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        }
      ).requestIdleCallback;

      if (requestIdleCallback) {
        requestIdleCallback(() => resolve(), { timeout: 700 });
        return;
      }

      requestAnimationFrame(() => setTimeout(resolve));
    });
  }

  function jumpToResult(result: ReaderSearchResult) {
    dispatch('jump', {
      target: result.target,
      highlight: result.preciseTarget
    });
  }

  function getSearchResultLocationLabel(result: ReaderSearchResult) {
    return (
      getNearestLabeledSection(getSearchResultSection(result))?.label ||
      result.sourceHref ||
      'Current book'
    );
  }

  function getSearchResultSection(result: ReaderSearchResult) {
    if (result.target.sectionId) {
      const section = sectionData.find((item) => item.reference === result.target.sectionId);

      if (section) {
        return section;
      }
    }

    if (result.sourceHref && result.target.fragment) {
      const fragmentSection = sectionData.find(
        (section) =>
          section.sourceHref === result.sourceHref &&
          section.targetFragment === result.target.fragment
      );

      if (fragmentSection) {
        return fragmentSection;
      }
    }

    if (result.sourceHref) {
      return sectionData.find((section) => section.sourceHref === result.sourceHref);
    }

    return undefined;
  }

  function getNearestLabeledSection(section: SectionWithProgress | undefined) {
    let currentSection = section;

    while (currentSection) {
      if (currentSection.label) {
        return currentSection;
      }

      currentSection = currentSection.parentChapter
        ? sectionData.find((item) => item.reference === currentSection?.parentChapter)
        : undefined;
    }

    return undefined;
  }
</script>

<div
  class="book-search-panel"
  style={panelStyle}
  on:touchmove|stopPropagation={() => {}}
  on:wheel|stopPropagation={() => {}}
>
  <div class="book-search-panel-header">
    <div class="book-search-panel-title">
      <span class="book-search-panel-title-icon"><Fa icon={faMagnifyingGlass} /></span>
      <div>
        <div class="book-search-panel-title-main">Search</div>
        <div class="book-search-panel-title-sub">{panelSubtitle}</div>
      </div>
    </div>
    <button
      type="button"
      class="book-search-panel-close"
      title="Close search"
      aria-label="Close search"
      on:click={() => dispatch('close')}
    >
      <Fa icon={faXmark} />
    </button>
  </div>

  <div class="book-search-panel-controls">
    <div class="book-search-panel-search">
      <span class="book-search-panel-control-icon" aria-hidden="true">
        <Fa icon={faMagnifyingGlass} />
      </span>
      <input
        bind:this={searchInputEl}
        type="search"
        bind:value={searchQuery}
        placeholder="Search book"
        aria-label="Search book"
        on:keydown|stopPropagation={() => {}}
      />
      {#if searchQuery}
        <button
          type="button"
          class="book-search-panel-search-clear"
          title="Clear search"
          aria-label="Clear search"
          on:click={() => (searchQuery = '')}
          on:keydown|stopPropagation={() => {}}
        >
          <Fa icon={faXmark} />
        </button>
      {/if}
    </div>
  </div>

  {#if hasLegacyReferenceMarkers}
    <div class="book-search-panel-notice" role="status">
      <div class="book-search-panel-notice-title">Older import</div>
      <div class="book-search-panel-notice-copy">
        Search still works, but some jumps may land near the result. Re-import this book for exact
        search jumps and footnote previews.
      </div>
    </div>
  {/if}

  <div class="book-search-panel-list">
    {#if searchResults.length}
      {#each searchResults as result (result.id)}
        {@const excerpt = getReaderSearchExcerpt(result)}
        {@const locationLabel = getSearchResultLocationLabel(result)}
        <button type="button" class="book-search-result" on:click={() => jumpToResult(result)}>
          <span class="book-search-result-copy">
            <span>{excerpt.before}</span><mark>{excerpt.match}</mark><span>{excerpt.after}</span>
          </span>
          <span class="book-search-result-meta">
            <span title={locationLabel}>{locationLabel}</span>
            {#if !result.preciseTarget}
              <span class="book-search-result-quality">Approximate</span>
            {/if}
            <Fa icon={faArrowRight} />
          </span>
        </button>
      {/each}
    {:else if searchIndexLoading}
      <div class="book-search-panel-empty">
        <div class="book-search-panel-empty-icon"><Fa icon={faMagnifyingGlass} /></div>
        <div class="book-search-panel-empty-title">Preparing search</div>
        <div class="book-search-panel-empty-copy">Indexing book text.</div>
      </div>
    {:else if searchQuery.trim()}
      <div class="book-search-panel-empty">
        <div class="book-search-panel-empty-icon"><Fa icon={faMagnifyingGlass} /></div>
        <div class="book-search-panel-empty-title">No matches</div>
        <div class="book-search-panel-empty-copy">Try another word or phrase.</div>
      </div>
    {:else}
      <div class="book-search-panel-empty">
        <div class="book-search-panel-empty-icon"><Fa icon={faMagnifyingGlass} /></div>
        <div class="book-search-panel-empty-title">Find a passage</div>
        <div class="book-search-panel-empty-copy">Search the current book text.</div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .book-search-panel {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    overscroll-behavior: contain;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--reader-page-bg) 94%, var(--reader-page-text) 6%),
        color-mix(in srgb, var(--reader-page-bg) 88%, var(--reader-page-text) 12%)
      ),
      var(--reader-page-bg);
    color: var(--reader-page-text);
    font-size: var(--reader-ui-font-size);
  }

  .book-search-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, transparent);
    padding: 1rem;
  }

  .book-search-panel-title {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
  }

  .book-search-panel-title-icon,
  .book-search-panel-empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--app-accent) 16%, transparent);
    color: var(--app-accent);
  }

  .book-search-panel-title-icon {
    height: 2.35rem;
    width: 2.35rem;
    flex: 0 0 auto;
  }

  .book-search-panel-title-main {
    font-size: var(--reader-ui-title-font-size);
    font-weight: 850;
    line-height: 1.1;
  }

  .book-search-panel-title-sub {
    margin-top: 0.15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: var(--reader-ui-small-font-size);
    line-height: 1.1;
  }

  .book-search-panel-close,
  .book-search-panel-search-clear {
    display: inline-flex;
    flex: 0 0 auto;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: color-mix(in srgb, var(--reader-page-text) 62%, transparent);
    outline: none;
  }

  .book-search-panel-close {
    height: 2.2rem;
    width: 2.2rem;
    border-radius: 0.5rem;
  }

  .book-search-panel-search-clear {
    height: 1.5rem;
    width: 1.5rem;
    border-radius: 0.4rem;
  }

  .book-search-panel-close:hover,
  .book-search-panel-close:focus-visible,
  .book-search-panel-search-clear:hover,
  .book-search-panel-search-clear:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
  }

  .book-search-panel-controls {
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    padding: 0.75rem 1rem;
  }

  .book-search-panel-notice {
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    background: color-mix(in srgb, #f5c84b 13%, transparent);
    padding: 0.75rem 1rem;
  }

  .book-search-panel-notice-title {
    color: var(--reader-page-text);
    font-size: var(--reader-ui-small-font-size);
    font-weight: 850;
    line-height: 1.2;
  }

  .book-search-panel-notice-copy {
    margin-top: 0.2rem;
    color: color-mix(in srgb, var(--reader-page-text) 68%, transparent);
    font-size: var(--reader-ui-small-font-size);
    line-height: 1.4;
  }

  .book-search-panel-search {
    display: flex;
    min-height: 2.35rem;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--reader-page-bg) 86%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 74%, transparent);
    padding: 0 0.65rem;
  }

  .book-search-panel-search:focus-within {
    border-color: color-mix(in srgb, var(--app-accent) 62%, transparent);
    box-shadow: var(--app-focus-ring);
  }

  .book-search-panel-control-icon {
    display: inline-flex;
    flex: 0 0 auto;
    font-size: var(--reader-ui-small-font-size);
  }

  .book-search-panel-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--reader-page-text);
    font: inherit;
    font-size: var(--reader-ui-small-font-size);
    font-weight: 720;
    outline: none;
  }

  .book-search-panel-search input::placeholder {
    color: color-mix(in srgb, var(--reader-page-text) 44%, transparent);
  }

  .book-search-panel-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0.75rem;
  }

  .book-search-result {
    display: grid;
    width: 100%;
    gap: 0.55rem;
    margin-bottom: 0.625rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 11%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--reader-page-bg) 90%, transparent);
    color: inherit;
    padding: 0.8rem;
    text-align: left;
    outline: none;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .book-search-result:hover,
  .book-search-result:focus-visible {
    border-color: color-mix(in srgb, var(--app-accent) 52%, transparent);
    box-shadow: 0 16px 34px rgba(5, 7, 10, 0.16);
    transform: translateY(-1px);
  }

  .book-search-result-copy {
    color: color-mix(in srgb, var(--reader-page-text) 86%, transparent);
    font-size: var(--reader-reading-font-size);
    line-height: 1.5;
  }

  .book-search-result-copy mark {
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--app-accent) 30%, transparent);
    color: var(--reader-page-text);
    padding: 0.05rem 0.12rem;
  }

  .book-search-result-meta {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: color-mix(in srgb, var(--reader-page-text) 52%, transparent);
    font-size: var(--reader-ui-small-font-size);
    font-weight: 740;
  }

  .book-search-result-meta span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-search-result-quality {
    flex: 0 0 auto;
    border-radius: 999px;
    background: color-mix(in srgb, #f5c84b 15%, transparent);
    color: color-mix(in srgb, var(--reader-page-text) 72%, transparent);
    padding: 0.15rem 0.45rem;
  }

  .book-search-panel-empty {
    display: grid;
    justify-items: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .book-search-panel-empty-icon {
    height: 3rem;
    width: 3rem;
    margin-bottom: 0.85rem;
    font-size: 1.1rem;
  }

  .book-search-panel-empty-title {
    font-size: var(--reader-ui-title-font-size);
    font-weight: 850;
  }

  .book-search-panel-empty-copy {
    margin-top: 0.35rem;
    max-width: 18rem;
    color: color-mix(in srgb, var(--reader-page-text) 56%, transparent);
    font-size: var(--reader-ui-small-font-size);
    line-height: 1.45;
  }
</style>
