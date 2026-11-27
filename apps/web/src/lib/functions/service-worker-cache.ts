/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

async function matchCache(request: RequestInfo, cacheName: string) {
  try {
    return await caches.match(request, { cacheName });
  } catch (_) {
    return undefined;
  }
}

async function cacheResponse(request: RequestInfo, response: Response, cacheName: string) {
  if (!response.ok) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (_) {
    // Quota errors and unavailable caches must not break a successful network load.
  }
}

export async function cacheLazyBuildAsset(request: Request, cacheName: string) {
  const key = new URL(request.url).pathname;
  const cached = await matchCache(key, cacheName);
  if (cached) return cached;

  const response = await fetch(request);
  await cacheResponse(key, response, cacheName);
  return response;
}

export async function networkFirstRaceCache(
  request: Request,
  cacheName: string,
  storeResponse = true,
  fallbackCacheName?: string,
  fallbackCacheRequest?: Request,
  timeoutMs = 1000
) {
  const controller = new AbortController();
  const retrieveFromCache = async () => {
    const cached = storeResponse ? await matchCache(request, cacheName) : undefined;
    return (
      cached ??
      (fallbackCacheName
        ? await matchCache(fallbackCacheRequest ?? request, fallbackCacheName)
        : undefined)
    );
  };

  const network = (async () => {
    let response: Response;
    try {
      response = await fetch(request, { signal: controller.signal });
    } catch (error) {
      const cached = await retrieveFromCache();
      if (cached) return cached;
      throw error;
    }
    if (!response.ok) return (await retrieveFromCache()) ?? response;
    if (storeResponse) await cacheResponse(request, response, cacheName);
    return response;
  })();

  let handle: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  const fallback = new Promise<Response>((resolve) => {
    handle = setTimeout(() => {
      void retrieveFromCache().then((cached) => {
        if (done) return;
        if (cached) {
          resolve(cached);
          controller.abort();
        } else {
          // With no offline copy, continue waiting for the network.
          resolve(network);
        }
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([network, fallback]);
  } finally {
    done = true;
    clearTimeout(handle);
  }
}

export function isObsoleteAppCache(key: string, currentBuild: string, currentOther: string) {
  return (
    (key.startsWith('build:') || key.startsWith('other:')) &&
    key !== currentBuild &&
    key !== currentOther
  );
}
