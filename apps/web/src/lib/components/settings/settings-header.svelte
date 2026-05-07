<script lang="ts">
  import { faBookOpenReader, faClock, faDatabase } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { baseHeaderClasses, pxScreen } from '$lib/css-classes';

  export let leavePageLink: string;
  export let activeSettings: string;

  const settingItems = [
    {
      label: 'Reader',
      icon: faBookOpenReader
    },
    {
      label: 'Data',
      icon: faDatabase
    },
    {
      label: 'Statistics',
      icon: faClock
    }
  ];

  $: activeSettingsIndex = Math.max(
    settingItems.findIndex((settingItem) => settingItem.label === activeSettings),
    0
  );
</script>

<div class={baseHeaderClasses}>
  <div class="{pxScreen} flex items-center gap-2 px-2 md:px-5">
    <div
      class="settings-tabs"
      style={`--settings-tab-count: ${settingItems.length}; --settings-tab-index: ${activeSettingsIndex};`}
    >
      <span class="settings-tabs-indicator" aria-hidden="true"></span>
      {#each settingItems as settingItem (settingItem.label)}
        <button
          type="button"
          class="settings-tab-button"
          class:settings-tab-button--active={activeSettings === settingItem.label}
          aria-pressed={activeSettings === settingItem.label}
          on:click={() => (activeSettings = settingItem.label)}
        >
          <Fa class="settings-tab-icon" icon={settingItem.icon} />
          <span class="settings-tab-label">{settingItem.label}</span>
          <Ripple />
        </button>
      {/each}
    </div>
    <MergedHeaderIcon {leavePageLink} />
  </div>
</div>
