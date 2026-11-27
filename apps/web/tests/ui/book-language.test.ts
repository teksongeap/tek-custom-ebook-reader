/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareBookLanguages,
  getLanguageKey,
  getLanguageLabel
} from '../../src/lib/components/book-card/book-language.ts';
import { getCollectionBooks } from '../../src/lib/components/book-card/library-organization.ts';

test('language filtering groups regional variants and canonicalizes EPUB codes', () => {
  assert.equal(getLanguageKey('en-US'), 'en');
  assert.equal(getLanguageKey(' en_GB '), 'en');
  assert.equal(getLanguageKey('fra'), 'fr');
  assert.equal(getLanguageKey('zh-Hant-TW'), 'zh');
  assert.equal(getLanguageLabel('fr-FR'), 'French');
  assert.equal(getLanguageLabel('ja'), 'Japanese');
});

test('absent, unspecified, and invalid metadata stays Unknown', () => {
  for (const value of [undefined, '', '  ', 'und', 'not a language', 'xyz']) {
    assert.equal(getLanguageKey(value), '');
    assert.equal(getLanguageLabel(value), 'Unknown');
  }
});

test('language sort groups by language name, sorts titles within groups, and puts Unknown last', () => {
  const books = [
    { id: 1, title: 'A', language: '', lastBookOpen: 0, isPlaceholder: false, progress: 0 },
    { id: 2, title: 'Z', language: 'en-GB', lastBookOpen: 0, isPlaceholder: false, progress: 0 },
    { id: 3, title: 'B', language: 'fr', lastBookOpen: 0, isPlaceholder: false, progress: 0 },
    { id: 4, title: 'A', language: 'en-US', lastBookOpen: 0, isPlaceholder: false, progress: 0 }
  ];
  const collection = { id: 'all', name: 'All', bookIds: [1, 2, 3, 4], sort: 'language' as const };
  assert.deepEqual(
    getCollectionBooks(books, collection).map((book) => book.id),
    [4, 2, 3, 1]
  );
  assert.deepEqual(
    getCollectionBooks([...books].reverse(), collection).map((book) => book.id),
    [4, 2, 3, 1]
  );
  assert.equal(compareBookLanguages({ language: 'en-US' }, { language: 'en-GB' }), 0);
  assert.deepEqual(
    books.map((book) => book.id),
    [1, 2, 3, 4]
  );
});
