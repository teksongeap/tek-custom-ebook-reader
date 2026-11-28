<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { quintInOut } from 'svelte/easing';
  import Fa from 'svelte-fa';
  import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
  import type { SectionWithProgress } from './book-toc/book-toc';
  import { getReaderChapterMarkers } from './reader-footer';

  export let chapterLabel = '';
  export let exploredCharCount = 0;
  export let bookCharCount = 0;
  export let sectionData: SectionWithProgress[] = [];
  export let showCharacterCounter = true;
  export let expanded = true;
  export let chromeStyle = '';

  const dispatch = createEventDispatcher<{ toggle: void }>();
  let trackWidth = 0;
  let collapseButton: HTMLButtonElement | undefined;
  let revealButton: HTMLButtonElement | undefined;

  async function toggleFooter() {
    dispatch('toggle');
    await tick();
    (expanded ? collapseButton : revealButton)?.focus({ preventScroll: true });
  }

  $: percent =
    bookCharCount > 0 ? Math.min(100, Math.max(0, (exploredCharCount / bookCharCount) * 100)) : 0;
  $: percentText = `${percent.toFixed(2)}%`;
  $: currentCount = Math.max(0, Math.floor(exploredCharCount || 0)).toLocaleString();
  $: totalCount = Math.max(0, Math.floor(bookCharCount || 0)).toLocaleString();
  $: markers = getReaderChapterMarkers(sectionData, bookCharCount, trackWidth);
  $: progressDescription = `${percentText} of book${showCharacterCounter ? `, ${currentCount} of ${totalCount} characters` : ''}`;
</script>

{#if !expanded}
  <button
    bind:this={revealButton}
    type="button"
    class="reader-chrome-toggle reader-footer-reveal"
    style={chromeStyle}
    aria-label="Show reading progress"
    title="Show reading progress"
    aria-expanded="false"
    aria-controls="ttu-page-footer"
    on:click|stopPropagation={toggleFooter}><Fa icon={faChevronUp} /></button
  >
{/if}
{#if expanded}
  <footer
    id="ttu-page-footer"
    class="reader-footer"
    class:reader-footer--empty={!bookCharCount}
    style={chromeStyle}
    transition:fly|local={{ y: 300, easing: quintInOut }}
  >
    <div id="ttu-footer-progress" class="reader-footer-content" hidden={!bookCharCount}>
      <div class="reader-footer-summary">
        <div class="reader-footer-progress">
          <span class="reader-footer-book-percent">{percentText}</span>
          <div class="reader-footer-chapter" title={chapterLabel}>
            <span class="sr-only">Current chapter: </span>
            <span class="reader-footer-chapter-label">{chapterLabel}</span>
          </div>
          <div
            class="reader-footer-track"
            role="progressbar"
            aria-label="Book progress"
            aria-valuenow={percent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuetext={progressDescription}
            bind:clientWidth={trackWidth}
          >
            <span class="reader-footer-fill" style:width={`${percent}%`}></span>
            {#each markers as marker (marker.key)}
              <span
                class="reader-footer-chapter-mark"
                style:left={`${marker.position}%`}
                aria-hidden="true"
              ></span>
            {/each}
          </div>
        </div>
      </div>
    </div>
    <div class="reader-footer-end">
      {#if showCharacterCounter && bookCharCount}
        <span
          class="reader-footer-count"
          title={`Character position: ${currentCount} of ${totalCount}`}
        >
          <span class="sr-only">Character position: </span>
          <span class="reader-footer-count-values"
            ><span>{currentCount}</span> / <span>{totalCount}</span></span
          >
          <span class="reader-footer-count-unit">characters</span>
        </span>
      {/if}
      <div class="reader-footer-controls">
        <slot name="actions" />
        <span class="app-toolbar-divider reader-chrome-divider" aria-hidden="true"></span>
        <button
          bind:this={collapseButton}
          type="button"
          class="reader-chrome-toggle reader-footer-toggle"
          aria-label="Hide reading progress"
          title="Hide reading progress"
          aria-expanded="true"
          aria-controls="ttu-page-footer"
          on:click|stopPropagation={toggleFooter}><Fa icon={faChevronDown} /></button
        >
      </div>
    </div>
  </footer>
{/if}
