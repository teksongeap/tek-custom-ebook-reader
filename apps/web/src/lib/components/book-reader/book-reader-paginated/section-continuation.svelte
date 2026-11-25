<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let nextSectionTitle = 'Next section';
  export let verticalMode = false;

  const dispatch = createEventDispatcher<{ continue: void }>();
</script>

<div
  class="section-continuation"
  class:section-continuation--vertical={verticalMode}
  data-ttu-reader-ui
>
  <button
    type="button"
    class="section-continuation-arrow"
    aria-label="Continue to {nextSectionTitle}"
    on:click|stopPropagation={() => dispatch('continue')}
    on:keydown={(event) => {
      // Keep native button activation separate from reader shortcuts, while
      // allowing page navigation when this persistent button retains focus.
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    }}
  >
    {#if verticalMode}
      <span class="section-continuation-marker" lang="ja" aria-hidden="true">次回予告</span>
      <svg
        class="section-continuation-chevrons"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
        focusable="false"
      >
        <path d="m3 5 13 12L29 5M3 17l13 12 13-12" />
      </svg>
    {:else}
      <svg viewBox="0 0 520 104" aria-hidden="true" focusable="false">
        <path
          d="M7 29 30 28 31 79Z
           M39 29 68 29 41 79Z
           M76 30 77 80 50 80Z
           M86 29 142 29 221 28 300 29 379 28 449 29
           449 4Q449 2 451 4L510 52Q512 54 510 56L451 102
           Q449 104 449 101L449 79 370 78 293 80 213 79 135 80
           86 79Z"
          fill="currentColor"
        />
        <g
          class="section-continuation-lettering"
          transform="translate(104 29) scale(.96 .95)"
          fill-rule="evenodd"
        >
          <path
            d="M1 6 10 5 20 6 30 5 35 8 34 11 23 11 21 22 21 33
            23 43 19 46 15 44 15 34 16 22 16 11 7 12 0 10Z"
          />
          <path
            transform="translate(31 0)"
            d="M12 23C19 22 24 27 23 34 23 41 18 45 12 44
            5 45 1 40 1 34 0 27 6 24 12 23ZM12 29C8 29 6 32 7 35
            6 39 10 40 13 39 17 39 18 36 17 33 18 30 15 28 12 29Z"
          />
          <path
            transform="translate(65 0)"
            d="M3 9 12 7C22 7 29 10 28 17 28 22 24 24 21 25
            28 27 32 31 29 37 27 43 19 45 10 44L2 42 2 30 3 19Z
            M10 13 9 23C16 23 21 20 21 17 22 13 17 12 10 13Z
            M9 29 9 38C17 40 23 37 23 34 23 30 16 28 9 29Z"
          />
          <path
            transform="translate(95 1)"
            d="M21 36 24 39C20 44 14 46 8 43 1 41 0 35 2 29
            4 23 11 21 17 23 23 24 25 28 23 33L8 36C10 41 16 41 21 36Z
            M8 31 18 29C16 25 10 26 8 31Z"
          />
          <path
            transform="translate(126 0)"
            d="M28 7 29 12 25 15C20 10 13 14 9 22 5 29 6 38 13 39
            19 42 24 37 28 35L31 39C26 45 18 48 10 44 2 42-1 35 1 26
            3 16 12 6 20 5 24 4 26 5 28 7Z"
          />
          <path
            transform="translate(157 1)"
            d="M11 22C18 21 24 26 24 33 24 41 18 45 11 44
            4 45 0 39 1 33 1 27 5 23 11 22ZM12 28C8 28 6 31 7 35
            7 39 11 40 14 38 18 37 18 33 16 30 15 28 14 28 12 28Z"
          />
          <path
            transform="translate(182 1)"
            d="M2 24 7 23 8 27C13 21 19 21 22 26 25 31 22 36 25 42
            L20 45 17 43 16 33C17 27 13 27 10 31L8 43 2 44 1 35Z"
          />
          <path
            transform="translate(205 0)"
            d="M8 10 13 12 12 23 20 22 22 26 19 29 12 29
            11 37C11 41 14 39 17 38L19 43C14 47 7 46 5 41
            L5 30 0 29 0 25 6 24Z"
          />
          <path
            transform="translate(228 1)"
            d="M3 14 7 12 11 15 9 19 4 19 2 17ZM4 25 10 24
            9 33 10 42 6 45 2 42 3 34Z"
          />
          <path
            transform="translate(241 1)"
            d="M2 24 7 23 8 27C12 22 17 22 21 26 24 30 21 36 24 42
            L19 44 16 42 16 33C17 27 12 28 9 32L8 44 2 43 1 35Z"
          />
          <path
            transform="translate(267 0)"
            d="M2 25 7 23 9 26 8 36C7 41 12 41 15 36L17 25
            22 24 23 28 21 36 24 43 19 45 16 41C11 47 4 46 2 40
            L1 33Z"
          />
          <path
            transform="translate(292 1)"
            d="M20 36 23 39C19 45 12 46 6 42 0 39 0 32 3 27
            6 22 13 21 19 25 23 27 24 31 21 34L7 36C10 41 15 41 20 36Z
            M8 31 17 29C14 25 9 27 8 31Z"
          />
          <path
            transform="translate(316 0)"
            d="M18 3 23 0 25 2 22 16 21 31 22 39 26 43 22 46
            17 42C10 47 2 44 1 37-1 30 4 24 11 23L16 24 17 13Z
            M12 29C7 29 5 33 7 37 8 41 13 39 16 36L16 30Z"
          />
        </g>
      </svg>
    {/if}
  </button>
  <span class="section-continuation-title">{nextSectionTitle}</span>
</div>

<style lang="scss">
  .section-continuation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.35em 1em;
    padding: 1.5em 0 0.75em;
    break-inside: avoid;
    writing-mode: horizontal-tb;
    text-orientation: mixed;
    color: var(--reader-page-text, currentColor);
    font-size: inherit;
    line-height: 1.5;
  }

  .section-continuation-arrow {
    display: block;
    flex: 0 1 21rem;
    width: min(100%, 21rem);
    min-height: 44px;
    padding: 0.5rem 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: transform 140ms ease-out;

    &:hover {
      transform: translateX(3px);
    }

    &:focus-visible {
      outline: 2px solid var(--app-accent, currentColor);
      outline-offset: 4px;
      border-radius: 3px;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .section-continuation-lettering {
      fill: var(--reader-page-bg, var(--background-color));
    }
  }

  .section-continuation-title {
    max-width: 100%;
    font-family: inherit;
    font-size: 1em;
    text-align: center;
    text-wrap: balance;
    overflow-wrap: anywhere;
    opacity: 0.65;
  }

  .section-continuation--vertical {
    --continuation-page-height: var(--book-content-child-height, 100vh);
    flex-direction: column;
    flex-wrap: nowrap;
    width: min(max(23rem, 12em), var(--book-content-child-width, 100%));
    height: var(--continuation-page-height);
    box-sizing: border-box;
    padding: min(1em, calc(var(--continuation-page-height) * 0.03));
    gap: min(0.75em, calc(var(--continuation-page-height) * 0.03));
    align-items: center;
    justify-content: center;
  }

  .section-continuation--vertical .section-continuation-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 1 auto;
    width: auto;
    gap: min(0.35em, calc(var(--continuation-page-height) * 0.015));
    padding: min(0.25em, calc(var(--continuation-page-height) * 0.01)) 0.5em;

    &:hover {
      transform: translateY(3px);
    }
  }

  .section-continuation-marker {
    writing-mode: vertical-rl;
    text-orientation: upright;
    font-family: 'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
    font-size: min(2.25em, calc(var(--continuation-page-height) * 0.1));
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .section-continuation--vertical .section-continuation-chevrons {
    flex-shrink: 0;
    width: min(1.5em, calc(var(--continuation-page-height) / 15));
    height: min(1.5em, calc(var(--continuation-page-height) / 15));
  }

  .section-continuation--vertical .section-continuation-title {
    flex-shrink: 0;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    max-height: calc(var(--continuation-page-height) * 0.32);
    letter-spacing: 0.12em;
    text-align: start;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .section-continuation-arrow {
      transition: none;

      &:hover,
      .section-continuation--vertical &:hover {
        transform: none;
      }
    }
  }
</style>
