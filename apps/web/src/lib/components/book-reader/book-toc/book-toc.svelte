<script lang="ts">
  import {
    faBookOpen,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import {
    activeTocItem$,
    getChapterData,
    getChapterSections,
    nextChapter$,
    setActiveTocItem,
    tocIsOpen$,
    type ActiveTocItem,
    type SectionWithProgress
  } from '$lib/components/book-reader/book-toc/book-toc';
  import { isTrackerPaused$ } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { PAGE_CHANGE } from '$lib/data/events';
  import { skipKeyDownListener$, statisticsEnabled$ } from '$lib/data/store';
  import type { BooksDbTocEntry } from '$lib/data/database/books-db/versions/books-db';
  import { readerTargetNavigation$ } from '$lib/functions/reader-reference-layer/navigation';
  import { getWeightedAverage } from '$lib/functions/utils';
  import { debounceTime, fromEvent, Subject, take, takeUntil } from 'rxjs';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  type TocItem = {
    id: string;
    reference: string;
    label: string;
    children: TocItem[];
    sourceHref?: string;
    targetFragment?: string;
    startCharacter?: number;
    characters?: number;
    charactersWeight?: number;
    progress?: number;
    parentChapter?: string;
    tocDepth?: number;
  };

  type TocNavigationTarget = {
    id?: string;
    reference: string;
    label?: string;
    sourceHref?: string;
    targetFragment?: string;
    startCharacter?: number;
  };

  type SectionTocItem = SectionWithProgress & {
    id: string;
    label: string;
    children: TocItem[];
  };

  type VisibleTocItem = TocItem & {
    depth: number;
  };

  export let sectionData: SectionWithProgress[] = [];
  export let tocEntries: BooksDbTocEntry[] = [];
  export let exploredCharCount = 0;
  export let verticalMode: boolean;
  export let wasTrackerPaused: boolean;
  export let fontColor = '';
  export let backgroundColor = '';

  let chapters: SectionWithProgress[] = [];
  let tocTree: TocItem[] = [];
  let visibleTocItems: VisibleTocItem[] = [];
  let tocEntryCount = 0;
  let currentTocItemId = '';
  let currentChapter: SectionWithProgress | undefined;
  let currentChapterIndex = -1;
  let currentChapterCharacterProgress = '0 / 0';
  let currentChapterProgress = '0.00';
  let activeTocItem: ActiveTocItem | undefined;
  let expandedReferences = new Set<string>();
  let collapsedReferences = new Set<string>();
  let currentAncestorReferences = new Set<string>();
  let previousTocTreeKey = '';

  const destroy$ = new Subject<void>();

  $: panelStyle = `--reader-page-text: ${
    fontColor || 'var(--font-color)'
  }; --reader-page-bg: ${backgroundColor || 'var(--background-color)'};`;
  $: prevChapterAvailable = verticalMode
    ? currentChapterIndex < chapters.length - 1
    : currentChapterIndex > 0;
  $: nextChapterAvailable = verticalMode
    ? currentChapterIndex > 0
    : currentChapterIndex < chapters.length - 1;

  $: if (sectionData) {
    const [nextChapters, chapterIndex, referenceId] = getChapterData(sectionData);

    chapters = nextChapters;
    currentChapterIndex = chapterIndex;
    currentChapter = nextChapters[currentChapterIndex];
    tocTree = buildTocTree(sectionData, tocEntries);
    tocEntryCount = countTocEntries(tocTree);
    currentTocItemId = getCurrentTocItemId(tocTree, currentChapter, activeTocItem);
    currentAncestorReferences = getAncestorReferences(tocTree, currentTocItemId);
    syncExpandedReferences(tocTree, currentAncestorReferences);
    updateCurrentChapterProgress(referenceId);
  }
  $: visibleTocItems = flattenTocTree(tocTree, expandedReferences);

  $: if (currentTocItemId) {
    scrollToChapterItem(document.getElementById(getTocItemId(currentTocItemId)));
  }

  onMount(() => {
    $skipKeyDownListener$ = true;
    dialogManager.dialogs$.next([
      {
        component: '<div/>'
      }
    ]);
    activeTocItem$.pipe(takeUntil(destroy$)).subscribe((tocItem) => {
      activeTocItem = tocItem;
    });
    if (currentTocItemId) {
      scrollToChapterItem(document.getElementById(getTocItemId(currentTocItemId)));
    }

    return () => {
      destroy$.next();
      destroy$.complete();
      $skipKeyDownListener$ = false;
      dialogManager.dialogs$.next([]);
    };
  });

  function buildTocTree(sections: SectionWithProgress[], importedTocEntries: BooksDbTocEntry[]) {
    if (importedTocEntries.length) {
      return buildImportedTocTree(importedTocEntries);
    }

    return buildSectionTocTree(sections);
  }

  function buildImportedTocTree(importedTocEntries: BooksDbTocEntry[]): TocItem[] {
    return importedTocEntries.map((entry) => ({
      id: entry.id,
      reference: entry.reference,
      label: entry.label,
      sourceHref: entry.sourceHref,
      targetFragment: entry.targetFragment,
      children: buildImportedTocTree(entry.children || [])
    }));
  }

  function buildSectionTocTree(sections: SectionWithProgress[]) {
    const items = getChapterSections(sections).map((section) => ({
      ...section,
      id: section.reference,
      children: [] as TocItem[]
    })) as SectionTocItem[];
    const itemByReference = new Map(items.map((item) => [item.reference, item]));
    const roots: SectionTocItem[] = [];

    items.forEach((item) => {
      const parent = item.parentChapter ? itemByReference.get(item.parentChapter) : undefined;

      if (parent && parent.reference !== item.reference) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  }

  function flattenTocTree(
    items: TocItem[],
    expandedItemReferences: Set<string>,
    depth = 0
  ): VisibleTocItem[] {
    return items.flatMap((item) => {
      const visibleItem = { ...item, depth };
      const shouldShowChildren = item.children.length && expandedItemReferences.has(item.id);

      return shouldShowChildren
        ? [visibleItem, ...flattenTocTree(item.children, expandedItemReferences, depth + 1)]
        : [visibleItem];
    });
  }

  function getAncestorReferences(
    items: TocItem[],
    itemId: string,
    ancestors: string[] = []
  ): Set<string> {
    for (const item of items) {
      if (item.id === itemId) {
        return new Set(ancestors);
      }

      const childAncestors: Set<string> = getAncestorReferences(item.children, itemId, [
        ...ancestors,
        item.id
      ]);

      if (childAncestors.size) {
        return childAncestors;
      }
    }

    return new Set<string>();
  }

  function flattenAllTocItems(items: TocItem[], depth = 0): VisibleTocItem[] {
    return items.flatMap((item) => [
      { ...item, depth },
      ...flattenAllTocItems(item.children, depth + 1)
    ]);
  }

  function countTocEntries(items: TocItem[]): number {
    return items.reduce((count, item) => count + 1 + countTocEntries(item.children), 0);
  }

  function getTocTreeKey(items: TocItem[]) {
    return flattenAllTocItems(items)
      .map((item) => item.id)
      .join('|');
  }

  function getDefaultExpandedReferences(items: TocItem[], ancestorReferences: Set<string>) {
    const defaultExpandedReferences = new Set<string>();

    items.forEach((item) => {
      if (item.children.length) {
        defaultExpandedReferences.add(item.id);
      }
    });
    ancestorReferences.forEach((reference) => defaultExpandedReferences.add(reference));

    return defaultExpandedReferences;
  }

  function syncExpandedReferences(items: TocItem[], ancestorReferences: Set<string>) {
    const tocTreeKey = getTocTreeKey(items);

    if (tocTreeKey !== previousTocTreeKey) {
      previousTocTreeKey = tocTreeKey;
      collapsedReferences = new Set<string>();
      expandedReferences = getDefaultExpandedReferences(items, ancestorReferences);
      return;
    }

    const nextExpandedReferences = new Set(expandedReferences);
    let changed = false;

    ancestorReferences.forEach((reference) => {
      if (!collapsedReferences.has(reference) && !nextExpandedReferences.has(reference)) {
        nextExpandedReferences.add(reference);
        changed = true;
      }
    });

    if (changed) {
      expandedReferences = nextExpandedReferences;
    }
  }

  function getCurrentTocItemId(
    items: TocItem[],
    chapter: SectionWithProgress | undefined,
    selectedTocItem: ActiveTocItem | undefined
  ) {
    if (!chapter) {
      return '';
    }

    if (!tocEntries.length) {
      return chapter.reference;
    }

    const flattenedItems = flattenAllTocItems(items);
    const selectedItem = selectedTocItem
      ? flattenedItems.find((item) => item.id === selectedTocItem.id)
      : undefined;

    if (selectedItem && selectedItem.sourceHref && selectedItem.sourceHref === chapter.sourceHref) {
      return selectedItem.id;
    }

    const exactMatch = flattenedItems.find(
      (item) =>
        item.sourceHref === chapter.sourceHref && item.targetFragment === chapter.targetFragment
    );

    if (exactMatch) {
      return exactMatch.id;
    }

    const sourceHrefMatch = [...flattenedItems]
      .reverse()
      .find((item) => item.sourceHref === chapter.sourceHref);

    return sourceHrefMatch?.id || '';
  }

  function updateCurrentChapterProgress(referenceId: string) {
    const relevantSections = getRelevantSections(referenceId);
    const characters = relevantSections.reduce(
      (sum, section) => sum + Math.max(section.characters || 0, 0),
      0
    );
    const startCharacter = relevantSections.reduce((minStart, section) => {
      if (typeof section.startCharacter !== 'number') {
        return minStart;
      }

      return Math.min(minStart, section.startCharacter);
    }, Number.POSITIVE_INFINITY);

    currentChapterProgress = getWeightedAverage(
      relevantSections.map((section) => section.progress),
      relevantSections.map((section) => section.charactersWeight)
    ).toFixed(2);
    currentChapterCharacterProgress = `${Math.min(
      Math.max(exploredCharCount - (Number.isFinite(startCharacter) ? startCharacter : 0), 0),
      characters
    )} / ${characters}`;
  }

  function getRelevantSections(referenceId: string) {
    if (!referenceId) {
      return [];
    }

    const references = new Set([referenceId]);
    let changed = true;

    while (changed) {
      changed = false;
      sectionData.forEach((section) => {
        if (
          section.parentChapter &&
          references.has(section.parentChapter) &&
          !references.has(section.reference)
        ) {
          references.add(section.reference);
          changed = true;
        }
      });
    }

    return sectionData.filter((section) => references.has(section.reference));
  }

  function scrollToChapterItem(elm: HTMLElement | null) {
    if (!elm) {
      return;
    }

    if (elm.scrollIntoViewIfNeeded) {
      elm.scrollIntoViewIfNeeded();
    } else {
      elm.scrollIntoView({ block: 'nearest' });
    }
  }

  function changeChapter(canNavigate: boolean, indexMod: number) {
    if (canNavigate) {
      const nextChapter = chapters[currentChapterIndex + indexMod];

      goToChapter(nextChapter, false);
    }
  }

  function goToChapter(chapter: TocNavigationTarget | undefined, closeToc = false) {
    if (!chapter) {
      return;
    }

    const hasCharacterChange =
      typeof chapter.startCharacter === 'number' && exploredCharCount !== chapter.startCharacter;

    if ($statisticsEnabled$ && closeToc && hasCharacterChange && !wasTrackerPaused) {
      fromEvent(document, PAGE_CHANGE)
        .pipe(debounceTime(200), take(1), takeUntil(destroy$))
        .subscribe(() => {
          if (closeToc) {
            closeTocMenu();
          }
        });
    }

    navigateToChapter(chapter);

    if ((!hasCharacterChange || !$statisticsEnabled$ || wasTrackerPaused) && closeToc) {
      closeTocMenu();
    }
  }

  function toggleExpanded(reference: string) {
    const nextExpandedReferences = new Set(expandedReferences);
    const nextCollapsedReferences = new Set(collapsedReferences);

    if (nextExpandedReferences.has(reference)) {
      nextExpandedReferences.delete(reference);
      nextCollapsedReferences.add(reference);
    } else {
      nextExpandedReferences.add(reference);
      nextCollapsedReferences.delete(reference);
    }

    expandedReferences = nextExpandedReferences;
    collapsedReferences = nextCollapsedReferences;
  }

  function navigateToChapter(chapter: TocNavigationTarget) {
    if (chapter.sourceHref) {
      if (chapter.id) {
        setActiveTocItem({
          id: chapter.id,
          sourceHref: chapter.sourceHref,
          targetFragment: chapter.targetFragment
        });
      }

      readerTargetNavigation$.next({
        target: {
          sourceHref: chapter.sourceHref,
          fragment: chapter.targetFragment
        },
        highlight: true
      });
      return;
    }

    nextChapter$.next(chapter.reference);
  }

  function isExpanded(item: VisibleTocItem) {
    return item.children.length > 0 && expandedReferences.has(item.id);
  }

  function formatTocMeta(item: TocItem) {
    if (typeof item.startCharacter === 'number') {
      return item.startCharacter.toLocaleString();
    }

    return '';
  }

  function getTocItemId(reference: string) {
    return `toc-${encodeURIComponent(reference)}`;
  }

  function closeTocMenu() {
    tocIsOpen$.next(false);
    dialogManager.dialogs$.next([]);

    if ($statisticsEnabled$ && !wasTrackerPaused) {
      isTrackerPaused$.next(false);
    }
  }
</script>

<div
  class="book-toc-panel"
  style={panelStyle}
  on:touchmove|stopPropagation={() => {}}
  on:wheel|stopPropagation={() => {}}
>
  <div class="book-toc-panel-header">
    <div class="book-toc-panel-title">
      <span class="book-toc-panel-title-icon"><Fa icon={faBookOpen} /></span>
      <div>
        <div class="book-toc-panel-title-main">Contents</div>
        <div class="book-toc-panel-title-sub">{tocEntryCount} entries</div>
      </div>
    </div>
    <button
      type="button"
      class="book-toc-panel-close"
      title="Close contents"
      aria-label="Close contents"
      on:click={closeTocMenu}
    >
      <Fa icon={faXmark} />
    </button>
  </div>

  <div class="book-toc-panel-progress">
    <span class="book-toc-panel-progress-label">{currentChapter?.label || 'Current chapter'}</span>
    <span class="book-toc-panel-progress-value">
      {currentChapterCharacterProgress} ({currentChapterProgress}%)
    </span>
  </div>

  <div class="book-toc-panel-list">
    {#if visibleTocItems.length}
      {#each visibleTocItems as item (item.id)}
        <div
          id={getTocItemId(item.id)}
          class="book-toc-item-row"
          class:book-toc-item-row--current={item.id === currentTocItemId}
          style:--toc-depth={item.depth}
        >
          {#if item.children.length}
            <button
              type="button"
              data-toc-disclosure
              class="book-toc-item-disclosure"
              aria-expanded={isExpanded(item)}
              aria-label={isExpanded(item) ? 'Collapse section' : 'Expand section'}
              on:click|stopPropagation={() => toggleExpanded(item.id)}
            >
              <Fa icon={isExpanded(item) ? faChevronDown : faChevronRight} />
            </button>
          {:else}
            <span class="book-toc-item-disclosure book-toc-item-disclosure--placeholder"></span>
          {/if}
          <button type="button" class="book-toc-item" on:click={() => goToChapter(item, true)}>
            <span class="book-toc-item-label">{item.label}</span>
            {#if formatTocMeta(item)}
              <span class="book-toc-item-meta">{formatTocMeta(item)}</span>
            {/if}
          </button>
        </div>
      {/each}
    {:else}
      <div class="book-toc-panel-empty">
        <div class="book-toc-panel-empty-icon"><Fa icon={faBookOpen} /></div>
        <div class="book-toc-panel-empty-title">No contents</div>
      </div>
    {/if}
  </div>

  <div class="book-toc-panel-footer">
    <button
      type="button"
      class="book-toc-panel-nav"
      title={prevChapterAvailable ? `${verticalMode ? 'Next' : 'Previous'} chapter` : ''}
      aria-label={verticalMode ? 'Next chapter' : 'Previous chapter'}
      disabled={!prevChapterAvailable}
      on:click={() => changeChapter(prevChapterAvailable, verticalMode ? 1 : -1)}
    >
      <Fa icon={faChevronLeft} />
    </button>
    <button
      type="button"
      class="book-toc-panel-nav"
      title={nextChapterAvailable ? `${verticalMode ? 'Previous' : 'Next'} chapter` : ''}
      aria-label={verticalMode ? 'Previous chapter' : 'Next chapter'}
      disabled={!nextChapterAvailable}
      on:click={() => changeChapter(nextChapterAvailable, verticalMode ? -1 : 1)}
    >
      <Fa icon={faChevronRight} />
    </button>
  </div>
</div>

<style lang="scss">
  .book-toc-panel {
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
  }

  .book-toc-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 12%, transparent);
    padding: 1rem;
  }

  .book-toc-panel-title {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
  }

  .book-toc-panel-title-icon,
  .book-toc-panel-empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--app-accent) 16%, transparent);
    color: var(--app-accent);
  }

  .book-toc-panel-title-icon {
    height: 2.35rem;
    width: 2.35rem;
    flex: 0 0 auto;
  }

  .book-toc-panel-title-main {
    font-size: 1rem;
    font-weight: 850;
    line-height: 1.1;
  }

  .book-toc-panel-title-sub {
    margin-top: 0.15rem;
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: 0.78rem;
    line-height: 1.1;
  }

  .book-toc-panel-close,
  .book-toc-panel-nav,
  .book-toc-item-disclosure,
  .book-toc-item {
    cursor: pointer;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }

  .book-toc-panel-close,
  .book-toc-panel-nav,
  .book-toc-item-disclosure {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .book-toc-panel-close {
    height: 2.15rem;
    width: 2.15rem;
    flex: 0 0 auto;
    border-radius: 0.5rem;
    color: color-mix(in srgb, var(--reader-page-text) 62%, transparent);
  }

  .book-toc-panel-close:hover,
  .book-toc-panel-close:focus-visible,
  .book-toc-panel-nav:hover:not(:disabled),
  .book-toc-panel-nav:focus-visible:not(:disabled),
  .book-toc-item-disclosure:hover,
  .book-toc-item-disclosure:focus-visible,
  .book-toc-item:hover,
  .book-toc-item:focus-visible {
    background: color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    color: var(--reader-page-text);
  }

  .book-toc-panel-progress {
    display: grid;
    gap: 0.35rem;
    border-bottom: 1px solid color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    padding: 0.8rem 1rem;
  }

  .book-toc-panel-progress-label {
    overflow: hidden;
    color: var(--reader-page-text);
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-toc-panel-progress-value {
    color: color-mix(in srgb, var(--reader-page-text) 58%, transparent);
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .book-toc-panel-list {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.25rem;
    overflow: auto;
    padding: 0.75rem;
  }

  .book-toc-item-row {
    --toc-depth: 0;
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr);
    align-items: stretch;
    gap: 0.25rem;
    padding-left: calc(var(--toc-depth) * 0.85rem);
  }

  .book-toc-item-row--current {
    color: var(--reader-page-text);
  }

  .book-toc-item-disclosure {
    min-height: 2.35rem;
    border-radius: 0.45rem;
    color: color-mix(in srgb, var(--reader-page-text) 54%, transparent);
    font-size: 0.72rem;
  }

  .book-toc-item-disclosure--placeholder {
    pointer-events: none;
  }

  .book-toc-item {
    display: grid;
    min-height: 2.35rem;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    border-radius: 0.55rem;
    padding: 0.45rem 0.65rem;
    text-align: left;
  }

  .book-toc-item-row--current .book-toc-item {
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--app-accent) 16%, transparent),
        color-mix(in srgb, var(--reader-page-text) 7%, transparent)
      ),
      color-mix(in srgb, var(--reader-page-bg) 82%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-accent) 28%, transparent);
  }

  .book-toc-item-label {
    min-width: 0;
    overflow: hidden;
    color: color-mix(in srgb, var(--reader-page-text) 86%, transparent);
    font-size: 0.9rem;
    font-weight: 650;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-toc-item-row--current .book-toc-item-label {
    color: var(--reader-page-text);
    font-weight: 820;
  }

  .book-toc-item-meta {
    color: color-mix(in srgb, var(--reader-page-text) 42%, transparent);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .book-toc-panel-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid color-mix(in srgb, var(--reader-page-text) 9%, transparent);
    padding: 0.75rem 1rem;
  }

  .book-toc-panel-nav {
    height: 2.2rem;
    width: 2.2rem;
    border-radius: 0.55rem;
    color: color-mix(in srgb, var(--reader-page-text) 68%, transparent);
  }

  .book-toc-panel-nav:disabled {
    cursor: not-allowed;
    opacity: 0.28;
  }

  .book-toc-panel-empty {
    display: grid;
    min-height: 70%;
    place-content: center;
    justify-items: center;
    padding: 2rem;
    text-align: center;
  }

  .book-toc-panel-empty-icon {
    height: 3rem;
    width: 3rem;
    font-size: 1.2rem;
  }

  .book-toc-panel-empty-title {
    margin-top: 0.85rem;
    color: var(--reader-page-text);
    font-size: 1rem;
    font-weight: 820;
  }
</style>
