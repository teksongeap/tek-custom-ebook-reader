<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Modal from '$lib/components/modal.svelte';

  export let resolver: (confirmed: boolean) => void;
  const dispatch = createEventDispatcher<{ close: void }>();
  let settled = false;

  function finish(confirmed: boolean) {
    if (settled) return;
    settled = true;
    resolver(confirmed);
    dispatch('close');
  }
  onDestroy(() => {
    if (!settled) resolver(false);
  });
</script>

<Modal
  id="restart-book"
  title="Restart book?"
  description="Return to the beginning and mark this book as unfinished. Your annotations and reading history will be kept."
  on:close={() => finish(false)}
>
  <svelte:fragment slot="footer">
    <button type="button" class="app-button app-button--primary" on:click={() => finish(true)}
      >Restart book</button
    >
  </svelte:fragment>
</Modal>
