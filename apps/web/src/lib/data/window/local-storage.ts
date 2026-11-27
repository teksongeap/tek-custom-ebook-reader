/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

class WindowStorage {
  private _store = new Map<string, string>();

  setItem(key: string, value: string) {
    this._store.set(key, value);
  }

  getItem(key: string) {
    return this._store.get(key) ?? null;
  }

  removeItem(key: string) {
    this._store.delete(key);
  }

  clear() {
    this._store = new Map();
  }
}

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>;

function getLocalStorage(): PreferenceStorage {
  try {
    if (typeof window !== 'undefined') return window.localStorage;
  } catch (_) {
    // Access itself can throw when the browser blocks site storage.
  }
  return new WindowStorage();
}

export const localStorage = getLocalStorage();
