/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAnnotationCommentScrollEdges,
  shouldOfferAnnotationCommentExpansionBeforeMeasurement
} from '../../src/lib/components/book-reader/book-annotations/annotation-comment-expansion.ts';

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

test('reports only the scroll edges that have more comment content', () => {
  assert.deepEqual(
    getAnnotationCommentScrollEdges({ clientHeight: 100, scrollHeight: 300, scrollTop: 0 }),
    { hasContentAbove: false, hasContentBelow: true }
  );
  assert.deepEqual(
    getAnnotationCommentScrollEdges({ clientHeight: 100, scrollHeight: 300, scrollTop: 80 }),
    { hasContentAbove: true, hasContentBelow: true }
  );
  assert.deepEqual(
    getAnnotationCommentScrollEdges({ clientHeight: 100, scrollHeight: 300, scrollTop: 200 }),
    { hasContentAbove: true, hasContentBelow: false }
  );
  assert.deepEqual(
    getAnnotationCommentScrollEdges({ clientHeight: 100, scrollHeight: 100, scrollTop: 0 }),
    { hasContentAbove: false, hasContentBelow: false }
  );
});
