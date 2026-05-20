<script lang="ts">
  import { browser } from '$app/environment';
  import { navigating, page } from '$app/stores';
  import DomainHint from '$lib/components/domain-hint.svelte';
  import LoadingDialog from '$lib/components/loading-dialog.svelte';
  import { basePath, clearConsoleOnReload } from '$lib/data/env';
  import { dialogManager, type Dialog } from '$lib/data/dialog-manager';
  import { userFontsCacheName, type UserFont } from '$lib/data/fonts';
  import {
    customThemes$,
    fontFamilyGroupOne$,
    isOnline$,
    theme$,
    userFonts$
  } from '$lib/data/store';
  import { availableThemes, type ThemeOption } from '$lib/data/theme-option';
  import { dummyFn, isMobile, isMobile$ } from '$lib/functions/utils';
  import { MetaTags } from 'svelte-meta-tags';
  import '../app.scss';

  let path = '';
  let dialogs: Dialog[] = [];
  let clickOnCloseDisabled = false;
  let zIndex = '';
  let navigationRouteId: string | null | undefined;
  let showNavigationWarmup = false;
  let appTheme: ThemeOption | undefined;

  $: if (browser) {
    isMobile$.next(isMobile(window));
    addUserFonts($userFonts$);
    applyAppTheme(appTheme);
  }

  if (clearConsoleOnReload && import.meta.hot) {
    // eslint-disable-next-line no-console
    import.meta.hot.on('vite:beforeUpdate', () => console.clear());
  }

  function addUserFonts(userFonts: UserFont[]) {
    let styleContent = '';

    for (let index = 0, { length } = userFonts; index < length; index += 1) {
      const userFont = userFonts[index];
      const ext = userFont.fileName.split('.').pop() || '';

      let format = '';

      switch (ext) {
        case 'otf':
          format = 'opentype';
          break;
        case 'ttf':
          format = 'truetype';
          break;
        default:
          format = ext;
          break;
      }

      styleContent += `@font-face{font-family: '${userFont.name}';font-style: normal;font-weight: 400;font-display: swap;src: local(''), url('${userFont.path}') format('${format}')}\n`;
    }

    let styleElement = document.getElementById(userFontsCacheName);

    if (!styleContent) {
      styleElement?.remove();
      return;
    }

    const textNode = document.createTextNode(styleContent);

    if (styleElement) {
      styleElement.replaceChild(textNode, styleElement.childNodes[0]);
    } else {
      styleElement = document.createElement('style');
      styleElement.id = userFontsCacheName;

      styleElement.appendChild(textNode);
      document.head.append(styleElement);
    }
  }

  function applyAppTheme(themeOption: ThemeOption | undefined) {
    if (!themeOption) {
      return;
    }

    document.documentElement.style.setProperty('--font-color', themeOption.fontColor);
    document.documentElement.style.setProperty('--background-color', themeOption.backgroundColor);
  }

  function closeAllDialogs() {
    dialogManager.dialogs$.next([]);
    clickOnCloseDisabled = false;
    zIndex = '';
  }

  dialogManager.dialogs$.subscribe((d) => {
    clickOnCloseDisabled = d[0]?.disableCloseOnClick ?? false;
    zIndex = d[0]?.zIndex ?? '';
    dialogs = d;
  });

  $: navigationRouteId = $navigating?.to?.route?.id;
  $: showNavigationWarmup =
    !!navigationRouteId && ['/b', '/settings'].includes(navigationRouteId) && dialogs.length === 0;
  $: appTheme =
    availableThemes.get($theme$) || $customThemes$[$theme$] || availableThemes.get('light-theme');

  page.subscribe((p) => (path = p.url.pathname));
</script>

<svelte:window bind:online={$isOnline$} />

<MetaTags
  title="とく Ebook Reader"
  description="Customized online e-book reader that supports dictionary extensions like Yomitan"
  canonical="{basePath}{path !== '/' ? path : ''}"
  openGraph={{
    type: 'website',
    images: [
      {
        url: `${basePath}/icons/regular-icon@512x512.png`,
        width: 512,
        height: 512
      }
    ]
  }}
/>

<slot />

{#if showNavigationWarmup}
  <div class="writing-horizontal-tb fixed inset-0 z-50 h-full w-full">
    <div class="tap-highlight-transparent absolute inset-0 bg-black/[.24]" />
    <div
      class="relative top-1/2 left-1/2 inline-block max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
    >
      <LoadingDialog label="Warming up" />
    </div>
  </div>
{/if}

{#if dialogs.length > 0}
  <div class="writing-horizontal-tb fixed inset-0 z-50 h-full w-full" style:z-index={zIndex}>
    <div
      tabindex="0"
      role="button"
      class="tap-highlight-transparent absolute inset-0 bg-black/[.32]"
      on:click={() => {
        if (!clickOnCloseDisabled) {
          closeAllDialogs();
        }
      }}
      on:keyup={dummyFn}
    />

    <div
      class="relative top-1/2 left-1/2 inline-block max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
    >
      {#each dialogs as dialog}
        {#if typeof dialog.component === 'string'}
          {@html dialog.component}
        {:else}
          <svelte:component this={dialog.component} {...dialog.props} on:close={closeAllDialogs} />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<span style={`font-family: ${$fontFamilyGroupOne$ || 'Noto Serif JP'}`} />

<DomainHint />
