<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';

  export let title: string;
  export let tooltip = '';
  export let applyHeaderClasses = true;
</script>

<section class="settings-item">
  <div class="settings-item-header">
    <h2 class="settings-item-title" class:text-base={applyHeaderClasses}>
      {#if tooltip}
        <Popover contentText={tooltip} contentStyles="padding: 0.75rem;">
          <Fa icon={faCircleQuestion} slot="icon" class="settings-icon-action" />
          <span class="capitalize">{title}</span>
        </Popover>
      {:else}
        <span class="capitalize">{title}</span>
      {/if}
    </h2>
    <div class="settings-item-actions">
      <slot name="header" />
    </div>
  </div>
  <div class="settings-item-control">
    <slot />
  </div>
</section>
