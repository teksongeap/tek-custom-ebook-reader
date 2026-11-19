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
      <span class="capitalize">{title}</span>
    </h2>
    <div class="settings-item-actions">
      <slot name="header" />
      {#if tooltip}
        <Popover contentText={tooltip} contentStyles="padding: 0.75rem;">
          <button
            type="button"
            slot="icon"
            class="settings-icon-action"
            aria-label={`About ${title}`}
          >
            <Fa icon={faCircleQuestion} />
          </button>
        </Popover>
      {/if}
    </div>
  </div>
  <div class="settings-item-control">
    <slot />
  </div>
</section>
