<script context="module" lang="ts">
  let scrollLocks = 0;
  let originalOverflow = '';
  let originalGutter = '';

  function lockScrolling(root: HTMLElement) {
    if (scrollLocks === 0) {
      originalOverflow = root.style.overflow;
      originalGutter = root.style.scrollbarGutter;
      root.style.scrollbarGutter = 'stable';
      root.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        root.style.overflow = originalOverflow;
        root.style.scrollbarGutter = originalGutter;
      }
    };
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { faXmark } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { soundDesign } from '$lib/data/sound-design';

  export let id: string;
  export let title: string;
  export let description = '';
  export let width = '30rem';
  export let scrollable = true;
  export let contained = false;
  export let beforeClose: (() => boolean) | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void }>();
  let dialog: HTMLDialogElement;

  export function close() {
    soundDesign.play('close');
    dialog.close();
  }

  function requestClose() {
    if (!beforeClose || beforeClose()) close();
  }

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const unlockScrolling = lockScrolling(document.documentElement);
    dialog.showModal();
    soundDesign.play('open');
    dialog.addEventListener('keydown', trapFocus);
    dialog.querySelector<HTMLElement>('[data-modal-autofocus]')?.focus();
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      dialog.close();
      unlockScrolling();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  });

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
      )
    ).filter((item) => item.getClientRects().length);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="app-dialog app-modal writing-horizontal-tb"
  class:contained
  style:--modal-width={width}
  aria-labelledby={`${id}-title`}
  aria-describedby={description ? `${id}-description` : undefined}
  on:cancel|preventDefault={requestClose}
  on:close={() => dispatch('close')}
>
  <header>
    <h2 id={`${id}-title`}>{title}</h2>
    <button
      type="button"
      class="close-button"
      aria-label={`Close ${title.toLowerCase()}`}
      on:click={requestClose}
    >
      <Fa icon={faXmark} />
    </button>
  </header>
  {#if description}<p id={`${id}-description`} class="description">{description}</p>{/if}
  {#if $$slots.default}
    <div
      class="modal-body"
      class:modal-body--unscrolled={!scrollable}
      class:modal-body--contained={contained}
    >
      <slot />
    </div>
  {/if}
  {#if $$slots.footer}<footer><slot name="footer" /></footer>{/if}
</dialog>

<style>
  .app-modal {
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(var(--modal-width), calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
    overflow: visible;
  }
  .app-modal::backdrop {
    background: rgb(0 0 0 / 42%);
    backdrop-filter: blur(3px);
  }
  .app-modal[open] {
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
  }
  h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .description {
    color: var(--app-chrome-muted);
    font-size: 0.85rem;
    margin-top: 0.4rem;
  }
  .close-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 0.4rem;
    color: var(--app-chrome-muted);
  }
  .close-button:hover {
    background: var(--app-chrome-hover);
    color: var(--font-color);
  }
  .close-button:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  .modal-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 1.25rem -3px 0;
    padding: 3px;
  }
  .modal-body--unscrolled {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .modal-body--contained {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  @media (max-height: 599px) {
    .app-modal.contained {
      padding: 0.75rem;
    }
    .contained .modal-body {
      margin-top: 0.75rem;
    }
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    margin-top: 1.25rem;
  }
</style>
