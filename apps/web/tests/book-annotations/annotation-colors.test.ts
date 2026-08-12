/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getAnnotationColorPurposeLabel } from '../../src/lib/components/book-reader/book-annotations/annotation-colors.ts';

test('maps annotation colors to their reading purposes', () => {
  assert.equal(getAnnotationColorPurposeLabel('yellow'), 'Parse');
  assert.equal(getAnnotationColorPurposeLabel('green'), 'Connect');
  assert.equal(getAnnotationColorPurposeLabel('blue'), 'Investigate');
  assert.equal(getAnnotationColorPurposeLabel('pink'), 'Critique');
  assert.equal(getAnnotationColorPurposeLabel('violet'), 'Compress');
});
