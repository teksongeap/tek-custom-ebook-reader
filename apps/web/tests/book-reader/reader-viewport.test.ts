/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGlidePageSize,
  observeReaderViewport
} from '../../src/lib/functions/reader-viewport.ts';

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

test('popup and transient resize events do not repaginate the reader, while real resizing does', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  class ReaderWindow extends EventTarget {
    innerWidth = 1200;
    innerHeight = 800;
    visualViewport = new EventTarget();
  }
  const target = new ReaderWindow();
  const sizes: { width: number; height: number }[] = [];
  const subscription = observeReaderViewport(target as unknown as Window).subscribe((size) =>
    sizes.push(size)
  );
  t.after(() => subscription.unsubscribe());
  assert.deepEqual(sizes, [{ width: 1200, height: 800 }]);

  target.visualViewport.dispatchEvent(new Event('resize'));
  target.dispatchEvent(new Event('resize'));
  t.mock.timers.tick(120);
  assert.equal(sizes.length, 1);

  target.innerHeight = 780;
  target.dispatchEvent(new Event('resize'));
  t.mock.timers.tick(30);
  target.innerHeight = 800;
  target.dispatchEvent(new Event('resize'));
  t.mock.timers.tick(120);
  assert.equal(sizes.length, 1);

  target.innerWidth = 900;
  target.innerHeight = 700;
  target.dispatchEvent(new Event('resize'));
  t.mock.timers.tick(119);
  assert.equal(sizes.length, 1);
  t.mock.timers.tick(1);
  assert.deepEqual(sizes.at(-1), { width: 900, height: 700 });
});
