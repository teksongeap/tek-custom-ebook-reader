<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { soundDesign } from '$lib/data/sound-design';
  import { buttonClasses } from '$lib/css-classes';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';

  export let title: string;

  export let message: string;

  onMount(() => {
    if (/error|fail/i.test(title)) soundDesign.play('error');
  });

  const dispatch = createEventDispatcher<{
    close: void;
  }>();
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{title}</svelte:fragment>
  <svelte:fragment slot="content">
    <p>{message}</p>
  </svelte:fragment>
  <svelte:fragment slot="footer">
    <button class={buttonClasses} on:click={() => dispatch('close')}>
      Close
      <Ripple />
    </button>
  </svelte:fragment>
</DialogTemplate>
