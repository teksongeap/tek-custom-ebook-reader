<script lang="ts">
  import { browser } from '$app/environment';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import { pagePath } from '$lib/data/env';
  import { SortDirection } from '$lib/data/sort-types';
  import { FilesystemStorageHandler } from '$lib/data/storage/handler/filesystem-handler';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import {
    isStorageSourceAvailable,
    storageIcon$,
    storageSource$
  } from '$lib/data/storage/storage-view';
  import {
    booklistSortOptions$,
    cacheStorageData$,
    fileCountData$,
    fsStorageSource$,
    gDriveStorageSource$,
    isOnline$,
    oneDriveStorageSource$
  } from '$lib/data/store';
  import { inputAllowDirectory } from '$lib/functions/file-dom/input-allow-directory';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { dummyFn, isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import {
    faBookOpen,
    faCheckDouble,
    faEllipsisVertical,
    faArrowDownShortWide,
    faArrowDownWideShort,
    faCalendarXmark,
    faChartLine,
    faCircleXmark,
    faCloudArrowUp,
    faFileExport,
    faSortDown,
    faSortUp,
    faTimes,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import { quintOut } from 'svelte/easing';
  import { scale } from 'svelte/transition';

  export let hasBookOpened: boolean;
  export let selectMode: boolean;
  export let selectedCount: number;
  export let hasBooks: boolean;
  export let cancelTooltip: string;
  export let replicationProgress: number;
  export let replicationToProgress: number;
  export let replicationProgressRemaining: string;

  const dispatch = createEventDispatcher<{
    selectAllClick: void;
    removeClick: void;
    domainHintClick: void;
    bugReportClick: void;
    backToBookClick: void;
    filesChange: FileList;
    importBackup: File;
    selectionToStatistics: void;
    deleteStatistics: void;
    replicateData: void;
    replicateAllData: void;
    cancelReplication: void;
  }>();

  const inAnimationParams = {
    delay: 150,
    duration: 150,
    easing: quintOut
  };

  const outAnimationParams = {
    duration: 150,
    easing: quintOut
  };

  type MergeEntry = (typeof mergeEntries)[keyof typeof mergeEntries];
  type StorageSourceMenuItem = {
    label: string;
    key: StorageKey;
    requiresConnectivity: boolean;
  };

  let importMenuItems: MergeEntry[] = [mergeEntries.FILE_IMPORT];
  let storageSourceMenuItems: StorageSourceMenuItem[] = [
    { label: 'Browser', key: StorageKey.BROWSER, requiresConnectivity: false }
  ];

  let fileImportElm: HTMLElement;
  let folderImportElm: HTMLElement;
  let backupImportElm: HTMLElement;
  let countImportElm: HTMLInputElement;
  let importMenuElm: Popover;
  let moreMenuElm: Popover;
  let storageSourceElm: Popover;
  let sortOptionsElm: Popover;
  let isOldUrl = false;
  let showLoadCount = false;

  $: operationProgressPercent = replicationToProgress
    ? Math.min(Math.max((replicationProgress / replicationToProgress) * 100, 0), 100)
    : 0;
  $: operationProgressValue = Math.min(replicationProgress, replicationToProgress);
  $: operationProgressIsWaiting = operationProgressValue <= 0;
  $: operationProgressRemaining =
    replicationProgressRemaining === '~ ??:??:??' ? 'Working...' : replicationProgressRemaining;

  $: if (browser) {
    isOldUrl = isOnOldUrl(window);
    showLoadCount = new URLSearchParams(window.location.search).has('count');

    importMenuItems = [
      mergeEntries.FILE_IMPORT,
      ...($isMobile$
        ? [mergeEntries.BACKUP_IMPORT]
        : [mergeEntries.FOLDER_IMPORT, mergeEntries.BACKUP_IMPORT])
    ];

    storageSourceMenuItems = [
      { label: 'Browser', key: StorageKey.BROWSER, requiresConnectivity: false },
      ...(isStorageSourceAvailable(StorageKey.GDRIVE, $gDriveStorageSource$, window)
        ? [
            {
              label: 'GDrive',
              key: StorageKey.GDRIVE,
              requiresConnectivity: true
            }
          ]
        : []),
      ...(isStorageSourceAvailable(StorageKey.ONEDRIVE, $oneDriveStorageSource$, window)
        ? [
            {
              label: 'OneDrive',
              key: StorageKey.ONEDRIVE,
              requiresConnectivity: true
            }
          ]
        : []),
      ...(isStorageSourceAvailable(StorageKey.FS, $fsStorageSource$, window)
        ? [
            {
              label: 'Filesystem',
              key: StorageKey.FS,
              requiresConnectivity: false
            }
          ]
        : [])
    ];
  }

  $: sortMenuItems = [
    ...($storageSource$ === StorageKey.BROWSER ? [{ property: 'id', label: 'Added (id)' }] : []),
    { property: 'title', label: 'Title' },
    { property: 'characters', label: 'Characters' },
    { property: 'lastBookModified', label: 'Last Update' },
    { property: 'lastBookOpen', label: 'Last Read' },
    { property: 'progress', label: 'Progress' },
    { property: 'lastBookmarkModified', label: 'Bookmarked' }
  ];

  function triggerInput(event: CustomEvent<string>) {
    switch (event.detail) {
      case mergeEntries.FOLDER_IMPORT.label:
        folderImportElm.click();
        break;

      case mergeEntries.BACKUP_IMPORT.label:
        backupImportElm.click();
        break;

      default:
        fileImportElm.click();
        break;
    }
  }

  function dispatchFilesChange(fileList: FileList) {
    dispatch('filesChange', fileList);
  }

  function dispatchImportBackup(fileList: FileList) {
    dispatch('importBackup', fileList[0]);
  }

  async function setCountData(fileList: FileList) {
    try {
      $fileCountData$ = JSON.parse(await FilesystemStorageHandler.readFileObject(fileList[0]));
    } catch ({ message }: any) {
      console.error(`failed to read file: ${message}`);
    }
  }

  function changeSortOptions(clickedProperty: string, newDirection: SortDirection) {
    const { property, direction } = $booklistSortOptions$[$storageSource$];

    if (property !== clickedProperty || direction !== newDirection) {
      booklistSortOptions$.next({
        ...$booklistSortOptions$,
        ...{
          [$storageSource$]: {
            property: clickedProperty as Exclude<
              keyof BookCardProps,
              'imagePath' | 'isPlaceholder'
            >,
            direction: newDirection
          }
        }
      });
    }

    sortOptionsElm.toggleOpen();
  }
</script>

<input
  hidden
  multiple
  type="file"
  accept="application/epub+zip,.epub,.htmlz,plain/text,.txt"
  use:inputFile={dispatchFilesChange}
  bind:this={fileImportElm}
/>
<input
  hidden
  multiple
  type="file"
  use:inputAllowDirectory
  use:inputFile={dispatchFilesChange}
  bind:this={folderImportElm}
/>
<input
  hidden
  type="file"
  accept=".zip,application/zip"
  use:inputFile={dispatchImportBackup}
  bind:this={backupImportElm}
/>
<input
  hidden
  type="file"
  accept=".json,application/json"
  use:inputFile={setCountData}
  bind:this={countImportElm}
/>

<div class="app-header library-header">
  <div class="app-header-content library-toolbar">
    {#if !replicationToProgress}
      <div class="library-toolbar-context">
        <h1>Library</h1>
        {#if selectMode}
          <span class="library-selection-count">{selectedCount} selected</span>
        {/if}
      </div>
      <nav class="library-toolbar-actions" aria-label="Library controls">
        {#if selectMode}
          <button
            type="button"
            class="app-toolbar-button"
            aria-pressed={selectMode}
            disabled={!hasBooks}
            title={selectMode ? 'Done selecting books' : 'Select books'}
            on:click={() => (selectMode = !selectMode)}
          >
            <Fa icon={selectMode ? faTimes : faCheckDouble} /><span class="app-toolbar-label"
              >{selectMode ? 'Done' : 'Select'}</span
            >
          </button>
          <button
            type="button"
            class="app-toolbar-button"
            title="Select all books"
            on:click={() => dispatch('selectAllClick')}
          >
            <Fa icon={faCheckDouble} /><span class="app-toolbar-label">Select all</span>
          </button>
          {#if selectedCount > 0}
            <button
              type="button"
              class="app-toolbar-button"
              title="Export selected books"
              on:click={() => dispatch('replicateData')}
            >
              <Fa icon={faCloudArrowUp} /><span class="app-toolbar-label">Export</span>
            </button>
            {#if $storageSource$ === StorageKey.BROWSER}
              <button
                type="button"
                class="app-toolbar-button"
                title="Statistics for selected books"
                on:click={() => dispatch('selectionToStatistics')}
              >
                <Fa icon={faChartLine} /><span class="app-toolbar-label">Statistics</span>
              </button>
              <button
                type="button"
                class="app-toolbar-button"
                title="Delete statistics for selected books"
                on:click={() => dispatch('deleteStatistics')}
              >
                <Fa icon={faCalendarXmark} /><span class="app-toolbar-label">Delete statistics</span
                >
              </button>
            {/if}
            <button
              type="button"
              class="app-toolbar-button"
              title="Delete selected books"
              on:click={() => dispatch('removeClick')}
            >
              <Fa icon={faTrash} /><span class="app-toolbar-label">Delete</span>
            </button>
          {/if}
        {:else}
          <Popover
            placement="bottom-end"
            fallbackPlacements={['bottom-end', 'bottom-start']}
            yOffset={4}
            bind:this={importMenuElm}
          >
            <button type="button" slot="icon" class="app-toolbar-button" title="Import books">
              <Fa icon={mergeEntries.FILE_IMPORT.icon} /><span class="app-toolbar-label"
                >Import</span
              >
            </button>
            <div class="app-menu w-48" slot="content">
              {#each importMenuItems as item (item.label)}
                <button
                  type="button"
                  class="app-menu-item"
                  on:click={() => {
                    importMenuElm.toggleOpen();
                    triggerInput(new CustomEvent('action', { detail: item.label }));
                  }}><Fa icon={item.icon} /><span>{item.label}</span></button
                >
              {/each}
            </div>
          </Popover>
          <button
            type="button"
            class="app-toolbar-button"
            aria-pressed={selectMode}
            disabled={!hasBooks}
            title={selectMode ? 'Done selecting books' : 'Select books'}
            on:click={() => (selectMode = !selectMode)}
          >
            <Fa icon={selectMode ? faTimes : faCheckDouble} /><span class="app-toolbar-label"
              >{selectMode ? 'Done' : 'Select'}</span
            >
          </button>

          <Popover
            placement="bottom-end"
            fallbackPlacements={['bottom-end', 'bottom-start']}
            yOffset={4}
            bind:this={sortOptionsElm}
          >
            <button type="button" slot="icon" class="app-toolbar-button" title="Sort library">
              <Fa
                icon={$booklistSortOptions$[$storageSource$].direction === SortDirection.ASC
                  ? faArrowDownShortWide
                  : faArrowDownWideShort}
              /><span class="app-toolbar-label">Sort</span>
            </button>
            <div class="app-menu w-64" slot="content">
              {#each sortMenuItems as item (item.property)}
                {@const isCurrent =
                  $booklistSortOptions$[$storageSource$].property === item.property}
                <div class="library-sort-row" class:app-menu-item--selected={isCurrent}>
                  <span>{item.label}</span>
                  <button
                    type="button"
                    class="app-menu-item"
                    title={item.label + ': ascending'}
                    aria-label={item.label + ': ascending'}
                    aria-pressed={isCurrent &&
                      $booklistSortOptions$[$storageSource$].direction === SortDirection.ASC}
                    on:click={() => changeSortOptions(item.property, SortDirection.ASC)}
                    ><Fa icon={faSortUp} /></button
                  >
                  <button
                    type="button"
                    class="app-menu-item"
                    title={item.label + ': descending'}
                    aria-label={item.label + ': descending'}
                    aria-pressed={isCurrent &&
                      $booklistSortOptions$[$storageSource$].direction === SortDirection.DESC}
                    on:click={() => changeSortOptions(item.property, SortDirection.DESC)}
                    ><Fa icon={faSortDown} /></button
                  >
                </div>
              {/each}
            </div>
          </Popover>
          <Popover
            placement="bottom-end"
            fallbackPlacements={['bottom-end', 'bottom-start']}
            yOffset={4}
            bind:this={storageSourceElm}
          >
            <button
              type="button"
              slot="icon"
              class="app-toolbar-button"
              title="Select storage source"
            >
              <svg
                aria-hidden="true"
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={$storageIcon$.viewBox}
                ><path class="fill-current" d={$storageIcon$.d} /></svg
              >
              <span class="app-toolbar-label">Storage</span>
            </button>
            <div class="app-menu w-40" slot="content">
              {#each storageSourceMenuItems as item (item.key)}
                <button
                  type="button"
                  class="app-menu-item"
                  class:app-menu-item--selected={item.key === $storageSource$}
                  aria-pressed={item.key === $storageSource$}
                  disabled={item.requiresConnectivity && !$isOnline$}
                  on:click={() => {
                    if (item.key !== $storageSource$) {
                      if (!$cacheStorageData$) getStorageHandler(window, item.key).clearData();
                      storageSource$.next(item.key);
                    }
                    storageSourceElm.toggleOpen();
                  }}>{item.label}</button
                >
              {/each}
            </div>
          </Popover>
          <span class="library-toolbar-spacer" aria-hidden="true"></span>
          {#if hasBookOpened}
            <button
              type="button"
              class="app-toolbar-button"
              title="Resume reading"
              aria-label="Resume reading"
              on:click={() => dispatch('backToBookClick')}
            >
              <Fa icon={faBookOpen} /><span class="app-toolbar-label">Resume reading</span>
            </button>
          {/if}
          <span class="app-toolbar-divider" aria-hidden="true"></span>
          <a
            class="app-toolbar-button"
            href={pagePath + mergeEntries.SETTINGS.routeId}
            title="Settings"
          >
            <Fa icon={mergeEntries.SETTINGS.icon} /><span class="app-toolbar-label">Settings</span>
          </a>
          <Popover
            placement="bottom-end"
            fallbackPlacements={['bottom-end', 'bottom-start']}
            yOffset={4}
            bind:this={moreMenuElm}
          >
            <button
              type="button"
              slot="icon"
              class="app-toolbar-button"
              title="More library actions"
              aria-label="More library actions"><Fa icon={faEllipsisVertical} /></button
            >
            <div class="app-menu w-52" slot="content">
              {#if hasBooks}
                <button
                  type="button"
                  class="app-menu-item"
                  on:click={() => {
                    moreMenuElm.toggleOpen();
                    dispatch('replicateAllData');
                  }}><Fa icon={faFileExport} /><span>Export library</span></button
                >
              {/if}
              <a class="app-menu-item" href={pagePath + mergeEntries.STATISTICS.routeId}
                ><Fa icon={faChartLine} /><span>Statistics</span></a
              >
              {#if isOldUrl}
                <button
                  type="button"
                  class="app-menu-item"
                  on:click={() => {
                    moreMenuElm.toggleOpen();
                    dispatch('domainHintClick');
                  }}>Old domain information</button
                >
              {/if}
              <button
                type="button"
                class="app-menu-item"
                on:click={() => {
                  moreMenuElm.toggleOpen();
                  dispatch('bugReportClick');
                }}>Report an issue</button
              >
            </div>
          </Popover>
          {#if showLoadCount}
            <button
              type="button"
              class="app-toolbar-button"
              style:color={!!$fileCountData$ ? 'red' : null}
              on:click={() => countImportElm.click()}>C</button
            >
          {/if}
        {/if}
      </nav>
    {:else}
      <div
        title="Cancel Operation"
        class="book-manager-operation library-operation"
        in:scale={inAnimationParams}
        out:scale={outAnimationParams}
      >
        <Popover contentText={cancelTooltip} contentStyles={'padding: 0.75rem'} eventType="pointer">
          <div
            tabindex="0"
            role="button"
            aria-label="Cancel operation"
            class="book-manager-operation__cancel"
            on:click={() => dispatch('cancelReplication')}
            on:keyup={dummyFn}
          >
            <Fa icon={faCircleXmark} />
          </div>
        </Popover>
        <div class="book-manager-operation__meter">
          <span class="book-manager-operation__pulse" aria-hidden="true"></span>
          <div
            class="book-manager-operation__track"
            role="progressbar"
            aria-label="Operation progress"
            aria-valuemin="0"
            aria-valuemax={replicationToProgress}
            aria-valuenow={operationProgressValue}
          >
            <span class="book-manager-operation__fill" style:width={`${operationProgressPercent}%`}
            ></span>
            {#if operationProgressIsWaiting}
              <span class="book-manager-operation__sweep" aria-hidden="true"></span>
            {/if}
          </div>
        </div>
        <div class="book-manager-operation__status" title={operationProgressRemaining}>
          {operationProgressRemaining}
        </div>
      </div>
    {/if}
  </div>
</div>
