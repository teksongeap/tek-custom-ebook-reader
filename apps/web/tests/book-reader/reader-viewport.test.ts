/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getGlidePageSize } from '../../src/lib/functions/reader-viewport.ts';

test('full-width glide reserves enough space to see text beyond both column gaps', () => {
  for (const availableSize of [288, 640, 1216, 1920]) {
    const pageSize = getGlidePageSize(availableSize);
    const preview = (availableSize - pageSize) / 2;
    assert.ok(preview >= 64, `No usable neighboring text at ${availableSize}px`);
    assert.ok(pageSize >= 160);
    assert.ok(pageSize + preview * 2 <= availableSize);
  }
});

test('a narrower configured page keeps its existing width when previews already fit', () => {
  assert.equal(getGlidePageSize(1216, 720), 720);
});

test('tiny reading windows stay within the available space', () => {
  for (const size of [0, 120, 160, 200]) {
    assert.ok(getGlidePageSize(size) >= 0);
    assert.ok(getGlidePageSize(size) <= size);
  }
});
