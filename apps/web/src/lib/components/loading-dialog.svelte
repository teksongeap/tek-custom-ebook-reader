<script lang="ts">
  import { faBookOpen } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let label = 'Loading';
  export let framed = true;
</script>

<section
  class="app-loading-dialog"
  class:app-loading-dialog--framed={framed}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <Fa class="app-loading-dialog__icon" icon={faBookOpen} />
  <p class="app-loading-dialog__label">{label}</p>
  <div class="app-loading-dialog__bar" aria-hidden="true"></div>
</section>
