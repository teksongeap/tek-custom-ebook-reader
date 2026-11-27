/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import type { writableStorageSubject } from '../../src/lib/data/internal/writable-storage-subject.ts';
import type { writableNumberLocalStorageSubject } from '../../src/lib/data/internal/writable-number-local-storage-subject.ts';
import type { writableBooleanLocalStorageSubject } from '../../src/lib/data/internal/writable-boolean-local-storage-subject.ts';
import type {
  writableArrayLocalStorageSubject,
  writableObjectLocalStorageSubject
} from '../../src/lib/data/internal/writable-object-local-storage-subject.ts';
import type { writableSetLocalStorageSubject } from '../../src/lib/data/internal/writable-set-local-storage-subject.ts';

let server: ViteDevServer;
let writable: typeof writableStorageSubject;
let number: typeof writableNumberLocalStorageSubject;
let boolean: typeof writableBooleanLocalStorageSubject;
let object: typeof writableObjectLocalStorageSubject;
let array: typeof writableArrayLocalStorageSubject;
let set: typeof writableSetLocalStorageSubject;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    logLevel: 'error'
  });
  const load = (name: string) => server.ssrLoadModule(`/src/lib/data/internal/${name}.ts`);
  ({ writableStorageSubject: writable } = await load('writable-storage-subject'));
  ({ writableNumberLocalStorageSubject: number } = await load(
    'writable-number-local-storage-subject'
  ));
  ({ writableBooleanLocalStorageSubject: boolean } = await load(
    'writable-boolean-local-storage-subject'
  ));
  ({ writableObjectLocalStorageSubject: object, writableArrayLocalStorageSubject: array } =
    await load('writable-object-local-storage-subject'));
  ({ writableSetLocalStorageSubject: set } = await load('writable-set-local-storage-subject'));
});

after(async () => {
  await server?.close();
});

function storage(value?: string) {
  const data = new Map(value === undefined ? [] : [['preference', value]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, next: string) => {
      data.set(key, next);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear()
  };
}

test('damaged and wrong-shape JSON preferences recover to their configured defaults', () => {
  for (const value of ['{broken', 'null', '42', '"text"', 'true']) {
    assert.deepEqual(object(storage(value))('preference', { enabled: true }).value, {
      enabled: true
    });
    assert.deepEqual(array<string>(storage(value))('preference', ['default']).value, ['default']);
    assert.deepEqual(
      [...set<string>(storage(value))('preference', new Set(['default'])).value],
      ['default']
    );
  }
  assert.deepEqual(object(storage('[]'))('preference', { enabled: true }).value, { enabled: true });
  assert.deepEqual(array(storage('{}'))('preference', ['default']).value, ['default']);
  assert.deepEqual([...set(storage('{}'))('preference', new Set(['default'])).value], ['default']);
});

test('numeric and boolean preferences reject corrupt values while retaining zero and false', () => {
  for (const value of ['NaN', 'Infinity', '-Infinity', 'garbage', '   ']) {
    assert.equal(number(storage(value))('preference', 20).value, 20);
  }
  assert.equal(number(storage('0'))('preference', 20).value, 0);
  assert.equal(number(storage('1.65'))('preference', 20).value, 1.65);
  assert.equal(boolean(storage('0'))('preference', true).value, false);
  assert.equal(boolean(storage('1'))('preference', false).value, true);
  assert.equal(boolean(storage('garbage'))('preference', true).value, true);
});

test('blocked reads and quota failures leave preferences usable for the current session', () => {
  const blocked = storage();
  blocked.getItem = () => {
    throw new Error('Blocked storage');
  };
  blocked.setItem = () => {
    throw new Error('Quota exceeded');
  };
  const preference = number(blocked)('preference', 20);
  assert.equal(preference.value, 20);
  preference.next(24);
  assert.equal(preference.value, 24);
});

test('healthy preferences continue to load and persist updates', () => {
  const saved = storage('{"enabled":false}');
  const preference = object<{ enabled: boolean }>(saved)('preference', { enabled: true });
  assert.deepEqual(preference.value, { enabled: false });
  preference.next({ enabled: true });
  assert.equal(saved.getItem('preference'), '{"enabled":true}');
  assert.deepEqual(
    [...set<string>(storage('["a","b","a"]'))('preference', new Set()).value],
    ['a', 'b']
  );
  const transient = writable(saved, JSON.parse, () => {
    throw new Error('Cannot serialize');
  })('preference', {});
  transient.next({ stillUsable: true });
  assert.deepEqual(transient.value, { stillUsable: true });
});
