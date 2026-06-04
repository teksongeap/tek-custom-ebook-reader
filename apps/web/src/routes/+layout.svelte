<script lang="ts">
  import { browser } from '$app/environment';
  import { navigating, page } from '$app/stores';
  import DomainHint from '$lib/components/domain-hint.svelte';
  import LoadingDialog from '$lib/components/loading-dialog.svelte';
  import { basePath, clearConsoleOnReload } from '$lib/data/env';
  import { dialogManager, type Dialog } from '$lib/data/dialog-manager';
  import {
    getUserFontFormat,
    isUserFont,
    userFontsCacheName,
    type UserFont
  } from '$lib/data/fonts';
  import {
    customThemes$,
    fontFamilyGroupOne$,
    isOnline$,
    theme$,
    userFonts$
  } from '$lib/data/store';
  import { availableThemes, type ThemeOption } from '$lib/data/theme-option';
  import { getReaderFontFamilyCssValue, toCssQuotedString } from '$lib/functions/reader-typography';
  import { dummyFn, isMobile, isMobile$ } from '$lib/functions/utils';
  import { onDestroy, onMount } from 'svelte';
  import { MetaTags } from 'svelte-meta-tags';
  import '../app.scss';

  let path = '';
  let dialogs: Dialog[] = [];
  let clickOnCloseDisabled = false;
  let zIndex = '';
  let navigationRouteId: string | null | undefined;
  let showNavigationWarmup = false;
  let appTheme: ThemeOption | undefined;
  let userFontLoadToken = 0;
  let userFontObjectUrls: string[] = [];

  const navigationWarmupRoutes = new Set(['/b', '/manage', '/settings', '/statistics']);

  $: if (browser) {
    isMobile$.next(isMobile(window));
  }

  $: if (browser) {
    void addUserFonts($userFonts$);
  }

  $: if (browser) {
    applyAppTheme(appTheme);
  }

  if (clearConsoleOnReload && import.meta.hot) {
    // eslint-disable-next-line no-console
    import.meta.hot.on('vite:beforeUpdate', () => console.clear());
  }

  onMount(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    const refreshUserFontRules = () => addUserFonts($userFonts$);

    void navigator.serviceWorker.ready.then(refreshUserFontRules).catch(dummyFn);
    navigator.serviceWorker.addEventListener('controllerchange', refreshUserFontRules);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', refreshUserFontRules);
    };
  });

  onDestroy(() => {
    if (!browser) {
      return;
    }

    userFontLoadToken += 1;
    removeUserFontRules();
  });

  async function addUserFonts(userFonts: UserFont[]) {
    const loadToken = ++userFontLoadToken;
    let styleContent = '';
    const nextObjectUrls: string[] = [];
    let fontCache: Cache | undefined;

    if (!Array.isArray(userFonts)) {
      removeUserFontRules(loadToken);
      return;
    }

    try {
      fontCache = 'caches' in window ? await caches.open(userFontsCacheName) : undefined;
    } catch (_) {
      fontCache = undefined;
    }

    for (let index = 0, { length } = userFonts; index < length; index += 1) {
      const userFont = userFonts[index];
      if (!isUserFont(userFont)) {
        continue;
      }

      const format = getUserFontFormat(userFont.fileName);
      if (!format) {
        continue;
      }

      const fontUrl = await getUserFontUrl(userFont, fontCache);
      if (!fontUrl) {
        continue;
      }

      if (fontUrl.startsWith('blob:')) {
        nextObjectUrls.push(fontUrl);
      }

      if (loadToken !== userFontLoadToken) {
        revokeObjectUrls(nextObjectUrls);
        return;
      }

      styleContent += `@font-face{font-family: ${getReaderFontFamilyCssValue(userFont.name)};font-style: normal;font-weight: 400;font-display: swap;src: local(''), url(${toCssQuotedString(fontUrl)}) format(${toCssQuotedString(format)})}\n`;
    }

    if (loadToken !== userFontLoadToken) {
      revokeObjectUrls(nextObjectUrls);
      return;
    }

    if (!styleContent) {
      removeUserFontRules(loadToken, nextObjectUrls);
      return;
    }

    let styleElement = document.getElementById(userFontsCacheName);
    const textNode = document.createTextNode(styleContent);
    revokeObjectUrls(userFontObjectUrls);
    userFontObjectUrls = nextObjectUrls;

    if (styleElement) {
      if (styleElement.firstChild) {
        styleElement.replaceChild(textNode, styleElement.firstChild);
      } else {
        styleElement.appendChild(textNode);
      }
    } else {
      styleElement = document.createElement('style');
      styleElement.id = userFontsCacheName;

      styleElement.appendChild(textNode);
      document.head.append(styleElement);
    }
  }

  async function getUserFontUrl(userFont: UserFont, fontCache?: Cache) {
    if (!fontCache) {
      return userFont.path;
    }

    const response = await fontCache.match(userFont.path);
    if (!response) {
      return '';
    }

    return URL.createObjectURL(await response.blob());
  }

  function removeUserFontRules(expectedLoadToken?: number, objectUrls: string[] = []) {
    if (!browser) {
      return;
    }

    if (expectedLoadToken !== undefined && expectedLoadToken !== userFontLoadToken) {
      revokeObjectUrls(objectUrls);
      return;
    }

    document.getElementById(userFontsCacheName)?.remove();
    revokeObjectUrls(userFontObjectUrls);
    revokeObjectUrls(objectUrls);
    userFontObjectUrls = [];
  }

  function revokeObjectUrls(objectUrls: string[]) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
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
    !!navigationRouteId && navigationWarmupRoutes.has(navigationRouteId) && dialogs.length === 0;
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

<span style={`font-family: ${getReaderFontFamilyCssValue($fontFamilyGroupOne$)}`} />

<DomainHint />
