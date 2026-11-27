/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { localStorage } from '$lib/data/window/local-storage';
import { writableStorageSubject } from '$lib/data/internal/writable-storage-subject';

function createWritableObjectLocalStorageSubject<T>(fallback: string, storage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => {
      const value: unknown = JSON.parse(x || fallback);
      if (!Array.isArray(value)) throw new Error('Invalid stored set');
      return new Set(value) as T;
    },
    (x) => JSON.stringify([...(x as Set<T>)])
  );
}

export function writableSetLocalStorageSubject<T>(storage = localStorage) {
  return createWritableObjectLocalStorageSubject<Set<T>>('[]', storage);
}
