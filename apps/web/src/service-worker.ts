/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

import { pagePath } from '$lib/data/env';
import { toSearchParams } from '$lib/functions/to-search-params';
import { userFontsCacheName } from '$lib/data/fonts';
import {
  cacheLazyBuildAsset,
  isObsoleteAppCache,
  networkFirstRaceCache
} from '$lib/functions/service-worker-cache';

// eslint-disable-next-line no-restricted-globals
const worker = self as unknown as ServiceWorkerGlobalScope;
const BUILD_CACHE_NAME = `build:${version}`;
const OTHER_CACHE_NAME = `other:${version}`;

const prerenderedSet = new Set(prerendered);

const allAssets = build.concat(files).concat(prerendered);
const lazyAssets = new Set(allAssets.filter(isFontAsset));
const assetsToCache = allAssets.filter((asset) => !lazyAssets.has(asset));
const cachedAssets = new Set(assetsToCache);

worker.addEventListener('install', (event) => {
  worker.skipWaiting();
  event.waitUntil(caches.open(BUILD_CACHE_NAME).then((cache) => cache.addAll(assetsToCache)));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const keysWithOldCache = keys.filter((key) =>
          isObsoleteAppCache(key, BUILD_CACHE_NAME, OTHER_CACHE_NAME)
        );
        return Promise.all(keysWithOldCache.map((key) => caches.delete(key)));
      })
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.headers.has('range')) return;

  const url = new URL(event.request.url);

  // don't try to handle e.g. data: URIs
  const isHttp = url.protocol.startsWith('http');
  const isDevServerRequest =
    url.hostname === worker.location.hostname && url.port !== worker.location.port;
  const isSelfHost = url.origin === worker.location.origin;
  const isBuildAsset = isSelfHost && cachedAssets.has(url.pathname);
  const isLazyAsset = isSelfHost && lazyAssets.has(url.pathname);
  const skipBecauseUncached = event.request.cache === 'only-if-cached' && !isBuildAsset;

  if (!isHttp || isDevServerRequest || skipBecauseUncached) return;

  if (isSelfHost && prerenderedSet.has(url.pathname)) {
    const requestWithoutParams = new Request(url.pathname);
    event.respondWith(
      networkFirstRaceCache(
        event.request,
        OTHER_CACHE_NAME,
        false,
        BUILD_CACHE_NAME,
        requestWithoutParams
      )
    );
    return;
  }

  if (isSelfHost && url.pathname.startsWith('/userfonts/')) {
    event.respondWith(
      caches
        .open(userFontsCacheName)
        .then((cache) => cache.match(url.pathname))
        .then((r) => r ?? createMissingUserFontResponse())
    );
    return;
  }

  if (isSelfHost) {
    const response = isLazyAsset
      ? cacheLazyBuildAsset(event.request, BUILD_CACHE_NAME)
      : isBuildAsset
        ? caches.match(url.pathname).then((r) => r ?? fetch(event.request))
        : selfHostParameterizedUrlResponse(event.request);
    if (response) {
      event.respondWith(response);
      return;
    }
  }

  if (url.host === 'fonts.googleapis.com') {
    event.respondWith(networkFirstRaceCache(event.request, OTHER_CACHE_NAME));
  }
});

function selfHostParameterizedUrlResponse(request: Request) {
  const url = new URL(request.url);

  const readerRegex = /\/b\/(?<id>\d+)\/?(\?|$)/;
  const readerRegexResult = readerRegex.exec(url.pathname);
  if (readerRegexResult?.groups) {
    return createRedirectResponse(`${[[pagePath]]}/b?${toSearchParams(readerRegexResult.groups)}`);
  }
  return undefined;
}

function createRedirectResponse(location: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location
    }
  });
}

function createMissingUserFontResponse() {
  return new Response(null, { status: 404 });
}

function isFontAsset(asset: string) {
  return /\.(?:otf|ttf|woff2?)$/i.test(asset);
}
