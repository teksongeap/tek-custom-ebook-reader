<script lang="ts">
  import {
    faCircleQuestion,
    faLeftLong,
    faRightLong,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import { optionsForToggle } from '$lib/components/button-toggle-group/toggle-option';
  import Popover from '$lib/components/popover/popover.svelte';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import {
    type StatisticsDateChange,
    statisticsRangeTemplates,
    readingTimeDataSources,
    charactersDataSources,
    readingSpeedDataSources,
    statisticsDataAggregrationModes,
    exportStatisticsData$,
    statisticsActionInProgress$,
    deleteStatisticsData$,
    setStatisticsDatesToAllTime$
  } from '$lib/components/statistics/statistics-types';
  import { daysOfWeek } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
  import { dialogManager } from '$lib/data/dialog-manager';
  import {
    confirmStatisticsDeletion$,
    lastCharactersDataSource$,
    lastPrimaryReadingDataAggregationMode$,
    lastReadingSpeedDataSource$,
    lastReadingTimeDataSource$,
    lastStartDayOfWeek$,
    lastStatisticsEndDate$,
    lastStatisticsRangeTemplate$,
    lastStatisticsStartDate$
  } from '$lib/data/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  const dispatch = createEventDispatcher<{
    close: void;
    statisticsDateChange: StatisticsDateChange;
  }>();

  const weekDays = [...daysOfWeek.slice(1, 7), daysOfWeek[0]].map((day, index) => {
    if (day === 'Sunday') {
      return { day, index: 0 };
    }
    return { day, index: index + 1 };
  });

  $: selectedStatisticsStartDate = $lastStatisticsStartDate$;

  $: selectedStatisticsEndDate = $lastStatisticsEndDate$;

  onMount(() => {
    dialogManager.dialogs$.next([{ component: '<div/>' }]);

    return () => dialogManager.dialogs$.next([]);
  });

  async function exportStatisticsData(exportAllStatisticsData = true) {
    $statisticsActionInProgress$ = true;

    exportStatisticsData$.next(exportAllStatisticsData);
  }

  async function deleteStatisticsData(deleteAllStatisticsData = true) {
    $statisticsActionInProgress$ = true;

    deleteStatisticsData$.next(deleteAllStatisticsData);
  }
</script>

<div class="statistics-panel-header">
  <button
    aria-label="Close statistics settings"
    class="settings-icon-action"
    on:click={() => dispatch('close')}
  >
    <Fa icon={faXmark} />
  </button>
  <h2 class="font-semibold">Statistics settings</h2>
</div>
<div class="statistics-data-actions">
  <button class="app-button" on:click={() => exportStatisticsData(false)}>
    Export Selection
  </button>
  <button class="app-button statistics-danger-action" on:click={() => deleteStatisticsData(false)}>
    Delete Selection
  </button>
  <button class="app-button" on:click={() => exportStatisticsData()}> Export All </button>
  <button class="app-button statistics-danger-action" on:click={() => deleteStatisticsData()}
    >Delete All</button
  >
</div>
<div class="flex-1 p-4 overflow-auto">
  <div class="flex flex-col mb-6">
    <label for="datesTemplate">Template</label>
    <select id="datesTemplate" class="settings-input" bind:value={$lastStatisticsRangeTemplate$}>
      {#each statisticsRangeTemplates as statisticsRangeTemplate (statisticsRangeTemplate)}
        <option value={statisticsRangeTemplate}>
          {statisticsRangeTemplate}
        </option>
      {/each}
    </select>
  </div>
  <div class="flex flex-col mb-4 sm:hidden">
    <label for="weekDayMobile">Start of Week</label>
    <select id="weekDayMobile" class="settings-input" bind:value={$lastStartDayOfWeek$}>
      {#each weekDays as weekDay (weekDay.day)}
        <option value={weekDay.index}>
          {weekDay.day}
        </option>
      {/each}
    </select>
  </div>
  <div class="statistics-date-range">
    <div class="flex flex-col">
      <label for="fromDate">From</label>
      <input
        id="fromDate"
        type="date"
        class="settings-input"
        bind:value={selectedStatisticsStartDate}
        on:change={() =>
          dispatch('statisticsDateChange', {
            isStartDate: true,
            dateString: selectedStatisticsStartDate
          })}
      />
    </div>
    <div class="flex flex-col justify-end gap-1">
      <button
        class="settings-icon-action"
        aria-label="Copy date to other end of range"
        on:click={() =>
          dispatch('statisticsDateChange', {
            isStartDate: false,
            dateString: selectedStatisticsStartDate
          })}
      >
        <Fa icon={faRightLong} />
      </button>
      <button
        class="settings-icon-action"
        aria-label="Copy date to other end of range"
        on:click={() =>
          dispatch('statisticsDateChange', {
            isStartDate: true,
            dateString: selectedStatisticsEndDate
          })}
      >
        <Fa icon={faLeftLong} />
      </button>
    </div>
    <div class="flex flex-col">
      <label for="toDate">To</label>
      <input
        id="toDate"
        type="date"
        class="settings-input"
        bind:value={selectedStatisticsEndDate}
        on:change={() =>
          dispatch('statisticsDateChange', {
            isStartDate: false,
            dateString: selectedStatisticsEndDate
          })}
      />
    </div>
    <div class="flex-col hidden sm:flex">
      <label for="weekDay">Start of Week</label>
      <select id="weekDay" class="settings-input" bind:value={$lastStartDayOfWeek$}>
        {#each weekDays as weekDay (weekDay.day)}
          <option value={weekDay.index}>
            {weekDay.day}
          </option>
        {/each}
      </select>
    </div>
  </div>
  <button class="app-button mt-3" on:click={() => setStatisticsDatesToAllTime$.next()}>
    Set to All Time for selected Book Titles
  </button>
  <div class="flex flex-wrap justify-between mt-4">
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Reading Time Attribute which should be used for the Summary Tab'}
        containerStyles="justify-content: space-between; gap: 0.5rem;"
        contentStyles="padding: 0.5rem;"
      >
        <button type="button" slot="icon" class="settings-icon-action" aria-label="Explain setting"
          ><Fa icon={faCircleQuestion} /></button
        >
        <label for="timeDataSource">Time Data Source</label>
      </Popover>
      <select id="timeDataSource" class="settings-input" bind:value={$lastReadingTimeDataSource$}>
        {#each readingTimeDataSources as readingTimeDataSource (readingTimeDataSource.key)}
          <option value={readingTimeDataSource.key}>
            {readingTimeDataSource.label}
          </option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Characters Read Attribute which should be used for the Summary Tab'}
        containerStyles="justify-content: space-between; gap: 0.5rem;"
        contentStyles="padding: 0.5rem; max-width: 20rem;"
      >
        <button type="button" slot="icon" class="settings-icon-action" aria-label="Explain setting"
          ><Fa icon={faCircleQuestion} /></button
        >
        <label for="charactersSource">Characters Data Source</label>
      </Popover>
      <select id="charactersSource" class="settings-input" bind:value={$lastCharactersDataSource$}>
        {#each charactersDataSources as charactersDataSource (charactersDataSource.key)}
          <option value={charactersDataSource.key}>
            {charactersDataSource.label}
          </option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Reading Speed Attribute which should be used for the Summary Tab'}
        containerStyles="justify-content: space-between; gap: 0.5rem;"
        contentStyles="padding: 0.5rem;"
      >
        <button type="button" slot="icon" class="settings-icon-action" aria-label="Explain setting"
          ><Fa icon={faCircleQuestion} /></button
        >
        <label for="speedSource">Speed Data Source</label>
      </Popover>
      <select id="speedSource" class="settings-input" bind:value={$lastReadingSpeedDataSource$}>
        {#each readingSpeedDataSources as readingSpeedDataSource (readingSpeedDataSource.key)}
          <option value={readingSpeedDataSource.key}>
            {readingSpeedDataSource.label}
          </option>
        {/each}
      </select>
    </div>
  </div>
  <div class="flex flex-col mt-4">
    <Popover
      contentText={'Determines on which primary Attribute the Data will be grouped for the Summary Tab'}
      containerStyles="justify-content: space-between; gap: 0.5rem;"
      contentStyles="padding: 0.5rem;"
    >
      <button type="button" slot="icon" class="settings-icon-action" aria-label="Explain setting"
        ><Fa icon={faCircleQuestion} /></button
      >
      <label for="primaryAggregration">Primary Aggregration</label>
    </Popover>
    <select
      id="primaryAggregration"
      class="settings-input"
      bind:value={$lastPrimaryReadingDataAggregationMode$}
    >
      {#each statisticsDataAggregrationModes as statisticsDataAggregrationMode (statisticsDataAggregrationMode)}
        <option value={statisticsDataAggregrationMode}>
          {statisticsDataAggregrationMode}
        </option>
      {/each}
    </select>
  </div>
  <div class="mt-4">
    <SettingsItemGroup title="Confirm Statistics Deletion" applyHeaderClasses={false}>
      <ButtonToggleGroup
        invertColors
        options={optionsForToggle}
        bind:selectedOptionId={$confirmStatisticsDeletion$}
      />
    </SettingsItemGroup>
  </div>
</div>
