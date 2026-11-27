<script lang="ts">
  export let up = false;
</script>

<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path d={up ? 'M3 11 8 5 13 11Z' : 'M3 5 8 11 13 5Z'} />
</svg>

<style>
  svg {
    display: block;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    fill: currentColor;
  }
</style>
