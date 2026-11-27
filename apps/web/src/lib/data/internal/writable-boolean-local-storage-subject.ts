/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage } from '../window/local-storage';

export function writableBooleanLocalStorageSubject(storage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => {
      if (x !== '0' && x !== '1') throw new Error('Invalid stored boolean');
      return x === '1';
    },
    (x) => (x ? '1' : '0')
  );
}
