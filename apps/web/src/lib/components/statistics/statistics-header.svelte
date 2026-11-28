<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    faArrowLeft,
    faBookOpen,
    faCalendarDays,
    faCopy,
    faFilter,
    faMap,
    faSliders
  } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    StatisticsTab,
    copyStatisticsData$,
    statisticsTitleFilterEnabled$,
    statisticsTitleFilterIsOpen$,
    type StatisticsDataSource
  } from '$lib/components/statistics/statistics-types';
  import { pagePath } from '$lib/data/env';
  import { lastStatisticsTab$ } from '$lib/data/store';
  import Fa from 'svelte-fa';

  export let currentBookId: number | undefined;
  export let showStatisticsSettings: boolean;

  const copyStatisticsDataItems: StatisticsDataSource[] = [
    { key: 'readingTime', label: 'Reading Time' },
    { key: 'charactersRead', label: 'Characters Read' }
  ];

  let copyStatisticsDataPopover: Popover;
</script>

<div class="app-header fixed inset-x-0 top-0 z-10">
  <div class="app-header-content statistics-toolbar">
    <div class="statistics-toolbar-context">
      <a
        href={`${pagePath}/manage`}
        class="app-toolbar-button"
        title="Back to library"
        aria-label="Back to library"
      >
        <Fa icon={faArrowLeft} /><span>Library</span>
      </a>
      <span class="app-toolbar-divider" aria-hidden="true"></span>
      <h1 class="statistics-page-title">Statistics</h1>
    </div>
    <nav class="statistics-toolbar-actions" aria-label="Statistics controls">
      <button
        type="button"
        aria-pressed={$lastStatisticsTab$ === StatisticsTab.SUMMARY}
        title="Reading summary"
        class="app-toolbar-button"
        class:app-toolbar-button--active={$lastStatisticsTab$ === StatisticsTab.SUMMARY}
        on:click={() => ($lastStatisticsTab$ = StatisticsTab.SUMMARY)}
      >
        <Fa icon={faCalendarDays} /><span>Summary</span>
      </button>
      <button
        type="button"
        aria-pressed={$lastStatisticsTab$ === StatisticsTab.OVERVIEW}
        title="Reading heatmap"
        class="app-toolbar-button"
        class:app-toolbar-button--active={$lastStatisticsTab$ === StatisticsTab.OVERVIEW}
        on:click={() => ($lastStatisticsTab$ = StatisticsTab.OVERVIEW)}
      >
        <Fa icon={faMap} /><span>Heatmap</span>
      </button>
      <span class="app-toolbar-divider" aria-hidden="true"></span>
      <div class="relative transform-gpu">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={copyStatisticsDataPopover}
        >
          <button
            type="button"
            title="Copy Data in TMW Log Format"
            aria-label="Copy statistics data"
            slot="icon"
            class="app-toolbar-button"
          >
            <Fa icon={faCopy} /><span class="hidden lg:inline">Copy data</span>
          </button>
          <div class="app-menu flex w-36 flex-col justify-center" slot="content">
            {#each copyStatisticsDataItems as copyStatisticsDataItem (copyStatisticsDataItem.key)}
              <button
                class="app-menu-item"
                on:click={() => {
                  copyStatisticsData$.next(copyStatisticsDataItem.key);
                  copyStatisticsDataPopover.toggleOpen();
                }}
              >
                {copyStatisticsDataItem.label}
              </button>
            {/each}
          </div>
        </Popover>
      </div>
      <button
        type="button"
        title="Filter titles"
        class="app-toolbar-button"
        disabled={!$statisticsTitleFilterEnabled$}
        on:click={() => {
          if (!$statisticsTitleFilterEnabled$) {
            return;
          }

          $statisticsTitleFilterIsOpen$ = true;
        }}
      >
        <Fa icon={faFilter} /><span class="hidden lg:inline">Filter titles</span>
      </button>
      <button
        type="button"
        title="Statistics settings"
        aria-label="Statistics settings"
        class="app-toolbar-button"
        on:click={() => (showStatisticsSettings = true)}
      >
        <Fa icon={faSliders} /><span class="hidden lg:inline">Statistics settings</span>
      </button>
      {#if currentBookId}
        <span class="app-toolbar-divider statistics-resume-divider" aria-hidden="true"></span>
        <button
          type="button"
          class="app-toolbar-button"
          title="Resume reading"
          aria-label="Resume reading"
          data-sound="none"
          on:click={() => goto(`${pagePath}/b?id=${currentBookId}`)}
        >
          <Fa icon={faBookOpen} /><span class="hidden lg:inline">Resume reading</span>
        </button>
      {/if}
    </nav>
  </div>
</div>
