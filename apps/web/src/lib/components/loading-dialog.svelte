<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let label = 'Loading';
</script>

<section class="app-loading-dialog" role="status" aria-label={label} aria-live="polite">
  <Fa class="app-loading-dialog__icon" icon={faSpinner} spin />
  <div class="app-loading-dialog__bar" aria-hidden="true"></div>
</section>
