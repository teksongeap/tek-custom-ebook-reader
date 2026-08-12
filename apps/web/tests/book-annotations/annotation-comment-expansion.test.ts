/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldOfferAnnotationCommentExpansionBeforeMeasurement } from '../../src/lib/components/book-reader/book-annotations/annotation-comment-expansion.ts';

test('offers comment disclosure only after the collapsed line limit', () => {
  assert.equal(shouldOfferAnnotationCommentExpansionBeforeMeasurement(''), false);
  assert.equal(shouldOfferAnnotationCommentExpansionBeforeMeasurement('First line'), false);
  assert.equal(
    shouldOfferAnnotationCommentExpansionBeforeMeasurement('First line\nSecond line'),
    false
  );
  assert.equal(
    shouldOfferAnnotationCommentExpansionBeforeMeasurement('First line\nSecond line\nThird line'),
    true
  );
});

test('normalizes surrounding whitespace and Windows line endings', () => {
  assert.equal(
    shouldOfferAnnotationCommentExpansionBeforeMeasurement('\n First line\r\nSecond line \n'),
    false
  );
  assert.equal(
    shouldOfferAnnotationCommentExpansionBeforeMeasurement(
      '\n First line\r\nSecond line\r\nThird line \n'
    ),
    true
  );
});

test('respects a custom collapsed line limit', () => {
  assert.equal(shouldOfferAnnotationCommentExpansionBeforeMeasurement('One\nTwo\nThree', 3), false);
  assert.equal(
    shouldOfferAnnotationCommentExpansionBeforeMeasurement('One\nTwo\nThree\nFour', 3),
    true
  );
});
