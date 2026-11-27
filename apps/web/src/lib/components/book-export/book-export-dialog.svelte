<script lang="ts">
  import BookExportSelection from '$lib/components/book-export/book-export-selection.svelte';
  import Modal from '$lib/components/modal.svelte';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { lastExportedTarget$, lastExportedTypes$ } from '$lib/data/store';
  import { executeReplicate$ } from '$lib/functions/replication/replication-progress';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ close: void }>();
  let modal: Modal;
  $: canExport = !!$lastExportedTypes$.length;

  function replicateData() {
    if (!canExport) return;
    lastExportedTarget$.next(StorageKey.BACKUP);
    executeReplicate$.next();
    modal.close();
  }
</script>

<Modal
  bind:this={modal}
  id="book-export"
  title="Export books"
  description="Choose what to include."
  width="32rem"
  on:close={() => dispatch('close')}
>
  <BookExportSelection bind:dataToReplicate={$lastExportedTypes$} />
  <svelte:fragment slot="footer">
    {#if !canExport}<p role="status">Choose at least one item to export.</p>{/if}
    <button type="button" class="app-button" on:click={() => modal.close()}>Cancel</button>
    <button
      type="button"
      class="app-button app-button--primary"
      disabled={!canExport}
      on:click={replicateData}>Export</button
    >
  </svelte:fragment>
</Modal>

<style>
  p {
    flex-basis: 100%;
    color: var(--app-chrome-muted);
    font-size: 0.75rem;
  }
</style>
