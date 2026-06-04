<script lang="ts">
  import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import Ripple from '$lib/components/ripple.svelte';
  import { availableThemes } from '$lib/data/theme-option';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let options: ToggleOption<any>[];
  export let selectedOptionId: any;
  export let invertColors = false;

  const dispatch = createEventDispatcher<{
    edit: string;
    delete: string;
  }>();

  function mapToStyleString(style: Record<string, any> | undefined) {
    if (!style) return '';

    return Object.entries(style)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';');
  }
</script>

<div class="-m-1 flex flex-wrap">
  {#each options as option}
    <div class="flex">
      <button
        title={option.id}
        class="setting-toggle-button m-1 p-2 text-lg"
        class:setting-toggle-button--selected={option.id === selectedOptionId}
        class:setting-toggle-button--selected-inverted={option.id === selectedOptionId &&
          invertColors}
        class:border-4={option.thickBorders && option.id === selectedOptionId}
        style={mapToStyleString(option.style)}
        on:click={() => (selectedOptionId = option.id)}
      >
        {option.text}
        <Ripple />
      </button>
      {#if option.showIcons && option.id === selectedOptionId && !availableThemes.has(option.id)}
        <div class="setting-toggle-actions">
          <button
            type="button"
            title={`Edit ${option.id}`}
            class="settings-icon-action settings-icon-action--boxed setting-toggle-icon-action"
            on:click={() => dispatch('edit', option.id)}
          >
            <Fa icon={faPen} />
          </button>
          <button
            type="button"
            title={`Delete ${option.id}`}
            class="settings-icon-action settings-icon-action--boxed settings-icon-action--danger-hover setting-toggle-icon-action"
            on:click={() => dispatch('delete', option.id)}
          >
            <Fa icon={faTrash} />
          </button>
        </div>
      {/if}
    </div>
  {/each}

  <slot />
</div>
