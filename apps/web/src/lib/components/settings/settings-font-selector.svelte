<script lang="ts">
  import Popover from '$lib/components/popover/popover.svelte';
  import { LocalFont } from '$lib/data/fonts';
  import { dummyFn } from '$lib/functions/utils';

  export let availableFonts: LocalFont[] = [LocalFont.NOTOSANSJP];
  export let fontValue: string;

  let element: Popover;
</script>

<Popover bind:this={element} placement="bottom">
  <div
    slot="icon"
    class="settings-icon-action settings-icon-action--boxed settings-icon-action--font mx-2"
    title="Show available default Fonts"
  >
    <span class="settings-font-symbol" aria-hidden="true">A</span>
  </div>
  <div class="app-menu" slot="content">
    {#each availableFonts as font (font)}
      <div
        tabindex="0"
        role="button"
        class="app-menu-item"
        class:app-menu-item--selected={fontValue === font}
        on:click={() => {
          fontValue = font;
          element.toggleOpen();
        }}
        on:keyup={dummyFn}
      >
        {font}
      </div>
    {/each}
  </div>
</Popover>
