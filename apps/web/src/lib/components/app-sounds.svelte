<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { soundDesign } from '$lib/data/sound-design';
  import { getControlSound } from '$lib/functions/control-sound';
  import { onMount } from 'svelte';

  afterNavigate(({ from, to }) => {
    if (!from || !to || from.url.href === to.url.href) return;
    soundDesign.play(to.route.id === '/b' ? 'book' : 'navigate');
  });

  onMount(() => {
    const unlock = (event: Event) => {
      if (event.isTrusted) soundDesign.unlock();
    };
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : undefined;
      const cue = target && getControlSound(target);
      if (cue) soundDesign.play(cue);
    };
    const change = (event: Event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-sound="none"]')) return;
      if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
        soundDesign.play('toggle');
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') soundDesign.hush();
    };
    let lastDialog: unknown;
    const subscription = dialogManager.dialogs$.subscribe((dialogs) => {
      const dialog = dialogs.find((item) => !item.nativeModal && !item.disableCloseOnClick);
      if (dialog === lastDialog) return;
      if (dialog || lastDialog) soundDesign.play(dialog ? 'open' : 'close');
      lastDialog = dialog;
    });
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', click);
    document.addEventListener('change', change);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', click);
      document.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', visibility);
      subscription.unsubscribe();
      soundDesign.hush();
    };
  });
</script>
