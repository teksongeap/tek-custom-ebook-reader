/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage } from '../window/local-storage';

export function writableNumberLocalStorageSubject(storage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => {
      const value = Number(x);
      if (!x.trim() || !Number.isFinite(value)) throw new Error('Invalid stored number');
      return value;
    },
    (x) => `${x}`
  );
}
