<script lang="ts">
  import { faArrowLeft, faBookOpen } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { pagePath } from '$lib/data/env';

  export let bookPageLink: string | undefined;
  export let activeSettings: string;

  const settingItems = ['Reader', 'Data', 'Statistics'];
</script>

<header class="app-header settings-page-header">
  <div class="settings-page-container settings-header-row">
    <div class="settings-page-heading">
      <a
        class="settings-back-link"
        href={`${pagePath}/manage`}
        aria-label="Back to library"
        title="Back to library"
      >
        <Fa icon={faArrowLeft} /><span>Library</span>
      </a>
      <h1>Settings</h1>
    </div>
    <nav class="settings-tabs" aria-label="Settings categories">
      {#each settingItems as label (label)}
        <button
          type="button"
          class="settings-tab-button"
          class:settings-tab-button--active={activeSettings === label}
          aria-pressed={activeSettings === label}
          on:click={() => (activeSettings = label)}>{label}</button
        >
      {/each}
    </nav>
    {#if bookPageLink}
      <a
        class="settings-back-link settings-resume-link"
        href={bookPageLink}
        aria-label="Back to book"
        title="Back to book"
      >
        <Fa icon={faBookOpen} /><span>Back to book</span>
      </a>
    {/if}
  </div>
</header>
