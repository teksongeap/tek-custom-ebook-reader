<script lang="ts">
  export let fontColor: string;
  export let backgroundColor: string;
</script>

<div
  class="reader-loading-screen fixed inset-0 z-20 flex items-center justify-center"
  style:color={fontColor}
  style:background-color={backgroundColor}
  role="status"
  aria-label="Opening your reading position"
>
  <span class="loading-indicator" aria-hidden="true">Opening your reading position…</span>
</div>

<style>
  .loading-indicator {
    font-size: 0.875rem;
    opacity: 0;
    animation: show-indicator 150ms ease 400ms forwards;
  }

  @keyframes show-indicator {
    to {
      opacity: 0.55;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-indicator {
      animation-duration: 0ms;
    }
  }
</style>
