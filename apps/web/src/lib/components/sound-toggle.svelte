<script lang="ts">
  import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
  import { soundDesign, soundEnabled$ } from '$lib/data/sound-design';
  import Fa from 'svelte-fa';

  function toggle() {
    $soundEnabled$ = !$soundEnabled$;
    if ($soundEnabled$) {
      soundDesign.unlock();
      soundDesign.play('toggle');
    }
  }
</script>

<button
  type="button"
  class="app-toolbar-button"
  data-sound="none"
  aria-label={$soundEnabled$ ? 'Mute app sounds' : 'Enable app sounds'}
  title={$soundEnabled$ ? 'Mute app sounds' : 'Enable app sounds'}
  aria-pressed={$soundEnabled$}
  on:click={toggle}
>
  <Fa icon={$soundEnabled$ ? faVolumeHigh : faVolumeXmark} />
</button>
