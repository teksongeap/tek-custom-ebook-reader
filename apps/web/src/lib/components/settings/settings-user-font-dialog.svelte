<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import SvelteUserFontAdd from '$lib/components/settings/settings-user-font-add.svelte';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { isUserFont, userFontsCacheName } from '$lib/data/fonts';
  import { logger } from '$lib/data/logger';
  import { userFonts$ } from '$lib/data/store';
  import { faSpinner, faTrashCan } from '@fortawesome/free-solid-svg-icons';
  import type { BehaviorSubject } from 'rxjs';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  export let fontFamily: BehaviorSubject<string>;

  const tabs = ['Stored', 'Add'];

  let isLoading = false;
  let cacheLoaded = false;
  let currentTab = 'Stored';
  let fontCache: Cache | undefined;

  onMount(async () => {
    try {
      fontCache = await caches.open(userFontsCacheName);

      const fonts = (await fontCache.keys()).map(
        (request: Request) => new URL(request.url).pathname
      );

      $userFonts$ = $userFonts$.filter(
        (userFont) => isUserFont(userFont) && fonts.includes(userFont.path)
      );

      for (let index = 0, { length } = fonts; index < length; index += 1) {
        const font = fonts[index];
        const cachedFont = $userFonts$.find((userFont) => userFont.path === font);

        if (!cachedFont) {
          fontCache.delete(font).catch(() => {
            // no-op
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error loading font cache: ${error.message}`);
      fontCache = undefined;
    }

    cacheLoaded = true;
  });

  function selectFont(fontName: string) {
    fontFamily.next(fontName);
    dialogManager.dialogs$.next([]);
  }

  async function removeFont(path: string) {
    if (!fontCache) {
      return;
    }

    isLoading = true;

    try {
      await fontCache.delete(path);

      $userFonts$ = $userFonts$.filter((userFont) => userFont.path !== path);

      const currentFontName = fontFamily.getValue();

      if (!$userFonts$.find((userFont) => userFont.name === currentFontName)) {
        fontFamily.next('');
      }
    } catch (error: any) {
      logger.error(`Error deleting Font: ${error.message}`);
    }

    isLoading = false;
  }
</script>

<DialogTemplate>
  <div slot="content">
    {#if cacheLoaded}
      <div class="settings-dialog-tabs">
        {#each tabs as tab (tab)}
          <button
            type="button"
            class="settings-dialog-tab"
            class:settings-dialog-tab--active={currentTab === tab}
            on:click={() => (currentTab = tab)}
          >
            {tab}
          </button>
        {/each}
      </div>
      <div class="mt-5">
        {#if currentTab === 'Stored'}
          {#if $userFonts$.length}
            <div
              class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-y-3 gap-x-3 max-h-[50vh] overflow-auto"
            >
              {#each $userFonts$ as userFont (userFont.path)}
                <button
                  type="button"
                  title="Click to select Font"
                  class="settings-font-list-button"
                  on:click={() => selectFont(userFont.name)}
                >
                  {userFont.name}
                </button>
                <button
                  type="button"
                  title="Click to select Font"
                  class="settings-font-list-button settings-font-list-file"
                  on:click={() => selectFont(userFont.name)}
                >
                  {userFont.fileName}
                </button>
                <button
                  type="button"
                  title="Remove Font"
                  class="settings-icon-action settings-icon-action--boxed settings-icon-action--danger"
                  on:click={() => removeFont(userFont.path)}
                >
                  <Fa icon={faTrashCan} />
                </button>
              {/each}
            </div>
          {:else}
            <div>You have currently no stored Fonts</div>
          {/if}
        {:else if fontCache}
          <SvelteUserFontAdd {fontCache} bind:isLoading on:saved={() => (currentTab = 'Stored')} />
        {/if}
      </div>
    {/if}
    {#if !cacheLoaded || isLoading}
      <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
        <Fa icon={faSpinner} spin />
      </div>
    {/if}
  </div>
</DialogTemplate>
