<script lang="ts">
  import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { pagePath } from '$lib/data/env';

  export let leavePageLink: string;
  export let activeSettings: string;

  const settingItems = ['Reader', 'Data', 'Statistics'];
  $: backLabel = leavePageLink.startsWith(pagePath + '/b') ? 'Back to book' : 'Back to library';
</script>

<header class="app-header settings-page-header">
  <div class="app-header-content settings-header-row">
    <div class="settings-page-heading">
      <a class="settings-back-link" href={leavePageLink} aria-label={backLabel} title={backLabel}>
        <Fa icon={faArrowLeft} /><span>{backLabel}</span>
      </a>
      <h1>Settings</h1>
    </div>
    <span class="app-toolbar-divider" aria-hidden="true"></span>
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
  </div>
</header>
