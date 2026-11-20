<script lang="ts">
  import LoadingDialog from '$lib/components/loading-dialog.svelte';
  import { faBookmark, type IconDefinition } from '@fortawesome/free-solid-svg-icons';

  export let fontColor: string;
  export let backgroundColor: string;
  export let label = 'Restoring your reading position';
  export let icon: IconDefinition = faBookmark;
</script>

<div
  class="reader-loading-screen fixed inset-0 z-20 flex items-center justify-center"
  style:color={fontColor}
  style:background-color={backgroundColor}
  style:--reader-page-text={fontColor}
  style:--reader-page-bg={backgroundColor}
>
  <div class="loading-indicator">
    <LoadingDialog {label} {icon} framed={false} />
  </div>
</div>

<style>
  .loading-indicator {
    opacity: 0;
    animation: show-indicator 150ms ease 200ms forwards;
  }

  @keyframes show-indicator {
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-indicator {
      opacity: 1;
      animation: none;
    }
  }
</style>
