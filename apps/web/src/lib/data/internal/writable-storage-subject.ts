/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { skip } from 'rxjs';
import type { localStorage } from '../window/local-storage';
import { writableSubject } from '$lib/functions/svelte/store';

type Storage = typeof localStorage;

export function writableStorageSubject<T>(
  storage: Storage,
  mapFromString: (s: string) => T,
  mapToString: (t: T) => string
) {
  return (key: string, defaultValue: T) => {
    const initValue = getStoredOrDefault(storage)(key, defaultValue, mapFromString);
    const subject = writableSubject(initValue);
    subject.pipe(skip(1)).subscribe((updatedValue) => {
      try {
        storage.setItem(key, mapToString(updatedValue ?? defaultValue));
      } catch (_) {
        // Keep the current session usable when storage is full or unavailable.
      }
    });
    return subject;
  };
}

function getStoredOrDefault(storage: Storage) {
  return <T>(key: string, defaultVal: T, mapFn: (s: string) => T) => {
    try {
      const stored = storage.getItem(key);
      return stored ? mapFn(stored) : defaultVal;
    } catch (_) {
      // A damaged preference must not prevent the entire app from starting.
      return defaultVal;
    }
  };
}
