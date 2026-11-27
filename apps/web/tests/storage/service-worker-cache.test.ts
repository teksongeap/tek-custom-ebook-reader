/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
  cacheLazyBuildAsset,
  isObsoleteAppCache,
  networkFirstRaceCache
} from '../../src/lib/functions/service-worker-cache.ts';

function setup(t: TestContext) {
  const entries = new Map<string, Response>();
  const writes: string[] = [];
  const key = (request: RequestInfo) => (typeof request === 'string' ? request : request.url);
  const cache = {
    put: async (request: RequestInfo, response: Response) => {
      writes.push(key(request));
      entries.set(key(request), response);
    }
  };
  const caches = {
    match: async (request: RequestInfo) => entries.get(key(request))?.clone(),
    open: async () => cache
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: caches });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor);
    else Reflect.deleteProperty(globalThis, 'caches');
  });
  return { entries, writes, cache, caches, request: new Request('https://reader.test/font.woff2') };
}

test('failed font responses are never cached and a subsequent request can recover', async (t) => {
  const { request, entries, writes } = setup(t);
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    ++attempts === 1 ? new Response('Unavailable', { status: 503 }) : new Response('font')
  );
  assert.equal((await cacheLazyBuildAsset(request, 'build:new')).status, 503);
  assert.equal(entries.size, 0);
  assert.equal(await (await cacheLazyBuildAsset(request, 'build:new')).text(), 'font');
  assert.deepEqual(writes, ['/font.woff2']);
  await cacheLazyBuildAsset(request, 'build:new');
  assert.equal(attempts, 2);
});

test('cache read and write failures do not discard successful network responses', async (t) => {
  const { request, caches, cache } = setup(t);
  t.mock.method(caches, 'match', async () => {
    throw new Error('Cache unavailable');
  });
  t.mock.method(cache, 'put', async () => {
    throw new Error('Quota exceeded');
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('fresh'));
  assert.equal(await (await cacheLazyBuildAsset(request, 'build:new')).text(), 'fresh');
  assert.equal(await (await networkFirstRaceCache(request, 'other:new')).text(), 'fresh');
});

test('offline and HTTP errors serve a known cached response without overwriting it', async (t) => {
  const { request, entries, writes } = setup(t);
  entries.set(request.url, new Response('offline copy'));
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Offline');
  });
  assert.equal(await (await networkFirstRaceCache(request, 'other:new')).text(), 'offline copy');
  fetch.mock.mockImplementation(async () => new Response('Server error', { status: 500 }));
  assert.equal(await (await networkFirstRaceCache(request, 'other:new')).text(), 'offline copy');
  assert.equal(writes.length, 0);
});

test('a stalled network returns the offline page even when fetch does not settle after abort', async (t) => {
  const { request, entries } = setup(t);
  entries.set('https://reader.test/b', new Response('reader shell'));
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, 'fetch', (_request: RequestInfo | URL, options?: RequestInit) => {
    signal = options?.signal;
    return new Promise<Response>(() => {});
  });
  const response = await networkFirstRaceCache(
    request,
    'other:new',
    false,
    'build:new',
    new Request('https://reader.test/b'),
    5
  );
  assert.equal(await response.text(), 'reader shell');
  assert.equal(signal?.aborted, true);
});

test('without an offline copy, slow requests wait for the network and failures propagate', async (t) => {
  const { request, entries } = setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return new Response('eventual success');
  });
  assert.equal(
    await (await networkFirstRaceCache(request, 'other:new', true, undefined, undefined, 1)).text(),
    'eventual success'
  );
  entries.clear();
  fetch.mock.mockImplementation(async () => {
    throw new Error('Offline');
  });
  await assert.rejects(networkFirstRaceCache(request, 'other:new'), /Offline/);
});

test('activation only deletes obsolete app caches, preserving fonts and other origin data', () => {
  for (const key of ['build:old', 'other:old'])
    assert.equal(isObsoleteAppCache(key, 'build:new', 'other:new'), true);
  for (const key of ['build:new', 'other:new', 'userfonts', 'another-app'])
    assert.equal(isObsoleteAppCache(key, 'build:new', 'other:new'), false);
});
