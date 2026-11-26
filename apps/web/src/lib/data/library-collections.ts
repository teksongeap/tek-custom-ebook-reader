/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { writableArrayLocalStorageSubject } from './internal/writable-object-local-storage-subject';
import type { LibraryCollection } from '$lib/components/book-card/library-organization';

export const libraryCollections$ = writableArrayLocalStorageSubject<LibraryCollection>()(
  'libraryCollections',
  []
);
