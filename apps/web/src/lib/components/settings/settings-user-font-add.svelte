<script lang="ts">
  import { inputClasses } from '$lib/css-classes';
  import { reservedFontNames } from '$lib/data/fonts';
  import { userFonts$ } from '$lib/data/store';
  import { dummyFn } from '$lib/functions/utils';
  import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let isLoading: boolean;
  export let fontCache: Cache;

  const dispatch = createEventDispatcher<{
    saved: void;
  }>();

  let fileElement: HTMLInputElement;
  let fontName = '';
  let fontFile: File | undefined;
  let currentError = 'no error';

  $: canSave = !!fontName && !!fontFile && currentError === 'no error';
  $: fontFileSize = fontFile ? `${(fontFile.size / 1024).toFixed(1)} KB` : '';

  function handleFileChange(event: Event) {
    const elm = event.target as HTMLInputElement;
    const file = elm.files?.[0];

    currentError = 'no error';

    if (!file) {
      resetFileElement();
      return;
    }

    const fileName = file.name.toLowerCase();

    if (
      !(
        fileName.endsWith('.woff2') ||
        fileName.endsWith('.woff') ||
        fileName.endsWith('.ttf') ||
        fileName.endsWith('.otf')
      )
    ) {
      currentError = 'only woff2, woff, ttf and otf fonts are supported';
      resetFileElement();
      return;
    }

    if (
      reservedFontNames.has(fontName) ||
      $userFonts$.find((userFont) => userFont.fileName === file.name || userFont.name === fontName)
    ) {
      currentError = 'a font file with this name is already stored';
      resetFileElement();
      return;
    } else if (!fontName) {
      currentError = 'Enter a font name to continue';
    }

    fontFile = file;
  }

  function handleFontNameInput(event: Event) {
    fontName = (event.target as HTMLInputElement).value;
    validateFontSelection();
  }

  function validateFontSelection() {
    currentError = 'no error';

    if (
      reservedFontNames.has(fontName) ||
      $userFonts$.find((userFont) => userFont.name === fontName)
    ) {
      currentError = 'a font file with this name is already stored';
    } else if (!!fontFile && !fontName) {
      currentError = 'Enter a font name to continue';
    }
  }

  function resetFileElement() {
    fileElement.value = '';
    fontFile = undefined;
  }

  async function addFont() {
    if (!fontFile) {
      return;
    }

    isLoading = true;

    try {
      const path = `/userfonts/${encodeURIComponent(fontFile.name)}`;
      const fontExtension = fontFile.name.split('.').pop()?.toLowerCase() || 'octet-stream';

      await fontCache.put(
        path,
        new Response(fontFile, {
          headers: {
            'Content-Type': `font/${fontExtension}`,
            'Content-Length': `${fontFile.size}`
          }
        })
      );

      $userFonts$ = [...$userFonts$, { name: fontName, path, fileName: fontFile.name }];
      fontName = '';
      resetFileElement();
      dispatch('saved');
    } catch (error: any) {
      currentError = error.message;
    }

    isLoading = false;
  }
</script>

<div class="flex flex-col min-w-[15rem] md:min-w-[20rem]">
  <span>Font Name</span>
  <input
    class={`${inputClasses} mt-2`}
    type="text"
    value={fontName}
    on:input={handleFontNameInput}
    on:blur={validateFontSelection}
  />
  <div class:invisible={currentError === 'no error'} class="my-2 text-red-500">{currentError}</div>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <label
      class={`${inputClasses} settings-font-file-picker w-full text-center sm:w-auto`}
      class:settings-font-file-picker--loaded={!!fontFile}
    >
      <input
        type="file"
        accept=".woff2,.woff,.ttf,.otf,application/font-woff2,application/font-woff,application/font-ttf,application/font-otf,font/woff2,font/woff,font/ttf,font/otf,font/opentype,font/truetype"
        class="hidden"
        bind:this={fileElement}
        on:change={handleFileChange}
      />
      {fontFile ? 'Change File' : 'Choose File'}
    </label>
    <div
      tabindex="0"
      role="button"
      title={canSave ? 'Save' : 'Select a File and Font name to save'}
      aria-disabled={!canSave}
      class="settings-icon-action settings-icon-action--boxed settings-icon-action--accent settings-icon-action--save"
      class:settings-icon-action--disabled={!canSave}
      on:click={() => {
        if (canSave) {
          addFont();
        }
      }}
      on:keyup={dummyFn}
    >
      <Fa class="text-lg" icon={faFloppyDisk} />
    </div>
  </div>
  {#if fontFile}
    <div class="settings-font-file-status" title={fontFile.name}>
      <span class="settings-font-file-status-indicator" aria-hidden="true"></span>
      <div class="min-w-0">
        <div class="settings-font-file-status-label">Font file loaded</div>
        <div class="settings-font-file-status-name">{fontFile.name} ({fontFileSize})</div>
      </div>
    </div>
  {/if}
</div>
