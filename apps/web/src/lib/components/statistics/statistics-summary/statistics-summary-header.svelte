<script lang="ts">
  import { faArrowDownWideShort, faArrowUpShortWide } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import type {
    StatisticsDataSourceChange,
    StatisticsSummaryKey
  } from '$lib/components/statistics/statistics-summary/statistics-summary';
  import type {
    BookStatistic,
    StatisticsDataSource
  } from '$lib/components/statistics/statistics-types';
  import { SortDirection } from '$lib/data/sort-types';
  import {
    lastStatisticsSummarySortDirection$,
    lastStatisticsSummarySortProperty$
  } from '$lib/data/store';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let statisticsSummaryKey: StatisticsSummaryKey;
  export let options: StatisticsDataSource[];
  export let selectionKey: keyof BookStatistic;
  export let gridRow: number | undefined;
  export let hasRowInEdit: boolean;
  export let isHidden = false;
  export let title = '';

  const dispatch = createEventDispatcher<{
    propertyChange: StatisticsDataSourceChange;
  }>();

  const tableHeaderClasses =
    'statistics-table-heading flex items-center w-full text-sm lg:text-base';

  let summaryHeaderPopover: Popover;

  $: optionKeys = new Set<keyof BookStatistic>((options || []).map((option) => option.key));

  $: selectedOption = options.find((option) => option.key === selectionKey)!;
</script>

<div
  class={tableHeaderClasses}
  class:hidden={isHidden}
  style:grid-row={gridRow ? `${gridRow}/${gridRow}` : null}
>
  {#if options.length > 1 && !hasRowInEdit}
    <Popover
      placement={'bottom-start'}
      fallbackPlacements={['top']}
      innerContainerStyles={'width: 100%'}
      containerStyles={'flex: 1;'}
      bind:this={summaryHeaderPopover}
    >
      <div {title}>{selectedOption.label}</div>
      <div slot="content" class="flex flex-col overflow-auto w-46 p-2">
        {#each options as option (option.key)}
          <button
            class="app-menu-item"
            on:click|stopPropagation={() => {
              selectedOption = option;
              dispatch('propertyChange', { property: option.key, statisticsSummaryKey });
              summaryHeaderPopover.toggleOpen();
            }}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </Popover>
  {:else}
    <button
      class="flex flex-1 text-left"
      class:cursor-not-allowed={hasRowInEdit}
      disabled={hasRowInEdit}
      {title}
      on:click={() => {
        dispatch('propertyChange', { property: selectedOption.key, statisticsSummaryKey });
      }}
    >
      {selectedOption.label}
    </button>
  {/if}
  <button
    title="Click to select/sort by this Attribute"
    class="settings-icon-action ml-2 shrink-0"
    class:opacity-20={!optionKeys.has($lastStatisticsSummarySortProperty$)}
    class:cursor-not-allowed={hasRowInEdit}
    disabled={hasRowInEdit}
    on:click={() =>
      dispatch('propertyChange', { property: selectedOption.key, statisticsSummaryKey })}
  >
    {#if $lastStatisticsSummarySortDirection$ === SortDirection.ASC}
      <Fa icon={faArrowUpShortWide} />
    {:else}
      <Fa icon={faArrowDownWideShort} />
    {/if}
  </button>
</div>
