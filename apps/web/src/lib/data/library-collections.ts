/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './internal/writable-storage-subject';
import { localStorage } from './window/local-storage';
import {
  parseLibraryCollections,
  type LibraryCollection
} from '$lib/components/book-card/library-organization';

export const libraryCollections$ = writableStorageSubject<LibraryCollection[]>(
  localStorage,
  parseLibraryCollections,
  JSON.stringify
)('libraryCollections', []);
